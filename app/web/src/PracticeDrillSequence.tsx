import { useEffect, useState } from "react";
import type { PracticeDrill, PracticeDrillAttempt } from "../../shared/practiceDrillSchema.ts";
import { AnswerComposer } from "./AnswerComposer.tsx";
import type { LearningApiClient } from "./apiClient.ts";
import { GradeFeedbackPanel } from "./GradeFeedbackPanel.tsx";

/**
 * "Apply it": 2–3 quick sentences generated from the step's feedback.
 * One drill at a time: answer → compact feedback → next. Resumes from saved attempts.
 */
export function PracticeDrillSequence({
  stepId,
  initialDrills,
  apiClient,
  speechLanguage,
  onFinished,
  onSkip,
}: {
  stepId: string;
  initialDrills: PracticeDrill[];
  apiClient: LearningApiClient;
  speechLanguage: string;
  onFinished: () => void;
  onSkip: () => void;
}) {
  const [drills, setDrills] = useState<PracticeDrill[]>(initialDrills);
  const firstUnansweredIndex = drills.findIndex((drill) => drill.attempts.length === 0);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(firstUnansweredIndex === -1 ? drills.length - 1 : firstUnansweredIndex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentDrill = drills[currentDrillIndex]!;
  const latestAttempt: PracticeDrillAttempt | undefined = currentDrill.attempts[currentDrill.attempts.length - 1];
  const isLastDrill = currentDrillIndex === drills.length - 1;
  const advance = () => (isLastDrill ? onFinished() : setCurrentDrillIndex(currentDrillIndex + 1));

  useEffect(() => {
    if (!latestAttempt) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") advance();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const submit = async (answer: string, inputMode: "typed" | "spoken" | "mixed", timeSpentMs: number) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const attempt = await apiClient.submitPracticeDrillAttempt(stepId, currentDrill.id, { answer, inputMode, timeSpentMs });
      setDrills((previous) => previous.map((drill, index) => (index === currentDrillIndex ? { ...drill, attempts: [...drill.attempts, attempt] } : drill)));
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="practice" key={currentDrill.id}>
      <div className="practice-header">
        <p className="step-eyebrow">
          Apply it · {currentDrillIndex + 1} of {drills.length}
        </p>
        <button type="button" className="button-quiet" onClick={onSkip}>
          Skip practice
        </button>
      </div>
      <p className="practice-lesson">
        <span className="chinese practice-target">{currentDrill.targetExpression}</span>
        <span className="practice-lesson-text">{removeLeadingTargetExpression(currentDrill.lesson, currentDrill.targetExpression)}</span>
      </p>
      {currentDrill.context && <p className="step-context-label">{currentDrill.context}</p>}
      <p className="english-source">{currentDrill.english}</p>

      {!latestAttempt && (
        <AnswerComposer
          key={`${currentDrill.id}-composer`}
          speechLanguage={speechLanguage}
          placeholder="用中文說…"
          rows={2}
          isSubmitting={isSubmitting}
          onSubmit={(composed) => void submit(composed.answer, composed.inputMode, composed.timeSpentMs)}
        />
      )}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {latestAttempt && (
        <>
          <div className="your-answer">
            <p className="feedback-label">You said</p>
            <p className="chinese">{latestAttempt.answer}</p>
          </div>
          <GradeFeedbackPanel attempt={{ ...latestAttempt, hintsRevealed: 0 }} speechLanguage={speechLanguage} />
          <div className="step-actions">
            <button type="button" className="button-primary" onClick={advance} autoFocus>
              {isLastDrill ? "Continue" : "Next sentence"} <kbd>⌘↵</kbd>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Older drills may repeat the Chinese at the start of the lesson ("本來就 — …"); the target is already shown beside it. */
function removeLeadingTargetExpression(lesson: string, targetExpression: string): string {
  const bareTarget = targetExpression.replace(/[…\.]+$/u, "");
  return lesson.startsWith(bareTarget) ? lesson.slice(bareTarget.length).replace(/^[\s—:–-]+/u, "") || lesson : lesson;
}
