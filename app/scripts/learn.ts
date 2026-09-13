import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadLearningConfig } from "../server/learningConfig.ts";
import { REPOSITORY_ROOT, RUNTIME_DIRECTORY, SHARED_SOURCE_DIRECTORY, WEB_DIST_DIRECTORY, WEB_SOURCE_DIRECTORY } from "../server/repositoryPaths.ts";
import { TopicRepository } from "../server/topicRepository.ts";
import { TopicStatusReporter } from "../server/topicStatusReporter.ts";

/**
 * `npm run learn [-- --topic <id>] [--restart] [--no-open]`
 * Builds the web app if stale, ensures the server is running (detached), and opens the next session.
 */

const argumentsList = process.argv.slice(2);
const readFlagValue = (flag: string): string | undefined => {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};

const config = loadLearningConfig();
const baseUrl = `http://localhost:${config.port}`;
const serverPidFilePath = path.join(RUNTIME_DIRECTORY, "server.pid");

function newestModificationTime(directoryPath: string, ignoredDirectoryNames: string[]): number {
  let newest = 0;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (ignoredDirectoryNames.includes(entry.name)) continue;
    const entryPath = path.join(directoryPath, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestModificationTime(entryPath, ignoredDirectoryNames) : fs.statSync(entryPath).mtimeMs);
  }
  return newest;
}

function buildWebAppIfStale(): void {
  const builtIndexPath = path.join(WEB_DIST_DIRECTORY, "index.html");
  const builtAt = fs.existsSync(builtIndexPath) ? fs.statSync(builtIndexPath).mtimeMs : 0;
  const sourceModifiedAt = Math.max(newestModificationTime(WEB_SOURCE_DIRECTORY, ["dist", "node_modules"]), newestModificationTime(SHARED_SOURCE_DIRECTORY, []));
  if (sourceModifiedAt <= builtAt) return;
  console.log("Building web app…");
  execFileSync("npm", ["run", "build:web", "--silent"], { cwd: REPOSITORY_ROOT, stdio: "inherit" });
}

async function isServerHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

function stopServerIfRunning(): void {
  if (!fs.existsSync(serverPidFilePath)) return;
  const pid = Number(fs.readFileSync(serverPidFilePath, "utf8"));
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  fs.rmSync(serverPidFilePath, { force: true });
}

async function startServerDetached(): Promise<void> {
  fs.mkdirSync(RUNTIME_DIRECTORY, { recursive: true });
  const logFileDescriptor = fs.openSync(path.join(RUNTIME_DIRECTORY, "server.log"), "a");
  const serverProcess = spawn(path.join(REPOSITORY_ROOT, "node_modules", ".bin", "tsx"), ["app/server/main.ts"], {
    cwd: REPOSITORY_ROOT,
    detached: true,
    stdio: ["ignore", logFileDescriptor, logFileDescriptor],
  });
  serverProcess.unref();
  fs.closeSync(logFileDescriptor);
  fs.writeFileSync(serverPidFilePath, String(serverProcess.pid));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become healthy; see .runtime/server.log");
}

function resolveSessionUrl(): string {
  const reporter = new TopicStatusReporter(new TopicRepository());
  const requestedTopicId = readFlagValue("--topic");
  const statuses = reporter.reportAllTopics().filter((status) => (requestedTopicId ? status.topicId === requestedTopicId : status.status === "active"));
  const topicWithNextSession = statuses.find((status) => status.nextSession);
  if (!topicWithNextSession?.nextSession) return baseUrl;
  return `${baseUrl}/topics/${topicWithNextSession.topicId}/sessions/${topicWithNextSession.nextSession.dirName}`;
}

function isServerCodeNewerThanRunningServer(): boolean {
  if (!fs.existsSync(serverPidFilePath)) return false;
  const serverStartedAt = fs.statSync(serverPidFilePath).mtimeMs;
  const serverSourceModifiedAt = Math.max(newestModificationTime(path.join(REPOSITORY_ROOT, "app", "server"), []), newestModificationTime(SHARED_SOURCE_DIRECTORY, []), fs.statSync(path.join(REPOSITORY_ROOT, "learning.config.json")).mtimeMs);
  return serverSourceModifiedAt > serverStartedAt;
}

if (argumentsList.includes("--restart") || isServerCodeNewerThanRunningServer()) {
  stopServerIfRunning();
  await new Promise((resolve) => setTimeout(resolve, 500));
}
buildWebAppIfStale();
if (!(await isServerHealthy())) {
  console.log("Starting server…");
  await startServerDetached();
}
const sessionUrl = resolveSessionUrl();
console.log(`Ready: ${sessionUrl}`);
if (!argumentsList.includes("--no-open")) execFileSync("open", [sessionUrl]);
