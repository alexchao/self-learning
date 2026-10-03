import fs from "node:fs";
import path from "node:path";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { CloudUpdateService } from "./cloudUpdateService.ts";
import type { GitSyncService } from "./gitSyncService.ts";
import { NextSessionPreparer } from "./nextSessionPreparer.ts";
import { preparationLogsDirectory, sessionDirectory, topicDirectory } from "./repositoryPaths.ts";
import type { TopicRepository } from "./topicRepository.ts";
import { TopicStatusReporter } from "./topicStatusReporter.ts";

const LOG_TAIL_LINE_COUNT = 40;

const SteeringRequestSchema = z.object({
  topicId: z.string().min(1),
  note: z.string().trim().min(1).max(5000),
  /** Discard the prepared-but-unstarted next session and prepare it again with this note. */
  reprepare: z.boolean().default(false),
});

/**
 * Operator endpoints for the laptop agent (`npm run cloud -- …`). Loopback only: in the cloud they're reached through
 * `fly ssh console` + curl inside the machine, so they're never exposed on the public URL and need no passphrase.
 * Mount before the passphrase gate.
 */
export function createAdminApiRoutes(repository: TopicRepository, gitSync: GitSyncService, cloudUpdate: CloudUpdateService): Hono {
  const admin = new Hono();
  const statusReporter = new TopicStatusReporter(repository);
  const preparer = new NextSessionPreparer();

  admin.use("/admin/*", requireLoopbackClient());

  admin.get("/admin/status", async (context) =>
    context.json({
      commit: await gitSync.currentCommit(),
      ...cloudUpdate.describeState(),
      topics: statusReporter.reportAllTopics(),
      latestPreparationLogs: Object.fromEntries(repository.listTopicIds().map((topicId) => [topicId, readLatestPreparationLog(topicId)])),
      gitSyncLogTail: gitSync.readLogTail(LOG_TAIL_LINE_COUNT),
    }),
  );

  admin.post("/admin/update", async (context) => context.json(await cloudUpdate.checkForUpdates("admin")));

  admin.post("/admin/steering", async (context) => {
    const request = SteeringRequestSchema.parse(await context.req.json());
    const topicStatus = statusReporter.reportTopic(request.topicId);
    if (topicStatus.preparationInProgress) {
      return context.json({ error: "Next-session prep is running for this topic; try again when it finishes." }, 409);
    }

    let sessionToReprepare: { dirName: string; afterSessionDirName: string } | null = null;
    if (request.reprepare) {
      const nextSession = topicStatus.nextSession;
      if (!nextSession || nextSession.state !== "not_started") {
        return context.json({ error: "There's no unstarted next session to prepare again." }, 409);
      }
      if (!topicStatus.lastCompletedSession) {
        return context.json({ error: "No completed session to prepare after." }, 409);
      }
      sessionToReprepare = { dirName: nextSession.dirName, afterSessionDirName: topicStatus.lastCompletedSession.dirName };
    }

    await appendSteeringNoteFromChat(repository, request.topicId, request.note);
    if (!sessionToReprepare) {
      const sync = await gitSync.syncLearningData(`Add steering note for ${request.topicId}`);
      return context.json({ noted: true, sync });
    }

    // The prep run commits both the note and the removal of the old session in its opening sync.
    fs.rmSync(sessionDirectory(request.topicId, sessionToReprepare.dirName), { recursive: true, force: true });
    const preparation = preparer.startPreparation(request.topicId, sessionToReprepare.afterSessionDirName);
    return context.json({ noted: true, discardedSession: sessionToReprepare.dirName, preparation });
  });

  admin.onError((error, context) => {
    if (error instanceof z.ZodError) return context.json({ error: "Invalid request", details: error.issues }, 400);
    console.error(error);
    return context.json({ error: error.message }, 500);
  });

  return admin;
}

/** Only connections from inside the machine (Fly's proxy and the private network never arrive from loopback). */
function requireLoopbackClient(): MiddlewareHandler {
  return async (context, next) => {
    const remoteAddress = getConnInfo(context).remote.address ?? "";
    const isLoopback = remoteAddress === "::1" || remoteAddress.startsWith("127.") || remoteAddress.startsWith("::ffff:127.");
    if (!isLoopback) return context.json({ error: "Not found" }, 404);
    return next();
  };
}

async function appendSteeringNoteFromChat(repository: TopicRepository, topicId: string, note: string): Promise<void> {
  const noteLines = note.split("\n").map((line, index) => (index === 0 || line.trim() === "" ? line.trim() : `  ${line.trim()}`));
  await repository.appendToMarkdownFile(
    path.join(topicDirectory(topicId), "steering.md"),
    `## ${new Date().toISOString().slice(0, 10)} · from chat\n- Note: ${noteLines.join("\n")}\n- Status: open\n`,
    "# Steering notes\n\nLearner's steering for upcoming sessions. Agents: when a note is acted on, change `Status: open` to `Status: addressed in <session dir>`.",
  );
}

function readLatestPreparationLog(topicId: string): { fileName: string; tail: string[] } | null {
  const logsDirectory = preparationLogsDirectory(topicId);
  if (!fs.existsSync(logsDirectory)) return null;
  const latestLogFileName = fs
    .readdirSync(logsDirectory)
    .filter((fileName) => fileName.endsWith(".log"))
    .sort()
    .at(-1);
  if (!latestLogFileName) return null;
  const lines = fs.readFileSync(path.join(logsDirectory, latestLogFileName), "utf8").trimEnd().split("\n");
  return { fileName: latestLogFileName, tail: lines.slice(-LOG_TAIL_LINE_COUNT) };
}
