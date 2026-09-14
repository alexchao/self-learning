import path from "node:path";
import { REPOSITORY_ROOT } from "./repositoryPaths.ts";

/**
 * Turns `claude -p --output-format stream-json --verbose` events into short, human-readable log lines,
 * e.g. "16:49:39  Read      docs/SYSTEM.md". Returns null for events not worth logging.
 */
export class ClaudeStreamEventFormatter {
  private readonly toolNamesByToolUseId = new Map<string, string>();

  public formatLine(rawLine: string): string | null {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) return null;
    let event: StreamEvent;
    try {
      event = JSON.parse(trimmedLine) as StreamEvent;
    } catch {
      return this.stamp(`(output) ${trimmedLine.slice(0, 300)}`);
    }

    if (event.type === "system" && event.subtype === "init") {
      return this.stamp(`Started Claude Code (${event.model ?? "default model"})`);
    }
    if (event.type === "assistant") {
      const lines: string[] = [];
      const content = event.message?.content;
      for (const block of Array.isArray(content) ? content : []) {
        if (block.type === "tool_use" && block.name) {
          if (block.id) this.toolNamesByToolUseId.set(block.id, block.name);
          lines.push(this.stamp(`${block.name.padEnd(9)} ${this.describeToolInput(block.input ?? {})}`));
        } else if (block.type === "text" && block.text?.trim()) {
          lines.push(this.stamp(`Note      ${block.text.trim().split("\n")[0]!.slice(0, 240)}`));
        }
      }
      return lines.length > 0 ? lines.join("\n") : null;
    }
    if (event.type === "user") {
      const content = event.message?.content;
      if (!Array.isArray(content)) return null;
      const failures = content.filter((block) => block.type === "tool_result" && block.is_error);
      return failures.length > 0
        ? failures
            .map((block) => this.stamp(`  ✗ ${this.toolNamesByToolUseId.get(block.tool_use_id ?? "") ?? "tool"} failed: ${stringifyToolResult(block.content).slice(0, 200)}`))
            .join("\n")
        : null;
    }
    if (event.type === "result") {
      const minutes = event.duration_ms ? `${(event.duration_ms / 60000).toFixed(1)} min` : "?";
      const cost = event.total_cost_usd !== undefined ? `, $${event.total_cost_usd.toFixed(2)}` : "";
      const header = this.stamp(`Finished (${event.subtype ?? "done"}) in ${minutes}, ${event.num_turns ?? "?"} turns${cost}`);
      return event.result ? `${header}\n\n${event.result.trim()}\n` : header;
    }
    return null;
  }

  public stamp(message: string): string {
    return `${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${message}`;
  }

  private describeToolInput(input: Record<string, unknown>): string {
    const filePath = input.file_path ?? input.path;
    if (typeof filePath === "string") return path.relative(REPOSITORY_ROOT, filePath) || filePath;
    if (typeof input.command === "string") return input.command.replace(/\s+/g, " ").slice(0, 160);
    if (typeof input.pattern === "string") return input.pattern;
    return JSON.stringify(input).slice(0, 160);
  }
}

interface StreamContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  tool_use_id?: string;
  is_error?: boolean;
  content?: unknown;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  model?: string;
  message?: { content?: StreamContentBlock[] | string };
  result?: string;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : "")).join(" ");
  return JSON.stringify(content);
}
