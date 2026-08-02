# Payment checkout reliability and Sentry signal hardening

## Outcome and source context

Make prepared Stripe checkout retries reliable and make today's Sentry surface distinguish real
payment incidents from expected checkout control flow, historical internal QA, recovered monitor
failures, and third-party in-app-browser noise.

Production evidence from 2026-08-02 is authoritative for this plan:

- A real visitor's prepared Stripe Checkout Session succeeded at 12:35:43 CEST.
- The same preparation ID was submitted again at 12:44:22 and 12:44:35 CEST.
- Stripe returned HTTP 400 `idempotency_error` for both retries because the idempotency key was
  reused with changed parameters. The request expiry moved from `1785668803` to `1785669335`, and
  the preparation-token hash also changed.
- The application rethrew both Stripe errors as route HTTP 500 responses. The browser produced
  HAIR-CONCIERGE-2N and HAIR-CONCIERGE-2P, while the route's ambient server Sentry call did not
  deliver the provider cause reliably.
- Existing-access preparation responses use the intentionally opaque HTTP 200
  `prepared_checkout_unavailable` contract, but the current client reports them as payment
  failures; direct duplicate-access control flow also reaches the global unhandled-rejection
  handler.
- HAIR-CONCIERGE-1N, 1R, 2E, 1P, and 2F match narrowly identifiable Meta/Instagram injected native
  bridge frames that do not exist in this repository.
- HAIR-CONCIERGE-2W and 2Y were monitor failures on older releases. Later LaunchAgent runs exit 0,
  and 2Y's PayPal incomplete-pagination cause was addressed by the already deployed monitor
  hardening.
- HAIR-CONCIERGE-2X is one known historical internal QA Stripe success without a local paid row.
  Current releases tag it `payment.is_internal_test=true`; it must remain available for integrity
  diagnosis but must not notify as a real-customer incident.

This plan supersedes no payment-truth invariant from
`plans/2026-08-01-payment-failure-observability.md`; it repairs gaps discovered by operating that
system.

## Chosen direction

Use one browser-generated, cryptographically random preparation credential for the complete life
of a preparation generation. The credential contains the preparation ID and bearer token. Every
retry sends the same values, so Stripe receives byte-for-byte stable idempotent parameters. A
deliberate refresh creates an entirely new credential.

Do not send `expires_at` in the idempotent Stripe create request. Stripe documents a 24-hour default
when the field is omitted; this avoids making correctness depend on a mobile device clock. The
server still returns a short application usability deadline (the earlier of Stripe's real expiry
and server-now plus the current 31-minute window), so the clients deliberately refresh on the same
timescale as today without putting a moving value into Stripe's idempotent request body.

This is preferred over:

1. **Cache-only retry avoidance.** Returning the already received client secret would prevent the
   exact visible retry, but it would still fail when Stripe creates a Session and the HTTP response
   is lost. Cache reuse will be added as a fast path, not treated as the correctness boundary.
2. **Removing idempotency or changing the key on every retry.** That would avoid Stripe's conflict
   but could create multiple live Checkout Sessions for one preparation and would weaken recovery.
3. **Persisting preparation state in a new database table.** This can also provide stable server
   values, but it adds a migration, cleanup policy, and another payment dependency when a stable
   client-held bearer credential provides the same retry property. No database migration is
   justified for this incident.

Use the existing Node-only payment Sentry adapter for unexpected route failures, extend the closed
payment vocabulary with an initialization-failure signal, and flush delivery before rethrowing.
Expected unavailable/access-conflict outcomes remain control flow and do not emit payment-failure
signals. Exact third-party Meta bridge signatures are dropped in the browser `beforeSend`; near
misses remain visible.

### Counterpart review decisions

Claude's high-effort read-only review returned **approve with revisions**. The revisions are
incorporated as follows:

- rejected browser-clock absolute expiry; explicit Stripe `expires_at` is omitted and application
  freshness remains server-clock based;
