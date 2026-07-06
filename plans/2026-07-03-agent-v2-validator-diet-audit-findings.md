# Agent V2 Validator Diet Audit Findings

Status: read-only audit findings, no implementation yet
Date: 2026-07-03
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/selected-product-facts-card-polish`
Branch: `codex/selected-product-facts-card-polish`

## Nick Alignment

The audit should not treat "remove validator" as "delete every check."

For this work, "remove" usually means:

- remove the validator's power to kill an otherwise good response;
- keep the signal as warning, trace, eval, repair hint, or deterministic cleanup when useful;
- delete only validators that are redundant, misleading, or too specific to be useful.

The product priority is:

1. Useful, truthful user answer.
2. Truth/safety/product/UI contracts.
3. Internal metadata neatness.

If a validator only proves that hidden routing metadata is imperfect, it should not replace a good answer with:

`Ich bin mir gerade nicht sicher, was du genau moechtest. Formulier es bitte einmal konkreter.`

## Evidence Sources Reviewed

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-product-lookup-clarification.spec.ts`
- `tests/fixtures/comparelab-prompts.json`
- `data/agent-v2/evals/request-interpretation-regression.json`
- `docs/agent-v2-guidance-migration/open-regression-failures.md`
- `docs/agent-v2-guidance-migration/reset-scalp-family-summary.md`
- `plans/2026-05-14-agent-v2-responses-compare-lab.md`
- `plans/2026-05-17-agent-v2-request-interpretation-rewrite.md`
- `plans/2026-06-17-agent-v2-repairable-validation.md`
- `plans/2026-06-17-agent-v2-pending-followup-policy-boundary.md`

## Core Finding

Agent V2 validators are currently doing three different jobs:

1. Hard tripwires: stop false product IDs, unsafe advice, unresolved product assessment, product facts claims without facts, broken schemas, and hidden side effects.
2. Repair guidance: tell the model which missing tool or structural field to fix.
3. Conversation routing enforcement: punish exact `answer_mode`, `product_request_kind`, category, count, pending-action, routine-thread, and tool-argument shape.

The first job is valuable and should stay hard.

The second job is useful, but should not always become a user-visible failure.

The third job is where the system is overbuilt. It was useful for Compare Lab and deterministic regression measurement, but in normal chat it can turn understandable follow-ups into generic fallback.

## Evidence That This Is Real

### 1. Existing exact alternatives test is positive, not failing

`tests/agent-v2-responses-runtime.spec.ts` has an exact regression for:

`Hast du sonst Alternativen zu diesem Shampoo?`

It expects:

- `answer_mode: product_recommendation`
- no repair attempts
- tools: `load_advisor_guidance`, `select_products`

So this exact phrase is already protected as a desired path in one synthetic runtime test. If the app still fails, the real failing point is likely model routing, trace state, or production context, not the current happy-path validator test.

### 2. Previous real failure: hidden metadata killed good visible answer

`plans/2026-06-17-agent-v2-repairable-validation.md` documents the Frizz failure:

- visible German answer was good;
- hidden `request_interpretation.evidence_quote: "Frizz"` was rejected as too short;
- repair got generic feedback and repeated the same value;
- runtime replaced the good answer with the generic clarification.

This is the clearest proof that hidden metadata validators can have too much kill power.

### 3. Guidance migration failures show repeated terminal-contract drift

`docs/agent-v2-guidance-migration/open-regression-failures.md` records several useful answers failing because terminal metadata/tool grounding drifted:

- hard-rule IDs too narrow;
- routine/tool intent mismatch;
- product-detail terminal `request_interpretation` drift on count/product fields;
- prompt/guidance tightening sometimes moved failures from missing tools into terminal consistency validators.

The historical lesson is not "validators are bad." It is: some strict validators caught real problems, then later became too narrow for the model's legitimate variations.

### 4. Runtime already has context-aware fallback ideas

`responses-agent.ts` already calls `buildKnownIntentFallbackAnswer` before generic fallback in major repair-failure paths.

So the diet should extend the existing fallback path, not add another router.

