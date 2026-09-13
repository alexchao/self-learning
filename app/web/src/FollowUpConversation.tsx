import { useState } from "react";
import type { FollowUpExchange } from "../../shared/sessionResultsSchema.ts";
import type { LearningApiClient } from "./apiClient.ts";
import { RichText } from "./RichText.tsx";

export function FollowUpConversation({
  stepId,
  apiClient,
  initialExchanges,
}: {
  stepId: string;
  apiClient: LearningApiClient;
  initialExchanges: FollowUpExchange[];
}) {
  const [exchanges, setExchanges] = useState<FollowUpExchange[]>(initialExchanges);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ask = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || pendingQuestion) return;
    setPendingQuestion(trimmedQuestion);
    setQuestion("");
    setErrorMessage(null);
    try {
      const exchange = await apiClient.askFollowUp(stepId, trimmedQuestion);
      setExchanges((previous) => [...previous, exchange]);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setQuestion(trimmedQuestion);
    } finally {
      setPendingQuestion(null);
    }
  };

  return (
    <div className="follow-up">
      {exchanges.map((exchange, index) => (
        <div key={index} className="follow-up-exchange">
          <p className="follow-up-question">{exchange.question}</p>
          <RichText text={exchange.answer} className="prose follow-up-answer" />
        </div>
      ))}
      {pendingQuestion && (
        <div className="follow-up-exchange">
          <p className="follow-up-question">{pendingQuestion}</p>
          <div className="grading-indicator" />
        </div>
      )}
      <div className="follow-up-input-row">
        <input
          className="text-input"
          value={question}
          placeholder="Ask a follow-up question about this…"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void ask();
            }
          }}
          disabled={pendingQuestion !== null}
        />
      </div>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </div>
  );
}
