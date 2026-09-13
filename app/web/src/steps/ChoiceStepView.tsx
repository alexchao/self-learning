import { useState } from "react";
import type { StepResult } from "../../../shared/sessionResultsSchema.ts";
import type { ChoiceStep } from "../../../shared/sessionSchema.ts";
import type { LearningApiClient } from "../apiClient.ts";
import { RichText } from "../RichText.tsx";

export function ChoiceStepView({
  step,
  stepResult,
  apiClient,
  onContinue,
}: {
  step: ChoiceStep;
  stepResult: StepResult | undefined;
  apiClient: LearningApiClient;
  onContinue: () => void;
}) {
  const initiallySelectedIndex = stepResult?.attempts[0] ? step.options.findIndex((option) => option.text === stepResult.attempts[0]!.answer) : -1;
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(initiallySelectedIndex >= 0 ? initiallySelectedIndex : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const isAnswered = selectedOptionIndex !== null;

  const choose = async (optionIndex: number) => {
    if (isAnswered || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.submitAttempt(step.id, {
        answer: step.options[optionIndex]!.text,
        inputMode: "choice",
        hintsRevealed: 0,
        timeSpentMs: Date.now() - startedAt,
        selectedOptionIndex: optionIndex,
      });
      setSelectedOptionIndex(optionIndex);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="step step-choice">
      <p className="step-eyebrow">Choose</p>
      <RichText text={step.prompt} className="step-prompt" />
      {step.context && <RichText text={step.context} className="step-context" />}
      <ol className="choice-list">
        {step.options.map((option, index) => {
          const stateClass = !isAnswered ? "" : option.isCorrect ? "is-correct" : index === selectedOptionIndex ? "is-wrong" : "is-dimmed";
          return (
            <li key={index}>
              <button type="button" className={`choice-option ${stateClass}`} onClick={() => choose(index)} disabled={isAnswered || isSubmitting}>
                <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                <span className="chinese choice-text">{option.text}</span>
              </button>
              {isAnswered && (option.isCorrect || index === selectedOptionIndex) && <p className="choice-explanation">{option.explanation}</p>}
            </li>
          );
        })}
      </ol>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {isAnswered && (
        <div className="step-actions">
          <button type="button" className="button-primary" onClick={onContinue} autoFocus>
            Continue
          </button>
        </div>
      )}
    </section>
  );
}
