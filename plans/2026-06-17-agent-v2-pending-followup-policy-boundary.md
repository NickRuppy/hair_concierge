# Agent V2 Pending Follow-Up Policy Boundary Implementation Plan

Required sub-skills: test-driven-development, subagent-driven-development, verification-before-completion

## Goal

Harden the Agent V2 `pending_followup_action` contract before shipping by making pending follow-up state typed, single-purpose, and owned by one policy boundary.

The branch already supports generalized pending follow-up actions for short confirmations such as "Ja bitte". This patch cleans up the structure so the feature does not remain a broad nullable field bag plus scattered runtime checks.

## Aligned Decisions

- Use a strict discriminated union at the model-facing schema if generated strict tool schema remains valid. If tool schema generation fails, fall back to keeping the model-facing schema compatible and normalizing immediately into the strict internal union.
- Keep strict single-action meanings:
  - `product_recommendation`: recommend concrete products.
  - `advisor_response`: continue with advice/explanation; no routine mutation authorization.
  - `routine_mutation`: create/change/add/remove/replace/simplify routine.
- Move pending follow-up state policy into `src/lib/agent-v2/pending-followup-action.ts`.
- Keep German offer-text inference as A-lite guardrails only: catch obvious visible/hidden drift, do not build a full deterministic language parser.
- Add focused pending follow-up contract tests instead of growing large integration fixtures further.

## Non-Goals

- Do not add compound actions such as `recommend_and_add_to_routine`.
- Do not redesign payloads into `next_step_offer: { text_de, action }`.
- Do not tune conversational offer frequency in this patch.
- Do not remove existing runtime/validator integration tests unless they are clearly redundant after focused contract tests exist.

## Implementation Steps

### 1. Strengthen The Pending Action Schema

File:

- `src/lib/agent-v2/contracts.ts`

Replace the broad `AgentV2PendingFollowupActionSchema` object with a discriminated union:

- `product_recommendation`
  - `category`: concrete care category, not `none`, not `unknown`
  - `routine_layer`: `null`
  - `routine_action`: `null`
  - `source`: `"assistant_offer"`

- `advisor_response`
  - `category`: `AgentV2CareCategorySchema.nullable()`
  - `routine_layer`: `AgentV2RoutineLayerSchema.nullable()`
  - `routine_action`: `null`
  - `source`: `"assistant_offer"`

- `routine_mutation`
  - `category`: `AgentV2CareCategorySchema.nullable()`
  - `routine_layer`: `AgentV2RoutineLayerSchema.nullable()`
  - `routine_action`: non-null enum of routine mutation actions
  - `source`: `"assistant_offer"`

Run the existing tool-schema tests after this step. If strict JSON schema generation cannot support the nested union cleanly, preserve the model-facing schema and introduce an internal strict parser/normalizer in `pending-followup-action.ts`.

### 2. Make `pending-followup-action.ts` The Policy Owner

File:

- `src/lib/agent-v2/pending-followup-action.ts`

Expand this module so it owns:

- legacy `pending_routine_action` conversion
- `readPendingFollowupAction(value)`
- `isPendingRoutineMutation(action)`
- `doesRoutineCallMatchPendingAction(args, action)`
- `resolvePendingRoutineMutationPolicy({ message, routineThreadContext })`
- optional short model guidance helper for pending follow-up context if it removes duplication from runtime

This module should answer: "What does this pending action authorize?"

It should not own German visible-offer text heuristics. Those stay in the final-answer validator as conservative drift checks.

### 3. Slim Runtime Ownership

File:

- `src/lib/agent-v2/runtime/responses-agent.ts`

Replace local pending-followup policy helpers with imports from `pending-followup-action.ts`.

Keep runtime orchestration responsible for:

- calling the policy helper
- passing resulting policy into tool authorization
- injecting model context/guidance

Avoid changing behavior beyond the policy boundary extraction.

### 4. Keep Validator Guardrails Conservative

File:

- `src/lib/agent-v2/validation/final-answer-validator.ts`

Keep A-lite visible/hidden checks:

- `next_step_offer_de` must be visibly rendered when present.
- `pending_followup_action` must not exist without visible offer text.
- visible offer and hidden action must not obviously disagree on kind/category.
- no German parser expansion beyond obvious product/routine/category drift.

After the discriminated union, remove validator checks that only duplicate schema-level invariants if they become unreachable, unless keeping the diagnostic materially improves repair output.

### 5. Add Focused Contract Tests

New file:

- `tests/agent-v2-pending-followup-action.spec.ts`

Cover:

- valid schema variants
- invalid schema variants:
  - product recommendation with routine fields
  - advisor response with routine action
  - routine mutation without routine action
  - product recommendation with `category: "none"` or `"unknown"`
- legacy pending routine action conversion
- routine mutation guard
- routine call matching:
  - category/layer/action match
  - category mismatch
  - layer mismatch
  - action mismatch
- non-routine pending actions do not authorize routine mutation
- short confirmation without routine mutation pending action is denied

Keep existing validator/runtime tests for end-to-end behavior, but avoid adding more giant object fixtures unless needed.

## Verification

Run:

```bash
npx tsx --test tests/agent-v2-pending-followup-action.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-contracts.spec.ts
npm run test:agent
npm run ci:verify
git diff --check
```

If the schema branch changes tool JSON shape, specifically inspect/verify the `submit_final_answer` schema tests.

## Handoff Criteria

The patch is ready for review when:

- invalid pending action field combinations fail at schema or immediate policy normalization boundary
- runtime no longer owns routine pending-action matching directly
- `pending-followup-action.ts` owns pending follow-up authorization policy
- validator remains a conservative visible/hidden drift guardrail, not a growing German semantic parser
- focused contract tests make the pending follow-up state model easy to understand
