# Product Lookup Clarification Card Plan

Date: 2026-06-25

Status: Implemented in the integrated smoke worktree; latest review findings have been patched.
Targeted tests, typecheck, `git diff --check`, direct SSE/API smoke, authenticated browser-click
smoke, and the 2026-06-26 integrated full-flow smoke are passing mechanically. The integrated smoke
found one remaining UX/trust decision: candidate clarification cards render correctly, but the
assistant message can still sound repetitive and partially answer before the user selects the exact
product. Earlier `ci:verify` and simulated-user-review evidence have been collected in this pass.
The pre-ship product-selection architecture cleanup has also been completed and documented in
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-selection-architecture-cleanup.md`;
final autoreview/shipflow remain open after that smoke finding is patched or explicitly accepted.

Claude review:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-lookup-clarification-card.claude-review.md`.

Second Claude review:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-lookup-clarification-card.claude-review-2.md`.

Third Claude review:
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke/plans/2026-06-25-product-lookup-clarification-card.claude-review-3.md`.

Accepted review changes:

- Complete the file map for all lookup-status consumers, especially runtime fallback, validator
  unresolved-status checks, and tool/model guidance.
- Make the status split explicitly checklist-driven so partial edits cannot silently loosen the
  unresolved-product trust boundary.
- Remove candidate images from V1 because the current lookup catalog does not load image data.
- Make structured candidate selection and conversation-state mutation more explicit.
- Add `npm run ci:verify` to the final gate.
- Add a concrete selected-product pipeline injection seam before UI work.
- Require status split plus validator/fallback unresolved-status handling in the same task.
- Define a test-anchored `category_mismatch` threshold so weak wrong-category candidates do not
  recreate the current Syoss bug.
- Add structured-action idempotency and full state helper update list.
- Require the candidate-selection turn to seed a verified `found_exact` lookup result into the
  validator context; prompting alone is not enough to satisfy the trust boundary.
- Make clarification-card selection explicit for fallback-answer paths, not only model-authored
  answers.
- Define durable, message-based idempotency for structured selection actions.
- Call out the dual persisted-state normalizer path for new conversation-state fields.

Rejected/deferred review changes:

- Claude suggested deferring `category_mismatch`; we keep it in scope because the product decision
  is explicit and it reuses the same clarification-card mechanism rather than adding a separate UI
  system.
- Claude suggested splitting V1a/V1b. We accept the engineering sequencing idea but not the product
  scope reduction: implement as stacked slices, while treating the feature as incomplete until the
  full chosen loop works.

Worktree context: this plan was created in the integrated smoke worktree
`/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke`.
The worktree already contains local smoke-only changes for the product-intake stack. Do not
commit, push, or PR from this plan without first deciding whether the patch should be ported into
the real stacked PR branch.

## Goal

Make chat product lookup behave naturally when the user names a concrete product that is not an
exact catalog hit but has nearby catalog candidates.

The user should not get a repeated generic clarification such as "Welche genaue Variante meinst
du?" when the system already has candidate products. Instead, chat should show a structured
clarification card:

- same brand/category variants as selectable candidates
- a clear "Nein, mein Produkt hinzufügen" path into the existing product intake card
- a structured candidate-selection action that uses product IDs, not free-text parsing
- conversation continuity after selection, so follow-ups like "und wie oft?" refer to the selected
  product until the product topic changes

## Problem Evidence

Manual smoke on `http://localhost:3543/chat`:

1. User: `ich benutze Syoss Intense Volume shampoo seit einiger zeit, passt das zu mir?`
2. Agent called `lookup_product_candidate` with:
   - `brand_text = Syoss`
   - `category = shampoo`
   - `product_name_text = Intense Volume Shampoo`
3. The catalog did not contain `Syoss Intense Volume Shampoo`.
4. Lookup returned `ambiguous` because it found weak Syoss neighbors sharing the token `Intense`,
   including wrong-category products.
5. The final response came from a deterministic repair fallback after validation failed, so the
   same clarification copy repeated on the follow-up.

Actual catalog reality in the test database:

- `Syoss Intense Curls` exists as shampoo.
- `Syoss Intense Keratin` and others exist in other categories.
- `Syoss Intense Volume Shampoo` is not currently in our catalog, while live shops list it
  externally.

## Chosen Direction

Add a structured product lookup clarification path. Keep the model responsible for intent and
wording where possible, but make the lookup result/action boundary explicit and durable.

