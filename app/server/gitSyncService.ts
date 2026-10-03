import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { REPOSITORY_ROOT, RUNTIME_DIRECTORY } from "./repositoryPaths.ts";

const runExecFile = promisify(execFile);

/** What the cloud owns and commits (see docs/plans/cloud-deployment.md → Ownership). Everything else is the laptop's. */
const LEARNING_DATA_PATHSPECS = ["topics", "docs/process-feedback.md"];
/** Changes to these mean the running server is out of date and must restart. */
const CODE_PATH_PREFIXES = ["app/", "package.json", "package-lock.json", "learning.config.json", "tsconfig.json"];
const REMOTE_NAME = "origin";
const REMOTE_BRANCH = "main";
export const GIT_SYNC_LOG_PATH = path.join(RUNTIME_DIRECTORY, "git-sync.log");

export interface LearningDataSyncOutcome {
  committed: boolean;
  pushed: boolean;
  error?: string;
}

/**
 * Keeps the cloud's working tree and GitHub in step. Only active when GIT_SYNC=on (the cloud);
 * locally the laptop agent commits by hand, so every method is a no-op.
 *
 * Callers are responsible for not running two git operations at once across processes: the server skips its
 * git work while a prep run (which syncs at its start and end) holds a topic's prep lock.
 */
export class GitSyncService {
  private operationQueue: Promise<unknown> = Promise.resolve();

  public static isEnabled(): boolean {
    return process.env.GIT_SYNC === "on";
  }

  /**
   * Commits learning data (never an in-progress session's results), rebases onto GitHub, and pushes.
   * A rejected push gets one more pull + push; after that it's logged and left for the next sync.
   */
  public syncLearningData(commitMessage: string): Promise<LearningDataSyncOutcome> {
    if (!GitSyncService.isEnabled()) return Promise.resolve({ committed: false, pushed: false });
    return this.serialized(async () => {
      let committed = false;
      try {
        const stagedPaths = await this.stageLearningData();
        if (stagedPaths.length > 0) {
          // No pathspec here: `git commit -- <paths>` would take the working-tree copy and undo the exclusions.
          await this.git(["commit", "-m", commitMessage]);
          committed = true;
          this.log(`committed ${stagedPaths.length} path(s): ${commitMessage}`);
        }
        await this.pullWithRebase();
        try {
          await this.git(["push", REMOTE_NAME, `HEAD:${REMOTE_BRANCH}`]);
        } catch (firstPushError) {
          this.log(`push rejected, pulling and retrying once: ${describeGitError(firstPushError)}`);
          await this.pullWithRebase();
          await this.git(["push", REMOTE_NAME, `HEAD:${REMOTE_BRANCH}`]);
        }
        this.log(`pushed ${await this.currentCommit()}`);
        return { committed, pushed: true };
      } catch (error) {
        const message = describeGitError(error);
        this.log(`sync failed (${commitMessage}): ${message}`);
        return { committed, pushed: false, error: message };
      }
    });
  }

  /** Pulls GitHub's main into the working tree (uncommitted learning data is stashed and restored). */
  public pullLatest(): Promise<{ commitBefore: string; commitAfter: string }> {
    return this.serialized(async () => {
      const commitBefore = await this.currentCommit();
      await this.pullWithRebase();
      const commitAfter = await this.currentCommit();
      if (commitAfter !== commitBefore) this.log(`pulled ${commitBefore.slice(0, 7)} → ${commitAfter.slice(0, 7)}`);
      return { commitBefore, commitAfter };
    });
  }

  public async currentCommit(): Promise<string> {
    return (await this.git(["rev-parse", "HEAD"])).trim();
  }

  /** Code files (not learning data or docs) that differ between two commits. */
  public async listChangedCodePaths(fromCommit: string, toCommit: string): Promise<string[]> {
    if (fromCommit === toCommit) return [];
    const changedPaths = (await this.git(["diff", "--name-only", fromCommit, toCommit])).split("\n").filter(Boolean);
    return changedPaths.filter((changedPath) => CODE_PATH_PREFIXES.some((prefix) => changedPath === prefix || changedPath.startsWith(prefix)));
  }

  public readLogTail(lineCount: number): string[] {
    if (!fs.existsSync(GIT_SYNC_LOG_PATH)) return [];
    return fs.readFileSync(GIT_SYNC_LOG_PATH, "utf8").trimEnd().split("\n").slice(-lineCount);
  }

  private async pullWithRebase(): Promise<void> {
    try {
      await this.git(["pull", "--rebase", "--autostash", REMOTE_NAME, REMOTE_BRANCH]);
    } catch (error) {
      await this.git(["rebase", "--abort"]).catch(() => undefined);
      throw error;
    }
  }

  /** Stages all learning data except results.json files of sessions that aren't completed; returns what's staged. */
  private async stageLearningData(): Promise<string[]> {
    await this.git(["add", "-A", "--", ...LEARNING_DATA_PATHSPECS]);
    const stagedPaths = (await this.git(["diff", "--cached", "--name-only", "-z"])).split("\0").filter(Boolean);
    const unfinishedResultsPaths = stagedPaths.filter(isResultsFileOfUnfinishedSession);
    if (unfinishedResultsPaths.length > 0) await this.git(["reset", "-q", "--", ...unfinishedResultsPaths]);
    return stagedPaths.filter((stagedPath) => !unfinishedResultsPaths.includes(stagedPath));
  }

  private async git(gitArguments: string[]): Promise<string> {
    const { stdout } = await runExecFile("git", gitArguments, { cwd: REPOSITORY_ROOT, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  }

  private serialized<Result>(operation: () => Promise<Result>): Promise<Result> {
    const queuedOperation = this.operationQueue.then(operation, operation);
    this.operationQueue = queuedOperation.catch(() => undefined);
    return queuedOperation;
  }

  private log(message: string): void {
    const line = `${new Date().toISOString()} [git-sync pid ${process.pid}] ${message}`;
    console.log(line);
    fs.mkdirSync(RUNTIME_DIRECTORY, { recursive: true });
    fs.appendFileSync(GIT_SYNC_LOG_PATH, `${line}\n`);
  }
}

function isResultsFileOfUnfinishedSession(repositoryRelativePath: string): boolean {
  if (path.basename(repositoryRelativePath) !== "results.json") return false;
  const absolutePath = path.join(REPOSITORY_ROOT, repositoryRelativePath);
  if (!fs.existsSync(absolutePath)) return false; // a deletion is safe to commit
  try {
    return !(JSON.parse(fs.readFileSync(absolutePath, "utf8")) as { completedAt?: string }).completedAt;
  } catch {
    return true; // mid-write or corrupt: leave it for the next sync
  }
}

function describeGitError(error: unknown): string {
  const gitError = error as { stderr?: string; message?: string };
  return (gitError.stderr?.trim() || gitError.message || String(error)).split("\n").slice(-3).join(" | ");
}
