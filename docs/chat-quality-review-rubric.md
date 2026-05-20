# Chat Quality Review Rubric

This rubric is the shared quality language for reviewing `production-chat-turn` traces in Langfuse.

Use it for:

- manual review of thumbs-down traces
- sampled review of zero-feedback and thumbs-up traces
- deciding whether the next fix belongs in routing, engine rules, retrieval, response composition, memory/profile handling, or trace instrumentation
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

- product fit mismatch -> recommendation engine category logic or product metadata
- routine logic mismatch -> routine planner, category action, or response composition
- missing or unnecessary clarification -> router logic, profile-slot rules, or classifier prompt
- weak grounding -> retrieval logic, source selection, or product `recommendation_meta`
- right ingredients but poor final answer -> response wording or composition behavior
- unsupported certainty or hair/scalp overreach -> synthesis prompt, guardrails, or rule constraints

## Fast review flow

For each trace:

1. Read the user message, profile summary, and final assistant output.
2. Check whether the assistant should have answered directly or asked a clarifying question.
3. Inspect the router decision, retrieval mode, sources, and matched products.
4. Score the trace on the four core dimensions below.
5. Assign one primary `failure_bucket`.
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

Chaarlie red flags:

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

Chaarlie red flags:

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

Chaarlie red flags:

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

Chaarlie red flags:

- “this is definitely because…”
- “you need this product”
- medical-sounding scalp explanations without evidence or referral guidance
- product claims not grounded in your own source material

## Primary failure bucket

After scoring, assign one primary bucket.

Use these buckets consistently:

- `product_fit_mismatch`
  - recommended product category, weight, subtype, target profile, or selected SKU does not fit the user/profile/question
  - product `recommendation_meta` conflicts with the visible rationale or misses a key profile constraint
- `routine_logic_mismatch`
  - routine step, cadence, order, action, or category relevance is wrong
  - engine category action does not match the routine context
- `missing_clarification`
  - assistant answered directly although a blocking profile/detail gap should have been clarified first
  - trace shows missing fields or low confidence that materially affected the answer
- `unnecessary_clarification`
  - assistant asked a follow-up despite enough context for a useful answer
  - clarification loop continued when a best-effort answer would be better
- `retrieval_grounding_gap`
  - weak sources, wrong retrieval mode, missing internal content, or product/source evidence does not support the answer
  - matched products are plausible but not grounded in retrieved/source metadata
- `response_wording_gap`
  - final answer is vague, generic, too long, badly structured, or fails to explain otherwise-correct inputs
  - wording makes the recommendation harder to act on despite acceptable trace metadata
- `overclaim_or_missing_caveat`
  - medically adjacent overreach, unsupported certainty, guaranteed outcomes, or missing uncertainty/caveat
  - cosmetic guidance is framed as diagnosis or hard proof
- `memory_or_profile_miss`
  - answer ignores, misreads, or contradicts known profile facts, routine history, preferences, or relevant memory
  - response uses stale profile/memory over the user's current turn
- `technical_or_trace_gap`
  - trace is incomplete, malformed, missing key metadata, or indicates a pipeline/instrumentation issue
  - reviewer cannot determine the failure layer because required trace data is absent
- `positive_reference`
  - strong answer worth keeping as an example of desired behavior
  - use for thumbs-up or sampled traces that demonstrate good routing, product fit, grounding, and wording

Only choose one primary bucket per trace. If multiple things are wrong, choose the earliest failure that most likely caused the rest.

## Review note template

Use short notes in this structure:

```text
Verdict: weak
Primary bucket: response_wording_gap
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

If the main issue is `product_fit_mismatch`:

- inspect `decision_context.engine_trace.categories`
- inspect selected product `recommendation_meta`
- review category target-profile mapping and product eligibility rules
- verify product metadata has the needed fit attributes

If the main issue is `routine_logic_mismatch`:

- inspect engine category actions and routine plan slots
- review cadence/order/action rules
- verify response composition did not distort the planned routine

If the main issue is `missing_clarification`:

- review router response mode and slot-completeness signals
- inspect missing fields on category decisions
- tighten clarification trigger rules where the answer would otherwise be misleading

If the main issue is `unnecessary_clarification`:

- review router response mode and clarification caps
- inspect whether available profile/product metadata was enough for a best-effort answer
- tighten prompts/rules to answer directly when uncertainty is acceptable

If the main issue is `retrieval_grounding_gap`:

- inspect subqueries
- inspect source ranking
- inspect retrieval mode choice
- verify the right internal content exists at all

If the main issue is `response_wording_gap`:

- tighten the main system prompt or final render prompt
- make answer structure more explicit
- reduce generic filler
- require clearer use of retrieved evidence and profile facts

If the main issue is `overclaim_or_missing_caveat`:

- soften certainty
- add stronger “do not diagnose” framing
- separate cosmetic advice from medically adjacent advice more clearly

If the main issue is `memory_or_profile_miss`:

- inspect profile snapshot and relevant memory
- verify current-turn overrides beat stale memory
- adjust memory/profile summarization or prompt usage

If the main issue is `technical_or_trace_gap`:

- inspect trace persistence and Langfuse metadata
- fix missing instrumentation before changing product logic
- add a trace regression test when the missing field is expected in every Trace V2 turn

If the main issue is `positive_reference`:

- save the trace as a reference example
- compare future regressions against its routing, engine metadata, product metadata, and wording

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
