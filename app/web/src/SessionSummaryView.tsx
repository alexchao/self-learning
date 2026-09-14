import { useState } from "react";
import type { LearningApiClient, SessionPayload } from "./apiClient.ts";
import { ScoreSeal } from "./GradeFeedbackPanel.tsx";

const DIFFICULTY_OPTIONS = [
  { value: "too_easy", label: "Too easy" },
  { value: "about_right", label: "About right" },
  { value: "too_hard", label: "Too hard" },
] as const;

const STAGE_NAMES: Record<number, string> = {
  0: "New",
  1: "Recognize",
  2: "Recall",
  3: "Guided",
  4: "Translate",
  5: "In context",
  6: "Free use",
};

function describeStepForSummary(step: SessionPayload["session"]["steps"][number]): string {
  switch (step.type) {
    case "teach":
      return step.heading;
    case "choice":
      return step.prompt;
    case "cloze":
      return step.englishMeaning;
    case "translate":
      return step.english;
    case "rewrite":
      return step.instruction;
    case "respond":
      return step.task;
    case "free_production":
      return step.prompt;
  }
}

export function SessionSummaryView({
  payload,
  apiClient,
  isCompleted,
  onCompleted,
}: {
  payload: SessionPayload;
  apiClient: LearningApiClient;
  isCompleted: boolean;
  onCompleted: () => void;
}) {
  const { session, results, items } = payload;
  const [difficulty, setDifficulty] = useState<string | undefined>(results?.endOfSessionFeedback?.difficulty);
  const [steeringNote, setSteeringNote] = useState("");
  const [processFeedback, setProcessFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const gradedSteps = session.steps.filter((step) => step.type !== "teach");
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const finish = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.completeSession({ difficulty, steeringNote, processFeedback });
      onCompleted();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="step session-summary">
      <p className="step-eyebrow">{isCompleted ? "Session complete" : "Almost done"}</p>
      <h1 className="session-title">{session.title}</h1>

      <ol className="summary-list">
        {gradedSteps.map((step) => {
          const attempts = results?.steps[step.id]?.attempts ?? [];
          const practiceDrills = results?.steps[step.id]?.practiceDrills?.drills ?? [];
          const firstAttempt = attempts[0];
          const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.grade.score), -1);
          return (
            <li key={step.id} className="summary-row">
              {firstAttempt ? <ScoreSeal score={firstAttempt.grade.score} size="small" /> : <span className="score-seal score-seal-small score-skipped">–</span>}
              <span className="summary-row-text">{describeStepForSummary(step)}</span>
              {attempts.length > 1 && bestScore > (firstAttempt?.grade.score ?? -1) && <span className="summary-row-retry">→ {bestScore} on retry</span>}
              {practiceDrills.length > 0 && (
                <span className="summary-row-practice">
                  practice {practiceDrills.filter((drill) => (drill.attempts[0]?.grade.score ?? 0) >= 3).length}/{practiceDrills.length}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {isCompleted && results && results.itemScheduleChanges.length > 0 && (
        <div className="feedback-block">
          <p className="feedback-label">Your deck</p>
          <ul className="schedule-list">
            {results.itemScheduleChanges.map((change) => (
              <li key={change.itemId} className="schedule-row">
                <span className="chinese">{itemsById.get(change.itemId)?.headword ?? change.itemId}</span>
                <span className="schedule-stage">
                  {STAGE_NAMES[change.stageBefore]} → {STAGE_NAMES[change.stageAfter]}
                </span>
                <span className="schedule-due">
                  next in {change.intervalDaysAfter < 1.5 ? "1 day" : `${Math.round(change.intervalDaysAfter)} days`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isCompleted && (
        <div className="end-feedback">
          <p className="feedback-label">How was the difficulty?</p>
          <div className="segmented">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented-option ${difficulty === option.value ? "is-selected" : ""}`}
                onClick={() => setDifficulty(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="feedback-label" htmlFor="steering-note">
            Anything to steer next session?
          </label>
          <textarea
            id="steering-note"
            className="text-input"
            rows={2}
            placeholder="e.g. more software-engineering vocabulary, fewer idioms, go faster…"
            value={steeringNote}
            onChange={(event) => setSteeringNote(event.target.value)}
          />

          <label className="feedback-label" htmlFor="process-feedback">
            Feedback on the learning system itself <span className="optional">optional</span>
          </label>
          <textarea
            id="process-feedback"
            className="text-input"
            rows={2}
            placeholder="Format, pacing, grading, UI…"
            value={processFeedback}
            onChange={(event) => setProcessFeedback(event.target.value)}
          />

          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <div className="step-actions">
            <button type="button" className="button-primary" onClick={() => void finish()} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Finish session"}
            </button>
          </div>
        </div>
      )}

      {isCompleted && (
        <p className="session-subtitle closing-note">
          {results?.nextSessionPreparation && !results.nextSessionPreparation.skippedReason
            ? "Saved. Your next session is being prepared in the background. Come back whenever you're ready."
            : "Saved. Next time, tell Claude Code you're ready for the next session."}
        </p>
      )}
    </section>
  );
}
