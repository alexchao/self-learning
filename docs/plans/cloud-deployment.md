# Plan: run the learning system in the cloud, on the Claude subscription

Status: **live** since 2026-10-03 (phases 0–5 done; Phase 6, the learner's phone test, pending).

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
 laptop: interactive Claude ── push code/docs ────────────────┘   (cloud polls main every 2 min; pulls + restarts)
```

The code runs from the git working tree on the volume, not from code baked into the image. The image only provides
Node, git, and the Claude Code CLI. That keeps "what's deployed" == "what's on main" and lets data and code share
one tree, exactly like local.

### Ownership (avoids git conflicts)

| Files | Written by | Reaches the other side via |
|---|---|---|
| `app/`, `docs/`, `CLAUDE.md`, `topics/*/{TOPIC.md,grading.md,topic.json}` | laptop | push → cloud polls `main`, pulls, restarts if code changed |
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
--allow-write`). (A Fly deploy token for GitHub Actions turned out unnecessary; see Phase 3.)

The only other thing needing you is the phone test at the end (Phase 6).

**State as of 2026-10-03:** Fly app exists (no machines, no volume yet). Secrets `CLAUDE_CODE_OAUTH_TOKEN` and
`ACCESS_PASSPHRASE` are **staged** (`fly secrets list -a quiet-lantern-4747`); they take effect on the first deploy.
The learner has the passphrase; it is deliberately not written anywhere in this repo. The laptop's `fly` and `gh` CLIs
are logged in as the learner. An earlier setup token leaked; it was replaced and the learner confirmed the old one is dealt with.

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

Findings worth knowing (Phase 1):
- Isolation flags in `claudeCliLlmClient.ts`: `--system-prompt` (replaces Claude Code's own), `--tools ""`,
  `--setting-sources ""` (also skips user hooks), `--strict-mcp-config`, `--no-session-persistence`,
  `--disable-slash-commands`, cwd = an empty temp dir (no CLAUDE.md discovery). Prompt goes in on stdin.
- **Don't use `--bare`**: it ignores OAuth/keychain and only accepts `ANTHROPIC_API_KEY`, i.e. it defeats the point.
- `--output-format json` gives `structured_output`, `stop_reason`, `is_error`, `subtype`, `modelUsage` (model name).
  `total_cost_usd` is reported even on the subscription; it's notional, not billed.
- Cold start ~1.3–2 s per call; ~250 MB RSS per process; capped at 3 concurrent in the client.
- Checked through the CLI: answer grading (5 answers), drill generation, drill grading, and multi-turn tutor replies.
  Not yet checked through the live app UI (session 0006 was waiting unstarted); its first graded answer is the check.

## Phase 2: make the server safe and usable remotely

- [x] Passphrase gate (`app/server/accessGate.ts`): when `ACCESS_PASSPHRASE` is set, `/api/*` and `/session-assets/*`
      need a long-lived HttpOnly cookie (an HMAC of the passphrase, not the passphrase). The web shell stays public
      (nothing private in it; the repo is public); the web app turns a 401 into `/login?next=…` (`LoginPage.tsx`).
      Failed logins: 10 per 15 min per client IP (`Fly-Client-IP`), then 429. Changing the passphrase logs out all devices.
      Unset locally = no gate.
- [x] `PORT`/`HOST` from env (Fly needs `HOST=0.0.0.0`), unauthenticated `/healthz`.
- [x] Home page: already leads with a Start/Resume button per topic; kept as is.
- [x] Phone pass: `⌘↵` hints hidden on touch devices; follow-up input raised to 16px so iOS Safari doesn't zoom on
      focus. Checked at 390px: login, home, respond, translate, teach, choice, grade feedback, practice drill + its
      feedback; no horizontal overflow at 320px on any page.
- [x] QA with `/browse` against a gated server on port 4848 running from a scratch copy of the repo (so the real
      `results.json` files were never touched). curl checks: 401 without cookie, wrong passphrase 401, rate limit 429
      on the 11th failure, assets gated, `/healthz` open.

Not verifiable without a real phone (left for Phase 6): the in-page mic on iOS Safari (`webkitSpeechRecognition`;
keyboard dictation is the fallback), and the on-screen keyboard covering the Check button. Session-summary textareas
share the `.text-input` style that was checked elsewhere but weren't seen at phone width.
Found, not fixed (out of scope): single-asterisk `*emphasis*` in authored text renders with literal asterisks
(`RichText` only handles `**bold**`).

## Phase 3: git sync and admin endpoints

- [x] `gitSyncService.ts` (one git operation at a time per process; only when `GIT_SYNC=on`):
  - stages `topics/**` + `docs/process-feedback.md`, unstages any `results.json` whose session has no `completedAt`,
    commits as "study server", `pull --rebase --autostash`, pushes; a rejected push gets one more pull + push;
    a rebase conflict is aborted and logged (`.runtime/git-sync.log`), and the commit waits for the next sync.
  - Prep (`prepareNextSession.ts`) syncs at its start ("Record … learning data", also pulls the laptop's latest docs)
    and at its end ("Prepare the … session"), even if Claude failed. The server does no git work while a prep lock is held.
- [x] **Changed from the original plan:** no GitHub Action. The server polls `main` every 2 min
  (`cloudUpdateService.ts`): docs-only changes are pulled; code changes (`app/`, `package*.json`,
  `learning.config.json`, `tsconfig.json`, compared against the commit the process started from) make it exit with
  code 75 once no request is in flight and no prep is running, and `deploy/server-loop.sh` reinstalls/rebuilds as
  needed and starts it again. Why: no Fly token in GitHub and no public trigger endpoint; ≤2 min lag is fine.
- [x] Admin endpoints (`adminApiRoutes.ts`), **loopback only** (404 from anywhere else, so not on the public URL):
  `GET /api/admin/status`, `POST /api/admin/update`, `POST /api/admin/steering {topicId, note, reprepare}`.
  Reprepare deletes the unstarted next session and reruns prep after the last completed one; refused (409) while prep runs.
- [x] Laptop wrappers: `npm run cloud -- status | prep-log | update | steer | server-logs` and `npm run status -- --remote`
  (`cloud.ts` / `cloudAdminClient.ts`: curl inside the machine over `fly ssh console`, JSON body base64-encoded).
- [x] Tested against a local bare repo standing in for GitHub (scratch clones, stub `claude`): unfinished results
  excluded, code changes left alone, laptop commits rebased under, docs-only pull without restart, code pull → exit 75,
  steering commit + push, reprepare (note + deletion committed, new session pushed), update and steering refused while
  prep runs, admin 404 over the LAN IP.

## Phase 4: container and Fly

- [x] `Dockerfile`: `node:22-bookworm-slim`, git, openssh-client, curl, tini (`-s -g`: Fly's init is PID 1),
      `@anthropic-ai/claude-code@2.1.288` pinned, `deploy/github_known_hosts` (from `gh api meta`, fingerprints checked).
      `.dockerignore` sends only `deploy/` to the builder (never `.env`).
- [x] `deploy/entrypoint.sh` (root: writes the deploy key for `node`, drops privileges with `setpriv`, removes the key
      from the env) → `deploy/server-loop.sh` (clone/pull `/data/repo`, `npm ci` when `package-lock.json` changed,
      web build when `app/web`/`app/shared` changed, run, restart on exit).
- [x] `fly.toml`: 1 machine, sjc, shared-cpu-1x 2 GB, auto-stop off, volume `data` (1 GB) at `/data`, `/healthz` check.
- [x] Deploy key "study server (Fly quiet-lantern-4747)", read-write, on the GitHub repo; private half only in the Fly
      secret `GIT_DEPLOY_KEY_BASE64` (local copy deleted). To rotate: new key, `gh repo deploy-key add --allow-write`,
      `fly secrets set GIT_DEPLOY_KEY_BASE64=$(base64 < key | tr -d '\n')`, delete the old key on GitHub.
- [x] Deployed 2026-10-03; first boot (clone + npm ci + build) ~13 s. Smoke tests:
  - public: `/healthz` 200, `/api/*` 401 without cookie, wrong passphrase 401, `/api/admin/*` 404, http → https 301;
  - in the machine: server env has the OAuth token and passphrase but not the deploy key; deploy key can push
    (`git push --dry-run` reached receive-pack); `claude -p` with a Bash tool call works on the subscription;
  - a graded answer through the server (login → start → attempt, 23 s) on a throwaway copy of the topic;
  - a full real prep run (as `node`, `GIT_SYNC=off`) on a throwaway copy: exit 0, new session written, `validate` passes.
  The throwaway copies were deleted; the real 0006 was never started. Prep + push together get their first real run
  when the learner finishes 0006 (check `npm run cloud -- status` afterwards).

Operational notes:
- Shell in the machine: `fly ssh console` (root). Run git as the repo owner: `su node -s /bin/sh -c "git …"` in `/data/repo`.
- A stuck sync (rebase conflict, e.g. both sides appended to `process-feedback.md`): resolve by hand in the machine as
  `node` (`git pull --rebase`, fix, `git rebase --continue`, `git push`).
- Cost: shared-cpu-1x 2 GB always on + 1 GB volume ≈ $11–12/month.

## Phase 5: cutover

- [x] No local session in progress; all local learning data was already committed (0006 prepared, unstarted).
- [x] The local server is stopped; `npm run learn` stays as dev mode. Never run a real session on both.
- [x] `CLAUDE.md` (loop → cloud URL, `git pull` first, steering via `npm run cloud -- steer`, HTTPS push fallback),
      `SYSTEM.md` ("Running in the cloud", loop, decision log), URL saved in memory.

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
