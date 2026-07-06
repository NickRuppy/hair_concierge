# Agent V2 Validator Diet Audit

Status: reviewed draft, no implementation yet  
Date: 2026-07-03  
Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/selected-product-facts-card-polish`  
Branch: `codex/selected-product-facts-card-polish`

## Objective

Make Agent V2 answer normal human follow-ups instead of falling into generic clarification copy.

The target is a validator diet, not validator deletion:

- Keep validators that protect truth, safety, product identity, product facts, and UI/schema integrity.
- Soften validators that police the model's internal routing metadata more than user-visible truth.
- Replace generic repair fallbacks with context-aware, safe fallbacks when intent is obvious.
- Stop old active product or pending-review context from acting like a routing lock.

## Plain-Language Diagnosis

Agent V2 currently has three layers deciding what a turn means:

1. The model reads prompt/context and decides intent.
2. Final-answer validators check the submitted terminal answer.
3. Runtime repair and product-lookup fallback logic can override the answer after validation.

That is fine for hard truth problems, but too much of layer 2 and layer 3 now behaves like another router. If the model gives a reasonable answer but its `answer_mode`, `product_request_kind`, count, category, pending action, or follow-up metadata does not line up perfectly, the repair loop can fail. When repair fails, the runtime often returns:

`Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.`

So the fundamental problem is not that Chaarlie lacks context. The context often exists. The problem is that metadata validators and repair gates can discard a usable conversational answer when the shape is imperfect.

Claude review note: this diagnosis still needs one real failing trace per scenario before implementation. Some proposed mechanisms already exist in the code, so the implementation plan below is intentionally narrowed after review.

## Architecture Map

### Runtime prompt and repair

`src/lib/agent-v2/runtime/responses-agent.ts`

- Builds the prompt with saved user context, CareBalance context, routine thread context, pending follow-up action, surfaced product facts, named-product context, trusted selected-product context, active product contexts, and active resolved product context.
- Converts active resolved products into trusted product projections and lookup results.
- Converts active pending products into synthetic unresolved lookup results.
- Validates terminal answers through `validateAgentV2FinalAnswer`.
- Builds a bounded repair state from validator IDs.
- If repair cannot succeed, it chooses a fallback reason and often returns the generic clarification fallback.

Important hotspots:

- `activePendingProductContextToLookupResult` feeds old pending products into validation as unresolved lookup results.
- `buildRepairState` maps some validators to repair tools, but many shape errors become terminal-only repair.
- `selectFallbackReason` only has a few non-generic reasons.
- `buildKnownIntentFallbackAnswer` is already called before generic fallback in the main repair-failure branches. The fix is to extend that existing dispatcher, not add a second pre-fallback dispatcher.
- `buildActiveResolvedProductFollowupFallback` intentionally refuses fit follow-ups, so a failed "passt das?" repair can still end generic instead of saying "I know the product, but need product facts to judge fit."

### Final-answer validation

`src/lib/agent-v2/validation/final-answer-validator.ts`

The validator currently checks:

- terminal schema and payload shape
- user-facing payload rendering
- evidence quote grounding
- request interpretation confidence and answer-mode compatibility
- tool history and tool argument alignment
- required guidance packages
- known product IDs and routine step IDs
- product tool and product facts grounding
- named-product lookup requirements
- unresolved product lookup claims
- trusted selected product caveats and clarifications
- routine continuity and routine metadata
- pending follow-up action semantics
- safety boundaries and no internal leakage
- German user-facing language

This file mixes two kinds of checks:

- Good tripwires: "do not invent product IDs", "do not assess unresolved products", "do not claim product facts without loaded facts", "do not give unsafe medical advice".
- Brittle route policing: "terminal `product_request_kind` must exactly equal tool argument", "count/category metadata must match", "answer mode must be this exact mode", "visible next-step offer must create this exact pending action".

### Production pipeline

`src/lib/agent-v2/production/chat-pipeline.ts`

- Loads conversation history, saved profile, routine inventory, memory, and Agent V2 conversation state.
- Builds CareBalance from profile/routine items.
- Builds pending active product contexts from routine inventory rows with `pending_review` or `needs_more_info`.
- Merges active product contexts and chooses one active resolved product context.
- Provides `lookup_product_candidate`, `load_product_facts`, `select_products`, and `build_or_fix_routine`.
- After the runtime returns, calls `buildProductLookupTurnOutcome`, which may override the final answer or attach intake/clarification UI.

Current-care/routine context is present, but product identity quality differs:

- Matched routine products can have product IDs and support product facts.
- Pending routine products have names/submission IDs but cannot be assessed.
- Category-only routine facts such as "current shampoo present" are not enough to answer "which exact shampoo?" unless product name or product ID is present.

### Product lookup turn outcome

`src/lib/agent-v2/production/product-lookup-turn-outcome.ts`

- Adds deterministic named-product lookup fallback if the model skipped lookup.
- Adds category-less known-brand lookup fallback.
- Adds found-exact repair fallback after lookup-related failure.
- Adds pending-review fallback for unresolved products.
- Selects product intake offers and product lookup clarification cards.
- Updates active product contexts.

Risk hotspot:

- `buildPendingReviewCategoryFollowupFallback` can replace the model's answer with a pending-review block when a same-category pending product appears relevant. However, the current predicate already requires an assessment/use verb and excludes some recommendation phrasing, so this must be verified against a real failing trace before changing it.

## Validator Classification

### HARD KEEP

These should keep blocking because they prevent false product truth, broken UI contracts, or unsafe advice.

- `terminal_schema`, `mode_payload`: terminal answer must be machine-readable and renderable.
- `known_product_ids`: no invented product IDs in payload or grounding.
- `known_routine_step_ids`: no invented routine step IDs.
- `product_assessment_grounding`: product fit/detail assessment requires resolved identity plus `load_product_facts`.
- `product_assessment_visible_identity`: product assessment must name the assessed product.
- `product_lookup_required`: named exact-product fit/use/detail/routine-add turns need lookup unless already trusted/resolved.
- `product_lookup_unresolved`, but only for the same unresolved product target.
- `trusted_product_unverified_caveat` and product-fact contradiction checks: do not say a resolved product is unverified, and do not contradict loaded facts.
- `named_product_detail_unverified`: do not ask for the exact name again when the user already gave one; do not substitute unrelated products as the answer.
- Safety validators: `safety_no_product_first`, `safety_no_treatment_claims`.
- Boundary validators: turn-gate answer mode and boundary no-side-effects.
- `no_internal_leakage`.
- Product lookup UI/data integrity: stale clarification IDs, selected candidate IDs, and lookup-card metadata should remain strict in UI/API tests.

### SOFTEN

These should become warnings, repair hints, or "repair if cheap, otherwise accept if user-visible answer is safe."

- `request_interpretation_answer_mode` for product/routine mode mismatch.
  - Keep hard only for safety/social/domain boundary.
  - For normal care turns, do not discard a safe answer just because `answer_mode` or `product_request_kind` is not the ideal label.
- `request_interpretation_confidence`.
  - Low confidence should push clarification before tool use, but it should not override an already grounded, useful answer.
- `request_interpretation_tool_args_match`.
  - Exact category/count/kind equality is too brittle. Treat it as trace quality unless mismatch causes unsafe product claims or wrong UI.
- `requested_product_count` and some `product_answer_shape` count enforcement.
  - Hard cap over-recommendation if UI/product contract requires it.
  - Otherwise clamp or warn, especially for "alternatives" where exact count is conversational.
- `required_guidance_loaded`.
  - Keep hard for product/safety facts if guidance is the only source of truth.
  - For simple continuity answers, make it repair-only or warning when the answer is otherwise safe and grounded.
- `routine_context_continuity`.
  - Keep routine thread continuity when rendering routine steps or mutating routine state.
  - Do not block harmless general/product follow-ups just because `routine_context.active` is false.
- `routine_layer_progression`.
  - Keep for actual routine payloads.
  - Do not force generic fallback for explanation-only or product-only answers.
- `pending_followup_action_missing`, `pending_followup_action_hidden`, `pending_followup_action_kind_mismatch`, `pending_followup_action_category_mismatch`.
  - These are useful trace/UI consistency checks, but they should not turn a normal answer into clarification. Prefer deterministic cleanup: remove hidden actions, fill obvious missing actions, or warn.
- `visible_payload_not_rendered`.
  - Keep hard only when a pending action would otherwise be invisible.
  - Otherwise repair/strip the hidden pending action and re-validate with a warning; do not simply accept hidden UI state as-is.

### REMOVE OR REPLACE

These are likely causing the "validators as router" failure mode.

- Any global synthetic unresolved lookup result from stale pending active product context that real traces prove is over-blocking.
  - Important: current code already scopes unresolved lookup claims and already exempts grounded alternatives. Do not loosen this blindly.
  - Change this only after capturing a trace where a grounded alternative answer is blocked by stale pending context.
- Category-only pending-review follow-up fallback, only if real traces prove it fires on alternatives or broader recommendations.
  - Current code already requires assessment/use wording, so "Alternativen" may not hit this path today.
  - If it does misfire, replace it with stricter same-product evidence.
- Generic fallback after non-dangerous repair failure.
  - Replace with context-aware fallbacks:
    - resolved active product plus fit question: "Ich kenne das verknüpfte Produkt; für eine echte Passform-Einschätzung muss ich die Produktdaten laden. Versuch es bitte noch einmal." Better: trigger `load_product_facts` repair.
    - pending product plus alternatives: "Das konkrete Produkt ist noch in Prüfung; ich kann dir aber andere passende Shampoos empfehlen" and use `select_products`.
    - current routine product known by category only: "Ich weiß, dass du ein Shampoo nutzt, aber mir fehlt hier der genaue Produktname."
- `trusted_product_selection_clarification` as a broad hard block.
  - Keep the rule, but make it target-specific: block "which variant?" after a trusted selection; do not block every clarification when the user's actual follow-up is missing a different detail.
- Short-confirmation gating that uses pending action as an exclusive router.
  - Keep the safety around routine mutations.
  - Do not block product/facts tools when the latest user message adds explicit semantic content beyond "ja".

### NEEDS PRODUCT DECISION

Nick should choose these before implementation if they are not already settled.

1. If the current routine has a pending-review shampoo and the user asks "Du kennst ja das Shampoo, das ich gerade benutze, oder?", should Chaarlie answer:
   - "Ja, ich sehe den Namen/Eintrag, aber es ist noch in Prüfung", or
   - "Ich sehe, dass du Shampoo nutzt, aber nicht welches genaue Produkt" when only category is known?

2. If a pending exact product cannot be assessed but the user asks for alternatives, should Chaarlie:
   - explicitly mention the pending product limitation first, then recommend alternatives, or
   - skip the pending product and just recommend alternatives?

3. For active resolved product fit follow-ups, should repair failure produce a transparent temporary failure message, or should the runtime make a deterministic `load_product_facts` repair attempt before any fallback?

Recommended defaults:

- Use explicit but short truth: "Ich sehe X, aber es ist noch in Prüfung" when X exists.
- For alternatives, mention the limitation only once, then recommend alternatives.
- For resolved fit follow-ups, attempt `load_product_facts` before fallback.

## Observed Failure Traces

### 1. "Hast du sonst Alternativen zu diesem Shampoo?"

What should happen:

- Treat this as a product recommendation request for alternatives.
- If "diesem Shampoo" refers to a pending product, do not assess that product.
- Still call `select_products` and recommend grounded alternatives.

How it can fail now:

- This needs a real trace before implementation. The current validator already allows grounded alternatives when the answer is a `product_recommendation` with `product_request_kind` `specific_products` or `compare_products` and every visible product ID is in `tool_grounding.product_ids`.
- The current pending-review category fallback also appears not to trigger on the exact "Alternativen" wording unless another assessment/use cue is present.
- The most likely failure is therefore layer-1 routing or metadata shape: the model may classify the turn as `product_detail` / assessment about the pending shampoo instead of alternatives, or repair may fail to align the answer to the grounded recommendation shape.

Diet direction:

- First capture the real `answer_mode`, `product_request_kind`, lookup results, validation errors, and fallback stage.
- If the model routed wrongly, add prompt guidance that "Alternativen", "andere", "sonst", and similar wording means grounded alternatives via `select_products`, not product-detail assessment of the old product.
- If validation blocked an already-grounded recommendation, narrow only that validator path.

### 2. "Okay ja kannst du mir kurz sagen ob das zu mir passt?" after "we linked this shampoo"

What should happen:

- Use active resolved/trusted selected product context.
- Call `load_product_facts`.
- Answer as `product_assessment` with product name, profile fit, and caveats only for missing requested claims.

How it can fail now:

- Prompt guidance already tells the model to do this.
- Validators correctly require product facts for real fit assessment.
- If the model asks a generic clarification, `trusted_product_selection_clarification` only helps on trusted selection turns, not all later active resolved follow-ups.
- If repair fails, `buildActiveResolvedProductFollowupFallback` recognizes active-product follow-ups but explicitly returns null for fit follow-ups. That avoids unsafe fit claims, but leaves no useful fallback.
- Result: generic clarification even though the product subject is known.

Diet direction:

- Add a repair path that treats active resolved fit follow-up as requiring `load_product_facts`.
- If facts cannot be loaded, fallback should say the product is known but facts could not be loaded, not ask what the user wants.

### 3. "Du kennst ja das Shampoo, das ich gerade benutze, oder?"

What should happen:

- If routine inventory has a matched/resolved shampoo: "Ja, ich sehe X als dein aktuelles Shampoo."
- If routine inventory has a pending-review shampoo: "Ja, ich sehe X in deiner Routine, aber es ist noch in Prüfung."
- If only category presence is known: "Ich sehe, dass du Shampoo nutzt, aber hier nicht den genauen Produktnamen."

How it can fail now:

- `getUserContext` loads routine inventory and visible routine-product signals.
- The prompt includes compact routine inventory.
- Pending routine products become active pending product contexts.
- But there is no small deterministic "current product identity acknowledgement" path.
- The model may interpret this as product detail or vague clarification; validators then demand lookup/facts or reject mismatched metadata.
- If repair cannot find a product-facts or lookup path, the generic fallback appears.

Diet direction:

- Add a non-assessment acknowledgement path for current routine product identity.
- This path may answer from routine inventory without product facts because it is not claiming product fit or ingredients.
- It must not assess unresolved products.

## Recommended Implementation Approach

| Approach | Complexity | Effort | Tradeoffs | Best when... |
| --- | --- | --- | --- | --- |
| A: Validator Diet In Place | Medium | 1-2 days | Fastest path; keeps current architecture; needs careful regression tests so softened validators do not hide real issues. | We want to fix the observed failures without a larger routing rewrite. |
| B: Intent Contract Split | High | 3-5 days | Cleaner long-term separation between intent, facts, and UI side effects; touches many tests and runtime contracts. | We believe metadata routing bugs will keep recurring unless intent is modeled separately. |
| C: Fallback-First Patch | Low | 0.5-1 day | Reduces generic fallback quickly but leaves brittle validators in place; may mask root cause. | We need an immediate UX relief patch before deeper cleanup. |

Recommendation: Approach A.

It directly matches the product direction: agent-first intent, validators as tripwires. It fixes the real failure class without adding a new large router.

## Implementation Plan

### Phase 0: Capture real failing traces

Files/tools:

- local app at `http://localhost:3480/chat`
- production/debug trace surfaces
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`

Tasks:

- Capture one trace for each target prompt:
  - "Hast du sonst Alternativen zu diesem Shampoo?"
  - "Okay ja kannst du mir kurz sagen ob das zu mir passt?"
  - "Du kennst ja das Shampoo, das ich gerade benutze, oder?"
- Record `answer_mode`, `request_interpretation.product_request_kind`, `request_interpretation.care_category`, `failure_stage`, `bounded_repair_kind`, `validation_errors`, `repair_attempts`, product lookup executions, and whether any product/routine tool ran.
- Do not implement Phase 2 unless the trace proves stale pending context or pending-review fallback is actually in the failing path.

### Phase 1: Add a gated validator diet policy

Files:

- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- model/runtime policy config if one already exists

Tasks:

- Add one kill-switch flag/policy setting for the validator diet so production can revert to the current strict behavior without reverting code.
- Decide one owner for downgrades:
  - either the validator emits selected findings as `warn` under the flag, or
  - the runtime reclassifies selected block findings before `validation.ok` / repair decisions.
- Prefer validator-owned severity where possible so `errors`, `warnings`, and `validation.ok` stay internally consistent.
- Keep trace visibility: downgraded findings must remain visible in `validation_warnings` or an explicit diet trace field.
- Do not soften safety, unknown product IDs, unresolved same-product assessment, or product facts grounding.

### Phase 2: Fix alternatives routing only if trace proves it

Files:

- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`

