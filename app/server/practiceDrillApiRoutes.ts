import { Hono } from "hono";
import { z } from "zod";
import type { PracticeDrillAttempt, PracticeDrillSet } from "../shared/practiceDrillSchema.ts";
import type { SessionResults } from "../shared/sessionResultsSchema.ts";
import { isFreeResponseStep } from "../shared/sessionSchema.ts";
import type { LearningConfig } from "./learningConfig.ts";
import type { LearningLlmClient } from "./learningLlmClient.ts";
import { PracticeDrillGenerator } from "./practiceDrillGenerator.ts";
import { PracticeDrillGrader } from "./practiceDrillGrader.ts";
import { resolvePracticeDrillCount } from "./practiceDrillPolicy.ts";
import type { TopicRepository } from "./topicRepository.ts";

const DrillAttemptRequestSchema = z.object({
  answer: z.string().min(1),
  inputMode: z.enum(["typed", "spoken", "mixed"]),
  timeSpentMs: z.number().int().min(0).default(0),
});

/**
 * Routes under /api/topics/:topicId/sessions/:sessionDirName/steps/:stepId/practice-drills
 * - POST ""                     → generate drills for the step (idempotent; returns [] when not applicable)
 * - POST "/skip"                → learner skipped the drills
 * - POST "/:drillId/attempts"   → grade an answer to one drill
 */
export function createPracticeDrillApiRoutes(repository: TopicRepository, config: LearningConfig, llmClient: LearningLlmClient): Hono {
  const api = new Hono();
  const generator = new PracticeDrillGenerator(config, llmClient);
  const grader = new PracticeDrillGrader(config, llmClient);
  const pendingGenerationsByStepKey = new Map<string, Promise<PracticeDrillSet>>();

  const readActiveResults = (topicId: string, sessionDirName: string): SessionResults => {
    const results = repository.readSessionResults(topicId, sessionDirName);
    if (!results || results.completedAt) throw new PracticeDrillHttpError(409, "Session is not in progress");
    return results;
  };

  const updateActiveResults = (topicId: string, sessionDirName: string, mutateResults: (results: SessionResults) => void) =>
    repository.updateSessionResults(topicId, sessionDirName, (currentResults) => {
      if (!currentResults || currentResults.completedAt) throw new PracticeDrillHttpError(409, "Session is not in progress");
      mutateResults(currentResults);
      return currentResults;
    });

  const generateAndPersistDrills = async (topicId: string, sessionDirName: string, stepId: string): Promise<PracticeDrillSet> => {
    const session = repository.readSessionDefinition(topicId, sessionDirName);
    const step = session.steps.find((candidate) => candidate.id === stepId);
    if (!step || !isFreeResponseStep(step)) throw new PracticeDrillHttpError(400, "Step does not support practice drills");
    const results = readActiveResults(topicId, sessionDirName);
    const stepResult = results.steps[stepId];
    if (stepResult?.practiceDrills) return stepResult.practiceDrills;
    const firstAttempt = stepResult?.attempts[0];
    if (!stepResult || !firstAttempt) throw new PracticeDrillHttpError(409, "Answer the step before practicing");

    const drillCount = resolvePracticeDrillCount(step, firstAttempt.grade.score, config);
    const latestAttemptIndex = stepResult.attempts.length - 1;
    const drills =
      drillCount === 0
        ? []
        : await generator.generateDrills({
            topicId,
            step,
            targetItems: repository.readLearningItemDeck(topicId).items.filter((item) => step.itemIds.includes(item.id)),
            attempt: stepResult.attempts[latestAttemptIndex]!,
            attemptIndex: latestAttemptIndex,
            drillCount,
          });

    const updatedResults = await updateActiveResults(topicId, sessionDirName, (latestResults) => {
      const latestStepResult = latestResults.steps[stepId] ?? { attempts: [], followUps: [] };
      latestStepResult.practiceDrills ??= { drills };
      latestResults.steps[stepId] = latestStepResult;
    });
    return updatedResults.steps[stepId]!.practiceDrills!;
  };

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/practice-drills", async (context) => {
    const { topicId, sessionDirName, stepId } = context.req.param();
    const stepKey = `${topicId}/${sessionDirName}/${stepId}`;
    let pendingGeneration = pendingGenerationsByStepKey.get(stepKey);
    if (!pendingGeneration) {
      pendingGeneration = generateAndPersistDrills(topicId, sessionDirName, stepId).finally(() => pendingGenerationsByStepKey.delete(stepKey));
      pendingGenerationsByStepKey.set(stepKey, pendingGeneration);
    }
    return context.json({ practiceDrills: await pendingGeneration });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/practice-drills/skip", async (context) => {
    const { topicId, sessionDirName, stepId } = context.req.param();
    const updatedResults = await updateActiveResults(topicId, sessionDirName, (latestResults) => {
      const drillSet = latestResults.steps[stepId]?.practiceDrills;
      if (!drillSet) throw new PracticeDrillHttpError(404, "No practice drills for this step");
      drillSet.skippedAt ??= new Date().toISOString();
    });
    return context.json({ practiceDrills: updatedResults.steps[stepId]!.practiceDrills });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/practice-drills/:drillId/attempts", async (context) => {
    const { topicId, sessionDirName, stepId, drillId } = context.req.param();
    const body = DrillAttemptRequestSchema.parse(await context.req.json());
    const session = repository.readSessionDefinition(topicId, sessionDirName);
    const step = session.steps.find((candidate) => candidate.id === stepId);
    const drill = readActiveResults(topicId, sessionDirName).steps[stepId]?.practiceDrills?.drills.find((candidate) => candidate.id === drillId);
    if (!step || !drill) throw new PracticeDrillHttpError(404, "No such practice drill");

    const grade = await grader.gradeDrillAnswer(topicId, drill, body.answer, body.inputMode, step.itemIds);
    const attempt: PracticeDrillAttempt = { ...body, submittedAt: new Date().toISOString(), grade };

    await updateActiveResults(topicId, sessionDirName, (latestResults) => {
      const latestDrill = latestResults.steps[stepId]?.practiceDrills?.drills.find((candidate) => candidate.id === drillId);
      if (!latestDrill) throw new PracticeDrillHttpError(404, "No such practice drill");
      latestDrill.attempts.push(attempt);
    });
    return context.json({ attempt });
  });

  api.onError((error, context) => {
    console.error(error);
    if (error instanceof PracticeDrillHttpError) return context.json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return context.json({ error: "Invalid request", details: error.issues }, 400);
    return context.json({ error: error.message }, 500);
  });

  return api;
}

class PracticeDrillHttpError extends Error {
  public constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
