# Plan: run the learning system in the cloud, on the Claude subscription

Status: **proposed** (2026-10-03). Work through the phases in order; tick boxes as they land.

## Goal

Do sessions from any device (phone included) with the Mac off, without paying for API usage.

- One small always-on Fly.io machine runs the same Hono server **and** the headless next-session prep.
- Every LLM call (grading, tutor, drills, prep) goes through the Claude Code CLI on the learner's **subscription**
  (`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`). No Anthropic API key needed.
- GitHub stays the shared record. The cloud owns learning data, the laptop owns code and docs (see "Ownership").
- Interactive Claude (system changes, steering, reviews) stays on the laptop and talks to the cloud through git
  plus a couple of admin endpoints.

## Architecture

```
 phone / any browser ──HTTPS + passphrase cookie──▶ Fly machine (always on, 1 instance)
                                                    ├─ Hono server (same code as local)
                                                    ├─ claude -p … (grading, tutor, drills)   ┐ subscription
                                                    ├─ claude -p … (next-session prep)        ┘ via OAuth token
                                                    └─ /data/repo  = git working tree on a volume
                                                              │  pull before prep / commit+push after
                                                              ▼
                                                      GitHub alexchao/self-learning
                                                              ▲
 laptop: interactive Claude ── push code/docs ────────────────┘   (push to main → Action → cloud pulls + restarts)
```

The code runs from the git working tree on the volume, not from code baked into the image. The image only provides
Node, git, and the Claude Code CLI. That keeps "what's deployed" == "what's on main" and lets data and code share
one tree, exactly like local.

### Ownership (avoids git conflicts)

| Files | Written by | Reaches the other side via |
|---|---|---|
| `app/`, `docs/`, `CLAUDE.md`, `topics/*/{TOPIC.md,grading.md,topic.json}` | laptop | push → GitHub Action → cloud `git pull` + restart |
| `results.json`, `items.json`, `review.md`, `learner-model.md`, `practice-bank.json`, new sessions, `steering.md`, `docs/process-feedback.md` | cloud | cloud commits + pushes; laptop `git pull` |

Exceptions (steering from a chat, fixing bad SRS data) go through an admin endpoint or a laptop commit that the cloud
pulls *before* it writes anything, never as concurrent edits.

---

## Phase 0: your part (one sitting, ~15 min)

Everything that needs you happens here, so the rest can run unattended.

- [x] **Fly.io account** with a payment method (expected cost ~$5–8/month: shared-cpu-1x, 1–2 GB RAM, always on,
      1 GB volume). Then, in this Claude session: `! fly auth login`
