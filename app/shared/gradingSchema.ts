import { z } from "zod";

/** Structured output requested from the LLM grader. Kept free of numeric range constraints for structured-output compatibility; clamped after parsing. */
export const LlmGradeOutputSchema = z.object({
  score: z
    .number()
    .int()
    .describe(
      "0 = blank/unrelated/wrong meaning; 1 = major errors or communicative goal not achieved; 2 = understandable but clearly unnatural, or target item missing/misused; 3 = correct and natural with at most minor issues; 4 = excellent, what a fluent Taiwanese speaker would say",
    ),
  headline: z.string().describe("One short sentence verdict in English."),
  correctedLearnerAnswer: z
    .string()
    .describe("The learner's answer, minimally edited to be correct and natural. Keep their structure where possible. Identical to their answer if no changes needed."),
  modelAnswers: z
    .array(z.object({ chinese: z.string(), note: z.string().describe("What makes this version good or how it differs, in English. May be empty.") }))
    .describe("1–3 natural answers a fluent Taiwanese speaker might say. Include the most idiomatic one first."),
  issues: z
    .array(
      z.object({
        learnerExcerpt: z.string().describe("Exact excerpt from the learner's answer."),
        problem: z.string().describe("What is wrong or unnatural, in English."),
        suggestion: z.string().describe("Better Chinese wording."),
        category: z.enum(["grammar", "word_choice", "naturalness", "meaning", "target_item", "characters", "missing_content", "other"]),
      }),
    )
    .describe("Specific issues, most important first. Empty if none."),
  strengths: z.array(z.string()).describe("Brief, specific things the learner did well. May be empty."),
  explanation: z.string().describe("Concise teaching explanation in English (with Chinese examples) of the most important lesson from this attempt. 2–5 sentences."),
  targetItemIdsUsedCorrectly: z.array(z.string()).describe("Ids of target items the learner used correctly."),
});

export type LlmGradeOutput = z.infer<typeof LlmGradeOutputSchema>;

export const StepGradeSchema = LlmGradeOutputSchema.extend({
  gradedBy: z.enum(["llm", "exact_match", "choice"]),
  model: z.string().optional(),
  gradedAt: z.string(),
});

export type StepGrade = z.infer<typeof StepGradeSchema>;

export const SCORE_LABELS: Record<number, string> = {
  0: "Missed",
  1: "Not yet",
  2: "Partly there",
  3: "Good",
  4: "Excellent",
};
