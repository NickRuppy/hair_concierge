# Payment recovery and paid-access hardening

Status: approved for implementation after production account-history proof, revised evidence, user feedback, and reconciled Claude review

## Outcome and source context

Fix the 6 August 2026 one-time PayPal journey in which a customer:

1. received a terminal-looking PayPal error after Chaarlie had already created a valid order;
2. restarted checkout and caused an expected PayPal ownership lock to surface as additional Stripe/Sentry failures;
3. paid successfully, had a brand-new account created by fulfillment, then received a false existing-account password-activation `409` because the active-replay helper hard-coded `canSetInitialPassword: false` and the welcome page did not consume the capability; and
4. later returned to an older checkout/result path and reached the first quiz screen while the original attempt was still classified as degraded.

Source evidence:

- [PayPal client error](https://haircare-fw.sentry.io/issues/7656910949/)
- [client provider-lock error](https://haircare-fw.sentry.io/issues/7656911732/)
- [existing-account password activation error](https://haircare-fw.sentry.io/issues/7656918360/)
- [later navigation degradation](https://haircare-fw.sentry.io/issues/7656947222/)
- [PayPal JavaScript SDK `onError` reference](https://developer.paypal.com/sdk/js/reference/#onerror) — PayPal defines it as a catch-all callback, so provider reconciliation rather than client-message interpretation is the safety boundary.
- Read-only PostHog replay/event reconstruction and Supabase reconciliation performed on 6 August 2026. The payment captured once; the verified webhook, account link, plan generation, delivery, and confirmation succeeded. The plan remained unopened at the final check. No customer identifiers, provider references, activation tokens, or replay capabilities are retained in this plan.
- Privacy-safe production account-history proof: exactly one lead/quiz at `18:06:35Z`; no earlier auth account, profile, one-time purchase, or subscription; fulfillment created the auth account/profile at `18:11:18Z`, after capture; a login link was requested at `18:11:55Z` and the first session began at `18:12:03Z`. The `409` therefore did not indicate a returning customer or repeated quiz.

### Planning contract

**Outcome:** a customer sees one coherent recovery journey from PayPal uncertainty through paid access, without a second provider collision, an impossible password path, or misleading failure alerts.

**Constraints:**

- PayPal/provider/webhook truth remains server-owned.
- Exactly-once order creation/capture, one-time entitlement, consent, attribution, and the existing €29.99 offer remain unchanged.
- Existing result identity, funnel session, checkout-attempt identity, provider ownership, and prepared checkout identity are preserved across hide/reopen and deliberate retry.
- Capability tokens, provider IDs, raw SDK messages, email addresses, URLs with query strings, and payment details never enter analytics, Sentry fingerprints, screenshots, or durable artifacts.
- New-account activation keeps password and magic-link choices across webhook/replay races. A broader genuine-existing-account welcome redesign is a separate follow-up, not a dependency of this incident fix.
- PayPal cancellation, definitive provider failure, expired intent, network outage, revoked purchase, and support-needed states remain distinct.
- Sentry workflow changes, production deployment, real charges, customer contact, and data repair require separate authorization.

**Non-goals:**

- no pricing, guarantee, offer, provider eligibility, or subscription-checkout redesign;
- no unified payment ledger, new database table, or migration;
- no speculative rewrite of browser history without an exact failing reproduction;
- no change to PayPal capture/webhook authority or to one-time access generation;
- no automatic outbound support message or account mutation for the affected customer.

**Done when:** the plan has a reviewed real-layout mockup, closed state contracts, an exact regression matrix, independently deployable slices, rollback/monitoring gates, a reconciled Claude review, and explicit user sign-off on the designed journey.

## Chosen direction

Use the existing one-time payment and activation authority rather than introducing another recovery store:

1. **One neutral pending state after PayPal SDK uncertainty.** When PayPal `onError` fires, replace the terminal red failure with bounded polling of the existing activation-idempotent `/api/billing/one-time-activation-status` route. Do not add a pre-capture provider-state inspector or change the response contract. Existing `pending` and non-OK responses stay visibly pending; `paid_pending` continues to the current access-finalization surface; only `active` is success. `failed_permanent` and `revoked` continue to the existing welcome/support resolution, and create/capture expiry keeps its current path.
2. **Preserve the same attempt without guessing PayPal's missing step.** Keep the mounted PayPal button available during pending when it remains functional; do not add a custom “reopen/reset” CTA or claim whether approval/capture is missing. `Status erneut prüfen` only reconciles server truth. If the SDK control is no longer functional, the overlay remains non-terminal with manual recheck/close; a new SDK-reload state is deferred until observed. Stripe/card/Apple Pay remain unavailable while PayPal owns the consent.
3. **Minimal replay-capability hotfix.** Expose the existing PayPal-specific capability lookup to active replay; leave fresh account creation, Stripe, and the generic endpoint guard unchanged. Pass the current token into one-time PayPal active replay and replace hard-coded `canSetInitialPassword: false`. The replay lookup fails closed to `false` on auth-admin read error so a paid welcome still renders with login-link recovery instead of falling to `support_needed`. A checkout-created account remains password-eligible after webhook-first fulfillment without risking Stripe's different activation-key convention. One-time fresh and replay paths both intentionally use `checkoutContext: null`.
4. **Typed Stripe preparation.** Resolve the prepared Stripe response in `PersonalPlanOneTimeCheckout` before mounting Stripe Elements. The resulting parent state subsumes the existing `StripeControlRecovery`, `providerLockedOwner`, and `stripeProviderLocked` branches instead of adding a parallel layer. A `provider_locked: paypal` result becomes a typed owner/recovery state and Stripe Elements is not mounted with a rejected client-secret promise. Expected ownership emits lifecycle analytics, not a Sentry payment failure.
5. **Test-first navigation boundary.** Reproduce the exact `PayPal error -> reload/new attempt -> successful redirect -> checkout-created new-account welcome -> Back/old tab` sequence with the real history guard and fake provider endpoints. Change `offer-checkout-history` only if that sequence is red. Whether or not history code changes, a successful paid outcome must not be counted as an unresolved payment failure during operator reconciliation.
6. **Monitoring by truth class.** Provider locks and access conflicts are expected control outcomes: first create/verify lifecycle diagnostics for both lock directions, then remove them from payment-failure Sentry issue volume. Reserve immediate/aggregate payment alerts for provider-declared failure, checkout initialization failure, structural degradation without recovery, webhook failure, integrity mismatch, and paid-but-access-blocked outcomes.

This is delivered as three separately reviewable and deployable slices. Slice A removes the currently proven paid-access dead end first. Slice B changes checkout recovery behavior. Slice C changes monitoring and external alert routing only after behavior is stable.

## Scope and non-goals

### Slice A — webhook-first replay capability hotfix (P0)

- Preserve new-account password capability when PayPal fulfillment completes before the welcome-page replay by deriving it from the activation hash and password-initialization metadata instead of hard-coding replay as existing-account.
- Keep the current welcome choices and authenticated redirect unchanged; a separate product plan may later replace the password option for genuinely pre-existing accounts.
- Replace the source-string test that hard-codes replay capability as false with behavior-level webhook-first activation tests.

### Slice B1 — PayPal recovery and navigation regression (P1)

- Add a bounded PayPal one-time client recovery state machine around the existing activation-status route.
- Keep one neutral/pending customer state until existing server truth becomes `paid_pending`, `active`, or terminal; do not classify pre-capture PayPal sub-states.
- Keep the same PayPal button/attempt/order; remount the button only when the SDK itself is unusable, and never silently switch provider.
- Resolve Stripe preparation before Elements mounting so an expected PayPal lock cannot reject the Elements client-secret promise.
- Add the exact reload/redirect/Back browser regression before changing history logic.
- Add one bounded privacy-safe PayPal SDK `onError` warning with callback phase/token-present/recovery outcome; never capture the raw error string.

### Slice B2 — Stripe preparation/provider ownership (P1, independently deployable)

- Resolve the prepared Stripe response before Elements mounting so an expected PayPal lock cannot reject the Elements client-secret promise.
- Keep provider ownership and expected-control-outcome observability changes separate from the PayPal recovery controller.

### Slice C — alert semantics and rollout operations (P1)

- After B2 proves replacement lifecycle events for both lock directions, remove expected `provider_locked_*` and `access_conflict` outcomes from Sentry payment-failure capture while retaining that privacy-safe lifecycle evidence.
- Add a distinct paid-but-access-blocked signal/check derived from successful payment plus failed/abandoned activation, without exposing identity.
- Do not remove the existing noisy control-outcome Sentry routing until the paid-but-access-blocked monitor is deployed and verified; otherwise the change could recreate the August 2 observability gap.
- Amend the existing monitoring runbook only where incident evidence changes it; most work is external Sentry workflow configuration, not new observability code.
- Apply or modify Sentry workflows only as a separately authorized production operation after deployment.

## Authoritative state contracts

### PayPal client recovery

| Input/state | Customer state | Allowed action | Telemetry | Forbidden behavior |
| --- | --- | --- | --- | --- |
| SDK `onError`, no client token | Client did not receive order identity; server may still hold a consent-bound order if the response was dropped | show neutral start-retry copy; use the existing PayPal control again only if functional so the same checkout attempt recovers the server order | one bounded SDK warning | call status without a capability; create a new checkout attempt/order; claim definitive provider failure |
| SDK `onError`, token exists, first status check running | `Wir prüfen deine PayPal-Zahlung`, spinner/neutral | wait; manual close follows engaged-dismiss policy | `recovery_started` lifecycle | red terminal error; green check; enable Stripe |
| status `active` | payment/access confirmed | navigate once to canonical welcome destination through the shared single-flight navigation guard | `recovery_succeeded`; close attempt | create/capture another order |
| status `paid_pending` | money confirmed, access finalizing | navigate to existing pending welcome flow | `recovery_pending_access` | offer another payment |
| status `pending` during and after the bounded overlay checks | payment is not confirmed; the client does not guess whether PayPal awaits approval, capture, or recovery | remain non-terminal: show neutral `Noch keine Zahlung bestätigt`; keep a functional mounted PayPal button available; allow cooled-down manual checks or close the sheet | `recovery_pending` once | green check; claim payment/failure; create a new attempt/order; enable another provider |
| overlay status `failed_permanent` | server has reached a terminal local activation/fulfillment failure, not necessarily a provider-declared payment failure | navigate once to the existing welcome/support resolution for the same token | recovery lifecycle; welcome owns support evidence | invite endless manual rechecks or claim the provider declined payment |
| overlay non-OK response | provider/local truth cannot be classified safely | remain non-terminal neutral pending; manual status check or close the sheet | one bounded warning | claim provider failure or show a terminal screen |
| status `revoked` | server-confirmed access revocation | navigate to the existing welcome/support state through the shared single-flight guard | terminal classified outcome once | offer another payment or keep the PayPal control active |
| create/capture returns `409 paypal_order_intent_expired` | terminal expired intent | existing terminal support block (`Support kontaktieren`) | terminal classified outcome once | claim an existing reset path or reuse the expired order |

The bounded schedule is authoritative and lives in one constant shared by tests: checks occur at absolute offsets 0, 3, and 7 seconds from `onError` (three total), with an eight-second overlay deadline that gives the final check a useful bounded response window. This is the pre-decided rate-budget choice: do not raise the public 30-per-60-second limit. The existing welcome pending screen remains the longer 30-second access-finalization surface. A normal path makes at most eighteen rate-limited activation-status requests (three overlay plus fifteen welcome); including welcome server renders/reload, allow for roughly twenty PayPal order GETs and measure actual latency/call count in the fixture. `Status erneut prüfen` permits one in-flight request and has a three-second client floor. A `429`/`503` keeps existing `pending`, so both consumers reschedule calmly. No response-contract, pre-capture validation, `accessStateToStatus`, fulfillment retry, webhook, or operator-recovery behavior changes in B1.

The activation-status route is safe to retry because one-time fulfillment is guarded by `ensurePersonalPlanOneTimeFulfillmentJob` plus an atomic `claimPersonalPlanOneTimeFulfillmentJob`; losing callers reload canonical state instead of repeating fulfillment. Tests must prove that the combined overlay and welcome poll sequence yields exactly one account/entitlement activation, one plan fulfillment, and one confirmation send. This is the load-bearing idempotency invariant—not an assumption that the endpoint is read-only.

The rate-limit bucket is shared by `provider:token:IP`. A stale tab can therefore contend with the active tab. The UI must treat rate limiting as top-level `pending`, stop automatic overlay polling before starting welcome polling, and never restart the three-check cycle for repeated SDK callbacks. Two tabs or a reload may exhaust the existing budget; the chosen behavior is to remain calmly pending until the fixed window recovers, never to raise the limit or reinterpret the response as failure.

A full welcome-page reload can restart its 15 checks, so the theoretical overlay + welcome + reload sequence reaches 33 requests and may exceed the current 30/60-second bucket. Both consumers must keep rescheduling calmly from legacy top-level `pending`; the reload/two-tab fixture must prove no support/terminal surface appears. The limiter caps outbound provider retrievals at 30 within its window. Do not silently raise the public endpoint budget.

The intent token lifecycle is explicit: once the client receives a token, SDK error/cancel/reopen keeps it so reconciliation targets the same order; it clears only on terminal expiry/reset or a deliberately new checkout attempt. If the create-order response is dropped after server persistence, the browser has no token but the server reuses the existing intent/order by checkout attempt on the next `createOrder` call. The UI must describe this as a retryable start uncertainty, not definitive payment failure.

One single-flight navigation guard is shared by the PayPal SDK `onApprove` success/pending branches and the recovery poller. Whichever path claims navigation first aborts polling and owns the only `window.location.assign`; every later callback is a no-op. The guard resets only when the component is deliberately remounted for a new terminally allowed attempt.

The current `onError` returns early when the sheet is hidden. Replace that with “continue reconciliation, suppress only hidden visual updates”: a hidden/dismissed mounted button still records and reconciles the callback; `active` may claim the same canonical navigation, while nonterminal state is retained and shown if the customer reopens the sheet. A hidden callback must never create a new attempt or disappear from diagnostics.

The recovery overlay is non-terminal for unresolved or non-OK responses. After the three automatic checks, it stays neutral until the customer manually checks again, uses the still-functional PayPal control, or closes the sheet. It does not reuse the welcome page's 30-second timeout copy and adds no overlay support state. A server-owned `failed_permanent` status navigates once to the existing welcome URL, where the established support state explains the failure without inviting a status check that cannot recover.

### Account activation capability

| Endpoint account result | Current surface in this hotfix | Password outcome | Login-link outcome |
| --- | --- | --- | --- |
| authenticated matching user | current success/redirect | automatic canonical redirect | none |
| `canSetInitialPassword: true` (including a checkout-created account replayed after webhook fulfillment) | current new-account activation | create password | send login link |
| `canSetInitialPassword: false` | current activation surface remains unchanged in this hotfix | password attempt is rejected defensively; dedicated existing-account UI is a follow-up | send login link remains available |
| active payment, access still pending | current calm pending surface | automatic polling | refresh/support at existing timeout |
| revoked/support-needed | current terminal support surface | support route | none |

The create-password endpoint must continue returning `409` defensively if called with a genuinely ineligible account; Slice A corrects the false replay classification without weakening that guard.

Slice A does not add a capability prop or server-rendered welcome branch: `WelcomeClient` continues to show its current choices, and `set-checkout-password` reaches the corrected PayPal replay result. The table describes endpoint behavior, not a new variable UI surface. A dedicated genuine-existing-account UI is deferred; only the false `409` is fixed here.

For one-time PayPal replay, `canSetInitialPassword` is derived from server-owned auth metadata: the activation hash must match the current order token and `password_initialized_at` must be absent. Adopt the existing PayPal helper in replay; keep fresh creation's `created.created` outcome, the separate Stripe helper, and the endpoint guard unchanged. Replay catches admin lookup failure and yields `false`. “An auth row now exists” is not evidence of a pre-existing customer, because fulfillment intentionally creates that row after payment. Tests reproduce the webhook-first race, successful lookup, initialized/foreign activation, and lookup failure.

### Provider ownership

- `none`: Stripe and PayPal may prepare, subject to existing feature/runtime availability.
- `paypal`: mount/keep PayPal; do not mount Stripe Elements; display why card/Apple Pay are unavailable for this attempt.
- `stripe`: mount/keep Stripe; do not create a PayPal order.
- Ownership changes only after a terminal failed/expired provider intent or an existing explicit plan-change invalidation path.
- A reload/new client attempt for the same consent must recover the server owner before exposing another provider.

### Observability

- `provider_locked_*` and `access_conflict`: lifecycle/control outcome only after B2 proves both directions emit; no Sentry exception after that migration gate.
- PayPal SDK uncertainty with an existing token: one warning only if bounded recovery does not immediately reach `active`; classify with a closed code, not a raw message.
- Paid but activation UI blocked/abandoned: distinct operational incident after a defined grace period, reconciled against purchase/access truth.
- Aggregate workflow deduplication key: safe checkout attempt when present, otherwise the existing safe lead/user identity; never provider token/reference.
- A later server-confirmed success closes/suppresses warning escalation but does not erase the journey event needed for product diagnosis.

## Target map

| Surface | Expected change |
| --- | --- |
| `src/app/welcome/page.tsx` / `src/app/welcome/welcome-client.tsx` | no Slice A product refactor or B1 status-contract change; retain current pending/paid-pending/active handling |
| `src/app/api/auth/set-checkout-password/route.ts` | no behavior change; retain defensive `409` and confirm tests cover it |
| `src/app/api/auth/send-magic-link/route.ts` | no contract expansion expected; verify one-time PayPal and safe `next` handling |
| `src/components/checkout/paypal-one-time-button.tsx` | replace catch-all terminal `onError` behavior with neutral recovery, wire the pure controller, retain the same PayPal control/attempt, and reuse one funnel event ID |
| `src/lib/checkout/paypal-one-time-recovery.ts` (new) | pure reducer/timing/single-flight decisions testable under the existing Node harness; no provider or React side effects |
| `src/lib/paypal/welcome-url.ts` (new, client-safe) and `src/app/api/paypal/capture-order/route.ts` | extract the currently duplicated one-time welcome URL builder so capture and recovery navigation share one encoded destination |
| `src/app/api/billing/one-time-activation-status/route.ts` | no B1 contract change; reuse the existing activation-idempotent pending/paid-pending/active behavior and 30/60 limit |
| `src/lib/paypal/order-activation.ts` / `src/lib/paypal/checkout-activation.ts` | Slice A only: expose existing PayPal capability lookup to active replay, fail closed on replay lookup error, retain fresh-path/null-context behavior; no B1 provider-verification refactor |
| `src/components/checkout/personal-plan-one-time-checkout.tsx` | pre-resolve Stripe preparation; replace/subsume existing lock/recovery booleans with one exhaustive parent union; represent ownership without rejected Elements promises |
| `src/lib/checkout/prepared-one-time-checkout-state.ts` (new) | pure preparation/control-outcome union transitions testable under Node without a DOM harness |
| `src/components/checkout/stripe-offer-elements-checkout.tsx` | accept already resolved preparation; no provider mount for PayPal ownership |
| `src/lib/stripe/prepared-checkout-credential.ts` | reuse the existing typed control-outcome parser unchanged; the new parent preparation union remains component-local unless a behavior test proves a second consumer |
| `src/components/checkout/offer-payment-overlay.tsx` and `src/lib/checkout/offer-checkout-history.ts` | change only if the exact browser regression is red |
| `src/app/api/stripe/create-checkout-session/route.ts` plus existing checkout observability helpers | change the route-level promotion of `provider_locked_*`/`access_conflict` only after paid-but-access-blocked monitoring is live; add only closed safe classifications |
| `docs/operations/payment-failure-monitoring.md` | document recovery semantics, alert filters, reconciliation, rollout, and closure |
| focused checkout/auth/PayPal/history/observability tests | replace source-shape assertions at critical boundaries with behavior-level tests and exact race fixtures |

No migration is planned. If implementation discovers that server-owned provider ownership cannot be recovered from the existing consent/order-intent tables, stop and return to planning before adding schema.

## Designed user journey

Evidence-review status: **confirmed by Nick on 7 August 2026**

User-journey sign-off: **confirmed by Nick on 7 August 2026; implementation authorized**

### New customer, normal payment

1. Customer opens checkout from the completed result and selects PayPal, card, or an available wallet.
2. The selected provider owns the attempt; the other provider cannot silently take over.
3. Provider succeeds; Chaarlie redirects to the existing success page.
4. If fulfillment created a new Chaarlie account, that account remains classified as new even when the webhook wins the race and the welcome page replays active state; the customer keeps the current choice between creating a password and receiving a login link.
5. Successful authentication opens the server-resolved first-time destination and records first access.

### PayPal client uncertainty

1. Customer selects PayPal and Chaarlie creates one consent-bound order.
2. If the PayPal SDK errors after that point, the overlay stays open and replaces the red terminal error with `Wir prüfen deine PayPal-Zahlung`.
3. Chaarlie checks the existing activation-idempotent server status for at most eight seconds:
   - confirmed payment/access continues automatically;
   - paid but provisioning continues on the existing pending welcome screen;
   - every unconfirmed/provider-unavailable result remains neutral `Noch keine Zahlung bestätigt`; after the bounded window it offers only a cooled-down `Status erneut prüfen`, while a still-functional mounted PayPal button remains available without a claim about the missing PayPal step;
   - overlay non-OK remains non-terminal neutral pending with manual recheck/close instead of claiming provider failure; `failed_permanent` and `revoked` use the existing welcome/support resolution; create/capture expiry `409` uses the existing terminal support block.
4. Card and Apple Pay remain unavailable while PayPal owns the attempt. The customer is told why and is never invited to start a second order.
5. Closing or pressing Back follows the existing engaged-payment confirmation behavior and preserves the recoverable order.

### The affected new customer after successful payment

1. The success page shows `Zahlung erfolgreich` and `Dein Haarplan ist bereit`.
2. It explains that Chaarlie created the account with this payment; it does not call the customer a returning account holder.
3. The customer chooses either password creation or a secure login link. The first successful activation consumes the checkout activation marker; after requesting the login link, password creation from the same checkout link is no longer available.
4. The active replay retains the matching activation capability, so password creation succeeds instead of producing a false existing-account `409`.
5. After authentication, the customer opens the delivered plan; first access is recorded.

### Genuine existing customer after successful payment — separate follow-up

The current surface still offers both password creation and login link; the server defensively rejects an ineligible password attempt. A dedicated existing-account UI would be worthwhile, but it requires a separate product decision and `WelcomeClient` refactor. It is not needed to close this incident because production proof shows the affected account was created by fulfillment and should have remained password-eligible.

### Reload, second tab, and Back

1. Reloading or opening the result in a second tab recovers provider ownership from the server before mounting a competing provider.
2. If another tab completes the payment, returning to the older tab must not create or offer a second payment.
3. First Back while an open checkout owns its sentinel dismisses/confirms in place and preserves result/attempt identity; the next Back navigates normally.
4. The implementation changes history code only after this exact sequence fails the browser harness. A successful payment reconciles the old warning operationally even when an abandoned tab cannot receive a synchronous success event.

### Important recovery variants

- network loss during status check: calm `pending` retry, no success/failure claim;
- user cancels PayPal: ordinary cancellation, same as today;
- expired order: existing terminal support block; no reset/retry path is claimed in this scope;
- payment captured but access takes longer: existing pending screen and email/support fallback;
- revoked purchase: no access opening; explicit support state;
- authenticated matching user: automatic canonical redirect, no activation choice.

Completion means the customer can open the purchased plan without retrying payment or discovering an account rule through an error.

## Planning evidence

- [`plans/evidence/payment-recovery-hardening/recovery-states.html`](./evidence/payment-recovery-hardening/recovery-states.html) — rendered real-layout approximation of the current mobile checkout sheet and welcome surface.
  - Question: what should replace the red PayPal error, how should unconfirmed payment remain visibly pending, and how should the affected checkout-created account activate?
  - Proposed direction: one calm pending state with no green signal before `active`, preservation of the same PayPal attempt without guessing the provider sub-state, and preserved new-account password capability after webhook/replay.
  - Feedback incorporated: Nick rejected the green check beside `Noch keine Zahlung bestätigt`, required pending to remain visibly pending, and challenged the unsupported assumption that the affected customer had a pre-existing account. The mockup and state contract now reflect the production proof.
  - Evidence-review status: **confirmed by Nick on 7 August 2026**.
  - Artifact disposition: **commit** with the implementation plan; production code must recreate the approved behavior using existing components.

No runnable prototype is required: the consequential state transitions can be proven by deterministic component/API/browser fixtures, while the hierarchy and copy are reviewable in the rendered mockup.

## Ordered tasks

### 1. Slice A: preserve checkout-created account capability across active replay

**Consumes:** active activation results containing `email`, `canSetInitialPassword`, and the server-resolved `CheckoutFirstTimeDestination`.

**Work:**

- Write the webhook-first replay regression before code changes: fulfillment creates a new auth account, active recovery replays it, and the matching activation remains eligible for one password initialization.
- Expose the existing PayPal-specific capability function to replay with a Supabase/user/token signature; fresh account creation keeps its current `created.created` fast path. Do not change the separate Stripe helper or `set-checkout-password` guard, whose raw/prefixed activation inputs differ.
- Thread `intent.token` into `loadActivePayPalOneTimeAccountFromReplay`; replace its hard-coded `canSetInitialPassword: false` with the PayPal capability result. Catch auth-admin lookup errors at the replay boundary and return `false` so the paid welcome renders instead of throwing to support. Assert fresh and replay keep `checkoutContext: null`.
- Do not equate “fulfillment already created an auth row” with “customer already had an account.”
- Preserve `set-checkout-password` defensive `409` behavior and privacy-safe Sentry context for impossible/direct calls.
- Replace only the literal assertion in `tests/paypal-orders.test.ts` test `PayPal active replay reconstructs an existing account instead of throwing` (currently around line 1292); do not alter the unrelated `canSetInitialPassword: false` stub fixture around line 974. Add behavior-level replay success/ineligible/admin-error/null-context cases. Keep the unrelated current-welcome-choice test unchanged.

**Produces:** a replay-safe use of the existing PayPal capability helper and an active-replay account result that matches fresh-path outcomes for capability/lead/null-context without changing the fresh call path.

**Tests:** `tests/paypal-orders.test.ts` active-replay capability, admin-read-failure → false, intentional null-context parity, and replacement of the named source-shape assertion; `tests/auth-post-checkout-routes.spec.ts` webhook-first PayPal password success plus subsequent/foreign `409`; existing fresh PayPal and Stripe password-activation tests remain green unchanged.

**Complete when:** the exact incident sequence retains new-account capability after webhook-first fulfillment, accepts one password initialization, and still rejects subsequent/foreign initialization attempts without changing destination behavior.

### 2. Slice B1: add a deterministic PayPal SDK recovery controller

**Consumes:** existing `OneTimeActivationStatusResponse`, fulfillment-job claim idempotency, existing welcome URL construction, current PayPal order reuse/idempotency, and the mounted PayPal button.

**Work:**

- Write failing pure Node tests first for: `onError` with a token → neutral pending → `active`; pending after absolute 0/3/7-second offsets and the eight-second deadline; `paid_pending`; `failed_permanent`/`revoked` navigation; non-OK/network/`429`/`503` staying neutral; hidden sheet; unmount; late/duplicate callbacks; and no-client-token start uncertainty.
- Extract the reducer/timer/navigation decisions into a pure exported `src/lib/checkout/paypal-one-time-recovery.ts` module testable with the existing `node --test`/fake-clock style. Wire it into `PayPalOneTimeButton`; prove effects, visual copy, and actual PayPal-control availability in the exact Chromium Playwright journey. Do not add jsdom/testing-library dependencies and do not modify the status route or PayPal verification/fulfillment code.
- Extract the two inline one-time PayPal welcome URL template literals from `capture-order/route.ts` into one encoded helper and reuse it for recovery navigation; do not duplicate the URL shape in client code.
- After token receipt, `onError` enters neutral status recovery instead of setting the current red message. Pending remains pending after the automatic window with a cooled-down `Status erneut prüfen`; the functional mounted PayPal button stays available without a custom reopen label or provider-substate claim.
- Before token receipt, treat the error as start uncertainty because the server may have persisted the order. If the PayPal button is still functional, the next normal click reuses the same checkout attempt; otherwise retain current neutral/support guidance. Do not invent an SDK reload/reset path in this slice, never enable another provider, and never call status without a token.
- Persist one `funnelEventId` per checkout attempt and reuse it across same-attempt button remount/retry so the server `funnel_events` row is deduped; current client PostHog provider-start dedupe remains unchanged.
- Emit one privacy-safe `paypal_sdk_onerror` warning with callback phase, token-present, release, browser family, viewport class, standalone/WebView hint, and recovery outcome; never raw message/stack, provider references, email, or tokens. Do not pretend this classifies the discarded SDK cause.
- Accept deployment revert as the only B1 kill-switch; `NEXT_PUBLIC_PAYPAL_ENABLED` is build-time and disables PayPal entirely, so it is not described as a recovery-controller kill-switch. Adding a runtime flag is deferred under the repo's no-over-engineering rule.

**Produces:** a pure client-only `PayPalOneTimeRecoveryState` (`idle`, `checking`, `pending`, `navigating`) and lifecycle transitions (`recovery_started`, `recovery_pending`, `recovery_pending_access`, `recovery_succeeded`, `recovery_revoked`). Expired create/capture support remains the existing separate component branch.

**Tests:** pure reducer/controller tests under `node --test` cover every state, absolute timers, hidden/unmount cancellation, and navigation races; a Chromium Playwright fixture proves component wiring, visible copy/icons, functional PayPal control, manual status check, stable attempt/funnel identity, and one navigation. Keep `tests/one-time-activation-status-route.test.ts`, fulfillment-retry, webhook, operator-recovery, and PayPal order-validation suites green unchanged; they are regression gates, not refactor targets. The combined overlay/welcome fixture asserts exactly one account/entitlement activation, plan fulfillment, confirmation send, `funnel_events` checkout-start row, and navigation.

**Complete when:** the reproduced first-attempt incident never shows a red terminal failure or green success before `active`, keeps the same functional PayPal control visible when available, redirects once on server success, and cannot create a second attempt/order or duplicate funnel row.

### 3. Independent Slice B2: resolve provider ownership before Stripe Elements mounting

**Consumes:** existing prepare response and `getPreparedCheckoutControlOutcome`.

**Work:**

- Replace the existing overlapping lock/recovery booleans with one parent-owned exhaustive preparation union (`loading`, `ready`, `provider_locked_paypal`, `provider_locked_stripe`, `unavailable`) before rendering `CheckoutElementsProvider`; do not retain `StripeControlRecovery` as a parallel state source.
- Put the response-to-union decision in a pure Node-testable helper; prove actual Elements/PayPal mounting and the reviewed ownership copy in the Chromium browser fixture rather than adding a DOM test framework.
- Pass a resolved client secret to Stripe Elements only for `ready`; never pass a promise known to reject for an expected control outcome.
- For PayPal ownership, mount PayPal only and present the reviewed ownership explanation. For Stripe ownership, do not create/mount PayPal.
- Keep preparation token/session identity stable across hide/reopen. Preserve current Apple Pay readiness once Stripe is the owner or no owner exists.
- Remove the raw `prepared_checkout_control:provider_locked` throw and its Sentry path.
- Before Slice C removes the server Sentry capture, add the missing client lifecycle/control-outcome event for `provider_locked_paypal` (the Stripe-lock branch already emits one) and prove both lock directions remain observable without payment-failure exceptions.

**Produces:** `PreparedStripeCheckoutState` consumed by the one-time checkout renderer; no public API expansion unless required by a red test.

**Tests:** pure Node tests for all preparation-union transitions plus Chromium wiring assertions that a provider-locked branch never mounts Elements, never calls provider-load-error, never captures a payment failure, shows the reviewed `Dieser Zahlungsversuch läuft bereits über PayPal…` explanation, and leaves the owning provider usable.

**Complete when:** a reload over an existing PayPal order shows usable PayPal and no client/server payment error, rejected client-secret promise, or competing provider CTA, and both provider-lock directions have privacy-safe lifecycle evidence available before Slice C changes Sentry routing.

### 4. Slice B1: reproduce and close the reload/redirect/history edge

**Consumes:** the real checkout history sentinel, fake provider endpoints, the checkout-created new-account fixture, and two browser pages when required.

**Work:**

- Add the deterministic Chromium/mobile-viewport sequence to the existing `tests/offer-payment-overlay.spec.ts`; this file is already in the `webkit-mobile-action` project's explicit `testMatch` if a later WebKit run is required.
- Reuse/extend the synthetic PayPal SDK pattern in `tests/personal-plan-offer-motion.spec.ts` to fire `options.onError`; run the worktree dev server explicitly with `npm run dev:worktree` because Playwright has no configured `webServer`.
- Assert path, visible surface, history state, attempt/open index, create-order/capture counts, and lifecycle events after reload, same-tab return, second tab, Back, forward-cache restoration, and a downward swipe beginning on an interactive recovery control at scroll-top.
- If the test proves a sentinel/restore or interactive-control swipe defect, change only the smallest history/dismissal seam, then add focused WebKit/mobile coverage and rerun the established basic Back suite.
- If the exact sequence is green, do not change history code; retain the regression and treat the live navigation event as an old-tab/monitor reconciliation case.
- Assert that a confirmed payment emits exactly one terminal-success lifecycle event for the active attempt before the single navigation, and that no later degraded event is emitted for that attempt. Document that another tab cannot be synchronously mutated without adding cross-tab payment state.

**Produces:** an exact browser regression and either a minimal history fix with a red/green proof or an evidence-backed no-change decision.

**Tests:** existing `offer-checkout-history`, overlay, bottom-sheet dismissal, checkout-attempt, and result-offer tracking tests plus the new Chromium flow. Run/add the `webkit-mobile-action` flow only if Chromium reproduces a product defect or a shared history/dismissal seam changes.

**Complete when:** first Back cannot dump an open checkout into the cleared quiz, second Back remains normal, and successful payment cannot lead to a duplicate order from a reloaded/older surface.

### 5. Slice C: align signals and alerts with customer/payment truth

**Consumes:** the closed control outcomes, recovery lifecycle, purchase/access reconciliation, and existing payment monitoring runbook.

**Work:**

- Stop creating Sentry payment exceptions for expected provider locks/access conflicts; retain bounded PostHog lifecycle data.
- Keep one privacy-safe warning for unresolved PayPal SDK recovery, tagged only with phase/token-present/outcome and deduped per attempt.
- Define and test a paid-but-access-blocked monitor condition using server payment plus access truth and a grace period; this is the incident that should have escalated here.
- Update runbook queries and closure rules to reconcile client warning, provider/webhook, purchase, entitlement, delivery, and first access.
- Specify the external Sentry workflows precisely: immediate provider/webhook/integrity failures; three unique unrecovered structural attempts in ten minutes; no provider-lock/access-conflict volume; paid-but-access-blocked after grace. If Sentry cannot express privacy-safe unique-attempt aggregation, the chosen fallback is issue routing plus a scheduled privacy-safe aggregate; do not weaken dedupe or page on raw event volume.
- Verify actual workflow filters after an authorized production change; record a screenshot/receipt outside the code PR if operational policy requires it.

**Produces:** corrected code signal routing, behavior-level observability tests, updated runbook, and an external rollout checklist.

**Tests:** `tests/payment-observability.test.ts`, `tests/payment-server-observability.test.ts`, Stripe route contract tests, one-time payment integrity/runtime fixtures, plus a test proving one recovered journey cannot generate multiple alert-eligible failures.

**Complete when:** the incident yields one recoverable SDK warning and one paid-access-blocked escalation—not six payment-failure issues—and real provider/webhook/integrity failures remain alertable.

### 6. Integrate, verify, and review each slice independently

**Consumes:** slices A-C and their test artifacts.

**Work:**

- Run literal focused commands after each slice, then the repository aggregate gate:
  - node suites: `node --import ./tests/server-only-register.cjs --import tsx --test <focused .test.ts/.test.tsx files>`; final aggregate `npm run test:node`;
  - auth contract: `npx playwright test tests/auth-post-checkout-routes.spec.ts --project=chromium`;
  - start the test server with `npm run dev:worktree`, then run `npx playwright test tests/offer-payment-overlay.spec.ts --project=chromium`; if Task 4 finds/fixes a shared history/dismissal defect, rerun the same file with `--project=chromium --project=webkit-mobile-action` (that file is already matched by both projects);
  - repository verification: `npm run ci:verify`.
- Run the repo-provided Codex `ready-check` and `request-code-review` skills within `implementation-loop` for each unchanged review head; these are workflow skills, not npm scripts.
- Codex remains the implementation orchestrator. Claude is the read-only counterpart reviewer; no Claude subagent is expected to invoke Codex-side repository skills.
- Obtain the required read-only Claude whole-branch review before any push of meaningful checkout behavior.
- Keep Slice A deployable without Slice B, and Slice B deployable without external Sentry workflow mutation.
- Stop before commit/push/PR unless `ship-it` is explicitly authorized; stop before deployment, production workflow mutation, real payment, customer contact, or data repair unless separately authorized.

**Produces:** review-ready slice receipts with exact test, browser, and risk evidence.

**Complete when:** every slice is independently green, reviewed, rollback-capable, and its artifacts are classified.

## Verification

### Automated checks

- Red/green behavior tests for checkout-created-new versus genuinely-existing account welcome rendering, including webhook-first active replay.
- PayPal SDK race matrix: dropped response before client token, SDK load/render unavailable, after-token pending-to-active, pending boundary, `paid_pending`, existing terminal status, create/capture expiry `409`, cancel, hidden sheet, unmount, duplicate callback, and network/rate-limit failure.
- Visual/DOM contract: no green check or success language before `active`; pending never claims which PayPal step is missing; functional PayPal control and status-check behavior match the reviewed evidence.
- Exactly-once assertions for consent, order, capture, analytics `checkout_started`, redirect, and access.
- Provider ownership matrix across no owner, PayPal owner, Stripe owner, expired owner, same-attempt hide/reopen, reload/new attempt.
- History matrix across explicit close, backdrop, Escape, drag, first Back, second Back, reload, bfcache, same-tab return, and two-tab completion.
- Observability assertions for signal, severity, safe tags/context, fingerprint, dedupe, feature/runtime flags, and absence of raw errors/capabilities.
- Existing webhook, purchase, activation, entitlement, delivery, and payment-integrity suites.
- Slice gates: the literal focused commands above; final unchanged head runs `npm run test:node`, the named Playwright commands, `npm run ci:verify`, and repo `ready-check`.

### Manual/browser checks

- Review the approved mobile states at 360×650 and 390×844 plus desktop welcome at ≥1024px.
- With provider calls stubbed and writes blocked, replay the exact production journey and inspect visible state after every transition.
- Inject `onError` before/after token receipt, network/rate-limit responses, and late `onApprove` in Chromium/mobile viewport. Add WebKit only if a shared browser/history/dismissal seam changes. The acceptance criterion is not “PayPal can never fail”; it is “the warning preserves phase/token/outcome, server truth is reconciled when a token exists, and the journey leaves one safe next action without a second order.”
- Verify keyboard/focus/ARIA live behavior for reconciliation, error, and sent-link states; reduced-motion spinner behavior; reload and Back.
- Verify new and existing accounts for Stripe and PayPal one-time; subscription paths receive a smoke regression because they share `WelcomeClient`.

### Migration and live-state checks

- No migration expected; generated types must remain unchanged.
- Before deployment, confirm the reviewed head is based on fresh `origin/main` and inspect any concurrent checkout changes.
- Deployment verification is read-only first: release SHA, live route, Sentry release, PostHog lifecycle, and existing payment integrity monitor.
- Any controlled production payment must use the established internal-test identity and explicit real-charge authorization; verify capture, webhook, purchase, access, delivery, first access, and alert exclusion/refund policy.
- External Sentry workflow mutation and affected-customer outreach remain separate authorized operations.

### Evidence-sensitive review

- Nick reviews the rendered checkout/welcome mockup and confirms exact German copy/hierarchy.
- After Claude findings are reconciled, Nick confirms the designed journey in this plan.
- Implementation code review must reject any path that treats SDK state as provider truth, rotates a live PayPal order during recovery, exposes a capability, weakens defensive auth checks, or silences real provider/access failures.

## Rollout and rollback

1. **Deploy Slice A first.** It removes the current paid-access dead end without changing provider behavior. Verify new/existing account branches in a non-charging environment and watch `checkout_password_activation` for direct/legacy calls.
2. **Deploy Slice B1 second.** Use internal-test traffic and stubbed provider/browser verification before any real-charge test. Watch recovery lifecycle, PayPal GET latency/volume, checkout completion, order/capture uniqueness, and customer-visible error rate. B1 changes only client presentation/control; deployment revert is the explicitly accepted rollback because the build-time PayPal enablement is not a recovery kill-switch. Roll back B1 if pending duration, checkout completion, or duplicate protection regresses.
3. **Deploy B2 independently.** Verify replacement lifecycle events for both provider-lock directions before any later Sentry suppression.
4. **Observe one normal traffic window** before changing alert workflows. Roll back the Vercel deployment if checkout readiness, completion, duplicate protection, or activation degrades.
5. **Deploy and verify the paid-but-access-blocked monitor first, then apply Slice C workflow reductions separately.** Confirm filters against known historical incidents and one controlled non-production/internal-test event before removing `provider_locked_*`/`access_conflict` from the payment-failure channel or enabling replacement notifications.

Rollback is deployment-based. No schema or irreversible data write is introduced. If the PayPal recovery controller misbehaves, revert Slice B while retaining Slice A. Never clear order intents or provider locks as a rollback shortcut.

## Review findings ledger

Counterpart reviewer: Claude Code, seven plan/spec passes, Opus, effort `high`, read-only. Post-feedback reviews verified the incident root cause, then forced Slice A into a fail-closed PayPal-only hotfix and B1 into a pure-controller/client-only, non-terminal pending design; every accepted finding is reconciled below before the final evidence gate.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | `OneTimeActivationStatusResponse` cannot emit `expired`; expiry is the create/capture `409` path | accepted | removed expiry from poll contract and made the `409` source authoritative | source and plan search rechecked; second review confirmed |
| C2 | defect | `onApprove` and the new poller could both navigate | accepted | one single-flight navigation guard now spans both paths and aborts polling | race tests named; second review confirmed |
| C3 | tradeoff | 16 `WelcomeClient` sites make account-mode threading broad; four activation sites are redirect-only | superseded after production-history proof and fresh review | removed the prop/UI refactor from the incident hotfix; genuine-existing-account UX is a separate product follow-up | exact 8/8 split retained as evidence, no longer implementation scope |
| C4 | defect | new preparation union could drift beside existing lock/recovery booleans | accepted | union explicitly replaces/subsumes the existing state sources | source references rechecked; second review confirmed |
| C5 | defect | focused and aggregate verification commands were unnamed | accepted | literal Node, Playwright, WebKit, and `npm run ci:verify` commands added | package scripts and Playwright projects verified |
| C6 | tradeoff | Claude called workflow skills non-existent based on its environment | rejected | repo-local Codex `implementation-loop`, `ready-check`, and `request-code-review` are available and remain required; plan clarifies they are not npm scripts | repo skill inventory verified |
| C7 | defect | overlay plus welcome/manual polling needed an explicit 30-per-minute budget | accepted | the normal automatic path is at most 18 rate-limited status requests; reloads, multiple tabs, or manual checks can intentionally reach the shared limiter; manual checks are single-flight with a three-second floor and `429` stays neutral | route/poller/render paths verified; implementation measurement pending |
| C8 | defect | recovery sheet can intersect interactive-control swipe dismissal | accepted | exact downward-swipe assertion added to the browser/dismissal matrix; production behavior changes only if red | current bottom-sheet seam and existing mobile project verified |
| C9 | defect | second review proved the status endpoint can perform local activation/fulfillment writes and is not read-only | accepted | relabeled it activation-idempotent and named the fulfillment-job claim invariant | activation implementation and route rechecked locally |
| C10 | defect | combined polls need to prove exactly-once activation, fulfillment, entitlement, and confirmation | accepted | exact combined-poll assertions added to Task 2 | local source proves the job-claim seam; implementation test pending |
| C11 | tradeoff | fixed cadence versus exponential backoff/jitter | accepted fixed cadence | documented as a deliberate bounded human-facing choice | eight-second/30-per-minute budgets rechecked |
| C12 | defect | old tabs share the token/IP rate-limit bucket and rate limiting must remain non-terminal | accepted | concurrent-tab/reload contention added to tests; existing `429/503 -> pending` contract remains unchanged | route key/mapping verified locally; implementation test pending |
| U1 | product defect | revised mockup showed a green check beside `Noch keine Zahlung bestätigt` | accepted | replaced all unconfirmed substates with one neutral pending state; green is reserved for `active` | revised mockup and DOM assertions pending review |
| U2 | root-cause challenge | mockup assumed the affected customer had an existing account | accepted | production history proved one quiz and no prior account/purchase/subscription; plan now fixes replay capability instead of routing this incident to existing-account login | privacy-safe Supabase history and code path verified |
| U3 | architecture defect | current `pending` response cannot safely decide whether PayPal may be reopened | accepted, then simplified | do not decide: keep one neutral pending state and the mounted PayPal control; no custom reopen claim or server substate | current contract preserved; implementation red tests pending |
| C13 | blocker | new top-level statuses would make the existing welcome poller fall to `support_needed` | avoided by scope decision | B1 adds no status values or response fields | current consumer contract verified |
| C14 | blocker | renamed rate-limit status would terminalize the welcome poller | avoided by scope decision | preserve existing `{status: pending}` for `429/503`; both consumers reschedule | consumer/limiter verified |
| C15 | blocker | SDK reopen re-enters `createOrder` and currently creates a new funnel event ID | accepted | one funnel event ID persists per checkout attempt and is reused so server event-id dedupe preserves one `checkout_started` milestone | SDK API and route path verified; implementation test pending |
| C16 | suspected defect | active replay returns null `checkoutContext` | rejected after deeper verification | one-time fresh path also intentionally returns null and one-time order intents do not carry checkout context; removed from change scope and added parity assertion | fresh/replay sources verified |
| C17 | defect | current PayPal capability helper is private and has an incompatible dependency shape | accepted narrowly | export/rename it with a Supabase/user/token signature for PayPal fresh/replay only; Stripe and endpoint guards stay untouched | source/key conventions verified; implementation test pending |
| C18 | defect | schedule wording could mean cumulative delays, and an 8-second poll cannot share the exact 8-second deadline | accepted, then rate-hardened during implementation | chosen offsets are explicitly absolute 0/3/7 seconds from `onError`, followed by an 8-second deadline | useful final-response and 18-request budget tests rechecked |
| C19 | defect | Stripe preparation and PayPal recovery are independent mechanisms | accepted | split Slice B1 recovery/navigation from independently deployable B2 Stripe preparation/ownership | plan rechecked |
| C20 | risk | welcome reload can exceed the shared bucket; Slice C could recreate an observability gap | accepted | reduced overlay to three checks, added reload/rate-limit fixture, and required paid-access plus replacement lock lifecycle evidence before removing noisy outcomes | code budget and route routing verified; implementation/operations pending |
| C21 | blocker | incomplete-order classification would require new pre-capture binding validation | avoided by scope decision | removed provider-state classification/inspector from B1; existing verified-payment boundary is unchanged | no implementation action |
| C22 | blocker | provider-state design had no safe single-GET seam | avoided by scope decision | removed provider-state design and all status-route/verification changes from B1 | no implementation action |
| C23 | behavior change | terminal PayPal mapping would change timeout to immediate support | avoided by scope decision | preserve existing terminal/status behavior | no implementation action |
| C24 | blocker | a dropped create-order response can leave a server order while the client has no token | accepted | no-token state is start uncertainty; functional button retry or SDK remount uses the same attempt so existing server intent/order is returned | route ordering and intent reuse verified; implementation pending |
| C25 | blocker | removing Sentry capture would delete the only PayPal-lock signal | accepted | B2 must add `provider_locked_paypal` lifecycle evidence before C removes server capture; C is primarily workflow configuration | client asymmetry and observability sink verified; implementation/operations pending |
| C26 | blocker | a generic capability helper could double-prefix/break Stripe activation and missed a third Stripe copy | accepted | Slice A reuses only the PayPal helper for PayPal fresh/replay; Stripe helper and endpoint guard are explicitly out of scope and remain regression-gated | all key conventions/copies verified |
| C27 | blocker | full provider-state inspector increased blast radius, had config-failure risk, and left processing boundary open | accepted via narrower design | removed inspector, response field, access-state retype, and terminal remapping; B1 is client-only neutral pending | status/payment shared consumers remain unchanged |
| C28 | blocker | custom reopen/SDK reload CTA lacked implementation/evidence | accepted via scope cut | no custom reopen or SDK reload state; functional mounted control remains when available, otherwise current neutral/support guidance | no new CTA to implement |
| C29 | defect | shared verifier has fulfillment/password consumers keyed on exact error codes | avoided by scope decision | B1 does not modify verifier, fulfillment, webhook, operator recovery, or error codes; their suites are regression gates | source consumers verified |
| C30 | tradeoff | full WebKit/history matrix was disproportionate before reproduction | accepted | run exact Chromium/mobile repro first; add WebKit only if red or a shared seam changes | plan rechecked |
| C31 | blocker | no repo DOM harness could execute effect/timer/component race tests | accepted | reducer/timing/single-flight logic moves to a pure Node-testable module; Chromium proves React/PayPal wiring; no new test framework | repo test harness verified |
| C32 | blocker | plan claimed a nonexistent expired reset/retry path | accepted | contract/journey now name the current terminal support block and add no reset scope | component source verified |
| C33 | blocker | overlay `failed_permanent` could be confused with a provider decline | revised after implementation review | non-OK remains neutral; the explicit server terminal value navigates to the existing welcome/support resolver without claiming provider decline | terminal/non-terminal reducer tests pass |
| C34 | defect | planned SDK classifier/reload UI was speculative and unmocked | accepted | removed classifier taxonomy and reload state; retain one safe warning tag set only | plan/mockup rechecked |
| C35 | defect | welcome URL existed only as duplicated inline strings | accepted | extract one encoded helper shared by capture and recovery navigation | route source verified; implementation pending |
| C36 | behavior | magic-link activation consumes the password marker | accepted | journey now states password vs login-link is an exclusive first activation choice | auth route verified |
| C37 | blocker | replay capability lookup could throw and turn paid welcome into support | accepted | replay catches auth-admin read failure and fails capability to false; fresh path is unchanged | throw path verified; implementation test pending |
| C38 | blocker | planned WebKit command would match zero new tests | accepted | exact regression lives in existing `offer-payment-overlay.spec.ts`, already in both projects' match sets; dev server command is explicit | Playwright config verified |
| C39 | blocker | overlay referenced a nonexistent timeout/support path | accepted | overlay is non-terminal by design and adds no support state/copy; only existing expiry branch and revoked welcome route are terminal | component surfaces verified |

## Implementation receipt — 7 August 2026

Status: implemented and published in PR #337. A pre-merge CI failure exposed one additional cross-provider race; the correction and its follow-up activation-safety review are included in the final verified scope. Merge, deployment, production configuration, and customer/account writes remain separately gated.

- **Slice A:** active PayPal replay now derives initial-password capability from the matching server-owned activation marker. A webhook-created auth row therefore remains eligible for its one allowed password setup; initialized, foreign-token, and auth-admin-read-failure paths remain fail-closed. The existing endpoint `409` stays unchanged as the last defensive guard.
- **Slice B1:** PayPal SDK `onError` now enters a reducer-controlled reconciliation cycle against the existing activation-status authority at absolute offsets 0/3/7 seconds with an eight-second deadline, one in-flight request, stale-response rejection, a bounded manual recheck, and one navigation claim. Unconfirmed states use neutral copy and no success icon; a missing token leaves the mounted PayPal control usable and does not expose an inert status button.
- **Slice B2:** Stripe preparation control outcomes are parent-owned typed states before Checkout Elements mounts. PayPal and Stripe provider locks are rendered as explicit mutually exclusive recovery states; a Stripe preparation failure has a visible retry, expired preparation rotates its credential from a loading state, and a successful Stripe claim owns the attempt immediately.
- **Slice C:** the existing reconciliation surfaces now run a paid-but-access-not-active monitor after one-time fulfillment retry. It excludes internal-test traffic, reports privacy-safe provider/reason signals, treats local lookup failure, canonical-access contradiction, and a genuine scan/finding cap as monitor failures, and fails the route visibly when evidence delivery cannot be confirmed. It scans the oldest eligible purchases first with stable `(paid_at, id)` ordering, four bounded workers, a 200-row scan budget, and at most 50 findings; a one-row look-ahead distinguishes an exact-budget result from a genuinely partial scan.
- **History/dismissal:** the exact browser Back and payment-descendant swipe regressions stayed green. No production history implementation changed without a reproduced red defect.
- **Pre-merge CI race:** a PayPal order can claim the checkout attempt while the initial Stripe preparation request is still in flight. The older unclaimed Stripe response previously overwrote the PayPal-owned state and could re-enable card controls. A deterministic delayed-response browser regression proved the failure. The checkout now records provider ownership synchronously, ignores stale unclaimed Stripe readiness/failure after PayPal ownership, and still permits duplicate-access or genuine Stripe-owned server truth to override stale client state.

Review findings accepted during implementation:

- delayed the PayPal warning until recovery is genuinely unresolved and deduplicated `recovery_pending` lifecycle emission;
- converted Stripe preparation exceptions from an indefinite loader into a retryable control state;
- removed misleading/no-op controls when PayPal has no recovery token;
- moved the final automatic PayPal check to seven seconds so it does not collide with the eight-second deadline;
- made successful Stripe claims own the attempt, preserving Apple Pay/card provider exclusivity;
- tagged PayPal SDK warnings with live/internal-test dimensions;
- guarded nullable purchase metadata and surfaced the paid-access candidate cap;
- removed a redundant post-query grace filter after the database cutoff became authoritative.
- kept card checkout reachable when PayPal is disabled by rendering Stripe selection independently of the PayPal slot;
- made automatic Stripe preparation single-flight per preparation ID and stopped treating pre-claim card selection as provider ownership;
- gated paid-access findings through the same canonical per-user resolver the app uses, suppressing a losing purchase row when another row already grants active access;
- made the route the sole paid-access Sentry reporting owner so partial receipts fail closed without duplicate event emission;
- reset PayPal recovery state and token at each deliberate provider retry, and routed unresolved SDK recovery warnings through the typed warning-level `customer_payment_error_observed` signal.
- deferred any already-started recovery navigation while the checkout sheet is hidden, so neither a late SDK error nor a late status response can move the customer unexpectedly; the navigation is reclaimed only when the same sheet becomes visible again;
- treated the server-owned `failed_permanent` result as terminal by handing it to the existing welcome/support resolver instead of leaving the customer in an endless pending loop;
- bounded paid-access inspection to four workers, memoized canonical access resolution per user, and sequenced reconciliation work so rejected promises cannot become unattended.
- honored terminal PayPal status bodies before the HTTP-success gate, preserving neutral handling for ordinary non-OK responses while routing `failed_permanent` to the existing support resolver;
- guarded Stripe preparation writes and watchdog cleanup by checkout attempt and preparation generation, so a late response cannot clobber a newer payment surface;
- modeled Stripe `duplicate_access` as a successful existing-access control state, opened the login surface, and suppressed every live payment control instead of reporting a payment incident;
- made paid-access pagination deterministic and boundary-tested, retained the purchase-scoped finding for canonical contradictions, and added a safe provider/purchase correlation to the distinct `canonical_access_conflict` monitor signal and local trigger output.
- preserved the server-returned Chaarlie email in Stripe duplicate-access state so the existing-account dialog can prefill login instead of asking the customer to re-enter it;
- replaced the PayPal-owned banner's stale “close the payment there” instruction with continuation copy that stays true before and after SDK uncertainty;
- carried terminal PayPal recovery truth into welcome as a non-retryable return state, removing the dead-end manual status button while keeping support reachable;
- made a fresh successful server reconciliation override a stale terminal URL hint, so a concurrent recovery cannot strand a now-recoverable customer on support;
- added a safe payment-welcome lab plus browser journeys for pending PayPal recovery, genuine existing access, terminal support, new-account activation/magic-link choice, and an authenticated returning-customer handoff.
- kept the defensive `paypal_user_race_unresolved` account-visibility race retryable after verified capture, while preserving missing intent/consent and invalid payment truth as terminal support outcomes.

Final verification on the resulting source tree:

- `npm run test:node`: 2,728 tests passed, 0 failed;
- `npx playwright test tests/auth-post-checkout-routes.spec.ts --project=chromium --timeout=30000`: 36 passed;
- `npx playwright test tests/offer-payment-overlay.spec.ts --project=chromium --timeout=30000`: 32 passed;
- focused PayPal SDK uncertainty journey: 1 passed, including three bounded activation checks, one order intent, retained PayPal control, neutral pending copy, and one recovery warning;
- Stripe-enabled browser fixture: fresh card selection rendered after exactly one preparation request, selecting card retained the mounted PayPal option before claim, and the explicit switch-back control remained available;
- PayPal-disabled browser fixture: fresh card selection remained visible with no PayPal control and exactly one preparation request;
- simulated-user payment acceptance: 5 passed on the real checkout/welcome/profile components — neutral PayPal pending, existing-access login with email prefill and no payment controls, terminal support with no manual recheck, confirmed-payment activation plus one explicit magic-link request stub, and authenticated return into the app;
- `npm run ci:verify`: typecheck, lint, and production build passed; lint retained four unrelated pre-existing warnings and introduced no errors;
- exact GitHub-style production Playwright command after the provider-ownership fix: 115 passed, 3 skipped;
- focused delayed-Stripe/PayPal-ownership and terminal-recovery production browser checks: 2 passed, repeated three times for 6/6 stable passes;
- `git diff --check`: passed.

## Review and handoff

- Worktree: `.worktrees/payment-recovery-hardening-plan`
- Branch: `codex/payment-recovery-hardening-plan`
- Implemented scope: Slices A, B1, B2, and the code/runbook portion of C are integrated in this worktree for one whole-tree review. Production rollout and Sentry workflow mutation remain separately gated.
- Counterpart review: multiple read-only Claude Code passes ran at `high` effort. The final Opus whole-tree pass found no critical/high-severity defect and confirmed the provider-ownership correction. Its medium finding that `paypal_user_race_unresolved` could reach a non-retryable welcome state was accepted narrowly, fixed, and regression-tested; missing intent/consent remains terminal. Earlier stale-terminal-hint feedback was also fixed and regression-tested. Reconcile-ordering and preparation single-flight test-gap notes were rejected after verifying the existing explicit ordering and single-flight browser tests. Remaining defensive parsing and volume/latency observations are retained as bounded residual risks.
- Planning evidence: **commit**.
- Durable plan: **commit**.
- Claude review report: **discard after findings are reconciled** unless Nick explicitly requests retention.
- Browser screenshots produced only to review the mockup: **discard**; the HTML evidence remains authoritative.
- Production replay data and temporary investigation output: **discard/not retained**.
- Evidence review: **confirmed by Nick on 7 August 2026**.
- User-journey sign-off: **confirmed by Nick on 7 August 2026; implementation authorized**.
- Stop point: PR #337 may be merged only at the reviewed content fingerprint and after all checks on that exact head are green. Deployment, production configuration, payment, account repair, and customer contact remain separately gated.

### Residual risks

- PayPal SDK `onError` is explicitly documented by PayPal as a catch-all. The incident's raw error was discarded by current code, so its exact browser/SDK trigger cannot be reconstructed. Safe bounded diagnostics can narrow future causes, and server reconciliation prevents the callback from stranding the customer, but no merchant integration can guarantee that the external SDK never emits `onError`.
- The activation-status endpoint can perform idempotent local fulfillment after observing provider capture; correctness depends on the existing fulfillment-job claim and its exactly-once regression staying green.
- Old and active tabs share the token/IP activation-status rate-limit bucket. Rate limiting remains a calm pending state, and the two-tab fixture must prove the chosen schedule does not turn contention into a false failure.
- Provider ownership currently emerges through provider-specific routes. Refactoring Stripe preparation must preserve Apple Pay readiness and avoid claiming Stripe prematurely.
- The prepared-Stripe response parser trusts the same-origin route contract that every `recovered` response also carries `provider_locked: "stripe"` and a valid finite expiry. The current route does so; malformed/contradictory 2xx response hardening remains a low-severity defensive follow-up rather than a merge blocker.
- The final navigation event may be a multi-tab/stale-page sequence rather than a remaining sentinel defect. The plan deliberately requires red evidence before changing history.
- Sentry aggregate uniqueness/filter capabilities must be verified in the live project; if the workflow cannot express unique attempts safely, use issue routing plus a scheduled privacy-safe aggregate rather than weakening dedupe.
- The daily reconcile intentionally completes one-time fulfillment retry before starting integrity, entitlement, analytics, and paid-access branches so the monitor sees post-retry truth. The ordering is regression-tested, but its added front-loaded latency must remain within the route's 60-second budget at production volume.
- Paid-access finding fingerprints include the purchase ID for buyer-level remediation. A systemic outage can therefore create multiple Sentry issues; alert routing and volume thresholds must be checked during rollout rather than weakening the purchase-safe correlation.
- A magic link still depends on email delivery. New checkout-created accounts retain password creation; dedicated genuine-existing-account presentation remains a separate follow-up.
- The paid-access monitor deliberately scans at most 200 eligible rows and returns at most 50 findings per run. A genuinely incomplete scan or finding overflow is a visible monitor failure; if normal traffic approaches either threshold, batch/keyset or set-based lookup optimization is required before raising capacity. Offset pagination remains snapshot-dependent within one run, but the 72-hour window rechecks rows on the next run.
