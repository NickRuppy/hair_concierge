I now have a complete, verified picture. Here is the review.

---

# Code Review — `codex/product-intake-full-flow-smoke` (working tree)

## Scope & method
The branch is 57 commits ahead of `main` (543 files), but that history is per-phase work already reviewed (`plans/*.claude-review.md`). I focused on the **uncommitted working-tree changes** (~60 files) that constitute the active "full-flow smoke" scope: the product-lookup engine, the chat-pipeline → `product-lookup-turn-outcome` extraction, the new resolved-selection adapter/policy modules, the product-selection API route, intake notifications, and the intake card. I read the diffs and surrounding code directly, cross-checked the extraction against the deleted code, and ran the relevant specs.

**Verification run:** `tsc --noEmit` clean; targeted specs green — `product-intake-lookup` + `agent-v2-product-selection` + `agent-v2-product-lookup-clarification` (74 pass), and `resolved-product-selection-adapter` + `product-lookup-policy` + `resolved-product-selection` + `product-intake-notifications` (18 pass).

**Bottom line:** No Critical/High confirmed bugs. The validator/trust gate is *net-tightened*, not loosened, and the privacy scoping is correct. The notifications change is a genuine concurrency fix. Findings below are one data-integrity risk, a couple of behavioral changes worth confirming, and a notable test gap.

---

## Findings (by severity)

### 1. Medium — Idempotent selection path can clobber conversation state (silent data loss) on a transient read error
`src/app/api/chat/product-selection/route.ts:295-311` (`loadCurrentAgentV2State`) → `:338` (`persistResolvedSelectionState`) → `src/lib/chat-runtime/conversation-state-store.ts:108-110`

The two new idempotent branches (existing-selection at `route.ts:519`, duplicate at `:601`) now persist state themselves via `persistResolvedSelectionState`, which first calls `loadCurrentAgentV2State`. That loader **swallows the DB error** (`console.error` at `:308`) and returns `normalizeAgentV2ConversationState(data?.state)` = a **fresh default empty state** (`:311`). `persistConversationStateTransition` then does a **blind `upsert` on `conversation_id`** with `state: next_state` (no compare-and-swap on `state_version`/`previous_state`). So if the `conversation_states` read fails transiently on an existing, populated conversation, `next_state` is built from the empty default and the upsert **overwrites `session_memory`, derived signals, and all prior `active_product_contexts`**.

Why it matters: silent and destructive, and these branches have no pipeline result to fall back on. Unlike the main pipeline path (which threads its own loaded state), here the separate load + error-swallow + blind upsert combine into a clobber. The error-swallowing default pattern is pre-existing elsewhere, which caps this at Medium — but in *these* branches the safe behavior is to fail closed (return `streamProductSelectionError()`) when the state load errors, rather than persist on top of a default.

### 2. Medium — `found_exact` is now promoted to a persisted "resolved" product context for *every* model lookup, and the matcher gained fuzzier `found_exact` paths
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:218-245` + `src/lib/product-intake/product-lookup.ts:360-410` (`lookupWithoutCategory`), `:625-647` (`confidentExactTextCandidate`)

In the old pipeline only the *deterministic fallback* or an explicit *trusted selection* produced a resolved product context (deleted `buildActiveResolvedProductContextFromLookup({fallback})` + `buildNextActiveResolvedProductContext`). The new code maps **every** execution through `buildActiveProductContextFromLookup`, marking any `found_exact` as `status:"resolved"` (`resolved-product-selection-adapter.ts:211-225`), which `buildPrimaryResolvedProductContext` then feeds forward as the trusted product the assistant may answer about. Simultaneously, `product-lookup.ts` adds two *new* ways to reach `found_exact`: a category-less brand-scoped text match (`lookupWithoutCategory`, single exact-like candidate) and `confidentExactTextCandidate`. Net effect: a borderline match (all input tokens ⊆ a product's clean name) can now pin the session to that product across turns.

This appears intentional for the new product-assessment feature, and it's bounded (requires `found_exact` on the user-visible/owned catalog, and the validator still requires the id to be in `resolvedProductIds`, so it does not fail *open* to unsupported claims). But it materially widens the "this is the resolved product" surface vs. prior behavior — worth confirming the exact-like threshold is strict enough that a near-miss can't silently become the assessed product.

### 3. Medium — New notification rollback logic is essentially untested
`src/lib/product-intake/notifications.ts:221-238` (`releaseNotificationSentClaim`), `:264-330` (claim-first + try/catch rollback) vs `tests/product-intake-notifications.test.ts` (1 test)

The notifications rewrite to a claim-first pattern is correct (atomic claim via `.is("notification_sent_at", null)` at `:210`, release scoped to the exact `sentAt` at `:225-233`). But the only test covers the claim-loses race (`claimSucceeds: false` → `already_sent`). The **riskiest new paths are unverified**: (a) claim succeeds → message insert throws → `releaseNotificationSentClaim` actually resets `notification_sent_at` so a retry can re-send; (b) the `notificationMaterialized = true` guard prevents rollback after the message exists; (c) the existing-message branch bumps + returns `already_sent`. A transactional-integrity change like this should pin those behaviors with tests.

### 4. Low/Medium — Clarification card fabricates a category for multi-category candidate sets, which pre-fills the intake "add my product" form
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:422-492`

