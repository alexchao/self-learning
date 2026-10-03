# Self-Learning System: Living Spec

This is the source of truth for **what this system is, what the learner wants, and how it works**.
It is a living document: when the learner gives process feedback or we change a design decision,
update this file (and log the change in the Decision Log at the bottom).

Any agent working in this repo should read this file before creating or changing anything.

---

## 1. Purpose

A personal system for learning knowledge-based topics (not physical skills) through short, adaptive,
browser-based sessions. Topics vary; there is no single cohesive app. Each topic progresses through
a series of sessions tailored to the learner's goal and past performance.

## 2. Learner requirements (as stated by the learner)

### The loop
- The learner opens Claude Code in this folder and says something like *"ok I'm ready for the next session."*
- They get a session in the **browser** (or another medium if it's clearly better). Originally specified as 5–10 minutes;
  **revised 2026-09-15 to 15–25 real minutes** (see decision log) — the learner prefers more material per sitting.
  **Revised again 2026-09-21: "slightly shorter"** — zh-tw now targets 12–20 real minutes.
  Per-topic target lives in `topic.json` → `targetSessionMinutes`.
- **Stay on the same vocabulary longer** (learner, 2026-09-21): items recur across sessions in different contexts before new
  ones are added, so each gets seen in several situations.
- On completion, **everything is persisted**: inputs, grading, outcomes, feedback.
- The next session for that topic is created from that history so it matches progress, pace, and goal.
- The learner does **not** study every day; gaps of days or weeks are normal and must be handled gracefully.

### Pedagogy
- **Active, not passive.** Every session requires learner input. The main mechanism is *testing*:
  attempt → get it wrong → be corrected. Reading is only a short preface.
- **Climb Bloom's taxonomy.** Recall (e.g. fill-in-the-blank) is fine when material is first introduced,
  but items must **ramp up** to Apply / Analyze / Evaluate / Create. For example, for a Chinese
  sentence pattern, the learner should eventually be translating whole complex English sentences
  into Chinese and using the pattern unprompted in argument/explanation, not filling in one word.
- **Apply the correction immediately** (learner feedback after 0001). After feedback on an answer, give 2–3 quick
  sentences that force applying what was just learned (e.g. translate an English sentence using the new pattern).
  Those sentences become review material in later sessions, alongside the original question.
- **Spaced repetition** (the learner uses Anki heavily). Loosely Anki-like scheduling is expected.
- **Liberal use of LLMs**: grading free-form answers, explaining corrections, follow-up questions, conversation.

### Steering & feedback
- The learner can **steer the next session** for a topic (e.g. "more X", "too easy").
- The learner can give **general feedback on the process**; that feedback should change this spec.

### Design / UX
- Clean, engaging, restrained. AI-generated images/media are welcome **when they add something**,
  but no slop: consistent, clean visual style.

### Engineering
- Topics and sessions neatly organized on disk. Simple local state (files are fine).
- The learner does not want to re-explain these requirements each time. That is what this doc is for.
- Learner's global coding preferences (from their CLAUDE.md): TypeScript with access modifiers on class
  methods, longer descriptive names, new logic in new files. Never read `.env` files.

---

## 3. Architecture

```
self-learning/
├── CLAUDE.md                     # agent entry point: the session loop, in brief
├── docs/
│   ├── SYSTEM.md                 # this file (living spec)
│   ├── SESSION-AUTHORING.md      # how to author a session (schema, exercise types, quality bar)
│   ├── process-feedback.md       # learner's general feedback about the system (append-only log)
│   └── plans/                    # multi-step engineering plans with status checkboxes (e.g. cloud-deployment.md)
├── app/                          # the session runtime (TypeScript)
│   ├── server/                   # Hono server: serves sessions, grades via Claude (LearningLlmClient), persists results, SRS
│   ├── web/                      # React (Vite) front-end that renders sessions
│   ├── shared/                   # zod schemas shared by server, web, and CLI scripts
│   └── scripts/                  # CLI: learn, status, validate, prepare-session, compare-llm-backends
├── learning.config.json          # LLM backend, model, effort, port, auto-prepare toggle
├── .env                          # optional API key for the anthropic-api backend (gitignored; agents never read it)
└── topics/
    └── <topic-id>/
        ├── topic.json            # id, title, goal, session length, status
        ├── TOPIC.md              # goal, learner profile, curriculum map, topic-specific authoring notes
        ├── grading.md            # topic-specific grading rubric injected into the LLM grader
        ├── learner-model.md      # agent-maintained: strengths, recurring errors, what to focus on next
        ├── steering.md           # learner's steering notes for this topic (append-only, marked when addressed)
        ├── items.json            # spaced-repetition learning items (+ Bloom stage), updated by the server
        ├── practice-bank.json    # "Apply it" practice sentences from past sessions, for reuse in reviews (server-written)
        └── sessions/
            └── 0001-<slug>/
                ├── session.json  # authored content (validated against the schema)
                ├── results.json  # written by the server: every attempt, grade, follow-up chat, feedback
                ├── review.md     # agent's short post-session analysis (written when preparing the next)
                └── assets/       # optional images/audio for this session
```

### Division of labor
- **Claude Code (the agent)** *authors* sessions: reads history, updates the learner model, writes `session.json`.
- **The runtime (app/)** *delivers* sessions: renders steps, calls the Claude API to grade free-form answers
  in real time (through `LearningLlmClient`), supports follow-up questions and grade disputes, saves every interaction, and updates
  spaced-repetition state deterministically when a session completes.
- Sessions are **data** (`session.json`) rendered by a library of **exercise types**. If a session needs an
  interaction that doesn't exist yet (a game, a dialogue simulator, a voice conversation), the agent
  **adds a new exercise type** to the runtime rather than hand-building a one-off page. The library grows
  over time. See SESSION-AUTHORING.md.

### When the next session gets created: "prepare on completion, verify on start"
1. When the learner finishes a session (and submits end-of-session feedback), the server spawns a
   headless Claude Code run (`claude -p`) that analyzes the results and **prepares the next session** in
   the background. Toggle: `autoPrepareNextSession` in `learning.config.json`. It runs via
   `app/scripts/prepareNextSession.ts` (also `npm run prepare-session -- --topic <id> --after <dir>`), which streams
   Claude Code's events into a **live, readable log** in `topics/<id>/.prep/` (one line per file read/write/command, then a
   summary with duration and cost). `npm run status` shows the latest log line while it runs.
