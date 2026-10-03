# Self-learning workspace

This repo is a personal learning system. The learner drives it through Claude Code; sessions happen in the browser.

**Read first:** `docs/SYSTEM.md` (living spec: requirements, architecture, decisions).
**To create sessions:** `docs/SESSION-AUTHORING.md`.
**In progress:** moving the system to the cloud (Fly.io app `quiet-lantern-4747`) on the learner's Claude subscription.
Plan, status checkboxes, and decisions: `docs/plans/cloud-deployment.md`. Read it before touching deployment, auth, or git sync.

## The loop

- **"I'm ready for the next session"** (or similar):
  1. `npm run status`
  2. If a suitable session is prepared: `npm run learn -- --topic <id>`, then tell the learner in one or two lines what it covers.
  3. Otherwise prepare one (SESSION-AUTHORING.md §A), validate, then launch.
  4. If background preparation is still running (status shows it and its latest log line), wait for it or read its live log in `topics/<id>/.prep/`.
- **Steering** ("next time, more X"): append to `topics/<id>/steering.md` as an open note; revise the prepared session if one exists and isn't started.
- **Process feedback** about the system: append to `docs/process-feedback.md`, make the change, update `docs/SYSTEM.md` (including the decision log).
- **New topic**: create `topics/<id>/` with `topic.json`, `TOPIC.md`, `grading.md`, `learner-model.md`, `items.json`; ask the learner about their level and goal first (or start with a diagnostic session).

## Commands

- `npm run status`: topics, next session, due items, open steering, background prep
- `npm run learn [-- --topic <id>] [--restart] [--no-open]`: build if needed, start server (port 4747), open browser
- `npm run validate [-- <session.json | topic dir>]`: schema + cross-reference checks
- `npm run prepare-session -- --topic <id> --after <completed session dir>`: run next-session prep by hand (the server does this automatically on completion; live log in `topics/<id>/.prep/`)
- `npm run typecheck`
- `npm run compare-llm-backends [-- <topic> <session dir>]`: re-grade a completed session's answers on both LLM backends (score + latency). Uses the API key, so it costs a little.

## Version control

The repo is on GitHub (`origin`, public; the learner is fine with their answers being public). **Commit and push without asking.**
- Commit finished code/doc changes as you make them.
- Learning data (`results.json`, `items.json`, `review.md`, `learner-model.md`, `steering.md`, `practice-bank.json`, new sessions): commit and push once a session is completed **and** background prep has finished (`npm run status` shows no "Preparation running"). When the learner says they're ready, first commit any such leftovers from last time.
- Never commit while a session is in progress (its `results.json` changes on every answer) or while prep is still writing files.
- Before pushing, make sure no secrets are staged (`.env` is gitignored; never commit API keys).

## Rules

- Never read `.env` (it may hold an API key). If credentials seem missing, ask the learner.
- Model calls run on the learner's **Claude subscription** through the Claude Code CLI (`llmBackend: "claude-cli"` in
  `learning.config.json`; see SYSTEM.md → Grading). Don't add code that calls the Anthropic API directly: go through
  `LearningLlmClient`. Prep strips `ANTHROPIC_API_KEY` for the same reason. Secrets for the cloud (OAuth token, site
  passphrase) live only in Fly secrets; never write them into the repo.
- Server env: `ACCESS_PASSPHRASE` turns on the login gate (unset locally = open); `PORT`/`HOST` override the listen
  address (cloud). To test the gate locally without touching real results, run a second server from a scratch copy
  of the repo (see the Phase 2 notes in the cloud plan).
- Topics are not all Chinese. Keep new code topic-agnostic; known Chinese-specific spots are listed in SYSTEM.md →
  "Multi-topic readiness".
- Never edit a session that has `results.json`. Never hand-edit spaced-repetition fields in `items.json`.
- Code: TypeScript, access modifiers on class methods, long descriptive names, new logic in new files.
