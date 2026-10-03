import type { LearningItem } from "../shared/learningItemSchema.ts";
import type { StepResult } from "../shared/sessionResultsSchema.ts";
import type { SessionStep } from "../shared/sessionSchema.ts";
import type { LearningConfig } from "./learningConfig.ts";
import type { LearningLlmClient, LlmConversationTurn } from "./learningLlmClient.ts";
import { describeStepForModel } from "./stepPromptDescriber.ts";
import { readTopicGradingRubric } from "./topicGradingRubricReader.ts";

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
  public constructor(
    private readonly config: LearningConfig,
    private readonly llmClient: LearningLlmClient,
  ) {}

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

    const messages: LlmConversationTurn[] = [];
    request.stepResult.followUps.forEach((exchange, index) => {
      messages.push({ role: "user", content: index === 0 ? `${contextLines.join("\n")}\n\n${exchange.question}` : exchange.question });
      messages.push({ role: "assistant", content: exchange.answer });
    });
    messages.push({
      role: "user",
      content: request.stepResult.followUps.length === 0 ? `${contextLines.join("\n")}\n\n${request.question}` : request.question,
    });

    return this.llmClient.requestText({
      systemPromptSections: [TUTOR_INSTRUCTIONS, readTopicGradingRubric(request.topicId)],
      conversation: messages,
      model: this.config.tutor.model,
      effort: this.config.tutor.effort,
    });
  }

}
