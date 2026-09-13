import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { loadEnvironmentFileIfPresent, loadLearningConfig } from "./learningConfig.ts";
import { REPOSITORY_ROOT, sessionDirectory, WEB_DIST_DIRECTORY } from "./repositoryPaths.ts";
import { createSessionApiRoutes } from "./sessionApiRoutes.ts";
import { TopicRepository } from "./topicRepository.ts";

loadEnvironmentFileIfPresent();
const config = loadLearningConfig();
const repository = new TopicRepository();

const app = new Hono();
app.route("/api", createSessionApiRoutes(repository, config));

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

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[self-learning] serving ${REPOSITORY_ROOT} at http://localhost:${info.port}`);
});