Important current gap:

- `buildActiveResolvedProductFollowupFallback` recognizes active resolved product follow-ups;
- it intentionally returns `null` for fit follow-ups;
- that avoids unsafe fit claims, but leaves "passt das?" with no useful fallback if `load_product_facts` repair fails.

### 5. Compare Lab created deterministic interpretation tests

`data/agent-v2/evals/request-interpretation-regression.json` encodes exact expectations for:

- `primary_intent`
- `product_request_kind`
- `care_category`
- `requested_product_count`
- `count_policy`
- required tool

This is good as eval data and trace accountability.

It is risky as hard user-answer gating, because slight human wording variations can be valid even when one hidden label differs.

## Validator Diet Matrix

### HARD KEEP

These should keep block power because accepting the response can make the product unsafe, false, or unrenderable.

| Validator / gate | Why keep hard | Notes |
| --- | --- | --- |
| `terminal_schema`, `mode_payload` | The app needs a parseable terminal answer and payload. | Broken schema cannot safely render. |
| `known_product_ids` | Prevents invented catalog IDs. | Hard keep. |
| `known_routine_step_ids` | Prevents invented routine step IDs in routine payloads. | Hard for routine output; can be warning for unused hidden metadata only if such a path exists. |
| `product_assessment_grounding` | Product fit/detail assessment needs resolved identity plus `load_product_facts`. | Hard keep. Fix repair/fallback around it, not the truth rule. |
| `product_assessment_visible_identity` | User must know which product is being assessed. | Hard keep for product assessment. |
| `product_lookup_required` | Named exact product assessment/detail/routine-add needs lookup unless already trusted/resolved. | Hard keep, but make context-aware recovery better. |
| `product_lookup_unresolved` | Do not assess unresolved exact product. | Hard keep only for the same unresolved target; do not let stale pending context block unrelated alternatives. |
| `product_fact_contradiction_caveat` | Prevents contradiction of loaded facts. | Hard keep. |
| `trusted_product_unverified_caveat` | Prevents saying a trusted selected product is still unverified. | Hard keep, but regex should not squeeze truthful "missing claim" caveats. |
| `named_product_detail_unverified` | Prevents fake answers or asking for a product already provided. | Hard keep, but target-specific. |
| `safety_no_product_first`, `safety_no_treatment_claims` | Safety/scalp/medical boundary. | Hard keep. |
| `no_internal_leakage`, `user_facing_internal_labels`, `user_facing_instruction_leakage` | Internal tool/policy leakage breaks trust. | Hard keep. |
| `boundary_answer_no_side_effects`, `turn_gate_answer_mode` | Domain/social boundaries should not mutate state or answer as the wrong product mode. | Hard keep for boundary lanes. |
| `visible_payload_not_rendered` for user-visible data loss | UI cannot silently drop promised recommendations or pending actions. | Keep hard when user-facing payload cannot render. |

### SOFTEN: REMOVE KILL POWER

These should usually become warnings, sanitizer/cleanup, repair hints, or eval-only checks when the visible answer is otherwise safe and useful.

