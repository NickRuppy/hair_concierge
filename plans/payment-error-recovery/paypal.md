# PayPal refund correlation — 2026-09-28

## Outcome
Process valid sale refund/reversal webhooks lacking a direct agreement ID using their original sale relationship, preserving analytics and retries. Current handler throws before recording and releases ledger claim, causing repeated500s. Two known event IDs are unresolved; live payload needs authenticated PayPal access. Current base cf7f4604.

## Decision coverage: confirmed
- Confirmed with Nick: request to fix diagnosed payment errors.
- Inherited: handler records refund_completed analytics and preserves payment_event_type; no entitlement, cancellation, refund or subscription state changes. Claim is released on failure and retained on successful processing. Never silently acknowledge unresolved accounting.
- Implementation defaults: direct agreement/subscription link remains preferred. Signed refund.sale_id identifies original sale; refund resource.id identifies distinct refund. If sale_id absent retrieve /v1/payments/refund/{refundId}, verify exact returned id and sale_id. Resolve original sale from matching local successful-sale analytics ownership; absent correlation falls back to GET /v1/payments/sale/{saleId}, exact returned id and billing_agreement_id required. Only fixed encoded provider paths with bounded abort signal; never follow payload URLs. Ambiguous/conflicting local ownership throws. Persist refund resource.id as event-key/source_object_id so partial refunds do not collapse; original_sale_id in payload. Reversal resource.id may be a sale candidate, accepted only by exact local successful sale or verified sale GET. Preserve current dedupe keys for compatibility. Compare refund amount/currency only to fetched refund when both present, never to original sale amount.
- Open consequential assumptions: none. This restores existing integration behavior; no surface, copy, timing or user-visible feedback changes.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: user “Let's fix those” applies to this internal repair; no separate UX approval required.
- Internal revalidation: initial researcher assumption resource.id=sale rejected using official refund schema; refund and sale identity now separate. Live incident payload remains unverified, so no claim of production resolution.

## Provider contracts
https://developer.paypal.com/api/deprecated/payments/v1/refund-get
https://developer.paypal.com/api/deprecated/payments/v1/sale-get
https://developer.paypal.com/subscriptions/webhooks/
PayPal refund model has distinct id and sale_id. Sale can have billing_agreement_id. A partial refund is not equal to its original sale amount.

## Implementation
1. Add bounded retrieval helpers and injectable deps in src/lib/paypal/webhook-handlers.ts (or cohesive new sale-refund helper); extend local event resource type with sale_id. Keep unlinked capture events on their existing one-time branch.
2. recordLinkedPayPalRefund: use direct link when present. Otherwise derive original sale via event.sale_id/refund lookup for refunded, validated sale candidate for reversed. Resolve unique local successful-sale outbox ownership or fetched sale agreement, reload billing row. Missing IDs/provider error/identity mismatch/DB failure/ambiguous ownership must throw and retain retry. Preserve source-object refund identity and event ledger/outbox idempotency.
3. Inspect type/lint and control flow. Suggested regression cases for later requested tests: direct link no lookup; refund.sale_id; missing sale_id resolved via refund GET; local sale association and historical provider fallback; partial refunds distinct; repeated delivery idempotent; reversal; ambiguous rows; foreign IDs; missing link; timeouts. Do not add/run tests unless explicitly requested.

## Boundaries and verification
No migration, production writes, subscription cancellation or refund submission. No replay now. After separately authorized deploy, fresh Sentry/ledger inspection and explicit provider resend approval can establish historical closure. Local static checks cannot prove those two live events are repaired without payload. Plans/source commit artifacts; reviews /tmp discard. Counterpart review before implementation; ready-check/review at completed authorized scope, preserving no-test constraint.

## Counterpart review — 2026-09-28
Claude approved this internal plan without technical blockers. Accepted disclosure: v1 refund/sale APIs are deprecated but match existing sale webhooks; unavailable lookups remain retryable. Production payload/replay unresolved. Analytics gate is recordBillingAnalytics=true; flag-off log-only behavior remains unchanged. Raw review /tmp/payment-error-recovery-plan-review.md is transient/discard. Frontend approval is independent.

## Implementation receipt — 2026-09-28
Implemented in src/lib/paypal/webhook-handlers.ts. Main review corrected initial worker omission of purchase_completed and added exact local user ownership validation. Blank direct agreement links can fall back to subscription_id; contradictory direct IDs throw. Fallback error retains contextual missing-link message plus original cause. Refund dedupe identity and capture-event branch preserved. No commits or production changes.

Main-session checks: npm run typecheck PASS; npx eslint src/lib/paypal/webhook-handlers.ts PASS; git diff --check PASS. Tests were not added or run because the current execution instruction requires an explicit request. Provider calls not exercised; live payloads still unavailable. This is locally implemented, statically checked code, not a production-resolution or release-ready claim.