### Implementation Strategy

Use stacked internal implementation slices rather than one large monolithic patch. The full
user-facing behavior remains the acceptance target; do not ship a decorative clarification card
without selection, trust-boundary validation, and conversation continuity.

Slice A: Lookup + Payload Foundation

- Split lookup statuses into `found_exact`, `needs_variant_selection`, `category_mismatch`,
  `not_found`, `insufficient_identity`, and `unsupported_category`.
- Build deterministic candidate lists and thresholds.
- Persist/stream `product_lookup_clarification` payloads.
- Ensure fallback answers can attach the same structured clarification payload.
- Preserve validator trust boundaries for all unresolved lookup statuses.

Slice A is not production-complete by itself unless the card has a safe disabled/non-interactive
state, which is not the intended UX. Prefer continuing directly into Slice B before any PR is marked
ready.

Slice B: Selection Action + Trust Boundary

- Add the narrow `POST /api/chat/product-selection` structured action endpoint.
- Revalidate selected product IDs against the persisted clarification candidate list.
- Add durable idempotency for repeated clicks/replays.
- Seed a trusted `found_exact` lookup result into validator context for the selected-product turn.
- Reuse normal AgentV2 answer machinery rather than creating a parallel answer engine.

Slice C: Conversation Continuity + UX Smoke

- Persist active resolved product context.
- Make follow-up turns use the selected product until the topic changes.
- Complete browser smoke, reload checks, simulated user review, and final review gates.

Implementation may become stacked PRs if that keeps review clearer, but the acceptance bar remains
the complete Slice A+B+C loop.

### User-Facing Behavior

For same brand + same category candidates with no exact name match:

> Ich finde **Syoss Intense Volume Shampoo** nicht eindeutig, aber ich habe dieses Syoss Shampoo in
> unserer Datenbank gefunden.

Card:

- Candidate card(s), max 3
- Primary action: `Auswählen`
- Secondary action below candidates: `Nein, mein Produkt hinzufügen`

For multiple candidates, use plural copy:

> ... aber ich habe diese Syoss Shampoos in unserer Datenbank gefunden.

For category mismatch candidates:

> Ich finde **Syoss Intense Keratin** bei uns nur als **Maske/Kur**, nicht als Shampoo. Wenn du
> dieses Produkt meinst, wähle es aus. Wenn du ein Shampoo meinst, füge dein Shampoo hinzu.

Card:

- Candidate card(s) with category badge
- Primary action means the user accepts the shown product/category.
- Secondary action opens intake with the originally requested category/product.

### Product Lookup Status To UX Mapping

| Status | Meaning | UX |
| --- | --- | --- |
| `found_exact` | One exact product row is verified | Answer directly from verified product context |
| `needs_variant_selection` | Same brand + same category candidates exist, but exact name does not match | Render product clarification card with candidate(s) and add-product action |
| `category_mismatch` | Product identity exists only in another category/use | Render same clarification-card mechanism with explicit category-mismatch copy and DB category badge |
| `not_found` | Supported category and enough identity, but no useful same-brand/same-category or category-mismatch candidate | Offer the prefilled product intake card when the structured lookup and answer gates confirm `not_found` |
| `insufficient_identity` | Missing category, brand, or product name | Ask a natural clarifying question, no card |
| `unsupported_category` | Product category is outside the 8 supported categories | Friendly limitation, no card |

Notes:

- `ambiguous` should no longer be the product-facing catch-all for both real variant selection and
  weak related products.
- It is acceptable to keep an internal legacy alias temporarily, but the pipeline/UX should reason
  with the explicit statuses above.
- Weak same-brand candidates from wrong categories must not block intake. They are either
  `category_mismatch` only when the identity match is meaningfully strong, or ignored so the result
  becomes `not_found`.

### Candidate Rules

- Show max 3 candidates.
- Only same brand candidates are eligible for the card.
- For `needs_variant_selection`, candidates must be same category.
- For `category_mismatch`, candidates may be another category only when identity is strong enough
  to plausibly be the same product. V1 threshold:
  - allowed when the matcher found a brand+line or brand+name exact match in another category
    (`text_category_mismatch_review` from line/name exact paths), or
  - allowed when all meaningful user product-name tokens match the candidate clean name, ignoring
    category words.
  - reuse the existing meaningful-token helper in `product-lookup.ts` where possible so lookup
    scoring and category-mismatch thresholding do not drift.
  - not allowed for one-token fuzzy overlap such as `Intense` matching `Syoss Intense Keratin`
    when the user asked for `Syoss Intense Volume Shampoo`; that must become same-category variant
    selection if a same-brand/category candidate exists, otherwise `not_found`.