- retained the existing error-family enum and placed Stripe-specific cause in a closed `status`;
- selected error severity for server initialization failure because one live, non-internal event is
  operationally actionable;
- required actual request source/commerce tags rather than the route's current hardcoded source;
- replaced the fuzzy event-receipt wording with exactly-one-capture plus awaited bounded flush.

The transient Claude report is not a repository artifact. Its note that live Sentry was unavailable
to the reviewer does not weaken the source context: the orchestrating session independently queried
the current Sentry API and verified the issue/event tags listed above.

## Scope and non-goals

### In scope

- Stable Stripe prepare parameters for membership and one-time offer prewarming.
- Reuse of a valid prepared response within the same mounted checkout.
- Closed classification and reliable Sentry delivery for unexpected Stripe session-creation
  failures.
- Exactly-once browser reporting for genuine checkout-load failures.
- Suppression of opaque prepared-unavailable and duplicate-access control outcomes.
- Narrow filtering of proven Meta/Instagram injected native-bridge exceptions.
- Tests and runbook updates covering incident classification and post-deploy closure.

### Non-goals

- No checkout layout, German copy, payment-method ordering, Apple Pay presentation, consent flow,
  price, or entitlement behavior changes.
- No card, wallet, or provider decline is reclassified as successful.
- No broad user-agent, Instagram-browser, message-only, or `app://` suppression.
- No database migration and no new environment secret.
- No client-clock timestamp participates in Stripe session creation.
- No production deployment, Sentry issue mutation, alert-rule mutation, customer contact, or
  payment-data repair without separate authorization.
- The known internal QA integrity mismatch is not hidden or repaired by inventing a local purchase.

## Target map

- `src/components/checkout/personal-plan-one-time-checkout.tsx`
  - own one stable preparation credential per generation;
  - reuse a still-valid prepared client secret;
  - classify unavailable/access-conflict outcomes without payment-failure telemetry.
- `src/components/quiz/result-offer-pricing.tsx`
  - send the stable credential for membership prewarm and avoid duplicate-access unhandled noise.
- `src/lib/stripe/prepared-checkout-credential.ts` (new)
  - browser-safe ID/token creation and pure validation/serialization seams.
- `src/app/api/stripe/create-checkout-session/route.ts`
  - require the credential for `prepare`, build token hash and expiry from it, classify unexpected
    provider failures, emit one server payment signal, flush, and preserve the HTTP failure.
- `src/lib/observability/payment.ts`
  - add a closed initialization-failure signal and severity/fingerprint behavior.
- `src/lib/observability/payment-server.ts` and existing core adapter only as needed
  - reuse guarded Node Sentry initialization and bounded flush; do not add a second SDK path.
- `src/components/checkout/stripe-offer-elements-checkout.tsx`
  - suppress only explicitly handled load/control errors and keep one owner for genuine load
    failures.
- `src/lib/observability/sentry-client-filter.ts` (new) and `instrumentation-client.ts`
  - exact Meta native-bridge filter before normal privacy scrubbing.
- Focused tests under `tests/`, especially Stripe route contract, offer/prewarm checkout,
  payment-server observability, payment vocabulary, and Sentry scrubbing/filter coverage.
- `docs/operations/payment-failure-monitoring.md`
  - add the new initialization signal and closure checks learned from the incident.

## Designed integration and operator journey

This is backend/client reliability and observability work. It does not change an end-user surface,
copy, timing promise, or feedback design.

1. An eligible visitor reaches the result offer. The app creates one preparation credential and
   prewarms Stripe exactly as today.
2. The first prepare request creates a Stripe Checkout Session. The client stores the prepared
   response.
3. If Stripe asks for the client secret again, the client first returns the valid cached secret. If
   a network retry is required, it resends the same ID, token, and idempotency key with no explicit
   Stripe expiry, and Stripe replays the same Session instead of returning an idempotency error.
