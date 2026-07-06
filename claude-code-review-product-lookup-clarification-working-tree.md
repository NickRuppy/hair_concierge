Review complete. Findings below, grounded in the diff and untracked feature files; I did not edit anything.

# Code Review — Product Lookup Clarification Card

Scope reviewed: `git diff HEAD` (excluding `supabase/.temp/cli-latest`) plus untracked feature files `src/app/api/chat/product-selection/route.ts` and `src/components/chat/product-lookup-clarification-card.tsx`. The plan/review markdown files are docs and were used as context only.

Overall this is a careful, well-tested change. The server-side trust boundary on the selection endpoint is sound (auth → conversation ownership → candidate-membership → DB-truth product eligibility), the validator/unresolved-status set was updated consistently, and the lookup status split has direct test coverage. The findings below are mostly correctness-at-the-edges and test-coverage gaps, not a broken core.

---

## Medium

### 1. Selection idempotency is read-then-write (TOCTOU) — concurrent clicks/replays can duplicate
`src/app/api/chat/product-selection/route.ts:293-325`

The durable-dedup mechanism queries the last 50 assistant messages and checks for an existing `product_lookup_selection` marker (`findExistingSelectionMessage`, line 48-75), and only then inserts a new answer. There is no unique constraint or atomic guard, so two near-simultaneous requests (double-click across tabs, client retry, SSE replay) can both pass the existence check and both run the pipeline + insert an assistant message + call `persistConversationStateTransition`. The plan explicitly required idempotency that survives "double-click/replay" and is "durable across serverless invocations" (`plans/...card.md:209-218`, checklist `:545-551`).

Mitigations exist on the client (`use-chat.ts` `hasExistingProductSelectionMessage` + the `if (isStreaming) throw` guard), so a single tab is protected, but the server is the stated durability boundary and is not concurrency-safe. Consider a DB-level dedup (e.g., unique partial index on `(conversation_id, clarification_id, selected_product_id)` for assistant selection messages, or an upsert) rather than relying on a best-effort read.

### 2. Active-product follow-up fallback fires on near-any message (over-broad regex)
`src/lib/agent-v2/runtime/responses-agent.ts:2680-2683` (used by `buildActiveResolvedProductFollowupFallback`, `:2598`)

`isActiveResolvedProductFollowupMessage` matches on extremely common German tokens including `\bdas\b`, `\bes\b`, `\bdamit\b`, `\bpasst\b`. Because `buildActiveResolvedProductFollowupFallback` is invoked at the top of `buildKnownIntentFallbackAnswer` *before* the `reason` gate (validator diff shows the early `if (activeResolvedProductFallback) return ...`), any post-repair-failure turn in a session that has an active resolved product will be caught and answered with canned, category-generic copy — e.g. a "passt das zu meinem Frizz?" question returns hardcoded shampoo washing-frequency advice (`responses-agent.ts:2618-2623`). This only triggers on the failure/repair path (all call sites at `:537-787` are `buildCurrentClarificationFallback`), so the alternative is generic failure copy, but the answer can be confidently off-topic for the actual question. Tighten the heuristic or make the canned copy more clearly deferential ("zu deiner Frage zu **X** …").

### 3. Brand/category prefix extraction slices raw text by a different string's length
`src/lib/agent-v2/production/chat-pipeline.ts:600` and `:576`

`findKnownBrandPrefix` matches on *normalized* text (`normalizeProductLookupText`) but returns `raw: text.slice(0, candidate.length)` — slicing the user's raw display text by the length of the *catalog* brand string. When the stored/canonical brand differs in length from how the user wrote it (diacritics, casing, apostrophes, internal spacing — e.g. "L'Oréal" vs a canonical "Loreal"), this mis-slices the brand and leaves garbage in `product_name_text`. `stripTrailingCategoryTerm` (`:576`) has the same raw-vs-normalized length mismatch. This is on the deterministic "model skipped lookup" fallback path, so it degrades fallback lookup accuracy rather than the main flow, but it can produce a wrong lookup input. Prefer slicing by the matched prefix length in the original string, not the foreign candidate's length.

### 4. Selection endpoint negative/security branches are largely untested
`tests/agent-v2-production-chat-pipeline.spec.ts` (endpoint tests at `:839`, `:922`, `:1074`)

Covered: happy path (trusted context wiring), candidate-not-in-list → 400, and assistant-insert-failure → no state mutation. Not covered:
- Unauthenticated → 401 (`route.ts:215-217`)
- Conversation not owned by user → 404 (`route.ts:250-252`)
- Source message missing / wrong role / wrong conversation (`route.ts:236-242`)
- Clarification id mismatch → 400 (`route.ts:256-258`)
- Ineligible/inactive product → 400 (`route.ts:273-279`)
- **The idempotent-replay hit path** (`findExistingSelectionMessage` returning a match, `route.ts:301-325`) — the entire durability branch is unexercised; the fake admin even has an `existingMessages` hook (`spec:1309/1372`) that no test populates.