| Validator / gate | Problem | Diet direction |
| --- | --- | --- |
| `request_interpretation_answer_mode` for normal product/routine/care turns | It can punish hidden label mismatch even when the visible answer is valid. In `buildRepairState`, this also suppresses guidance repair and often becomes terminal-only repair. | Keep hard only for safety/social/domain boundaries. For normal care turns, warn or repair without fallback if product/routine truth is grounded. |
| `request_interpretation_tool_args_match` | Exact category/count/kind equality is brittle. It was created for trace accountability, but can over-police slight wording/tool variations. | Split into hard subchecks only when mismatch implies unsafe tool use or wrong side effect. Downgrade exact metadata drift to warnings. |
| `request_interpretation_evidence` | Already proved dangerous: short hidden evidence killed a good Frizz answer. | Keep current sanitizer pattern and expand it cautiously to other hidden interpretation metadata. |
| `request_interpretation_confidence` | Low confidence can be useful, but hidden confidence should not override a grounded answer. | Hard only before risky product/routine/safety action. Otherwise warning. |
| `requested_product_count` | Exact counts are useful for UI/card shape but conversational counts are fuzzy. | Hard cap over maximum. For too few/many due to availability or vague wording, warning/clamp. |
| `product_answer_shape` for style/property rendering | Some shape checks protect readability, not truth. | Keep hard for raw broken rendering; warning for answer-style preferences. |
| `required_guidance_loaded` for simple continuity answers | Missing guidance can matter, but for safe continuity/follow-up answers it can become overkill. | Hard for safety, product facts, category hard rules. Warning/repair-only for harmless acknowledgement or continuity. |
| `known_hard_rule_ids` | It caught real hallucinated IDs, but history shows it was too narrow and caused generic fallback for useful answers. | Keep hard for truly unknown IDs; otherwise accept known loaded hard rules, required grounding, and soft rubric IDs. |
| `routine_context_continuity` | Forces routine context shape even when the user has moved to a product/general follow-up. | Hard only for actual routine payloads or mutations. Warning for product/general answers. |
| `routine_context_return_path_required` | Useful for routine product deep-dive UI, but can over-block normal product answers. | Hard only when rendering routine-thread product cards that need return path. |
| `routine_metadata_consistency` | Good for routine payload integrity, risky for explanation-only/product-only follow-ups. | Hard for routine state/output; warning for hidden context drift. |
| `routine_layer_progression` | Protects routine flow, but can force generic fallback for explanation-only turns. | Hard only for routine payloads/mutations. |
| `pending_followup_action_missing` | Missing hidden action should not kill a helpful answer. | Prefer deterministic fill if obvious, otherwise warning. |
| `pending_followup_action_hidden` | Hidden side effect without visible offer is risky. | Strip hidden action and accept with warning if visible answer is safe; hard only if state would mutate. |
| `pending_followup_action_kind_mismatch` | Useful drift signal, too strict as global blocker. | Strip or normalize hidden action; hard only for routine mutation authorization. |
| `pending_followup_action_category_mismatch` | German offer inference is intentionally A-lite, so it should not have broad kill power. | Warning/cleanup unless it would authorize wrong product/routine action. |
| `unnecessary_product_tool_call`, `unnecessary_routine_tool_call` | These are trace hygiene. | Keep as warnings; do not block. |
| `user_facing_bare_ja_opening` | Style quality issue, not truth/safety. | Warning unless it creates confusing confirmation semantics. |
| `conversation_close_*` blockers | Some closes are bad UX, but many are not dangerous. | Hard only for unsupported tool promises or internal leakage. Generic/redundant/too-many-question closes should warn. |

### REMOVE OR REPLACE

These are not all literal deletes. They are places where a validator/gate should stop being the main router.

| Area | Recommendation |
| --- | --- |
| Generic fallback after non-dangerous validation failure | Replace with known-intent fallback or accept-with-warning when only hidden metadata failed. |
| `request_interpretation_*` as router | Stop using exact interpretation shape as the source of truth for whether a user deserves an answer. Let the answer/tool grounding decide truth; keep interpretation as trace/eval. |
| Broad trusted-selection clarification block | Replace with target-specific rule: block "which product?" after selection, but allow real missing-question clarifications. |
| Category-only pending-review fallback | Keep only if trace proves same pending product assessment. Do not let same-category pending context block alternatives. |
| Short-confirmation pending action as exclusive router | Keep for routine mutation safety, but allow explicit semantic content beyond "ja" to route normally. |

## Target Failure Interpretation

### `Hast du sonst Alternativen zu diesem Shampoo?`

Do not change validators until a real trace proves the failing layer.

Current expected behavior already exists in a runtime regression:

- pending product context can exist;
- user asks alternatives;
- runtime should call `select_products`;
- no repair should happen.

If app fails, likely causes:

- model classifies as product-detail assessment of pending product;
- production active product context differs from test;
- pending-review fallback fires through a broader cue;
- request interpretation metadata fails after tool path.

Audit action: capture live trace first.

### `Okay ja kannst du mir kurz sagen ob das zu mir passt?`