- Sort:
  1. same category before category mismatch
  2. stronger product-name token overlap
  3. stable product name order
- One candidate is still shown. It is useful for typo/variant correction.

### Candidate Selection Semantics

- Candidate click is structured data only. Do not render a fake user bubble.
- The click posts a structured action with `selected_product_id` and the original unresolved lookup
  context.
- Backend revalidates the product ID before using it.
- Candidate selection must be idempotent. Include an action/clarification ID or otherwise dedupe
  double-click/replay so the same selection does not create duplicate assistant messages or repeated
  state mutation.
- Idempotency must be durable across serverless invocations. Preferred V1 shape: persist a
  `product_lookup_selection` marker on the generated assistant answer message's `rag_context`, then
  have the selection endpoint check for an existing assistant message in the same conversation with
  the same `clarification_id`, source assistant message ID, and `selected_product_id` before
  generating another answer. If implementation chooses a different store, document why before
  coding it.
- The assistant then sends one new answer message:
  - briefly acknowledges the selection
  - answers the pending original question in the same message
- The selected product enters active resolved product context until the user names/selects a new
  product topic or clearly changes topic.
- Candidate selection does not save the product to the user's routine.

### Add Product Action Semantics

- `Nein, mein Produkt hinzufügen` is UI-only card reveal.
- It opens/reveals the existing product intake card under the same assistant message.
- The intake card offers the usual two paths:
  - `Foto hochladen`
  - `Daten eingeben`
- Prefill whatever is known: category, brand, product name, and frequency if available.
- Do not create a pending submission until the user submits the intake card.
- Do not add unresolved products to active resolved product context.

### Persistence Decision

Persist the clarification card payload on the assistant message, parallel to
`rag_context.product_intake_offer`.

Reasons:

- The card is user-facing message state and must survive reload/back navigation.
- Current app pattern already persists:
  - assistant text in `messages.content`
  - recommendation cards in `messages.product_recommendations`
  - intake cards in `messages.rag_context.product_intake_offer`
- Do not recompute from traces; traces are debug/archive state and may be absent or scrubbed.
- Do not store clarification candidates in `product_recommendations`; they are not recommendations.

## Non-Goals

- Do not implement broad catalog browsing.
- Do not add products to the database automatically.
- Do not auto-save candidate selections into `user_product_usage`.
- Do not make all weak same-brand products visible if the user gave a clear category.
- Do not build a general admin UI.
- Do not rename `rag_context` in this patch, even though a future `message_ui_payload` column/name
  would be cleaner.

## Proposed Payloads

Add a typed message UI payload, probably in `src/lib/types.ts`:

```ts
export interface ProductLookupClarification {
  id: string
  kind: "variant_selection" | "category_mismatch"
  source: "chat"
  query: {
    brand_text: string | null
    product_name_text: string | null
    category: ProductIntakeCategoryKey
  }
  copy: {
    prompt_de: string
  }
  candidates: ProductLookupClarificationCandidate[]
  none_action: {
    label_de: string
    product_intake_offer: ProductIntakeOffer
  }
}

export interface ProductLookupClarificationCandidate {
  product_id: string
  name: string
  category: ProductIntakeCategoryKey | string | null
  category_label_de: string
  reason: "same_brand_same_category" | "category_mismatch"
}
```

Then extend:

```ts
export interface MessageRagContext {
  sources: CitationSource[]
  category_decision?: ChatCategoryDecision | null
  engine_trace?: RecommendationEngineTrace | null
  response_mode?: ResponseMode | null
  product_intake_offer?: ProductIntakeOffer | null
  product_lookup_clarification?: ProductLookupClarification | null
}
```

The exact shape may be adjusted during implementation, but the plan requires:

- product IDs in candidates
- display snapshot fields for reload
- original query/prefill data
- embedded intake offer for the none/add path
- no dependence on assistant prose parsing
- no candidate images in V1 unless implementation first extends the catalog/repository projection

## Target File Map

Likely production code:

- `src/lib/product-intake/product-lookup.ts`
  - replace/extend `ambiguous` semantics with `needs_variant_selection` and
    `category_mismatch`
  - build candidate lists with max 3 and same-brand/category rules
  - return `not_found` when only weak wrong-category candidates exist
