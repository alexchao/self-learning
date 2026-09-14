import { useEffect, useRef, useState } from "react";
import { useSpeechDictation } from "./speechServices.ts";

export interface ComposedAnswer {
  answer: string;
  inputMode: "typed" | "spoken" | "mixed";
  hintsRevealed: number;
  timeSpentMs: number;
}

/**
 * Answer input shared by steps and practice drills: textarea, dictation, progressive hints, submit.
 * Remount it (change its `key`) to reset for a new attempt.
 */
export function AnswerComposer({
  speechLanguage,
  placeholder,
  rows,
  isSingleLine = false,
  hints = [],
  isSubmitting,
  submitLabel = "Check",
  onSubmit,
}: {
  speechLanguage: string;
  placeholder: string;
  rows: number;
  isSingleLine?: boolean;
  hints?: string[];
  isSubmitting: boolean;
  submitLabel?: string;
  onSubmit: (composedAnswer: ComposedAnswer) => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const [hasTyped, setHasTyped] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const startedAtRef = useRef(Date.now());
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  const dictation = useSpeechDictation(speechLanguage, (transcript) => {
    setHasSpoken(true);
    setAnswerText((previous) => `${previous}${transcript}`);
  });

  useEffect(() => {
    answerInputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!answerText.trim() || isSubmitting) return;
    dictation.stopListening();
    onSubmit({
      answer: answerText,
      inputMode: hasTyped && hasSpoken ? "mixed" : hasSpoken ? "spoken" : "typed",
      hintsRevealed,
      timeSpentMs: Date.now() - startedAtRef.current,
    });
  };

  return (
    <div className="answer-area">
      <textarea
        ref={answerInputRef}
        className={`chinese answer-input ${isSingleLine ? "answer-input-short" : ""}`}
        value={answerText + (dictation.isListening ? dictation.interimTranscript : "")}
        placeholder={placeholder}
        rows={rows}
        disabled={isSubmitting}
        onChange={(event) => {
          setHasTyped(true);
          setAnswerText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey || isSingleLine)) {
            event.preventDefault();
            submit();
          }
        }}
      />

      {hintsRevealed > 0 && (
        <ul className="hint-list">
          {hints.slice(0, hintsRevealed).map((hint, index) => (
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
              disabled={isSubmitting}
            >
              <span className="mic-dot" aria-hidden="true" />
              {dictation.isListening ? "Stop" : "Speak"}
            </button>
          )}
          {hintsRevealed < hints.length && (
            <button type="button" className="button-quiet" onClick={() => setHintsRevealed((count) => count + 1)} disabled={isSubmitting}>
              Hint {hintsRevealed + 1}/{hints.length}
            </button>
          )}
        </div>
        <button type="button" className="button-primary" onClick={submit} disabled={!answerText.trim() || isSubmitting}>
          {isSubmitting ? "Reading…" : submitLabel}
          {!isSubmitting && <kbd>⌘↵</kbd>}
        </button>
      </div>
      {dictation.errorMessage && <p className="error-message">{dictation.errorMessage}</p>}
      {isSubmitting && <div className="grading-indicator" aria-label="Grading" />}
    </div>
  );
}
