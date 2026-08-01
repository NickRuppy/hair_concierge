# Payment failure monitoring runbook

This runbook covers payment failure observability for Chaarlie. It is operator guidance only: it does not mean Sentry alert workflows, Sentry Cron monitors, local Keychain secrets, LaunchAgents, or production environment variables are already configured.

## What is monitored

The implementation emits five typed payment signals to Sentry. The signal is the primary triage field; use tags and the `payment` context to classify the case.

| Signal                              | Severity | Meaning                                                                                                                                            | First response                                                                           |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `customer_payment_error_observed`   | warning  | A user-visible checkout error occurred in the browser or checkout parent flow. This can be a real failure or a recovered/customer-retryable issue. | Check whether the same internal user/lead/attempt later succeeded.                       |
| `provider_payment_failed`           | warning  | Stripe or PayPal explicitly reported a failed payment outcome.                                                                                     | Treat as a real payment failure until settlement and local billing state prove recovery. |
| `payment_webhook_processing_failed` | error    | A verified provider webhook was received, but local processing threw or could not complete.                                                        | Check webhook processing, billing rows, and entitlement or purchase state immediately.   |
| `payment_integrity_mismatch`        | fatal    | Reconciliation found provider truth and local truth disagree after the grace period.                                                               | Treat as an integrity incident until proven false positive.                              |
| `payment_monitor_failed`            | error    | The monitoring route, provider scan, local lookup, or scheduled trigger failed.                                                                    | Restore the monitor path first, then rerun the check.                                    |

Important distinction: a customer-visible error is not automatically lost revenue. It becomes a real failure only if the same checkout attempt, user, or lead did not later reach a valid provider success and local access state.

## Timing model

Payment monitoring has three layers:

1. Immediate event-driven Sentry signals from checkout, provider webhooks, and processing exceptions.
2. Local 30-minute backstop from Nick's Mac, calling `POST https://chaarlie.de/api/billing/payment-monitor` with a bearer token stored outside the repository.
3. Daily cloud fallback for missed local coverage once configured.

The integrity checker uses a 60-minute settlement grace period before flagging success mismatches. This avoids alerting while provider settlement, webhook delivery, local writes, or access activation are still in flight.

Expected detection latency:

- Direct provider failure or webhook processing exception: immediate.
- Silent provider-success/local-state mismatch: usually 60-90 minutes after provider success, because the check waits 60 minutes and then runs on the next 30-minute local cadence.
- Missed local runner: alert once configured if the `payment-integrity-local` check-in is late beyond the missed-run tolerance.

## Privacy and lookup rules

Do not paste emails, raw provider object references, full card details, IP addresses, or customer personal data into Sentry comments, GitHub, Linear, or Slack.

Use only privacy-safe identifiers from the Sentry `payment` context:

- `user_id`
- `lead_id`
- `checkout_attempt_id`
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
3. Use `user_id`, `lead_id`, or `checkout_attempt_id` to find the local customer/payment trail.
4. Reconcile provider state:
   - Provider outcome: failed, succeeded, pending, canceled, or abandoned.
   - Verified webhook: received and processed, received and failed, or not available in local evidence.
   - Billing row: subscription, checkout, or one-time purchase state.
   - Access state: entitlement for subscriptions or paid purchase for one-time plans.
   - Settlement state: whether the outcome is still inside the 60-minute grace period.
5. Classify and act using the table below.

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

V1 limitation: the webhook ledger does not correlate provider object references. Therefore V1 cannot assert "provider object succeeded but its exact webhook never arrived." It can report verified webhook processing exceptions and provider/local state mismatches. Treat webhook absence as an investigation clue, not a V1 invariant.

## Monitor failures and missed runs

If `payment_monitor_failed` fires or the local monitor misses expected check-ins:

1. Confirm whether the failed layer is the local trigger, production route, provider scan, local lookup, or Sentry check-in.
2. Check the local runner only if the local setup has been intentionally installed:
   - Keychain service name: `com.chaarlie.payment-monitor.trigger-secret`
   - Endpoint: `https://chaarlie.de/api/billing/payment-monitor`
   - Cadence: every 30 minutes
3. Do not log or paste the trigger secret.
4. Rerun the monitor manually only with the approved local script and production endpoint.
5. If the local Mac was asleep/offline, rely on the daily cloud fallback once configured and inspect the next successful local check.
6. If provider scans are capped, deadline-exhausted, or incomplete, treat the monitor result as partial and rerun after restoring the failure cause.

## False positives and noise

Suppress or downgrade only after evidence:

- Internal QA: route by `payment.is_internal_test=true`, not by email.
- Customer-visible recovered errors: close after verifying provider success and correct access.
- Provider pending states: wait until the 60-minute grace period has elapsed.
- Repeated identical browser errors with later success: keep one tracking issue for UX/noise, but do not count each event as failed revenue.
- Monitor outage during local Mac sleep: track monitor availability separately from payment integrity.

Do not suppress `payment_integrity_mismatch` until provider truth, billing truth, and access truth have been checked.

## Controlled rollout checklist

Before treating the system as operational:

- Confirm production deploy contains this code.
- Configure Sentry alert routing for the five `payment.signal` values.
- Configure Sentry Cron/check-in tracking for `payment-integrity-local` and the daily cloud fallback.
- Confirm the production Stripe webhook endpoint delivers `payment_intent.payment_failed`,
  `checkout.session.async_payment_failed`, and `invoice.payment_failed` events.
- Set production `PAYMENT_MONITOR_TRIGGER_SECRET`.
- Store the same secret in local macOS Keychain under `com.chaarlie.payment-monitor.trigger-secret`.
- Install a LaunchAgent or equivalent local scheduler for the 30-minute local trigger.
- Run one manual local trigger against `https://chaarlie.de/api/billing/payment-monitor`.
- Verify Sentry records an ok check-in and no secret or raw provider reference appears in logs.
- Run a controlled checkout test and confirm customer-visible errors, provider failures, webhook exceptions, and reconciliation signals are classified as expected.

Do not install local automation, change Sentry workflows, or rotate secrets as part of code review unless that rollout step is explicitly authorized.

## Closure rules

Close the Sentry issue only when one of these is true:

- The payment succeeded and local access is correct.
- The customer canceled or abandoned without provider failure.
- The event is verified internal QA.
- The local monitor failure is fixed and a later check completed successfully.
- The integrity incident has an audited repair or code fix, and a subsequent monitor run is clean.

Keep the issue open when provider truth is unknown, local access cannot be verified, the monitor result is partial, or a provider success remains unreconciled after the grace period.
