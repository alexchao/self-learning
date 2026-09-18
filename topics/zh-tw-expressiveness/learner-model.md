# Learner model: Expressive Conversational Mandarin

Maintained by the agent that prepares each session. Keep it short and current: rewrite sections, don't just append.
Last updated: 2026-09-16 (after 0003-paying-for-it-later, preparing 0004)

## Summary
Solidly conversational, with sound reasoning. New constructions land on first contact and come back unprompted within
the same session (反而 did this in 0003, as 本來就 / the 的是 cleft / 連…都 did in 0002). Corrections stick across
sessions: both placement errors flagged after 0002 were fixed in 0003. Production scores have plateaued at a
consistent 3 (diagnostic ≈2.1, 0002 ≈3.0, 0003 ≈3.0) and what holds them there is no longer structure — it's
**spoken register and collocation**, plus arguments that state a claim without a number behind it.

## Strengths
- Picks up a taught construction fast and reuses it unprompted later in the same session.
- Keeps the logical content intact: every communicative goal gets across, even when the phrasing is rough.
- Builds contrastive and proportional frames without help (越…越…, 不是X而是Y, 不代表, 本來…結果…反而…).
- Retains corrections between sessions (本來就 on the premise; 連 + object + 都沒 V without fronting).
- Reaches for idiomatic collocations when they've been heard once (停下來帶他們, 抄了一堆捷徑, 還技術債).

## Recurring errors / gaps
- **Written / textbook register in speech** (now the top issue): 為了…而…, 要求 for an HTTP request, 測驗 for 測試,
  修錯誤 for 修 bug, 審查 for review, 簡短 for 縮短, 部署 for 上線, 加速／變慢 where 比較快／更慢 is spoken,
  earlier 而不是, 安裝, 推翻, 達到期限.
- **Aspect and quantity in past narration**: 了 after the object (抄捷徑了) instead of on the verb with a quantity
  (抄了一堆捷徑); redundant 了 on 在+V (在還了); 很多 where a vented 一堆 belongs. Drilled in 0003, scored 2.
- **Claims without a quantity.** Says "it takes time no matter who" but never says how long, which is exactly what
  would make the argument land. No frame yet for isolating one cost and pricing it (光是…就…).
- **Small function words under load**: dropped 的 in the *second* cleft of a sentence after getting the first right;
  earlier 要/該 for obligation and 會 with habitual predicates.
- **Few sentence-final particles** (啦/耶/欸/吧), so pushback comes out flat; occasional perspective slips (你們team
  for their own team) and one long run-on chain instead of short chunks.
- **Vocabulary gaps**, usually filled with English or a written synonym: argument nouns (說法/主張, 證據有力/扎實),
  tech talk (上線, 流量, 演算法/呼叫), 隨意 vs 隨機.

## Current focus
- Items at stage 5 (from 0002): `benlai-jiu-anyway`, `burden-of-proof`, `lian-dou-not-even`. 0004 tests all three at
  stage 5 in one respond with no same-session priming — the first time a stretch step carries their itemIds.
- Items at stage 4 (from 0003): `tech-debt-cut-corners` (re-run the failed drill sentence), `fan-er-contrary`.
- 0004 new: `guang-shi-jiu-alone` (光是…就…), `claim-evidence-strength` (說法/主張 + 證據夠力/扎實, 越誇張越要…).
- Queue: 問題不在…而在… with 演算法/呼叫; chunked explanation habits (打個比方, 而且, 退一步說); a register-focused
  step on spoken vs written word choice; then new curriculum from the strands (falsifiability, correlation vs
  causation, moving the goalposts, 與其…不如…).

## Pace & preferences observed
- Rated 0001, 0002 and 0003 all "about right". Never uses hints, never retries, never disputes.
- **Actual time runs ~1.85–2× the estimate.** Measured in 0003: a translate/rewrite + 1 drill ≈ 5.2 min; a review
  translate with no drill ≈ 1.8 min; a teach 0.6–1.5; a choice 0.5; the stretch respond + 1 drill 9.6 min (4.2 of
  those just typing). Budget from these numbers, not the guide's per-step table. 3 drills per session is the ceiling.
- Likes software-engineering vocabulary grounded in how Taiwanese engineers really talk; mixes English in when a word
  is missing (tech debt, traffic, call) — a reliable signal of a gap worth teaching.
- Wants immediate application (drills) and wants practiced sentences to come back as reviews.
- Notices when the grader overstates a regional-usage claim (難受). Keep Taiwan-usage claims hedged and accurate.
- Asked about paging back through completed screens and about adding imagery — both open in docs/process-feedback.md.
