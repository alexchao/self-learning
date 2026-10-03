# Self-learning workspace

This repo is a personal learning system. The learner drives it through Claude Code; sessions happen in the browser.

**Read first:** `docs/SYSTEM.md` (living spec: requirements, architecture, decisions).
**To create sessions:** `docs/SESSION-AUTHORING.md`.
**Live system: the cloud.** Sessions run at https://quiet-lantern-4747.fly.dev (Fly.io, on the learner's Claude
subscription). The cloud owns learning data and pushes it to GitHub; this laptop owns code and docs.
How it works: SYSTEM.md → "Running in the cloud". History and setup details: `docs/plans/cloud-deployment.md`.

## The loop

- **Always `git pull` first**: the cloud pushes learning data after every session.
- **"I'm ready for the next session"** (or similar):
  1. `npm run cloud -- status`
  2. If a suitable session is prepared: give the learner the URL (https://quiet-lantern-4747.fly.dev) and one or two lines on what it covers.
  3. Otherwise `npm run cloud -- steer --topic <id> --note "<why>" --reprepare`, or author it here (SESSION-AUTHORING.md §A),
     validate, commit, push, then `npm run cloud -- update`.
  4. If background preparation is still running (status shows it), wait, or `npm run cloud -- prep-log`.
- **Steering** ("next time, more X"): `npm run cloud -- steer --topic <id> --note "…"` (add `--reprepare` to redo an
  unstarted prepared session). Don't edit `steering.md` here; the cloud owns it.
- **Process feedback** about the system: append to `docs/process-feedback.md`, make the change, update `docs/SYSTEM.md` (including the decision log).
  The cloud also appends to that file, so `git pull` right before editing it and push right after.
- **New topic**: create `topics/<id>/` with `topic.json`, `TOPIC.md`, `grading.md`, `learner-model.md`, `items.json`; ask the learner about their level and goal first (or start with a diagnostic session).

## Commands

- `npm run cloud -- <status | prep-log | update | steer | server-logs>`: the cloud server (via `fly ssh`; see `app/scripts/cloud.ts`)
- `npm run status [-- --remote]`: topics, next session, due items, open steering, background prep (local copy, or the cloud's)
- `npm run learn [-- --topic <id>] [--restart] [--no-open]`: local dev server (port 4747). Not for real sessions while the cloud is live
- `fly deploy`: only for image changes (`Dockerfile`, `deploy/`, `fly.toml`); code ships by pushing to `main` (the cloud polls every 2 min)
- `npm run validate [-- <session.json | topic dir>]`: schema + cross-reference checks
- `npm run prepare-session -- --topic <id> --after <completed session dir>`: run next-session prep by hand (the server does this automatically on completion; live log in `topics/<id>/.prep/`)
- `npm run typecheck`
- `npm run compare-llm-backends [-- <topic> <session dir>]`: re-grade a completed session's answers on both LLM backends (score + latency). Uses the API key, so it costs a little.

## Version control

The repo is on GitHub (`origin`, public; the learner is fine with their answers being public). **Commit and push without asking.**
- Commit finished code/doc changes as you make them.
- Learning data (`topics/**` except topic config, `docs/process-feedback.md`) is committed by the cloud ("study server"). Don't
  commit it from here; if a fix is really needed (e.g. bad SRS data), make sure no session is in progress or prep running
  in the cloud, commit, push, and `npm run cloud -- update` right away.
- If `git push` fails with an SSH agent error (the learner's agent is locked), push over HTTPS with the gh login:
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/alexchao/self-learning.git main`.
- Before pushing, make sure no secrets are staged (`.env` is gitignored; never commit API keys).

## Rules

- Never read `.env` (it may hold an API key). If credentials seem missing, ask the learner.
- Model calls run on the learner's **Claude subscription** through the Claude Code CLI (`llmBackend: "claude-cli"` in
  `learning.config.json`; see SYSTEM.md → Grading). Don't add code that calls the Anthropic API directly: go through
  `LearningLlmClient`. Prep strips `ANTHROPIC_API_KEY` for the same reason. Secrets for the cloud (OAuth token, site
  passphrase) live only in Fly secrets; never write them into the repo.
- Server env: `ACCESS_PASSPHRASE` turns on the login gate (unset locally = open); `PORT`/`HOST` override the listen
  address; `GIT_SYNC=on` turns on commit/push/poll (cloud only; never set it locally). To test the gate locally without touching real results, run a second server from a scratch copy
  of the repo (see the Phase 2 notes in the cloud plan).
- Topics are not all Chinese. Keep new code topic-agnostic; known Chinese-specific spots are listed in SYSTEM.md →
  "Multi-topic readiness".
- Never edit a session that has `results.json`. Never hand-edit spaced-repetition fields in `items.json`.
- Code: TypeScript, access modifiers on class methods, long descriptive names, new logic in new files.
