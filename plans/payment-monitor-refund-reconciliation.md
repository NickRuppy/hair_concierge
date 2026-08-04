# Payment monitor refund reconciliation

## Outcome

Keep payment-integrity alerts actionable by treating a successful subscription payment as reconciled when the same subscription was subsequently and legitimately terminated, while preserving alerts for a success that occurs after termination.

## Scope

- In `src/lib/billing/payment-integrity.ts`, add `subscriptionLifecycleReconciled` to `PaymentIntegrityLocalState`, skip the inactive-entitlement finding when it is true, carry both safe identities into findings, and suppress repeat findings with the same invariant and provider-reference digest.
- In `src/lib/billing/payment-integrity-runtime.ts`, select `cancelled_at` and derive the new signal only when:
  - `entitlement_status` is `canceled`;
  - normalized `provider_status` is one of `canceled`, `cancelled`, `expired`, or `incomplete_expired`; and
  - a valid `cancelled_at` exists at or after the candidate's provider timestamp; and
  - the billing analytics ledger proves either activation/purchase between the candidate and cancellation or a later refund for that subscription.
- Missing or invalid lifecycle timing, a non-terminal provider status, or absent refund/activation evidence must fail toward alerting. This preserves the alert for a customer who paid, never received access, and later canceled.
- In `src/lib/observability/payment.ts`, prefer the stable provider-reference digest only for subscription-integrity fingerprints when it is available. This intentionally regroups existing subscription-integrity issues, while leaving one-time-payment fingerprints unchanged.
- Add focused regression tests for terminal lifecycle ordering, Stripe checkout-session plus invoice duplication, and fingerprint stability.

No alert thresholds, schedules, production data, webhook behavior, customer entitlements, or user-facing surfaces change.

## Verification

1. Add regression tests and prove they fail on the current implementation.
2. Run the focused payment-integrity and payment-observability tests after the fix.
3. Run `npm run ci:verify` plus any broader relevant checks selected by the `ready-check` skill.
4. Review the exact worktree diff with the normal correctness lens and the required read-only counterpart review.

## Ordering limitation

`cancelled_at` is currently local webhook-processing time, while candidate times come from the provider. The rule therefore requires positive ordering evidence plus an activation/purchase/refund ledger event and treats missing/invalid evidence as an alert, but it cannot distinguish a severely delayed cancellation webhook from a provider cancellation timestamp that is not stored locally. A generic clock-skew tolerance would not resolve that ambiguity; replacing the stored timestamp with provider-native lifecycle time is a separate webhook/data migration concern.

## Stop condition

Hand off a verified review-ready branch. Do not commit, push, open a PR, deploy, or mutate production state without separate authorization.