- `src/lib/product-intake/product-matching.ts`
  - likely no production edit needed; prefer deriving same-category/category-mismatch semantics in
    `product-lookup.ts` from candidate product category and requested category
  - only edit this file if tests prove the matcher cannot surface enough candidate information
- `src/lib/types.ts`
  - add `ProductLookupClarification`
  - extend `MessageRagContext`
  - extend chat SSE event union with `product_lookup_clarification`
- `src/lib/agent-v2/tools/tool-definitions.ts`
  - update `lookup_product_candidate` tool description so the model understands
    `needs_variant_selection` and `category_mismatch`
  - clarify that candidate-card rendering comes from structured lookup metadata, not answer prose
- `src/lib/agent-v2/runtime/responses-agent.ts`
  - update product lookup guidance text and repair/fallback handling for the new statuses
  - prevent deterministic fallback from repeating generic ambiguous copy when structured candidates
    exist
  - use exhaustive status handling where practical so future status drift is visible
- `src/lib/agent-v2/validation/final-answer-validator.ts`
  - add every unresolved lookup status to the unresolved-status trust boundary
  - verify `needs_variant_selection` and `category_mismatch` still block product-specific claims
    until selection/verification
  - reconcile with the existing local smoke-only validator edits before implementation
- `src/lib/agent-v2/compare/run-agent-v2.ts`
  - update compare harness default/fixture lookup statuses if needed
- `src/lib/agent-v2/production/chat-pipeline.ts`
  - add a concrete `selectedProductContext` pipeline param before implementing the endpoint/UI
  - select clarification payload from lookup executions and terminal answer metadata
  - ensure the clarification selector runs for deterministic fallback answers as well as
    model-authored answers; the motivating bug currently lands in fallback
  - keep intake card rendering downstream of `not_found`
  - update conversation state when a structured candidate selection is processed
- `src/app/api/chat/route.ts`
  - stream `product_lookup_clarification`
  - persist it in assistant `rag_context`
  - add/accept structured chat action input for candidate selection if this route remains the
    action entry point
- `src/hooks/use-chat.ts`
  - handle live SSE event and patch temporary assistant message with
    `rag_context.product_lookup_clarification`
  - support structured candidate selection action from the UI
- `src/components/chat/chat-message.tsx`
  - render clarification card for assistant messages
- `src/components/chat/product-lookup-clarification-card.tsx` (new)
  - product-card-lite UI based on existing product card language
  - `Auswählen` action
  - `Nein, mein Produkt hinzufügen` reveals existing `ProductIntakeCard`
- `src/components/chat/product-card.tsx`
  - optionally extract reusable product display subcomponent if that keeps the clarification card
    clean; do not over-refactor
- `src/lib/agent-v2/production/session-state.ts`
  - add/update active resolved product topic if current state shape is the right home
- `src/lib/agent-v2/production/persisted-session-state.ts`
  - normalize persisted active resolved product context if new state fields are needed
  - additive state field is preferred; no DB migration/version bump should be needed if the
    normalizer tolerates missing legacy fields
- `src/lib/chat-runtime/stream-events.ts`
  - extend `buildAssistantDecisionContext` with `product_lookup_clarification` rather than
    reconstructing card payloads from traces
  - convert the positional `buildAssistantDecisionContext` parameters to an options object if that
    is the cleanest way to avoid a brittle sixth positional argument

Potential API options to inspect during implementation:

- Implement a narrow endpoint such as `POST /api/chat/product-selection`.

Decision: candidate selection should follow the existing structured-card-action pattern
(`/api/product-intake/chat`, `/api/chat/feedback`) rather than overloading the free-text chat
schema. The endpoint must not become a parallel answer engine. It should validate the structured UI
action, then invoke/reuse the normal AgentV2 chat answer machinery with verified product context.

The endpoint should:

- validate auth
- verify the conversation belongs to the user
- verify the assistant message exists in that conversation
- read `rag_context.product_lookup_clarification`
- verify the selected product ID belongs to the persisted candidate list
- revalidate the product row is still active/eligible
- dedupe repeated selection actions by clarification/action ID so double-click/replay does not
  produce duplicate assistant messages
- call the existing chat/pipeline machinery with verified selected-product context
- stream/persist the assistant answer using the same message/SSE shape as normal chat
- avoid creating a fake user message/bubble

### Selected-Product Pipeline Injection Seam

Add an explicit pipeline input before implementing the endpoint/UI:

```ts
type SelectedProductContext = {
  source: "product_lookup_clarification"
  selected_product_id: string
  selected_product_name: string
  selected_product_category: string | null
  selected_product_category_label_de: string
  original_query: {
    brand_text: string | null
    product_name_text: string | null
    category: ProductIntakeCategoryKey
    user_message: string
  }
  clarification_id: string
  assistant_message_id: string
}

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  requestId: string
  productIntakeEnabled?: boolean
  selectedProductContext?: SelectedProductContext
}
```

Rules:

- The endpoint constructs `selectedProductContext` only after server-side validation.
- The agent turn still uses the normal AgentV2 machinery, but runtime context/prompting must tell
  AgentV2 that the selected product identity is verified and should answer the pending original
  question without re-running fuzzy lookup or asking the same variant clarification again.
- The selection turn must also satisfy validation deterministically. Convert the verified
  `selectedProductContext` into a synthetic/equivalent `found_exact` `ProductLookupResult` in the
  validator context, matching the selected product ID and original evidence/identity. Do not rely on
  the model being instructed to "treat it as verified"; `hasMatchingProductLookupForAnswer` must see
  a matching lookup result or equivalent trusted entry.
- If the answer still needs product properties, it may use normal product/recommendation tooling by
  product ID/category. Do not convert the selected product back into a free-text "Ich meine X"
  message as the source of truth.
- The selected product should be written into active resolved product context through the normal
  conversation-state persistence path for this selection turn.

## Implementation Checklist

### 1. Lookup Semantics And Tests

- [x] Add tests in `tests/product-intake-lookup.test.ts` for:
  - exact product -> `found_exact`
  - same brand/category candidate with name mismatch -> `needs_variant_selection`
  - one same brand/category candidate still shows candidate
  - only weak wrong-category candidates -> `not_found`
  - strong identity but DB category differs -> `category_mismatch`
  - missing brand/category/name -> `insufficient_identity`
  - unsupported category -> `unsupported_category`
- [x] Patch lookup code and all unresolved-status consumers in the same task. No intermediate
  state may allow `needs_variant_selection` or `category_mismatch` to pass the validator as
  resolved.
- [x] During the transition, either keep a mandatory `ambiguous` alias that remains in the
  unresolved set, or update `UNRESOLVED_PRODUCT_LOOKUP_STATUSES`, runtime fallback gates, and tool
  guidance in the same commit-sized edit as the status split.
- [x] Ensure max 3 candidates and deterministic ordering.
- [x] Build the clarification payload from `ProductLookupExecution.result`, not from validator or
  runtime summaries; runtime summaries intentionally drop candidate details.
- [x] Use existing meaningful-token utilities in `product-lookup.ts` for category-mismatch threshold
  tests where possible.
- [x] Reuse the existing `buildIntakeOffer` behavior for `none_action.product_intake_offer` rather
  than inventing a second intake-offer shape.
- [x] Grep every lookup-status consumer before ending this task:
  - `rg -n '"ambiguous"|UNRESOLVED_PRODUCT_LOOKUP_STATUSES|product_lookup:' src tests`
  - every consumer must either handle the new statuses or be documented as unaffected.
- [x] Prefer explicit status helpers or exhaustive `switch` handling over scattered string checks
  where this meaning crosses module boundaries.

Targeted check:

```bash
npx tsx --test tests/product-intake-lookup.test.ts
```

### 2. Message Payload And Persistence

- [x] Add typed `ProductLookupClarification` payload.
- [x] Extend `MessageRagContext`.
- [x] Extend chat SSE event types.
- [x] Add tests proving pipeline emits/persists clarification payload for
  `needs_variant_selection` and does not persist it for direct `not_found`.
- [x] Add a test that the clarification payload is emitted when the terminal answer came from the
  lookup clarification fallback path, not only when the model authored the answer.
- [x] Extend `buildAssistantDecisionContext` and the route call site at the same time so live SSE
  and saved messages cannot drift.

Targeted checks:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

### 3. Chat UI Card

- [x] Build `ProductLookupClarificationCard`.
- [x] Reuse product-card visual language, but keep it in clarification mode:
  - no price/shop CTA
  - no recommendation framing
  - product name and category badge
  - one clear select action
  - one secondary add-product action
- [x] Render persisted cards from `ChatMessage`.
- [x] On "none/add", reveal `ProductIntakeCard` with the embedded prefilled offer.
- [x] Handle malformed payload defensively by rendering nothing rather than crashing.

