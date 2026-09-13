import { z } from "zod";

/** Schema for topics/<topic>/topic.json. */
export const TopicDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  goal: z.string(),
  status: z.enum(["active", "paused", "archived"]),
  targetSessionMinutes: z.object({ min: z.number(), max: z.number() }),
  /** Soft cap on review steps per session so gaps don't create an avalanche. */
  maxReviewStepsPerSession: z.number().int().min(0),
  /** BCP-47 language tag for browser speech synthesis/recognition, if relevant. */
  speechLanguage: z.string().optional(),
  createdAt: z.string(),
});

export type TopicDefinition = z.infer<typeof TopicDefinitionSchema>;
