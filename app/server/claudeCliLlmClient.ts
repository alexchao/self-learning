import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { ModelEffort } from "./learningConfig.ts";
import {
  ClaudeRefusalError,
  type LearningLlmClient,
  type LlmConversationTurn,
  type StructuredLlmRequest,
  type StructuredLlmResult,
  type TextLlmRequest,
} from "./learningLlmClient.ts";

const CLAUDE_CLI_TIMEOUT_MS = 180_000;
/** Each `claude -p` process uses ~250 MB; keeps a small cloud machine from running out of memory. */
const MAXIMUM_CONCURRENT_CLAUDE_PROCESSES = 3;
const CREDENTIAL_CHECK_CACHE_MS = 60_000;

/** The fields of `claude -p --output-format json` that we use. */
const ClaudeCliResultSchema = z.object({
  is_error: z.boolean(),
  subtype: z.string(),
  stop_reason: z.string().nullish(),
  result: z.string().nullish(),
  structured_output: z.unknown().optional(),
  modelUsage: z.record(z.string(), z.unknown()).optional(),
});
type ClaudeCliResult = z.infer<typeof ClaudeCliResultSchema>;

interface ClaudeCliInvocation {
  systemPrompt: string;
  prompt: string;
  model: string;
  effort: ModelEffort;
  jsonSchema?: Record<string, unknown>;
}

/**
 * Headless Claude Code (`claude -p`) on the learner's subscription: the local login, or CLAUDE_CODE_OAUTH_TOKEN
 * from `claude setup-token` in the cloud. Each call is isolated: no tools, no settings/hooks/MCP, no CLAUDE.md
 * (it runs in an empty directory), no saved session.
 */
