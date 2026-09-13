import type { FreeResponseStep } from "../../../shared/sessionSchema.ts";
import { RichText } from "../RichText.tsx";
import { SpeakButton } from "../SpeakButton.tsx";

const EYEBROW_BY_TYPE: Record<FreeResponseStep["type"], string> = {
  cloze: "Fill the gap",
  translate: "Say it in Chinese",
  rewrite: "Rewrite",
  respond: "Respond",
  free_production: "Express",
};

/** The prompt portion of a free-response step. The answer box lives in FreeResponseStepView. */
export function FreeResponsePromptView({
  step,
  speechLanguage,
  assetUrl,
}: {
  step: FreeResponseStep;
  speechLanguage?: string;
  assetUrl: (relativePath: string) => string;
}) {
  return (
    <>
      <p className="step-eyebrow">{EYEBROW_BY_TYPE[step.type]}</p>
      {step.image && <img className="step-image" src={assetUrl(step.image.path)} alt={step.image.alt} />}
      {step.type === "cloze" && (
        <>
          <p className="chinese cloze-sentence">
            {step.sentenceWithBlank.split("___")[0]}
            <span className="cloze-blank" aria-label="blank" />
            {step.sentenceWithBlank.split("___")[1]}
          </p>
          <p className="step-gloss">{step.englishMeaning}</p>
        </>
      )}
      {step.type === "translate" && (
        <>
          {step.context && <p className="step-context-label">{step.context}</p>}
          <p className="english-source">{step.english}</p>
        </>
      )}
      {step.type === "rewrite" && (
        <>
          <RichText text={step.instruction} className="step-prompt" />
          <div className="source-text">
            <span className="chinese">{step.sourceText}</span>
            <SpeakButton text={step.sourceText} language={speechLanguage} />
          </div>
        </>
      )}
      {step.type === "respond" && (
        <>
          <RichText text={step.scenario} className="step-context" />
          <div className="dialogue">
            {step.dialogue.map((line, index) => (
              <div key={index} className="dialogue-line">
                <span className="dialogue-speaker">{line.speaker}</span>
                <div>
                  <div className="example-chinese-row">
                    <span className="chinese dialogue-chinese">{line.chinese}</span>
                    <SpeakButton text={line.chinese} language={speechLanguage} />
                  </div>
                  {line.english && <p className="dialogue-english">{line.english}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="step-task">{step.task}</p>
        </>
      )}
      {step.type === "free_production" && (
        <>
          <RichText text={step.prompt} className="step-prompt" />
          {step.lengthGuidance && <p className="step-context-label">{step.lengthGuidance}</p>}
        </>
      )}
    </>
  );
}