Browser checks:

- one candidate mobile view
- multiple candidates mobile view
- category mismatch copy/badge
- none/add reveals prefilled intake card
- reload preserves card

### 4. Structured Candidate Selection

- [x] Add structured selection request shape with:
  - `selected_product_id`
  - clarification ID or assistant message ID
  - original query/context
- [x] Revalidate selected product server-side:
  - exists
  - active
  - eligible for the current user context
  - belongs to the original clarification candidate list, or equivalent server-side validation
- [x] Make the action idempotent:
  - include clarification/action ID in the request
  - persist a durable selection marker on the generated assistant answer message's `rag_context`
  - before generating an answer, check for an existing assistant answer in the same conversation
    with the same clarification ID/source message
  - if the clarification was already processed, return the existing result or a no-op response
    rather than generating a duplicate assistant message for a second candidate click
  - use a stable assistant-message ID scoped to the clarification/source message so duplicate-key
    races replay the canonical stored answer
- [x] Run AgentV2/pipeline with verified selected product identity rather than reparsing text.
- [x] Seed the selected-product turn's validator context with a trusted `found_exact` lookup result
  or equivalent entry derived from the server-validated product row. The answer must not be accepted
  purely because the prompt says the product was selected.
- [x] Define the concrete injection path before coding the UI:
  - create `POST /api/chat/product-selection`
  - validate the structured card action first
  - call/reuse the normal AgentV2 chat answer machinery with verified product identity
  - do not implement a separate answer engine
- [x] The selected-product answer path must not enter the existing "product intake deferred/no
  state mutation" branch; it needs to persist the resolved-product conversation state.
- [x] Assistant response acknowledges selection briefly and answers the pending original question.
- [x] Do not create a fake user bubble.

Targeted tests:

- candidate selection posts product ID and produces answer
- invalid candidate/product ID is rejected
- selection does not create `user_product_usage`
- selection does not create product submission

### 5. Conversation Continuity

- [x] Store active resolved product context in `AgentV2ConversationStateV2`.
  - Prefer a dedicated active resolved product field because
    `prior_selected_product_projections` represents prior recommendation-tool projections, not a
    single user-confirmed product topic.
  - If implementation proves `prior_selected_product_projections` can carry this without semantic
    drift, document that decision in this plan before coding it.
- [x] Update all state helpers in `persisted-session-state.ts` together:
  - `AgentV2ConversationStateV2`
  - `createDefaultAgentV2ConversationState`
  - `buildAgentV2State`
  - `normalizeAgentV2ConversationState`
  - `summarizeAgentV2ConversationState`
  This should be additive and tolerate legacy states without the field.
- [x] In `normalizeAgentV2ConversationState`, update both current shapes:
  - nested `agent_v2.*`
  - legacy flat `agent_v2_*`
  Missing either branch can silently drop the selected product after reload.
- [x] Preserve it until a new actionable product topic replaces it.
  - Broader unrelated-topic expiry is intentionally prompt/heuristic-led for this slice rather than
    a deterministic persisted-state reset.
- [x] Use selected product context for follow-ups like:
  - `und wie oft?`
  - `passt das zu meinem Frizz?`
  - `kann ich das mit meinem Conditioner kombinieren?`
- [x] Ensure "none/add product" does not set active resolved product context.
- [x] Reconcile category vocabulary:
  - lookup clarification query uses the 8 intake category keys
  - AgentV2 care/category context has a broader vocabulary
  - active resolved product context should store both the product row category and the user-visible
    resolved usage/category when they differ.

Targeted tests:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Add focused cases rather than brittle exact-copy tests.

### 6. Validator And Fallback Copy

- [x] Prevent deterministic repair fallback from repeating the same generic clarification when
  structured candidates exist.
- [x] If repair fails after a lookup result with candidates, produce a valid answer that references
  the structured clarification card.
- [x] Ensure fallback-produced clarification answers still pass through the same
  `product_lookup_clarification` selector and persistence path as model-authored answers.
- [x] Keep validator trust boundary:
  - no product-specific claims after unresolved lookup
  - no intake card unless structured `not_found`
  - no candidate card unless structured candidate payload exists
- [x] Treat `needs_variant_selection` and `category_mismatch` as unresolved until the user selects a
  verified candidate.

Targeted checks:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

### 7. Browser Smoke And Simulated Review

