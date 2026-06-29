# Product Selection Architecture Cleanup Plan

Date: 2026-06-25

Status: Implementation complete. A local checkpoint commit was created before this
behavior-preserving refactor. Phases 1-6 are implemented, review findings have been addressed, and
targeted tests are passing.

Claude review:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-selection-architecture-cleanup.claude-review.md`

Related implementation plan:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-lookup-clarification-card.md`

## Goal

Clean up the product lookup clarification implementation before shipping it, so the product the
user selected has one canonical source object and product lookup outcome logic no longer lives as
scattered branches inside the main AgentV2 production chat pipeline.

In plain language: after the user taps a product candidate card, the app should have one official
truth for "this is the product the user selected", and every layer should derive from that truth.

## Why This Cleanup Is Required Before Shipping

The feature behavior is currently verified, but the structural review found that the implementation
spreads product-selection meaning across too many layers:

- `messages.rag_context.product_lookup_selection`
- persisted active resolved product state
- AgentV2 trusted selected product context
- product-selection route-local conversion
- validator selected-product exceptions
- product lookup card/intake/fallback logic inside `chat-pipeline.ts`

This already produced real bugs during review:

- a selected category-mismatch candidate could be grounded as the originally requested category
- a resolved clarification card could be clicked again with a different candidate

Those bugs are patched, but the architecture still makes similar regressions too easy. This cleanup
is therefore required before shipping the product lookup clarification PR.

## Settled Decisions

- Use **Option A: Product Domain Owns The Canonical Model**.
- The canonical selected-product model lives in the product/catalog domain.
- AgentV2-specific adapters live next to AgentV2, not inside the product-domain model.
- Extract a bounded product lookup turn outcome builder from `chat-pipeline.ts`.
- Split product lookup/selection tests into focused files.
- Do **not** refactor the general chat streaming/persistence lifecycle in this pass.
- Do **not** change the user-facing UX or copy except where unavoidable during extraction.

## Target Architecture

### 1. Product Domain Canonical Model

Create:

```text
src/lib/product-intake/resolved-product-selection.ts
```

This module owns the canonical selected-product shape.

Suggested type:

```ts
export type ResolvedProductSelection = {
  source: "product_lookup_clarification"
  clarificationId: string
  sourceAssistantMessageId: string
  originalUserMessage: string
  selectedProduct: {
    id: string
    name: string
    category: string | null
  }
  lookupIdentity: {
    category: string | null
    brandText: string | null
    productNameText: string | null
    evidenceQuote: string | null
  }
}
```

The exact field names may change during implementation, but the invariant must not:

> One product-domain object is the source for selected-product message metadata, active resolved
> product state, AgentV2 runtime context, and validator grounding.

This module may include product-domain helpers such as:

- build a `ResolvedProductSelection` from a persisted clarification card, selected candidate, and
  selected product row
- compare whether an existing persisted selection resolves the same source card
- derive stable selection key inputs by reusing/moving the existing route helper rather than
  inventing a second idempotency scheme
- normalize nullable category/name fields by reusing/moving the existing route logic rather than
  inventing a second normalizer

This module must not import AgentV2 runtime types.

### 2. AgentV2 Shared Adapter Module

Create:

```text
src/lib/agent-v2/resolved-product-selection-adapter.ts
```

This module converts the product-domain model into AgentV2-specific shapes:

- `AgentV2TrustedSelectedProductContext`
- `AgentV2ActiveResolvedProductContext`
- selected-product projection for prior selected products
- trusted `found_exact` lookup validation result if that remains the right boundary

The product-domain model stays clean; AgentV2 owns AgentV2-specific conversion.

This module must **not** live under `src/lib/agent-v2/production/`. The runtime currently imports
downstream into production, so placing runtime-needed helpers in `production/` would create a
`runtime -> production -> runtime` cycle.

The adapter module should also become the single home for AgentV2 selected-product context types
that are currently duplicated or route-local.

### 3. Product Lookup Turn Outcome Builder

Create one focused module for product lookup outcome decisions, for example:

```text
src/lib/agent-v2/production/product-lookup-turn-outcome.ts
```

Move product lookup/card/intake/fallback outcome logic out of `chat-pipeline.ts`.

