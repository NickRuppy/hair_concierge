# Checkout observability safety net

## Outcome

The 2–4 August 2026 incident exposed a pre-provider blind spot: Chaarlie could reconcile a provider payment with billing/access, but could not alert when checkout returned a silent control outcome, never rendered, spun forever, closed unexpectedly, or navigated away before a provider object existed.

This change makes those customer-experience defects immediately visible without changing checkout UI or payment behavior.

## Chosen architecture

Use the two existing operational surfaces:

- PostHog keeps the complete, privacy-bounded checkout lifecycle for journey analysis.
- Sentry receives only classified structural degradation and server control-outcome failures that require operator attention.
- Provider webhooks and the existing payment-integrity reconciliation remain payment/access truth.

The P0 server capture ships first inside the branch. Browser coverage follows against the same closed contract. A new anonymous database ledger is deliberately deferred: it adds a new privacy and abuse boundary, cannot safely page without corroboration, and is not required to close the immediate blind spot.

## Safety boundaries

- No UI, copy, pricing, navigation, provider, request, or payment semantic changes.
- Watchdogs report only. They never cancel a request, clear loading state, close a sheet, navigate, or introduce recovery UI.
- No raw email, IP, full user agent, URL/query, card data, provider identifier, client secret, token, or arbitrary error message in PostHog or Sentry.
- Sentry fingerprints contain only signal, provider, boundary, and closed failure family. Release/browser/device remain Sentry-native tags/context, never fingerprint segments.
- Ordinary customer cancellation, card decline, provider cancellation, page close, and Back remain analytics-only unless they expose a structural implementation defect.
- Internal QA remains tagged through the existing `isInternalTest` flag and excluded in the alert workflow, never by email heuristic.
- `NEXT_PUBLIC_CHECKOUT_OBSERVABILITY_ENABLED=false` disables new browser reports. `CHECKOUT_OBSERVABILITY_ENABLED=false` disables new server reports. Existing payment truth signals remain enabled.
- No production deployment or external Sentry workflow mutation in this branch.

## Closed contract

### Lifecycle transitions (PostHog)

Existing transitions remain unchanged. New transitions are:

- `overlay_mounted`
- `overlay_visible`
- `overlay_visibility_timeout`
- `provider_load_started`
- `provider_load_timeout`
- `provider_load_error`
- `confirm_failed`
- `provider_cancelled`
- `unexpected_navigation`

New closed failure reasons are:

- `overlay_not_visible`
- `provider_ready_timeout`
- `provider_load_error`
- `provider_request_timeout`
- `malformed_provider_response`
- `silent_control_outcome`
- `unexpected_route`

### Sentry classification

- Signal: `checkout_experience_degraded` (error).
- Boundaries: `presentation`, `provider_session`, `customer_authorization`, or `navigation` as appropriate.
- Failure families: `presentation`, `timeout`, `provider_unavailable`, `control_outcome`, `navigation`, or an existing explicit family.
- `status` is a closed diagnostic reason in context only; it is never a fingerprint segment.

### Server control outcomes

Every `preparedCheckoutUnavailable()` and provider-lock return must pass exactly one server-only cause from this bounded map:

- `authorization_unavailable`
- `access_conflict` (warning control outcome)
- `lead_lookup_unavailable`
- `identity_unavailable`
- `preparation_token_mismatch`
- `prepared_session_missing`
- `prepared_pricing_missing`
- `consent_context_missing`
- `claim_validation_failed`
- `canonical_metadata_repair_failed`
- `prepared_client_secret_missing`
- `claim_update_failed`
- `claim_metadata_mismatch`
- `provider_locked_stripe` (warning control outcome)
- `provider_locked_paypal` (warning control outcome)

The browser response stays generic (`status: unavailable` or the existing provider lock). Capture/flush failure is contained and cannot alter the response.

## Operator journey

