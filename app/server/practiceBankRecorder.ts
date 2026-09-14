import type { PracticeBankEntry } from "../shared/practiceDrillSchema.ts";
import type { SessionResults } from "../shared/sessionResultsSchema.ts";
import type { SessionDefinition } from "../shared/sessionSchema.ts";
import type { TopicRepository } from "./topicRepository.ts";

/**
 * Copies a completed session's practice drills into topics/<topic>/practice-bank.json,
 * where session authors can reuse them as review exercises. Idempotent by entry id.
 */
export class PracticeBankRecorder {
  public constructor(private readonly repository: TopicRepository) {}

  public async recordSessionDrills(topicId: string, sessionDirName: string, session: SessionDefinition, results: SessionResults): Promise<number> {
    const newEntries: PracticeBankEntry[] = [];
    for (const step of session.steps) {
      const drills = results.steps[step.id]?.practiceDrills?.drills ?? [];
      for (const drill of drills) {
        const firstAttempt = drill.attempts[0];
        newEntries.push({
          id: `${sessionDirName}--${step.id}--${drill.id}`,
          createdAt: drill.generatedAt,
          sourceSessionDirName: sessionDirName,
          sourceStepId: step.id,
          itemIds: step.itemIds,
          lesson: drill.lesson,
          targetExpression: drill.targetExpression,
          english: drill.english,
          context: drill.context,
          referenceAnswers: drill.referenceAnswers,
          firstAttempt: firstAttempt ? { answer: firstAttempt.answer, score: firstAttempt.grade.score } : null,
        });
      }
    }
    if (newEntries.length === 0) return 0;

    const bank = this.repository.readPracticeBank(topicId);
    const existingIds = new Set(bank.entries.map((entry) => entry.id));
    const entriesToAdd = newEntries.filter((entry) => !existingIds.has(entry.id));
    if (entriesToAdd.length === 0) return 0;
    await this.repository.writePracticeBank(topicId, { ...bank, entries: [...bank.entries, ...entriesToAdd] });
    return entriesToAdd.length;
  }
}
