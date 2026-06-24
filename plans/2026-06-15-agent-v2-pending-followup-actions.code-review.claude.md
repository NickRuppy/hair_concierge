I have completed a thorough review. I verified the focused suite (274 tests) and remaining agent-v2 specs (58 tests) pass, `tsc --noEmit` is clean, ESLint is clean, the rename is fully contained within `agent-v2` (no external/UI/API consumers), and the legacy-migration paths are correct and covered. Here is the report.

---

# Code Review — HAI-119 `pending_followup_action`

## Summary

A clean, well-tested refactor that generalizes the narrow `pending_routine_action` into a single `pending_followup_action` (kinds: `product_recommendation`, `advisor_response`, `routine_mutation`) and makes short confirmations (`Ja`, `gerne`, `mach das`, …) resolve against structured state instead of prose. Schema rename is fully contained, legacy migration is handled defensively before strict Zod parsing, and all AgentV2 suites are green. No correctness-breaking bugs found. The findings below are behavioral/contract-consistency risks and test-coverage gaps, ordered by severity.

---

## Findings

### 1. (Medium) Validator enforces an unconditional biconditional that contradicts the prompt guidance for `next_step_offer_de`

`validatePendingFollowupAction` (`src/lib/agent-v2/validation/final-answer-validator.ts:1653-1690`) makes the relationship strictly biconditional: any non-empty `next_step_offer_de` **requires** a `pending_followup_action`, and vice versa (`pending_followup_action_missing` / `pending_followup_action_hidden`, both `severity: "block"`).

But the model-facing guidance does **not** describe `next_step_offer_de` as always being a confirmable offer:

- `responses-agent.ts:1135`: *"next_step_offer_de … must mirror or **summarize the visible final move** in user_facing_answer_de"* — i.e. it may be a recap, not a forward offer.
- `responses-agent.ts:1150`: *"If next_step_offer_de is non-null **and asks the user to continue**, choose a matching pending_followup_action"* — the pending action is conditioned on "asks the user to continue."

A model that follows the guidance literally — emitting a summarizing `next_step_offer_de` that does *not* ask the user to continue (e.g. *"Damit ist deine Basisroutine vollständig."*) and correctly sets `pending_followup_action: null` per line 1150 — gets **hard-blocked** by `pending_followup_action_missing`. Two bad outcomes follow:
- **Repair churn / fallbacks** (the plan's "Open Risks → Repair churn" anticipates blocking but the contradictory prompt text at 1135/1150 was never reconciled), or
- the model learns to **fabricate a `pending_followup_action`** to satisfy the validator, which then makes the *next* bare "Ja" wrongly resolve to an action the user never intended.

**Recommendation:** Reconcile the contract — either tighten `responses-agent.ts:1135` so `next_step_offer_de` is defined strictly as a forward, user-confirmable offer (drop the "summarize the visible final move" framing), or relax the validator so a recap-style offer is permitted without a pending action. Given the explicit non-goal of a German prose parser, aligning the guidance text is the lower-risk fix.

### 2. (Low) Short-confirmation clarification override now fires for acknowledgement tokens, not just "Ja"

`shortConfirmationWithoutPendingFollowup` (`responses-agent.ts:248-250`) plus the override at `responses-agent.ts:514-519` discard **any** non-`clarification` model answer and replace it with a clarification question whenever the message matches `hasShortRoutineActionConfirmation` and there is no pending action.

That regex (`responses-agent.ts:1498`) matches not only `ja`/`gerne` but also `ok`, `okay`, `passt`, `genau` (pre-existing) and newly-added standalone `gerne`. Previously these tokens only gated the *routine tool policy*; now they also force a clarification. For pure acknowledgements ("passt", "ok") with no pending offer, the user can receive an unwanted *"Was genau möchtest du, dass ich tue?"* in response to what was effectively "sounds good."

The behavior is correctly bounded (only when `pending_followup_action` is null, which for a well-formed prior turn means there genuinely was no offer), and is the intended safety net (verified exercised by `tests/agent-v2-responses-runtime.spec.ts:2638`). But confirm this is desired for the non-`ja` acknowledgement tokens — forcing a clarification on "passt"/"ok" may read as broken UX.

### 3. (Low, transient) In-flight conversations with a prior *product* offer regress at deploy

Legacy `pending_routine_action` only ever captured routine actions, so `legacyRoutineActionToFollowup` (`src/lib/agent-v2/pending-followup-action.ts:10`) always migrates to `kind: "routine_mutation"`. A conversation that, pre-deploy, ended with a *product recommendation* offer has no legacy pending state to migrate (it was `null`). Post-deploy, a user replying "Ja bitte" to that product offer hits `shortConfirmationWithoutPendingFollowup` → forced clarification instead of continuing the recommendation. Bounded to the deploy window and arguably acceptable, but worth noting for rollout.

### 4. (Minor) Observability gap on the override path

The override at `responses-agent.ts:518` returns `buildCurrentClarificationFallback()` with `trace.failure_stage` left `null` and no distinguishing marker. Short-confirmation overrides are therefore indistinguishable from genuine model clarifications in traces/evals, which makes the "watch repair rates / adoption" open risks harder to monitor. Consider tagging the trace when this override fires.

### 5. (Minor) Override only enforced on the `validation.ok` path

The "bare confirmation → ask clarification" rule (`responses-agent.ts:514`) sits inside the `if (validation.ok)` branch. If the model's answer *fails* validation and the runtime resolves to a non-`clarification` known-intent fallback (`responses-agent.ts:542-551`), a non-`clarification` answer can still be returned for a bare confirmation with no pending action. Low impact (the fallback is itself a safe non-mutating answer), but the invariant isn't uniformly enforced.

---

## Test coverage assessment

Strong overall. Verified:
- Legacy migration covered for persisted state (`tests/agent-v2-production-chat-pipeline.spec.ts:431`) and Compare Lab (`tests/agent-v2-compare-runner.spec.ts:264`).
- All four short-confirmation behaviors covered (product / advisor / routine-mutation / no-pending) and the override-to-clarification path is exercised via `tests/agent-v2-responses-runtime.spec.ts:2638`.
- Validator invariants (`*_missing` / `*_hidden` / `*_invalid_fields`) covered.

Gaps worth closing:
- **No test pins the Finding #1 contradiction**: a valid answer with an informational/recap `next_step_offer_de` and `pending_followup_action: null`. Today that combination is silently `block`ed; a test would force an explicit decision on whether recap offers are legal.
- **No test for acknowledgement tokens** (`ok`, `passt`, `genau`) under the override (Finding #2) — only `ja`/`ja bitte` paths are tested. A test would lock in the intended UX.

---

## Residual risk

The change is internally consistent and green across typecheck/lint/tests, with the rename fully contained. The principal residual risk is **prompt-vs-validator contract drift (Finding #1)** driving repair churn or model-fabricated pending actions in production — this is exactly what the plan's "Repair churn" and "Model adoption" open risks flag, and it should be watched in eval/rollout metrics. The deterministic guardrails (routine-tool authorization gated on `kind === "routine_mutation"` with category/layer/action match at `responses-agent.ts:1232-1283`, and `boundary_answer_no_side_effects` at `final-answer-validator.ts:1706`) are sound and correctly migrated.
