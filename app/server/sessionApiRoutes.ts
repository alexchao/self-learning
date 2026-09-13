import { Hono } from "hono";
import { z } from "zod";
import type { LearningItem } from "../shared/learningItemSchema.ts";
import type { SessionResults, StepAttempt } from "../shared/sessionResultsSchema.ts";
import { isFreeResponseStep, type SessionStep } from "../shared/sessionSchema.ts";
import { AnswerGrader } from "./answerGrader.ts";
import { hasAnthropicCredentials, type LearningConfig } from "./learningConfig.ts";
import { NextSessionPreparer } from "./nextSessionPreparer.ts";
import { SessionCompletionService } from "./sessionCompletionService.ts";
import type { TopicRepository } from "./topicRepository.ts";
import { TopicStatusReporter } from "./topicStatusReporter.ts";
import { TutorFollowUpResponder } from "./tutorFollowUpResponder.ts";

const AttemptRequestSchema = z.object({
  answer: z.string(),
  inputMode: z.enum(["typed", "spoken", "mixed", "choice"]),
  hintsRevealed: z.number().int().min(0).default(0),
  timeSpentMs: z.number().int().min(0).default(0),
  selectedOptionIndex: z.number().int().min(0).optional(),
});

const DisputeRequestSchema = z.object({ learnerArgument: z.string().min(1) });
const FollowUpRequestSchema = z.object({ question: z.string().min(1) });
const CompleteSessionRequestSchema = z.object({
  difficulty: z.enum(["too_easy", "about_right", "too_hard"]).optional(),
  steeringNote: z.string().default(""),
  processFeedback: z.string().default(""),
});

