# Code Review: Product Lookup Clarification Card (working tree + branch diff vs `HEAD`)

**Scope reviewed:** `git diff HEAD` plus untracked feature files — new endpoint `src/app/api/chat/product-selection/route.ts`, new component `product-lookup-clarification-card.tsx`, and changes to `chat-pipeline.ts`, `responses-agent.ts`, `final-answer-validator.ts`, `product-lookup.ts`, `route.ts`, `use-chat.ts`, `chat-message.tsx`, `stream-events.ts`, `persisted-session-state.ts`, `session-state.ts`, `types.ts`, `tool-definitions.ts`, and tests. Ignored `supabase/.temp/cli-latest` and the untracked review/plan markdown.

**Verification run during review:** `tsc --noEmit` clean; `product-intake-lookup` (12), `agent-v2-production-chat-pipeline` (58, incl. route-level selection tests), `agent-v2-final-answer-validator` (188), `agent-v2-responses-runtime` (115) all pass.

**Overall:** No blocking correctness or security bug found. Auth/ownership/candidate-revalidation on the new endpoint is sound and well-tested. The findings below are behavioral/trust-boundary risks introduced by the "treat selection as verified" seam, plus idempotency nuances and test gaps.

---

## Findings (ordered by severity)

### 1. Medium — Trusted-selection seed disables tool-call grounding for *property-level* claims; enforcement is prompt-only

On every turn where a selected/active product is present, `runAgentV2ResponsesTurn` seeds three things into validation context (`responses-agent.ts:326–397`): a synthetic `found_exact` `productLookupResults` entry (`buildTrustedSelectedProductLookupResult`, `:1110`), a `select_products` projection (`buildTrustedSelectedProductProjection`), and `trustedSelectedProductIds`.

`isGroundedByTrustedProductSelection` (`final-answer-validator.ts:1469`) then short-circuits `validateProductToolRequired` (`:1459`) and `validateInterpretationToolHistory` (`:882`) whenever every referenced product id is in the trusted set, and `validateNamedProductLookupRequired` / `validateProductLookupResultClaims` pass because a `found_exact` result is seeded.

The seeded projection carries `supported_claims: []` and `allowed_claim_sources: ["selected_products.name", "product_lookup_selection"]`, but **the validator never enforces those fields** (`rg allowed_claim_sources|supported_claims src/lib/agent-v2/validation` → no matches). Net effect: across the *entire* active-product window — which persists across follow-up turns until the user names a new product (`buildNextActiveResolvedProductContext`, `chat-pipeline.ts`) — the model can assert specific product properties (ingredients, "passt zu deinem Frizz", etc.) about the resolved product with **no tool call and no real product specs in context**, and the validator accepts it. The product *identity* is verified server-side; the product *facts* are not. The only guardrail is the prompt instruction in `buildInputItems`. This is a real loosening of the existing "found_exact ⇒ answer from verified properties" boundary, because here `found_exact` is asserted without the model ever having fetched the row's properties.

Recommendation: scope the trusted relaxation to identity (`product_detail`/acknowledgement answers) and still require a product tool call before property/suitability claims, or enforce `allowed_claim_sources` for trusted-seed projections.

### 2. Medium — `validateTrustedSelectedProductCaveat` regex is over-broad; can block honest hedges and fall through to generic failure

`final-answer-validator.ts:1507`:
```
/(?:kann|konnte).{0,80}(?:nicht|nicht\s+sicher).{0,80}(?:prüfen|pruefen|bewerten|bestätigen|bestaetigen)/iu
```
The intent is to stop the model calling a selected product "unverified." But with `.{0,80}` gaps this also matches legitimate, honest claim-level hedges about a *real* product, e.g. *"ob es zu deinem Frizz passt, kann ich nicht abschließend bewerten."* Because the trusted seed (Finding 1) is active on *every* active-product follow-up, this validator fires broadly, not just on the selection turn.

When it blocks and repair fails, the deterministic safety net `buildActiveResolvedProductFollowupFallback` (`responses-agent.ts:2598`) only triggers for `isActiveResolvedProductFollowupMessage` (`:2680`: `wie oft|häufig|anwenden|verwenden|benutzen|nutzen|dosier|menge|viel|kombinieren`) or selection-turn messages. A "passt das zu meinem Frizz?" follow-up — explicitly a target scenario in the plan (Task 5) — is **not** covered, so a blocked-then-failed-repair answer there can fall through to generic failure copy. Tighten the regex (require the negation to attach to the product, not an arbitrary claim) and/or broaden the deterministic fallback to match the plan's stated follow-ups.

### 3. Low–Medium — Idempotency has a TOCTOU window: concurrent identical selections run the pipeline twice and stream divergent content

