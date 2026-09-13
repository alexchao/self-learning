import { useCallback, useEffect, useMemo, useState } from "react";
import { isFreeResponseStep } from "../../shared/sessionSchema.ts";
import { LearningApiClient, type SessionPayload } from "./apiClient.ts";
import { RichText } from "./RichText.tsx";
import { SessionSummaryView } from "./SessionSummaryView.tsx";
import { ChoiceStepView } from "./steps/ChoiceStepView.tsx";
import { FreeResponseStepView } from "./steps/FreeResponseStepView.tsx";
import { TeachStepView } from "./steps/TeachStepView.tsx";

export function SessionPlayer({ topicId, sessionDirName }: { topicId: string; sessionDirName: string }) {
  const apiClient = useMemo(() => new LearningApiClient(topicId, sessionDirName), [topicId, sessionDirName]);
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadPayload = useCallback(async () => {
    const freshPayload = await apiClient.fetchSession();
    setPayload(freshPayload);
    return freshPayload;
  }, [apiClient]);

  useEffect(() => {
    reloadPayload()
      .then((freshPayload) => {
        document.title = `${freshPayload.session.title} · ${freshPayload.topic.title}`;
        if (!freshPayload.results) return;
        const firstIncompleteIndex = freshPayload.session.steps.findIndex((step) => !freshPayload.results?.steps[step.id]?.completedAt);
        setCurrentStepIndex(firstIncompleteIndex === -1 ? freshPayload.session.steps.length : firstIncompleteIndex);
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, [reloadPayload]);

  const beginSession = async () => {
    try {
      await apiClient.startSession();
      await reloadPayload();
      setCurrentStepIndex(0);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const advance = useCallback(async () => {
    if (!payload || currentStepIndex === null) return;
    const step = payload.session.steps[currentStepIndex];
    try {
      if (step) await apiClient.markStepComplete(step.id);
      await reloadPayload();
      setCurrentStepIndex(currentStepIndex + 1);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }, [apiClient, currentStepIndex, payload, reloadPayload]);

  if (errorMessage && !payload) return <CenteredMessage title="Couldn't load this session" body={errorMessage} />;
  if (!payload) return <div className="page-loading" />;

  const { session, topic, results } = payload;
  const totalSteps = session.steps.length;
  const isCompleted = Boolean(results?.completedAt);
  const assetUrl = (relativePath: string) => apiClient.assetUrl(relativePath);
  const needsApiKey = session.steps.some(isFreeResponseStep) && !payload.hasApiKey;

  return (
    <div className="page">
      <header className="top-bar">
        <a className="top-bar-topic" href="/">
          {topic.title}
        </a>
        <div className="progress-rail" aria-label={`Step ${Math.min((currentStepIndex ?? 0) + 1, totalSteps)} of ${totalSteps}`}>
          {session.steps.map((step, index) => (
            <span
              key={step.id}
              className={`progress-segment ${currentStepIndex !== null && index < currentStepIndex ? "is-done" : ""} ${index === currentStepIndex ? "is-current" : ""}`}
            />
          ))}
        </div>
      </header>

      <main className="column">
        {needsApiKey && (
          <p className="notice">
            Grading needs an Anthropic API key. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> in the project root, then run <code>npm run learn -- --restart</code>.
          </p>
        )}
        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {currentStepIndex === null && (
          <section className="step session-intro">
            <p className="step-eyebrow">
              Session {session.sessionNumber} · about {session.estimatedMinutes} minutes
            </p>
            <h1 className="session-title">{session.title}</h1>
            {session.subtitle && <p className="session-subtitle">{session.subtitle}</p>}
            {session.intro?.image && <img className="step-image" src={assetUrl(session.intro.image.path)} alt={session.intro.image.alt} />}
            {session.intro && (
              <>
                <h2 className="step-heading-small">{session.intro.heading}</h2>
                <RichText text={session.intro.body} className="prose" />
              </>
            )}
            <div className="step-actions">
              <button type="button" className="button-primary" onClick={() => void beginSession()} autoFocus>
                Begin
              </button>
            </div>
          </section>
        )}

        {currentStepIndex !== null && currentStepIndex < totalSteps && renderStep(currentStepIndex)}

        {currentStepIndex !== null && currentStepIndex >= totalSteps && (
          <SessionSummaryView payload={payload} apiClient={apiClient} isCompleted={isCompleted} onCompleted={() => void reloadPayload()} />
        )}
      </main>
    </div>
  );

  function renderStep(stepIndex: number) {
    const step = session.steps[stepIndex]!;
    const stepResult = results?.steps[step.id];
    switch (step.type) {
      case "teach":
        return <TeachStepView key={step.id} step={step} speechLanguage={topic.speechLanguage} assetUrl={assetUrl} onContinue={() => void advance()} />;
      case "choice":
        return <ChoiceStepView key={step.id} step={step} stepResult={stepResult} apiClient={apiClient} onContinue={() => void advance()} />;
      default:
        return (
          <FreeResponseStepView
            key={step.id}
            step={step}
            stepResult={stepResult}
            apiClient={apiClient}
            speechLanguage={topic.speechLanguage}
            onContinue={() => void advance()}
          />
        );
    }
  }
}

export function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="page">
      <main className="column centered-message">
        <h1 className="session-title">{title}</h1>
        <p className="session-subtitle">{body}</p>
      </main>
    </div>
  );
}
