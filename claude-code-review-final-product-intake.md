I have completed a thorough review. Here is my report.

---

# Code Review — Product Intake Final Patch

**Scope reviewed:** `product-lookup.ts`, `notifications.ts`, `spec-readiness.ts`, `chat-pipeline.ts` (target/verified-spec sections), `product-selection/route.ts`, `select-products.ts` (assessment-target fallback), `product-lookup-clarification-card.tsx`, plus the six referenced test suites and supporting modules (`eligibility.ts`, `resolved-product-selection.ts`, `product-output.ts`).

**Overall:** The change is solid and unusually well-tested. The owned/non-recommended verified-spec gating is enforced consistently at three layers (catalog scoping in `scopeLookupCatalogForUser`, the lookup eligibility filter, and the selection-route re-check), the notification claim/release flow is correct for the single-worker case, and the selection persistence is idempotent via a deterministic UUID. Findings below are edge cases and residual risks, not blocking defects. I found no security/authorization regressions — the selection route correctly re-verifies ownership and conversation/user binding server-side.

---

## Findings (by severity)

### 1. Low–Medium — Notification idempotency only the *first* send is race-safe
`src/lib/product-intake/notifications.ts:263-277`

The atomic claim (`markNotificationSent`, `WHERE … notification_sent_at IS NULL`) only runs when `shouldClaimNotification = !submission.notification_sent_at`. Two paths bypass it:

- **Multiple status notifications for one submission.** `notification_sent_at` is a single column. If a submission is notified for `needs_more_info` (sets the timestamp) and later for `approved`, the second call sees a non-null `notification_sent_at`, so `shouldClaimNotification` is false and it materializes the message relying only on the **non-atomic** `existingProductIntakeReviewMessageId` check (`:283-294`).
- **Crash-recovery re-send** (the behavior `tests/product-intake-notifications.test.ts:161` documents) takes the same un-claimed path.

In those paths, two concurrent sends can both read "no existing message" and both insert, producing duplicate assistant messages.

**Mitigating reality:** dispatch is from `scripts/product-intake/review-actions.ts` (operator/worker-driven, effectively serial), so concurrency is unlikely. Hence Low–Medium, not Medium. If notifications ever move to a concurrent queue, this needs a per-status idempotency key or a unique DB constraint on `(submission_id, status)` for the message. **Not covered by a test** (only single-call behavior is asserted).

### 2. Low — Selection "already answered" conflict guard can be bypassed in long conversations
`src/app/api/chat/product-selection/route.ts:519-547`

`findExistingSelectionMessage` only scans the last 50 assistant messages (`.limit(50)`, `:527`). If the clarification was answered more than 50 assistant-messages ago and the user then selects a *different* candidate for the same clarification, `conflictingSelectionMessage` won't be found, so the "Diese Produktauswahl wurde bereits beantwortet…" guard (`:543`) won't fire. Because the stable UUID includes `selectedProductId` (`resolved-product-selection.ts:113-122`), the different product yields a different id and a *second* selection message for the same clarification is created.

Same-product idempotency is still backstopped by the stable-UUID duplicate-key path (`:640-687`), so only the cross-product conflict path degrades. Low severity (clarifications are normally answered immediately). **Not covered by a test.**

### 3. Low — Assessment-target fallback cannot reconstruct lookup-sourced targets
`src/lib/agent-v2/production/chat-pipeline.ts:196-274` + `src/lib/agent/tools/select-products.ts:253-294,3636-3643`

`selectProductAssessmentTargetProductIds` can add a target id sourced from a `found_exact` **lookup execution** (`:219-220`), but `selectProductAssessmentTargetProductHints` only emits hints for trusted/active-resolved products (`:251-271`). So a lookup-only target has an id but no hint. If the engine drops that product after `applyProductMemoryConstraints` (`select-products.ts:3606`), `buildTargetAssessmentFallbackProjection` filters the (empty) hints to nothing and returns `null` → the empty projection is used and the assessment target is silently lost.