It should own the logic that currently decides or builds:

- product lookup executions captured from tool calls
- trace recovery for lookup calls when fallback/repair paths hide local executions
- deterministic named-product lookup fallback
- recovered not-found product fallback
- `product_intake_offer`
- `product_lookup_clarification`
- candidate list and category-mismatch card payloads
- active resolved product clearing/replacement decision
- selected-product stored projection, via the AgentV2 adapter

Target shape:

```ts
type ProductLookupTurnOutcome = {
  productIntakeOffer: ProductIntakeOffer | null
  productLookupClarification: ProductLookupClarification | null
  fallbackAnswer: AgentV2TerminalAnswer | null
  nextActiveResolvedProductContext: AgentV2ActiveResolvedProductContext | null
  priorSelectedProductProjection: AgentV2StoredProductProjection | null
}
```

The exact output can differ, but the ownership should be clear:

- `chat-pipeline.ts` orchestrates the overall chat turn
- `product-lookup-turn-outcome.ts` decides product lookup outcomes

### 4. Narrow Selection Route Cleanup

Keep:

```text
src/app/api/chat/product-selection/route.ts
```

Do not merge it into `/api/chat` in this cleanup.

But change it to use the canonical product-domain model:

- validate user-owned conversation first
- load source assistant message constrained by conversation
- read persisted clarification card from assistant message metadata
- validate selected candidate and selected product row
- build `ResolvedProductSelection`
- derive message metadata and AgentV2 trusted context from that model
- preserve current single-use replay behavior
- preserve current stable assistant-message ID behavior

### 5. Test Split

The current production chat pipeline test file is too large and hides the product-specific scenario
structure. Move only the product lookup/selection tests touched by this feature into focused files.

Suggested new files:

```text
tests/agent-v2-product-lookup-clarification.spec.ts
tests/agent-v2-product-selection.spec.ts
tests/agent-v2-active-resolved-product.spec.ts
```

Keep unrelated production pipeline tests in:

```text
tests/agent-v2-production-chat-pipeline.spec.ts
```

Do not rewrite test semantics. This is a movement/extraction cleanup with behavior-preserving
assertions.

## Non-Goals

- No general assistant-turn service extraction.
- No broad `/api/chat` streaming or persistence refactor.
- No UX redesign of the clarification card.
- No product database schema changes.
- No new product submission/review behavior.
- No broad validator philosophy rewrite.
- No attempt to solve unrelated lint warnings.

## Implementation Checklist

### Phase 1: Canonical Model And Duplicate-Type Inventory

- [x] Add `src/lib/product-intake/resolved-product-selection.ts`.
- [x] Define `ResolvedProductSelection`.
- [x] Add helpers for:
  - [x] building from clarification/candidate/product row
  - [x] converting to persisted `ProductLookupSelectionContext`
  - [x] checking whether a card already has a persisted selection
  - [x] producing stable selection key inputs by reusing/moving the existing route helper rather
    than inventing a second idempotency scheme
- [x] Add focused unit tests for the helpers.
- [x] Before moving code, explicitly inventory and collapse these duplicate or divergent types:
  - [x] `AgentV2ActiveResolvedProductContext` in
    `src/lib/agent-v2/runtime/responses-agent.ts`
  - [x] `AgentV2ActiveResolvedProductContext` in
    `src/lib/agent-v2/production/persisted-session-state.ts`
  - [x] `AgentV2StoredProductProjection` in
    `src/lib/agent-v2/production/persisted-session-state.ts`
  - [x] `AgentV2StoredProductProjection` in
    `src/lib/agent-v2/production/chat-pipeline.ts`
- [x] Choose one exported home for each collapsed AgentV2 type before extracting the outcome
  builder. Do not leave same-named local aliases with divergent shapes.

### Phase 2: AgentV2 Adapters

- [x] Add `src/lib/agent-v2/resolved-product-selection-adapter.ts`.
- [x] Move shared selected-product context types out of runtime/production-local declarations and
  into an AgentV2 shared module that both runtime and production can import without cycles.
