I've verified the load-bearing findings directly against the code. Confirmed: the notification claim is taken at `notifications.ts:268` before the message insert at `:296`, and the rollback at `:320` is best-effort (warn-and-swallow at `:327`) — so a double-failure permanently suppresses the review notification. I now have everything needed for the report.

---

# Code Review — Product-Intake Full-Flow (dirty working tree + branch)

**Scope reviewed:** the uncommitted working tree (~5k src lines, ~2.5k test lines), 6 untracked source modules, and 6 untracked test files that together implement the product-lookup clarification flow extracted out of `chat-pipeline.ts` (−1209 net) into `product-lookup-turn-outcome.ts` (new, 1478 lines) and sibling modules. The 243-file/`main...HEAD` diff is mostly unrelated merged work (stripe, recommendation-engine, rag deletions) and was treated as out of scope.

**Headline:** No security/authorization holes found — auth, cross-user scoping, and notification recipient derivation are all handled correctly (details under *Verified safe*). The substantive risks are (1) a test-integrity gap that could silently drop ~105 relocated tests, (2) two paths that resolve/assess a product more aggressively than the old code, and (3) one user-facing notification reliability regression. None are confirmed Critical, but #1–#3 below should gate the merge.

---

## High

### H1 — Test relocation is not safely wired: one new spec is excluded from CI, and all six new test files are untracked
`package.json:37`, `git status`

The pipeline spec `tests/agent-v2-production-chat-pipeline.spec.ts` shrank by ~4567 lines (working tree) and its scenarios were re-homed into six **untracked** files (`git status` shows all `??`). Two problems:

1. `test:agent` (`package.json:37`) enumerates files explicitly — no glob. It lists `agent-v2-product-lookup-clarification.spec.ts`, `agent-v2-product-selection.spec.ts`, and `agent-v2-product-lookup-policy.spec.ts`, but **omits `tests/agent-v2-resolved-product-selection-adapter.spec.ts`**. Even once tracked, those 9 adapter tests will never run in CI.
2. All six new test files are untracked. If the chat-pipeline-spec shrink is committed without `git add`-ing the replacements, ~105 relocated tests vanish and the coverage loss becomes real.

Current state passes (308 tests green, verified by the test-review pass) only because the untracked files exist on disk. **Action:** add the adapter spec to `test:agent`, and confirm all six files are staged in the same commit as the pipeline-spec shrink.

### H2 — Subset-token `exactLike` can silently auto-confirm a wrong specific SKU as `found_exact`
`src/lib/product-intake/product-lookup.ts:361`, `:383-388`, `:405-417`

```ts
exactLike: overlap > 0 && inputTokens.every((token) => productTokens.has(token)),   // :361
```
`exactLike` is true whenever the input's meaningful tokens are a *subset* of the product's tokens — not an equality. So `product_name_text: "Repair"` is `exactLike` against `"Repair Mask Intensive Treatment"`. `findConfidentExactTextCandidate` (`:383-388`) then returns `found_exact` when exactly one same-category product contains that token, and `lookupWithoutCategory` (`:405-417`) does the same across **all** categories with no category constraint. `found_exact` maps to `blocks_product_specific_answer: false` (product-lookup-policy), so the assistant evaluates a specific product the user only partially named — bypassing the clarification card whose whole purpose is to avoid this. The `length === 1` guard only protects when ≥2 products share the token. **Action:** require a stronger match (bidirectional token equality, or a minimum meaningful-token count/overlap ratio) before treating a text candidate as `found_exact`; single-token inputs should fall through to `needs_variant_selection`. Likelihood depends on what `product_name_text` the model passes, but the deterministic lookup is meant to be the safety net.

### H3 — Resolved `product_assessment` can render an empty projection → hard failure on the happy path
`src/lib/agent/tools/select-products.ts:3556-3560`, `src/lib/recommendation-engine/selection.ts:1025`

For `product_detail`/assessment, the projection is filtered to the target IDs:
```ts
const targetProductIdSet = new Set(uniqueNonEmpty(targetProductIds ?? []))
const productsForProjection =
  targetProductIdSet.size > 0
    ? constrainedProducts.filter((product) => targetProductIdSet.has(product.id))   // can be []
    : constrainedProducts
```
`includeProductIds`/`preserveProductIds` are supposed to keep the target, but the per-category engines short-circuit **before** that: `if (!decision.relevant || !decision.targetProfile) return []` (`selection.ts:1025`, and the same guard at `:582/714/879/1243/…`). When the engine deems the resolved product's category not relevant for the user's profile, `engineProducts` is `[]`, the target filter yields `[]`, and the `product_assessment` projection has zero products — for a product the user explicitly named and that was just resolved via `found_exact`. `validateProductAssessmentGrounding` (final-answer-validator.ts) then blocks the answer. Separately, `sliceWithIncludedProductIds` (`selection.ts:287`) only re-prioritizes `preserveProductIds` when `products.length > limit`, so it provides no "always keep the target" guarantee. **Action:** guarantee the resolved target survives to the projection (ground the assessment on the resolved identity directly, or bypass the relevance short-circuit when an explicit `targetProductIds` is present).

