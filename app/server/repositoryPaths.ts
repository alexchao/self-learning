import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const REPOSITORY_ROOT = path.resolve(currentDirectory, "..", "..");
export const TOPICS_DIRECTORY = path.join(REPOSITORY_ROOT, "topics");
export const DOCS_DIRECTORY = path.join(REPOSITORY_ROOT, "docs");
export const RUNTIME_DIRECTORY = path.join(REPOSITORY_ROOT, ".runtime");
export const WEB_DIST_DIRECTORY = path.join(REPOSITORY_ROOT, "app", "web", "dist");
export const WEB_SOURCE_DIRECTORY = path.join(REPOSITORY_ROOT, "app", "web");
export const SHARED_SOURCE_DIRECTORY = path.join(REPOSITORY_ROOT, "app", "shared");
export const CONFIG_FILE_PATH = path.join(REPOSITORY_ROOT, "learning.config.json");
export const ENV_FILE_PATH = path.join(REPOSITORY_ROOT, ".env");
export const PROCESS_FEEDBACK_FILE_PATH = path.join(DOCS_DIRECTORY, "process-feedback.md");

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Guards against path traversal from URL parameters. */
export function assertSafePathSegment(segment: string): string {
  if (!SAFE_PATH_SEGMENT.test(segment) || segment.includes("..")) {
    throw new Error(`Unsafe path segment: ${segment}`);
  }
  return segment;
}

export function topicDirectory(topicId: string): string {
  return path.join(TOPICS_DIRECTORY, assertSafePathSegment(topicId));
}

export function sessionsDirectory(topicId: string): string {
  return path.join(topicDirectory(topicId), "sessions");
}

export function sessionDirectory(topicId: string, sessionDirName: string): string {
  return path.join(sessionsDirectory(topicId), assertSafePathSegment(sessionDirName));
}

export function preparationLogsDirectory(topicId: string): string {
  return path.join(topicDirectory(topicId), ".prep");
}
