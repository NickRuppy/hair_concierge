# Card-Aware Product Lookup Copy Plan

## Implementation Goal Contract

Goal: make unresolved product lookup turns feel like one coherent chat flow by letting the agent compose the visible assistant answer from structured lookup/card status instead of replacing it with broad hardcoded copy.

Branch/worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke` on `codex/product-intake-full-flow-smoke`.

Execution mode: sequential unless implementation uncovers separable test-only or copy-only work. Main thread owns runtime and validator changes.

Stop line: do not stage, commit, push, open a PR, apply migrations, or clean the worktree without explicit approval.

## Source Context

Current runtime shape:

- `src/lib/agent-v2/runtime/responses-agent.ts` gives the model product lookup tool guidance and validates final answers.
- `lookup_product_candidate` already returns structured statuses such as `found_exact`, `not_found`, `needs_variant_selection`, `category_mismatch`, `insufficient_identity`, and `unsupported_category`.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts` attaches `productIntakeOffer` or `productLookupClarification` after the model has produced `user_facing_answer_de`.
- `src/app/api/chat/route.ts` streams the assistant text and then sends the structured card event.
- Recent smoke showed duplicated/repetitive copy because the model wrote a full unresolved-product explanation and the card also explained the same action. One exact duplicate came from a repair run.
- Current success path already preserves the model answer. `product-lookup-turn-outcome.ts` only overwrites answer copy for visible failure fallback or deterministic lookup-recovery fallback. Those safety nets must stay.

Important design correction:

- The agent should remain the author of the visible German answer whenever the model turn succeeds.
- Code should not add new replacement copy for normal successful unresolved-lookup answers.
- Existing deterministic fallback copy should stay for true runtime failure, repair failure, or model-skipped-lookup recovery paths.

## Chosen Direction

Use the lookup tool result as the source of truth for pending UI action guidance.

When `lookup_product_candidate` returns a status that will lead to an intake or clarification card, the tool output should explicitly tell the agent:

- which UI action will be shown,
- what the assistant should and should not say,
- that the card handles the selection/submission details,
- that no product-specific or category-level assessment should be given until identity is resolved.

The agent then writes the final answer naturally. Validators enforce the boundary.

Pin the shared field shape before implementation:

```ts
type AgentV2ProductLookupAssistantGuidance = {
  pending_ui_action:
    | "none"
    | "product_intake_card"
    | "product_lookup_clarification_card"
  assistant_instruction_de: string
}
```

Expose this as `assistant_guidance` on the Agent V2 tool output, not on the reusable product-intake domain result. `lookupProductCandidate` stays a pure lookup result. `responses-agent.ts` enriches `lookup_product_candidate` outputs with the Agent V2 policy before serializing function-call output back to the model.

Guidance must not include internal ids. Existing product ids, candidate ids, and intake ids remain in structured result data for code; the natural-language guidance should be safe if the model paraphrases it.

## Product Behavior

### `not_found`

User asks about a supported product that is not in the database.

Expected UX:

- Assistant naturally says the product is not yet in the database and can be added for review.
- Intake card appears with any known brand/name/category prefilled.
- Assistant should not pretend to know the product.

### `needs_variant_selection` / `ambiguous`

User names a product family or variant that maps to one or more nearby catalog products.

Expected UX:

- Assistant naturally says it found possible matches and asks the user to select the right one.
- Clarification card appears with up to three candidate products and a “not mine / add mine” action.
- Assistant should not also answer the original product-fit question yet.
- Assistant should not repeat the same candidate explanation already shown on the card.

### `category_mismatch`

Catalog has a likely product, but not in the category/use the user asked about.

Expected UX:

- Assistant naturally says it found the product in another category/use and asks the user to confirm if that is what they mean.
- Clarification card appears.
- If the user selects the product, the next agent turn treats the selection as the resolved product and answers the pending question.
- If the user chooses “not mine / add mine,” the intake card appears.

### `insufficient_identity`

