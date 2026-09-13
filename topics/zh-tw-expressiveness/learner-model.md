# Learner model: Expressive Conversational Mandarin

Maintained by the agent that prepares each session. Keep it short and current: rewrite sections, don't just append.
Last updated: 2026-09-13 (after 0001-diagnostic, preparing 0002)

## Summary
Solidly conversational; reasoning in Chinese is sound but expression is approximate. The skeleton frames exist
(越…越…, 不是…而是…, 不代表, 因為…所以); what's missing is precise vocabulary for argument, natural collocations,
and the small nuance-carrying words (本來就, 連…都, 反而). Diagnostic average ≈ 2.1/4.

## Strengths
- Builds contrastive and proportional frames correctly without hints (越…越…就, 不是X而是Y).
- Keeps the logical content intact: both points of a rebuttal, emotional distinctions (not angry vs. disappointed).
- Knows Taiwan-friendly choices in places (誇張, 走捷徑, 有點失望).

## Recurring errors / gaps
- **Missing argument terms**: 舉證責任 unknown; no fallback paraphrase; left the step blank rather than paraphrasing.
- **Collocation calques from English**: 達到期限, 越多的證據 (quantity for strength), 超越需要的量, 聲明 for "claim".
- **Mainland/tech vocabulary**: 算法 (→ 演算法), "call" (→ 呼叫).
- **Nuance words absent**: 本來就 (baseline/anyway), 連…都 (not even), 反而 (contrary to expectation); 我不是生氣的 for 我不是在生氣.
- **Discourse in long answers**: one run-on clause, stacked 的 around English nouns, no chunking connectives or analogy.

## Current focus
- 0002: 本來就 (`benlai-jiu-anyway`), 舉證責任 + cleft (`burden-of-proof`), 連…都沒 (`lian-dou-not-even`).
- Queue (rehash remaining diagnostic content before new material): 反而 + chunked explanations; 趕 deadline / 還技術債;
  說法/主張 + 證據有力/扎實; 問題不在…而在… with 演算法/呼叫.
- Don't introduce brand-new curriculum until the diagnostic material has been worked through (learner's request).

## Pace & preferences observed
- Wants a **slow pace** with repetition of the same material until it feels mastered.
- Wants **immediate application**: after a correction or teach, 2–3 quick translation drills using the construction.
- Takes time per step (45s–3min), types answers, asks follow-ups when a correction isn't self-explanatory.
- Mixes English into answers when a word is missing ("call", "tech debt", "implementation details"): a useful signal of gaps.