---

## Medium

### M1 — Notification "claim-before-insert" can permanently suppress the review notification
`src/lib/product-intake/notifications.ts:267-332`

The refactor now claims the slot first (`markNotificationSent`, `:268`) then inserts the message (`:296`). On insert failure, rollback (`releaseNotificationSentClaim`, `:320`) is best-effort and swallowed (`:327`). If both the insert and the rollback fail, `notification_sent_at` stays set with no message; the next retry short-circuits at `:258` (`already_sent`) and the user **never** receives the "your product was reviewed" message. The old order (insert first, mark after) was retry-safe. This trades a rare double-send for a rare silent permanent drop — worse for a user-facing message. **Action:** reconcile on read (if `notification_sent_at` is set but no review message exists for that submission/status, allow re-send) rather than relying on best-effort rollback.

### M2 — Removed `if (!category) return null` guard: clarification cards and intake offers now carry a `null` category
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:441-443`, `:491-505`

The old chat-pipeline early-returned when the lookup category wasn't an intake category. The new code derives `category` from `sameCandidateCategory` (can be `null`) and emits a clarification with `query.category: null` plus a synthesized `none_action.product_intake_offer` with `category: null, missing_fields: ["Kategorie"]`. Candidate *selection* is safe (each candidate carries its own `category`), and `product-intake-card.tsx` defensively handles `offer.category ?? ""` — but this is a deliberate behavioral expansion (cards now show for category-less lookups). **Action:** confirm the intake submission path requires the user to pick a category before submit when `category` is null (i.e. `missing_fields: ["Kategorie"]` is actually enforced in the card's disabled/submit logic), so a brandless/categoryless offer can't be submitted with no category.

### M3 — `named-product-context` intent now drops the `hasCurrentUse` precondition (broadening)
`src/lib/agent-v2/named-product-context.ts:348-353`

```ts
-  if (params.hasCurrentUse && params.hasCurrentUseProductQuestion) return "current_use_product_question"
+  if (params.hasCurrentUseProductQuestion) return "current_use_product_question"
```
Messages that previously fell through to `evaluation`/`background` may now be classified as current-use product questions, which feed the deterministic lookup/clarification fallbacks. Whether this is safe depends entirely on whether `hasCurrentUseProductQuestion` can be true without an actual current-use context. **Action:** verify the producer of `hasCurrentUseProductQuestion`; if it can fire without current use, this misclassifies and triggers lookup flows on unrelated messages.

### M4 — Pre-existing intake/clarification actions now gated on `safetyMode === "normal"`
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:98-99`

```ts
const productLookupActionsAllowed =
  params.safetyMode === "normal" && params.productIntakeEnabled && !suppressStaleLookupActions
```
The old pipeline gated the intake offer / clarification / deterministic fallback only on `productIntakeEnabled && !suppressStaleLookupActions`. Now, if a message trips a non-`normal` safety mode while also naming an unknown product, the user no longer gets the intake offer they previously would have. Likely intentional given the new `pendingReviewFallbackAllowed` split, but it's a real semantics change. **Action:** confirm intended and add a regression fixture for "named product + safety-mode" message.

### M5 — Clarification-card double-submit window before authoritative state propagates
`src/components/chat/product-lookup-clarification-card.tsx:57-76`, `:112-116`

`onSelectProduct`'s `finally` resets `selectingProductId` to `null` (`:74`), but `isSelected`/`canSelect` depend on `resolvedSelection`, which arrives via a later prop re-render from the server round-trip. In the window between the request resolving and the prop updating, all buttons re-enable and show "Auswählen" again, permitting a second click on a *different* candidate. **Action:** hold an optimistic local "submitted" state (mirror the chosen `selectedProductId` locally) so buttons stay disabled until `resolvedSelection` confirms.

### M6 — Product-selection hard failures return HTTP 200 (SSE error), and state-persist failure aborts even on replay
`src/app/api/chat/product-selection/route.ts:525-528`, `:539-548`, `:629-638`, `:680-682`

The new failure paths funnel through `streamProductSelectionError`, which builds a `Response` with no status → HTTP 200 carrying an SSE `type:"error"` event. `fetch().ok`/infra monitoring will read these state-persistence failures as success. Worse, on the idempotent *replay* branches (`:539-548`, `:629-638`) a secondary state-write failure now returns an error instead of streaming back the already-persisted assistant message, degrading a previously-successful interaction. This extends a pre-existing 200-on-error pattern, but widens it considerably. **Action:** return a non-2xx for hard infra failures; on replay branches, log-and-continue rather than failing when the canonical message already exists.

### M7 — Selection responses now force `product_recommendations: null` (intentional?)
`src/app/api/chat/product-selection/route.ts:554`, `:599`, `:644`

All three paths now drop `matchedProducts`/stored `product_recommendations` to `null`, so product cards that previously accompanied a resolved selection no longer render. Consistent across the code (not a bug), but a user-visible behavioral change. **Action:** confirm selection answers are intended to be text-only.

---