The user has not provided enough identity to search meaningfully.

Expected UX:

- No product card yet.
- Assistant asks for the missing product detail in natural German.

### `unsupported_category`

The product category is outside the currently supported eight product-intake categories.

Expected UX:

- No intake card.
- Assistant explains warmly that this category cannot be added yet.

## Non-Goals

- Do not redesign the product intake card UI.
- Do not change product matching thresholds beyond what is needed for copy/card status coordination.
- Do not add a new model call.
- Do not make the final answer fully deterministic for successful model turns.
- Do not solve unsupported categories beyond the current friendly response.

## Target File Map

- `src/lib/product-intake/product-lookup.ts`
  - Keep `lookupProductCandidate` focused on product identity, candidates, and intake offers.
  - Do not put assistant copy or UI-action policy in this reusable domain module.
- `src/lib/agent-v2/product-lookup-policy.ts`
  - Own the Agent V2 mapping from lookup status to `assistant_guidance`, pending UI action, unresolved status, and product-claim blocking policy.
- `src/lib/types.ts`
  - Extend relevant product lookup/intake types only if required by the lookup result contract.
- `src/lib/agent-v2/runtime/responses-agent.ts`
  - Enrich model-visible `lookup_product_candidate` output with `assistant_guidance` from `product-lookup-policy.ts`.
  - Update named-product guidance and repair guidance so unresolved lookup statuses are handled as pending UI actions, not as opportunities for category-level assessment.
  - Keep fallback copy for repair-failed paths but make it concise and non-duplicative.
- `src/lib/agent-v2/production/product-lookup-turn-outcome.ts`
  - Preserve existing model-authored success path.
  - Keep existing visible-failure and model-skipped-lookup fallback safety nets.
  - Keep card selection based on structured lookup results.
  - Shorten card prompt copy where needed so it complements the assistant answer instead of repeating it.
