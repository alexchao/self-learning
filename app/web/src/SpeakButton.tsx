import { isSpeechSynthesisSupported, speakText } from "./speechServices.ts";

export function SpeakButton({ text, language }: { text: string; language?: string }) {
  if (!isSpeechSynthesisSupported()) return null;
  return (
    <button type="button" className="speak-button" onClick={() => speakText(text, language)} aria-label="Listen" title="Listen">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
        <path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  );
}