2. When the learner says "ready", the agent runs `npm run status`. If a prepared session exists and is
   still appropriate (no newer steering, not badly stale), launch it immediately. Otherwise
   (re)generate it right there, then launch.

This makes "ready" usually instant, and keeps gaps (days/weeks) harmless: nothing runs on a cron, and
spaced-repetition due dates are just dates. Overdue items stay due until reviewed.

### Spaced repetition + Bloom ladder (`app/server/spacedRepetition*.ts`)
Each **learning item** (a sentence pattern, expression, concept-chunk) has a **Bloom stage** and an
**SRS schedule**. Reviewing an item does not repeat the same card: each review asks for the item at
its current stage, with fresh sentences. Success promotes the stage and grows the interval; failure
demotes the stage and resets the interval. The stages:

| Stage | Name | Bloom level | Typical exercise |
|---|---|---|---|
| 1 | Recognize | Remember / Understand | explain meaning, pick the natural option |
| 2 | Cued recall | Remember | cloze with English gloss |
| 3 | Guided production | Apply | rewrite/upgrade a plain sentence using the item |
| 4 | Translation | Apply | translate a full complex sentence, no hints |
| 5 | Contextual use | Analyze / Evaluate | respond in a dialogue where the item is needed but not named |
| 6 | Free production | Create | argue/explain unprompted; item used spontaneously |

Grades are 0–4 (0–1 = again, 2 = hard, 3 = good, 4 = easy). Intervals follow a simplified SM-2 that
credits actual elapsed time (a success after a long gap earns a long interval). Session authors cap
reviews per session so a week off doesn't create an avalanche; prioritize the most overdue and weakest.

