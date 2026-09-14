import fs from "node:fs";
import path from "node:path";
import { topicDirectory } from "./repositoryPaths.ts";

/** Reads topics/<topic>/grading.md for injection into grader, tutor, and drill prompts. */
export function readTopicGradingRubric(topicId: string): string {
  const rubricPath = path.join(topicDirectory(topicId), "grading.md");
  return fs.existsSync(rubricPath) ? `<topic_grading_rubric>\n${fs.readFileSync(rubricPath, "utf8")}\n</topic_grading_rubric>` : "(no topic-specific rubric)";
}