Tasks:

- If the trace shows model-routing failure, update prompt/tool guidance in `responses-agent.ts` so alternatives use `select_products` with `specific_products` or `compare_products`, not `product_detail`.
- If the trace shows validation failure despite grounded alternatives, narrow `product_lookup_unresolved` only for grounded alternative recommendations.
- If the trace shows pending-review fallback misfire, update `pendingReviewContextMatchesCategoryFollowup` with explicit alternative/topic-switch exclusions.
- Do not remove same-product pending-review blocking for real fit/detail/use questions.

### Phase 3: Make active resolved product fit fallback truthful

Files:

- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts` if target product ID selection needs adjustment.

Tasks:

- Confirm the existing repair mapping already requests `load_product_facts` for `product_assessment_grounding`, `trusted_product_unverified_caveat`, and `trusted_product_selection_clarification`.
- Extend only the missing case: active resolved fit follow-up repair failure must not drop to generic clarification.
- Do not allow generic clarification for a known active product fit question.
- If product facts still cannot load, return a truthful product-known/facts-unavailable fallback, not "what do you mean?"
- Note latency: a successful fix may add a `load_product_facts` round-trip to resolved-product fit follow-ups.

### Phase 4: Add current routine product acknowledgement

Files:

- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- possibly `src/lib/agent-v2/resolved-product-selection-adapter.ts`

Tasks:

- Blocked on Product Decision #1.
- Add an explicit predicate for non-assessment identity acknowledgement questions, for example:
  - contains `kennst du`, `weißt du`, `weisst du`, `siehst du`, or `hast du gespeichert`
  - contains a first-person current-use cue such as `benutze`, `verwende`, `nutze`, `gerade benutze`, `aktuell`
  - contains a supported routine category term
  - does not contain fit/use/property/comparison verbs such as `passt`, `geeignet`, `wie oft`, `enthält`, `enthaelt`, `besser`, `vergleich`
- Answer from routine inventory when product name/status/product ID exists.
- Use three safe states: resolved, pending review, category-only known.
- Do not call `load_product_facts` unless the user asks fit, use, ingredient, property, keep/replace, or comparison.

### Phase 5: Extend existing known-intent dispatcher

Files:

- `src/lib/agent-v2/runtime/responses-agent.ts`

Tasks:

- Extend `buildKnownIntentFallbackAnswer` instead of adding a duplicate pre-fallback check. This dispatcher already runs before generic fallback at the main repair-failure sites.
- Add or improve known-intent branches for:
  - active resolved product fit/use follow-up
  - active pending product same-product follow-up
  - alternatives to pending/resolved product
  - current routine product identity acknowledgement
- Prefer recovered assistant text when no hard validator failed and no unsafe/product-fact claim is present.
- Keep generic clarification only for genuinely ambiguous unsupported messages.

### Phase 6: Regression tests

Files:

- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `tests/agent-v2-current-care-context.spec.ts`
- `tests/agent-v2-product-lookup-clarification.spec.ts`

Required cases:

- Pending shampoo + "Hast du sonst Alternativen zu diesem Shampoo?" recommends grounded alternatives.
- Pending shampoo + "passt dieses Shampoo zu mir?" still blocks assessment and does not invent.
- Resolved selected shampoo + "passt das zu mir?" calls `load_product_facts` and answers `product_assessment`.
- Resolved selected shampoo + product facts load unavailable returns product-known/facts-unavailable fallback.
- Current matched routine shampoo + "kennst du das Shampoo, das ich benutze?" answers identity acknowledgement.
- Current pending routine shampoo + same question says it is visible but still under review.
- Category-only routine shampoo + same question says exact product name is not known.
- A broad new shampoo recommendation while a pending shampoo exists does not revive the old pending card.
- Named new same-category product while pending product exists performs fresh lookup.
- Safety/scalp restricted turns still block product-first advice.
- Unknown product IDs and product facts claims without facts still fail hard.

## Verification

Focused first pass:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-current-care-context.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts
```

