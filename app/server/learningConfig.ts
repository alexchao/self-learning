import fs from "node:fs";
import { z } from "zod";
import { CONFIG_FILE_PATH, ENV_FILE_PATH } from "./repositoryPaths.ts";

const EffortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);
export type ModelEffort = z.infer<typeof EffortSchema>;

const LearningConfigSchema = z.object({
  port: z.number().int(),
  /** "claude-cli": Claude Code on the learner's subscription. "anthropic-api": pay-per-use with ANTHROPIC_API_KEY. */
  llmBackend: z.enum(["claude-cli", "anthropic-api"]).default("claude-cli"),
  claudeExecutable: z.string().default("claude"),
  grading: z.object({ model: z.string(), effort: EffortSchema }),
  tutor: z.object({ model: z.string(), effort: EffortSchema }),
  practiceDrills: z.object({
    defaultCountPerStep: z.number().int().min(0).max(3),
    skipWhenFirstAttemptScoreAtLeast: z.number().int().min(0).max(5),
  }),
  autoPrepareNextSession: z.boolean(),
});

export type LearningConfig = z.infer<typeof LearningConfigSchema>;

export function loadLearningConfig(): LearningConfig {
  return LearningConfigSchema.parse(JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8")));
}

/** Loads .env into process.env (without anyone reading it into a transcript). */
export function loadEnvironmentFileIfPresent(): void {
  if (fs.existsSync(ENV_FILE_PATH)) {
    process.loadEnvFile(ENV_FILE_PATH);
  }
}
