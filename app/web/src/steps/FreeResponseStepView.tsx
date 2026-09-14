import { useCallback, useEffect, useState } from "react";
import type { PracticeDrillSet } from "../../../shared/practiceDrillSchema.ts";
import type { StepAttempt, StepResult } from "../../../shared/sessionResultsSchema.ts";
import { PRACTICE_DRILL_STEP_TYPES, type FreeResponseStep } from "../../../shared/sessionSchema.ts";
import { AnswerComposer, type ComposedAnswer } from "../AnswerComposer.tsx";
import type { LearningApiClient } from "../apiClient.ts";
import { FollowUpConversation } from "../FollowUpConversation.tsx";
import { GradeFeedbackPanel, ScoreSeal } from "../GradeFeedbackPanel.tsx";
import { PracticeDrillSequence } from "../PracticeDrillSequence.tsx";
import { FreeResponsePromptView } from "./FreeResponsePromptView.tsx";

type Phase = "answering" | "grading" | "feedback" | "practice";
type PracticeDrillStatus = "not_applicable" | "loading" | "available" | "finished" | "failed";

function derivePracticeDrillStatus(drillSet: PracticeDrillSet | undefined): PracticeDrillStatus | null {
  if (!drillSet) return null;
  if (drillSet.skippedAt || drillSet.drills.length === 0) return "not_applicable";
  return drillSet.drills.every((drill) => drill.attempts.length > 0) ? "finished" : "available";
}

