import { z } from "zod";
import { ExampleSentenceSchema } from "./sessionSchema.ts";

/** Schema for topics/<topic>/items.json: the spaced-repetition deck with Bloom stages. */

export const SpacedRepetitionStateSchema = z.object({
  /** null = never reviewed (not yet introduced). */
  dueAt: z.string().nullable(),
  intervalDays: z.number().min(0),
  ease: z.number().min(1.3),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  lastReviewedAt: z.string().nullable(),
});

export const ItemReviewRecordSchema = z.object({
  sessionDirName: z.string(),
  stepIds: z.array(z.string()),
  stageTested: z.number(),
  score: z.number(),
  reviewedAt: z.string(),
  stageAfter: z.number(),
  intervalDaysAfter: z.number(),
});

export const LearningItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "item ids are kebab-case"),
  kind: z.enum(["pattern", "expression", "concept_vocabulary", "chengyu", "discourse_move"]),
  /** The Chinese form, e.g. "與其 A，不如 B" or "舉證責任". */
  headword: z.string(),
  pinyin: z.string().optional(),
  gloss: z.string(),
  explanation: z.string(),
  examples: z.array(ExampleSentenceSchema).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  /** Session dir that first taught this item; null until a session introduces it. */
  introducedInSession: z.string().nullable(),
  /** 0 = not yet studied; 1–6 = Bloom ladder stage (see docs/SYSTEM.md). */
  stage: z.number().int().min(0).max(6),
  spacedRepetition: SpacedRepetitionStateSchema,
  history: z.array(ItemReviewRecordSchema).default([]),
});

export const LearningItemDeckSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(LearningItemSchema),
});

export type LearningItem = z.infer<typeof LearningItemSchema>;
export type LearningItemDeck = z.infer<typeof LearningItemDeckSchema>;
export type SpacedRepetitionState = z.infer<typeof SpacedRepetitionStateSchema>;

export function createUnstudiedSpacedRepetitionState(): SpacedRepetitionState {
  return { dueAt: null, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, lastReviewedAt: null };
}
