import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { preparationLogsDirectory, REPOSITORY_ROOT } from "./repositoryPaths.ts";

export interface PreparationLock {
  pid: number;
  startedAt: string;
  afterSessionDirName: string;
  logPath: string;
}

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(npm run validate:*)", "Bash(npm run status:*)", "Bash(ls:*)", "Bash(mkdir:*)"];

/**
 * Spawns a headless Claude Code run that prepares the next session for a topic.
 * Runs detached so it survives the server; a lock file prevents concurrent runs per topic.
 */
export class NextSessionPreparer {
  public readActivePreparationLock(topicId: string): PreparationLock | null {
    const lockPath = this.lockFilePath(topicId);
    if (!fs.existsSync(lockPath)) return null;
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as PreparationLock;
    if (isProcessAlive(lock.pid)) return lock;
    fs.rmSync(lockPath, { force: true });
    return null;
  }

  public startPreparation(topicId: string, completedSessionDirName: string): { logPath: string } | { skippedReason: string } {
    const activeLock = this.readActivePreparationLock(topicId);
    if (activeLock) return { skippedReason: `preparation already running (pid ${activeLock.pid})` };

    const logsDirectory = preparationLogsDirectory(topicId);
    fs.mkdirSync(logsDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = path.join(logsDirectory, `${timestamp}-after-${completedSessionDirName}.log`);
    const logFileDescriptor = fs.openSync(logPath, "a");

    const prompt = [
      `Prepare the next learning session for topic "${topicId}". The learner just completed "${completedSessionDirName}".`,
      "Follow the 'Preparing the next session' checklist in docs/SESSION-AUTHORING.md exactly (read docs/SYSTEM.md first).",
      "This is a headless background run: do not launch the server or browser, and do not ask questions. Make reasonable decisions and record them in authorRationale.",
      "Finish by running `npm run validate` on the new session and fixing any errors.",
    ].join("\n");

    // Strip API credentials so the CLI uses the learner's Claude Code login, not the app's API key.
    const childEnvironment = { ...process.env };
    delete childEnvironment.ANTHROPIC_API_KEY;
    delete childEnvironment.ANTHROPIC_AUTH_TOKEN;

    const child = spawn("claude", ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", ...ALLOWED_TOOLS], {
      cwd: REPOSITORY_ROOT,
      env: childEnvironment,
      detached: true,
      stdio: ["ignore", logFileDescriptor, logFileDescriptor],
    });
    child.on("error", (error) => fs.appendFileSync(logPath, `\n[preparer] failed to start claude: ${error.message}\n`));
    child.on("exit", () => fs.rmSync(this.lockFilePath(topicId), { force: true }));
    child.unref();
    fs.closeSync(logFileDescriptor);

    if (child.pid) {
      const lock: PreparationLock = { pid: child.pid, startedAt: new Date().toISOString(), afterSessionDirName: completedSessionDirName, logPath };
      fs.writeFileSync(this.lockFilePath(topicId), JSON.stringify(lock, null, 2));
    }
    return { logPath: path.relative(REPOSITORY_ROOT, logPath) };
  }

  private lockFilePath(topicId: string): string {
    return path.join(preparationLogsDirectory(topicId), "lock.json");
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
