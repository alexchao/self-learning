import { spawnSync } from "node:child_process";
import { REPOSITORY_ROOT } from "../server/repositoryPaths.ts";
import type { TopicStatus } from "../server/topicStatusReporter.ts";
import { printTopicStatuses } from "./topicStatusPrinter.ts";

/** The server's port inside the Fly machine (fly.toml → internal_port). */
const CLOUD_SERVER_PORT = 8080;

/**
 * Calls the cloud server's loopback-only admin endpoints (adminApiRoutes.ts) from the laptop by running curl inside
 * the Fly machine over `fly ssh console`. Uses the laptop's `fly` login; the app comes from fly.toml in the repo root.
 * The JSON body travels base64-encoded so no quoting can break it.
 */
export function callCloudAdminEndpoint(method: "GET" | "POST", endpointPath: string, body?: unknown): unknown {
  const url = `http://127.0.0.1:${CLOUD_SERVER_PORT}/api/admin/${endpointPath}`;
  const curlCommand =
    body === undefined
      ? `curl -sS -X ${method} ${url}`
      : `echo ${Buffer.from(JSON.stringify(body)).toString("base64")} | base64 -d | curl -sS -X ${method} -H content-type:application/json --data-binary @- ${url}`;
  const result = spawnSync("fly", ["ssh", "console", "--quiet", "-C", `sh -c '${curlCommand}'`], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`fly ssh console failed (exit ${result.status}): ${(result.stderr || result.stdout).trim().split("\n").slice(-5).join("\n")}`);
  }
  // fly may print connection chatter before the response; the JSON starts at the first "{".
  const jsonStart = result.stdout.indexOf("{");
  if (jsonStart < 0) throw new Error(`Unexpected response from the cloud server: ${result.stdout.trim().slice(0, 500)}`);
  return JSON.parse(result.stdout.slice(jsonStart));
}

interface CloudStatusResponse {
  commit: string;
  runningCodeCommit: string | null;
  activeRequestCount: number;
  lastUpdateCheck: { checkedAt: string; trigger: string; outcome: unknown } | null;
  topics: TopicStatus[];
  latestPreparationLogs: Record<string, { fileName: string; tail: string[] } | null>;
  gitSyncLogTail: string[];
}

export function printCloudStatus(options: { showPreparationLogs?: boolean } = {}): void {
  const status = callCloudAdminEndpoint("GET", "status") as CloudStatusResponse;
  console.log(`Cloud: checked out ${status.commit.slice(0, 7)}, running code from ${status.runningCodeCommit?.slice(0, 7) ?? "?"}`);
  if (status.lastUpdateCheck) {
    console.log(`Last update check: ${status.lastUpdateCheck.checkedAt} (${status.lastUpdateCheck.trigger}) → ${JSON.stringify(status.lastUpdateCheck.outcome)}`);
  }
  printTopicStatuses(status.topics);
  console.log("Git sync (latest):");
  for (const line of status.gitSyncLogTail.slice(-8)) console.log(`  ${line}`);
  for (const [topicId, log] of Object.entries(status.latestPreparationLogs)) {
    if (!log) continue;
    const lines = options.showPreparationLogs ? log.tail : log.tail.slice(-3);
    console.log(`\nLatest prep log for ${topicId} (${log.fileName}):`);
    for (const line of lines) console.log(`  ${line}`);
  }
}
