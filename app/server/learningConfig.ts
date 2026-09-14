import fs from "node:fs";
import { z } from "zod";
import { CONFIG_FILE_PATH, ENV_FILE_PATH } from "./repositoryPaths.ts";

const EffortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);

const LearningConfigSchema = z.object({
  port: z.number().int(),
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

export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function assertAnthropicCredentialsConfigured(): void {
  if (!hasAnthropicCredentials()) {
    throw new Error("No Anthropic API key. Add ANTHROPIC_API_KEY to .env in the project root, then run `npm run learn -- --restart`.");
  }
}