- [x] **Decide the app name / URL**, **`quiet-lantern-4747`** (https://quiet-lantern-4747.fly.dev), created 2026-10-03.
- [x] After I create the Fly app (minutes after login), **in your own terminal, not through Claude** (so the token never
      lands in a transcript):
      1. `claude setup-token` → copy the token
      2. `fly secrets set --stage -a <app> CLAUDE_CODE_OAUTH_TOKEN=<token>`
- [x] **Passphrase** (generated, staged as a Fly secret) for the site: either pick one and set it the same way
      (`fly secrets set --stage -a <app> ACCESS_PASSPHRASE=<phrase>`), or let me generate one and tell you.
      Your browser remembers it, so you type it once per device.

Things I can do myself with tools you're already logged in to: GitHub deploy key (`gh repo deploy-key add
--allow-write`), the Fly deploy token for GitHub Actions (`fly tokens create deploy` + `gh secret set`).

The only other thing needing you is the phone test at the end (Phase 6).

---

## Phase 1: LLM calls on the subscription (local first; pays off even before the cloud)

- [x] New `app/server/learningLlmClient.ts`: one interface, `requestStructuredOutput({ system, user, schema, model, effort })`.
- [x] New `app/server/claudeCliLlmClient.ts`: spawns `claude -p --output-format json --json-schema <zod→JSON
      schema> --model … --effort …`, with tools off, no project settings/CLAUDE.md loaded (run in a neutral cwd), the
      API-key env vars stripped, and a timeout. Parses `structured_output`, validates with zod, maps refusals to
      `ClaudeRefusalError`.
- [x] Move the existing SDK path into `anthropicApiLlmClient.ts`; choose via `learning.config.json` →
      `llmBackend: "claude-cli" | "anthropic-api"` (default `claude-cli`).
- [x] Switch the four call sites: `answerGrader`, `tutorFollowUpResponder`, `practiceDrillGenerator`, `practiceDrillGrader`.
- [x] Home page: drop the "no API key" warning when the backend is `claude-cli`; check the CLI is logged in instead.
- [x] Verify (`app/scripts/compareLlmBackends.ts`): 5 recorded 0004 answers, same score on 4, one borderline 3 vs 2;
      CLI ~20 s avg vs API ~15 s; ~250 MB RSS per CLI process → use a 2 GB machine.
- [x] Commit; SYSTEM.md decision log.

## Phase 2: make the server safe and usable remotely

- [ ] Passphrase gate (new `accessGateMiddleware.ts`): if `ACCESS_PASSPHRASE` is set, every route except `/login` and
      `/healthz` needs a signed long-lived cookie. Unset locally = no gate.
- [ ] `PORT`/`HOST` from env (Fly needs `0.0.0.0`), `/healthz`.
- [ ] Home page leads with one big "Start next session" / "Continue session" button.
- [ ] Phone pass on every step type at ~390px: tap targets, sticky submit, textarea vs. on-screen keyboard, hide
      `⌘↵` hints on touch devices, check the in-page mic on iOS Safari (fallback: rely on keyboard dictation).
- [ ] QA locally with `/browse` at phone viewport.

## Phase 3: git sync and admin endpoints

- [ ] New `gitSyncService.ts` (serialized, one git operation at a time):
  - `pull --rebase` before every prep and before every admin-triggered update;
  - commit + push learning data after a session completes **and** its prep finishes (same rule as CLAUDE.md);
    never while a session is in progress; commit author "study server".
  - On push rejection: pull --rebase and retry once, then log and leave it for the laptop.
- [ ] Admin endpoints (same passphrase gate):
  - `POST /api/admin/update`: pull; if code changed, rebuild web and restart (deferred until no prep is running).
  - `POST /api/admin/reprepare?topic=…`: discard the unstarted next session and run prep again (for steering given
    in chat after a session was already prepared).
  - `GET /api/admin/status`: the `npm run status` output plus prep log tail, so the laptop can see cloud state.
- [ ] `npm run status -- --remote` and `npm run cloud -- <update|reprepare|logs>` wrappers for the laptop agent.

## Phase 4: container and Fly

- [ ] `Dockerfile`: Node 22 slim, git, `@anthropic-ai/claude-code` (pinned), non-root user.
- [ ] `deploy/entrypoint.sh`: first boot clones the repo into `/data/repo` with the deploy key; later boots `git pull`;
      `npm ci`, build web, start server.
- [ ] `fly.toml`: one machine, auto-stop **off** (prep runs in the background after you close the tab), volume at
      `/data`, health check on `/healthz`.
- [ ] Deploy key with write access → Fly secret `GIT_DEPLOY_KEY`.
- [ ] `fly deploy`; smoke test over the public URL with `/browse`: login, open a session, one graded answer, finish a
      throwaway session on a scratch topic to confirm prep runs on the subscription and the commit reaches GitHub
      (then revert the scratch commit).
- [ ] `.github/workflows/cloud-update.yml`: on push to main touching `app/`, `docs/`, `package*.json`, or topic config,
      call `/api/admin/update` (skips commits authored by the server).

## Phase 5: cutover

- [ ] Finish or leave any in-progress local session; commit and push all local learning data.
- [ ] Cloud pulls; the local server is retired (`npm run learn` stays as dev mode; never run both against real data).
- [ ] Update `CLAUDE.md` (the loop now points to the cloud URL; "pull first" rule; steering via reprepare), `SYSTEM.md`
      (architecture, decision log), and save the URL in memory.

## Phase 6: your part again

- [ ] Open the URL on your phone, enter the passphrase, "Add to Home Screen", do a session. Report anything awkward.

---

## Risks and open questions

- **Subscription usage limits.** A session is ~20 grading-type calls plus one prep run, which is light; heavy Claude
  Code use the same day could hit your plan's limits mid-session. The API backend stays available as a config switch.
- **Token exposure.** The OAuth token can spend your subscription. It lives only as a Fly secret; the passphrase gate
  keeps strangers from making the server use it. If it ever leaks, generate a new one and replace the secret.
- **Latency.** The CLI adds ~2 s startup per call. Measured in Phase 1; if it's bad, keep a warm process or stream.
- **Two sources of truth.** Ownership rules above; the laptop agent must `git pull` before touching anything.
- **Not in this plan** (separate work): stage-promotion bug from 0004, read-only paging back, imagery.
