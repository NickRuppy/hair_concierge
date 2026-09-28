# Stripe trial invoice retry observability

## Outcome and contract
Reduce misleading payment-failure alerts for the observed short checkout/invoice ordering race, while preserving HTTP 500, claim release and provider retry. No billing, payment, entitlement, UI or production data changes. Review-ready local branch is the stop point; publication is not yet authorized for this follow-up.

Evidence: on 2026-09-28 Stripe event evt_1UKZtHGiGHTGZcKBRthgSBF6 (zero-value subscription-create trial invoice) returned 500 at 08:26:28Z, then automatically recovered with HTTP 200 at 08:26:44Z after checkout completed. Historical generic Sentry groups may contain unrelated failures; do not suppress the group.

## Chosen direction
Introduce a typed, low-cardinality billing-link-pending reason only when the normal invoice resolver has found a real Stripe trial candidate and its expected local binding is genuinely absent. Database errors, mismatched provider/agreement, continuation/recovery ambiguities, missing runtime and other invariant failures retain reconciliation-error reporting.
The error interface is `TrialInvoiceBillingLinkPending` with reason `billing_link_pending`, expected agreement/enrollment identity and no financial success meaning. The reporting classifier consumes this subtype and the signed event snapshot in `event.data.object`; it does not claim the invoice was revalidated financially. Age uses `event.created`, which stays fixed across Stripe redeliveries, so retries cannot restart the grace window.
A pure reporting classifier permits warning-level, no payment-failure capture only for that typed reason on a signed invoice.payment_succeeded event with a fully zero, paid subscription_create invoice, matching trial markers, and event age between zero and 120 seconds. Keep HTTP500 and release the claim in all failure cases. Older retries, malformed/future timestamps, nonzero invoices, failures and all other errors remain error alerts. No blanket acknowledgement and no persistent suppression state. Log event ID/type, invoice ID, bounded reason and retry classification; no invoice/customer payload or PII. Existing handled logs provide the recovery event-ID correlation.

## Decision coverage: confirmed
- Confirmed with Nick: implement the proposed follow-up to reduce misleading alerts from recovered Stripe timing retries ("good idea for the follow up, pls do").
- Inherited: preserve fail-closed invoice checks, exact dedupe and redelivery, payment/access semantics and privacy.
- Implementation defaults: 120-second first-delivery grace, typed reason, structured server diagnostics; stale retries remain actionable.
- Open consequential assumptions: none.
- Undiscussed consequential assumptions affecting this handoff: none.
- Coverage acknowledgement: latest explicit implementation request; existing payment verification authorization carried forward.
- Internal revalidation: current main f865a897 and provider evidence examined. No user surface/copy/timing feedback changes; no mockup or separate journey sign-off needed.

## Target map and tasks
1. src/lib/stripe/trial-invoice.ts: discriminate genuine missing binding from incompatible facts, preserve all validation and throwing behavior.
2. src/lib/stripe/webhook-failure.ts (or smallest equivalent): deterministic bounded reporting decision.
3. src/app/api/stripe/webhook/route.ts delegates its failure response to a focused `respondToStripeWebhookFailure` helper with injected release/capture/log functions. This produces an executable release-before-report + HTTP500 seam without refactoring signature verification or the full POST handler. The helper consumes the reporting decision; warning only for the narrowly qualified retry, normal capture otherwise.
4. Tests: precise missing-binding fixtures, errors/mismatches, zero vs nonzero initial invoices, grace boundaries, restored binding succeeds, route retry and capture side effects. Establish red proof, then green focused suite; typecheck and affected lint. No live replay needed.
5. Ready-check and single Claude whole-change review; inspect findings and rerun affected checks.

## Review and artifacts
Claude plan and whole-change reviews are read-only advisory; output outside repo, discard or retain outside repository with receipt reference. Commit candidates: plan, implementation, regression tests and final receipt. No migration or production write. Residual risk: an actual missing binding is warning-only during the short initial grace; it remains retryable and becomes an error on subsequent stale delivery.

## Plan review disposition
Claude review `/tmp/stripe-trial-retry-plan-review.md`: approve with revisions.
- Accepted: explicitly name immutable event-age source, typed producer/consumer contract, signed-snapshot limitation and executable catch test seam (updated above).
- Rejected preference: inline helper in the already 1,000-line route. A focused failure-response module isolates diagnostics and makes release/report/response behavior testable.
- Rejected additional approval request: 120 seconds is a bounded reporting default within the approved noise-reduction follow-up; no retry, acknowledgement, payment or access change. The grace and residual reporting delay were stated to Nick. No material unapproved product decision introduced.
- Verification: run focused Node regression tests, affected lint and TypeScript; run build when local environment permits. No browser journey change or production write.
- Revalidated: confirmed coverage; no open consequential assumptions.