This is the strongest immediate diet case.

Truth rule stays hard:

- no fit assessment without `load_product_facts`.

But fallback should not be generic when active product identity is known.

Diet direction:

- `product_assessment_grounding` remains hard;
- repair should be allowed/forced to call `load_product_facts`;
- if facts still cannot load, fallback should say the product is known but cannot be assessed from available facts, not ask what the user wants.

### `Du kennst ja das Shampoo, das ich gerade benutze, oder?`

This should not require product facts if the answer only acknowledges identity.

Diet direction:

- add a current-routine identity acknowledgement path;
- answer from routine inventory only for identity/state, not product fit/ingredients;
- distinguish:
  - resolved product: "Ja, ich sehe X als dein aktuelles Shampoo."
  - pending product: "Ja, ich sehe X, aber es ist noch in Pruefung."
  - category-only: "Ich sehe, dass du Shampoo nutzt, aber nicht den genauen Produktnamen."

## Proposed Implementation Plan

### Phase 0: Trace capture

Capture one real trace for each target prompt before changing behavior:

- `answer_mode`
- `request_interpretation.product_request_kind`
- `request_interpretation.care_category`
- validator IDs
- `failure_stage`
- `bounded_repair_kind`
- repair attempts
- tool calls
- active product/routine context
- product lookup outcome/fallback outcome

### Phase 1: Add validator severity policy

Introduce a gated policy that can downgrade selected validators from block to warn/cleanup.

The policy must be visible in trace and easy to disable.

Prefer validator-owned severity so `validation.ok`, `errors`, and `warnings` stay consistent.

### Phase 2: Hidden metadata diet

Start with hidden metadata validators:

- `request_interpretation_answer_mode`
- `request_interpretation_tool_args_match`
- `request_interpretation_confidence`
- `requested_product_count`
- selected `required_guidance_loaded`

Rule:

If the visible answer is safe, grounded, and renderable, hidden metadata drift should not kill it.

### Phase 3: UI/state contract diet

Convert obvious hidden-action drift into deterministic cleanup:

- strip hidden pending action with no visible offer;
- fill missing pending action only when obvious and non-risky;
- keep routine mutation authorization hard.

### Phase 4: Product context fallbacks

Extend existing `buildKnownIntentFallbackAnswer`:

- active resolved product fit follow-up should attempt/load product facts or give a truthful known-product/no-facts fallback;
- current routine product identity acknowledgement should answer from routine inventory;
- alternatives to pending product should use `select_products` and mention pending limitation once.

### Phase 5: Tests and eval preservation

Do not delete compare-lab/request-interpretation evals.

Reframe them:

- strict expected labels remain eval signal;
- production response validator should not always block on label mismatch;
- add regression tests that prove useful truthful answers survive hidden metadata failures.

## Open Product Decisions

1. For current routine identity, use the three-state truth wording above?
2. For pending exact product alternatives, mention the pending limitation once before alternatives?
3. For active resolved fit follow-up, should the system always attempt deterministic `load_product_facts` before fallback?

Recommended answer to all three: yes.

## Review Gate Before Implementation

Before implementation, review this matrix and mark each SOFTEN item as:

- `warn only`
- `repair then accept`
- `sanitize/strip then accept`
- `still hard`
- `delete`

Then implement in small slices, starting with hidden metadata validators and active resolved product fit fallback.

## Deep Audit Addendum

This addendum folds in four read-only subagent lanes:

- validator taxonomy;
- repair/fallback kill paths;
- compare-lab and historical evidence;
- current-care / active product context.

No subagent edited files.

## Revised Estimate

Approximate validator diet after the deeper audit:

| Bucket | Rough share of current block power | Meaning |
| --- | ---: | --- |
| Keep hard | 40-50% | Truth, safety, product IDs, product facts, unresolved products, schema/rendering, routine mutation authorization, internal leakage. |
| Reduce kill power | 35-45% | Keep as warning, repair signal, sanitizer, recomposition, or eval trace instead of final-answer killer. |
| Replace with narrower rule | 10-15% | Especially broad routing validators that mix safe cases with unsafe cases. |
| Delete outright | 0-5% | Very little should disappear completely; most checks are useful as signals. |

