import { Fragment, type ReactNode } from "react";

/** Minimal safe renderer: blank-line paragraphs, single newlines as breaks, **bold**. No HTML injection. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.trim().split(/\n\s*\n/);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderBold(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function renderBold(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>,
  );
}
