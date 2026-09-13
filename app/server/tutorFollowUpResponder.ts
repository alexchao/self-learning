import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { LearningItem } from "../shared/learningItemSchema.ts";
import type { StepResult } from "../shared/sessionResultsSchema.ts";
import type { SessionStep } from "../shared/sessionSchema.ts";
import { ClaudeRefusalError, getClaudeClient, refusalFallbackRequestFields } from "./claudeClientFactory.ts";
import { assertAnthropicCredentialsConfigured, type LearningConfig } from "./learningConfig.ts";
import { topicDirectory } from "./repositoryPaths.ts";
import { describeStepForModel } from "./stepPromptDescriber.ts";

const TUTOR_INSTRUCTIONS = `You are a tutor inside a personal learning app. The learner is mid-exercise and has a follow-up question about it.
Answer directly and concisely (usually 2–6 sentences), with short Chinese examples where they help. Plain text; **bold** is allowed for emphasis; no headings or bullet-heavy formatting.
If the learner is wrong about something, say so kindly and clearly.`;

export interface FollowUpRequest {
  topicId: string;
  step: SessionStep;
  targetItems: LearningItem[];
  stepResult: StepResult;
  question: string;
}

export class TutorFollowUpResponder {
  public constructor(private readonly config: LearningConfig) {}

  public async answerFollowUp(request: FollowUpRequest): Promise<string> {
    const contextLines = ["<exercise>", describeStepForModel(request.step, request.targetItems), "</exercise>"];
    for (const [index, attempt] of request.stepResult.attempts.entries()) {
      contextLines.push(
        `<attempt number="${index + 1}">`,
        `Answer: ${attempt.answer}`,
        `Grade: ${attempt.grade.score}/4. ${attempt.grade.headline}`,
        `Corrected: ${attempt.grade.correctedLearnerAnswer}`,
        `Explanation shown: ${attempt.grade.explanation}`,
        `</attempt>`,
      );
    }

    const messages: Anthropic.MessageParam[] = [];
    request.stepResult.followUps.forEach((exchange, index) => {
      messages.push({ role: "user", content: index === 0 ? `${contextLines.join("\n")}\n\n${exchange.question}` : exchange.question });
      messages.push({ role: "assistant", content: exchange.answer });
    });
    messages.push({
      role: "user",
      content: request.stepResult.followUps.length === 0 ? `${contextLines.join("\n")}\n\n${request.question}` : request.question,
    });

    assertAnthropicCredentialsConfigured();
    const response = await getClaudeClient().beta.messages.create({
      model: this.config.tutor.model,
      max_tokens: 16000,
      ...refusalFallbackRequestFields(),
      thinking: { type: "adaptive" },
      output_config: { effort: this.config.tutor.effort },
      system: [
        { type: "text", text: TUTOR_INSTRUCTIONS },
        { type: "text", text: this.readTopicGradingRubric(request.topicId), cache_control: { type: "ephemeral" } },
      ],
      messages,
    });

    if (response.stop_reason === "refusal") throw new ClaudeRefusalError(response.stop_details?.explanation);
    return response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
  }

  private readTopicGradingRubric(topicId: string): string {
    const rubricPath = path.join(topicDirectory(topicId), "grading.md");
    return fs.existsSync(rubricPath) ? `Topic guidance:\n${fs.readFileSync(rubricPath, "utf8")}` : "(no topic guidance)";
  }
}