1. CTA/open keeps the existing app-owned `checkoutAttemptId` and emits `opened`.
2. The overlay emits mounted and visible only at actual component/render seams. A conservative one-shot watchdog emits `overlay_visibility_timeout` plus one Sentry degradation if visibility never happens.
3. Stripe and PayPal emit load-start, ready, explicit error, cancellation, confirmation, and timeout lifecycle states. Timers are cleared on normal outcome/unmount and report at most once per attempt/provider/stage.
4. Silent Stripe server control outcomes emit an immediate sanitized Sentry event before returning the unchanged opaque response.
5. Normal Back/dismiss/cancel/resume remains distinguishable from forced close, wrong-route teardown, and failure after payment engagement.
6. Sentry groups structural incidents immediately. PostHog answers rate/cohort questions by provider, release, browser/device, and Instagram in-app context. Reconciliation later answers whether provider money or customer access was affected.
7. The local and daily reconciliation routes send real Sentry check-ins rather than the current no-op so failed runs and missed daily cloud coverage are visible.

No end-user journey changes. Nick’s explicit 4 August direction to track and flag all checkout/payment failure modes is the operator-journey sign-off for this non-visual change.

## Ordered implementation

1. Extend the existing analytics/payment contract and tests. Preserve one attempt identity, exact-once lifecycle dedupe, bounded payloads/fingerprints, and observability kill switches.
2. P0 server capture: enumerate every silent prepared-session/provider-lock return, assign a closed cause, capture `checkout_experience_degraded`, and flush before returning without changing the public response.
3. Overlay integrity: emit actual mount/visibility; add an observability-only missing-visibility watchdog; distinguish normal dismiss/resume/Back from unexpected route teardown.
4. Stripe: cover preparation/client secret, Payment Element readiness/error/never-ready, Express/Apple Pay readiness, and confirmation failure/cancellation. Avoid duplicate capture where an explicit failure already reports.
5. PayPal: cover SDK readiness, create/capture still-pending watchdogs, malformed pending responses, explicit errors, and provider cancellation for one-time and subscription flows.
6. Monitor health: wire real Sentry check-ins for existing local and daily reconciliation runs; document the external workflow filters needed for immediate live non-internal degradation alerts.
7. Run focused suites, `npm run ci:verify`, narrow WebKit simulation where deterministic, ready-check, and whole-branch review.

## Verification gates

- Contract tests: every enum, safe status, fingerprint, dedupe key, internal-test flag, and kill switch.
- Server route tests: representative cases for every cause family; generic response unchanged; one capture/flush; observability failure contained.
- Overlay tests: mounted/visible success is quiet; never-visible reports once; normal backdrop/drag/Escape/Back/resume is not an incident; unexpected navigation is distinct.
- Stripe fake-timer tests: readiness cancels timeout; timeout reports once; later provider completion still follows the existing path; explicit load/confirm errors do not double-report.
- PayPal fake-timer tests: SDK/create/capture hangs report once; later resolution still follows existing logic; ordinary provider cancel is analytics-only; malformed response is distinct.
- Monitor tests: in-progress and ok/error check-ins use stable slugs; capture failure is contained; telemetry delivery rules remain intact.
- Existing analytics, checkout, webhook, billing, entitlement, and integrity tests remain green.
- Final: `npm run ci:verify`, implementation-loop ready-check, request-code-review, and read-only counterpart whole-branch review.

## Alert policy and latency

- Immediate page candidate: any live, non-internal `payment_checkout_initialization_failed`.
- Structural checkout degradation: notify when Sentry sees 3 unique live non-internal attempts with the same provider/boundary/family in 10 minutes; one event remains an issue without paging.
- `access_conflict` and `provider_locked_*` remain warning control outcomes unless their rate spikes.
- Never notify for `payment.is_internal_test=true` or `payment.live=false`, but retain both for health verification.
- Provider decline/cancel remains warning/analytics; provider success versus local access remains the existing fatal integrity signal after grace.
- Existing daily cloud reconciliation heartbeat must alert after its configured missed-check-in margin. The 30-minute Mac route reports run health but is not the sole cloud safety net.

The code can emit and classify these signals; installing or changing the Sentry workflow is a separate production action and must be verified after deployment.

## Handoff

- Branch: `codex/checkout-observability-safety-net`
- Worktree: `.worktrees/checkout-observability-safety-net` from fresh `origin/main`
- Plan and runbook are durable. Counterpart review output is transient and must not be committed.
- Stop point: verified review-ready branch. No commit, push, PR, merge, deployment, or external monitoring mutation without explicit authorization.
