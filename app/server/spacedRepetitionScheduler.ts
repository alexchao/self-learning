import type { LearningItem } from "../shared/learningItemSchema.ts";

/**
 * Simplified SM-2 coupled to the 6-stage Bloom ladder (docs/SYSTEM.md).
 *
 * - Scores 0–1 are a lapse: interval resets to 1 day and the stage drops one level.
 * - Score 2 (hard): interval grows slowly, stage holds.
 * - Scores 3–4: interval grows by ease (credited with actual elapsed days, so success after
 *   a long gap earns a long interval), and the stage advances past the stage that was tested.
 */

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MINIMUM_EASE = 1.3;
const MAXIMUM_INTERVAL_DAYS = 365;
const MAXIMUM_STAGE = 6;

export interface ItemReviewOutcome {
  /** Aggregated 0–4 score for this item in this session. */
  score: number;
  /** Highest Bloom stage at which the item was tested this session. */
  stageTested: number;
  reviewedAt: Date;
  sessionDirName: string;
  stepIds: string[];
}

export class SpacedRepetitionScheduler {
  public applyReview(item: LearningItem, outcome: ItemReviewOutcome): LearningItem {
    const previousState = item.spacedRepetition;
    const elapsedDays = previousState.lastReviewedAt
      ? Math.max(0, (outcome.reviewedAt.getTime() - new Date(previousState.lastReviewedAt).getTime()) / MILLISECONDS_PER_DAY)
      : 0;
    // Late reviews are credited with the full elapsed time; early reviews only get partial credit.
    const creditedIntervalDays =
      elapsedDays >= previousState.intervalDays ? elapsedDays : (previousState.intervalDays + elapsedDays) / 2;
    const currentStage = Math.max(item.stage, 1);
    const score = Math.round(Math.min(4, Math.max(0, outcome.score)));

    let ease = previousState.ease;
    let reps = previousState.reps;
    let lapses = previousState.lapses;
    let intervalDays: number;
    let stage: number;

    if (score <= 1) {
      lapses += 1;
      reps = 0;
      ease = Math.max(MINIMUM_EASE, ease - 0.2);
      intervalDays = 1;
      stage = Math.max(1, Math.min(currentStage, outcome.stageTested) - 1);
    } else if (score === 2) {
      reps += 1;
      ease = Math.max(MINIMUM_EASE, ease - 0.15);
      intervalDays = Math.max(1, creditedIntervalDays * 1.2);
      stage = currentStage;
    } else {
      const isEasy = score === 4;
      if (isEasy) ease += 0.15;
      if (reps === 0) intervalDays = isEasy ? 3 : 1;
      else if (reps === 1) intervalDays = isEasy ? 6 : 3;
      else intervalDays = creditedIntervalDays * ease * (isEasy ? 1.3 : 1);
      reps += 1;
      stage = outcome.stageTested >= currentStage ? Math.min(MAXIMUM_STAGE, outcome.stageTested + 1) : currentStage;
    }

    intervalDays = Math.min(MAXIMUM_INTERVAL_DAYS, Math.round(intervalDays * 10) / 10);
    const dueAt = new Date(outcome.reviewedAt.getTime() + intervalDays * MILLISECONDS_PER_DAY).toISOString();

    return {
      ...item,
      introducedInSession: item.introducedInSession ?? outcome.sessionDirName,
      stage,
      spacedRepetition: {
        dueAt,
        intervalDays,
        ease: Math.round(ease * 100) / 100,
        reps,
        lapses,
        lastReviewedAt: outcome.reviewedAt.toISOString(),
      },
      history: [
        ...item.history,
        {
          sessionDirName: outcome.sessionDirName,
          stepIds: outcome.stepIds,
          stageTested: outcome.stageTested,
          score,
          reviewedAt: outcome.reviewedAt.toISOString(),
          stageAfter: stage,
          intervalDaysAfter: intervalDays,
        },
      ],
    };
  }

  public isDue(item: LearningItem, now: Date): boolean {
    return item.spacedRepetition.dueAt !== null && new Date(item.spacedRepetition.dueAt).getTime() <= now.getTime();
  }

  public daysOverdue(item: LearningItem, now: Date): number {
    if (item.spacedRepetition.dueAt === null) return 0;
    return Math.max(0, (now.getTime() - new Date(item.spacedRepetition.dueAt).getTime()) / MILLISECONDS_PER_DAY);
  }
}
