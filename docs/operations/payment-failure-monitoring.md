# Payment failure monitoring runbook

This runbook covers payment and checkout-experience observability for Chaarlie. Code-defined Sentry Cron monitors are upserted by their first production check-in. Issue-alert workflows, local Keychain secrets, LaunchAgents, and production environment variables still require an explicit rollout receipt.

## What is monitored

The implementation emits nine typed payment signals to Sentry. The signal is the primary triage field; use tags and the `payment` context to classify the case.

| Signal                                   | Severity | Meaning                                                                                                                                                                                     | First response                                                                                                                           |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `customer_payment_error_observed`        | warning  | A user-visible checkout error occurred in the browser or checkout parent flow. This can be a real failure or a recovered/customer-retryable issue.                                          | Check whether the same internal user/lead/attempt later succeeded.                                                                       |
| `checkout_experience_degraded`           | error    | A structural checkout defect occurred before provider outcome: silent control response, sheet not visible, provider UI readiness timeout, malformed provider response, or wrong navigation. | Inspect boundary, closed status, provider, release/device context, and the PostHog lifecycle for the app-owned attempt immediately.      |
| `payment_checkout_initialization_failed` | error    | The server could not initialize a provider checkout Session. The customer could not reach authorization, so this is an integration incident rather than a card decline.                     | Inspect the closed `status`, provider, source, and commerce kind immediately; then correlate any browser companion by safe internal IDs. |
| `provider_payment_failed`                | warning  | Stripe or PayPal explicitly reported a failed payment outcome.                                                                                                                              | Treat as a real payment failure until settlement and local billing state prove recovery.                                                 |
| `payment_webhook_processing_failed`      | error    | A verified provider webhook was received, but local processing threw or could not complete.                                                                                                 | Check webhook processing, billing rows, and entitlement or purchase state immediately.                                                   |
| `payment_integrity_mismatch`             | fatal    | Reconciliation found provider truth and local truth disagree after the grace period.                                                                                                        | Treat as an integrity incident until proven false positive.                                                                              |
| `paid_but_entitlement_not_active`        | error    | A `personal_plan_once` purchase is paid for more than 60 minutes but still resolves to `paid_pending` through the canonical one-time access contract.                                       | Inspect the closed reason, fulfillment job, consent binding, confirmation, generation, and delivery evidence.                            |
| `payment_monitor_failed`                 | error    | The monitoring route, provider scan, local lookup, or scheduled trigger failed.                                                                                                             | Restore the monitor path first, then rerun the check.                                                                                    |
| `customer_payment_issue_reported`        | warning  | A customer created a durable `PAY-…` support case from a truthful checkout feedback state.                                                                                                  | Search by the safe report code, then correlate provider, webhook, billing, and access truth before drafting a resolution.                |

Important distinction: a customer-visible error is not automatically lost revenue. It becomes a real failure only if the same checkout attempt, user, or lead did not later reach a valid provider success and local access state.

## Payment support cases

Reporting remains off unless both `PAYMENT_SUPPORT_ENABLED=true` and
`NEXT_PUBLIC_PAYMENT_SUPPORT_ENABLED=true`. Keep both off until the migration, Customer.io
templates, Sentry signal, privacy review, and separate stale-delivery checker are verified.

Use `npm run billing:payment-support -- --list` to inspect masked open cases. Resolution is dry-run
by default and prints the exact German email. A send requires `--apply` plus a matching
`--confirm-code=PAY-…`. `delivery_uncertain` requires a manual Customer.io check followed by an
explicit `--finalize` or `--re-arm`; never blindly resend. Cleanup is also dry-run first and requires
`--confirm-cleanup=DELETE_RESOLVED_PAYMENT_SUPPORT_CASES`. Customer-reported fields are hints:
provider, webhook, billing, and access evidence determines the resolution truth.

A receipt left in `sending` is ambiguous: the process may have stopped before or after Customer.io
accepted it. The checker must alert after 15 minutes. Do not reset or resend it automatically, and
keep reporting flags off until a guarded, evidence-backed receipt recovery procedure has been
reviewed through the separate checker rollout.

