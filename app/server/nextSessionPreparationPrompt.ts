/** The prompt and tool allowlist for headless next-session preparation (see app/scripts/prepareNextSession.ts). */

export const NEXT_SESSION_PREPARATION_ALLOWED_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash(npm run validate:*)",
  "Bash(npm run status:*)",
  "Bash(ls:*)",
  "Bash(mkdir:*)",
];

export function buildNextSessionPreparationPrompt(topicId: string, completedSessionDirName: string): string {
  return [
    `Prepare the next learning session for topic "${topicId}". The learner just completed "${completedSessionDirName}".`,
    "Follow the 'Preparing the next session' checklist in docs/SESSION-AUTHORING.md exactly (read docs/SYSTEM.md first).",
    "This is a headless background run: do not launch the server or browser, and do not ask questions. Make reasonable decisions and record them in authorRationale.",
    "Use the Read, Glob, and Grep tools to inspect files. Shell access is limited to `npm run status`, `npm run validate`, `ls`, and `mkdir`, and compound shell commands are rejected.",
    "Finish by running `npm run validate` on the new session and fixing any errors.",
  ].join("\n");
}
