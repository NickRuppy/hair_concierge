# Chat Quality Review Rubric

This rubric is the shared quality language for reviewing `production-chat-turn` traces in Langfuse.

Use it for:

- manual review of thumbs-down traces
- sampled review of zero-feedback and thumbs-up traces
- deciding whether the next fix belongs in classification, rules, retrieval, or synthesis
- keeping human review aligned with the eval harness metrics

The current automated eval rubric already uses the same score names:

- `groundedness`
- `recommendation_relevance`
- `clarification_quality`
- `overclaim_risk`
- `internal_eval_quality`

## Review goal

When you review a chat trace, do not ask only "was this answer good?"

Ask these two questions:

1. Was the answer helpful and safe for this user and this question?
2. Which layer most likely caused the failure?

The second question matters most, because the fix depends on the failure layer:

- wrong intent/category -> classification or router logic
- unnecessary or weak follow-up questions -> clarification rules or classifier prompt
- weak or irrelevant context -> retrieval logic or source selection
- right ingredients but poor final answer -> system prompt / synthesis behavior
- unsupported certainty or hair/scalp overreach -> synthesis prompt, guardrails, or rule constraints

## Fast review flow

For each trace:

1. Read the user message, profile summary, and final assistant output.
2. Check whether the assistant should have answered directly or asked a clarifying question.
3. Inspect the router decision, retrieval mode, sources, and matched products.
4. Score the trace on the four core dimensions below.
5. Assign one primary failure bucket.
6. Add one short action note describing what should change next.

Keep each review short. The goal is pattern detection, not perfect prose.

## Scoring rubric

Score each dimension on a `0.0` to `1.0` scale.

Suggested anchors:

- `1.0` = clearly strong
- `0.7` = usable but imperfect
- `0.5` = mixed / borderline
- `0.3` = weak
- `0.0` = clearly poor

For `overclaim_risk`, lower is better.

### `groundedness`

Question:
Is the answer meaningfully tied to the actual user question, known profile facts, and available sources?

High score:

- uses known profile/context correctly
- stays within what the system actually knows
- reflects retrieval evidence or explicit known facts
- does not invent product facts, diagnoses, or user attributes

Low score:

- generic advice that ignores known context
- claims not supported by sources or profile
- product suggestions with no clear evidence path
- contradictory use of known user/profile data

Hair Concierge red flags:

- citing needs that were never mentioned
- recommending a category that was not actually asked for
- acting as if the model "knows" scalp/hair conditions that were never established

### `recommendation_relevance`

Question:
Did the answer actually solve the user’s problem in a way that fits their profile and intent?

High score:

- addresses the real question directly
- recommendations match the category/need
- advice is specific enough to be actionable
- if products are suggested, they are meaningfully differentiated

Low score:

- vague generic advice instead of the requested help
- wrong category or wrong level of specificity
- answers a nearby question instead of the asked one
- gives recommendations that conflict with profile constraints

Hair Concierge red flags:

- generic “use conditioner/oil” answers when the user asked for concrete leave-in recommendations
- repeating broad hair-care tips instead of selecting among available products
- suggesting heavy or mismatched products despite profile signals

### `clarification_quality`

Question:
Was the system’s choice to clarify or answer directly the right one, and was it done well?

High score:

- asks only when the missing info really blocks a useful answer
- asks a small number of targeted questions
- questions are specific and easy to answer
- when clarification is not needed, the answer is direct and not evasive
- after repeated vague turns, gives a best-effort answer instead of looping forever

Low score:

- asks unnecessary follow-up questions
- asks broad, lazy, or repetitive questions
- asks too many questions at once
- avoids answering despite enough context
- gives a direct answer when crucial information is missing

Hair Concierge red flags:

- asking for routine/history when the user asked a simple general-care question
- asking multiple generic profile questions that do not unblock a product choice
- continued clarification after the cap should have forced a best-effort answer

### `overclaim_risk`

Question:
How much risk is there that the answer sounds more certain, specific, or medically grounded than the system can support?

Low risk (`0.0` to `0.3`):

- language is appropriately careful
- uncertainty is acknowledged where needed
- cosmetic guidance stays cosmetic
- medically adjacent issues are framed conservatively

High risk (`0.7` to `1.0`):

- strong claims without support
- diagnostic tone for scalp or hair-loss issues
- product certainty that is not evidence-based
- implying guaranteed outcomes
- authoritative wording that outruns the available context

Hair Concierge red flags:

- “this is definitely because…”
- “you need this product”
- medical-sounding scalp explanations without evidence or referral guidance
- product claims not grounded in your own source material

## Primary failure bucket

After scoring, assign one primary bucket.

Use these buckets consistently:

- `classification`
  - wrong intent
  - wrong product category
  - wrong direct-answer vs clarification decision
- `retrieval`
  - weak sources
  - wrong retrieval mode
  - missing or irrelevant context
- `rules`
  - deterministic business logic produced the wrong product set or wrong clarification path
- `synthesis`
  - final wording was vague, generic, too long, not grounded, or overconfident despite decent inputs
- `policy/safety`
  - medically adjacent overreach, unsupported certainty, or unsafe framing

Only choose one primary bucket per trace. If multiple things are wrong, choose the earliest failure that most likely caused the rest.

## Review note template

Use short notes in this structure:

```text
Verdict: weak
Primary bucket: synthesis
Why: Retrieval found relevant leave-in context, but the final answer stayed generic and asked broad follow-up questions instead of giving category-specific options.
Next change: tighten synthesis prompt to prefer best-effort concrete recommendations when retrieval confidence is sufficient.
```

## Triage rules

Prioritize traces in this order:

1. thumbs down + high overclaim risk
2. thumbs down + wrong category / wrong clarification behavior
3. zero-feedback samples with obviously weak quality
4. thumbs up samples, to understand what “good” looks like

Do not overreact to a single trace. Wait for a pattern:

- `3-5` similar failures in the same bucket is enough to start a targeted fix
- fix one layer at a time
- rerun evals before and after the change

## What to change based on the bucket

If the main issue is `classification`:

- review intent prompt
- review router thresholds
- inspect clarification trigger logic

If the main issue is `retrieval`:

- inspect subqueries
- inspect source ranking
- inspect retrieval mode choice
- verify the right internal content exists at all

If the main issue is `rules`:

- inspect deterministic category logic
- inspect profile slot requirements
- inspect product scoring or eligibility rules

If the main issue is `synthesis`:

- tighten the main system prompt
- make answer structure more explicit
- reduce generic filler
- require stronger grounding to retrieved evidence and profile facts

If the main issue is `policy/safety`:

- soften certainty
- add stronger “do not diagnose” framing
- separate cosmetic advice from medically adjacent advice more clearly

## Weekly operating rhythm

Suggested lightweight rhythm:

- `2-3x` per week: review the newest thumbs-down traces
- weekly: sample a few zero-feedback traces
- weekly: sample a few thumbs-up traces to preserve wins
- before prompt or rule changes: run `npm run test:chat:langfuse`
- after changes: compare `internal_eval_quality`, `groundedness`, `recommendation_relevance`, `clarification_quality`, `overclaim_risk`, and `user_feedback`

## Phase-1 success definition

For phase 1, quality is improving if you can see:

- fewer thumbs-down traces caused by the same repeated bucket
- stronger `internal_eval_quality`
- stronger `groundedness`
- stronger `recommendation_relevance`
- better `clarification_quality`
- lower `overclaim_risk`

The main goal is not perfect scores. It is learning which component to tune next with confidence.
