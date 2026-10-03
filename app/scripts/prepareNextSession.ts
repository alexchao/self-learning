import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { ClaudeStreamEventFormatter } from "../server/claudeStreamEventFormatter.ts";
import { GitSyncService } from "../server/gitSyncService.ts";
import { NEXT_SESSION_PREPARATION_ALLOWED_TOOLS, buildNextSessionPreparationPrompt } from "../server/nextSessionPreparationPrompt.ts";
import { preparationLogsDirectory, REPOSITORY_ROOT } from "../server/repositoryPaths.ts";

/**
 * `npm run prepare-session -- --topic <id> --after <completed session dir> [--log <path>]`
 *
 * Runs headless Claude Code to prepare the next session and writes a live, human-readable log.
 * The server launches this detached after a session completes; it can also be run by hand.
 * Holds topics/<topic>/.prep/lock.json for its lifetime.
 * In the cloud (GIT_SYNC=on) it also records the finished session to GitHub before starting (and pulls the laptop's
 * latest docs), then pushes the new session when done. The server stays out of git while this lock is held.
 */

const argumentsList = process.argv.slice(2);
const readFlagValue = (flag: string): string | undefined => {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};

const topicId = readFlagValue("--topic");
const completedSessionDirName = readFlagValue("--after");
if (!topicId || !completedSessionDirName) {
  console.error("Usage: npm run prepare-session -- --topic <id> --after <completed session dir>");
  process.exit(2);
}

const logsDirectory = preparationLogsDirectory(topicId);
fs.mkdirSync(logsDirectory, { recursive: true });
const logPath =
  readFlagValue("--log") ?? path.join(logsDirectory, `${new Date().toISOString().replace(/[:.]/g, "-")}-after-${completedSessionDirName}.log`);
const lockPath = path.join(logsDirectory, "lock.json");
const formatter = new ClaudeStreamEventFormatter();
const appendToLog = (line: string) => {
  fs.appendFileSync(logPath, `${line}\n`);
  if (process.stdout.isTTY) console.log(line);
};

fs.writeFileSync(
  lockPath,
  JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), afterSessionDirName: completedSessionDirName, logPath }, null, 2),
);
const releaseLock = () => {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { pid: number };
    if (lock.pid === process.pid) fs.rmSync(lockPath, { force: true });
  } catch {
    // lock already gone
  }
};

appendToLog(formatter.stamp(`Preparing the session after ${completedSessionDirName} (topic ${topicId})`));

const gitSync = new GitSyncService();
const syncLearningDataAndLog = async (commitMessage: string): Promise<void> => {
  if (!GitSyncService.isEnabled()) return;
  const outcome = await gitSync.syncLearningData(commitMessage);
  appendToLog(formatter.stamp(`git sync (${commitMessage}): ${outcome.error ? `FAILED: ${outcome.error}` : `committed=${outcome.committed} pushed=${outcome.pushed}`}`));
};
await syncLearningDataAndLog(`Record ${topicId} learning data (before preparing the session after ${completedSessionDirName})`);

// Strip API credentials so the CLI uses the learner's Claude Code login, not the app's API key.
// The site passphrase isn't needed for prep either.
const childEnvironment = { ...process.env };
delete childEnvironment.ANTHROPIC_API_KEY;
delete childEnvironment.ANTHROPIC_AUTH_TOKEN;
delete childEnvironment.ACCESS_PASSPHRASE;

const claudeProcess = spawn(
  "claude",
  [
    "-p",
    buildNextSessionPreparationPrompt(topicId, completedSessionDirName),
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    ...NEXT_SESSION_PREPARATION_ALLOWED_TOOLS,
  ],
  { cwd: REPOSITORY_ROOT, env: childEnvironment, stdio: ["ignore", "pipe", "pipe"] },
);

readline.createInterface({ input: claudeProcess.stdout }).on("line", (line) => {
  const formattedLine = formatter.formatLine(line);
  if (formattedLine) appendToLog(formattedLine);
});
readline.createInterface({ input: claudeProcess.stderr }).on("line", (line) => {
  if (line.trim()) appendToLog(formatter.stamp(`(stderr) ${line.slice(0, 300)}`));
});

claudeProcess.on("error", (error) => {
  appendToLog(formatter.stamp(`Failed to start claude: ${error.message}`));
  releaseLock();
  process.exit(1);
});
claudeProcess.on("close", (exitCode) => {
  appendToLog(formatter.stamp(`claude exited with code ${exitCode}`));
  // Push whatever prep wrote, even after a failed run, so the cloud and GitHub don't drift.
  void syncLearningDataAndLog(`Prepare the ${topicId} session after ${completedSessionDirName}`).finally(() => {
    releaseLock();
    process.exit(exitCode ?? 1);
  });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    appendToLog(formatter.stamp(`Received ${signal}; stopping`));
    claudeProcess.kill(signal);
  });
}
