import { TopicRepository } from "../server/topicRepository.ts";
import { TopicStatusReporter } from "../server/topicStatusReporter.ts";

/** `npm run status [-- --json]`: what's prepared, what's due, what's pending. */
const reporter = new TopicStatusReporter(new TopicRepository());
const statuses = reporter.reportAllTopics();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(statuses, null, 2));
} else if (statuses.length === 0) {
  console.log("No topics yet. Create one under topics/<topic-id>/ (see docs/SESSION-AUTHORING.md).");
} else {
  for (const status of statuses) {
    console.log(`\n■ ${status.title}  [${status.topicId}]  (${status.status})`);
    console.log(`  Completed sessions: ${status.completedSessionCount}` + (status.lastCompletedSession ? `  · last: ${status.lastCompletedSession.dirName}, ${status.lastCompletedSession.daysAgo} day(s) ago` : ""));
    if (status.nextSession) {
      const next = status.nextSession;
      const warnings = [
        !next.authoredAfterLastCompletion ? "authored BEFORE the last completed session. Check it still fits" : "",
        next.steeringNotesNewerThanDefinition ? "open steering notes are newer than this session" : "",
      ].filter(Boolean);
      console.log(`  Next session: ${next.dirName}: "${next.title}" (${next.kind}, ~${next.estimatedMinutes} min, ${next.state.replace("_", " ")})`);
      for (const warning of warnings) console.log(`    ⚠ ${warning}`);
    } else {
      console.log("  Next session: none prepared");
    }
    if (status.invalidSessionDirNames.length > 0) console.log(`  ⚠ Invalid session files: ${status.invalidSessionDirNames.join(", ")} (run npm run validate)`);
    console.log(`  Items: ${status.items.total} total · ${status.items.unstudied} unstudied · ${status.items.dueNow} due now · ${status.items.overdueByMoreThan3Days} overdue >3d · by stage ${JSON.stringify(status.items.countByStage)}`);
    console.log(`  Open steering notes: ${status.openSteeringNoteCount}`);
    if (status.preparationInProgress) console.log(`  Preparation running since ${status.preparationInProgress.startedAt} → ${status.preparationInProgress.logPath}`);
  }
  console.log("");
}
