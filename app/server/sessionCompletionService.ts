import path from "node:path";
import type { EndOfSessionFeedback, ItemScheduleChange, SessionResults } from "../shared/sessionResultsSchema.ts";
import type { SessionDefinition } from "../shared/sessionSchema.ts";
import { isGradedStep } from "../shared/sessionSchema.ts";
import { PROCESS_FEEDBACK_FILE_PATH, topicDirectory } from "./repositoryPaths.ts";
import { SpacedRepetitionScheduler } from "./spacedRepetitionScheduler.ts";
import type { TopicRepository } from "./topicRepository.ts";

const DIFFICULTY_LABELS: Record<string, string> = {
  too_easy: "too easy",
  about_right: "about right",
  too_hard: "too hard",
};

/**
 * Finalizes a session: records end-of-session feedback, applies spaced-repetition updates
 * for every targeted item (using first-attempt scores), and appends steering/process notes.
 */
export class SessionCompletionService {
  private readonly scheduler = new SpacedRepetitionScheduler();

  public constructor(private readonly repository: TopicRepository) {}

  public async completeSession(
    topicId: string,
    sessionDirName: string,
    feedback: Omit<EndOfSessionFeedback, "submittedAt">,
  ): Promise<SessionResults> {
    const session = this.repository.readSessionDefinition(topicId, sessionDirName);
    const results = this.repository.readSessionResults(topicId, sessionDirName);
    if (!results) throw new Error("Session was never started");
    if (results.completedAt) return results;

    const completedAt = new Date();
    const itemScheduleChanges = await this.applySpacedRepetitionUpdates(topicId, sessionDirName, session, results, completedAt);

    const finalizedResults: SessionResults = {
      ...results,
      completedAt: completedAt.toISOString(),
      endOfSessionFeedback: { ...feedback, submittedAt: completedAt.toISOString() },
      itemScheduleChanges,
    };
    await this.repository.writeSessionResults(topicId, sessionDirName, finalizedResults);
    await this.appendLearnerNotes(topicId, sessionDirName, feedback, completedAt);
    return finalizedResults;
  }

  private async applySpacedRepetitionUpdates(
    topicId: string,
    sessionDirName: string,
    session: SessionDefinition,
    results: SessionResults,
    reviewedAt: Date,
  ): Promise<ItemScheduleChange[]> {
    const scoresByItemId = new Map<string, { scores: number[]; stages: number[]; stepIds: string[] }>();
    for (const step of session.steps) {
      if (!isGradedStep(step) || step.itemIds.length === 0) continue;
      const firstAttempt = results.steps[step.id]?.attempts[0];
      if (!firstAttempt) continue;
      for (const itemId of step.itemIds) {
        const aggregate = scoresByItemId.get(itemId) ?? { scores: [], stages: [], stepIds: [] };
        aggregate.scores.push(firstAttempt.grade.score);
        if (step.stage) aggregate.stages.push(step.stage);
        aggregate.stepIds.push(step.id);
        scoresByItemId.set(itemId, aggregate);
      }
    }
    if (scoresByItemId.size === 0) return [];

    const deck = this.repository.readLearningItemDeck(topicId);
    const changes: ItemScheduleChange[] = [];
    deck.items = deck.items.map((item) => {
      const aggregate = scoresByItemId.get(item.id);
      if (!aggregate) return item;
      const meanScore = aggregate.scores.reduce((sum, score) => sum + score, 0) / aggregate.scores.length;
      const updatedItem = this.scheduler.applyReview(item, {
        score: meanScore,
        stageTested: aggregate.stages.length > 0 ? Math.max(...aggregate.stages) : Math.max(1, item.stage),
        reviewedAt,
        sessionDirName,
        stepIds: aggregate.stepIds,
      });
      changes.push({
        itemId: item.id,
        score: Math.round(meanScore * 10) / 10,
        stageBefore: item.stage,
        stageAfter: updatedItem.stage,
        intervalDaysBefore: item.spacedRepetition.intervalDays,
        intervalDaysAfter: updatedItem.spacedRepetition.intervalDays,
        dueAt: updatedItem.spacedRepetition.dueAt ?? "",
      });
      return updatedItem;
    });
    await this.repository.writeLearningItemDeck(topicId, deck);
    return changes;
  }

  private async appendLearnerNotes(
    topicId: string,
    sessionDirName: string,
    feedback: Omit<EndOfSessionFeedback, "submittedAt">,
    completedAt: Date,
  ): Promise<void> {
    const dateLabel = completedAt.toISOString().slice(0, 10);
    const hasSteering = feedback.steeringNote.trim().length > 0 || feedback.difficulty !== undefined;
    if (hasSteering) {
      const lines = [`## ${dateLabel} · after ${sessionDirName}`];
      if (feedback.difficulty) lines.push(`- Difficulty: ${DIFFICULTY_LABELS[feedback.difficulty]}`);
      if (feedback.steeringNote.trim()) lines.push(`- Note: ${feedback.steeringNote.trim()}`);
      lines.push("- Status: open");
      await this.repository.appendToMarkdownFile(
        path.join(topicDirectory(topicId), "steering.md"),
        `${lines.join("\n")}\n`,
        "# Steering notes\n\nLearner's steering for upcoming sessions. Agents: when a note is acted on, change `Status: open` to `Status: addressed in <session dir>`.",
      );
    }
    if (feedback.processFeedback.trim()) {
      await this.repository.appendToMarkdownFile(
        PROCESS_FEEDBACK_FILE_PATH,
        `## ${dateLabel} · ${topicId}/${sessionDirName}\n- Feedback: ${feedback.processFeedback.trim()}\n- Status: open\n`,
        "# Process feedback\n\nLearner's feedback about the learning system itself. Agents: act on it, update docs/SYSTEM.md, then mark `Status: addressed (<what changed>)`.",
      );
    }
  }
}