The dedup is a read (`findExistingSelectionMessage`, `route.ts:310–342`, last 50 messages) followed by a stable-PK insert (`createStableUuidFromParts` → `assistantSelectionMessageId`, `:343`, insert at `:403`). These are not atomic. Two concurrent identical requests (two tabs, a retried request) both miss the read, both invoke `runAgentV2ProductionPipeline` (full LLM cost), both stream answers to their clients, then collide on insert — one wins, the loser hits `isDuplicateKeyError` and returns gracefully (`:422`). Consequences: duplicate compute, and the losing client sees a streamed answer that is **not** the persisted/canonical one (it diverges on reload). The duplicate-key branch also correctly skips `persistConversationStateTransition`, so state stays consistent.

Client guards (`isStreaming` throw, `selectingProductId`, `selectionDisabled`) make ordinary double-clicks safe, so this is acceptable for V1 — but the only true idempotency guarantee is the PK uniqueness on persistence, not on user-visible streamed output. Worth a code comment documenting that the read-check is best-effort and the PK is the real dedup.

### 4. Low — Idempotent replay drops product recommendation cards

On replay (`existingSelectionMessage` found), `streamAssistantContinuation` is invoked without `productRecommendations` (`route.ts:322–341`), and the persisted `product_recommendations` column is not re-selected (the replay query at `:310` omits it) or re-emitted. A replayed selection answer therefore streams text + selection marker but no recommendation cards (they only reappear on a full reload). Minor live/replay inconsistency.

### 5. Low — Malformed request body returns 500 instead of 400

`route.ts:236` `const body = (await request.json()) as ProductSelectionBody` is unguarded. A non-JSON body throws before any validation, surfacing as a 500, whereas every other invalid input returns a clean German 400. Wrap in try/catch for consistency.

---

## Test gaps

Route-level security is well covered (non-candidate id, unauthenticated, foreign conversation, stale clarification, inactive product, replay, trusted-context continuation — `agent-v2-production-chat-pipeline.spec.ts:820–1100+`), and `hasExistingProductSelectionMessage` + card rendering/disabled/suppression are covered in `chat-product-mentions.test.tsx`. Missing:

- **Duplicate-key insert path** (`isDuplicateKeyError`, `route.ts:422`) — the second-writer race resolution is untested.
- **Conversation-state persistence on a successful selection** — no test asserts `persistConversationStateTransition` is called / `active_resolved_product_context` is written (Task 4 "must persist the resolved-product conversation state"). The replay and rejection tests assert `insertedMessages.length === 0`, but the happy-path state write isn't asserted.
- **Caveat false-positive regression** (Finding 2) — no test that an honest claim-level hedge about a trusted product is *not* blocked.
- **"passt das?"-style active-product follow-up** (Finding 2 / plan Task 5) — only `wie oft?`-style is exercised by the deterministic fallback.
- `selectProductCandidate` hook behavior (abort handling, temp-message cleanup on error) is untested; only the pure dedup helper is.

---

## Things checked and OK

- **Lookup status split** (`product-lookup.ts:365–399`): same-category candidates → `needs_variant_selection`; strong cross-category (requires `text_category_mismatch_review` **and** all meaningful input tokens present, with category words stripped via `LOW_VALUE_PRODUCT_TOKENS`) → `category_mismatch`; otherwise `not_found`. This correctly prevents the original Syoss "Intense" one-token bug, and `UNRESOLVED_PRODUCT_LOOKUP_STATUSES` (`final-answer-validator.ts:255`) now includes both new statuses, preserving the trust boundary.
- **Persisted-state normalizer** updated on both shapes (nested `agent_v2.*` and legacy flat `agent_v2_*`, `persisted-session-state.ts:95/103`) and additive (`createDefault`, `buildAgentV2State`, `summarize`, `session-state.ts:194` all updated) — no migration needed, tolerates legacy states.
- **Endpoint authz**: getUser → source-message role+conversation match → conversation ownership → clarification id match → candidate-membership → `isProductEligibleForMode(..., "intake_dedupe")` re-check. Uses DB product name over persisted candidate name. Eligibility mode matches the lookup's mode.
- **SSE injection**: all payloads `JSON.stringify`-encoded, so newlines can't break `\n\n` framing; client `JSON.parse`s each line.
- **Card defensive rendering** returns `null` on malformed payload (`product-lookup-clarification-card.tsx:40–48`); recommendation cards and intake card are mutually suppressed when a clarification is present (`chat-message.tsx`).
- **`buildAssistantDecisionContext`** options-object refactor — both call sites (`route.ts:483`, `product-selection/route.ts:410`) updated; no stragglers.
