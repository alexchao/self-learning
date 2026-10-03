import type { MiddlewareHandler } from "hono";
import { GitSyncService } from "./gitSyncService.ts";
import { NextSessionPreparer } from "./nextSessionPreparer.ts";
import type { TopicRepository } from "./topicRepository.ts";

/** deploy/server-loop.sh treats this exit code as "restart me" (and reinstalls/rebuilds first if needed). */
export const RESTART_REQUESTED_EXIT_CODE = 75;
const UPDATE_POLL_INTERVAL_MS = 2 * 60 * 1000;
const MAXIMUM_WAIT_FOR_IDLE_BEFORE_RESTART_MS = 2 * 60 * 1000;

export type CloudUpdateOutcome =
  | { kind: "disabled" }
  | { kind: "deferred"; reason: string }
  | { kind: "up_to_date"; commit: string }
  | { kind: "pulled_no_restart"; commit: string }
  | { kind: "restarting"; commit: string; changedCodePaths: string[] }
  | { kind: "failed"; error: string };

/**
 * Keeps the cloud server on the latest `main`: polls GitHub, pulls, and restarts itself when code changed.
 * Restarts wait for in-flight requests (e.g. a grading call) and never happen while next-session prep is running.
 */
export class CloudUpdateService {
  private runningCodeCommit: string | null = null;
  private activeRequestCount = 0;
  private isUpdating = false;
  private lastOutcome: { checkedAt: string; trigger: string; outcome: CloudUpdateOutcome } | null = null;
  private readonly preparer = new NextSessionPreparer();

  public constructor(
    private readonly repository: TopicRepository,
    private readonly gitSync: GitSyncService,
  ) {}

  public async startPolling(): Promise<void> {
    if (!GitSyncService.isEnabled()) return;
    this.runningCodeCommit = await this.gitSync.currentCommit();
    setInterval(() => void this.checkForUpdates("poll"), UPDATE_POLL_INTERVAL_MS).unref();
  }

  /** Counts in-flight requests so a restart can wait for them. */
  public trackActiveRequests(): MiddlewareHandler {
    return async (_context, next) => {
      this.activeRequestCount += 1;
      try {
        await next();
      } finally {
        this.activeRequestCount -= 1;
      }
    };
  }

  public describeState(): { runningCodeCommit: string | null; activeRequestCount: number; lastUpdateCheck: CloudUpdateService["lastOutcome"] } {
    return { runningCodeCommit: this.runningCodeCommit, activeRequestCount: this.activeRequestCount, lastUpdateCheck: this.lastOutcome };
  }

  public async checkForUpdates(trigger: string): Promise<CloudUpdateOutcome> {
    const outcome = await this.runUpdateCheck();
    if (trigger !== "poll" || outcome.kind !== "up_to_date") {
      console.log(`[cloud-update] ${trigger}: ${JSON.stringify(outcome)}`);
    }
    this.lastOutcome = { checkedAt: new Date().toISOString(), trigger, outcome };
    return outcome;
  }

  /** Topic ids whose next-session prep is running right now (it does its own git sync, so the server stays out). */
  public listTopicsWithRunningPreparation(): string[] {
    return this.repository.listTopicIds().filter((topicId) => this.preparer.readActivePreparationLock(topicId) !== null);
  }

  private async runUpdateCheck(): Promise<CloudUpdateOutcome> {
    if (!GitSyncService.isEnabled() || !this.runningCodeCommit) return { kind: "disabled" };
    if (this.isUpdating) return { kind: "deferred", reason: "an update is already in progress" };
    const preparingTopics = this.listTopicsWithRunningPreparation();
    if (preparingTopics.length > 0) return { kind: "deferred", reason: `next-session prep is running (${preparingTopics.join(", ")}); the next poll retries` };

    this.isUpdating = true;
    try {
      const { commitBefore, commitAfter } = await this.gitSync.pullLatest();
      // Compare against the commit this process started from: a prep run may already have pulled newer code.
      const changedCodePaths = await this.gitSync.listChangedCodePaths(this.runningCodeCommit, commitAfter);
      if (changedCodePaths.length === 0) {
        this.isUpdating = false;
        return commitAfter === commitBefore ? { kind: "up_to_date", commit: commitAfter } : { kind: "pulled_no_restart", commit: commitAfter };
      }
      void this.restartWhenIdle();
      return { kind: "restarting", commit: commitAfter, changedCodePaths };
    } catch (error) {
      this.isUpdating = false;
      return { kind: "failed", error: (error as Error).message.split("\n").slice(-3).join(" | ") };
    }
  }

  /** Exits once nothing is in flight; the loop in deploy/server-loop.sh reinstalls/rebuilds as needed and starts the new code. */
  private async restartWhenIdle(): Promise<void> {
    const waitStartedAtMs = Date.now();
    // Let the response that triggered this (e.g. POST /api/admin/update) go out first.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    while (this.activeRequestCount > 0 && Date.now() - waitStartedAtMs < MAXIMUM_WAIT_FOR_IDLE_BEFORE_RESTART_MS) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log("[cloud-update] restarting to run the new code");
    process.exit(RESTART_REQUESTED_EXIT_CODE);
  }
}