## Why the August incident was missed

The prepared one-time flow returned several customer-blocking outcomes as successful HTTP 200 control responses. Those branches neither threw nor called Sentry, and the browser deliberately treated them as recoverable. Checkout lifecycle events existed only in best-effort PostHog delivery. The payment-integrity monitor began after a Stripe/PayPal object existed, so it had nothing to reconcile when the sheet never became usable. Finally, both reconciliation routes defaulted their Sentry Cron callback to a no-op, so a missed scheduled run was also invisible.

The safety net closes each boundary separately:

- server control outcomes emit an immediate, sanitized `checkout_experience_degraded` event while keeping the public response opaque;
- browser-only presentation/readiness defects emit one classified Sentry event and a full PostHog lifecycle transition;
- normal customer cancellation remains analytics-only;
- provider money and access truth remains the responsibility of webhook and reconciliation signals;
- local and daily reconciliation runs now send real Sentry check-ins.

## Timing model

Payment monitoring has three layers:

1. Immediate event-driven Sentry signals from checkout, provider webhooks, and processing exceptions.
2. Local 30-minute backstop from Nick's Mac, calling `POST https://chaarlie.de/api/billing/payment-monitor` with a bearer token stored outside the repository.
3. Daily cloud fallback for missed local coverage once configured.

The integrity checker uses a 60-minute settlement grace period before flagging success mismatches. This avoids alerting while provider settlement, webhook delivery, local writes, or access activation are still in flight.

Expected detection latency:

- Checkout initialization, direct provider failure, or webhook processing exception: immediate.
- Structural checkout degradation: immediate per server failure or browser watchdog deadline.
- Silent provider-success/local-state mismatch: usually 60-90 minutes after provider success, because the check waits 60 minutes and then runs on the next 30-minute local cadence.
- Paid one-time purchase without active entitlement: usually 60-90 minutes after `paid_at`. When one-time fulfillment retry is enabled, the daily reconcile branch runs due retries before evaluating paid access so the same cron can heal before it alerts; when retry is disabled, the monitor still reports the unresolved canonical access state.
- Paid-access scans inspect oldest eligible purchases first inside the 72-hour window. Metadata-marked internal/QA rows are skipped before consuming processing capacity where possible. The monitor returns at most 50 paid-access findings per run and scans a bounded multiple of that capacity; `candidate_cap` now means the bounded scan or finding result cap was genuinely exhausted, not merely that more than 50 healthy purchases existed.
- `canonical_access_conflict` means a purchase listed as paid contradicted the canonical per-user access read during the same run. The Sentry event carries only the safe purchase identifier and provider so it can be correlated with the purchase-scoped finding; recheck current purchase state before treating a refund race as an entitlement defect.
- Failed local run: the endpoint emits `payment_monitor_failed` to Sentry and the LaunchAgent records a nonzero result with privacy-safe provider failure categories.
- Sleeping/offline Mac: the local monitor opens a missed-check-in issue after two consecutive missed 30-minute runs. The daily Vercel reconciliation remains the independent cloud fallback and opens after its configured margin.

## Privacy and lookup rules

Do not paste emails, raw provider object references, full card details, IP addresses, or customer personal data into Sentry comments, GitHub, Linear, or Slack.

Use only privacy-safe identifiers from the Sentry `payment` context:

- `user_id`
- `lead_id`
- `checkout_attempt_id`
- `purchase_id`
- `provider_reference_digest`
- `provider_reference_present`

If a provider reference is needed, look it up inside the provider dashboard or server logs using authorized tooling. Do not copy the raw provider reference into the incident record; record only whether it was present and the internal lookup result.

## Triage path

Use this order so each incident is classified against payment truth, not UI symptoms.

1. Open the Sentry issue and read these tags:
   - `payment.signal`
   - `payment.provider`
   - `payment.boundary`
   - `payment.error_family`
   - `payment.commerce_kind`
   - `payment.origin`
   - `payment.method`
   - `payment.truth`
   - `payment.live`
   - `payment.is_internal_test`