The deeper audit made the recommendation more conservative about deletion and more specific about removing kill power.

The core issue is not "too many validators." It is:

- too many validators map to `terminal_only` repair;
- too many `repair_failed` paths collapse to generic clarification;
- `visibleFailure` then suppresses useful product/context state unless a narrow lookup-specific recovery happened.

## Subagent Findings To Incorporate

### 1. Validator taxonomy correction

The first-pass matrix was directionally right, but a few validators are safer as hard blockers than initially stated:

- `visible_payload_not_rendered` should stay hard when payload/UI divergence would hide recommendations, routine steps, constraints, pending offers, or user-visible product/card state.
- `pending_followup_action_*` should not simply become warnings across the board. Hidden pending actions authorize next-turn behavior. Better diet: autorepair/strip/fill first; keep hard when hidden state would authorize a wrong routine mutation or product action.
- `routine_context_return_path_required` and `routine_metadata_consistency` should stay hard for actual routine deep-dive UI and routine state.

But the same taxonomy identified three strongest replace/remove-power candidates:

- `request_interpretation_answer_mode`
- `category_advice_no_unasked_products`
- `request_interpretation_confidence`

These mix real routing/safety concerns with brittle taxonomy enforcement. Replace them with narrower visible-output and side-effect validators.

### 2. `visible_payload_not_rendered` is a major answer eraser

This validator protects real UI integrity, so it should not be removed.

But today it maps to `composition_failed`, and if repair fails the runtime can return generic retry copy. That means a response with valid grounded payload data can still be erased because the visible prose did not render it perfectly.

Diet direction:

- keep the validator hard for UI divergence;
- add deterministic recomposition fallback from already-grounded payload/tool data before generic fallback;
- add tests where the payload is grounded but visible prose is incomplete, and expected behavior is recomposed useful answer, not generic clarification.

### 3. Useful repair is currently whitelisted too narrowly

`buildRepairState` gives tool repair to a small set:

- `product_lookup_required` -> `lookup_product_candidate`
- `product_assessment_grounding`, `trusted_product_unverified_caveat`, `trusted_product_selection_clarification` -> `load_product_facts`
- `product_tool_required` -> `select_products`
- `routine_tool_required` -> `build_or_fix_routine`

Everything else mostly becomes terminal-only repair. That is where generic fallback risk concentrates.

Diet direction:

- add explicit non-generic recovery for high-frequency terminal-only validators;
- for hidden metadata-only failures, accept-with-warning or sanitize after repair;
- for UI composition failures, synthesize from payload/tool data;
- for unresolved product lookup, recover by lookup status instead of asking the model to rescue everything.

### 4. Compare Lab evidence supports demotion, not deletion

Historical plans show why the strict interpretation layer exists:

- Agent V2 was intentionally moving away from German regex routing.
- The model declared `request_interpretation`.
- Code validated consistency, grounding, safety, permissions, and recovery.

That was a good Compare Lab design.

But old regression ledgers also show the failure mode:

- hidden evidence quote killed a good Frizz answer;
- `known_hard_rule_ids` was initially too narrow and produced generic fallback;
- dry-shampoo forbidden text hit a negated sentence;
- routine/product-detail thresholds were product decisions, not universal truth checks.

Diet direction:

- keep request-interpretation evals;
- add fixture severity such as `hard_block`, `repairable_metadata`, `warning_trace`, `eval_review`;
- do not treat every eval mismatch as production block power.

### 5. Current-care identity has no safe lane

The system has several pieces of context:

- named-product context for explicit "I use X" turns;
- routine inventory injected into runtime and tools;
- pending routine product contexts for `pending_review` / `needs_more_info`;
- trusted selected product context after clarification-card selection;
- active resolved product context after exact lookup/selection.

But there is no first-class deterministic lane for:

`Du kennst ja das Shampoo, das ich gerade benutze, oder?`

