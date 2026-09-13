import { useState } from "react";
import type { TeachStep } from "../../../shared/sessionSchema.ts";
import { RichText } from "../RichText.tsx";
import { SpeakButton } from "../SpeakButton.tsx";

export function TeachStepView({
  step,
  speechLanguage,
  assetUrl,
  onContinue,
}: {
  step: TeachStep;
  speechLanguage?: string;
  assetUrl: (relativePath: string) => string;
  onContinue: () => void;
}) {
  const [isPinyinVisible, setIsPinyinVisible] = useState(false);
  const hasPinyin = step.examples.some((example) => example.pinyin);

  return (
    <section className="step step-teach">
      <p className="step-eyebrow">Learn</p>
      <h2 className="step-heading">{step.heading}</h2>
      {step.image && <img className="step-image" src={assetUrl(step.image.path)} alt={step.image.alt} />}
      <RichText text={step.body} className="prose" />
      {step.examples.length > 0 && (
        <ul className="example-list">
          {step.examples.map((example, index) => (
            <li key={index} className="example">
              <div className="example-chinese-row">
                <span className="chinese example-chinese">{example.chinese}</span>
                <SpeakButton text={example.chinese} language={speechLanguage} />
              </div>
              {isPinyinVisible && example.pinyin && <div className="example-pinyin">{example.pinyin}</div>}
              <div className="example-english">{example.english}</div>
              {example.note && <div className="example-note">{example.note}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="step-actions">
        {hasPinyin && (
          <button type="button" className="button-quiet" onClick={() => setIsPinyinVisible((visible) => !visible)}>
            {isPinyinVisible ? "Hide pinyin" : "Show pinyin"}
          </button>
        )}
        <button type="button" className="button-primary" onClick={onContinue} autoFocus>
          Continue
        </button>
      </div>
    </section>
  );
}
