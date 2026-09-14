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

/**
 * Launches app/scripts/prepareNextSession.ts detached (so it survives server restarts).
 * That script runs headless Claude Code, writes a live readable log, and holds the per-topic lock.
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

  public readLastLogLine(logPath: string): string | null {
    if (!fs.existsSync(logPath)) return null;
    const lines = fs.readFileSync(logPath, "utf8").trimEnd().split("\n");
    return lines[lines.length - 1] ?? null;
  }

  public startPreparation(topicId: string, completedSessionDirName: string): { logPath: string } | { skippedReason: string } {
    const activeLock = this.readActivePreparationLock(topicId);
    if (activeLock) return { skippedReason: `preparation already running (pid ${activeLock.pid})` };

    const logsDirectory = preparationLogsDirectory(topicId);
    fs.mkdirSync(logsDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = path.join(logsDirectory, `${timestamp}-after-${completedSessionDirName}.log`);

    const preparationProcess = spawn(
      path.join(REPOSITORY_ROOT, "node_modules", ".bin", "tsx"),
      ["app/scripts/prepareNextSession.ts", "--topic", topicId, "--after", completedSessionDirName, "--log", logPath],
      { cwd: REPOSITORY_ROOT, detached: true, stdio: "ignore" },
    );
    preparationProcess.on("error", (error) => fs.appendFileSync(logPath, `[preparer] failed to launch: ${error.message}\n`));
    preparationProcess.unref();

    // Write the lock immediately so status reflects the run before the script starts; the script rewrites it with the same pid.
    if (preparationProcess.pid) {
      const lock: PreparationLock = { pid: preparationProcess.pid, startedAt: new Date().toISOString(), afterSessionDirName: completedSessionDirName, logPath };
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