If the user only asks whether Chaarlie knows the current product identity, that is not a product assessment. It should not require product facts. It should also not trigger broad recommendations.

Diet direction:

- add an identity-only acknowledgement lane;
- allow it to answer from active resolved context, pending review context, or visible routine inventory;
- keep hard blockers for fit/use/frequency/property claims without facts.

Suggested truth states:

- resolved product: "Ja, ich sehe X als dein aktuelles Shampoo."
- pending product: "Ja, ich sehe X, aber es ist noch in Pruefung."
- category only: "Ich sehe, dass du Shampoo nutzt, aber nicht den genauen Produktnamen."

### 6. Target prompt conclusions

#### `Hast du sonst Alternativen zu diesem Shampoo?`

Current tests already cover the happy path. The deeper audit says the likely kill point is not stale pending lookup itself. More likely:

- bad recommendation payload triggers `visible_payload_not_rendered`;
- count/shape validator blocks;
- unknown product IDs block;
- model routes as product detail instead of alternatives.

Implementation should not loosen unresolved-product truth rules for this until a trace proves the failing validator.

#### `Okay ja kannst du mir kurz sagen ob das zu mir passt?`

Keep facts requirement hard.

Missing recovery is after repair failure:

- if product facts were loaded, synthesize conservative `product_assessment`;
- if facts cannot be loaded, say product identity is known but facts are missing;
- do not ask what the user means.

#### `Du kennst ja das Shampoo, das ich gerade benutze, oder?`

Add deterministic identity acknowledgement. This is the clearest "not a validator deletion" case: the system needs a small safe answer lane so the validators do not force the message through product assessment or recommendations.

## Revised Implementation Order

1. Add exact failure-path tests for the three German prompts.
   - Include at least one test where the first terminal answer is useful but violates only one validator.
   - Expected outcome must be useful recovery, not generic fallback.
2. Add hidden metadata severity policy.
   - Start with `request_interpretation_answer_mode`, `request_interpretation_tool_args_match`, `request_interpretation_confidence`, and selected `requested_product_count`.
3. Add recomposition fallback for `visible_payload_not_rendered`.
   - Keep hard UI integrity, but do not erase grounded payloads.
4. Add selected-product fit recovery after failed repair.
   - Use loaded `load_product_facts` if available.
   - Otherwise transparent no-facts fallback.
5. Add current-product identity acknowledgement lane.
6. Split unresolved lookup recovery by lookup status.
7. Reframe compare-lab/request-interpretation fixtures with severity.

## Strongest Candidates For Reduced Kill Power

Highest confidence:

- `request_interpretation_answer_mode`
- `request_interpretation_tool_args_match`
- `request_interpretation_confidence`
- `request_interpretation_evidence`
- `requested_product_count`
- style/conversation-close validators except unsupported-action promises

Medium confidence:

- `required_guidance_loaded`, split loaded-vs-reported and safety/product-facts cases;
- `known_hard_rule_ids`, keep hard for truly unknown IDs but avoid narrow ID taxonomy failures;
- `routine_context_continuity`, based on product decision about sticky routine threads;
- `category_advice_no_unasked_products`, replace with visible-output/product-ID guard.

Keep hard, improve fallback instead:

- `visible_payload_not_rendered`
- `pending_followup_action_*` when hidden state authorizes next-turn behavior
- `product_lookup_unresolved`
- `named_product_detail_unverified`
- `product_assessment_grounding`

## Subagent-Backed Bottom Line

The likely diet is:

- not mass deletion;
- large reduction in block authority for hidden metadata;
- more deterministic useful recovery before generic fallback;
- small new safe lane for identity acknowledgements.

If implemented well, Chaarlie keeps the product-honesty guardrails while stopping validators from acting as the main conversation router.

## Aligned Implementation Direction - 2026-07-03

This section records the product decisions made after reviewing the audit. Treat it as the handoff direction for the next implementation slices.

### Core rule

Validators should protect truth, safety, UI/state integrity, and tool/action boundaries. They should not be the main conversation router.

For non-dangerous failures, prefer this order:

