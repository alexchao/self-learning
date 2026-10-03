/** One-off check: grade the same recorded answers with both LLM backends and compare score + latency. */
import { AnswerGrader } from "../server/answerGrader.ts";
import { AnthropicApiLlmClient } from "../server/anthropicApiLlmClient.ts";
import { ClaudeCliLlmClient } from "../server/claudeCliLlmClient.ts";
import { loadEnvironmentFileIfPresent, loadLearningConfig } from "../server/learningConfig.ts";
import { TopicRepository } from "../server/topicRepository.ts";
import { isFreeResponseStep } from "../shared/sessionSchema.ts";

const [topicId = "zh-tw-expressiveness", sessionDirName = "0004-how-big-is-the-claim"] = process.argv.slice(2);
loadEnvironmentFileIfPresent();
const config = loadLearningConfig();
const repository = new TopicRepository();
const session = repository.readSessionDefinition(topicId, sessionDirName);
const results = repository.readSessionResults(topicId, sessionDirName);
const deck = repository.readLearningItemDeck(topicId);
const backends = { "claude-cli": new AnswerGrader(config, new ClaudeCliLlmClient(config.claudeExecutable)), "anthropic-api": new AnswerGrader(config, new AnthropicApiLlmClient()) };

for (const step of session.steps) {
  if (!isFreeResponseStep(step) || step.type === "cloze") continue;
  const attempt = results?.steps[step.id]?.attempts[0];
  if (!attempt) continue;
  const line = [`${step.id} (recorded ${attempt.grade.score})`];
  await Promise.all(
    Object.entries(backends).map(async ([backendName, grader]) => {
      const startedAtMs = Date.now();
      const grade = await grader.gradeFreeResponse({
        topicId, step, targetItems: deck.items.filter((item) => step.itemIds.includes(item.id)),
        learnerAnswer: attempt.answer, hintsRevealed: attempt.hintsRevealed, inputMode: attempt.inputMode, previousAttemptsInThisStep: [],
      });
      line.push(`${backendName}: ${grade.score} in ${((Date.now() - startedAtMs) / 1000).toFixed(1)}s (${grade.model}) "${grade.headline}"`);
    }),
  );
  console.log(line.join("\n  "));
}
