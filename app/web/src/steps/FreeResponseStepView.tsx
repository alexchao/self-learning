import { useCallback, useEffect, useRef, useState } from "react";
import type { StepAttempt, StepResult } from "../../../shared/sessionResultsSchema.ts";
import type { FreeResponseStep } from "../../../shared/sessionSchema.ts";
import type { AttemptInputMode, LearningApiClient } from "../apiClient.ts";
import { FollowUpConversation } from "../FollowUpConversation.tsx";
import { GradeFeedbackPanel, ScoreSeal } from "../GradeFeedbackPanel.tsx";
import { useSpeechDictation } from "../speechServices.ts";
import { FreeResponsePromptView } from "./FreeResponsePromptView.tsx";

type Phase = "answering" | "grading" | "feedback";

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
  const [answerText, setAnswerText] = useState("");
  const [hasTyped, setHasTyped] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeArgument, setDisputeArgument] = useState("");
  const [isDisputeSubmitting, setIsDisputeSubmitting] = useState(false);
  const answeringStartedAtRef = useRef(Date.now());
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  const dictation = useSpeechDictation(speechLanguage, (transcript) => {
    setHasSpoken(true);
    setAnswerText((previous) => `${previous}${transcript}`);
  });

  const latestAttempt = attempts[attempts.length - 1];
  const latestAttemptIndex = attempts.length - 1;
  const inputMode: AttemptInputMode = hasTyped && hasSpoken ? "mixed" : hasSpoken ? "spoken" : "typed";
  const clozeParts = step.type === "cloze" ? step.sentenceWithBlank.split("___") : null;

  const submitAnswer = useCallback(async () => {
    if (!answerText.trim() || phase !== "answering") return;
    dictation.stopListening();
    setPhase("grading");
    setErrorMessage(null);
    try {
      const attempt = await apiClient.submitAttempt(step.id, {
        answer: answerText,
        inputMode,
        hintsRevealed,
        timeSpentMs: Date.now() - answeringStartedAtRef.current,
      });
      setAttempts((previous) => [...previous, attempt]);
      setPhase("feedback");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setPhase("answering");
    }
  }, [answerText, apiClient, dictation, hintsRevealed, inputMode, phase, step.id]);

  const startRetry = () => {
    setAnswerText("");
    setHasTyped(false);
    setHasSpoken(false);
    setHintsRevealed(0);
    setIsDisputeOpen(false);
    answeringStartedAtRef.current = Date.now();
    setPhase("answering");
  };

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
    if (phase === "answering") answerInputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "feedback") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
        onContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, onContinue]);

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
        <div className="answer-area">
          <textarea
            ref={answerInputRef}
            className={`chinese answer-input ${step.type === "cloze" ? "answer-input-short" : ""}`}
            value={answerText + (dictation.isListening ? dictation.interimTranscript : "")}
            placeholder={step.type === "cloze" ? "The missing words" : "用中文回答…"}
            rows={step.type === "cloze" ? 1 : step.type === "free_production" ? 5 : 3}
            disabled={phase === "grading"}
            onChange={(event) => {
              setHasTyped(true);
              setAnswerText(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey || step.type === "cloze")) {
                event.preventDefault();
                void submitAnswer();
              }
            }}
          />

          {hintsRevealed > 0 && (
            <ul className="hint-list">
              {step.hints.slice(0, hintsRevealed).map((hint, index) => (
                <li key={index}>{hint}</li>
              ))}
            </ul>
          )}

          <div className="answer-toolbar">
            <div className="answer-toolbar-left">
              {dictation.isSupported && (
                <button
                  type="button"
                  className={`button-quiet mic-button ${dictation.isListening ? "is-listening" : ""}`}
                  onClick={dictation.isListening ? dictation.stopListening : dictation.startListening}
                  disabled={phase === "grading"}
                >
                  <span className="mic-dot" aria-hidden="true" />
                  {dictation.isListening ? "Stop" : "Speak"}
                </button>
              )}
              {hintsRevealed < step.hints.length && (
                <button type="button" className="button-quiet" onClick={() => setHintsRevealed((count) => count + 1)} disabled={phase === "grading"}>
                  Hint {hintsRevealed + 1}/{step.hints.length}
                </button>
              )}
            </div>
            <button type="button" className="button-primary" onClick={() => void submitAnswer()} disabled={!answerText.trim() || phase === "grading"}>
              {phase === "grading" ? "Reading…" : "Check"}
              {phase !== "grading" && <kbd>⌘↵</kbd>}
            </button>
          </div>
          {dictation.errorMessage && <p className="error-message">{dictation.errorMessage}</p>}
          {phase === "grading" && <div className="grading-indicator" aria-label="Grading" />}
        </div>
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
            <button type="button" className="button-primary" onClick={onContinue}>
              Continue <kbd>⌘↵</kbd>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
