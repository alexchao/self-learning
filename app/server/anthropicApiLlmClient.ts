import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ClaudeRefusalError,
  type LearningLlmClient,
  type StructuredLlmRequest,
  type StructuredLlmResult,
  type TextLlmRequest,
} from "./learningLlmClient.ts";

/** Messages API backend (pay-per-use, needs ANTHROPIC_API_KEY in .env). */
export class AnthropicApiLlmClient implements LearningLlmClient {
  private sharedClient: Anthropic | null = null;

  public async requestStructuredOutput<Output>(request: StructuredLlmRequest<Output>): Promise<StructuredLlmResult<Output>> {
    this.assertCredentialsConfigured();
    const response = await this.client().beta.messages.parse({
      model: request.model,
      max_tokens: 16000,
      ...refusalFallbackRequestFields(),
      thinking: { type: "adaptive" },
      output_config: { effort: request.effort, format: betaZodOutputFormat(request.outputSchema) },
      system: buildCacheableSystemBlocks(request.systemPromptSections),
      messages: [{ role: "user", content: request.userMessage }],
    });
    if (response.stop_reason === "refusal") throw new ClaudeRefusalError(response.stop_details?.explanation);
    if (!response.parsed_output) throw new Error(`Claude returned no parseable output (stop_reason: ${response.stop_reason})`);
    return { output: response.parsed_output as Output, model: response.model };
  }

  public async requestText(request: TextLlmRequest): Promise<string> {
    this.assertCredentialsConfigured();
    const response = await this.client().beta.messages.create({
      model: request.model,
      max_tokens: 16000,
      ...refusalFallbackRequestFields(),
      thinking: { type: "adaptive" },
      output_config: { effort: request.effort },
      system: buildCacheableSystemBlocks(request.systemPromptSections),
      messages: request.conversation,
    });
    if (response.stop_reason === "refusal") throw new ClaudeRefusalError(response.stop_details?.explanation);
    return response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
  }

  public async describeUnavailability(): Promise<string | null> {
    return hasApiCredentials()
      ? null
      : "No Anthropic API key. Add ANTHROPIC_API_KEY to .env, or set \"llmBackend\": \"claude-cli\" in learning.config.json.";
  }

  private client(): Anthropic {
    this.sharedClient ??= new Anthropic();
    return this.sharedClient;
  }

  private assertCredentialsConfigured(): void {
    if (!hasApiCredentials()) {
      throw new Error("No Anthropic API key. Add ANTHROPIC_API_KEY to .env in the project root, then run `npm run learn -- --restart`.");
    }
  }
}

function hasApiCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Server-side refusal fallback (routes a policy decline to an appropriate model automatically). */
function refusalFallbackRequestFields(): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

function buildCacheableSystemBlocks(sections: string[]): Anthropic.Beta.BetaTextBlockParam[] {
  return sections.map((text, index) =>
    index === sections.length - 1 ? { type: "text", text, cache_control: { type: "ephemeral" } } : { type: "text", text },
  );
}
