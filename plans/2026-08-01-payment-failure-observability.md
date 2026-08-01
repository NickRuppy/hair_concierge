# Payment failure observability and alerting

**Status:** Implemented and locally verified; internal correctness, structural,
and independent subagent code reviews clean after Nick waived the unavailable
Claude/Fable review; production rollout and scheduler installation not started
**Branch:** `codex/payment-failure-observability-plan`
**Source context:** production Apple Pay incident in Codex task
`019fb99b-6368-7092-a4fe-309e21d9cced`; PR #290 (confirmation Promise and bounded
Sentry capture); PR #291 / merge `a8131d7c` (actual `canConfirm` blocker); Nick's
report that two real prospective customers had payment failures during the last
year without an operational alert.

## Outcome and planning contract

### Outcome

Nick is notified whenever a real live customer:

- sees a payment error in any supported checkout;
- receives a provider-confirmed initial or recurring payment failure; or
- has provider-confirmed success without the expected billing record or
  commerce-kind-specific access state.

Verified webhook-processing failures are reported immediately after signature
verification. V1 does not claim that one particular provider object lacks a
webhook because the current webhook ledger stores event id/type but no provider-
object correlation key.

The first release covers Stripe and PayPal, subscriptions and one-time purchases,
card and wallet methods, normal checkout and reactivation. It is provider-neutral
and not tailored to Apple Pay's recently fixed guard.

### Constraints

- Monitoring must never delay, reject, retry, capture, cancel, or otherwise
  alter a payment.
- The monitoring reporter must never throw into a payment caller. A broken
  Sentry sink is swallowed by the observability boundary and cannot change the
  customer or provider outcome.
- Browser state is evidence of a customer-visible problem, not authoritative
  payment truth. Provider objects, verified webhooks, billing rows, entitlement,
  and settlement remain the reconciliation chain.
- Never send card data, client secrets, PayPal tokens, raw provider error
  objects, raw Checkout Session URLs, customer email addresses, or IPs to
  Sentry.
- Retain a secure lookup path from a Sentry event to an internal lead/user id so
  an authorized operator can identify the person in Supabase.
- Production QA attempts remain visible but do not page as real-customer
  failures.
- Alert grouping must survive new payment methods and new provider messages.

### Non-goals

- No checkout UI, copy, pricing, method availability, provider configuration,
  Radar, retry, dunning, refund, cancellation, or entitlement-behavior change.
- No automatic customer outreach.
- Fraud, disputes, refunds, general conversion dashboards, and provider-wide
  uptime remain separate unless they violate a payment invariant.
- V1 does not add browser beacons or a new payment-attempt ledger. Those are a
  gated second phase only if the first release exposes an unobservable gap.

### Done when

- Every supported user-visible failure path calls one typed Sentry reporter
  exactly once per checkout attempt/failure branch.
- Provider-confirmed failures and verified-webhook processing failures are
  reported through the same bounded signal contract.
- A locally scheduled payment-integrity check detects provider-success/local-
  state mismatches every 30 minutes while Nick's Mac is online. The existing
  daily Vercel reconciliation remains the cloud fallback. Both report their own
  missed/failed runs through separate Sentry Cron check-ins.
- Production Sentry workflows notify on the first and repeated live non-test
  customer/provider signal. Repeated scans of the same unresolved integrity
  mismatch stay visible without paging every 30 minutes, while internal QA is
  queryable but non-paging.
- Tests cover explicit failures, provider declines, renewals, recovered client
  errors, cancellations, internal tests, PII/secret scrubbing, grouping, and
  provider/local integrity mismatches.
- A controlled test proves both Sentry ingestion and notification delivery.

## Evidence and why the existing setup missed the incident

1. PR #290 captures Sentry events only after Stripe Express Checkout returns an
   error or throws. The actual PR #291 failure occurred earlier in a local guard,
   which called the wallet's generic `paymentFailed()` path without creating a
   dedicated Sentry event.
2. `addCheckoutBreadcrumb()` does not create an alertable event. It adds context
   only if some later event is sent.
3. `checkout_start_failed` is a browser/PostHog funnel event, not operational
   payment truth. The incident failed before the normal payment-method-selection
   event.
4. Stripe/PayPal webhooks persist some authoritative success/failure outcomes,
   but recurring payment failures currently become analytics/logging rather than
   a stable payment Sentry signal. There is no explicit invariant check for
   provider success without local access.
5. A current 14-day read-only Sentry sweep in environment `production` found
   generic checkout/API/PayPal/browser issues but no dedicated Stripe Express
   confirmation issue for the outage.
6. That same production-filtered sweep contained a development build error.
   Therefore `environment=production` alone is not a safe alert boundary.
7. Existing checkout Sentry events do not set a stable Sentry user id; current
   issue summaries can show `userCount=0` even when a lead/user id exists.

## Chosen direction

Ship a lean, staged design:

