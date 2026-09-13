import { useEffect, useState } from "react";
import type { TopicStatus } from "../../server/topicStatusReporter.ts";
import { LearningApiClient } from "./apiClient.ts";
import { CenteredMessage, SessionPlayer } from "./SessionPlayer.tsx";

export function App() {
  const sessionRouteMatch = window.location.pathname.match(/^\/topics\/([^/]+)\/sessions\/([^/]+)\/?$/);
  if (sessionRouteMatch) {
    return <SessionPlayer topicId={decodeURIComponent(sessionRouteMatch[1]!)} sessionDirName={decodeURIComponent(sessionRouteMatch[2]!)} />;
  }
  return <HomePage />;
}

function HomePage() {
  const [topics, setTopics] = useState<TopicStatus[] | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Study";
    LearningApiClient.fetchTopicStatuses()
      .then((response) => {
        setTopics(response.topics);
        setHasApiKey(response.hasApiKey);
      })
      .catch((error: Error) => setErrorMessage(error.message));
  }, []);

  if (errorMessage) return <CenteredMessage title="Couldn't reach the server" body={errorMessage} />;
  if (!topics) return <div className="page-loading" />;

  return (
    <div className="page">
      <main className="column">
        <section className="step">
          <p className="step-eyebrow">Study</p>
          <h1 className="session-title">Topics</h1>
          {!hasApiKey && (
            <p className="notice">
              No Anthropic API key found. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code>, then <code>npm run learn -- --restart</code>.
            </p>
          )}
          <ul className="topic-list">
            {topics.map((topic) => (
              <li key={topic.topicId} className="topic-card">
                <h2 className="step-heading-small">{topic.title}</h2>
                <p className="topic-goal">{topic.goal}</p>
                <p className="topic-meta">
                  {topic.completedSessionCount} session{topic.completedSessionCount === 1 ? "" : "s"} done · {topic.items.total} items · {topic.items.dueNow} due
                </p>
                {topic.nextSession ? (
                  <a className="button-primary" href={`/topics/${topic.topicId}/sessions/${topic.nextSession.dirName}`}>
                    {topic.nextSession.state === "in_progress" ? "Resume" : "Start"}: {topic.nextSession.title}
                  </a>
                ) : (
                  <p className="topic-meta">{topic.preparationInProgress ? "Next session is being prepared…" : "No session prepared. Ask Claude Code for the next one."}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
