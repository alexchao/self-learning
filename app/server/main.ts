import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { loadEnvironmentFileIfPresent, loadLearningConfig } from "./learningConfig.ts";
import { REPOSITORY_ROOT, sessionDirectory, WEB_DIST_DIRECTORY } from "./repositoryPaths.ts";
import { AccessGate } from "./accessGate.ts";
import { createLearningLlmClient } from "./learningLlmClientFactory.ts";
import { createPracticeDrillApiRoutes } from "./practiceDrillApiRoutes.ts";
import { createSessionApiRoutes } from "./sessionApiRoutes.ts";
import { TopicRepository } from "./topicRepository.ts";

loadEnvironmentFileIfPresent();
const config = loadLearningConfig();
const repository = new TopicRepository();
const llmClient = createLearningLlmClient(config);

const accessGate = new AccessGate(process.env.ACCESS_PASSPHRASE);

const app = new Hono();
// Unauthenticated liveness check for the host (Fly health checks).
app.get("/healthz", (context) => context.text("ok"));
app.route("/api", accessGate.createRoutes());
app.use("/api/*", accessGate.requireAccess());
app.use("/session-assets/*", accessGate.requireAccess());
app.route("/api", createSessionApiRoutes(repository, config, llmClient));
app.route("/api", createPracticeDrillApiRoutes(repository, config, llmClient));

// Session assets: /session-assets/<topic>/<session dir>/assets/<file>
app.get("/session-assets/:topicId/:sessionDirName/*", (context) => {
  const { topicId, sessionDirName } = context.req.param();
  const baseDirectory = sessionDirectory(topicId, sessionDirName);
  const relativeAssetPath = context.req.path.split(`/session-assets/${topicId}/${sessionDirName}/`)[1] ?? "";
  const absoluteAssetPath = path.resolve(baseDirectory, decodeURIComponent(relativeAssetPath));
  if (!absoluteAssetPath.startsWith(baseDirectory + path.sep) || !fs.existsSync(absoluteAssetPath)) {
    return context.notFound();
  }
  const extension = path.extname(absoluteAssetPath).toLowerCase();
  const contentTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
  return context.body(fs.readFileSync(absoluteAssetPath), 200, { "Content-Type": contentTypes[extension] ?? "application/octet-stream" });
});

const webRootRelativeToCwd = path.relative(process.cwd(), WEB_DIST_DIRECTORY) || ".";
app.use("/*", serveStatic({ root: webRootRelativeToCwd }));
// Single-page app fallback
app.get("*", (context) => {
  const indexPath = path.join(WEB_DIST_DIRECTORY, "index.html");
  if (!fs.existsSync(indexPath)) return context.text("Web app not built. Run `npm run learn`.", 503);
  return context.html(fs.readFileSync(indexPath, "utf8"));
});

// The cloud sets PORT/HOST (it must listen on 0.0.0.0); locally the config port and Node's default address apply.
const listeningPort = process.env.PORT ? Number(process.env.PORT) : config.port;
serve({ fetch: app.fetch, port: listeningPort, hostname: process.env.HOST }, (info) => {
  const gateDescription = accessGate.isEnabled() ? "passphrase gate on" : "no passphrase gate";
  console.log(`[self-learning] serving ${REPOSITORY_ROOT} at http://localhost:${info.port} (${gateDescription})`);
});