1. sanitize or normalize safe hidden metadata/state;
2. give one targeted repair/recomposition instruction;
3. use a specific fallback grounded in known context;
4. use generic clarification only as the true last resort.

Trace warnings stay internal. Users should not hear about hidden metadata drift.

### External validation guidance check

The 2025-2026 agent-system guidance reviewed for this audit points in the same direction: layered guardrails, few hard blockers, bounded sanitizers, trace observability, targeted repair feedback, and strict controls for tool/action authority. This supports the validator diet, with one caution: sanitizers must stay bounded and must not hide unsafe advice, false product claims, privacy leakage, or unauthorized actions.

### Decision 1: generic fallback policy

Generic clarification should only happen when Chaarlie truly cannot infer intent or safely answer. If the system has meaningful context, use a specific fallback that shows the request was understood.

Examples:

- Active product known, facts missing: acknowledge the product and say fit cannot be reliably assessed from available facts.
- Current routine category known, exact product missing: say the category is visible but the exact product name is not known.
- User says `Ja` without pending action: ask which prior action they mean instead of guessing.

### Decision 2: evidence quote

`request_interpretation.evidence_quote` is observability-first. It should usually be sanitized or traced, not used as a final-answer killer.

Keep hard blocking only when evidence drift changes product identity, product lookup scope, user intent, or a consequential claim.

### Decision 3: visible payload rendering recovery

`visible_payload_not_rendered` should stay hard as a detection rule because cards, routine steps, blockers, and pending offers must not disappear from the visible answer.

Recovery should not be hard German prose templates. Hard templates are too risky in German because grammar, articles, cases, plural forms, and category names vary.

Use structured recomposition instructions instead:

- Tell the agent the structured payload is valid but the visible German answer failed to render required elements.
- List the exact payload elements that must appear.
- Require natural, concise German prose.
- Forbid invented claims or extra products/steps.
- Keep existing grounded payload data as the source of truth.

Mode-specific recomposition requirements:

| Answer shape | Required elements for the agent to compose naturally |
| --- | --- |
| Product recommendations | Mention each recommended product by name, include fit reason or caveat where present, keep product count aligned, include next-step offer if present. |
| Product assessment / fit | Name the assessed product, state only the grounded assessment, include caveat/missing-facts limit when present, do not invent properties. |
| Routine answer | Preserve step order, mention each visible step label, include frequency/reason where present, include return/next-step offer if present, do not add steps. |
| Constraint-blocked / no safe recommendation | Explain the concrete blocker, include any safe alternative or next step from payload/context, do not pretend a recommendation exists. |
| Clarification | Render the specific clarification question and any options/examples from payload; avoid generic `Was meinst du?` if a narrower question is available. |
| Pending follow-up offer | Ensure the visible answer includes the confirmable offer that creates the pending action. |

Fallback after recomposition:

- One targeted recomposition attempt is enough.
- If it still fails, use a specific known-context fallback.
- Generic fallback is last resort only.

### Decision 4: tool-args split

`request_interpretation_tool_args_match` should be split. It currently mixes real safety/truth issues with harmless metadata drift.

Keep hard:

- tool call answered the wrong product/category;
- routine mutation args would authorize the wrong side effect;
- missing semantic fields make the tool result untrustworthy;
- count mismatch changes an explicit visible promise.

Soften or sanitize:

- evidence quote wording drift;
- request-kind label drift when the visible answer is truthful and grounded;
- close category phrasing drift that does not change the product/routine action.

Target shape:

- `tool_args_truth_mismatch` = hard;
- `tool_args_side_effect_mismatch` = hard;
- `tool_args_metadata_drift` = warning/sanitizer;
- `tool_args_evidence_quote_drift` = sanitizer/trace warning.

### Decision 5: product count

Keep counts hard for explicit promises:

- `ein Shampoo` means one;
- `zwei Alternativen` means two;
- max/cap rules still protect UI overload.

Be flexible for vague language:

- `Alternativen`;
- `ein paar`;
- `sonst was`;
- `andere Marken`.