Given these are the authz and dedup guarantees, they warrant explicit tests.

---

## Low / Nits

### 5. `ChatSSEEvent` union updated inconsistently
`src/lib/types.ts:1337-1349`

`"product_lookup_clarification"` was added to the union, but `"product_lookup_selection"` (emitted by `product-selection/route.ts:134-143` and handled in `use-chat.ts`) was not — and the union was already missing `"langfuse_trace"`/`"assistant_message"`. `ChatSSEEvent` appears unused anywhere in `src/` (only the definition exists), so there's no runtime/type impact, but the type is drifting from reality. Either complete it or drop it.

### 6. Both an intake card and a clarification card can render on one message
`src/components/chat/chat-message.tsx:375-381` + pre-existing intake-offer render

`productIntakeOffer` and `productLookupClarification` are computed independently in the pipeline (`chat-pipeline.ts` final return). If a turn produced both a `not_found` execution and a `needs_variant_selection` execution, the route persists both into `rag_context`, and `chat-message.tsx` would render the standalone `ProductIntakeCard` *and* the `ProductLookupClarificationCard` (whose none-action also reveals an intake card). Unlikely in practice (multiple lookup calls in one turn), but there's no mutual exclusion. Product-recommendation cards are correctly suppressed when a clarification is present (`:377-378`); intake cards are not.

### 7. Recommendation-card suppression and visible-failure offer streaming are behavioral changes beyond the card
`src/app/api/chat/route.ts:342-343` and `:426-433`

Two side changes ride along: (a) `productIntakeOffer` no longer suppressed on `isVisibleFailure` (gating moved entirely into the pipeline), and (b) product recommendation cards are now suppressed whenever a `productIntakeOffer` is present (new `!productIntakeOfferToSend` gate), not only when a clarification is present. Both look intentional per the plan's "visible-failure not-found recovery" note, but they change non-clarification chat turns. Worth a conscious confirm since the route now trusts the pipeline to only emit an offer when appropriate.

### 8. Error-path placeholder cleanup can leave a stray partial message
`src/hooks/use-chat.ts` `selectProductCandidate` catch block

On error it removes the temp placeholder only when `!message.content`. If the selection stream emits some `content_delta` and then errors, the placeholder has content and is retained, leaving a stray partial assistant bubble with no persisted server message. Minor UX edge.

### 9. Wasted catalog load when stale lookup actions are suppressed
`src/lib/agent-v2/production/chat-pipeline.ts` (`recoverProductLookupClarificationExecutionsFromTrace` is awaited regardless of `suppressStaleLookupActions`, then the clarification is forced to `null`)

The recovery helper can call `loadProductLookupCatalogs()` even when `suppressStaleLookupActions` is true and the result is discarded. Harmless, just unnecessary work on follow-up turns. Reorder to short-circuit when suppressed.

---

## Notes on things that are correct / not bugs
- The trust boundary is properly server-derived: product `name`/`category` passed to the pipeline come from the DB row (`route.ts:281-348`), not client input; eligibility is re-checked via `isProductEligibleForMode(..., "intake_dedupe")`; candidate membership is enforced before any product fetch. No IDOR found.
- `UNRESOLVED_PRODUCT_LOOKUP_STATUSES` and the runtime fallback/tool-guidance text were updated together for the new statuses (`final-answer-validator.ts:255-261`, `responses-agent.ts:2718-2742`, `tool-definitions.ts`), preserving the "unresolved blocks product-specific claims" boundary; `validateTrustedSelectedProductCaveat` adds the inverse guard so a verified selection isn't described as unverified.
- The clarification id being a random UUID for `needs_variant_selection`/`category_mismatch` (`chat-pipeline.ts:313`) is fine: the same object is streamed and persisted in one pipeline run, so live id == persisted id, and the endpoint validates against the persisted value.
- `buildAssistantDecisionContext` positional→options refactor was applied at both call sites (`route.ts:385-392`, `product-selection/route.ts:385-391`), so live SSE and saved `rag_context` cannot drift.

### Residual risk summary
The biggest real exposure is **#1 (idempotency race)** against the plan's durability requirement, followed by **#4 (untested authz/replay branches)**. **#2** and **#3** are quality/correctness issues confined to deterministic fallback paths. None of these block the main happy-path flow, which is well covered by the pipeline spec and the documented browser smoke.
