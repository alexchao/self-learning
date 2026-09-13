import type { LearningItem } from "../shared/learningItemSchema.ts";
import type { SessionStep } from "../shared/sessionSchema.ts";

const STAGE_NAMES: Record<number, string> = {
  1: "Recognize",
  2: "Cued recall",
  3: "Guided production",
  4: "Translation",
  5: "Contextual use",
  6: "Free production",
};

/** Renders a step (and its target items) as plain text for LLM grader/tutor prompts. */
export function describeStepForModel(step: SessionStep, targetItems: LearningItem[]): string {
  const lines: string[] = [`Exercise type: ${step.type}`];
  if (step.stage) lines.push(`Bloom stage: ${step.stage} (${STAGE_NAMES[step.stage]})`);

  switch (step.type) {
    case "teach":
      lines.push(`Heading: ${step.heading}`, `Body: ${step.body}`);
      for (const example of step.examples) lines.push(`Example: ${example.chinese} = ${example.english}`);
      break;
    case "choice":
      lines.push(`Prompt: ${step.prompt}`);
      if (step.context) lines.push(`Context: ${step.context}`);
      step.options.forEach((option, index) =>
        lines.push(`Option ${index + 1}${option.isCorrect ? " (correct)" : ""}: ${option.text}. ${option.explanation}`),
      );
      break;
    case "cloze":
      lines.push(
        `Fill the blank: ${step.sentenceWithBlank}`,
        `Meaning: ${step.englishMeaning}`,
        `Expected fills: ${step.acceptableFills.join(" / ")}`,
        "The learner's answer is only the text for the blank. For correctedLearnerAnswer, return the FULL sentence with the (corrected) blank filled in.",
      );
      break;
    case "translate":
      lines.push(`Translate into spoken Taiwanese Mandarin: ${step.english}`);
      if (step.context) lines.push(`Context: ${step.context}`);
      break;
    case "rewrite":
      lines.push(`Instruction: ${step.instruction}`, `Source text: ${step.sourceText}`);
      break;
    case "respond":
      lines.push(`Scenario: ${step.scenario}`);
      for (const line of step.dialogue) lines.push(`${line.speaker}: ${line.chinese}${line.english ? ` (${line.english})` : ""}`);
      lines.push(`Learner's task: ${step.task}`);
      break;
    case "free_production":
      lines.push(`Prompt: ${step.prompt}`);
      if (step.lengthGuidance) lines.push(`Length guidance: ${step.lengthGuidance}`);
      break;
  }

  if (step.type !== "teach" && step.type !== "choice") {
    lines.push(`Reference answers (not exhaustive): ${step.referenceAnswers.join(" | ")}`);
    if (step.hints.length > 0) lines.push(`Available hints: ${step.hints.join(" | ")}`);
    if (step.gradingNotes) lines.push(`Grading notes from the session author: ${step.gradingNotes}`);
  }

  if (targetItems.length > 0) {
    lines.push("", "Target learning items for this exercise:");
    for (const item of targetItems) {
      lines.push(`- id "${item.id}": ${item.headword}${item.pinyin ? ` (${item.pinyin})` : ""}: ${item.gloss}. ${item.explanation}`);
    }
  }

  return lines.join("\n");
}