- [x] Start dev server from the implementation worktree.
- [x] Test authenticated local user via `/api/dev/login?next=/chat`.
- [x] Browser smoke scenarios:
  - [x] Direct SSE smoke: `ich benutze Syoss Intense Volume shampoo seit einiger zeit, passt das zu mir?`
    - expected: contextual Option B copy + one Syoss shampoo candidate + none/add action
  - [x] Direct API smoke: select candidate
    - expected: assistant answers original product question, stores active resolved product context
  - [x] Browser click smoke: select candidate from the rendered card
  - [x] Direct API follow-up `und wie oft?`
    - expected: answer refers to selected product
  - [x] Browser click follow-up `und wie oft?`
    - expected: answer refers to selected product after selecting from the rendered card
  - [x] none/add
    - expected: prefilled intake card, no submission until submit
  - [x] true unknown brand/category
    - expected: intake card directly
  - [x] category mismatch
    - expected: explicit category mismatch card
- [x] Run `$simulated-user-review` after the browser smoke passes.

## Required Verification Before Ship

At minimum:

```bash
npx tsx --test tests/product-intake-lookup.test.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npm run typecheck
npm run ci:verify
```

If the implementation touches broader contracts:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts
npx tsx --test tests/agent-v2-named-product-context.spec.ts
```

Manual:

- browser smoke for the scenarios in Task 7
- reload test to confirm persisted clarification card renders
- inspect Supabase rows for:
  - no submission created on candidate selection
  - no submission created on none/add until card submit
  - assistant message persisted with `rag_context.product_lookup_clarification`

Review gates:

- Claude code review after implementation
- `$superpowers:requesting-code-review`
- `$simulated-user-review`
- Clawpatch/autoreview before PR shipflow if this becomes a PR

## Accepted Deviations / Known Risks

- `rag_context` is not an ideal name for UI action payloads, but it is the established durable
  message metadata bucket. Renaming it is out of scope.
- This plan intentionally does not add an admin/catalog operation. It only improves user-facing
  lookup resolution and intake routing.
- The structured selection action should use a narrow `POST /api/chat/product-selection` endpoint
  unless implementation inspection proves this would duplicate substantial chat machinery.
- Implemented: the narrow `POST /api/chat/product-selection` endpoint validates the persisted card
  action, revalidates product activity, rejects non-candidate product IDs, seeds AgentV2 with trusted
  selected-product context, persists a durable `product_lookup_selection` marker, and persists the
  normal conversation-state transition.
- Implemented UI note: the first client wiring uses a narrow browser event bridge from
  `ChatMessage` to the clarification card via explicit props; no fake user bubble is created for
  product selection.
- Latest patch after live smoke:
  - The pipeline now recovers candidate-bearing clarification payloads from structured
    `lookup_product_candidate` trace calls when repair/fallback paths did not populate the local
    lookup execution list.
  - `/api/chat` no longer suppresses `product_lookup_clarification` on visible repair fallback
    turns. Product intake offers remain suppressed on visible failures.
  - Added regressions for trace-only repair lookup recovery and route-level visible-failure
    clarification streaming.
- Direct local smoke on `http://localhost:3543`:
  - `/api/dev/login?next=/chat` authenticated the local dev user.
  - `/api/chat` with lowercase Syoss wording emitted `product_lookup_clarification` with one
    `Syoss Intense Curls` shampoo candidate and no `product_recommendations` SSE event.
  - `/api/chat/product-selection` accepted the selected candidate, did not ask the variant again,
    and answered for `Syoss Intense Curls`.
  - A same-conversation follow-up `und wie oft?` emitted no stale clarification card and answered
    for `Syoss Intense Curls`, not the original unresolved `Syoss Intense Volume Shampoo` wording.
- Latest active-product fallback patch:
  - Active resolved product context is injected after the latest user message so follow-ups do not
    get overridden by older unresolved product wording in chat history.
  - Repair-failure fallback now has a narrow active-product follow-up path for messages such as
    `und wie oft?`, guarded so it does not hijack turns where the latest user message names a new
    product.
  - Product lookup fallback display names no longer duplicate the brand when the extracted product
    name already includes it.
- Latest visible-failure not-found recovery patch:
  - If AgentV2 successfully calls `lookup_product_candidate` for a concrete product but then fails
    terminal repair, the production pipeline now recovers a product-specific not-found answer and
    structured `product_intake_offer` instead of streaming generic failure copy.
  - `/api/chat` no longer strips a pipeline-provided `product_intake_offer` solely because the
    underlying runtime turn had a visible failure; the pipeline remains responsible for only
    producing the offer when the not-found lookup is structured and matching.
  - Added regressions for pipeline-level not-found recovery and route-level visible-failure intake
    streaming.
