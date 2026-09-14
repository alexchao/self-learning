import { z } from "zod";
import { StepGradeSchema } from "./gradingSchema.ts";

/**
 * Practice drills: 2–3 quick sentences generated right after a graded free-response step,
 * applying the most important lesson from its feedback. Stored in results.json (per step) and,
 * when the session completes, copied into topics/<topic>/practice-bank.json for reuse in later reviews.
 */

export const PracticeDrillAttemptSchema = z.object({
  answer: z.string(),
  inputMode: z.enum(["typed", "spoken", "mixed"]),
  submittedAt: z.string(),
  timeSpentMs: z.number().int().min(0),
  grade: StepGradeSchema,
});

export const PracticeDrillSchema = z.object({
  /** Unique within the step, e.g. "drill-1". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** What this drill practices, in English, e.g. "本來就: it would have happened anyway". */
  lesson: z.string(),
  /** The Chinese construction or vocabulary to apply, e.g. "本來就…". */
  targetExpression: z.string(),
  english: z.string(),
  context: z.string().default(""),
  referenceAnswers: z.array(z.string()).min(1),
  generatedAt: z.string(),
  generatedFromAttemptIndex: z.number().int().min(0),
  attempts: z.array(PracticeDrillAttemptSchema).default([]),
});

export const PracticeDrillSetSchema = z.object({
  drills: z.array(PracticeDrillSchema),
  skippedAt: z.string().optional(),
});

/** Structured output requested from the drill generator. */
export const LlmPracticeDrillGenerationOutputSchema = z.object({
  drills: z.array(
    z.object({
      lesson: z.string().describe("Short English description of what the construction expresses, e.g. 'it would have happened anyway'. Shown next to targetExpression, so don't repeat the Chinese."),
      targetExpression: z.string().describe("The Chinese construction or vocabulary the learner must apply, e.g. 本來就…"),
      english: z.string().describe("A natural English sentence (roughly 8–22 words) whose most natural Taiwanese Mandarin rendering uses the target."),
      context: z.string().describe("Very short situation, e.g. 'To a teammate, about a flaky test'. May be empty."),
      referenceAnswers: z.array(z.string()).describe("2 natural spoken Taiwanese Mandarin answers in Traditional characters that use the target."),
    }),
  ),
});

/** Compact structured output for grading a drill (faster than the full step grade). */
export const LlmPracticeDrillGradeOutputSchema = z.object({
  score: z.number().int().describe("0–4, same scale as step grading. Missing or misusing the target construction caps the score at 2."),
  appliedTarget: z.boolean().describe("Whether the learner used the target construction correctly."),
  headline: z.string().describe("One short sentence verdict in English."),
  correctedLearnerAnswer: z.string().describe("The learner's answer minimally corrected. Identical if no changes needed."),
  betterVersion: z.string().describe("One natural version a fluent Taiwanese speaker would say, using the target."),
  note: z.string().describe("At most 2 sentences in English on the key fix. Empty if the answer is excellent."),
});

export const PracticeBankEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  sourceSessionDirName: z.string(),
  sourceStepId: z.string(),
  /** Items the source step targeted (may be empty, e.g. diagnostic steps). */
  itemIds: z.array(z.string()),
  lesson: z.string(),
  targetExpression: z.string(),
  english: z.string(),
  context: z.string(),
  referenceAnswers: z.array(z.string()),
  firstAttempt: z.object({ answer: z.string(), score: z.number() }).nullable(),
});

export const PracticeBankSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(PracticeBankEntrySchema),
});

export type PracticeDrill = z.infer<typeof PracticeDrillSchema>;
export type PracticeDrillAttempt = z.infer<typeof PracticeDrillAttemptSchema>;
export type PracticeDrillSet = z.infer<typeof PracticeDrillSetSchema>;
export type PracticeBankEntry = z.infer<typeof PracticeBankEntrySchema>;
export type PracticeBank = z.infer<typeof PracticeBankSchema>;