Normally `preserveProductIds` (`select-products.ts:3604`) keeps the product, so this only bites when a user memory constraint strips it. The tested fallback (`agent-select-products-tool.spec.ts:1172`) always supplies a matching hint, so **this gap is uncovered**.

### 4. Low — `sendProductIntakeReviewNotification` throws even though the message was delivered
`src/lib/product-intake/notifications.ts:313-331`

If `bumpConversationUpdatedAt` fails *after* the message insert, `notificationMaterialized` is already `true`, so the claim is correctly retained — but the function re-throws (`:331`). The notification effectively succeeded (message persisted, claim held), yet callers see a failure. Retries are safe/idempotent, but this produces spurious error logs / Sentry noise. Behavior is intentional and tested (`tests/product-intake-notifications.test.ts:209`), but consider swallowing the bump error and returning `{ sent: true }` since the conversation-ordering bump is non-critical.

### 5. Low — Unrecognized user-supplied category is silently replaced by a text-inferred one
`src/lib/product-intake/product-lookup.ts:470-485`

`normalizeCategoryKey` returns `null` for an unknown identifier (confirmed in `product-identity/index.ts:94`). When `rawCategory` is an *unrecognized* string, `normalizedCategory` falls back to `productCategoryHintFromText(productNameText)`. The unsupported-category guard then checks `SUPPORTED_CATEGORY_SET.has(normalizedCategory ?? rawCategory)` — which passes on the inferred category, so the explicit (garbage) category is treated as the inferred one rather than rejected as `unsupported_category`. Recognized-but-unsupported categories (e.g. `peeling`) are still correctly rejected (test at `product-intake-lookup.test.ts:246`). Low impact since these args come from the model; worth a comment at minimum.

---

## Residual risks / notes (no action required)

- **Double pipeline execution on concurrent same-product selection.** Two simultaneous selections of the same product both run the full `runAgentV2ProductionPipeline` (LLM cost ×2) before one loses the stable-UUID race and replays the other's content (`route.ts:600-687`). Correct, just wasteful.
- **State persisted ahead of message on insert failure.** In the fresh path, `persistConversationStateTransition` runs (`:618`) before the message insert; a *non-duplicate* insert error (`:688`) leaves conversation state updated with no assistant message. Self-heals on retry.
- **`eligibilityContext` in the lookup tool is effectively a no-op restriction.** `chat-pipeline.ts:914-918` passes `ownedProductIds = all scoped catalog ids` + `hasVerifiedSpecs: true`, so the `owned_assessment` branch in `lookupCatalogForEligibilityMode` never further narrows — the real gating already happened in `scopeLookupCatalogForUser`. Correct, but the redundancy is easy to misread as the enforcement point.
- **`SUPPORTED_PRODUCT_CLAIM_FIELDS`** has duplicate `primary_effect`/`hair_color_fit`/`scalp_sensitivity_fit` entries (`select-products.ts:149-160`) — harmless for membership use and **pre-existing** (not in this diff), so out of scope.

## Test coverage assessment

Strong. The suites cover the headline behaviors directly: verified-spec gating both allow/deny (`agent-v2-product-selection.spec.ts:1643,1721`), pipeline owned-without-specs hiding (`agent-v2-production-chat-pipeline.spec.ts`), lookup category inference/exactness/mismatch (`product-intake-lookup.test.ts`), notification claim/release/keep paths (`product-intake-notifications.test.ts`), idempotent duplicate-key/existing-message replay with card suppression (`agent-v2-product-selection.spec.ts:1989`), and the assessment-target fallback with hints (`agent-select-products-tool.spec.ts:1172`).

**Gaps worth adding:** (a) lookup-sourced target with no matching hint dropped by the engine (#3); (b) cross-product conflict guard beyond the 50-message window (#2); (c) notification concurrency on the `notification_sent_at`-already-set path (#1).