2. If `payment.live=false` or `payment.is_internal_test=true`, classify as internal QA unless there is evidence it affected a real customer.
3. For `payment_checkout_initialization_failed` or `checkout_experience_degraded`, inspect the closed `status` before any provider lookup:
   - `idempotency_conflict`: compare the idempotency key and request parameters in the provider dashboard; do not infer a decline.
   - `configuration_missing`: verify the deployed price/provider configuration.
   - `rate_limited` or `provider_unavailable`: verify whether a later attempt recovered before contacting the customer.
   - `unknown`: inspect provider/Vercel evidence without copying raw messages or references into Sentry.
   - prepared-session status values: distinguish identity/token/resource/pricing/consent/claim/update causes without exposing the customer-safe generic response.
   - `overlay_not_visible`, provider readiness/request timeout, malformed response, or unexpected route: inspect the matching `offer_checkout_lifecycle` trail and release/device context.
   - `reason=paypal_sdk_onerror` with `status=pending`: the PayPal SDK callback remained unresolved after bounded server reconciliation. It is routed as the warning-level `payment.signal=customer_payment_error_observed`; use token-presence, release, browser, viewport, and webview tags to group causes, then verify later provider/access success before treating it as lost revenue.
4. Use `user_id`, `lead_id`, or `checkout_attempt_id` to find the local customer/payment trail.
5. Reconcile provider state:
   - Provider outcome: failed, succeeded, pending, canceled, or abandoned.
   - Verified webhook: received and processed, received and failed, or not available in local evidence.
   - Billing row: subscription, checkout, or one-time purchase state.
   - Access state: entitlement for subscriptions or paid purchase for one-time plans.
   - Settlement state: whether the outcome is still inside the 60-minute grace period.
   - Paid-access reason for `paid_but_entitlement_not_active`: `binding_missing`, `confirmation_pending`, `delivery_evidence_missing`, `fulfillment_failed_permanent`, or `fulfillment_retry_stalled`.
6. Classify and act using the table below.

| Classification                   | Criteria                                                                                                                                 | Action                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Real failure                     | Provider says failed, or the customer-visible error did not recover into provider success and local access.                              | Keep issue open, inspect checkout/provider cause, and decide whether customer follow-up is needed. |
| Recovered customer-visible error | Browser/parent checkout error occurred, but the same user/lead/attempt later succeeded and access is correct.                            | Close as recovered after noting the recovery path; only create a bug if repeated or confusing.     |
| Cancellation/abandonment         | User canceled, closed the wallet/provider sheet, or never authorized payment; provider has no failed charge.                             | Close as no-action unless volume changes materially.                                               |
| Internal QA                      | Internal test flag is true or the internal user/lead matches authorized QA evidence.                                                     | Close or suppress through alert routing; do not use customer-facing language.                      |
| Integrity incident               | Provider success conflicts with billing/access truth after grace, or a verified webhook processing failure leaves local state uncertain. | Escalate immediately; fix local state only through audited operational steps.                      |

## Provider-to-local reconciliation

Use this chain for every non-QA incident:

```text
provider outcome
  -> verified webhook processing result
  -> local billing/subscription/checkout row
  -> entitlement or one-time purchase access
  -> settlement grace status
```

For subscriptions, local access is valid only if billing and entitlement state match the subscription lifecycle. For one-time purchases, local access is the paid one-time purchase state; do not infer a subscription entitlement requirement for one-time commerce.

For `personal_plan_once`, monitor truth is the same canonical access function used by the app. A paid purchase with `first_accessed_at=NULL` is not an incident when delivery evidence makes the access state `active`; first access measures opening behavior, not entitlement health.

V1 limitation: the webhook ledger does not correlate provider object references. Therefore V1 cannot assert "provider object succeeded but its exact webhook never arrived." It can report verified webhook processing exceptions and provider/local state mismatches. Treat webhook absence as an investigation clue, not a V1 invariant.

## Monitor failures and missed runs

If `payment_monitor_failed` fires or the local monitor misses expected check-ins:

1. Confirm whether the failed layer is the local trigger, production route, provider scan, local lookup, or Sentry check-in.
2. Check the local runner only if the local setup has been intentionally installed:
   - Keychain service name: `com.chaarlie.payment-monitor.trigger-secret`
   - Endpoint: `https://chaarlie.de/api/billing/payment-monitor`
   - Cadence: every 30 minutes
   - Client timeout: 50 seconds around the route's 40-second work budget
3. Do not log or paste the trigger secret.
4. Rerun the monitor manually only with the approved local script and production endpoint.
5. If the local Mac was asleep/offline, rely on the daily cloud fallback once configured and inspect the next successful local check.
6. If provider scans are capped, deadline-exhausted, or incomplete, treat the monitor result as partial and rerun after restoring the failure cause.

The local trigger log dedupes privacy-safe failure categories from both `paymentIntegrity.failures`
and `paidAccess.failures`, so a nonzero local result can point directly at a paid-access scan cap or
lookup failure without exposing customer identity or provider references.

## False positives and noise

Suppress or downgrade only after evidence:

- Internal QA: route by `payment.is_internal_test=true`, not by email.
- Customer-visible recovered errors: close after verifying provider success and correct access.
- Provider pending states: wait until the 60-minute grace period has elapsed.
- Repeated identical browser errors with later success: keep one tracking issue for UX/noise, but do not count each event as failed revenue.
- One isolated preparation-unavailable or provider-lock response can be recoverable control flow, but it still records a structural degradation signal because a repeated cohort can represent a total checkout outage. Existing-access remains ordinary control flow. Never weaken provider or integrity signals to suppress these events.
- Do not remove `provider_locked_*` or `access_conflict` from payment-failure routing until the deployed paid-access monitor has produced a successful route receipt and a reviewed non-production/internal-test exercise proves `paid_but_entitlement_not_active` reaches Sentry with no raw identity.
- A browser checkout-load signal accompanying one server initialization signal is one incident. Correlate it by safe internal identifiers; do not count both events as two blocked customers.
- Exact Meta/Instagram native-bridge exceptions may be dropped only when the known message, `app://` frame, and native bridge function all match. Do not suppress by user agent, browser name, message alone, or `app://` alone.
- Monitor outage during local Mac sleep: track monitor availability separately from payment integrity.

Do not suppress `payment_integrity_mismatch` until provider truth, billing truth, and access truth have been checked.

### 2026-08-02 incident closure checklist

Use current events rather than issue counts when closing the groups discovered during the prepared
Checkout incident:

- `HAIR-CONCIERGE-2N` / `2P`: keep open until the cold-checkout release is deployed and a
  production attempt creates a fresh Stripe Session without a provider idempotency error.
- `HAIR-CONCIERGE-22`: close after duplicate/existing-access control flow no longer creates an
  unhandled browser exception and the existing-access dialog still works.
- `HAIR-CONCIERGE-1N`, `1R`, `1P`, `2E`, `2F`: close after the exact native-bridge filter is deployed
  and near-miss regression tests prove Chaarlie exceptions remain reportable.
- `HAIR-CONCIERGE-2W` / `2Y`: close when the repaired monitor has a later successful route result
  and local scheduled exit; do not change the integrity scan merely to silence the old issue.
- `HAIR-CONCIERGE-2X`: retain as an internal QA integrity finding or close as QA according to the
  alert workflow. It must stay tagged `payment.is_internal_test=true` and must not notify as a real
  customer incident.
- `HAIR-CONCIERGE-2Q`: no action when it remains resolved and no new non-internal live volume alert
  fires.

### Explicit PayPal renewal exclusions

The renewal scan fails closed on PayPal lookup errors. A row is omitted only when billing metadata
contains both:

```text
is_internal_test=true
payment_monitor_exclusion_reason=pre_cutover_rest_app
```

This closed reason is reserved for a production test subscription created before the current live
REST app existed. It does not mean that PayPal 404 is generally acceptable, and it must never be
applied to a customer row merely to make the monitor green. Internal-test metadata without this
reason, this reason without an internal-test marker, and every unknown provider error still fail the
monitor.

The guarded command is dry-run by default. It reports no email, internal identity, or raw PayPal
reference:

```bash
npm run billing:payment-monitor:classify-paypal-test -- \
  --subscription-id=<legacy-test-subscription-id>
```

Applying the metadata-only classification requires all production gates:

```bash
PAYMENT_MONITOR_TEST_CLASSIFICATION_PRODUCTION_WRITE=1 \
npm run billing:payment-monitor:classify-paypal-test -- \
  --subscription-id=<legacy-test-subscription-id> \
  --apply \
  --confirm-internal-test \
  --confirm-project=pqdkhefxsxkyeqelqegq
```

The command requires exactly one pre-cutover PayPal row and uses its `updated_at` value as an
optimistic lock. It merges metadata only; it does not cancel the PayPal subscription, change billing
or entitlement status, or remove access. If the row changes between inventory and apply, the command
refuses the write.

### Sentry delivery receipt

Whenever reconciliation produces an integrity finding or monitor failure, the runtime retains the
32-character Sentry event ID returned by capture. The route requires one valid receipt per emitted
incident and a successful `Sentry.flush()` result before it treats telemetry as delivered. A false or
throwing flush is retried once. Missing receipts or two failed flushes add the closed
`telemetry_delivery_failed` monitor failure and keep the HTTP response non-successful.

The event ID proves that Sentry accepted the event locally and the flush proves that the transport
queue completed; final rollout verification must still open/query the corresponding Sentry event by
time and closed payment tags.

## Controlled rollout checklist

Before treating the system as operational:

- Confirm production deploy contains this code.
- Configure Sentry alert routing for the nine `payment.signal` values. A live, non-internal
  `payment_checkout_initialization_failed`, `payment_webhook_processing_failed`, or `paid_but_entitlement_not_active` is immediately actionable after its code-defined grace/monitor branch emits. Notify on three unique live, non-internal `checkout_experience_degraded` attempts sharing provider, boundary, and error family within ten minutes. Keep `access_conflict` and `provider_locked_*` on the warning/control-flow route until the paid-access monitor is deployed and verified; only then may external Sentry workflows suppress expected provider-lock/access-conflict volume. Exclude `payment.is_internal_test=true` and `payment.live=false` from customer notifications while retaining both for QA.
- Confirm the code-upserted `payment-integrity-local` monitor expects 30-minute check-ins and opens after two misses, and `payment-integrity-daily` follows `15 2 * * *` UTC and opens after one missed margin.
- Confirm the daily Vercel reconciliation cron remains configured as the cloud fallback and sends an actual Sentry check-in receipt.
- Confirm the production Stripe webhook endpoint delivers `payment_intent.payment_failed`,
  `checkout.session.async_payment_failed`, and `invoice.payment_failed` events.
- Set production `PAYMENT_MONITOR_TRIGGER_SECRET`.
- Store the same secret in local macOS Keychain under `com.chaarlie.payment-monitor.trigger-secret`.
- Install a LaunchAgent or equivalent local scheduler for the 30-minute local trigger.
- Run one manual local trigger against `https://chaarlie.de/api/billing/payment-monitor`.
- Verify a manual run returns `200 completed`, and verify a controlled monitor failure reaches Sentry without a secret or raw provider reference.
- Run a controlled checkout test and confirm customer-visible errors, provider failures, webhook exceptions, and reconciliation signals are classified as expected.
- For prepared Checkout, repeat the client-secret request within one preparation generation and
  verify Stripe replays the same Session without an `idempotency_error`; then perform a deliberate
  refresh and verify it uses a new preparation identity.

Do not install local automation, change Sentry workflows, or rotate secrets as part of code review unless that rollout step is explicitly authorized.

## Closure rules

Close the Sentry issue only when one of these is true:

- The payment succeeded and local access is correct.
- The customer canceled or abandoned without provider failure.
- The event is verified internal QA.
- The local monitor failure is fixed and a later check completed successfully.
- The integrity incident has an audited repair or code fix, and a subsequent monitor run is clean.

Keep the issue open when provider truth is unknown, local access cannot be verified, the monitor result is partial, or a provider success remains unreconciled after the grace period.