Default for vague alternatives with known category/product context: 2-3 options. Ask a follow-up only when the category/product context is genuinely missing or safety/product truth requires it.

### Decision 6: pending follow-up actions

Pending actions stay strong. They are not bureaucracy; they are the structured meaning of short confirmations like `Ja`, `Okay`, or `Ja bitte`.

Keep the state machine:

- A short confirmation may execute only a matching pending action.
- If no pending action exists, clarify rather than guess.
- Wrong routine mutation or wrong product action stays hard unless the correct normalization is obvious.

Reduce punishment around state sync:

- Visible offer plus matching pending action: accept.
- Visible clear offer plus missing pending action: deterministically fill it when action/category are clear.
- Hidden pending action without visible offer: strip it and keep the answer if the answer is otherwise safe.
- Visible offer plus wrong pending action: block or normalize only when the visible offer is crystal clear.
- No offer plus no pending action: accept as a normal answer.

Clear visible offers include both direct questions and explicit `Ich kann ...` offers when the action and category are clear.

Examples:

- `Soll ich dir 2-3 passende Shampoo-Alternativen empfehlen?` creates `product_recommendation / shampoo`.
- `Ich kann dir auch 2-3 leichtere Shampoo-Alternativen nennen.` creates `product_recommendation / shampoo`.
- `Ich kann dir mehr dazu sagen.` does not create a pending action unless action/category is clear.

### Repair budget

Use one targeted repair/recomposition attempt per failed response. After that, use sanitizer or a specific fallback. Avoid repair loops that eventually collapse into generic clarification.

## Implemented Slice - 2026-07-03

Implemented the first two conservative slices of the diet plan.

What changed:

- Added a validator-diet post-policy that converts only safe product interpretation `answer_mode` metadata drift and `request_interpretation_confidence` into warnings when they are the only blockers.
- Explicitly did not soften `requested_product_count`, `request_interpretation_tool_args_match`, or `request_interpretation_evidence` globally after the first test run showed that would bypass important existing repair paths.
- Added deterministic current-routine product identity acknowledgement for questions like `Du kennst ja das Shampoo, das ich gerade benutze, oder?`.
- Extended active resolved product fit fallback so `Okay ja kannst du mir kurz sagen ob das zu mir passt?` does not degrade to the generic clarification. It now acknowledges the known product and refuses to invent a fit verdict when product facts cannot be reliably composed.
- Added hidden pending-action sanitization: when the only blockers are `pending_followup_action_hidden` and its derived pending-action mismatch findings, the validator strips `pending_followup_action`, revalidates the answer, and accepts it with a warning. If any product truth, safety, or UI blocker remains, it still blocks.
- Kept visible confirmable-offer/state contracts hard: missing pending actions for visible actionable offers, visible offer/action kind mismatches, product ID truth, unresolved product lookup, and product facts requirements are still blockers.
- Added regression coverage for:
  - safe hidden product interpretation metadata becoming a warning;
  - hidden pending actions being removed instead of killing an otherwise valid answer;
  - hidden pending actions still blocking when mixed with a product truth failure;
  - current shampoo identity acknowledgement from matched routine context;
  - category-only shampoo context saying the exact product name is not known;
  - active resolved product fit fallback avoiding generic clarification and stale product copy.

Verification:

- `./node_modules/.bin/tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts`
- `./node_modules/.bin/tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-final-answer-validator.spec.ts`
- `npm run typecheck`

Remaining diet items should stay separate and test-led:

- split `request_interpretation_tool_args_match` into hard truth/side-effect checks and soft metadata/evidence drift checks
- expand `request_interpretation_evidence` sanitization while keeping product-identity drift hard
- add targeted agent recomposition for `visible_payload_not_rendered` without hard German prose templates
- split `requested_product_count` into explicit-count hard checks and vague-count flexible defaults
- strengthen pending follow-up deterministic fill/normalize behavior for clear visible offers, while keeping short-confirmation execution strict
- production trace capture for the exact manual app failure, especially if `Hast du sonst Alternativen zu diesem Shampoo?` still fails despite the existing positive runtime regression.
