import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { LearningItemDeckSchema, type LearningItemDeck } from "../shared/learningItemSchema.ts";
import { SessionResultsSchema, type SessionResults } from "../shared/sessionResultsSchema.ts";
import { SessionDefinitionSchema, type SessionDefinition } from "../shared/sessionSchema.ts";
import { TopicDefinitionSchema, type TopicDefinition } from "../shared/topicSchema.ts";
import { sessionDirectory, sessionsDirectory, topicDirectory, TOPICS_DIRECTORY } from "./repositoryPaths.ts";

/**
 * All reads and writes of topic state on disk go through here.
 * Writes are serialized per file and atomic (write temp file, then rename).
 */
export class TopicRepository {
  private readonly pendingWritesByFilePath = new Map<string, Promise<void>>();

  public listTopicIds(): string[] {
    if (!fs.existsSync(TOPICS_DIRECTORY)) return [];
    return fs
      .readdirSync(TOPICS_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(TOPICS_DIRECTORY, entry.name, "topic.json")))
      .map((entry) => entry.name)
      .sort();
  }

  public readTopic(topicId: string): TopicDefinition {
    return TopicDefinitionSchema.parse(this.readJsonFile(path.join(topicDirectory(topicId), "topic.json")));
  }

  /** Session directory names, sorted ascending (they are prefixed with a zero-padded number). */
  public listSessionDirNames(topicId: string): string[] {
    const directory = sessionsDirectory(topicId);
    if (!fs.existsSync(directory)) return [];
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}-/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  public sessionDefinitionExists(topicId: string, sessionDirName: string): boolean {
    return fs.existsSync(path.join(sessionDirectory(topicId, sessionDirName), "session.json"));
  }

  public readSessionDefinition(topicId: string, sessionDirName: string): SessionDefinition {
    return SessionDefinitionSchema.parse(this.readJsonFile(path.join(sessionDirectory(topicId, sessionDirName), "session.json")));
  }

  public readSessionDefinitionFileModifiedAt(topicId: string, sessionDirName: string): Date {
    return fs.statSync(path.join(sessionDirectory(topicId, sessionDirName), "session.json")).mtime;
  }

  public readSessionResults(topicId: string, sessionDirName: string): SessionResults | null {
    const filePath = path.join(sessionDirectory(topicId, sessionDirName), "results.json");
    if (!fs.existsSync(filePath)) return null;
    return SessionResultsSchema.parse(this.readJsonFile(filePath));
  }

  public async writeSessionResults(topicId: string, sessionDirName: string, results: SessionResults): Promise<void> {
    const filePath = path.join(sessionDirectory(topicId, sessionDirName), "results.json");
    await this.writeJsonFileAtomically(filePath, SessionResultsSchema.parse(results));
  }

  public readLearningItemDeck(topicId: string): LearningItemDeck {
    const filePath = path.join(topicDirectory(topicId), "items.json");
    if (!fs.existsSync(filePath)) return { schemaVersion: 1, items: [] };
    return LearningItemDeckSchema.parse(this.readJsonFile(filePath));
  }

  public async writeLearningItemDeck(topicId: string, deck: LearningItemDeck): Promise<void> {
    await this.writeJsonFileAtomically(path.join(topicDirectory(topicId), "items.json"), LearningItemDeckSchema.parse(deck));
  }

  public async appendToMarkdownFile(filePath: string, markdown: string, headerIfNew: string): Promise<void> {
    await this.serializeWrite(filePath, async () => {
      const exists = fs.existsSync(filePath);
      await fsPromises.appendFile(filePath, exists ? `\n${markdown}` : `${headerIfNew}\n\n${markdown}`, "utf8");
    });
  }

  private readJsonFile(filePath: string): unknown {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  private async writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
    await this.serializeWrite(filePath, async () => {
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      await fsPromises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await fsPromises.rename(temporaryPath, filePath);
    });
  }

  private async serializeWrite(filePath: string, writeOperation: () => Promise<void>): Promise<void> {
    const previousWrite = this.pendingWritesByFilePath.get(filePath) ?? Promise.resolve();
    const nextWrite = previousWrite.catch(() => undefined).then(writeOperation);
    this.pendingWritesByFilePath.set(filePath, nextWrite);
    try {
      await nextWrite;
    } finally {
      if (this.pendingWritesByFilePath.get(filePath) === nextWrite) {
        this.pendingWritesByFilePath.delete(filePath);
      }
    }
  }
}