- [x] Move or wrap selected-product conversion logic from:
  - [x] `src/lib/agent-v2/runtime/responses-agent.ts`
  - [x] `src/lib/agent-v2/production/chat-pipeline.ts`
  - [x] `src/app/api/chat/product-selection/route.ts`
- [x] Preserve the current active-to-trusted transform exactly:
  - [x] persisted active context source is `product_lookup_selection`
  - [x] runtime trusted context source is `product_lookup_clarification`
  - [x] active follow-up lookup identity currently synthesizes `brand_text: null`,
    `product_name_text: selected product name`, and `evidence_quote: selected product name`
- [x] Ensure validator grounding still receives equivalent trusted selected-product data.
- [x] Preserve current trust boundary:
  - [x] identity selection is trusted
  - [x] detailed product-property and suitability claims still require normal product-tool grounding
- [x] Add or keep assertion-level tests proving adapter output is equivalent to the current inline
  trusted lookup/projection shape for fixed representative inputs.

### Phase 3: Product Lookup Turn Outcome Extraction

- [x] Add `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`.
- [x] Move product lookup helper functions out of `chat-pipeline.ts`.
- [x] Keep the public behavior unchanged:
  - [x] `not_found` creates intake offer only when structured lookup metadata supports it
  - [x] `needs_variant_selection` creates clarification card
  - [x] `category_mismatch` creates mismatch clarification card
  - [x] background product mentions do not render intake/cards
  - [x] active resolved product follow-ups do not re-render stale cards
- [x] Reduce `chat-pipeline.ts` to orchestration calls and state assembly.

### Phase 4: Selection Route Uses Canonical Model

- [x] Refactor `src/app/api/chat/product-selection/route.ts` to build `ResolvedProductSelection`.
- [x] Derive:
  - [x] `product_lookup_selection` message metadata
  - [x] trusted selected product context for AgentV2
  - [x] stable selection assistant-message ID inputs
- [x] Preserve:
  - [x] user-owned conversation check before source message lookup
  - [x] source message constrained by conversation
  - [x] selected candidate must belong to persisted card
  - [x] selected product must be active/eligible
  - [x] card is single-use per source assistant message + clarification
  - [x] duplicate-key replay returns canonical persisted metadata

### Phase 5: Test Split

- [x] Start this phase only after Phases 1-4 are green. Do not let test movement obscure behavior
  changes from the architecture extraction.
- [x] Move product lookup clarification tests into a focused file.
- [x] Move product-selection route/replay tests into a focused file.
- [x] Move active resolved product follow-up tests into a focused file if this reduces fixture churn.
- [x] Keep shared fake builders small and local unless reuse is clearly needed.
- [x] Verify no test coverage is lost by checking old test names against moved test names.
- [x] Run focused tests before and after movement. If movement causes fixture churn that obscures the
  behavior-preserving extraction, stop and bring the split scope back for user decision.

### Phase 6: Plan And Review Evidence

- [x] Update `plans/2026-06-25-product-lookup-clarification-card.md` to reference this cleanup as
  completed before ship.
- [x] Record accepted/deferred structural findings in this plan.
- [x] Run final code review after cleanup.
- [x] Run at least one non-product chat smoke/eval because this refactor touches the shared AgentV2
  runtime/pipeline path, not only product lookup turns.

## Required Verification

Run at minimum:

```bash
npm run test:chat
npx tsx --test tests/product-intake-lookup.test.ts
npx tsx --test tests/agent-v2-contracts.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-v2-named-product-context.spec.ts
npx tsx --test tests/product-intake-replay-user-product-usage-lookup.spec.ts
npx tsx --test tests/chat-product-mentions.test.tsx
npm run typecheck
git diff --check
npm run ci:verify
```

If tests are split, run the new focused files explicitly as well.

Verification evidence from implementation:

