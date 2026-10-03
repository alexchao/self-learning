import type { LearningItem } from "../../shared/learningItemSchema.ts";
import type { PracticeDrillAttempt, PracticeDrillSet } from "../../shared/practiceDrillSchema.ts";
import type { FollowUpExchange, SessionResults, StepAttempt } from "../../shared/sessionResultsSchema.ts";
import type { SessionDefinition } from "../../shared/sessionSchema.ts";
import type { TopicDefinition } from "../../shared/topicSchema.ts";
import type { TopicStatus } from "../../server/topicStatusReporter.ts";

export interface SessionPayload {
  topic: TopicDefinition;
  session: SessionDefinition;
  results: SessionResults | null;
  items: LearningItem[];
  /** Null when grading can run; otherwise what to fix. */
  llmUnavailableReason: string | null;
}

export type AttemptInputMode = "typed" | "spoken" | "mixed" | "choice";

async function requestJson<ResponseBody>(url: string, init?: { method?: string; body?: unknown }): Promise<ResponseBody> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload as ResponseBody;
}

export class LearningApiClient {
  public constructor(
    private readonly topicId: string,
    private readonly sessionDirName: string,
  ) {}

  public static async fetchTopicStatuses(): Promise<{ topics: TopicStatus[]; llmUnavailableReason: string | null }> {
    return requestJson("/api/topics");
  }

  public assetUrl(relativePath: string): string {
    return `/session-assets/${this.topicId}/${this.sessionDirName}/${relativePath}`;
  }

  public async fetchSession(): Promise<SessionPayload> {
    return requestJson(this.sessionUrl(""));
  }

  public async startSession(): Promise<SessionResults> {
    return (await requestJson<{ results: SessionResults }>(this.sessionUrl("/start"), { method: "POST", body: {} })).results;
  }

  public async submitAttempt(
    stepId: string,
    attempt: { answer: string; inputMode: AttemptInputMode; hintsRevealed: number; timeSpentMs: number; selectedOptionIndex?: number },
  ): Promise<StepAttempt> {
    return (await requestJson<{ attempt: StepAttempt }>(this.sessionUrl(`/steps/${stepId}/attempts`), { method: "POST", body: attempt })).attempt;
  }

  public async disputeAttempt(stepId: string, attemptIndex: number, learnerArgument: string): Promise<StepAttempt> {
    return (
      await requestJson<{ attempt: StepAttempt }>(this.sessionUrl(`/steps/${stepId}/attempts/${attemptIndex}/dispute`), {
        method: "POST",
        body: { learnerArgument },
      })
    ).attempt;
  }

  public async askFollowUp(stepId: string, question: string): Promise<FollowUpExchange> {
    return (await requestJson<{ exchange: FollowUpExchange }>(this.sessionUrl(`/steps/${stepId}/follow-ups`), { method: "POST", body: { question } })).exchange;
  }

  /** Generates (or returns existing) practice drills for a step. Empty drills means none apply. */
  public async requestPracticeDrills(stepId: string): Promise<PracticeDrillSet> {
    return (await requestJson<{ practiceDrills: PracticeDrillSet }>(this.sessionUrl(`/steps/${stepId}/practice-drills`), { method: "POST", body: {} })).practiceDrills;
  }

  public async submitPracticeDrillAttempt(
    stepId: string,
    drillId: string,
    attempt: { answer: string; inputMode: "typed" | "spoken" | "mixed"; timeSpentMs: number },
  ): Promise<PracticeDrillAttempt> {
    return (
      await requestJson<{ attempt: PracticeDrillAttempt }>(this.sessionUrl(`/steps/${stepId}/practice-drills/${drillId}/attempts`), { method: "POST", body: attempt })
    ).attempt;
  }

  public async skipPracticeDrills(stepId: string): Promise<void> {
    await requestJson(this.sessionUrl(`/steps/${stepId}/practice-drills/skip`), { method: "POST", body: {} });
  }

  public async markStepComplete(stepId: string): Promise<void> {
    await requestJson(this.sessionUrl(`/steps/${stepId}/complete`), { method: "POST", body: {} });
  }

  public async completeSession(feedback: { difficulty?: string; steeringNote: string; processFeedback: string }): Promise<SessionResults> {
    return (await requestJson<{ results: SessionResults }>(this.sessionUrl("/complete"), { method: "POST", body: feedback })).results;
  }

  private sessionUrl(suffix: string): string {
    return `/api/topics/${this.topicId}/sessions/${this.sessionDirName}${suffix}`;
  }
}