- `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Keep existing product-specific claim blocking for unresolved lookup statuses.
  - Add precise status-keyed blocking for pending-card statuses (`not_found`, `needs_variant_selection`, `ambiguous`, `category_mismatch`) so final answers stay in clarification/constraint-blocked territory and do not become product recommendation/routine answers before identity is resolved.
  - Do not try to regex-detect all possible category-level prose. Keep category-level assessment prevention primarily in tool guidance, repair hints, answer-mode constraints, and smoke tests; the existing validator already blocks product-specific claims.
  - Do not apply this category-level block to `insufficient_identity` or `unsupported_category`; those remain natural conversational clarification/boundary states.
  - Add repair hints that tell the model to hand off to the pending card action.
- `src/lib/agent-v2/validation/user-facing-language.ts`
  - Add a narrow duplicate visible-paragraph check as a safety net against repair loops, initially with an explicit kill switch or warn-first behavior.
- Tests:
  - `tests/agent-v2-product-lookup-clarification.spec.ts`
  - `tests/agent-v2-product-selection.spec.ts`
  - `tests/agent-v2-production-chat-pipeline.spec.ts`
  - add focused user-facing-language validator coverage if no suitable existing test exists.

## Task Checklist

### 1. Characterize The Current Failure

- [x] Add or update a failing regression for a successful unresolved lookup turn where the assistant answer and clarification card currently repeat the same message.
- [x] Add or update a failing regression for the exact duplicated paragraph repair case.
- [x] Confirm the tests fail for the right reason before implementation.

### 2. Add Card-Aware Lookup Guidance

- [x] Add an Agent V2 product lookup policy adapter with the pinned `assistant_guidance` shape above.
- [x] Keep `ProductLookupResult` pure and enrich only model-visible `lookup_product_candidate` tool output.
- [x] For `not_found`, expose guidance that an intake card will be rendered and the answer should invite adding the product without product claims.
- [x] For `needs_variant_selection` / `ambiguous`, expose guidance that a clarification card will be rendered and the answer should ask the user to select a match.
- [x] For `category_mismatch`, expose guidance that the product appears in another category and the user should confirm via the card.
- [x] Keep `insufficient_identity` and `unsupported_category` as no-card conversational states.
- [x] Keep `assistant_instruction_de` compact and free of internal ids.

### 3. Let The Agent Compose, Guard The Boundary

- [x] Update model guidance so unresolved card states are described as pending UI actions.
- [x] Remove or soften prompt language that currently permits category-level plausibility after unresolved lookup.
- [x] Update repair hints so repair output does not answer the pending product question before resolution.
- [x] Add/adjust validator behavior so pending-card statuses block product-specific claims and product-answer modes until identity is resolved.
- [x] Cover “do not give category-level assessment while waiting for card selection” with prompt guidance and smoke/regression assertions rather than broad regex parsing.
- [x] Keep deterministic answer replacement only for true visible failure paths where the model output is unusable.

### 4. Make Card Copy Complementary

- [x] Shorten clarification card prompt copy so it does not repeat the full assistant bubble.
- [x] Keep card copy action-oriented: “Meinst du dieses Produkt?” / “Meinst du eines dieser Produkte?” / “Wir haben es in einer anderen Kategorie gefunden.”
- [x] Ensure “not mine / add product” still carries the right intake offer with prefilled identity.
- [x] Update assertions around `productLookupClarification.copy.prompt_de`, especially Syoss/variant-selection and category-mismatch cases, to assert action shape rather than repeated explanatory copy.

### 5. Add Safety-Net Validation

- [x] Add a narrow within-answer duplicate-paragraph validator for visible user-facing answer text.
- [x] Keep it specific enough to catch repeated medium/long paragraphs from repair without blocking harmless repeated short words or labels. Use a concrete threshold: repeated normalized paragraph with at least 80 characters after normalization, or two high-overlap adjacent paragraphs with at least 120 characters each.
- [x] Reuse the existing German text normalization helper in `user-facing-language.ts`.
- [x] Add tests for the validator.
- [x] Start as `warn` or behind an explicit module-level kill switch similar to `CLOSURE_BLOCK_FINDINGS_ENABLED`; promote to block only if tests and local smoke show low false-positive risk.
- [x] State expected repair behavior: if duplicate visible copy survives repair, bounded repair may fall back rather than looping indefinitely.
- [x] Do not claim this validator detects bubble-vs-card duplication; it cannot see card copy because cards are generated downstream.

### 6. Verify The Flow

- [x] Run targeted tests:
  - `npx tsx --test tests/agent-v2-product-lookup-clarification.spec.ts`
  - `npx tsx --test tests/agent-v2-product-selection.spec.ts`
  - `npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts`
- [x] Run `npm run typecheck`.
- [x] Add the two product lookup/selection `.spec.ts` files to `npm run test:agent` or otherwise wire them into the repo's normal agent test command.
- [x] Run `npm run test:agent`.
- [x] Before final review, run `npm run ci:verify` if local build time/environment permits.
- [ ] Re-run the local smoke path for:
  - not-found intake card,
  - needs-variant clarification card,
  - category mismatch confirmation,
  - product selection follow-up,
  - “not mine / add mine” intake transition.
- [x] Run a code review after checks pass.

## Acceptance Criteria

- A successful model turn can author the unresolved-product assistant answer naturally.
- The assistant bubble and card have distinct responsibilities: the bubble gives the natural context, the card carries the action.
- Unresolved pending-card lookup statuses do not produce product-specific claims or product-answer modes before the user resolves the product identity.
- Local smoke confirms the assistant does not provide a category-level product assessment while asking the user to resolve a card selection.
- Repair cannot persist exact or obvious repeated visible paragraphs.
- The product cards remain driven by structured metadata, not by parsing assistant prose.

## Accepted Deviations During Implementation

- Kept category-level assessment prevention in guidance, repair hints, and focused tests instead of adding broad regex parsing.
- Structural review changed the ownership boundary: `assistant_guidance` now lives in `src/lib/agent-v2/product-lookup-policy.ts` and is added to model-visible lookup tool output in `responses-agent.ts`; `lookupProductCandidate` remains domain-only.
- Kept duplicate visible-answer detection warn-only with a module-level kill switch, matching the plan's low-risk rollout posture.
- Added the new lookup/selection tests to `npm run test:agent`; the full command initially caught two prompt-contract issues, both patched before continuing.
- Browser smoke found that guidance alone still allowed a personalized category suitability paragraph after a `not_found` intake-card lookup. Added a narrow validator guard for personalized same-category suitability claims while a card is pending.
- Browser smoke also found user-facing instruction leakage (“Ich soll ...”) in a clarification handoff. Added a user-facing-language block for internal instruction phrasing.
- Structural review found product lookup policy was split across too many layers. Added the Agent V2 policy adapter and routed runtime/outcome/validator status checks through it. Deferred the broader `product-lookup-turn-outcome.ts` file decomposition as a follow-up because it is structural cleanup, not required to fix this copy/card boundary.
- Follow-up structural review found two narrow hardening gaps. Made `offerId` required for `lookupProductCandidate` so the domain lookup no longer generates random UI/action ids, and typed the Agent V2 policy map against the domain `ProductLookupStatus` union for exhaustiveness.

## Local Smoke Notes

- Not-found intake path: passed after validator patch. The assistant now gives a short handoff and renders the intake card without a premature category suitability verdict.
- Needs-variant clarification path: passed after instruction-leakage patch. The assistant gives a natural handoff and renders the clarification card.
- Product selection follow-up: passed mechanically. Selecting the candidate produced a follow-up answer and did not ask for the variant again. Residual risk: answer quality still depends on how complete the selected product facts are.
- “Not mine / add mine” transition: passed. The clarification card opens the intake card.
- Category mismatch browser smoke: not completed against live catalog because a quick catalog probe did not find an easy active product that naturally returns `category_mismatch`. This path remains covered by targeted tests.
- Post-patch code reviews:
  - Correctness review: no blocking findings.
  - Structural review: policy ownership substantially improved; patched the two narrow hardening findings by requiring lookup `offerId` at callers and making Agent V2 lookup policy exhaustive over `ProductLookupStatus`.

## Open Risks

- The model may still phrase the handoff awkwardly sometimes; validators should catch unsafe or duplicate cases, not try to make every sentence identical.
- If the lookup tool output becomes too verbose, it may distract the model. Keep guidance compact and status-specific.
- Existing tests that assert exact copy may need to be relaxed toward behavior-focused assertions where the agent is intentionally the author.
- `product-lookup-turn-outcome.ts` remains large and should be decomposed in a separate structural cleanup, but the status-to-policy ownership is now centralized.

## Claude Review Findings

Claude reviewed this plan in `plans/2026-06-26-card-aware-product-lookup-copy.claude-review.md`.

Accepted:

- Clarified that successful model answers are already preserved; existing visible-failure and model-skipped-lookup fallbacks should not be removed.
- Clarified that `chat-pipeline.ts` does not need explicit threading for model-visible guidance because raw tool output is already serialized back to the model.
- Split within-answer duplicate validation from bubble-vs-card deduplication.
- Pinned the `assistant_guidance` field shape.
- Made the category-level assessment boundary status-specific.
- Added normal test-suite wiring and `ci:verify` to verification.
- Leaned the guidance shape down to `pending_ui_action` and `assistant_instruction_de`; `claim_boundary` was redundant with status and invisible to the validator.
- Replaced the impossible `assistant_guidance.claim_boundary` validator hook with status-keyed validation.
- Clarified that broad category-level prose should be controlled by guidance and smoke tests, not brittle regex parsing.
- Added warn/kill-switch posture for duplicate visible-paragraph validation.

Rejected/deferred:

- No full re-architecture. This remains a narrow copy/contract repair on top of the current product lookup flow.
- No broad natural-language category-assessment regex. That would reintroduce the brittle deterministic behavior this plan is meant to avoid.
