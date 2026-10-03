import type { z } from "zod";
import type { ModelEffort } from "./learningConfig.ts";

/**
 * The one way the server talks to Claude (grading, tutor, drills). Two backends:
 * - `claude-cli`: headless Claude Code on the learner's subscription (default; no API key needed)
 * - `anthropic-api`: the Messages API with ANTHROPIC_API_KEY
 */
export interface LearningLlmClient {
  requestStructuredOutput<Output>(request: StructuredLlmRequest<Output>): Promise<StructuredLlmResult<Output>>;
  requestText(request: TextLlmRequest): Promise<string>;
  /** Null when calls can be made; otherwise a learner-facing explanation of what's missing. */
  describeUnavailability(): Promise<string | null>;
}

export interface StructuredLlmRequest<Output> {
  /** Joined in order. The last section is the stable, cacheable one (the topic rubric). */
  systemPromptSections: string[];
  userMessage: string;
  outputSchema: z.ZodType<Output>;
  model: string;
  effort: ModelEffort;
}

export interface StructuredLlmResult<Output> {
  output: Output;
  /** The model that actually answered (may differ from the requested one after a fallback). */
  model: string;
}

export interface LlmConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TextLlmRequest {
  systemPromptSections: string[];
  /** Alternating turns ending with the user's latest message. */
  conversation: LlmConversationTurn[];
  model: string;
  effort: ModelEffort;
}

export class ClaudeRefusalError extends Error {
  public constructor(explanation: string | null | undefined) {
    super(`The model declined this request${explanation ? `: ${explanation}` : "."}`);
    this.name = "ClaudeRefusalError";
  }
}