- Latest product-selection hardening patch:
  - A clarification card is single-use: after any candidate is confirmed, later clicks from the same
    source card replay the canonical existing selection answer rather than generating another
    trusted selection.
  - Category-mismatch selections use the selected catalog product's actual category for trusted
    `found_exact` grounding, not the originally requested category.
  - Duplicate-key selection replay streams the persisted selection metadata rather than the
    attempted click metadata.
  - The product-selection endpoint verifies conversation ownership before loading the source
    assistant message and constrains the card lookup by `conversation_id`, avoiding even a low-risk
    message-existence oracle.
  - Selection verifies identity, not detailed product facts. Product-property and suitability claims
    still require normal product-tool grounding and remain guarded by validator heuristics.
- Verification completed in this implementation pass:
  - `npx tsx --test tests/product-intake-lookup.test.ts`
  - `npx tsx --test tests/agent-v2-contracts.spec.ts`
  - `npx tsx --test tests/agent-v2-responses-runtime.spec.ts`
  - `npx tsx --test tests/agent-v2-final-answer-validator.spec.ts`
  - `npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts`
  - `npx tsx --test tests/agent-v2-named-product-context.spec.ts`
  - `npx tsx --test tests/product-intake-replay-user-product-usage-lookup.spec.ts`
  - `npx tsx --test tests/chat-product-mentions.test.tsx`
  - `npx tsx --test --test-name-pattern "already resolved clarification|category-mismatch selections|product selection helper" tests/agent-v2-production-chat-pipeline.spec.ts tests/chat-product-mentions.test.tsx`
  - `npx tsx --test --test-name-pattern "ownership before source card|conversations owned by another user|stale clarification" tests/agent-v2-production-chat-pipeline.spec.ts`
  - `npm run typecheck`
  - `git diff --check`
  - `npm run ci:verify`
  - `npx tsx scripts/product-intake/replay-user-product-usage-lookup.ts --limit=500 --examples-per-status=10`
- Authenticated browser smoke completed on `http://localhost:3543/chat`:
  - Variant card: `Syoss Intense Volume Shampoo` rendered a selectable `Syoss Intense Curls`
    candidate and `Nein, mein Produkt hinzufügen`.
  - Selection: tapping `Auswählen` produced an acknowledgement for `Syoss Intense Curls` and did
    not call it unverified.
  - Follow-up: `und wie oft?` answered against `Syoss Intense Curls` without re-rendering stale
    variant clarification.
  - None/add: tapping `Nein, mein Produkt hinzufügen` revealed the prefilled intake card.
  - Not-found: `Was hältst du von meinem Jean & Lean Conditioner?` rendered product-specific
    deferral copy plus the intake card; no generic fallback text remained.
  - Category mismatch: `Garnier Hair Food Shampoo` rendered category-mismatch copy with three
    candidate cards and the add-product escape hatch.
- Simulated-user-review observation:
  - The main flow is coherent and trustworthy after the not-found recovery patch.
  - Remaining UX polish risk: category-mismatch turns can feel slightly repetitive because the
    assistant paragraph and the card prompt both explain the mismatch. This is not blocking, but
    it is worth smoothing before or shortly after PR review if time allows.
- Replay result on the historical free-text dataset remained weak but expected for old data:
  `found_exact=0`, `needs_variant_selection=0`, `category_mismatch=0`, `not_found=4`,
  `insufficient_identity=380`, `unsupported_category=17`, `skipped_missing_product_name=32`.
- The integrated smoke worktree is not the final shipping branch. Any code patch should be
  reviewed for where it belongs in the stacked PR sequence.
- Candidate images are intentionally omitted from V1. Name and category badge are sufficient for
  disambiguation until the lookup catalog has a real image source.
- The worktree has pre-existing smoke-only validator edits. Implementation must classify and
  preserve/reconcile them rather than assuming a clean validator file.
- `PRODUCT_INTAKE_ENABLED`/the existing product-intake enabled path remains the practical
  rollback/kill-switch boundary for this card path.

## Open Questions Before Ship

None currently blocking.

Final shipflow still needs the normal autoreview/review gate and a decision about where this
integrated-smoke-worktree patch belongs in the stacked PR sequence.
