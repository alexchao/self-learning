# Learner model: Expressive Conversational Mandarin

Maintained by the agent that prepares each session. Keep it short and current: rewrite sections, don't just append.
Last updated: 2026-09-25 (after 0005-says-who, preparing 0006)

## Summary
Solidly conversational, with sound reasoning. New constructions usually land on first contact (光是…就… in 0004, 反而 in
0003), and corrections to a specific sentence stick, both on reruns and now on **retries** (0005: two retries, both went to 4).
What doesn't happen yet is **transfer**: a move learned in one domain doesn't come back automatically in another. 反而 has
scored 2 on first attempt three times in a row outside software, even though the corrected form is right each time. 光是 did
transfer (kitchen renovation, 0005). Production holds at a steady 3. What keeps it there is spoken register, collocation, and
everyday vocabulary gaps, not structure. The learner wants to **stay on the same vocabulary longer** (0004) and to get
**more reps per construct, using pairs of short sentences** alongside the long rich ones (0005).

## Strengths
- Picks up a taught construction fast; fixes a corrected sentence reliably on a retry or rerun.
- Keeps the logical content intact: every communicative goal gets across, even when the phrasing is rough.
- Builds contrastive and proportional frames without help (越…越…, 不是X而是Y, 不代表, 光是…就…).
- 光是…就 + concrete cost is stable in two domains (software, renovation), with 更不用說 recycled unprompted.
- 本來就 on the premise and 連 + object + 都沒 V are stable, including outside software (0004).
- Picks up authentic colloquial touches once heard: 一堆, 害我們…, 30 趴, 隨便一個人的 po 文, 先…再說吧, 又不是我….
- Curious about expressive nuance, e.g. asked how to say "some guy on YouTube" dismissively (0004).

## Recurring errors / gaps
- **反而 under a fresh context**: put at the head of the clause (反而我們之間…) where it belongs after the subject; a reason
  (因為我以為…) given instead of an expectation (本來想說…); no 結果／沒想到 hand-off. Earlier: 可是只讓…. Once corrected, it's right.
- **The double 的是 cleft**: the first half is right (說…的人是你); the second half either drops 的 (0003, 0004) or gets
  avoided with 舉證責任在你身上 (0005). The SRS says stage 6. Treat it as stage 4.
- **claim-evidence at stage 5** came out written (證據必須配得上這個說法, 再弱也不過了). It was right predicated in the drill.
  SRS says stage 6 (promoted on a stretch score of 3 with an empty `targetItemIdsUsedCorrectly`); treat it as 5.
- **Written / legal register**: 為了…而…/為了…才…, 澄清, 有證據力, 我需要否認, 而不是, 證據責任, 必須. Calques: 兩個故事, 只讓, 再…也不過了.
- **Everyday vocabulary gaps** that show up as English or coinages: contractor → 師傅／工班, 建築管理會 → 管委會, supplement →
  保健食品, 睡眠不足 → 失眠, 工程人 → 工程師, 代碼 → 程式碼, 不理我 (ignores) vs 躲我 (avoids).
- Couldn't retrieve evidence adjectives: 夠力／扎實／有力 (not 強大).
- **Few sentence-final particles** (啦/耶/欸/吧), so pushback comes out flat. Slowly improving (吧 in 0005).

## Current focus
- **Consolidate, don't expand.** 0006 has no new items and uses short pairs: the double cleft (untagged), 反而 (stage 4, two
  new situations), 光是 at stage 5 (two short responds), plus one long respond for `tech-debt-cut-corners` (stage 5).
- **Next (0007):** `claim-evidence-strength` as the long step. It's due 09-28; test it at 5–6 and prefer the predicated
  越…就要越… and 這種…根本不算…. Also `benlai-jiu-anyway`, `burden-of-proof`, `lian-dou-not-even`, due 10-04.
- Carry incidental vocabulary from corrections into later prompts: 管委會, 師傅/工班, 更不用說…了, 又不是我…, 搞得…更僵,
  躲我, 保健食品, 失眠, 也太誇張了吧, 試用, 夠力/扎實, 架環境, 程式碼.
- Next new item only once the current ones have been seen in 2–3 different contexts (光是 and claim-evidence now have).
  Queue: 問題不在…而在…; 與其…不如…; correlation vs causation (相關不等於因果); falsifiability; moving the goalposts; 打個比方.

## Pace & preferences observed
- Rated all five sessions "about right". Never uses hints or disputes. **Started retrying in 0005.** Asks the occasional sharp follow-up.
- **0005: 26 min in one sitting** (label 20) for 4 steps + 2 drills. Measured: review translate (with a retry) ~3.3–3.5 min ·
  translate + retry + 1 drill ~6 · long respond + 1 drill ~11 (the respond answer alone took 4.7 min) · drill answers 1.2–2.6 min.
  Short single-sentence steps with no drill should be ~1.5–2 min each.
- Likes the long rich sentences, and **also wants pairs of short, simpler sentences on one construct** for repetition (0005).
- Likes software-engineering vocabulary grounded in how Taiwanese engineers really talk; mixes English in when a word
  is missing, which reliably signals a gap worth teaching.
- Wants immediate application (drills) and wants practiced sentences to come back as reviews.
- Notices when the grader overstates a regional-usage claim. Keep Taiwan-usage claims hedged.
- Open process requests: short pairs "on the same page" (needs a runtime change); paging back; imagery (needs an API key, so ask first); a vocabulary record.
