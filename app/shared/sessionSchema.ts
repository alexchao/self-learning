import { z } from "zod";

/**
 * Schema for topics/<topic>/sessions/<dir>/session.json.
 * Sessions are data; the web runtime renders each step by its `type`.
 * To add a new interaction, add a step schema here, a renderer in app/web/src/steps/,
 * and grading support in app/server/ if needed. Document it in docs/SESSION-AUTHORING.md.
 */

export const BloomStageSchema = z
  .number()
  .int()
  .min(1)
  .max(6)
  .describe("1 Recognize, 2 Cued recall, 3 Guided production, 4 Translation, 5 Contextual use, 6 Free production");

export const ExampleSentenceSchema = z.object({
  chinese: z.string(),
  english: z.string(),
  pinyin: z.string().optional(),
  note: z.string().optional(),
});

export const ImageReferenceSchema = z.object({
  /** Path relative to the session directory, e.g. "assets/cafe.png" */
  path: z.string(),
  alt: z.string(),
});

const StepBaseFields = {
  id: z.string().regex(/^[a-z0-9-]+$/, "step ids are kebab-case"),
  /** Learning item ids (from items.json) this step targets. Drives spaced-repetition updates. */
  itemIds: z.array(z.string()).default([]),
  /** Intended Bloom stage of this step. Required for graded steps that target items. */
  stage: BloomStageSchema.optional(),
  /** Notes for the grader and future agents; never shown to the learner. */
  authorNotes: z.string().optional(),
};

export const TeachStepSchema = z.object({
  ...StepBaseFields,
  type: z.literal("teach"),
  heading: z.string(),
  /** Short. Paragraphs separated by blank lines; **bold** supported. */
  body: z.string(),
  examples: z.array(ExampleSentenceSchema).default([]),
  image: ImageReferenceSchema.optional(),
});

export const ChoiceStepSchema = z.object({
  ...StepBaseFields,
  type: z.literal("choice"),
  prompt: z.string(),
  context: z.string().optional(),
  options: z
    .array(
      z.object({
        text: z.string(),
        isCorrect: z.boolean(),
        explanation: z.string(),
      }),
    )
    .min(2),
});

const FreeResponseFields = {
  ...StepBaseFields,
  /** Reference answers in Traditional Chinese. The grader accepts other natural phrasings. */
  referenceAnswers: z.array(z.string()).min(1),
  /** Progressive hints; revealing hints is recorded and considered in grading. */
  hints: z.array(z.string()).default([]),
  /** Rubric notes specific to this step (e.g. "must use 與其…不如"). */
  gradingNotes: z.string().optional(),
  image: ImageReferenceSchema.optional(),
};

export const ClozeStepSchema = z.object({
  ...FreeResponseFields,
  type: z.literal("cloze"),
  /** Chinese sentence with exactly one "___" blank. */
  sentenceWithBlank: z.string().refine((text) => text.split("___").length === 2, "must contain exactly one ___"),
  englishMeaning: z.string(),
  /** Exact-match answers that are auto-graded as correct without an LLM call. */
  acceptableFills: z.array(z.string()).min(1),
});

export const TranslateStepSchema = z.object({
  ...FreeResponseFields,
  type: z.literal("translate"),
  english: z.string(),
  /** Optional situational context ("to a coworker during code review"). */
  context: z.string().optional(),
});

export const RewriteStepSchema = z.object({
  ...FreeResponseFields,
  type: z.literal("rewrite"),
  instruction: z.string(),
  sourceText: z.string(),
});

export const DialogueLineSchema = z.object({
  speaker: z.string(),
  chinese: z.string(),
  english: z.string().optional(),
});

export const RespondStepSchema = z.object({
  ...FreeResponseFields,
  type: z.literal("respond"),
  scenario: z.string(),
  dialogue: z.array(DialogueLineSchema).min(1),
  /** The communicative goal, stated without naming the target expression. */
  task: z.string(),
});

export const FreeProductionStepSchema = z.object({
  ...FreeResponseFields,
  type: z.literal("free_production"),
  prompt: z.string(),
  /** e.g. "3–5 sentences, spoken style" */
  lengthGuidance: z.string().optional(),
});

export const SessionStepSchema = z.discriminatedUnion("type", [
  TeachStepSchema,
  ChoiceStepSchema,
  ClozeStepSchema,
  TranslateStepSchema,
  RewriteStepSchema,
  RespondStepSchema,
  FreeProductionStepSchema,
]);

export const SessionDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    topicId: z.string(),
    sessionNumber: z.number().int().min(1),
    kind: z.enum(["diagnostic", "regular", "review", "checkpoint"]),
    title: z.string(),
    subtitle: z.string().optional(),
    estimatedMinutes: z.number().min(1).max(20),
    createdAt: z.string(),
    /** Why this session looks the way it does: shown to future agents, not the learner. */
    authorRationale: z.string(),
    intro: z
      .object({
        heading: z.string(),
        body: z.string(),
        image: ImageReferenceSchema.optional(),
      })
      .optional(),
    steps: z.array(SessionStepSchema).min(1),
  })
  .superRefine((session, context) => {
    const seenStepIds = new Set<string>();
    for (const step of session.steps) {
      if (seenStepIds.has(step.id)) {
        context.addIssue({ code: "custom", message: `duplicate step id: ${step.id}` });
      }
      seenStepIds.add(step.id);
    }
  });

export type SessionDefinition = z.infer<typeof SessionDefinitionSchema>;
export type SessionStep = z.infer<typeof SessionStepSchema>;
export type TeachStep = z.infer<typeof TeachStepSchema>;
export type ChoiceStep = z.infer<typeof ChoiceStepSchema>;
export type ClozeStep = z.infer<typeof ClozeStepSchema>;
export type TranslateStep = z.infer<typeof TranslateStepSchema>;
export type RewriteStep = z.infer<typeof RewriteStepSchema>;
export type RespondStep = z.infer<typeof RespondStepSchema>;
export type FreeProductionStep = z.infer<typeof FreeProductionStepSchema>;
export type FreeResponseStep = ClozeStep | TranslateStep | RewriteStep | RespondStep | FreeProductionStep;
export type ExampleSentence = z.infer<typeof ExampleSentenceSchema>;
export type ImageReference = z.infer<typeof ImageReferenceSchema>;

export const FREE_RESPONSE_STEP_TYPES = ["cloze", "translate", "rewrite", "respond", "free_production"] as const;

export function isFreeResponseStep(step: SessionStep): step is FreeResponseStep {
  return (FREE_RESPONSE_STEP_TYPES as readonly string[]).includes(step.type);
}

export function isGradedStep(step: SessionStep): boolean {
  return step.type !== "teach";
}
