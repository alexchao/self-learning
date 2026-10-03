import { type FormEvent, useEffect, useState } from "react";

/** Shown when the server's passphrase gate is on (cloud) and this browser has no access cookie yet. */
export function LoginPage() {
  const [passphrase, setPassphrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Study";
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Login failed (${response.status})`);
      window.location.replace(safeReturnPath());
    } catch (error) {
      setErrorMessage((error as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <main className="column">
        <section className="step login">
          <p className="step-eyebrow">Study</p>
          <h1 className="session-title">Passphrase</h1>
          <form onSubmit={(event) => void submit(event)} className="login-form">
            <input
              className="login-input"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              aria-label="Passphrase"
            />
            <button type="submit" className="button-primary" disabled={isSubmitting || !passphrase.trim()}>
              {isSubmitting ? "Checking…" : "Continue"}
            </button>
          </form>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <p className="topic-meta">Each browser asks once.</p>
        </section>
      </main>
    </div>
  );
}

/** Only same-site paths, so `?next=` can't send the learner to another origin. */
function safeReturnPath(): string {
  const requestedPath = new URLSearchParams(window.location.search).get("next") ?? "/";
  return requestedPath.startsWith("/") && !requestedPath.startsWith("//") && requestedPath !== "/login" ? requestedPath : "/";
}

export function redirectToLogin(): void {
  if (window.location.pathname === "/login") return;
  window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}
