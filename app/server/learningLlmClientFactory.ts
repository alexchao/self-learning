import { AnthropicApiLlmClient } from "./anthropicApiLlmClient.ts";
import { ClaudeCliLlmClient } from "./claudeCliLlmClient.ts";
import type { LearningConfig } from "./learningConfig.ts";
import type { LearningLlmClient } from "./learningLlmClient.ts";

export function createLearningLlmClient(config: LearningConfig): LearningLlmClient {
  return config.llmBackend === "anthropic-api" ? new AnthropicApiLlmClient() : new ClaudeCliLlmClient(config.claudeExecutable);
}
