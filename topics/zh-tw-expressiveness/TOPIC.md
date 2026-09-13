# Topic: Expressive Conversational Mandarin (繁體中文 · Taiwan)

## Goal (learner's words, condensed)
"I'm conversational in Chinese (Taiwanese Mandarin), but I don't have the expressiveness I have in English for
conversations that require nuance and complex ideas: arguments, debates, explanations of scientific concepts
and software engineering, complex emotional states. I want to be able to say things like *'the evidence has to
scale with the outlandishness of the claim'*, *'the burden of proof rests on him, not on me'*, *'that's not a
falsifiable claim'*, with similar expressiveness in other domains."

## Scope decisions (from the learner)
- **Conversational / spoken** expressiveness, not writing. Prefer what a well-educated Taiwanese person would *say*.
- **Traditional characters**, Taiwan usage and vocabulary (e.g. 軟體 not 软件/軟件, 資料 not 數據 where Taiwan prefers it, 品質 not 質量).
- **成語 are welcome but not the focus.** At most ~1 in 5 items; prefer ones that are genuinely common in speech (以偏概全, 倒果為因, 本末倒置).
- **No need to teach tone or register.** Don't build sessions about politeness levels. (Still flag if something would sound bizarre.)
- Not a beginner: skip basic vocab and grammar. Assume solid everyday conversation.

## What "expressiveness" means here
Being able to make **precise rhetorical and conceptual moves** in real time. Items should be *reusable moves*, not one-off sentences.

### Strands (the curriculum map)
Sessions should rotate across strands and interleave them; argumentation is the anchor strand, not the only one.

1. **Argument & epistemics**: burden of proof; falsifiability; evidence proportional to the claim; correlation vs. causation;
   post hoc reasoning; moving the goalposts; straw-manning / steelmanning; begging the question; cherry-picking;
   necessary vs. sufficient; anecdote vs. data; conceding a point while holding a position; degrees of certainty.
2. **Discourse frames**: the connective patterns that make complex sentences possible:
   不是…而是…, 與其…不如…, 就算/即使…也…, 固然…但…, 之所以…是因為…, 既然…就…, 除非…否則…, 一旦…就…,
   越…越…, 問題在於…, 關鍵是…, 前提是…, 取決於…, 換句話說, 話說回來, 退一步說, 說穿了, 照理說, 反而, 未必/不見得, 何況, 至於.
3. **Explaining science & reasoning**: mechanisms, trade-offs, scale, orders of magnitude, models vs. reality,
   sample size, confounding variables, emergent behavior, approximations, analogies ("打個比方").
4. **Software engineering**: technical debt, trade-offs, over-engineering, abstraction leaking, root cause vs. symptom, edge cases,
   backwards compatibility, scaling bottlenecks, "works on my machine", coupling, premature optimization. Include how Taiwanese
   engineers actually talk (natural English code-switching like "deadline", "PR", "deploy" is fine when that's what people say).
5. **Emotional nuance**: ambivalence, mixed feelings, disappointment vs. anger, feeling taken for granted, guilt-tinged relief,
   not wanting to impose, resentment you're trying to let go of, being hurt by something small, setting boundaries.

### Item kinds
- `pattern`: a discourse frame with slots (與其 A，不如 B)
- `expression`: a fixed spoken chunk (話不能這樣說, 這是兩回事)
- `concept_vocabulary`: a precise term plus how to use it in a sentence (舉證責任, 可證偽, 相關不等於因果)
- `chengyu`: sparingly
- `discourse_move`: a rhetorical function that may have several realizations (conceding-then-countering)

## Authoring notes for this topic
- **The ladder matters most here.** The target end state is Stage 5–6: the learner reaches for the move *unprompted*
  in a respond/free_production step. Don't let items sit at cloze level.
- English prompts at Stage 4+ should be **natural, complex English** (the way the learner actually talks), not
  pre-simplified English that maps word-for-word onto the target pattern.
- `respond` steps: write dialogue lines the way people actually talk in Taiwan (啦, 耶, 欸, 齁 in moderation).
  State the task as a communicative goal ("Push back: the burden is on them"), never "use 舉證責任".
- `free_production`: prompts drawn from the learner's world (software engineering, science, debates, relationships).
- Provide 2–3 reference answers with genuine variety (formal-ish spoken, casual spoken).
- Include pinyin only for new or uncommon vocabulary in teach steps.
- Mix strands within a session: e.g. one argument move, one discourse frame, applied to a software or emotion context.