- Passed: `npx tsx --test tests/resolved-product-selection.test.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts`.
- Passed after final review hardening: `npx tsx --test tests/agent-v2-resolved-product-selection-adapter.spec.ts`.
- Passed after final review hardening: `npx tsx --test tests/agent-v2-resolved-product-selection-adapter.spec.ts tests/agent-v2-product-selection.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts` (68/68).
- Passed: `npx tsx --test tests/agent-v2-product-selection.spec.ts`.
- Passed: `npx tsx --test tests/agent-v2-product-selection.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts`.
- Passed: `npx tsx --test tests/product-intake-lookup.test.ts tests/product-intake-replay-user-product-usage-lookup.spec.ts tests/chat-product-mentions.test.tsx tests/resolved-product-selection.test.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts`.
- Passed: `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-named-product-context.spec.ts tests/agent-v2-product-selection.spec.ts tests/agent-v2-product-lookup-clarification.spec.ts`.
- Passed: `npm run typecheck`.
- Passed: `npm run lint` with existing warnings outside this cleanup.
- Passed: `git diff --check`.
- Passed: `npm run ci:verify` with existing warnings outside this cleanup.
- Not applicable locally as a bare command: `npm run test:chat` targets the default eval server on
  `localhost:3000`, where no server was listening in this worktree.
- Passed on the active worktree server: `npx tsx scripts/eval-chat/run.ts --skip-judge --base-url
  http://localhost:3543` completed 16/16 scenarios and 100/100 assertions. Report:
  `test-results/chat-eval/chat-eval-2026-06-25T18-37-35.json`.

Manual/browser smoke after cleanup:

- same-category candidate card still renders
- category-mismatch candidate card still renders
- `Nein, mein Produkt hinzufügen` still reveals the prefilled intake card
- candidate click still acknowledges the selected product
- follow-up such as `und wie oft?` still refers to the selected product
- selecting another candidate from an already resolved old card replays the canonical answer
- plain non-product chat still behaves normally and does not receive product lookup metadata

## Review Gates

- Claude plan review before implementation.
- `$superpowers:requesting-code-review` after implementation.
- Claude code review after implementation.
- Browser/simulated-user smoke before shipflow if any behavior-adjacent code moved.

## Accepted Structural Review Findings

- Accepted: product lookup policy should not be absorbed into `chat-pipeline.ts`.
- Accepted: selected-product continuity needs one canonical state model.
- Accepted: product-selection endpoint should avoid growing a separate semantic model beside
  `/api/chat`.
- Deferred: extracting a shared assistant-turn streaming/persistence service. This is a valid
  future cleanup, but out of scope for this pre-ship pass because it touches the sensitive general
  chat lifecycle.
- Accepted as scoped cleanup: client stream handling can keep its current shape unless the
  extraction naturally creates a small `mergeAssistantRagContext` helper.
- Accepted: split product lookup/selection tests out of the giant production pipeline spec.
- Accepted from final code review: add a direct adapter unit test for active resolved product
  precedence (`trusted selected product` > `deterministic lookup` > `clear on new actionable
  product` > `previous active product`).
- Classified from final code review: route-level string trimming/null normalization is acceptable
  and preferable for product identity metadata.
- Classified from final code review: an earlier `vague-first-message` chat eval failure was outside
  product selection cleanup because it had no product lookup, selection, intake card, or product
  clarification involvement. The latest active-server eval now passes this scenario.

## Claude Review Finding Classification

- Accepted: adapter module must not live in `agent-v2/production` if runtime imports it. The plan
  now places the adapter in shared `agent-v2/`.
- Accepted: explicitly collapse the duplicate `AgentV2ActiveResolvedProductContext` declarations and
  divergent `AgentV2StoredProductProjection` declarations.
- Accepted: document the active-to-trusted selected-product transform so it is preserved exactly.
- Accepted: add assertion-level adapter equivalence tests.
- Accepted: add non-product chat verification because the shared pipeline/runtime path is touched.
- Accepted with sequencing adjustment: test split remains required before ship because the user chose
  it, but it happens after Phases 1-4 are green.
- Deferred: broad assistant-turn streaming/persistence service extraction remains out of scope.
- Needs user decision: Claude recommends a local checkpoint commit before the refactor because the
  current feature is green but uncommitted. This plan keeps the no-commit rule until the user gives
  explicit approval.

## Handoff Notes

This is a behavior-preserving architecture cleanup. If an implementation step changes visible chat
behavior, stop and classify whether it is a bug fix, accidental behavior change, or product decision
before continuing.

Do not stage, commit, push, or open a PR without explicit approval.
