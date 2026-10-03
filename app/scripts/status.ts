import { TopicRepository } from "../server/topicRepository.ts";
import { TopicStatusReporter } from "../server/topicStatusReporter.ts";
import { printTopicStatuses } from "./topicStatusPrinter.ts";

/** `npm run status [-- --json | --remote]`: what's prepared, what's due, what's pending. `--remote` asks the cloud server. */
if (process.argv.includes("--remote")) {
  const { printCloudStatus } = await import("./cloudAdminClient.ts");
  printCloudStatus();
} else {
  const statuses = new TopicStatusReporter(new TopicRepository()).reportAllTopics();
  if (process.argv.includes("--json")) console.log(JSON.stringify(statuses, null, 2));
  else printTopicStatuses(statuses);
}
