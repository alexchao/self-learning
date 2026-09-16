# Learner model: Expressive Conversational Mandarin

Maintained by the agent that prepares each session. Keep it short and current: rewrite sections, don't just append.
Last updated: 2026-09-15 (after 0002-anyway-proof-not-even, preparing 0003)

## Summary
Solidly conversational, with sound reasoning. The frames arrive quickly once taught: after one session, 本來就,
the 的是 cleft, and 連…都 all came up unprompted in a stretch dialogue. What still lags is fine placement and
collocation: where an adverb attaches, which small words a cleft needs, and spoken rather than written word
choice. Scores have been consistently 3 on production (diagnostic ≈2.1, 0002 production ≈3.0), 4 on clozes.

## Strengths
- Picks up a taught construction fast and reuses it unprompted in the same session.
- Keeps the logical content intact: gets every communicative goal across, even when the phrasing is rough.
- Builds contrastive and proportional frames without help (越…越…, 不是X而是Y, 不代表).
- Remembers earlier corrections (我不是在生氣 without being reminded).

## Recurring errors / gaps
- **Adverb/construction placement**: 本來就 put on the result instead of the premise; object fronted before 連 (一個benchmark你連跑都沒跑).
- **Dropping small function words**: 的 in clefts (想漲價是你), 要/該 for obligation, 會 with habitual predicates (本來就會…).
- **Written register in speech**: 而不是, 而 in 為了…而…, 安裝, 推翻, 變得很慢, 達到期限. Few particles (啦/耶/吧), so pushback sounds blunt.
- **English-shaped sentences**: long cause clause + 讓我…; one run-on chain in explanations with no chunking.
- **Vocabulary gaps**: argument and tech collocations (說法/主張, 證據有力, 趕 deadline, 技術債, 流量, 演算法/呼叫); 隨意 vs 隨機.

## Current focus
- Items at stage 4 (all introduced in 0002): `benlai-jiu-anyway`, `burden-of-proof`, `lian-dou-not-even`. 0003 reviews them at stage 4. After that, test them at stage 5 in a dialogue that same-session teaching hasn't primed.
- 0003 new: `tech-debt-cut-corners` (趕 deadline / 抄捷徑 / 技術債), `fan-er-contrary` (反而).
- Queue: 說法/主張 + 證據有力/扎實 (evidence scales with the claim); 問題不在…而在… with 演算法/呼叫; chunked explanations
  (打個比方, 而且, 光是…就…); then new curriculum from the strands (falsifiability, correlation vs causation, moving the goalposts).

## Pace & preferences observed
- Wanted a slow pace with rehashing after the diagnostic; rated 0001 and 0002 "about right".
- **Actual time is about 2× the guide's estimates.** 0002 (estimated 12 min) took ~25 min: typed answers take 50–70 s,
  drills 1–2 min each, plus reading feedback. Budget ~4–5 min per translate+drill cycle and keep drills to ~3 per session.
- Likes software-engineering vocabulary and wants it grounded in how Taiwanese engineers really talk.
- Wants immediate application (drills) and wants practiced sentences to come back as reviews.
- Notices when the grader overstates a regional-usage claim (難受). Keep claims about Taiwan usage hedged and accurate.
- Mixes English into answers when a word is missing (traffic, call, tech debt): a useful signal of gaps.
