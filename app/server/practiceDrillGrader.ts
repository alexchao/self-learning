import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { StepGrade } from "../shared/gradingSchema.ts";
import { LlmPracticeDrillGradeOutputSchema, type PracticeDrill } from "../shared/practiceDrillSchema.ts";
import { ClaudeRefusalError, getClaudeClient, refusalFallbackRequestFields } from "./claudeClientFactory.ts";
import { assertAnthropicCredentialsConfigured, type LearningConfig } from "./learningConfig.ts";
import { readTopicGradingRubric } from "./topicGradingRubricReader.ts";

const DRILL_GRADER_INSTRUCTIONS = `You grade a quick practice drill in a language-learning app. The learner is applying one specific construction they were just taught.
Judge two things: did they apply the target construction correctly, and is the sentence natural spoken Taiwanese Mandarin that conveys the English meaning?
Accept any natural phrasing that uses the target. Missing or misusing the target caps the score at 2.
Be brief: this is fast practice, not a full lesson. Output fields are shown directly in the UI; write in English, quoting Chinese where relevant.`;

export class PracticeDrillGrader {
  public constructor(private readonly config: LearningConfig) {}

  public async gradeDrillAnswer(topicId: string, drill: PracticeDrill, learnerAnswer: string, inputMode: string, itemIds: string[]): Promise<StepGrade> {
    assertAnthropicCredentialsConfigured();
    const lines = [
      `<drill>`,
      `Target construction: ${drill.targetExpression} (${drill.lesson})`,
      drill.context ? `Context: ${drill.context}` : "",
      `English to translate: ${drill.english}`,
      `Reference answers (not exhaustive): ${drill.referenceAnswers.join(" | ")}`,
      `</drill>`,
      `<learner_answer input_mode="${inputMode}">`,
      learnerAnswer,
      `</learner_answer>`,
      inputMode === "typed" ? "" : "The answer was dictated; ignore punctuation and obvious homophone transcription errors.",
    ].filter(Boolean);

    const response = await getClaudeClient().beta.messages.parse({
      model: this.config.grading.model,
      max_tokens: 16000,
      ...refusalFallbackRequestFields(),
      thinking: { type: "adaptive" },
      output_config: { effort: this.config.grading.effort, format: betaZodOutputFormat(LlmPracticeDrillGradeOutputSchema) },
      system: [
        { type: "text", text: DRILL_GRADER_INSTRUCTIONS },
        { type: "text", text: readTopicGradingRubric(topicId), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: lines.join("\n") }],
    });

    if (response.stop_reason === "refusal") throw new ClaudeRefusalError(response.stop_details?.explanation);
    if (!response.parsed_output) throw new Error(`Drill grader returned no parseable output (stop_reason: ${response.stop_reason})`);

    const output = response.parsed_output;
    const maximumScore = output.appliedTarget ? 4 : 2;
    return {
      score: Math.max(0, Math.min(maximumScore, Math.round(output.score))),
      headline: output.headline,
      correctedLearnerAnswer: output.correctedLearnerAnswer,
      modelAnswers: output.betterVersion ? [{ chinese: output.betterVersion, note: "" }] : [],
      issues: [],
      strengths: [],
      explanation: output.note,
      targetItemIdsUsedCorrectly: output.appliedTarget ? itemIds : [],
      gradedBy: "llm",
      model: response.model,
      gradedAt: new Date().toISOString(),
    };
  }
}
