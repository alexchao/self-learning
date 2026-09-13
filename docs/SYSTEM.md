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
- They get a **5–10 minute session** in the **browser** (or another medium if it's clearly better).
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
│   └── process-feedback.md       # learner's general feedback about the system (append-only log)
├── app/                          # the session runtime (TypeScript)
│   ├── server/                   # Hono server: serves sessions, grades via Claude API, persists results, SRS
│   ├── web/                      # React (Vite) front-end that renders sessions
│   ├── shared/                   # zod schemas shared by server, web, and CLI scripts
│   └── scripts/                  # CLI: learn, status, validate
├── learning.config.json          # model, effort, port, auto-prepare toggle
├── .env                          # API keys (learner-created; gitignored; agents never read it)
└── topics/
    └── <topic-id>/
        ├── topic.json            # id, title, goal, session length, status
        ├── TOPIC.md              # goal, learner profile, curriculum map, topic-specific authoring notes
        ├── grading.md            # topic-specific grading rubric injected into the LLM grader
        ├── learner-model.md      # agent-maintained: strengths, recurring errors, what to focus on next
        ├── steering.md           # learner's steering notes for this topic (append-only, marked when addressed)
        ├── items.json            # spaced-repetition learning items (+ Bloom stage), updated by the server
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
  in real time, supports follow-up questions and grade disputes, saves every interaction, and updates
  spaced-repetition state deterministically when a session completes.
- Sessions are **data** (`session.json`) rendered by a library of **exercise types**. If a session needs an
  interaction that doesn't exist yet (a game, a dialogue simulator, a voice conversation), the agent
  **adds a new exercise type** to the runtime rather than hand-building a one-off page. The library grows
  over time. See SESSION-AUTHORING.md.

### When the next session gets created: "prepare on completion, verify on start"
1. When the learner finishes a session (and submits end-of-session feedback), the server spawns a
   headless Claude Code run (`claude -p`) that analyzes the results and **prepares the next session** in
   the background. Toggle: `autoPrepareNextSession` in `learning.config.json`. Logs: `topics/<id>/.prep/`.
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
Free-form answers are graded by the Claude API (model/effort in `learning.config.json`) using structured
output: score, minimally corrected version of the learner's answer, model answers, specific issues,
and an explanation. The prompt includes the topic's `grading.md`. The learner can **retry**, **ask a
follow-up question**, or **dispute** a grade (re-graded with their argument). All of it is saved.

---

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
| 2026-09-13 | Grading effort `low` (was `medium`) | Measured one translate grade: 19.0s at medium vs 11.4s at low with the same score and correction. Future option: stream feedback so the verdict appears sooner |
