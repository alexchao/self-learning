import type { LearningItem } from "../shared/learningItemSchema.ts";
import { LlmPracticeDrillGenerationOutputSchema, type PracticeDrill } from "../shared/practiceDrillSchema.ts";
import type { StepAttempt } from "../shared/sessionResultsSchema.ts";
import type { FreeResponseStep } from "../shared/sessionSchema.ts";
import type { LearningConfig } from "./learningConfig.ts";
import type { LearningLlmClient } from "./learningLlmClient.ts";
import { describeStepForModel } from "./stepPromptDescriber.ts";
import { readTopicGradingRubric } from "./topicGradingRubricReader.ts";

const DRILL_GENERATOR_INSTRUCTIONS = `You write quick follow-up practice for a language learner who just got feedback on an exercise.

Goal: make the learner immediately APPLY the most important lesson from that feedback in fresh sentences.
- Pick the single most valuable, transferable lesson: usually the exercise's target item, or the construction/vocabulary behind the learner's biggest issue. If the feedback revealed two equally important lessons, you may split drills between them.
- Each drill is one English sentence the learner translates into spoken Taiwanese Mandarin. Its most natural translation must use the target construction.
- Use fresh situations that differ from the original exercise and from each other (e.g. a debate, a software team, a relationship, everyday life). Don't reuse the original sentence.
- Keep them quick: roughly 8–22 words, natural adult English, no word-for-word mirroring of the Chinese.
- Make the last drill slightly harder than the first.
- Reference answers: natural spoken Taiwanese Mandarin, Traditional characters.`;

export interface PracticeDrillGenerationRequest {
  topicId: string;
  step: FreeResponseStep;
  targetItems: LearningItem[];
  attempt: StepAttempt;
  attemptIndex: number;
  drillCount: number;
}

export class PracticeDrillGenerator {
  public constructor(
    private readonly config: LearningConfig,
    private readonly llmClient: LearningLlmClient,
  ) {}

  public async generateDrills(request: PracticeDrillGenerationRequest): Promise<PracticeDrill[]> {
    const { grade } = request.attempt;
    const feedbackSummary = [
      `Learner's answer: ${request.attempt.answer}`,
      `Score: ${grade.score}/4. ${grade.headline}`,
      `Corrected: ${grade.correctedLearnerAnswer}`,
      ...grade.issues.map((issue) => `Issue (${issue.category}): "${issue.learnerExcerpt}" → "${issue.suggestion}": ${issue.problem}`),
      `Explanation shown: ${grade.explanation}`,
      `Model answers shown: ${grade.modelAnswers.map((modelAnswer) => modelAnswer.chinese).join(" | ")}`,
    ].join("\n");

    const { output } = await this.llmClient.requestStructuredOutput({
      systemPromptSections: [DRILL_GENERATOR_INSTRUCTIONS, readTopicGradingRubric(request.topicId)],
      userMessage: `<exercise>\n${describeStepForModel(request.step, request.targetItems)}\n</exercise>\n\n<feedback>\n${feedbackSummary}\n</feedback>\n\nWrite exactly ${request.drillCount} drills.`,
      outputSchema: LlmPracticeDrillGenerationOutputSchema,
      model: this.config.grading.model,
      effort: this.config.grading.effort,
    });

    const generatedAt = new Date().toISOString();
    return output.drills
      .filter((drill) => drill.english.trim() && drill.referenceAnswers.length > 0)
      .slice(0, request.drillCount)
      .map((drill, index) => ({
        id: `drill-${index + 1}`,
        lesson: drill.lesson,
        targetExpression: drill.targetExpression,
        english: drill.english,
        context: drill.context,
        referenceAnswers: drill.referenceAnswers,
        generatedAt,
        generatedFromAttemptIndex: request.attemptIndex,
        attempts: [],
      }));
  }
}
