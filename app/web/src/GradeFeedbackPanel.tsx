import { useState } from "react";
import { SCORE_LABELS } from "../../shared/gradingSchema.ts";
import type { StepAttempt } from "../../shared/sessionResultsSchema.ts";
import { diffCharacters } from "./characterDiff.ts";
import { RichText } from "./RichText.tsx";
import { SpeakButton } from "./SpeakButton.tsx";

const SCORE_SEAL_CHARACTERS: Record<number, string> = { 0: "無", 1: "弱", 2: "可", 3: "良", 4: "優" };

export function ScoreSeal({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  return (
    <span className={`score-seal score-seal-${size} score-${score}`} title={`${score}/4 · ${SCORE_LABELS[score]}`}>
      <span className="chinese">{SCORE_SEAL_CHARACTERS[score]}</span>
    </span>
  );
}

export function GradeFeedbackPanel({
  attempt,
  answerPrefix,
  speechLanguage,
}: {
  attempt: StepAttempt;
  /** For cloze steps, the learner answer is only the blank; we diff the whole sentence. */
  answerPrefix?: { before: string; after: string };
  speechLanguage?: string;
}) {
  const { grade } = attempt;
  const [areAllIssuesVisible, setAreAllIssuesVisible] = useState(false);
  const learnerFullAnswer = answerPrefix ? `${answerPrefix.before}${attempt.answer.trim()}${answerPrefix.after}` : attempt.answer.trim();
  const correctedAnswer = grade.correctedLearnerAnswer.trim();
  // Punctuation-only differences (e.g. a trailing 。) aren't worth showing as a correction.
  const needsCorrection = correctedAnswer.length > 0 && stripPunctuationAndSpace(correctedAnswer) !== stripPunctuationAndSpace(learnerFullAnswer);
  const diffSegments = needsCorrection ? diffCharacters(learnerFullAnswer, correctedAnswer) : [];
  const visibleIssues = areAllIssuesVisible ? grade.issues : grade.issues.slice(0, 3);

  return (
    <div className="feedback" aria-live="polite">
      <div className="feedback-verdict">
        <ScoreSeal score={grade.score} />
        <div>
          <p className="feedback-score-label">
            {SCORE_LABELS[grade.score]}
            {attempt.dispute && <span className="feedback-dispute-tag">{attempt.dispute.upheldLearner ? "revised after your challenge" : "reviewed after your challenge"}</span>}
          </p>
          <p className="feedback-headline">{grade.headline}</p>
        </div>
      </div>

      {needsCorrection && (
        <div className="feedback-block">
          <p className="feedback-label">Your answer, corrected</p>
          <p className="chinese diff-line">
            {diffSegments.map((segment, index) => (
              <span key={index} className={`diff-${segment.kind}`}>
                {segment.text}
              </span>
            ))}
          </p>
        </div>
      )}

      {grade.issues.length > 0 && (
        <div className="feedback-block">
          <ul className="issue-list">
            {visibleIssues.map((issue, index) => (
              <li key={index} className="issue">
                <span className="chinese issue-excerpt">{issue.learnerExcerpt}</span>
                <span className="issue-arrow">→</span>
                <span className="chinese issue-suggestion">{issue.suggestion}</span>
                <p className="issue-problem">{issue.problem}</p>
              </li>
            ))}
          </ul>
          {grade.issues.length > 3 && !areAllIssuesVisible && (
            <button type="button" className="button-link" onClick={() => setAreAllIssuesVisible(true)}>
              {grade.issues.length - 3} more
            </button>
          )}
        </div>
      )}

      {grade.explanation && <RichText text={grade.explanation} className="prose feedback-explanation" />}

      {grade.strengths.length > 0 && (
        <p className="feedback-strengths">
          <span className="feedback-label-inline">Good: </span>
          {grade.strengths.join(" · ")}
        </p>
      )}

      {grade.modelAnswers.length > 0 && (
        <div className="feedback-block">
          <p className="feedback-label">{grade.modelAnswers.length > 1 ? "Natural ways to say it" : "A natural way to say it"}</p>
          <ul className="model-answer-list">
            {grade.modelAnswers.map((modelAnswer, index) => (
              <li key={index} className="model-answer">
                <div className="example-chinese-row">
                  <span className="chinese model-answer-text">{modelAnswer.chinese}</span>
                  <SpeakButton text={modelAnswer.chinese} language={speechLanguage} />
                </div>
                {modelAnswer.note && <p className="model-answer-note">{modelAnswer.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function stripPunctuationAndSpace(text: string): string {
  return text.replace(/[\s\p{P}]/gu, "");
}
