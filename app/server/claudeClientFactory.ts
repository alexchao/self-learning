import Anthropic from "@anthropic-ai/sdk";

let sharedClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!sharedClient) {
    sharedClient = new Anthropic();
  }
  return sharedClient;
}

/** Server-side refusal fallback (routes a policy decline to an appropriate model automatically). */
export function refusalFallbackRequestFields(): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

export class ClaudeRefusalError extends Error {
  public constructor(explanation: string | null | undefined) {
    super(`The model declined this request${explanation ? `: ${explanation}` : "."}`);
    this.name = "ClaudeRefusalError";
  }
}
