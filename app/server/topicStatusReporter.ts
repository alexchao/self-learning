import fs from "node:fs";
import path from "node:path";
import { NextSessionPreparer } from "./nextSessionPreparer.ts";
import { topicDirectory } from "./repositoryPaths.ts";
import { SpacedRepetitionScheduler } from "./spacedRepetitionScheduler.ts";
import type { TopicRepository } from "./topicRepository.ts";

export interface TopicStatus {
  topicId: string;
  title: string;
  goal: string;
  status: string;
  completedSessionCount: number;
  lastCompletedSession: { dirName: string; completedAt: string; daysAgo: number } | null;
  /** The earliest session that has a definition but is not completed. */
  nextSession: {
    dirName: string;
    title: string;
    kind: string;
    estimatedMinutes: number;
    state: "not_started" | "in_progress";
    definitionModifiedAt: string;
    authoredAfterLastCompletion: boolean;
    steeringNotesNewerThanDefinition: boolean;
  } | null;
  invalidSessionDirNames: string[];
  items: { total: number; unstudied: number; dueNow: number; overdueByMoreThan3Days: number; countByStage: Record<string, number> };
  openSteeringNoteCount: number;
  preparationInProgress: { startedAt: string; logPath: string } | null;
}

export class TopicStatusReporter {
  private readonly scheduler = new SpacedRepetitionScheduler();
  private readonly preparer = new NextSessionPreparer();

  public constructor(private readonly repository: TopicRepository) {}

  public reportAllTopics(now = new Date()): TopicStatus[] {
    return this.repository.listTopicIds().map((topicId) => this.reportTopic(topicId, now));
  }

  public reportTopic(topicId: string, now = new Date()): TopicStatus {
    const topic = this.repository.readTopic(topicId);
    const invalidSessionDirNames: string[] = [];
    let completedSessionCount = 0;
    let lastCompletedSession: TopicStatus["lastCompletedSession"] = null;
    let nextSession: TopicStatus["nextSession"] = null;

    const steeringPath = path.join(topicDirectory(topicId), "steering.md");
    const steeringModifiedAt = fs.existsSync(steeringPath) ? fs.statSync(steeringPath).mtime : null;
    const openSteeringNoteCount = steeringModifiedAt ? (fs.readFileSync(steeringPath, "utf8").match(/^- Status: open\s*$/gm) ?? []).length : 0;

    for (const dirName of this.repository.listSessionDirNames(topicId)) {
      if (!this.repository.sessionDefinitionExists(topicId, dirName)) continue;
      try {
        const results = this.repository.readSessionResults(topicId, dirName);
        if (results?.completedAt) {
          completedSessionCount += 1;
          lastCompletedSession = {
            dirName,
            completedAt: results.completedAt,
            daysAgo: Math.floor((now.getTime() - new Date(results.completedAt).getTime()) / 86_400_000),
          };
          continue;
        }
        if (nextSession) continue;
        const definition = this.repository.readSessionDefinition(topicId, dirName);
        const definitionModifiedAt = this.repository.readSessionDefinitionFileModifiedAt(topicId, dirName);
        nextSession = {
          dirName,
          title: definition.title,
          kind: definition.kind,
          estimatedMinutes: definition.estimatedMinutes,
          state: results ? "in_progress" : "not_started",
          definitionModifiedAt: definitionModifiedAt.toISOString(),
          authoredAfterLastCompletion: lastCompletedSession ? definitionModifiedAt > new Date(lastCompletedSession.completedAt) : true,
          steeringNotesNewerThanDefinition: steeringModifiedAt !== null && openSteeringNoteCount > 0 && steeringModifiedAt > definitionModifiedAt,
        };
      } catch {
        invalidSessionDirNames.push(dirName);
      }
    }

    const deck = this.repository.readLearningItemDeck(topicId);
    const countByStage: Record<string, number> = {};
    for (const item of deck.items) countByStage[String(item.stage)] = (countByStage[String(item.stage)] ?? 0) + 1;
    const lock = this.preparer.readActivePreparationLock(topicId);

    return {
      topicId,
      title: topic.title,
      goal: topic.goal,
      status: topic.status,
      completedSessionCount,
      lastCompletedSession,
      nextSession,
      invalidSessionDirNames,
      items: {
        total: deck.items.length,
        unstudied: deck.items.filter((item) => item.stage === 0).length,
        dueNow: deck.items.filter((item) => this.scheduler.isDue(item, now)).length,
        overdueByMoreThan3Days: deck.items.filter((item) => this.scheduler.daysOverdue(item, now) > 3).length,
        countByStage,
      },
      openSteeringNoteCount,
      preparationInProgress: lock ? { startedAt: lock.startedAt, logPath: lock.logPath } : null,
    };
  }
}
