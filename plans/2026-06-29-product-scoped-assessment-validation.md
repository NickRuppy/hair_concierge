# Product-Scoped Assessment Validation Plan

> Status: implemented for validator scope; targeted validator test passing; broader runtime/lint/CI checks deferred.
> Created: 2026-06-29.
> Worktree: `.worktrees/product-intake-full-flow-smoke`.
> Parent context: follow-up hardening for `plans/2026-06-28-product-assessment-context-and-lookup.md`.
> Review: `plans/2026-06-29-product-scoped-assessment-validation.claude-review.md`.

## Goal

Make product assessment validation behave exactly like the user expects in conversation:

- If the user asks about a resolved product, Chaarlie can answer about that resolved product.
- If another product in conversation state is unresolved or pending, it must not block the resolved product answer.
- If the user asks about the unresolved product, Chaarlie must defer and point to the pending/intake state.
- If the user asks about both, Chaarlie may answer the resolved part and clearly defer only the unresolved part.

In simple terms: **validate the product the answer is actually about, not every product that happens to be remembered.**

## Problem

During local smoke testing, the user selected a trusted catalog product:

- `Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege`
- product id `d408aca9-cd16-4cb0-90e7-bab26a698000`
- category `shampoo`
- product specs existed in the database.

The model drafted a grounded product assessment, but the final-answer validator blocked it because the same persisted Agent V2 state also contained an unrelated pending `leave_in` product. The fallback then incorrectly told the user that the selected shampoo could not be assessed.

The immediate patch narrowed blocking by category. That fixed the tested cross-category damage, but it still leaves the harder same-category failure mode:

- resolved shampoo A claim -> validate against resolved shampoo A,
- pending shampoo B context -> ignore unless the answer actually claims about shampoo B,
- no cross-product/global blocking.

The correct behavior is product-scoped, not category-scoped.

## Locked Decisions

- Product assessment validation must be scoped to the product identity or product IDs the final answer actually assesses.
- `assessed_product_ids` is the primary explicit contract for resolved product assessment.
- Pending/unresolved active product contexts remain useful conversation memory, but they are not global blockers.
- The validator may still block when the answer makes claims about an unresolved/pending product by name, by category pronoun, or by clear context.
- For mixed turns, answering the resolved product and deferring the unresolved product is allowed.
- Deferring an unresolved product is not a product-specific claim. Example: "Zu Produkt A kann ich dir etwas sagen; Produkt B ist noch in Pruefung" must pass if Produkt A is resolved and Produkt B is only deferred.
- Do not add new user-facing cards, new statuses, or a new broad architecture layer in this patch.
- Do not hide the underlying possible state-isolation question. This plan fixes product-scoped behavior; a separate investigation can explain why unrelated pending context was present in the tested conversation state.

## Explicit Non-Goals

- Do not redesign active product context persistence.
- Do not implement semantic search or fuzzy-search improvements here.
- Do not redesign product selection cards.
- Do not change the product-intake review app.
- Do not create a durable routine mutation flow from chat.
- Do not solve possible cross-conversation state leakage in this patch unless the implementation uncovers a small, clearly local bug.

## Architecture Direction

Move from this coarse rule:

> Any unresolved product lookup/context can block product-specific claims.

To this scoped rule:

> Only unresolved lookup/context that corresponds to the product(s) being claimed about can block those claims.

The validator should build a small per-answer "claim target" view:

- resolved assessed product ids from `payload.assessed_product_ids` and `tool_grounding.product_ids`,
- visible product names in the answer,
- active product context used by the turn,
- lookup results from the current turn.

Then it validates only the pending/unresolved side of the boundary:

- Existing resolved-product grounding remains owned by `validateProductAssessmentGrounding` and related helpers. Do not create a second source of truth for resolved product trust.
- Each unresolved/pending product may block only if the answer claims about that unresolved product.
- Unrelated unresolved/pending products are ignored for that answer.