1. **Immediate typed events:** centralize every customer-visible and server-
   confirmed payment failure into a sanitized, fingerprinted Sentry event.
2. **Server-truth backstop:** expose one protected payment-integrity endpoint
   backed by shared reconciliation logic. A macOS LaunchAgent invokes it every
   30 minutes; the existing Vercel billing cron invokes the same logic daily as
   an independent cloud fallback.
3. **Alert delivery and self-monitoring:** configure Sentry workflows for first
   and repeated customer/provider signals, first-seen/regressed integrity
   findings, and separate Sentry Cron check-ins for the local and daily
   reconciliation triggers.
4. **Evidence-gated Phase 2:** add a durable payment-boundary ledger and signed
   non-blocking browser transitions only if V1 reveals a real attempt that
   cannot be diagnosed from the immediate event and provider/server truth, or if
   Nick chooses sub-day silent-stall detection.

This catches the triggering incident because every invocation of a customer
payment-error outcome—not only exceptions after `checkout.confirm()`—must report
through Layer 1. It also covers future provider failures and local integrity
gaps without first adding a public telemetry endpoint, another database ledger,
or paid scheduling infrastructure.

Sentry-exception-only monitoring was rejected because it repeats the original
blind spot. Provider-native alerts alone were rejected because they cannot see
merchant-side failures before a provider payment object exists or entitlement
failures after provider success.

## V1 payment signal contract

### Signals and default notification policy

| Signal                              | Meaning                                                                                                                           | Sentry level | Default notification                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------ |
| `customer_payment_error_observed`   | Application showed a terminal payment error; provider truth may still be pending                                                  | warning      | Immediate for live non-test attempts |
| `provider_payment_failed`           | Provider confirmed initial, capture, authentication, or renewal failure                                                           | warning      | Immediate for live non-test attempts |
| `payment_webhook_processing_failed` | A verified provider event could not be processed                                                                                  | error        | Immediate                            |
| `payment_integrity_mismatch`        | Provider succeeded but verified webhook, billing, or entitlement did not follow, or local success conflicts with provider failure | fatal        | Immediate, highest priority          |
| `payment_monitor_failed`            | Daily reconciliation errored or its Sentry check-in was missed                                                                    | error        | Immediate                            |

Customer cancellation, duplicate-access control flow, validation errors before
payment intent, and checkout abandonment are not payment-failure alerts. A
configuration or provider-session error that produces a customer-visible
failure is alertable as `customer_payment_error_observed` with a technical error
family.

A customer-visible error followed by provider/billing success remains a warning
about the customer experience, but its `payment.truth` becomes `succeeded`; it
must not be called a failed payment.

### One taxonomy, two useful dimensions

Do not add another stage vocabulary parallel to the current `CheckoutStage`.
Keep the existing route-specific `checkout.stage` for the exact code seam and
add one closed high-level `payment.boundary` dimension:

- `configuration`
- `provider_session`
- `customer_authorization`
- `provider_outcome`
- `webhook`
- `billing`
- `entitlement`
- `reconciliation`

One mapping function owns `CheckoutStage -> PaymentBoundary`; callers may not
invent strings.

### Sentry event shape

Add a separate `capturePaymentFailure()` reporter rather than changing
`captureCheckoutException()`, whose existing callers expect error-level
exception behavior.

The new reporter carries only closed-value searchable tags:

| Tag                        | Closed values                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.signal`           | `customer_payment_error_observed`, `provider_payment_failed`, `payment_webhook_processing_failed`, `payment_integrity_mismatch`, `payment_monitor_failed`                                                                                |
| `payment.provider`         | `stripe`, `paypal`, `unknown`                                                                                                                                                                                                            |
| `payment.boundary`         | the eight `PaymentBoundary` values above                                                                                                                                                                                                 |
| `payment.error_family`     | `configuration`, `provider_session`, `not_confirmable`, `authentication`, `authorization`, `declined`, `processing`, `network`, `provider_unavailable`, `webhook_processing`, `billing_state`, `entitlement_state`, `timeout`, `unknown` |
| `payment.commerce_kind`    | `subscription`, `one_time`, `unknown`                                                                                                                                                                                                    |
| `payment.origin`           | `browser`, `provider_api`, `webhook`, `reconciliation`                                                                                                                                                                                   |
| `payment.method`           | `card`, `apple_pay`, `google_pay`, `paypal`, `unknown`                                                                                                                                                                                   |
| `payment.truth`            | `failed`, `succeeded`, `pending`, `unknown`                                                                                                                                                                                              |
| `payment.live`             | `true`, `false`                                                                                                                                                                                                                          |
| `payment.is_internal_test` | `true`, `false`                                                                                                                                                                                                                          |
| `payment.retryable`        | `true`, `false`, `unknown`                                                                                                                                                                                                               |

`payment.failure_class` is deliberately omitted because it duplicated
`payment.error_family`. Keep the existing closed `checkout.source` tag
(`pricing_page`, `quiz_result_offer`, `welcome`) where it applies; add
`reactivation` to that existing type rather than introducing a second source
vocabulary.

The reporter also carries:

- structured context: existing checkout attempt id, internal lead/user id,
  interval/plan, bounded duration/status, current route-specific stage, and safe
  provider-reference presence—not the raw provider reference;
- Sentry user: internal `user_id` when present, otherwise internal `lead_id`;
  never email or IP;
- stable fingerprint for immediate failures:
  `payment/<signal>/<provider>/<boundary>/<bounded error family>`;
- stable per-finding integrity fingerprint: the same base plus invariant and
  existing pseudonymous checkout-attempt id. If no attempt id exists, use a
  server-keyed opaque digest of the provider reference; never send or fingerprint
  on the raw provider reference;
- caller-selected warning/error/fatal level from a closed mapping;
- a sanitized application error/message built from an allowlisted descriptor,
  never a raw Stripe/PayPal error object.

The reporter owns its own exception boundary and returns `void`; a synchronous
or asynchronous sink failure is contained and cannot escape into Stripe/PayPal
callbacks. Payment-specific branches that already call
`captureCheckoutException()` must choose one owner. The new typed reporter
**replaces** the older generic capture at the two Stripe Express confirm-error/
exception branches, existing PayPal subscription payment-outcome branches, and
reactivation payment-outcome branches. It is **added** to currently silent
Stripe card, PayPal one-time, personal-plan one-time, overlay, pricing, and
return/recovery payment-outcome branches. Existing non-payment diagnostic
callers keep `captureCheckoutException()` unchanged. A branch must never call
both reporters for the same signal/outcome.

### Exact-once ownership

The component that first converts a failure into a customer-visible terminal
payment error owns `customer_payment_error_observed`; parents do not re-report a
child callback. Authoritative server/provider signals remain separate because
they report different truth.

| Surface                                                                                                  | Single customer-visible reporting seam                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe offer Elements, card and wallet                                                                   | One `reportAndRejectConfirmation()`-style helper inside `confirmCheckout`; every terminal guard/result/catch branch calls it once before `setErrorMessage()` and optional wallet `paymentFailed()`. It replaces both current Express-only generic captures. Neither the setter nor `paymentFailed()` reports. |
| PayPal subscription                                                                                      | The leaf button reports once immediately before its existing `onCheckoutFailed` callback for non-control-flow outcomes, replacing its payment-specific generic captures. Its existing suppression ref prevents the SDK `onError` callback from reporting an already-owned failure.                            |
| PayPal one-time                                                                                          | The leaf button owns failed create, missing approval token, failed capture, and unsuppressed SDK `onError`. A suppression ref distinguishes SDK echoes of a thrown owned failure from a new failure. Consent, cancellation, duplicate access, and provider lock do not report.                                |
| Personal-plan one-time, payment-method wrapper, overlays, result pricing, reactivation, welcome recovery | Each surface reports only a terminal payment error it creates itself. It does not report errors already owned by a child checkout. Existing generic captures are replaced only when they describe that same payment outcome; otherwise reporting is additive.                                                 |

Task 1 must turn this table into a per-branch matrix before edits. Tests assert
one customer-visible signal per owned branch and allow a later distinct
provider/webhook/integrity signal for the same attempt.

`PaymentErrorFamily` is a closed enum. Unknown exceptions map to `unknown`; raw
provider messages can never enter tags, fingerprints, or captured messages.

The current global scrubber must also expand as defense in depth for nested
`client_secret`, `email`, `email_address`, `receipt_email`, `payer_email`, and
equivalent known provider fields. Hostile nested Stripe/PayPal fixtures must
prove that neither raw provider errors nor generic Sentry event processing can
leak those values.

The `payment.live` tag is server-authoritative. It distinguishes a deployed
live-provider attempt from local development, preview, and provider test mode.
Alerts filter on `payment.live=true`; they do not trust the current Sentry
environment tag alone.

## V1 server reconciliation

Put provider/local comparison in one shared function. Expose it through a
dedicated protected `/api/billing/payment-monitor` route for the local trigger,
and also invoke it from the existing `/api/billing/reconcile` daily Vercel job.
Do not create a second Vercel cron in V1.

- The payment-monitor route accepts a dedicated least-privilege
  `PAYMENT_MONITOR_TRIGGER_SECRET`; it does not reuse the broader `CRON_SECRET`.
  The endpoint can only run the read-only integrity comparison and emit Sentry
  evidence. It cannot create, confirm, retry, cancel, or refund payments.
- Reuse the existing billing cron's Node runtime, bounded duration, and
  dependency-injection test shape.
- Run payment-integrity reconciliation independently from entitlement expiry and
  analytics retry with isolated results; one branch must not suppress the
  others.
- For a bounded recent window, compare Stripe successful Checkout Sessions,
  PaymentIntents/invoices/subscriptions and PayPal checkout/order intents plus
  provider status against `billing_subscriptions`,
  `billing_one_time_purchases`, and commerce-kind-specific access state. Use
  `billing_webhook_events` as runbook/event-type evidence only, not as proof
  that a specific provider object received its webhook; the current schema has
  no correlation field.
- Enumerate Stripe provider-first using its recent-object list APIs. Enumerate
  PayPal local-intent-first from `paypal_checkout_intents` and
  `paypal_order_intents`, then retrieve each referenced subscription/order from
  PayPal; do not assume PayPal has a global recent-orders API.
- Scan a configurable 72-hour lookback, but never classify a provider success
  newer than a 60-minute settlement/webhook grace period as an integrity
  mismatch. Keep a 100-candidate hard safety cap per provider, but also enforce
  a wall-clock budget: at most 40 seconds in the dedicated 60-second monitor
  route and 20 seconds inside the shared 60-second daily reconcile route. Use a
  maximum provider-call concurrency of four and a five-second timeout per
  provider request. Stop before the budget is exhausted and emit
  `payment_monitor_failed` with a capacity/budget reason whenever candidates or
  pagination remain; never treat a partial scan as complete.
- Emit `payment_integrity_mismatch` only for strong provider truth with a
  missing/conflicting local boundary. Provider API unavailability is
  `payment_monitor_failed`, not proof of payment failure.
- Wrap the local 30-minute trigger and daily Vercel fallback in separate Sentry
  Cron monitors. The local monitor uses a 90-minute grace so brief sleep/network
  interruptions do not page immediately; the daily monitor proves the cloud
  fallback still exists.
- Repeated unresolved mismatches remain visible once per run until fixed. Their
  per-attempt/invariant fingerprint groups the same finding; the integrity
  workflow notifies only on first-seen or regression, so the 30-minute scan does
  not repeatedly page for one unresolved incident.

The live Vercel team is currently on Hobby, whose cron frequency is limited to
once daily. The local LaunchAgent therefore provides approximately 30-minute
silent-integrity detection while the Mac is awake and online; Vercel remains a
daily fallback if the Mac is unavailable. A cloud-only within-minutes SLA still
requires a later Vercel upgrade or external scheduler.

### Local scheduler

- Install `/Users/nick/Library/LaunchAgents/com.chaarlie.payment-monitor.plist`
  only after the endpoint is deployed and its controlled smoke test passes.
- Run every 1,800 seconds using absolute executable/script paths; do not depend on
  an interactive shell, mutable working directory, or inherited terminal env.
- This cadence is a silent-integrity backstop, not payment-attempt polling.
  Customer/provider failures report event-by-event immediately. With the
  60-minute settlement grace, a silent provider-success/local-state mismatch is
  normally detected about 60–90 minutes after provider success while the Mac is
  awake and logged in; daily Vercel remains the offline fallback.
- Store `PAYMENT_MONITOR_TRIGGER_SECRET` in macOS Keychain under a dedicated
  service name. The plist, repository, command line, and logs contain no secret.
- The local Node wrapper reads the secret at runtime and keeps the authorization
  header inside the process (never in shell or `curl` arguments), calls the
  production HTTPS endpoint with a short timeout, emits no response body
  containing customer data, and records only timestamp/status diagnostics in a
  bounded local log. Installation must prove Keychain retrieval from the actual
  non-interactive LaunchAgent context, not only from Nick's terminal.
- `launchd` exit failure plus a missed Sentry check-in makes local scheduler
  degradation visible; it never retries payment work.

## Target map

### Shared observability and reconciliation

- `src/lib/observability/checkout.ts` — keep existing scrubber and exception
  behavior; strengthen secret/PII defense and route-stage mapping.
- `src/lib/observability/payment.ts` — new typed payment signals, levels,
  boundary enum, stable fingerprints, safe user identity, and descriptor
  normalization.
- `src/lib/billing/payment-runtime.ts` — server-only source of truth for
  deployment/provider live mode; pass a resolved boolean to browser checkout
  surfaces instead of deriving it from `NODE_ENV` or Sentry environment.
- `src/app/api/billing/reconcile/route.ts` — add isolated payment-integrity
  reconciliation and Sentry Cron check-ins to the existing daily job.
- `src/app/api/billing/payment-monitor/route.ts` — dedicated, least-privilege
  trigger for the same read-only reconciliation core.
- `src/lib/billing/payment-integrity.ts` — provider/local comparison with bounded
  windows and test-injected provider/database dependencies.
- `scripts/billing/trigger-payment-monitor.mjs` — generic local HTTPS trigger
  that reads the dedicated secret from macOS Keychain and never logs it.
- `/Users/nick/Library/LaunchAgents/com.chaarlie.payment-monitor.plist` — local,
  uncommitted LaunchAgent installed only after deployment verification.

Reuse prior art rather than creating new infrastructure:

- exact idempotency/grouping patterns from
  `src/lib/billing/analytics-outbox.ts` where needed;
- cron auth/runtime/test dependency injection from the existing reconcile route;
- the current event scrubber and Sentry scope style from checkout observability.

### Customer and provider boundaries

- `src/components/checkout/stripe-offer-elements-checkout.tsx`
- `src/components/checkout/paypal-subscription-button.tsx`
- `src/components/checkout/paypal-one-time-button.tsx`
- `src/components/checkout/personal-plan-one-time-checkout.tsx`
- `src/components/checkout/payment-method-checkout.tsx`
- `src/components/checkout/offer-payment-overlay.tsx`
- `src/components/checkout/offer-payment-overlay-lab.tsx` as a test-only control
- `src/components/quiz/result-offer-pricing.tsx`
- `src/components/reactivation/membership-reactivation-checkout.tsx`
- Stripe create/session and webhook routes under `src/app/api/stripe/`
- PayPal create/approve/capture/status and webhook routes under
  `src/app/api/paypal/`
- post-payment recovery under `src/app/welcome/`

Implementation must inventory each path against the signal contract. It must
not mechanically report every catch block: validation, duplicate access,
cancellation, and abandonment keep their distinct semantics.

### Tests and operations

- Extend `tests/checkout-observability.test.ts` for defense-in-depth scrubbing.
- Add `tests/payment-observability.test.ts` for levels, mapping, fingerprints,
  bounded unknown errors, live/test tags, safe user id, and hostile PII fixtures.
- Extend Stripe, PayPal, one-time, reactivation, webhook, overlay, and welcome
  tests so every customer-visible terminal failure reports exactly once.
- Add `tests/payment-integrity.test.ts` and extend
  `tests/billing-reconcile-analytics.test.ts` for reconciler isolation and Cron
  check-in outcomes.
- Add `docs/operations/payment-failure-monitoring.md` with alert semantics,
  secure identity lookup, provider/database reconciliation, and closure rules.

## Designed operator journey

This is backend/operations work. There is no end-user surface, copy, timing, or
feedback change, so no visual mockup is required.

1. A customer uses any supported live checkout. Merely opening it does not
   alert.
2. If Chaarlie shows a payment error, the shared reporter emits one warning even
   when the failure came from a guard or callback rather than a thrown exception.
3. Nick receives a Sentry notification containing provider, method, commerce
   path, bounded error family, release, and safe lead/user lookup id. The event
   explicitly says whether provider truth is `failed`, `succeeded`, or `unknown`.
4. Provider-confirmed initial/renewal failures and verified-webhook processing
   errors generate their own typed signals even if the browser is gone.
5. While Nick's Mac is awake and online, the local job checks provider success
   against verified webhook, billing, and entitlement truth about every 30
   minutes. A mismatch or failed/missed monitor run alerts at high priority.
   The daily Vercel run repeats the same comparison as a cloud fallback.
6. Nick follows the runbook from Sentry event to internal identity, provider
   object, webhook claim, billing row, entitlement, and settlement. The final
   classification is real failure, recovered customer-visible error,
   cancellation/abandonment, internal QA, or integrity incident.
7. The incident closes only when provider and local truth agree; UI output, CVC
   metadata, or a single callback alone never establishes payment truth.

**Operator-journey sign-off:** confirmed by Nick on 2026-08-01, including the
30-minute local cadence and daily Vercel fallback.

## Ordered implementation tasks

### 1. Freeze the signal taxonomy and path matrix

- Enumerate every current Stripe/PayPal checkout path and map its customer-error,
  provider-failure, webhook, billing, and entitlement seams.
- Add red characterization tests for: a guard-driven wallet failure, card
  confirmation error, PayPal client error followed by server success, initial
  provider decline, renewal failure, verified webhook processing exception, and
  provider success without entitlement.
- Inventory existing payment-specific `captureCheckoutException()` calls and
  record whether each is replaced by the typed reporter or remains independent;
  no branch may emit both for one outcome.

**Complete when:** every path has one signal owner and red tests fail only for
missing observability, not changed payment behavior.

### 2. Add the typed, privacy-bounded Sentry reporter

- Implement `PaymentSignal`, `PaymentBoundary`, `PaymentErrorFamily`, stable
  fingerprinting, level mapping, server-authoritative live/test classification,
  and internal Sentry user id.
- Resolve `payment.live` on the server from a production Vercel deployment plus
  provider live mode (`sk_live_` from the server-only Stripe secret key and
  `PAYPAL_ENVIRONMENT=live` for PayPal), then pass that result into client
  checkout surfaces. The browser host and publishable key may be defense-in-depth
  checks but are not the authority.
- Normalize provider failures into a safe descriptor before capture; never pass
  a provider SDK object.
- Extend global scrubbing as defense in depth for the exact Stripe/PayPal secret
  and email fields identified above.
- Contain all reporter/sink errors internally and prove a throwing sink leaves
  the surrounding payment callback behavior unchanged.

**Complete when:** hostile fixtures cannot leak any secret/email, unknown errors
group under one bounded family, and the existing checkout capturer's behavior is
unchanged.

### 3. Instrument every customer-visible failure exactly once

- Route all supported Stripe, PayPal, one-time, reactivation, and return/recovery
  error outcomes through the reporter.
- Ensure wallet `paymentFailed()`, local guard rejection, and generic UI error
  setters cannot bypass reporting.
- Replace existing generic Sentry capture at payment-outcome sites rather than
  stacking a second event; keep unrelated diagnostic exception capture intact.
- Preserve cancellation, duplicate access, retry, provider lock, and recovered-
  success semantics.

**Complete when:** focused component/browser tests prove one event per attempt/
failure branch with zero payment-ordering/timing changes.

### 4. Instrument authoritative provider/server failures

- Emit `provider_payment_failed` for Stripe initial/async/renewal failure and
  PayPal approval/capture/subscription-payment failure after provider truth is
  known.
- Emit `payment_webhook_processing_failed` only after signature verification;
  random/unverified signature failures are security noise, not customer payment
  failures.
- Capture configuration/provider-session errors when they result in a real
  customer-visible failure.

**Complete when:** provider/webhook fixtures cover success, decline, renewal,
duplicate delivery, recovered client error, and processing rollback.

### 5. Add shared local-plus-daily provider/local integrity reconciliation

- Implement one shared read-only comparison and call it from both the dedicated
  payment-monitor route and the existing protected billing cron.
- Authenticate the local route with a dedicated least-privilege secret, use
  constant-time comparison, rate-limit invocations, and return no customer or
  provider-object payload.
- Insert the integrity branch before the current
  `analyticsRetryEnabled !== true` early return; analytics retry being disabled
  must not disable payment monitoring.
- Detect provider success without verified webhook/billing/entitlement and local
  success conflicting with provider failure, using the 60-minute lower grace,
  72-hour lookback, per-provider direction, candidate/concurrency limits, and
  the 20/40-second caller-specific wall-clock budgets above.
- Add separate Sentry Cron start/success/error check-ins for the 30-minute local
  trigger and daily Vercel fallback while retaining per-branch results.

**Complete when:** time/provider-controlled tests emit the right mismatch once
per run, do not convert provider lookup errors into payment failures, and prove
one reconcile branch cannot suppress another.

### 6. Install and verify the local LaunchAgent

- Commit a secret-free trigger wrapper and install the user-level LaunchAgent
  with absolute paths and a 1,800-second interval.
- Put only the dedicated trigger secret in macOS Keychain; verify the plist and
  logs contain no secrets or customer data.
- Prove Keychain retrieval from the real non-interactive LaunchAgent, one manual
  run, one automatic run, sleep/offline recovery, and missed-check-in
  notification. Keep the daily Vercel fallback active.

**Complete when:** the Mac triggers a successful production reconciliation and
Sentry check-in without altering payment state, and disabling the LaunchAgent
produces the expected monitor-health alert while the daily fallback remains.

### 7. Configure Sentry workflows

- Highlight bounded payment tags and save real-customer, internal-QA,
  provider-decline, technical, webhook, integrity, and monitor-health searches.
- Create a real-customer workflow filtered by `payment.live=true` and
  `payment.is_internal_test=false`, triggering on first occurrence and
  recurrence/frequency.
- Create a highest-priority workflow for webhook, integrity, and monitor
  failures.
- Add a static metric monitor over payment failure events so repeated events in
  an existing issue still notify rather than relying only on first-seen issue
  behavior. Limit it to immediate customer/provider/webhook signals; exclude
  repeated reconciliation findings, which use first-seen/regression workflow
  rules to avoid paging every 30 minutes.
- Keep internal QA non-paging and validate missed/error Sentry Cron actions.

**Complete when:** a controlled non-charge test creates the expected issue,
fingerprint, tags, saved-search membership, first notification, and repeated-
event notification.

### 8. Roll out without changing payment behavior

- Deploy reporting first with Sentry actions muted; inspect staging/preview and
  production-QA event payloads for grouping, live/test classification, and PII.
- Enable immediate real-customer/provider/webhook workflows after the controlled
  alert-delivery smoke.
- Enable integrity notifications after a dry-run result review, one successful
  local check-in, and one successful daily fallback check-in.
- Reconcile the first production signals manually and adjust only taxonomy or
  notification noise—not payment semantics.

**Complete when:** production ingestion, actual alert delivery, Cron health, and
one fully reconciled internal QA path are documented with no checkout regression.

## Evidence-gated Phase 2

Do not build this in V1. Re-open it only when one of these is true:

- a real customer reaches authorization but no provider object exists and no
  immediate reporter event arrives;
- provider/local reconciliation cannot identify the last successful boundary;
- alert investigation repeatedly lacks a stable attempt correlation; or
- Nick chooses a within-minutes silent-stall SLA and approves the required
  scheduler infrastructure/cost.

Then add an append-only `billing_payment_attempt_events` ledger using the
existing `checkout_attempt_id` plus the provider's native session/intent id as
the provider-attempt identity—no third UUID. Reuse the repo's HMAC/
`timingSafeEqual` token pattern and established `fetch(..., {keepalive:true})`
fire-and-forget pattern for bounded browser transitions. The request must never
be awaited by a Stripe/PayPal confirmation callback. A frequent reconciler then
detects authorization-without-outcome stalls; Vercel Pro or an explicitly
chosen external scheduler is required for a sub-day cadence on current hosting.

## Verification

### Automated

- Observability: payload, mapping, fingerprint, level, dedupe, PII/secret
  scrubbing, live/test classification, safe user identity, bounded unknown error.
- Components/browser: card, Apple Pay, PayPal subscription, one-time purchase,
  reactivation, success/failure/cancel/retry/recovered-success; exact-once
  reporting and unchanged confirmation timing.
- Provider/webhook: Stripe initial/async/renewal failure; PayPal approval,
  capture, and subscription-payment failure; duplicates and processing errors.
- Integrity/Cron: missing webhook, billing, entitlement; conflicting truth;
  provider outage; internal QA; local and daily check-in start/success/error;
  branch isolation;
  settlement grace; Stripe provider-first and PayPal local-intent-first scans;
  pagination/cap overflow.
- Repository gates: focused payment suite, `npm run ci:verify`, `ready-check`,
  request-code-review, and Claude whole-branch counterpart review.

### Manual/provider test mode

- Stripe: success, provider decline, authentication/cancellation, and controlled
  technical failure for subscription and one-time commerce.
- PayPal sandbox: subscription success/failure and one-time capture
  success/failure.
- Confirm each customer-visible error has the right `payment.truth`; later
  provider success is recovered, not failed.
- Confirm local/preview traffic cannot set `payment.live=true` even when copied
  environment variables say production.

### Live-state and alert verification

- Run an internal-QA/non-charge Sentry smoke and verify issue, fingerprint,
  tags, saved-search membership, real action delivery, local 30-minute check-in,
  and daily fallback check-in.
- Inspect the installed LaunchAgent and Keychain-backed wrapper for secret-free
  configuration, bounded logs, offline behavior, and automatic restart.
- For the first live signal, reconcile provider object, webhook ledger, billing
  row, entitlement, and settlement before closure.
- Audit for unknown error families, duplicate events, leaked secrets/PII,
  missing user ids, and development pollution.
- Document that pseudonymous internal ids are used for legitimate-interest
  operational security/reliability monitoring; Sentry receives no customer
  email or IP.

## Review and handoff

- Plan worktree: `.worktrees/payment-failure-observability-plan` on
  `codex/payment-failure-observability-plan` from merged PR #291.
- Durable artifact: this plan, intended to be committed with implementation.
- Mockup: not required; no end-user surface changes.
- Claude counterpart review: completed read-only; transient report remains
  outside the repository and will be discarded at handoff.
- Operator-journey sign-off: confirmed by Nick on 2026-08-01.
- Publication/configuration boundary: implementation is authorized through
  `implementation-loop`; migration, Sentry workflow creation, deployment,
  payment/provider live mutation, and LaunchAgent installation remain outside
  this implementation handoff until their explicit rollout gates pass.

### Decisions

No architecture decision is required for the recommended V1. Nick has chosen
the local Mac trigger plus daily Vercel fallback. One operational choice remains
at implementation time: notification destination. Recommended default is
immediate Sentry email to Nick; add Slack only if it is already the normal
incident channel.

Optional later decision: if Nick wants cloud-only within-minutes detection even
when the Mac is asleep/offline, choose either a Vercel Pro upgrade or an external
scheduler before Phase 2.

### Counterpart findings ledger

| ID  | Type           | Evidence                                                                                                                                                       | Decision                         | Plan change                                                                                                                                                     | Revalidation                                            |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| C1  | defect         | Existing scrubber does not cover `client_secret` or nested provider email fields                                                                               | accepted                         | Raw provider objects forbidden; explicit defense-in-depth keys and hostile fixtures added                                                                       | Observability hostile-fixture tests                     |
| C2  | tradeoff       | Full client beacon/ledger adds a public endpoint, token lifecycle, migration, and callback-adjacent code without an observed uncovered case                    | accepted                         | Chosen V1 is typed immediate events plus server-truth reconciliation; ledger moved behind evidence gate                                                         | Path matrix and first production incident audit         |
| C3  | infrastructure | Live Vercel team is Hobby; official docs limit cron frequency to daily                                                                                         | accepted and live-verified       | V1 reuses daily cron; sub-day SLA is an explicit later cost/scheduler decision                                                                                  | Controlled Cron check-in and daily run receipt          |
| C4  | architecture   | Existing route stage union would drift from a second lifecycle stage union                                                                                     | accepted                         | Retain `checkout.stage`; add one orthogonal closed `payment.boundary` mapping                                                                                   | Compile-time enum and mapping tests                     |
| C5  | architecture   | New provider-attempt UUID duplicates native session/intent identity                                                                                            | accepted for deferred Phase 2    | Deferred ledger uses native provider id plus current checkout-attempt id                                                                                        | Phase 2 schema review if triggered                      |
| C6  | prior art      | Repo already has outbox idempotency, Cron auth/DI, HMAC token, and keepalive fetch patterns                                                                    | accepted                         | Reuse seams named explicitly; `sendBeacon` removed from proposal                                                                                                | Diff review against named prior art                     |
| C7  | scope          | Overlay and overlay-lab surfaces were missing from target inventory                                                                                            | accepted                         | Both added; lab remains test-only                                                                                                                               | Path matrix and overlay tests                           |
| C8  | evidence       | Claude could not independently access Sentry state                                                                                                             | noted, no plan change            | Codex's live read-only Sentry API evidence remains source evidence; no Claude agreement claimed                                                                 | Current Sentry query receipt                            |
| C9  | defect         | A provider success can precede webhook/billing state during normal settlement lag                                                                              | accepted                         | Added a configurable 60-minute lower grace plus bounded 72-hour/100-candidate scan                                                                              | Time-controlled integrity tests                         |
| C10 | defect         | Existing Stripe Express payment errors would double-report if typed reporting were stacked over generic capture                                                | accepted                         | Typed payment signal replaces generic capture at payment-outcome sites; per-call-site ownership matrix required                                                 | Exact-once component tests                              |
| C11 | defect         | PayPal has no simple global recent-order enumeration equivalent to Stripe lists                                                                                | accepted                         | Stripe scans provider-first; PayPal scans local intents then retrieves provider truth                                                                           | Provider-direction tests                                |
| C12 | defect         | Sentry reporter failure could throw inside a payment callback                                                                                                  | accepted                         | Reporter is a non-throwing boundary with a throwing-sink regression test                                                                                        | Callback behavior test                                  |
| C13 | defect         | Existing reconcile route returns early when analytics retry is disabled                                                                                        | accepted                         | Integrity work must occur before and independently of that early return                                                                                         | Reconcile production-default test                       |
| C14 | decision       | Browser-origin signals lacked a server-authoritative live-mode source                                                                                          | accepted                         | Server resolves production deployment plus provider live mode and passes the boolean to clients                                                                 | Local/preview/live classification tests                 |
| C15 | architecture   | Nick's Mac is almost always online and can provide a frequent trigger without a Vercel upgrade                                                                 | accepted by explicit user choice | Added dedicated least-privilege endpoint, Keychain-backed 30-minute LaunchAgent, separate check-in, and daily Vercel fallback                                   | Manual/automatic/offline/local-secret verification      |
| C16 | defect         | Card and wallet failures share UI/callbacks but not one existing capture seam, so naive instrumentation would double-report wallet errors and miss card errors | accepted                         | Named leaf ownership and a single Stripe report-and-reject helper; distinguished add versus replace sites                                                       | Per-branch matrix and exact-once tests                  |
| C17 | defect         | Proposed tags included undefined values and duplicate `failure_class`/`error_family` dimensions                                                                | accepted                         | Removed duplicate tag and enumerated every payment tag value                                                                                                    | Compile-time types and reporter mapping tests           |
| C18 | defect         | A 100-item provider cap did not bound PayPal round-trip time inside a 60-second function                                                                       | accepted                         | Added 20/40-second caller budgets, provider timeouts, bounded concurrency, and partial-scan failure semantics                                                   | Time-controlled budget and pagination tests             |
| C19 | defect         | A frequent integrity scan could notify repeatedly for the same unresolved mismatch                                                                             | accepted                         | Added per-attempt/invariant finding fingerprints and excluded integrity repeats from the frequency monitor                                                      | Repeated-scan grouping and workflow smoke               |
| C20 | defect         | `billing_webhook_events` stores event id/type but no provider-object correlation, so a per-object missing-webhook invariant would be unreliable                | accepted                         | V1 reports verified processing exceptions immediately and reconciles provider success against billing/access truth; no migration or guessed webhook correlation | Webhook exception and commerce-specific integrity tests |

## Residual risks

- V1 cannot prove a customer authorization that creates neither a provider
  object nor an immediate Sentry event. Phase 2 is the explicit response if that
  gap is observed.
- Local checks pause when the Mac sleeps, loses network, or is logged out. A
  90-minute missed-check-in alert makes that visible, while the daily Vercel
  fallback still runs.
- Provider API downtime during reconciliation is monitor failure, not payment
  failure.
- Sentry feature availability depends on the current account plan/workflow
  configuration; implementation must test real delivery rather than infer it
  from a saved rule.
- Customer-visible error plus successful charge is still a UX problem but not a
  failed payment; alerts and runbooks must preserve both facts.