When `execution.result.category` isn't a valid key, `category` falls back to `uniqueCandidateCategories[0]` (`:426-428`) — an arbitrary first candidate's category when candidates span categories. The prompt copy degrades gracefully (generic "Meinst du eines dieser Produkte?" because `sameCandidateCategory` is null), but this `category` is written into `query.category` (`:475`) and, more importantly, into the synthesized `none_action.product_intake_offer.category` (`:484-492`) used when the user clicks "Nein, mein Produkt hinzufügen". So the intake form can be pre-seeded with a wrong category. The user can change it in the card, so it's a defaulting bug, not a hard failure.

### 5. Low — `withProductIntakeVisibleFailureCopy` can overwrite tailored `constraint_blocked` copy with generic intake copy
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:261-284`

The switch applies `PRODUCT_INTAKE_VISIBLE_FAILURE_COPY` to `constraint_blocked` (and `clarification`, `general_advice`, …). When `visibleFailure && productIntakeOffer` and a model-produced answer is `constraint_blocked` with `failure_stage !== null`, its `user_facing_answer_de` is clobbered by the generic intake message (while `blocking_constraints`/`safe_alternative_de` survive). This is a narrow edge case but produces inconsistent user-facing copy. Confirm the override is intended only for product-shaped answers.

### 6. Low — Behavioral changes in the product-selection route worth confirming
- `productRecommendations` is now **always `null`** on the selection continuations (`route.ts:536, 625` and the main path) — recommendation cards no longer render after a clarification selection. Consistent with `product-assessment` mode suppressing cards (`product-output.ts` returns `[]` for non-recommendation modes), so intended; flag only if a selection can legitimately resolve to `product_recommendation`.
- `isSelectedProductVisibleToUser` (`route.ts:263-291`) tightens selectability from `intake_dedupe` (any active product) to `general_recommendation` **or** user-owned. This matches the candidates the user-visible catalog produced, so it should be safe, but a candidate the user no longer "owns" at selection time now returns "nicht mehr verfügbar".
- `hasVerifiedSpecs: true` is hardcoded for owned-assessment eligibility in both `route.ts:291` and `chat-pipeline.ts:816` — any active product matched in the user's routine inventory is treated as having verified specs. Bounded to owned products; verify the assumption.

### 7. Low — Latent: shared `offerId` per request
`src/lib/agent-v2/production/chat-pipeline.ts:812` (`offerId: \`product-intake-${requestId}\``)

`offerId` became required and all lookups in a turn share one id (was a per-call `crypto.randomUUID()` fallback). Only one intake offer is surfaced per turn (`selectProductIntakeOfferForAnswer` returns a single offer) and `requestId` differs per run, so there's no realized collision today — but if multiple offers were ever surfaced in one turn, their ids would collide. Worth a comment or a per-execution suffix.

### 8. Low — `responses-agent.ts` double-seeds the primary resolved product
`src/lib/agent-v2/runtime/responses-agent.ts:312-336, 400-409`

When there's no trusted selection, the same primary product is seeded once via the trusted path and again via `activeProductContexts` mapping (projections, lookup results, `trustedSelectedProductIds`). Downstream consumers dedupe via `Set`, so no incorrect validation — just redundant context bloat. Dedup by `product_id` if these arrays grow.

### 9. Low — `INTERNAL_INSTRUCTION_LEAKAGE_PATTERN` is `block`-severity and can false-positive
`src/lib/agent-v2/validation/user-facing-language.ts:50-51`

`/\bich\s+(?:soll|muss)\s+(?:keine?|nicht|nur|...)\b/iu` matches natural openers like "Ich muss nur kurz nachfragen …". No current fixture trips it, but a block-severity validator rejecting valid German prose forces a needless repair loop. Consider tightening to internal-sounding tails or downgrading to `warn`.

---

## Reviewed and found sound (not issues)
- **Privacy/scoping is correct.** The user-visible catalog widening (`product-lookup.ts:157-176`) adds `owned_assessment` products, but `isProductEligibleForMode(..,"owned_assessment", ctx)` returns `false` when `ctx` is undefined (requires `ownsProduct` **and** `hasVerifiedSpecs`), and the only `user_visible` caller scopes `ownedProductIds` to the user's matched routine inventory (`chat-pipeline.ts:731, 814-816`). No cross-user leakage.
- **`buildPrimaryResolvedProductContext` returning `null` when the newest context is `pending_review`** is intentional and explicitly tested (`tests/agent-v2-resolved-product-selection-adapter.spec.ts:235-264`) — fail-safe, not a bug.
- **The trust gate is net-tightened.** `validateProductLookupResultClaims` added an extra unresolved-results guard, `makesProductSpecificClaim` gained branches, and the unknown-status default is now "unresolved" (safer). Treats unknown statuses conservatively.
- **`persisted-session-state.ts` migration is robust** — legacy V1/V2 states without `active_product_contexts` migrate the single `active_resolved_product_context` without crashing or dropping data; malformed entries are filtered.
- **Notifications claim-first pattern** correctly prevents duplicate sends under concurrency.

## Test gaps / residual risk
1. **Notifications rollback** (finding #3) — add tests for insert-failure→release, post-materialization no-rollback, and existing-message bump.
2. **No test for the combined "`found_exact` lookup + `not_found` intake offer in the same turn"** path through `product-lookup-turn-outcome` — the order-dependent primary-resolution selection (pending appended last) deserves a regression test, especially given finding #2.
3. **State-clobber on read error** (finding #1) — no test exercises `persistResolvedSelectionState` when `loadCurrentAgentV2State` errors; a fail-closed test would lock in the fix.
4. The `chat-pipeline` spec churned heavily (~5.5k lines) — I did not exhaustively diff the test changes for *removed* assertions; worth a glance to confirm no safety assertion was deleted rather than relocated.
