import { spawnSync } from "node:child_process";
import { REPOSITORY_ROOT } from "../server/repositoryPaths.ts";
import { callCloudAdminEndpoint, printCloudStatus } from "./cloudAdminClient.ts";

/**
 * The laptop agent's handle on the cloud server (Fly app in fly.toml):
 *
 *   npm run cloud -- status                     topics, sync log, last lines of the latest prep log
 *   npm run cloud -- prep-log                   the latest prep log (last 40 lines) per topic
 *   npm run cloud -- update                     pull main now (it also polls every 2 min); restarts if code changed
 *   npm run cloud -- steer --topic <id> --note "<text>" [--reprepare]
 *                                               append a steering note (and optionally redo the unstarted next session)
 *   npm run cloud -- server-logs                recent server output (fly logs)
 */

const [subcommand, ...argumentsList] = process.argv.slice(2);
const readFlagValue = (flag: string): string | undefined => {
  const index = argumentsList.indexOf(flag);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};

switch (subcommand) {
  case "status":
    printCloudStatus();
    break;
  case "prep-log":
    printCloudStatus({ showPreparationLogs: true });
    break;
  case "update":
    console.log(JSON.stringify(callCloudAdminEndpoint("POST", "update"), null, 2));
    break;
  case "steer": {
    const topicId = readFlagValue("--topic");
    const note = readFlagValue("--note");
    if (!topicId || !note) {
      console.error('Usage: npm run cloud -- steer --topic <id> --note "<text>" [--reprepare]');
      process.exit(2);
    }
    const response = callCloudAdminEndpoint("POST", "steering", { topicId, note, reprepare: argumentsList.includes("--reprepare") });
    console.log(JSON.stringify(response, null, 2));
    break;
  }
  case "server-logs":
    spawnSync("fly", ["logs", "--no-tail"], { cwd: REPOSITORY_ROOT, stdio: "inherit" });
    break;
  default:
    console.error("Usage: npm run cloud -- <status | prep-log | update | steer | server-logs>  (see app/scripts/cloud.ts)");
    process.exit(2);
}