The implementation should update both uses of `unresolvedLookupResultMatchesPendingCategoryAssessment` in `final-answer-validator.ts`: the relevance filter and the product-specific-claim check. Updating only one call site can leave the old behavior half-alive.

## Target File Map

- `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Extract product claim-target logic out of broad unresolved lookup checks.
  - Replace category-only pending assessment matching with product-scoped matching.
  - Keep category as a fallback signal only when no product id/name signal exists and the answer clearly claims about the pending product.
  - Update both call sites that currently rely on pending-category assessment matching.

- `tests/agent-v2-final-answer-validator.spec.ts`
  - Add regressions for product-scoped allow/block behavior.
  - Reuse or extend the already-added cross-category regression; do not duplicate it as new proof.
  - Make same-category resolved-vs-pending behavior the headline proof.

- `tests/agent-v2-responses-runtime.spec.ts` or `tests/agent-v2-product-selection.spec.ts`
  - Add one runtime-level regression if there is already a cheap seam for selected-product follow-up:
    - selected DB product is assessed despite unrelated pending product context.

- `src/lib/agent-v2/runtime/responses-agent.ts`
  - Only touch if prompts need one concise reminder that active product contexts are independent targets, not a global blocker.

## Implementation Tasks

### 1. Capture Current Failure As Tests

- [x] Keep the existing cross-category regression as a guardrail:
  - final answer is `product_assessment`,
  - `assessed_product_ids` contains the resolved shampoo id,
  - lookup/context contains an unrelated pending `leave_in`,
  - answer claims only about the shampoo,
  - expected: no `product_lookup_unresolved` error.

- [x] Add the headline same-category validator regression:
  - resolved shampoo A exists in `assessed_product_ids`,
  - unresolved/pending shampoo B exists in lookup/context,
  - answer claims only about resolved shampoo A,
  - expected: no `product_lookup_unresolved` error.

- [x] Add a same-category blocking regression:
  - resolved shampoo A and pending shampoo B both exist,
  - answer makes a fit/detail claim about pending shampoo B,
  - expected: `product_lookup_unresolved` blocks.

- [x] Add a mixed-answer regression:
  - answer assesses resolved shampoo A,
  - answer explicitly defers pending shampoo B as still under review,
  - expected: allowed.

- [x] Add a mixed-answer blocking regression:
  - answer assesses resolved shampoo A,
  - answer also makes a positive or negative suitability/detail claim about pending shampoo B,
  - expected: `product_lookup_unresolved` blocks for shampoo B.

### 2. Introduce Product Claim Targets

- [x] Add a small internal helper in `final-answer-validator.ts`, for example:
  - `buildProductAssessmentClaimTargets(answer, context)`
  - `unresolvedLookupResultMatchesClaimTarget(result, targets)`

- [x] Product target matching should prefer exact IDs:
  - `assessed_product_ids`,
  - `tool_grounding.product_ids`,
  - exact lookup product ids,
  - trusted selected product id,
  - active resolved product ids.

- [x] Name/category fallback should be conservative:
  - only use visible product-name matching or clear "this product" continuity when no id signal is available,
  - do not let generic category mentions like "Conditioner und Leave-in" falsely bind to every pending product in that category.

- [x] Add a small deferral-vs-claim detector for unresolved products:
  - split `user_facing_answer_de` into sentence-like chunks,
  - match the unresolved product only against the chunk(s) that mention that product or clearly refer to it,
  - treat chunks with deferral language as non-claims when they do not also contain a product-claim predicate.

- [x] Deferral language should include German forms such as:
  - `noch in Prüfung`,
  - `prüfen wir noch`,
  - `kann ich noch nicht bewerten`,
  - `melde mich / melden uns`,
  - `liegt noch nicht vor`,
  - `ist noch offen`.

- [x] Product-claim predicates should still block for unresolved products when the same chunk says things like:
  - `passt`,
  - `geeignet`,
  - `würde ich verwenden/empfehlen`,
  - `reinigt mild`,
  - `beschwert nicht`,
  - `spendet Feuchtigkeit`,
  - `enthält/ist frei von` as a product-specific fact.

### 3. Replace Global Pending Blocking

- [x] Update `validateProductLookupResultClaims` so unresolved results are relevant only when they match a claim target.
- [x] Replace or narrow `unresolvedLookupResultMatchesPendingCategoryAssessment` so category alone is not enough to block a resolved product assessment.
- [x] Update both current call sites of that matching logic:
  - the unresolved-result relevance filter,
  - the product-specific-claim check.
- [x] Keep the existing resolved-side trust checks in `validateProductAssessmentGrounding`; this patch should not duplicate or weaken them.
- [x] Ensure a pending `leave_in` can still block an actual leave-in assessment.
  - Covered by the unresolved product-assessment guardrails plus the new pending-product claim detector; this behavior is status/claim scoped, not category-special-cased.
- [x] Ensure a pending shampoo can still block an actual claim about that same pending shampoo.
- [x] Ensure unresolved/not-found lookup for the named product still blocks product-specific claims and triggers intake/clarification behavior.

### 4. Runtime Guard Against Bad Fallback

- [ ] Add or update one runtime regression for the real smoke shape:
  - trusted selection creates resolved active context,
  - previous state also has unrelated pending context,
  - follow-up "passt das zu mir?" produces product-assessment wording, not "Produktdaten fehlen".

- [x] If a runtime seam is too expensive, document why and keep the validator regression as the controlling proof.

  Deferred in this implementation because the approved write scope is limited to the validator,
  its validator test, and this plan status/checklist. The validator regression is the controlling
  proof for this patch.

### 5. Verification

Status for this implementation:

- [x] Red run captured `product_lookup_unresolved` failures for same-category resolved-vs-pending and mixed-deferral validator regressions before production changes.
- [x] `npx tsx --test tests/agent-v2-final-answer-validator.spec.ts` passes after the validator change.
- [x] `git diff --check -- src/lib/agent-v2/validation/final-answer-validator.ts tests/agent-v2-final-answer-validator.spec.ts plans/2026-06-29-product-scoped-assessment-validation.md` passes.
- [x] `npx tsx --test tests/agent-v2-product-selection.spec.ts` passes.
- [x] `npx tsx --test tests/agent-v2-responses-runtime.spec.ts` passes.
- [x] `npm run lint` passes with pre-existing warnings only.
- [x] `npm run typecheck` passes.
- [x] `npm run ci:verify` passes.
- [ ] Browser smoke remains pending/manual because the code change is validator-scoped and the local app is already in active user testing.

Run targeted checks:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-product-selection.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npm run lint
npm run typecheck
npm run ci:verify
git diff --check -- src/lib/agent-v2/validation/final-answer-validator.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-product-selection.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Then run a local browser smoke:

1. Ask about an ambiguous existing DB product.
2. Select one candidate.
3. Ask "passt das zu mir?"
4. Confirm the answer assesses the selected product.
5. Submit or preserve an unrelated pending product context.
6. Repeat the selected-product follow-up and confirm the pending product does not block the resolved answer.

## Accepted Deviation Log

- 2026-06-29: Accepted Claude plan-review findings:
  - same-category resolved-vs-pending is the headline proof, not the already-covered cross-category case,
  - mixed answers require a concrete deferral-vs-claim mechanism,
  - both pending-category matcher call sites must be updated,
  - verification should include lint and `npm run ci:verify`.

## Open Risks

- If the unrelated pending context truly came from a different visible conversation, this plan does not fully explain the state origin. It only ensures such unrelated context cannot corrupt a resolved product assessment.
- Product-name matching is inherently fuzzy. The implementation should prefer IDs and use name/category matching only as a fallback.
- Deferral-vs-claim detection is still language-based and must stay conservative. If a sentence both defers and claims about an unresolved product, block it.

## Handoff

Recommended execution mode: sequential or one small subagent for test-surface exploration. The code changes are concentrated in the final-answer validator, so main-thread integration should own the implementation.

Stop before staging, committing, pushing, or opening a PR unless Nick explicitly approves.
