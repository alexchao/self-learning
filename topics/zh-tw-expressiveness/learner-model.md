# Learner model: Expressive Conversational Mandarin

Maintained by the agent that prepares each session. Keep it short and current: rewrite sections, don't just append.
Last updated: 2026-10-08 (after 0006-you-broke-it-you-fix-it, preparing 0007)

## Summary
Solidly conversational, with sound reasoning. New constructions usually land on first contact, and corrections to a specific
sentence stick, both on reruns and on **retries** (0005, 0006: every retry went to 4). **Transfer** is arriving construct by
construct: 光是 now holds in four domains (software, renovation, road trip, wedding) and came out unprompted in the long
respond; the double 的是 cleft had 的 in both halves twice in 0006. 反而 is the holdout: **four first attempts in a row at 2**
(0004, 0005, 0006 ×2), each time fixed perfectly on retry. Production holds at a steady 3. What keeps it there is spoken
register, collocation, and everyday vocabulary gaps, not structure. The learner wants to **stay on the same vocabulary
longer** (0004) and **more reps per construct, using pairs of short sentences** alongside the long rich ones (0005).

## Strengths
- Picks up a taught construction fast; fixes a corrected sentence reliably on a retry or rerun.
- Keeps the logical content intact: every communicative goal gets across, even when the phrasing is rough.
- Builds contrastive and proportional frames without help (越…越…, 不是X而是Y, 不代表, 光是…就…).
- 光是…就 + concrete cost is stable in two domains (software, renovation), with 更不用說 recycled unprompted.
- 本來就 on the premise and 連 + object + 都沒 V are stable, including outside software (0004).
- Picks up authentic colloquial touches once heard: 一堆, 害我們…, 30 趴, 隨便一個人的 po 文, 先…再說吧, 又不是我….
- Curious about expressive nuance, e.g. asked how to say "some guy on YouTube" dismissively (0004).

## Recurring errors / gaps
- **反而 under a fresh context**: put at the head of the clause (反而我們之間…) or split inside 什麼…都 (什麼反而都慢下來了);
  a reason (因為我以為…) or a 試著 calque given instead of an expectation (本來想說…); 可是／但 where 結果／沒想到 belongs.
  In the 0006 long respond the backfire came out with no 反而 at all. Once corrected, it's right every time.
- **The double 的是 cleft**: was dropped (0003, 0004) or avoided (0005), then produced correctly twice in 0006 short translates
  (stage-4 evidence). Not yet seen unprompted in a respond/free production. Treat it as stage 5 until it is.
- **Defensive opening to a superior** (才不是你想的那麼簡單吧): concede first, 我知道…啦，可是….
- **claim-evidence at stage 5** came out written (證據必須配得上這個說法, 再弱也不過了). It was right predicated in the drill.
  SRS says stage 6 (promoted on a stretch score of 3 with an empty `targetItemIdsUsedCorrectly`); treat it as 5.
- **Written / legal register**: 為了…而…/為了…才…, 澄清, 有證據力, 我需要否認, 而不是, 證據責任, 必須, 上線日期. Calques: 兩個故事, 只讓, 再…也不過了, 試著, 小的改變 (→ 小改動), 硬壓在 (→ 硬塞進).
- **Everyday vocabulary gaps** that show up as English or coinages: contractor → 師傅／工班, 建築管理會 → 管委會, supplement →
  保健食品, 睡眠不足 → 失眠, 工程人 → 工程師, 代碼 → 程式碼, 不理我 (ignores) vs 躲我 (avoids), 訂場 → 場地, 價位 → 價格,
  打壞 build → 弄壞／搞壞, 更不用說…了 (closing 了 still often dropped).
- Couldn't retrieve evidence adjectives: 夠力／扎實／有力 (not 強大).
- **Few sentence-final particles** (啦/耶/欸/吧), so pushback comes out flat. Slowly improving (吧 in 0005).

## Current focus
- **Consolidate, don't expand.** 0007 has no new items: a short 反而 pair in two new situations (stage 4), `claim-evidence-strength`
  as the long respond (stage 5, family LINE group), and one stage-6 free production for `benlai-jiu-anyway`, `burden-of-proof`
  and `lian-dou-not-even` (roommate and the electric bill).
- **Next (0008):** check `targetItemIdsUsedCorrectly` from 0007 before trusting any stage-6 promotion. If 反而 is still a 2 on
  first attempt, try a respond at stage 5 where the reversal is the natural move (not a translate) before moving on.
  `tech-debt-cut-corners` (due 11-22) and `guang-shi-jiu-alone` (11-09) are fine to leave until then. If all of 0007 goes well,
  the first new item can arrive in 0008 or 0009.
- Carry incidental vocabulary from corrections into later prompts: 管委會, 師傅/工班, 更不用說…了, 又不是我…, 搞得…更僵,
  躲我, 保健食品, 失眠, 也太誇張了吧, 夠力/扎實, 程式碼, 場地, 弄壞, 小改動, 硬塞進, 我知道…啦，可是….
- Next new item only once the current ones have been seen in 2–3 different contexts (光是 and claim-evidence now have).
  Queue: 問題不在…而在…; 與其…不如…; correlation vs causation (相關不等於因果); falsifiability; moving the goalposts; 打個比方.

## Pace & preferences observed
- Rated all six sessions "about right". Never uses hints or disputes. Retries when a score is ≤ 2 (0005, 0006) and always improves. Asks the occasional sharp follow-up (none in 0006).
- **0006: ~23 min of summed answer time over two sittings (4-day gap)**, label 20. Short single steps 1–4 min (typed answers ~1.5–2 min), the long respond 6.5 min, a drill ~1.7 min. Budget 0007 at 4 steps and 1 drill.
- **0005: 26 min in one sitting** (label 20) for 4 steps + 2 drills. Measured: review translate (with a retry) ~3.3–3.5 min ·
  translate + retry + 1 drill ~6 · long respond + 1 drill ~11 (the respond answer alone took 4.7 min) · drill answers 1.2–2.6 min.
  Short single-sentence steps with no drill should be ~1.5–2 min each.
- Likes the long rich sentences, and **also wants pairs of short, simpler sentences on one construct** for repetition (0005).
- Likes software-engineering vocabulary grounded in how Taiwanese engineers really talk; mixes English in when a word
  is missing, which reliably signals a gap worth teaching.
- Wants immediate application (drills) and wants practiced sentences to come back as reviews.
- Notices when the grader overstates a regional-usage claim. Keep Taiwan-usage claims hedged.
- Open process requests: short pairs "on the same page" (needs a runtime change); paging back; imagery (needs an API key, so ask first); a vocabulary record.
