# Process feedback

Learner's feedback about the learning system itself. Agents: act on it, update docs/SYSTEM.md, then mark `Status: addressed (<what changed>)`.

## 2026-09-13 · zh-tw-expressiveness/0001-diagnostic
- Feedback: So at least with this one, the format was: I get asked a question, I try to answer it, and then I get a bunch of feedback and sentence constructions for how to improve my answer.

It would be great if there was a next step after that, that then utilized those things that I learned in sort of micro-examples, basically forcing me to apply what I just learned in maybe two or three quick examples. So I'm thinking it gives me an English sentence, and I have to translate it using the new pattern, right? 

It would be cool because if we're doing repetition on those in later sessions, those examples can become the repeated exercise that I have to demonstrate mastery of (in addition to the original question that I was asked).
- Note (headless prep agent, 2026-09-13): partly honored in content only. zh-tw-expressiveness/0002 shapes each item as teach → quick cloze → quick guided translate. Still needs a runtime change: after a graded free-response step, generate 2–3 micro-drills from the correction and persist them so later reviews can reuse them.
- Status: addressed (runtime "Apply it" practice drills after translate/rewrite/respond/free_production feedback; saved in results.json and topics/<id>/practice-bank.json; authoring guide tells future sessions to reuse them. See docs/SYSTEM.md § Practice drills)

## 2026-09-15 · zh-tw-expressiveness/0002-anyway-proof-not-even
- Feedback: I'm wondering if you're timing me to see how long I actually take to finish these.

  I'm also wondering if there's a record of the idioms and vocab words that I'm encountering as I go. it's ok if there isn't right now. since we're storing everything, it should be available if we need to extract it.

  also I think somewhere it said in taiwan, 難受 is used for physical, rather than mental or emotional discomfort. I don't think that's entirely true. made me think about how the model/you actually know about taiwanese mandarin and what's idiomatic. I think that's actually hard to look up. don't worry too much about it, but it's something to think about. don't waste cycles fixing this problem.
- Note (headless prep agent, 2026-09-15): no code changed. Facts for the interactive agent's reply: (1) yes, every attempt and drill records `timeSpentMs`, and step/session `completedAt` timestamps exist; 0002 took ~25 min against a 12-min estimate, so 0003 was made shorter and `learner-model.md` now records the real pace. (2) Items live in `items.json`, but incidental vocabulary from corrections (e.g. 流量, 隨機, 越幫越忙) is only in `results.json`. A vocabulary-extraction script or view would need a runtime change. (3) Added a one-line caution to `topics/zh-tw-expressiveness/grading.md` against categorical regional-usage claims.
- Status: open

## 2026-09-16 · zh-tw-expressiveness/0003-paying-for-it-later
- Feedback: it might be nice to be able to page back through the screens just to review what I just looked at. doesn't need to reset state or be interactive. not a big deal though.

  when are we going to add imagery? some simple accompanying cartoons or pictures or graphics might be a nice touch. I know you probably need an API key for that though.
- Note (headless prep agent, 2026-09-16): no code changed — both items need runtime work, so 0004 does not address them.
  For the interactive agent: (1) **Paging back.** `SessionPlayer` advances one step at a time and results are already
  persisted per step, so a read-only "back" that re-renders a completed step from `results.json` (question, the
  learner's answer, the feedback) without re-opening input or re-grading looks self-contained. Worth doing; the learner
  called it not a big deal, so it shouldn't displace content work. (2) **Imagery.** `session.json` already supports
  `image` on the intro, teach steps, and free-response steps (`ImageReferenceSchema`, validated against
  `sessions/<dir>/assets/`), and SYSTEM.md §5 / SESSION-AUTHORING.md §F already fix the house style (minimal editorial
  ink illustration, muted warm palette, one vermilion accent, no text in image). What's missing is only generation: it
  needs an image API key the learner would have to add to `.env`, so **ask them before building it**. A cheaper first
  step would be one hand-picked image per session intro to see whether it actually adds anything.
- Status: open

## 2026-09-21 · zh-tw-expressiveness/0004-how-big-is-the-claim
- Feedback: try to make each day's exercise slightly shorter, and stay on the same vocabulary for longer (even across sessions) so it sinks in better, and so there are more opportunities to see a given vocab in different contexts/situations
- Note (headless prep agent, 2026-09-21): 0004 actually took ~39 active min over three sittings (label 20). A related runtime
  issue for the interactive agent: a stretch step scoring 3 promotes every tagged item even when the grader's
  `targetItemIdsUsedCorrectly` is empty (all three 0002 items jumped to stage 6 in 0004, though the 的是 cleft never appeared).
  Consider gating promotion per item on that list in `sessionCompletionService.ts`.
- Status: addressed (zh-tw `targetSessionMinutes` 15–25 → 12–20; "consolidate before expanding" rule in SESSION-AUTHORING.md §A.6;
  SYSTEM.md requirements + decision log; 0005-says-who is a 4-step, no-new-items review session built on it)
