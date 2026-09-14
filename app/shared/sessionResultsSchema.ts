import { z } from "zod";
import { StepGradeSchema } from "./gradingSchema.ts";
import { PracticeDrillSetSchema } from "./practiceDrillSchema.ts";

/** Schema for topics/<topic>/sessions/<dir>/results.json. Written only by the server. */

export const GradeDisputeSchema = z.object({
  learnerArgument: z.string(),
  disputedAt: z.string(),
  originalGrade: StepGradeSchema,
  upheldLearner: z.boolean(),
});

export const StepAttemptSchema = z.object({
  answer: z.string(),
  inputMode: z.enum(["typed", "spoken", "mixed", "choice"]),
  hintsRevealed: z.number().int().min(0),
  submittedAt: z.string(),
  timeSpentMs: z.number().int().min(0),
  grade: StepGradeSchema,
  dispute: GradeDisputeSchema.optional(),
});

export const FollowUpExchangeSchema = z.object({
  question: z.string(),
  answer: z.string(),
  askedAt: z.string(),
});

export const StepResultSchema = z.object({
  attempts: z.array(StepAttemptSchema).default([]),
  followUps: z.array(FollowUpExchangeSchema).default([]),
  /** Quick practice sentences generated after feedback (see practiceDrillSchema.ts). */
  practiceDrills: PracticeDrillSetSchema.optional(),
  completedAt: z.string().optional(),
});

export const ItemScheduleChangeSchema = z.object({
  itemId: z.string(),
  score: z.number(),
  stageBefore: z.number(),
  stageAfter: z.number(),
  intervalDaysBefore: z.number(),
  intervalDaysAfter: z.number(),
  dueAt: z.string(),
});

export const EndOfSessionFeedbackSchema = z.object({
  difficulty: z.enum(["too_easy", "about_right", "too_hard"]).optional(),
  steeringNote: z.string().default(""),
  processFeedback: z.string().default(""),
  submittedAt: z.string(),
});

export const SessionResultsSchema = z.object({
  schemaVersion: z.literal(1),
  sessionDirName: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  steps: z.record(z.string(), StepResultSchema).default({}),
  endOfSessionFeedback: EndOfSessionFeedbackSchema.optional(),
  itemScheduleChanges: z.array(ItemScheduleChangeSchema).default([]),
  nextSessionPreparation: z
    .object({ triggeredAt: z.string(), logPath: z.string(), skippedReason: z.string().optional() })
    .optional(),
});

export type SessionResults = z.infer<typeof SessionResultsSchema>;
export type StepResult = z.infer<typeof StepResultSchema>;
export type StepAttempt = z.infer<typeof StepAttemptSchema>;
export type FollowUpExchange = z.infer<typeof FollowUpExchangeSchema>;
export type ItemScheduleChange = z.infer<typeof ItemScheduleChangeSchema>;
export type EndOfSessionFeedback = z.infer<typeof EndOfSessionFeedbackSchema>;
