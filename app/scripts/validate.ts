import fs from "node:fs";
import path from "node:path";
import { LearningItemDeckSchema } from "../shared/learningItemSchema.ts";
import { SessionDefinitionSchema } from "../shared/sessionSchema.ts";
import { TopicDefinitionSchema } from "../shared/topicSchema.ts";
import { REPOSITORY_ROOT, TOPICS_DIRECTORY } from "../server/repositoryPaths.ts";

/**
 * `npm run validate [-- <path to session.json or topic dir>]`
 * Validates topic.json, items.json, and session.json files (all topics if no path given),
 * including cross-references: every step itemId must exist in the topic's items.json,
 * and referenced images must exist on disk.
 */

const problems: string[] = [];
let checkedFileCount = 0;

function formatZodIssues(filePath: string, issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => `${path.relative(REPOSITORY_ROOT, filePath)}: ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    problems.push(`${path.relative(REPOSITORY_ROOT, filePath)}: invalid JSON: ${(error as Error).message}`);
    return undefined;
  }
}

function validateSessionFile(sessionFilePath: string, knownItemIds: Set<string>): void {
  checkedFileCount += 1;
  const json = readJson(sessionFilePath);
  if (json === undefined) return;
  const parsed = SessionDefinitionSchema.safeParse(json);
  if (!parsed.success) {
    problems.push(...formatZodIssues(sessionFilePath, parsed.error.issues));
    return;
  }
  const sessionDirectoryPath = path.dirname(sessionFilePath);
  const expectedNumber = Number(path.basename(sessionDirectoryPath).slice(0, 4));
  if (parsed.data.sessionNumber !== expectedNumber) {
    problems.push(`${path.relative(REPOSITORY_ROOT, sessionFilePath)}: sessionNumber ${parsed.data.sessionNumber} does not match directory prefix ${expectedNumber}`);
  }
  const imagePaths = [parsed.data.intro?.image?.path, ...parsed.data.steps.map((step) => ("image" in step ? step.image?.path : undefined))];
  for (const imagePath of imagePaths) {
    if (imagePath && !fs.existsSync(path.join(sessionDirectoryPath, imagePath))) {
      problems.push(`${path.relative(REPOSITORY_ROOT, sessionFilePath)}: image not found: ${imagePath}`);
    }
  }
  for (const step of parsed.data.steps) {
    for (const itemId of step.itemIds) {
      if (!knownItemIds.has(itemId)) problems.push(`${path.relative(REPOSITORY_ROOT, sessionFilePath)}: step "${step.id}" references unknown item "${itemId}"`);
    }
    if (step.type !== "teach" && step.itemIds.length > 0 && !step.stage) {
      problems.push(`${path.relative(REPOSITORY_ROOT, sessionFilePath)}: step "${step.id}" targets items but has no stage`);
    }
  }
}

function validateTopicDirectory(topicDirectoryPath: string, onlySessionFilePath?: string): void {
  const topicFilePath = path.join(topicDirectoryPath, "topic.json");
  checkedFileCount += 1;
  const topicJson = readJson(topicFilePath);
  if (topicJson !== undefined) {
    const parsedTopic = TopicDefinitionSchema.safeParse(topicJson);
    if (!parsedTopic.success) problems.push(...formatZodIssues(topicFilePath, parsedTopic.error.issues));
  }

  const knownItemIds = new Set<string>();
  const itemsFilePath = path.join(topicDirectoryPath, "items.json");
  if (fs.existsSync(itemsFilePath)) {
    checkedFileCount += 1;
    const itemsJson = readJson(itemsFilePath);
    const parsedDeck = itemsJson === undefined ? undefined : LearningItemDeckSchema.safeParse(itemsJson);
    if (parsedDeck && !parsedDeck.success) problems.push(...formatZodIssues(itemsFilePath, parsedDeck.error.issues));
    if (parsedDeck?.success) {
      for (const item of parsedDeck.data.items) {
        if (knownItemIds.has(item.id)) problems.push(`${path.relative(REPOSITORY_ROOT, itemsFilePath)}: duplicate item id "${item.id}"`);
        knownItemIds.add(item.id);
      }
    }
  }

  if (onlySessionFilePath) {
    validateSessionFile(onlySessionFilePath, knownItemIds);
    return;
  }
  const sessionsDirectoryPath = path.join(topicDirectoryPath, "sessions");
  if (!fs.existsSync(sessionsDirectoryPath)) return;
  for (const entry of fs.readdirSync(sessionsDirectoryPath).sort()) {
    const sessionFilePath = path.join(sessionsDirectoryPath, entry, "session.json");
    if (fs.existsSync(sessionFilePath)) validateSessionFile(sessionFilePath, knownItemIds);
  }
}

const targetArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
if (targetArgument) {
  const absoluteTarget = path.resolve(targetArgument);
  if (absoluteTarget.endsWith("session.json")) {
    validateTopicDirectory(path.resolve(path.dirname(absoluteTarget), "..", ".."), absoluteTarget);
  } else {
    validateTopicDirectory(absoluteTarget);
  }
} else if (fs.existsSync(TOPICS_DIRECTORY)) {
  for (const entry of fs.readdirSync(TOPICS_DIRECTORY).sort()) {
    if (fs.existsSync(path.join(TOPICS_DIRECTORY, entry, "topic.json"))) validateTopicDirectory(path.join(TOPICS_DIRECTORY, entry));
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s) in ${checkedFileCount} file(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`✓ ${checkedFileCount} file(s) valid`);
