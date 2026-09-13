import fs from "node:fs";
import path from "node:path";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LlmGradeOutputSchema, type StepGrade } from "../shared/gradingSchema.ts";
import type { LearningItem } from "../shared/learningItemSchema.ts";
import type { ChoiceStep, ClozeStep, FreeResponseStep } from "../shared/sessionSchema.ts";
import { ClaudeRefusalError, getClaudeClient, refusalFallbackRequestFields } from "./claudeClientFactory.ts";
import { assertAnthropicCredentialsConfigured, type LearningConfig } from "./learningConfig.ts";
import { topicDirectory } from "./repositoryPaths.ts";
import { describeStepForModel } from "./stepPromptDescriber.ts";

const GENERAL_GRADER_INSTRUCTIONS = `You are the grader inside a personal learning app. The learner just attempted an exercise and will see your feedback immediately.

Your feedback is the main way the learner learns, so be precise, honest, and useful:
- Grade the learner's actual answer against the exercise goal. Accept any correct, natural phrasing, not just the reference answers.
- Be strict about naturalness, but do not invent problems. If the answer is excellent, say so briefly.
- Keep the correction minimal and faithful to what the learner was trying to say.
- Prefer the single most important lesson over an exhaustive list.
- If hints were revealed, the maximum score is 3.
- If the learner disputes a previous grade, reconsider it on the merits. Change the grade only if their argument is correct, and say plainly whether you agree.
- Output fields are shown directly in the UI. Write in English, quoting Chinese where relevant. No markdown headings.`;

export interface GradeRequest {
  topicId: string;
  step: FreeResponseStep;
  targetItems: LearningItem[];
  learnerAnswer: string;
  hintsRevealed: number;
  inputMode: string;
  previousAttemptsInThisStep: { answer: string; score: number }[];
  dispute?: { originalGrade: StepGrade; learnerArgument: string };
}

export class AnswerGrader {
  public constructor(private readonly config: LearningConfig) {}

  public async gradeFreeResponse(request: GradeRequest): Promise<StepGrade> {
    if (request.step.type === "cloze" && !request.dispute) {
      const exactMatchGrade = this.tryExactMatchCloze(request.step, request.learnerAnswer, request.hintsRevealed);
      if (exactMatchGrade) return exactMatchGrade;
    }

    assertAnthropicCredentialsConfigured();
    const client = getClaudeClient();
    const response = await client.beta.messages.parse({
      model: this.config.grading.model,
      max_tokens: 16000,
      ...refusalFallbackRequestFields(),
      thinking: { type: "adaptive" },
      output_config: { effort: this.config.grading.effort, format: betaZodOutputFormat(LlmGradeOutputSchema) },
      system: [
        { type: "text", text: GENERAL_GRADER_INSTRUCTIONS },
        { type: "text", text: this.readTopicGradingRubric(request.topicId), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: this.buildGradingMessage(request) }],
    });

    if (response.stop_reason === "refusal") {
      throw new ClaudeRefusalError(response.stop_details?.explanation);
    }
    if (!response.parsed_output) {
      throw new Error(`Grader returned no parseable output (stop_reason: ${response.stop_reason})`);
    }

    const output = response.parsed_output;
    const maximumScore = request.hintsRevealed > 0 ? 3 : 4;
    return {
      ...output,
      score: Math.max(0, Math.min(maximumScore, Math.round(output.score))),
      gradedBy: "llm",
      model: response.model,
      gradedAt: new Date().toISOString(),
    };
  }

  public gradeChoice(step: ChoiceStep, selectedOptionIndex: number, isFirstAttempt: boolean): StepGrade {
    const selectedOption = step.options[selectedOptionIndex];
    if (!selectedOption) throw new Error(`Invalid option index ${selectedOptionIndex}`);
    const correctOptions = step.options.filter((option) => option.isCorrect);
    const isCorrect = selectedOption.isCorrect;
    return {
      score: isCorrect ? (isFirstAttempt ? 4 : 2) : 1,
      headline: isCorrect ? "Correct." : "Not quite.",
      correctedLearnerAnswer: isCorrect ? selectedOption.text : "",
      modelAnswers: correctOptions.map((option) => ({ chinese: option.text, note: option.explanation })),
      issues: [],
      strengths: [],
      explanation: selectedOption.explanation,
      targetItemIdsUsedCorrectly: isCorrect ? step.itemIds : [],
      gradedBy: "choice",
      gradedAt: new Date().toISOString(),
    };
  }

  private tryExactMatchCloze(step: ClozeStep, learnerAnswer: string, hintsRevealed: number): StepGrade | null {
    const normalizedAnswer = normalizeForComparison(learnerAnswer);
    const matchingFill = step.acceptableFills.find((fill) => normalizeForComparison(fill) === normalizedAnswer);
    if (!matchingFill) return null;
    return {
      score: hintsRevealed > 0 ? 3 : 4,
      headline: "Correct.",
      correctedLearnerAnswer: step.sentenceWithBlank.replace("___", matchingFill),
      modelAnswers: step.referenceAnswers.map((answer) => ({ chinese: answer, note: "" })),
      issues: [],
      strengths: [],
      explanation: "",
      targetItemIdsUsedCorrectly: step.itemIds,
      gradedBy: "exact_match",
      gradedAt: new Date().toISOString(),
    };
  }

  private buildGradingMessage(request: GradeRequest): string {
    const sections = [
      "<exercise>",
      describeStepForModel(request.step, request.targetItems),
      "</exercise>",
      "",
      `<learner_answer input_mode="${request.inputMode}" hints_revealed="${request.hintsRevealed}">`,
      request.learnerAnswer,
      "</learner_answer>",
    ];
    if (request.inputMode === "spoken" || request.inputMode === "mixed") {
      sections.push("", "Note: the answer was dictated via speech recognition, so ignore punctuation and obvious homophone transcription errors.");
    }
    if (request.previousAttemptsInThisStep.length > 0) {
      sections.push("", "Earlier attempts at this same exercise (the learner is retrying after feedback):");
      for (const attempt of request.previousAttemptsInThisStep) sections.push(`- score ${attempt.score}: ${attempt.answer}`);
    }
    if (request.dispute) {
      sections.push(
        "",
        "<dispute>",
        `Your previous grade: score ${request.dispute.originalGrade.score}. ${request.dispute.originalGrade.headline} ${request.dispute.originalGrade.explanation}`,
        `Learner's argument: ${request.dispute.learnerArgument}`,
        "</dispute>",
        "Re-grade the same answer taking the argument into account.",
      );
    }
    return sections.join("\n");
  }

  private readTopicGradingRubric(topicId: string): string {
    const rubricPath = path.join(topicDirectory(topicId), "grading.md");
    return fs.existsSync(rubricPath) ? `<topic_grading_rubric>\n${fs.readFileSync(rubricPath, "utf8")}\n</topic_grading_rubric>` : "(no topic-specific rubric)";
  }
}

function normalizeForComparison(text: string): string {
  return text.replace(/[\s\p{P}]/gu, "");
}