export class ClaudeCliLlmClient implements LearningLlmClient {
  private runningProcessCount = 0;
  private readonly queuedProcessStarters: (() => void)[] = [];
  private cachedCredentialCheck: { checkedAtMs: number; unavailabilityReason: string | null } | null = null;
  private readonly isolatedWorkingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "self-learning-llm-"));

  public constructor(private readonly claudeExecutable: string) {}

  public async requestStructuredOutput<Output>(request: StructuredLlmRequest<Output>): Promise<StructuredLlmResult<Output>> {
    const { $schema: _ignoredSchemaDialect, ...jsonSchema } = z.toJSONSchema(request.outputSchema) as Record<string, unknown>;
    const result = await this.runClaude({
      systemPrompt: request.systemPromptSections.join("\n\n"),
      prompt: request.userMessage,
      model: request.model,
      effort: request.effort,
      jsonSchema,
    });
    if (result.structured_output === undefined) {
      throw new Error(`Claude returned no structured output (stop_reason: ${result.stop_reason ?? "unknown"})`);
    }
    return { output: request.outputSchema.parse(result.structured_output), model: answeringModel(result) ?? request.model };
  }

  public async requestText(request: TextLlmRequest): Promise<string> {
    const result = await this.runClaude({
      systemPrompt: request.systemPromptSections.join("\n\n"),
      prompt: formatConversationAsSinglePrompt(request.conversation),
      model: request.model,
      effort: request.effort,
    });
    return (result.result ?? "").trim();
  }

  public async describeUnavailability(): Promise<string | null> {
    if (this.cachedCredentialCheck && Date.now() - this.cachedCredentialCheck.checkedAtMs < CREDENTIAL_CHECK_CACHE_MS) {
      return this.cachedCredentialCheck.unavailabilityReason;
    }
    const unavailabilityReason = await this.checkClaudeLogin();
    this.cachedCredentialCheck = { checkedAtMs: Date.now(), unavailabilityReason };
    return unavailabilityReason;
  }

  private async checkClaudeLogin(): Promise<string | null> {
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return null;
    try {
      const { stdout } = await this.spawnAndCollect(["auth", "status"], "", 20_000);
      const status = JSON.parse(stdout) as { loggedIn?: boolean };
      return status.loggedIn ? null : "Claude Code isn't logged in. Run `claude login` (or set CLAUDE_CODE_OAUTH_TOKEN).";
    } catch (error) {
      return `Couldn't run the Claude Code CLI (${(error as Error).message}). Install it, or set "llmBackend": "anthropic-api".`;
    }
  }

  private async runClaude(invocation: ClaudeCliInvocation): Promise<ClaudeCliResult> {
    const commandArguments = [
      "-p",
      "--output-format", "json",
      "--model", invocation.model,
      "--effort", invocation.effort,
      "--system-prompt", invocation.systemPrompt,
      "--tools", "",
      "--setting-sources", "",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--disable-slash-commands",
    ];
    if (invocation.jsonSchema) commandArguments.push("--json-schema", JSON.stringify(invocation.jsonSchema));

    await this.acquireProcessSlot();
    let collected: { stdout: string; stderr: string; exitCode: number | null };
    try {
      collected = await this.spawnAndCollect(commandArguments, invocation.prompt, CLAUDE_CLI_TIMEOUT_MS);
    } finally {
      this.releaseProcessSlot();
    }

    let result: ClaudeCliResult;
    try {
      result = ClaudeCliResultSchema.parse(JSON.parse(collected.stdout));
    } catch {
      throw new Error(`Claude Code failed (exit ${collected.exitCode}): ${lastLines(collected.stderr || collected.stdout)}`);
    }
    if (result.stop_reason === "refusal") throw new ClaudeRefusalError(result.result);
    if (result.is_error) throw new Error(`Claude Code returned an error (${result.subtype}): ${result.result ?? lastLines(collected.stderr)}`);
    return result;
  }

  private spawnAndCollect(commandArguments: string[], standardInput: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.claudeExecutable, commandArguments, {
        cwd: this.isolatedWorkingDirectory,
        env: environmentWithoutApiKeys(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Claude Code timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (exitCode) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode });
      });
      // If the CLI exits before reading stdin, the write fails with EPIPE; without a handler that crashes the server.
      child.stdin.on("error", () => {});
      child.stdin.end(standardInput);
    });
  }

  private acquireProcessSlot(): Promise<void> {
    if (this.runningProcessCount < MAXIMUM_CONCURRENT_CLAUDE_PROCESSES) {
      this.runningProcessCount += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queuedProcessStarters.push(resolve));
  }

  private releaseProcessSlot(): void {
    const nextStarter = this.queuedProcessStarters.shift();
    if (nextStarter) nextStarter();
    else this.runningProcessCount -= 1;
  }
}

/** Without the API keys, the CLI uses the subscription instead of billing the key. The site passphrase isn't its business. */
function environmentWithoutApiKeys(): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _apiKey, ANTHROPIC_AUTH_TOKEN: _authToken, ACCESS_PASSPHRASE: _sitePassphrase, ...environment } = process.env;
  return environment;
}

function answeringModel(result: ClaudeCliResult): string | undefined {
  return Object.keys(result.modelUsage ?? {})[0];
}

/** `claude -p` takes one prompt, so earlier turns of a follow-up conversation are replayed as a transcript. */
function formatConversationAsSinglePrompt(conversation: LlmConversationTurn[]): string {
  const latestTurn = conversation[conversation.length - 1];
  if (!latestTurn) throw new Error("Conversation is empty");
  if (conversation.length === 1) return latestTurn.content;
  const earlierTurns = conversation
    .slice(0, -1)
    .map((turn) => (turn.role === "user" ? `<learner>\n${turn.content}\n</learner>` : `<tutor>\n${turn.content}\n</tutor>`));
  return [
    "<conversation_so_far>",
    ...earlierTurns,
    "</conversation_so_far>",
    "",
    "The learner's next message (reply to this as the tutor):",
    latestTurn.content,
  ].join("\n");
}

function lastLines(text: string): string {
  return text.trim().split("\n").slice(-5).join("\n") || "(no output)";
}