4. A deliberate expiry/refresh discards the whole credential and creates one new generation; old
   and new parameters are never mixed.
5. A real unexpected route/provider failure returns the existing generic checkout error to the
   visitor and emits one classified `payment_checkout_initialization_failed` server event. The
   event uses closed tags/status, contains no raw provider message or customer data, and is flushed
   before the route preserves its error response.
6. A browser can still emit one customer-visible companion signal when the user actually sees the
   load failure, but the hidden prewarm and nested Stripe component do not double-report the same
   already-classified rejection.
7. Existing access, provider-lock, opaque authorization/identity unavailability, and intentional
   duplicate dialogs remain recoverable control states and do not enter the payment-failure queue.
8. Exact Meta native-bridge injection failures are dropped client-side. A similar exception from
   Chaarlie code or a different frame/function combination still reaches Sentry.
9. The operator investigates the server initialization event first, then correlates a browser
   companion by safe internal attempt/lead identifiers. Internal QA is excluded by the existing
   `payment.is_internal_test=true` alert condition, while the integrity event remains queryable.
10. After deployment, a production prewarm/retry probe, one successful monitor run, and a fresh
    Sentry query provide the evidence for resolving the obsolete/noise issue groups.

Integration-journey sign-off: **confirmed by Nick on 2026-08-02** after the reconstructed customer
failure journey and remediation behavior were presented.

## Mockup evidence

No mockup is required. No visual surface, copy, interaction order, loading state, or user feedback
is being changed; existing generic error and duplicate-access UI remain exactly as rendered today.

## Ordered tasks

1. **Add red regression oracles for stable preparation generations.**
   - Add a pure credential fixture with injectable time/randomness.
   - Prove two retries in one generation serialize the same ID, token hash input, and Stripe
     idempotency key, with no `expires_at` create parameter.
   - Prove refresh creates a distinct full credential and expired credentials are not reused.
   - Extend request-schema tests so `prepare` requires all credential fields while `claim` keeps its
     current proof contract.
   - Completion: focused tests fail against current dynamic server token/expiry behavior for the
     same reason Stripe reported in production.

2. **Make prepared Session creation actually idempotent.**
   - Create and retain one credential per membership or one-time preparation generation.
   - Send its token on every prepare request and validate tight type/size bounds on the server.
   - Hash the supplied token into Stripe metadata and omit the explicit Stripe `expires_at` create
     parameter.
   - Keep echoing the same supplied `preparation_token` for compatibility and return a server-clock
     application usability deadline capped by the real Stripe Session expiry.
   - Return a valid cached client secret before issuing a redundant network request.
   - Preserve token proof, identity hash, claim, consent, provider lock, and refresh behavior.
   - Completion: the production failure sequence (success, nine-minute repeat, repeat) uses
     identical Stripe parameters and returns the same prepared Session in the injected Stripe test
     seam.

3. **Separate expected checkout control flow from reportable failures.**
   - Add a closed client error/outcome classifier shared by preparation owners and the Stripe
     Elements load reporter.
   - Treat `prepared_checkout_unavailable`, existing access, and provider locks as handled control
     outcomes.
   - Mark genuinely reported preparation failures so the nested load component cannot emit a
     duplicate event; retain reporting for independent Stripe load/init failures.
   - Guard hidden prewarm reporting with the existing visibility contract.
   - Completion: focused component tests prove zero payment signals for control outcomes, exactly
     one for a real visible failure, and no global unhandled duplicate-access event.

