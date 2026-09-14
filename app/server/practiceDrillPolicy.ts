import { PRACTICE_DRILL_STEP_TYPES, type SessionStep } from "../shared/sessionSchema.ts";
import type { LearningConfig } from "./learningConfig.ts";

/** How many practice drills a step should get after its first graded attempt (0 = none). */
export function resolvePracticeDrillCount(step: SessionStep, firstAttemptScore: number, config: LearningConfig): number {
  if (!(PRACTICE_DRILL_STEP_TYPES as readonly string[]).includes(step.type)) return 0;
  if (firstAttemptScore >= config.practiceDrills.skipWhenFirstAttemptScoreAtLeast) return 0;
  const authoredCount = "practiceDrillCount" in step ? step.practiceDrillCount : undefined;
  return authoredCount ?? config.practiceDrills.defaultCountPerStep;
}
