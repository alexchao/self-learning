# Session Authoring Guide

How an agent prepares a learning session. Read `docs/SYSTEM.md` first (requirements, architecture, Bloom ladder).
Then read the topic's `TOPIC.md` for topic-specific scope and style.

---

## A. Preparing the next session: checklist

Do these in order. Whether you are running headless (spawned after a session completes) or in an
interactive "I'm ready" conversation, the steps are the same.

1. **Orient.** `npm run status`. Identify the topic, the last completed session, and whether a next session already exists.
   - If a prepared (not started) session exists and was authored *after* the last completion, and no open steering
     notes are newer than it, it's fine. Stop (interactive: just launch it).
   - Never modify a session that has a `results.json` (it's in progress or done).
2. **Read the evidence** for the last completed session (`sessions/<dir>/`):
   - `session.json` (what was asked, with `authorRationale`) and `results.json` (every attempt, grade, retry,
     follow-up question, dispute, time spent, end-of-session difficulty rating and notes). Each step may also have
     `practiceDrills`: the "Apply it" sentences generated after feedback, with the learner's answers and grades.
     Drills that went well show a lesson landed; drills that failed show it needs another pass.
   - Look for *patterns*: which moves came out naturally, which produced translationese, what they asked follow-ups about
     (curiosity or confusion), where they used hints, retries that improved (learning happened), disputes (grader
     miscalibration: consider updating `grading.md`).
3. **Write `sessions/<dir>/review.md`** for that completed session: 5–15 lines. What went well, what didn't, concrete gaps, and
   decisions for next time. Future agents read these instead of re-deriving from raw results.
4. **Update `learner-model.md`.** Rewrite (don't just append) strengths, recurring errors, current focus, pace. Update the
   "Last updated" line.
5. **Read steering.** `steering.md` (topic) and `docs/process-feedback.md` (global). Plan how you'll honor each open note.
   Mark topic steering notes `Status: addressed in <new session dir>` once your session addresses them.
   Process feedback requires changing the system (docs/code). If you're headless and it needs code changes,
   leave it open and mention it in `authorRationale` so the interactive agent handles it.
6. **Choose content** (see §C) for a session that fits `topic.json` → `targetSessionMinutes` (zh-tw: 15–25 real minutes):
   - **Reviews**: items whose `spacedRepetition.dueAt` ≤ the expected session time, most overdue / lowest stage first,
     capped at `maxReviewStepsPerSession` from `topic.json`. Items that aren't due can still be reused inside stretch tasks.
   - **New items**: 1–3, fewer if the last session was rated too hard or many items are due, more if too easy.
   - **One stretch task** at Stage 5–6 that combines several items.
   - **Reuse practiced sentences** from `practice-bank.json` for reviews (the learner explicitly wants this): pick entries
     whose `itemIds` include the item being reviewed (or whose `targetExpression` matches), preferring ones they scored ≤ 2.
     Turn one into a `translate` step, set `sourcePracticeBankEntryId` to the entry id, and pitch it at the item's current stage
     (e.g. at stage 5 wrap it in a `respond` scenario instead of reusing it verbatim).
7. **Create or update items** in `items.json` for anything new (see §D). New items start at `stage: 0` with
   `introducedInSession: null` and an unstudied schedule (the server sets these on completion).
8. **Write `sessions/<NNNN-slug>/session.json`** (next number, kebab-case slug), following §B and §E.
9. **Validate**: `npm run validate -- topics/<topic>/sessions/<dir>/session.json`. Fix every problem.
10. **Interactive only**: `npm run learn -- --topic <topic>` to open it.

---

## B. Session file format

Schema source of truth: `app/shared/sessionSchema.ts`. Top level:

```jsonc
{
  "schemaVersion": 1,
  "topicId": "zh-tw-expressiveness",
  "sessionNumber": 2,                    // must match the directory prefix 0002-
  "kind": "regular",                     // diagnostic | regular | review | checkpoint
  "title": "Who has to prove it?",       // short, human, not generic
  "subtitle": "Burden of proof, and pushing back without being rude",
  "estimatedMinutes": 8,
  "createdAt": "2026-09-14T09:00:00.000Z",
  "authorRationale": "Why this content, what was reviewed, what steering was honored.",
  "intro": { "heading": "…", "body": "…" }, // optional; keep it to 2–4 sentences
  "steps": [ … ]
}
```

Every step has `id` (kebab-case, unique), `type`, `itemIds` (items it trains, drives spaced repetition), `stage` (1–6,
required when `itemIds` is non-empty and the step is graded), optional `authorNotes`.

### Step types

| type | Use for | Bloom stage | Graded by |
|---|---|---|---|
| `teach` | Introduce an item: short explanation + examples. Not graded. | – | – |
| `choice` | Recognition / nuance discrimination ("which sounds natural?") | 1 | server (instant) |
| `cloze` | Cued recall of the item in a sentence | 2 | exact match, else LLM |
| `rewrite` | Transform a plain/awkward sentence using the item | 3 | LLM |
| `translate` | Full sentence English → Chinese, no scaffolding | 4 | LLM |
| `respond` | Dialogue; learner must make a move where the item fits, without being told the item | 5 | LLM |
| `free_production` | Open explanation/argument, several sentences | 6 | LLM |

Fields (see schema for exact types):

- **teach**: `heading`, `body` (paragraphs; `**bold**`), `examples[] {chinese, english, pinyin?, note?}`, `image?`
- **choice**: `prompt`, `context?`, `options[] {text, isCorrect, explanation}` (every option explains itself)
- **cloze**: `sentenceWithBlank` (exactly one `___`), `englishMeaning`, `acceptableFills[]`, `referenceAnswers[]`, `hints[]`, `gradingNotes?`
- **rewrite**: `instruction`, `sourceText`, `referenceAnswers[]`, `hints[]`, `gradingNotes?`
- **translate**: `english`, `context?`, `referenceAnswers[]`, `hints[]`, `gradingNotes?`
- **respond**: `scenario`, `dialogue[] {speaker, chinese, english?}`, `task`, `referenceAnswers[]`, `hints[]`, `gradingNotes?`
- **free_production**: `prompt`, `lengthGuidance?`, `referenceAnswers[]`, `hints[]`, `gradingNotes?`

Also on free-response steps:
- `practiceDrillCount` (0–3): "Apply it" sentences generated after feedback. Omit for the default (2). Ignored on `cloze`.
  Use 0 when the step is itself a quick drill in a long session, or 3 for the key new item of the session.
- `sourcePracticeBankEntryId`: set when the step reuses a sentence from `practice-bank.json` (validated).

`image` (optional on teach/free-response steps and intro): `{ "path": "assets/<file>.png", "alt": "…" }` relative to the session dir.

---

## C. Composing a good session

**Calibrate against the learner's real pace, not the budget below.** Compare past `estimatedMinutes` with the actual
time in `results.json` (step `timeSpentMs` plus the gap between `startedAt` and `completedAt`) and say in `authorRationale`
what you assumed. For zh-tw as of 0002: a translate + 1 drill cycle runs 4–5.5 min, a respond + 2 drills ~8 min.

**Shape (typical session, 6–9 steps):**
1. Warm-up review: 1–2 due items at their current stage (quick wins first).
2. New item A: `teach` → a low-stage check (`choice` or `cloze`) → `rewrite` or `translate`.
3. New item B: same, but it can start one stage higher if it's close to something they know.
4. Interleaved reviews: remaining due items, each at its current stage (not the stage it started at).
5. Stretch: one `respond` or `free_production` that naturally calls for 2–3 items (new + old), not naming them.

**Time budget (including reading feedback):** teach ~1 min · choice ~0.5 · cloze ~0.5 · rewrite ~1 · translate ~1–1.5 · respond ~1.5 · free_production ~2–3.
Add ~1–1.5 min per drill-eligible step (translate/rewrite/respond/free_production) for its practice drills, unless the learner
is likely to score 4 on it (drills are skipped then) or you set `practiceDrillCount: 0`. With drills, 4–5 eligible steps is plenty.

**The ladder rule.** An item's review step should be at its current `stage` from `items.json` (or one above, if it's been
scored 4 twice at this stage). Never keep testing an item at a stage it has already passed. Stage 5–6 is the goal.

**Adapting to the evidence:**
- Rated *too hard*, or several 0–1 scores: fewer new items, more scaffolding (hints, a `choice` before production), shorter session.
- Rated *too easy*, or mostly 4s: skip `choice`/`cloze` for new items that resemble known ones; start them at `rewrite`/`translate`; add a second stretch task.
- Repeated error *type* (e.g. calques from English): make a teach step about that pattern even if it isn't an item yet.
- Follow-up questions show what they're curious about. Weave that in.
- A dispute the learner won means the grader was wrong: fix `grading.md` or the step's `gradingNotes` pattern.

**Quality bar:**
- Prompts are specific and vivid (a situation, a person, a stake), drawn from the learner's world.
- Reference answers are genuinely natural and varied; they are shown as examples, so they must be excellent.
- `gradingNotes` state what matters for this step (the core move, acceptable alternatives, common traps).
- English prompts at Stage 4+ are natural adult English, not pre-simplified to mirror the Chinese.
- Don't name the target item in `respond`/`free_production` tasks.
- Titles are human and specific ("Who has to prove it?"), never "Session 2: Lesson".

---

## D. Learning items

Schema: `app/shared/learningItemSchema.ts`. Example of a new item:

```json
{
  "id": "burden-of-proof",
  "kind": "concept_vocabulary",
  "headword": "舉證責任在…",
  "pinyin": "jǔzhèng zérèn",
  "gloss": "the burden of proof is on …",
  "explanation": "Formal-ish but common in debates. 舉證責任在他身上，不在我. Casual paraphrase: 要拿出證據的是他.",
  "examples": [{ "chinese": "舉證責任在提出主張的人身上。", "english": "The burden of proof is on whoever makes the claim." }],
  "tags": ["argument"],
  "createdAt": "2026-09-14T09:00:00.000Z",
  "introducedInSession": null,
  "stage": 0,
  "spacedRepetition": { "dueAt": null, "intervalDays": 0, "ease": 2.5, "reps": 0, "lapses": 0, "lastReviewedAt": null },
  "history": []
}
```

- One item = one reusable move. Ids are kebab-case and stable forever.
- **Never edit `stage`, `spacedRepetition`, or `history` by hand** unless fixing a bug; the server owns them.
  (Exception: if the learner clearly already knows an item, e.g. perfect use in a diagnostic, you may create it at
  `stage` 3–4 with a short `dueAt` so it gets verified quickly. Say so in `authorRationale`.)
- It's fine to refine `explanation`/`examples` over time.

---

## E. Extending the runtime

When a session would be meaningfully better with an interaction that doesn't exist (e.g. ordering sentence fragments,
a multi-turn role-play with an LLM character, listening comprehension with TTS, a timed speaking drill, a voice
conversation), add it rather than forcing a poor fit:

1. Add a step schema to `app/shared/sessionSchema.ts` (and to the discriminated union).
2. Add a renderer in `app/web/src/steps/` and route it in `SessionPlayer.tsx`.
3. If graded, extend `app/server/answerGrader.ts` / `sessionApiRoutes.ts` and `stepPromptDescriber.ts`.
4. Update the step-type table in §B and log the decision in `docs/SYSTEM.md`.
5. `npm run typecheck`, then `npm run learn -- --no-open` (rebuilds web and restarts the server automatically when code changed) and check it in the browser.

Keep new code in new files. Follow the design language in SYSTEM.md §5.

## F. Images (optional)

Use an image only when it adds meaning (setting a scene for a dialogue, making a concept concrete).
All images share one style: minimal editorial ink illustration, muted warm palette with at most one vermilion accent,
generous negative space, no text in the image. Save under `sessions/<dir>/assets/`. (Image generation tooling is not set up yet.)