### Grading
Free-form answers are graded by Claude (model/effort in `learning.config.json`) using structured output.
All model calls go through `LearningLlmClient` with two backends, picked by `llmBackend`:
- `claude-cli` (default): headless `claude -p --json-schema` on the learner's **subscription** (local login, or
  `CLAUDE_CODE_OAUTH_TOKEN` in the cloud). Isolated per call: no tools, settings, hooks, MCP, or CLAUDE.md. ~250 MB per
  process, at most 3 at once.
- `anthropic-api`: the Messages API, pay-per-use with `ANTHROPIC_API_KEY` in `.env`. Keeps prompt caching and the
  server-side refusal fallback, which the CLI path doesn't have.

Differences to know about on `claude-cli`: the tutor's multi-turn chat is replayed as one transcript prompt (`claude -p`
takes a single prompt); a refusal surfaces as `ClaudeRefusalError` with no automatic fallback model; usage counts
against the subscription's limits. `npm run compare-llm-backends` re-grades a past session on both backends.

The grade contains: score, minimally corrected version of the learner's answer, model answers, specific issues,
and an explanation. The prompt includes the topic's `grading.md`. The learner can **retry**, **ask a
follow-up question**, or **dispute** a grade (re-graded with their argument). All of it is saved.

### Practice drills ("Apply it")
After feedback on a `translate`, `rewrite`, `respond`, or `free_production` step, the server generates quick
practice sentences (default 2, per-step `practiceDrillCount` 0–3) that apply the most important lesson from that
feedback, usually the step's target item or the construction behind the biggest issue. Generation starts while the
learner reads the feedback. Each drill is graded quickly on whether the target was applied naturally (missing the
target caps it at 2). Drills are skipped when the first attempt scored 4 (`learning.config.json` → `practiceDrills`).
- Drill results live in `results.json` under the step's `practiceDrills`. They do **not** change spaced-repetition
  scheduling (that stays the step's first-attempt score): drills are immediate practice, not delayed recall.
- On completion, drills are copied to the topic's `practice-bank.json`. Session authors reuse them as review steps
  (`sourcePracticeBankEntryId`), so the sentences the learner practiced come back later, as the learner asked.

---

### Multi-topic readiness (known Chinese coupling)
The learner will add topics beyond Chinese, and not all of them will be languages. Storage, scheduling, the session
loop, prep, auth, and the cloud setup are topic-agnostic: everything topic-specific lives in `topics/<id>/`. But some
runtime code still assumes the topic is Taiwanese Mandarin. Remove this before (or while) authoring a second topic,
moving per-topic wording into `topic.json`/`grading.md` rather than adding `if (topic === …)` branches:
- Prompts: `practiceDrillGenerator.ts` / `practiceDrillGrader.ts` ("translate into spoken Taiwanese Mandarin",
  "Traditional characters"), `stepPromptDescriber.ts` (translate step), and "quote Chinese where relevant" in
  `answerGrader.ts` / `tutorFollowUpResponder.ts`.
- UI strings: "Say it in Chinese" (`FreeResponsePromptView.tsx`), placeholders `用中文回答…` / `用中文說…`,
  "Show pinyin" (`TeachStepView.tsx`), `zh-TW` speech defaults (topics already set `speechLanguage`).
- Schemas: `pinyin` fields and "Chinese" in doc comments; the char-level diff (fine for CJK, word-level is better for
  alphabetic languages; irrelevant for non-language topics).
- Step types `translate`/`respond` presuppose a language topic. A non-language topic (say, statistics) would mostly use
  `teach`, `choice`, `cloze`, `free_production`, plus new types (SESSION-AUTHORING.md §E).

## 4. The session loop (operational)

**"I'm ready for the next session"**
1. `npm run status`: see topics, prepared sessions, due items, pending steering.
2. If several topics are active, pick the one with the most due/overdue work (or ask).
3. If the prepared session is fine, `npm run learn -- --topic <id>` (starts the server if needed, opens the browser).
4. Otherwise, author the session per `docs/SESSION-AUTHORING.md`, `npm run validate`, then launch.

**Preparing a session** (headless or interactive). Full checklist in SESSION-AUTHORING.md:
read the last results → write `review.md` → update `learner-model.md` → read `steering.md` → pick
due items + new material → author `session.json` → validate.

**Steering from chat.** If the learner steers in Claude Code ("next time, more software engineering"),
append it to that topic's `steering.md` and, if a prepared session exists, revise it.

**Process feedback.** If the learner comments on the system itself, append to `docs/process-feedback.md`,
act on it, update this spec, and log the decision below.

---

## 5. Design language

"Ink and seal." A reading-first, paper-like interface.
- Warm off-white paper background, near-black ink text, one accent color (vermilion seal red) used sparingly
  for emphasis and progress, never for large surfaces. Dark mode: warm charcoal, same accent.
- Chinese set in a serif (Songti/Noto Serif TC) at generous size; UI chrome in a quiet sans.
- One step on screen at a time, narrow column, lots of whitespace, subtle motion. No emoji, no gradients,
  no decorative icons, no "gamified" confetti.
- Images (when used) share one style: minimal editorial ink illustration, muted palette, no text in image.

---

## 6. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-13 | Sessions are data rendered by a growing library of exercise types, not bespoke pages per session | Consistent quality, reliable persistence/grading; new interaction types are still possible by extending the library |
| 2026-09-13 | File-based state (JSON + Markdown) per topic | Simple, transparent, easy for agents to read and diff |
| 2026-09-13 | Prepare next session on completion (headless `claude -p`), verify on start | "Ready" is instant; no cron; gaps are harmless |
| 2026-09-13 | Items climb a 6-stage Bloom ladder coupled to SRS intervals | Learner explicitly wants escalation beyond recall |
| 2026-09-13 | Real-time grading via Claude API (`claude-opus-5`), structured output | Immediate correction is the core mechanism; nuance in Chinese needs a strong model |
| 2026-09-13 | Browser speech APIs (zh-TW) for listen/speak in v1 | Topic is conversational; zero extra keys; upgrade to better TTS/STT or a realtime voice agent later |
| 2026-09-15 | Session target raised from 5–10 min to 15–25 real minutes (`topic.json` → `targetSessionMinutes`) | Session 0002 was estimated at 12 min and took ~25; asked, the learner chose to keep the material rather than trim. Estimates must reflect *observed* pace, not the per-step budget |
| 2026-09-13 | Runtime "Apply it" practice drills after graded free-response steps, banked for later reviews | Learner process feedback after 0001. Drills don't affect SRS (immediate practice ≠ delayed recall); skipped when the first attempt scores 4 to protect session length |
| 2026-09-13 | Prep runs through a wrapper that streams Claude Code events to a readable live log | `claude -p` text output only appears at the end, so the log looked empty while prep was actually running |
| 2026-09-13 | All results.json writes go through one locked read-modify-write | Concurrent requests (drill generation + follow-ups) could otherwise overwrite each other |
| 2026-09-21 | zh-tw target 15–25 → 12–20 real min; "consolidate before expanding" rule (recent items recur in new contexts; 0–2 new items; review-only sessions allowed) | Learner process feedback after 0004, which took ~39 active min over three sittings against a label of 20. Content/docs change only; no runtime change |
| 2026-09-13 | Grading effort `low` (was `medium`) | Measured one translate grade: 19.0s at medium vs 11.4s at low with the same score and correction. Future option: stream feedback so the verdict appears sooner |
| 2026-10-03 | All in-app LLM calls default to Claude Code CLI on the subscription (`llmBackend: claude-cli`); API kept as a switch | Learner won't pay per-use API costs to run this in the cloud. Measured on 5 recorded 0004 answers: same score on 4, one borderline 3→2; CLI ~20 s avg vs API ~15 s. See docs/plans/cloud-deployment.md |
| 2026-10-03 | Passphrase gate (cookie = HMAC of `ACCESS_PASSPHRASE`) on `/api/*` and assets only; web shell public | The cloud server spends the learner's subscription; strangers must not reach the API. One shared secret is enough for one learner; the shell holds nothing private |