4. **Deliver the server-side cause reliably and privately.**
   - Add `payment_checkout_initialization_failed` to the closed signal vocabulary at error severity.
     This is intentionally stronger than a customer decline warning: it means the server could not
     initialize payment at all, and Nick asked to know about a single real checkout failure.
   - Keep existing error families. Classify Stripe failures under those families and carry specific
     causes only in a closed status: `idempotency_conflict`, `configuration_missing`,
     `rate_limited`, `provider_unavailable`, or `unknown`.
   - In the route's outer unexpected-error catch, emit through `payment-server` using the actual
     request source and commerce kind, await one bounded flush, and then preserve the throw/500.
   - Remove the duplicate ambient `captureCheckoutException` owner for that branch.
   - Completion: injected route/sink tests prove exactly one capture, bounded safe payload, awaited
     flush attempt,
     no raw message/email/client secret/provider reference, and unchanged HTTP failure semantics.

5. **Filter only proven third-party Meta bridge noise.**
   - Drop the iOS signature only when the message, `app://` frame, and known native bridge function
     agree.
   - Drop the Android signature only when the exact Java-object message, exact navigation logger
     frame, and native bridge function agree.
   - Apply the filter before the existing Sentry scrubber.
   - Completion: positive fixtures are dropped and message-only, frame-only, function-only, and
     Chaarlie-frame near misses are retained and scrubbed.

6. **Update operations guidance and prepare post-deploy closure.**
   - Document the new signal, real-vs-companion correlation, internal-QA routing, and the exact
     production retry probe.
   - Record issue disposition: 2N/2P real bug pending deploy; 22 intentional conflict noise pending
     deploy; 1N/1R/1P/2E/2F third-party noise pending deploy; 2W/2Y recovered monitor failures; 2X
     internal QA retained but excluded from notification; 2Q already resolved.
   - Completion: the runbook has an evidence-based close/keep-open rule for every issue active
     today.

## Verification

### Automated

- Run focused Node tests for prepared credentials, Stripe route contract/params, one-time checkout,
  result-offer pricing/prewarm, Stripe Elements, payment observability/server delivery, and Sentry
  client filtering/scrubbing.
- Run the repository Node test suite.
- Run typecheck and lint.
- Run the production build through the repository readiness workflow.

### Manual/browser

- No visual regression is expected; confirm the existing offer overlay and duplicate-access dialog
  still render through the normal narrow checkout journey if a local browser fixture is available.
- Do not claim physical Apple Pay success from local automation. Production proof is an authorized
  real-device prewarm/open/retry with a valid wallet after deployment.

### Live-state checks (post-deploy, separately authorized)

- Verify one prepared Session request and an intentional repeated client-secret request share the
  same Stripe idempotency key and do not create a 400 `idempotency_error`.
- Verify the checkout can complete and local one-time purchase/access truth is correct.
- Run the local payment monitor once and verify HTTP 200/completed plus a later LaunchAgent exit 0.
- Query Sentry for the new release: no new 2N/2P/22 or exact Meta bridge events, no non-internal
  integrity mismatch, and no monitor failure.
- Verify the alert workflow includes the new initialization signal and excludes
  `payment.is_internal_test=true` before treating alerting as complete.

### Evidence-sensitive review

- Claude plan review at high effort before implementation.
- `ready-check` over the final tree.
- `request-code-review` plus the required whole-branch Claude code review before any push.
- Recheck every review finding against the exact branch; do not accept message-only suppression or
  loss of payment-truth reporting.

## Review and handoff

- Worktree: `.worktrees/payment-sentry-hardening`
- Branch: `codex/payment-sentry-hardening`
- Base: fresh `origin/main` at `0fc927b3` when planning began.
- Plan artifact: **commit**.
- Implementation/tests/runbook changes: **commit**.
- Claude review reports: **discard** from the repository unless explicitly retained.
- Temporary Sentry/Stripe investigation output: **discard**; never commit bearer capabilities,
  provider logs, email addresses, or raw references.
- Mockup: not applicable because this is not a user-facing change.
- Integration-journey sign-off: **confirmed**.
- Stop point: verified, reviewed local branch. Do not commit, push, open a PR, merge, deploy, mutate
  Sentry, or perform production payment writes until separately authorized.