## Low

- **L1 — Dead state-builder extended in parallel (schema-drift hazard).** `buildNextAgentV2SessionState` (`src/lib/agent-v2/production/session-state.ts:158-210`) has no callers; production uses `buildConversationStateTransition` in `chat-pipeline.ts`. The branch added `active_product_contexts` handling to the dead function, duplicating logic and already diverging (it always recomputes `active_resolved_product_context`; the live builder treats `undefined` as "recompute"). Delete it or make one delegate to the other.
- **L2 — `normalizeLookupToken` is nullified by the low-value filter.** `product-lookup.ts:220-222` maps `"nr"→"no"`, but both are in `LOW_VALUE_PRODUCT_TOKENS` and dropped at `:240`. Dead/misleading. If "Nr/No" should be meaningful, remove them from the low-value set; otherwise delete the normalizer.
- **L3 — `MAX_ACTIVE_PRODUCT_CONTEXTS` magic number.** Bare `.slice(-3)` is repeated across `responses-agent.ts:292`, `session-state.ts:198/203`, `chat-pipeline.ts:637`, `product-lookup-turn-outcome.ts:247/255`, and the merge adapter. Extract a shared constant.
- **L4 — `product-lookup-turn-outcome.ts` (1478 lines) has no direct unit test.** Covered only transitively via `runAgentV2ProductionPipeline`. Its sibling `resolved-product-selection-adapter.ts` got a dedicated spec (which itself isn't CI-wired — see H1). Consider direct tests for `normalizeProductLookupExecutionInput`/`buildProductLookupTurnOutcome`.
- **L5 — Eligibility-mode divergence between recovered/fallback and primary lookup.** Recovered/fallback lookups use `eligibilityMode: "intake_dedupe"` (`product-lookup-turn-outcome.ts:557/613/821`) while the primary `lookup_product_candidate` tool now uses `"user_visible"` with `{ownedProductIds, hasVerifiedSpecs}`. A recovered clarification card could surface candidates the primary tool would filter (or vice versa). Confirm the pre-scoped catalog makes these equivalent, or align them.
- **L6 — `BARE_JA_OPENING_PATTERN` is a `block` that depends on a narrow confirmation whitelist.** `user-facing-language.ts:54` hard-blocks answers opening with "Ja, …" unless `isExplicitConfirmation(latestUserMessage)` matched — but that whitelist (`:393-406`) only matches short fixed phrases, so a natural "Ja, das ist möglich …" reply to a multi-word confirmation gets blocked. Confirm the whitelist is broad enough or downgrade to `warn`.
- **L7 — Copy drift for `found_exact`.** `chooseRicherResolvedProductName` (`product-lookup-turn-outcome.ts:~1301-1352`) now prefers the catalog name over the user's display name on a token tie, changing the "Ich habe X gefunden" copy. Add a fixture so eval snapshots don't silently drift.
- **L8 — `noUncheckedIndexedAccess` typecheck.** `matchingContexts[0]` (`product-lookup-turn-outcome.ts:~900`) is guarded by a length check at runtime but may be a type error if the flag is on. A full `npm run ci:verify` (typecheck + build) was **not** run in this review — see residual risk.

---

## Verified safe (checked, no defect)

- **Authorization / cross-user:** `product-selection/route.ts` verifies `conversation.user_id === user.id` (`:431`), scopes the source message to the conversation (`:438-446`), and binds candidate `product_id`s to the trusted clarification card and re-fetches with a visibility check before resolving (`:454-490`) — a user cannot act on another user's session or inject a foreign product. Conversation-state writes are FK- and `user_id`-scoped.
- **Notification recipient:** derived from `submission.user_id`/`source_conversation_id`, never request input — no wrong-recipient/leak vector. The `markNotificationSent` claim is a conditional update, so concurrent sends de-dupe correctly (the only gap is the double-failure case in M1).
- **Backward compatibility:** old persisted sessions migrate `active_resolved_product_context` → a single `active_product_contexts` entry (`persisted-session-state.ts:174-188`); old sessions load without crashing.
- **XSS:** all user-facing rendering goes through ReactMarkdown / React text children; no `dangerouslySetInnerHTML` on dynamic content. Product names render as plain JSX text.
- **Test quality:** the relocated tests use concrete `deepEqual`/ordering assertions (not mock-call tautologies); auth/ownership short-circuits and notification ordering are asserted. No `.only`/`.skip`/`.todo` or commented-out assertions introduced.

---

## Residual risk / gaps

- **Full verification not run here:** I confirmed the targeted unit tests pass (308 green) but did **not** run `npm run ci:verify` (typecheck + lint + build). Run it before merge — L8 and any `null`-category type-flow (M2) are best caught there.
- **No end-to-end run** of the clarification → selection → assessment happy path with a real engine. H3 (empty projection) and M5 (double-submit) are most reliably confirmed by exercising the live flow.
- **Highest-confidence, most actionable item is H1** (test wiring/staging) — it's a one-line `package.json` fix plus `git add` discipline, and without it the headline "coverage preserved" claim silently becomes false on commit.