export function FreeResponseStepView({
  step,
  stepResult,
  apiClient,
  speechLanguage = "zh-TW",
  onContinue,
}: {
  step: FreeResponseStep;
  stepResult: StepResult | undefined;
  apiClient: LearningApiClient;
  speechLanguage?: string;
  onContinue: () => void;
}) {
  const [attempts, setAttempts] = useState<StepAttempt[]>(stepResult?.attempts ?? []);
  const [phase, setPhase] = useState<Phase>(attempts.length > 0 ? "feedback" : "answering");
  const [composerKey, setComposerKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeArgument, setDisputeArgument] = useState("");
  const [isDisputeSubmitting, setIsDisputeSubmitting] = useState(false);
  const [practiceDrillSet, setPracticeDrillSet] = useState<PracticeDrillSet | undefined>(stepResult?.practiceDrills);
  const [practiceDrillStatus, setPracticeDrillStatus] = useState<PracticeDrillStatus>(
    derivePracticeDrillStatus(stepResult?.practiceDrills) ?? ((PRACTICE_DRILL_STEP_TYPES as readonly string[]).includes(step.type) ? "loading" : "not_applicable"),
  );

  const latestAttempt = attempts[attempts.length - 1];
  const latestAttemptIndex = attempts.length - 1;
  const clozeParts = step.type === "cloze" ? step.sentenceWithBlank.split("___") : null;
  const hasPracticeToDo = practiceDrillStatus === "loading" || practiceDrillStatus === "available";

  // Start generating practice drills as soon as the first feedback is on screen.
  useEffect(() => {
    if (attempts.length === 0 || practiceDrillSet || practiceDrillStatus !== "loading") return;
    let isCancelled = false;
    apiClient
      .requestPracticeDrills(step.id)
      .then((drillSet) => {
        if (isCancelled) return;
        setPracticeDrillSet(drillSet);
        setPracticeDrillStatus(derivePracticeDrillStatus(drillSet) ?? "not_applicable");
      })
      .catch(() => !isCancelled && setPracticeDrillStatus("failed"));
    return () => {
      isCancelled = true;
    };
  }, [apiClient, attempts.length, practiceDrillSet, practiceDrillStatus, step.id]);

  const submitAnswer = async (composedAnswer: ComposedAnswer) => {
    setPhase("grading");
    setErrorMessage(null);
    try {
      const attempt = await apiClient.submitAttempt(step.id, composedAnswer);
      setAttempts((previous) => [...previous, attempt]);
      setPhase("feedback");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setPhase("answering");
    }
  };

  const startRetry = () => {
    setIsDisputeOpen(false);
    setComposerKey((key) => key + 1);
    setPhase("answering");
  };

  const skipPractice = async () => {
    if (practiceDrillSet && practiceDrillSet.drills.length > 0) {
      await apiClient.skipPracticeDrills(step.id).catch(() => undefined);
    }
    onContinue();
  };

  const primaryFeedbackAction = useCallback(() => {
    if (hasPracticeToDo) setPhase("practice");
    else onContinue();
  }, [hasPracticeToDo, onContinue]);

  const submitDispute = async () => {
    if (!disputeArgument.trim()) return;
    setIsDisputeSubmitting(true);
    setErrorMessage(null);
    try {
      const updatedAttempt = await apiClient.disputeAttempt(step.id, latestAttemptIndex, disputeArgument);
      setAttempts((previous) => previous.map((attempt, index) => (index === latestAttemptIndex ? updatedAttempt : attempt)));
      setIsDisputeOpen(false);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsDisputeSubmitting(false);
    }
  };

  useEffect(() => {
    if (phase !== "feedback") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
        primaryFeedbackAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, primaryFeedbackAction]);

  if (phase === "practice") {
    return (
      <section className={`step step-free-response step-${step.type}`}>
        {practiceDrillStatus === "loading" && (
          <div className="practice">
            <div className="practice-header">
              <p className="step-eyebrow">Apply it</p>
              <button type="button" className="button-quiet" onClick={() => void skipPractice()}>
                Skip practice
              </button>
            </div>
            <p className="session-subtitle">Writing a few sentences that use what you just learned…</p>
            <div className="grading-indicator" />
          </div>
        )}
        {practiceDrillStatus === "failed" && (
          <div className="practice">
            <p className="error-message">Couldn't generate practice sentences for this step.</p>
            <div className="step-actions">
              <button type="button" className="button-primary" onClick={onContinue} autoFocus>
                Continue
              </button>
            </div>
          </div>
        )}
        {(practiceDrillStatus === "available" || practiceDrillStatus === "finished") && practiceDrillSet && (
          <PracticeDrillSequence
            stepId={step.id}
            initialDrills={practiceDrillSet.drills}
            apiClient={apiClient}
            speechLanguage={speechLanguage}
            onFinished={onContinue}
            onSkip={() => void skipPractice()}
          />
        )}
        {practiceDrillStatus === "not_applicable" && (
          <div className="step-actions">
            <button type="button" className="button-primary" onClick={onContinue} autoFocus>
              Continue
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`step step-free-response step-${step.type}`}>
      <FreeResponsePromptView step={step} speechLanguage={speechLanguage} assetUrl={(relativePath) => apiClient.assetUrl(relativePath)} />

      {attempts.length > 1 && (
        <ol className="previous-attempts">
          {attempts.slice(0, -1).map((attempt, index) => (
            <li key={index}>
              <ScoreSeal score={attempt.grade.score} size="small" />
              <span className="chinese">{attempt.answer}</span>
            </li>
          ))}
        </ol>
      )}

      {phase !== "feedback" && (
        <AnswerComposer
          key={composerKey}
          speechLanguage={speechLanguage}
          placeholder={step.type === "cloze" ? "The missing words" : "用中文回答…"}
          rows={step.type === "cloze" ? 1 : step.type === "free_production" ? 5 : 3}
          isSingleLine={step.type === "cloze"}
          hints={step.hints}
          isSubmitting={phase === "grading"}
          onSubmit={(composedAnswer) => void submitAnswer(composedAnswer)}
        />
      )}

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {phase === "feedback" && latestAttempt && (
        <>
          <div className="your-answer">
            <p className="feedback-label">You said</p>
            <p className="chinese">{clozeParts ? `${clozeParts[0]}【${latestAttempt.answer.trim()}】${clozeParts[1]}` : latestAttempt.answer}</p>
          </div>
          <GradeFeedbackPanel
            attempt={latestAttempt}
            speechLanguage={speechLanguage}
            answerPrefix={clozeParts ? { before: clozeParts[0] ?? "", after: clozeParts[1] ?? "" } : undefined}
          />

          {isDisputeOpen && (
            <div className="dispute-box">
              <textarea
                className="text-input"
                rows={2}
                autoFocus
                placeholder="Why do you think your answer deserves a different grade?"
                value={disputeArgument}
                onChange={(event) => setDisputeArgument(event.target.value)}
              />
              <div className="step-actions">
                <button type="button" className="button-quiet" onClick={() => setIsDisputeOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="button-secondary" onClick={() => void submitDispute()} disabled={isDisputeSubmitting || !disputeArgument.trim()}>
                  {isDisputeSubmitting ? "Reconsidering…" : "Submit challenge"}
                </button>
              </div>
            </div>
          )}

          <FollowUpConversation stepId={step.id} apiClient={apiClient} initialExchanges={stepResult?.followUps ?? []} />

          <div className="step-actions step-actions-spread">
            <div className="answer-toolbar-left">
              {latestAttempt.grade.score < 4 && (
                <button type="button" className="button-quiet" onClick={startRetry}>
                  Try again
                </button>
              )}
              {!latestAttempt.dispute && latestAttempt.grade.gradedBy === "llm" && !isDisputeOpen && (
                <button type="button" className="button-quiet" onClick={() => setIsDisputeOpen(true)}>
                  Challenge grade
                </button>
              )}
            </div>
            <button type="button" className="button-primary" onClick={primaryFeedbackAction}>
              {hasPracticeToDo ? "Practice it" : "Continue"} <kbd>⌘↵</kbd>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