export function createSessionApiRoutes(repository: TopicRepository, config: LearningConfig): Hono {
  const api = new Hono();
  const grader = new AnswerGrader(config);
  const tutor = new TutorFollowUpResponder(config);
  const completionService = new SessionCompletionService(repository);
  const statusReporter = new TopicStatusReporter(repository);
  const preparer = new NextSessionPreparer();

  const loadSessionContext = (topicId: string, sessionDirName: string) => {
    const session = repository.readSessionDefinition(topicId, sessionDirName);
    const deck = repository.readLearningItemDeck(topicId);
    return { session, deck };
  };

  const findStep = (steps: SessionStep[], stepId: string): SessionStep => {
    const step = steps.find((candidate) => candidate.id === stepId);
    if (!step) throw new HttpError(404, `No step ${stepId}`);
    return step;
  };

  const itemsForStep = (step: SessionStep, items: LearningItem[]): LearningItem[] =>
    step.itemIds.flatMap((itemId) => items.filter((item) => item.id === itemId));

  const requireStartedResults = (topicId: string, sessionDirName: string): SessionResults => {
    const results = repository.readSessionResults(topicId, sessionDirName);
    if (!results) throw new HttpError(409, "Session not started");
    if (results.completedAt) throw new HttpError(409, "Session already completed");
    return results;
  };

  api.get("/health", (context) => context.json({ ok: true, hasApiKey: hasAnthropicCredentials() }));

  api.get("/topics", (context) => context.json({ topics: statusReporter.reportAllTopics(), hasApiKey: hasAnthropicCredentials() }));

  api.get("/topics/:topicId/sessions/:sessionDirName", (context) => {
    const { topicId, sessionDirName } = context.req.param();
    const { session, deck } = loadSessionContext(topicId, sessionDirName);
    const referencedItemIds = new Set(session.steps.flatMap((step) => step.itemIds));
    return context.json({
      topic: repository.readTopic(topicId),
      session,
      results: repository.readSessionResults(topicId, sessionDirName),
      items: deck.items.filter((item) => referencedItemIds.has(item.id)),
      hasApiKey: hasAnthropicCredentials(),
    });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/start", async (context) => {
    const { topicId, sessionDirName } = context.req.param();
    repository.readSessionDefinition(topicId, sessionDirName);
    const existing = repository.readSessionResults(topicId, sessionDirName);
    if (existing) return context.json({ results: existing });
    const results: SessionResults = {
      schemaVersion: 1,
      sessionDirName,
      startedAt: new Date().toISOString(),
      steps: {},
      itemScheduleChanges: [],
    };
    await repository.writeSessionResults(topicId, sessionDirName, results);
    return context.json({ results });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/attempts", async (context) => {
    const { topicId, sessionDirName, stepId } = context.req.param();
    const body = AttemptRequestSchema.parse(await context.req.json());
    const { session, deck } = loadSessionContext(topicId, sessionDirName);
    const step = findStep(session.steps, stepId);
    const results = requireStartedResults(topicId, sessionDirName);
    const stepResult = results.steps[stepId] ?? { attempts: [], followUps: [] };

    let grade;
    if (step.type === "choice") {
      if (body.selectedOptionIndex === undefined) throw new HttpError(400, "selectedOptionIndex required");
      grade = grader.gradeChoice(step, body.selectedOptionIndex, stepResult.attempts.length === 0);
    } else if (isFreeResponseStep(step)) {
      if (!body.answer.trim()) throw new HttpError(400, "Empty answer");
      grade = await grader.gradeFreeResponse({
        topicId,
        step,
        targetItems: itemsForStep(step, deck.items),
        learnerAnswer: body.answer,
        hintsRevealed: body.hintsRevealed,
        inputMode: body.inputMode,
        previousAttemptsInThisStep: stepResult.attempts.map((attempt) => ({ answer: attempt.answer, score: attempt.grade.score })),
      });
    } else {
      throw new HttpError(400, `Step type ${step.type} does not accept attempts`);
    }

    const attempt: StepAttempt = {
      answer: body.answer,
      inputMode: body.inputMode,
      hintsRevealed: body.hintsRevealed,
      submittedAt: new Date().toISOString(),
      timeSpentMs: body.timeSpentMs,
      grade,
    };
    const latestResults = requireStartedResults(topicId, sessionDirName);
    const latestStepResult = latestResults.steps[stepId] ?? { attempts: [], followUps: [] };
    latestStepResult.attempts.push(attempt);
    latestResults.steps[stepId] = latestStepResult;
    await repository.writeSessionResults(topicId, sessionDirName, latestResults);
    return context.json({ attempt, attemptIndex: latestStepResult.attempts.length - 1 });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/attempts/:attemptIndex/dispute", async (context) => {
    const { topicId, sessionDirName, stepId, attemptIndex } = context.req.param();
    const { learnerArgument } = DisputeRequestSchema.parse(await context.req.json());
    const { session, deck } = loadSessionContext(topicId, sessionDirName);
    const step = findStep(session.steps, stepId);
    if (!isFreeResponseStep(step)) throw new HttpError(400, "Only free-response steps can be disputed");
    const results = requireStartedResults(topicId, sessionDirName);
    const stepResult = results.steps[stepId];
    const attempt = stepResult?.attempts[Number(attemptIndex)];
    if (!stepResult || !attempt) throw new HttpError(404, "No such attempt");
    if (attempt.dispute) throw new HttpError(409, "Attempt already disputed");

    const regrade = await grader.gradeFreeResponse({
      topicId,
      step,
      targetItems: itemsForStep(step, deck.items),
      learnerAnswer: attempt.answer,
      hintsRevealed: attempt.hintsRevealed,
      inputMode: attempt.inputMode,
      previousAttemptsInThisStep: [],
      dispute: { originalGrade: attempt.grade, learnerArgument },
    });

    const latestResults = requireStartedResults(topicId, sessionDirName);
    const latestAttempt = latestResults.steps[stepId]?.attempts[Number(attemptIndex)];
    if (!latestAttempt) throw new HttpError(404, "No such attempt");
    latestAttempt.dispute = {
      learnerArgument,
      disputedAt: new Date().toISOString(),
      originalGrade: latestAttempt.grade,
      upheldLearner: regrade.score > latestAttempt.grade.score,
    };
    latestAttempt.grade = regrade;
    await repository.writeSessionResults(topicId, sessionDirName, latestResults);
    return context.json({ attempt: latestAttempt });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/follow-ups", async (context) => {
    const { topicId, sessionDirName, stepId } = context.req.param();
    const { question } = FollowUpRequestSchema.parse(await context.req.json());
    const { session, deck } = loadSessionContext(topicId, sessionDirName);
    const step = findStep(session.steps, stepId);
    const results = requireStartedResults(topicId, sessionDirName);
    const stepResult = results.steps[stepId] ?? { attempts: [], followUps: [] };

    const answer = await tutor.answerFollowUp({ topicId, step, targetItems: itemsForStep(step, deck.items), stepResult, question });
    const exchange = { question, answer, askedAt: new Date().toISOString() };

    const latestResults = requireStartedResults(topicId, sessionDirName);
    const latestStepResult = latestResults.steps[stepId] ?? { attempts: [], followUps: [] };
    latestStepResult.followUps.push(exchange);
    latestResults.steps[stepId] = latestStepResult;
    await repository.writeSessionResults(topicId, sessionDirName, latestResults);
    return context.json({ exchange });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/steps/:stepId/complete", async (context) => {
    const { topicId, sessionDirName, stepId } = context.req.param();
    const { session } = loadSessionContext(topicId, sessionDirName);
    findStep(session.steps, stepId);
    const results = requireStartedResults(topicId, sessionDirName);
    const stepResult = results.steps[stepId] ?? { attempts: [], followUps: [] };
    stepResult.completedAt ??= new Date().toISOString();
    results.steps[stepId] = stepResult;
    await repository.writeSessionResults(topicId, sessionDirName, results);
    return context.json({ ok: true });
  });

  api.post("/topics/:topicId/sessions/:sessionDirName/complete", async (context) => {
    const { topicId, sessionDirName } = context.req.param();
    const feedback = CompleteSessionRequestSchema.parse(await context.req.json());
    let results = await completionService.completeSession(topicId, sessionDirName, feedback);

    if (config.autoPrepareNextSession && !results.nextSessionPreparation) {
      const preparation = preparer.startPreparation(topicId, sessionDirName);
      results = {
        ...results,
        nextSessionPreparation: {
          triggeredAt: new Date().toISOString(),
          logPath: "logPath" in preparation ? preparation.logPath : "",
          skippedReason: "skippedReason" in preparation ? preparation.skippedReason : undefined,
        },
      };
      await repository.writeSessionResults(topicId, sessionDirName, results);
    }
    return context.json({ results });
  });

  api.onError((error, context) => {
    console.error(error);
    if (error instanceof HttpError) return context.json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return context.json({ error: "Invalid request", details: error.issues }, 400);
    return context.json({ error: error.message }, 500);
  });

  return api;
}

class HttpError extends Error {
  public constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