Pipeline pass:

```bash
./node_modules/.bin/tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-product-selection.spec.ts
```

Typecheck:

```bash
npm run typecheck
```

Chat quality/eval pass:

```bash
npm run test:chat
```

Before shipping a broad validator-diet branch:

```bash
npm run ci:verify
```

Repo-specific review gate:

- Run the `codex:codex-rescue` agent on the full branch diff before ship handoff, per `CLAUDE.md`.

Manual local prompts at `http://localhost:3480/chat`:

- "Hast du sonst Alternativen zu diesem Shampoo?"
- "Okay ja kannst du mir kurz sagen ob das zu mir passt?"
- "Du kennst ja das Shampoo, das ich gerade benutze, oder?"

For manual review, inspect trace fields:

- `failure_stage`
- `validation_errors`
- `bounded_repair_kind`
- `repair_attempts`
- `product_lookup_clarification`
- `productIntakeOffer`
- `answer_mode`
- `request_interpretation.product_request_kind`

## Stop Line

Do not implement until Nick explicitly approves this plan or chooses a modified direction.

Before implementation, resolve or explicitly defer:

- Product Decision #1 for current routine product acknowledgement wording.
- Product Decision #2 for alternatives after pending exact products.
- Product Decision #3 for resolved-product fit repair versus facts-unavailable fallback.
- Whether prompt-routing changes are in scope for this branch. Current recommendation: yes, but only after Phase 0 traces show routing failure.

Do not stage, commit, push, open PRs, run migrations, clean worktrees, or alter production data without explicit approval.

## Claude Review Handling

Review file: `plans/2026-07-03-agent-v2-validator-diet-audit.claude-review.md`

Accepted findings:

- Add a kill-switch before softening production validator behavior.
- Capture real failing traces before changing Phase 2 pending-context logic.
- Clarify that severity downgrade ownership must be consistent with `validation.ok`, `errors`, and `warnings`.
- Re-scope Phase 5 to extend `buildKnownIntentFallbackAnswer`, because the dispatcher already exists.
- Re-scope Phase 3 around the truthful fallback gap, because some `load_product_facts` repair mapping already exists.
- Add prompt-routing as an explicit possible fix when traces show the model chooses the wrong answer shape.
- Add chat eval and repo-specific review to verification for any shipping branch.

Rejected or deferred findings:

- Do not reduce this to only Phases 3 and 4 yet. The user specifically asked for a validator-diet audit, and the trace capture may still prove validator softening is needed.
- Defer exact implementation details for the kill-switch location until implementation starts and current config patterns are inspected.
