# Apple Pay checkout prewarm

Status: Approved for implementation by Nick on 2026-07-29. This is a
performance addendum to `plans/2026-07-27-apple-pay-express-checkout.md`; it
does not change the approved payment hierarchy, withdrawal notice, prices, or
subscription flow.

## Outcome

On an Apple-Pay-capable device, the real Stripe Apple Pay button and the direct
PayPal button appear together when the offer payment drawer opens. The normal
path must not show PayPal first and insert Apple Pay later.

Live production diagnostics measured the current click-to-wallet sequence at
approximately:

- 1.83 seconds to create the Checkout Session;
- 2.60 seconds until Checkout Elements is initialized;
- 3.81 seconds until the Express Checkout Element reports Apple Pay available.

Stripe.js is already warmed before the click. The remaining delay comes from
creating the selected-plan Checkout Session and mounting the real Stripe
Checkout Elements/Express iframe after the user opens payment.

## Approved trade-off

For a capable device that reaches the offer pricing CTA, Chaarlie may create
one short-lived, incomplete Stripe Checkout Session for the stable selected
plan before the user presses `Jetzt starten`.

Preparation:

- does not charge the customer;
- does not create a subscription;
- does not open the Apple Pay sheet;
- does not send an email;
- does not count as a checkout start, payment-method selection, or marketing
  event;
- may leave an unused Stripe Session that expires if the user never opens
  checkout.

Nick explicitly accepted this trade-off on 2026-07-29.

## Chosen design

### Preparation trigger

Prepare only when all of the following are true:

1. the offer overlay and Express Checkout feature flags are enabled;
2. the browser exposes an Apple Pay capability signal;
3. the pricing CTA has entered the viewport;
4. the selected interval has remained stable for a short debounce;
5. the page is visible and no valid preparation already exists for that
   interval.

CTA pointer/focus intent may start preparation sooner, but it is only a
supplemental trigger because iPhone has no hover. Retry and React rendering must
reuse one in-flight preparation for the same logical key. Each plan/identity key
gets at most one automatic preparation attempt until the user explicitly leaves
that plan; leaving it clears the outgoing key so a later deliberate return can
prewarm again. A page-lifetime cap of four actual preparation requests limits
unused Stripe sessions across repeated plan toggles. Together these guards
prevent clock skew or an unusable response from creating an automatic retry loop
while preserving a useful retry after an intentional plan change.

### Prepared session contract

The create-session request gains a server-validated preparation mode that is
accepted only for the offer-overlay Elements presentation.

A prepared request:

- creates the same subscription Checkout Session payload as the real offer
  checkout, including automatic tax, identity, duplicate-access safeguards,
  line item, metadata, return URL, and excluded duplicate PayPal method;
- uses a stable idempotency key for the preparation key;
- sets expiry 31 minutes ahead, leaving a one-minute margin above Stripe's
  30-minute minimum;
- marks the Session as prepared/unclaimed in metadata;
- suppresses `checkout_started`, Customer.io, Meta, funnel milestones, touch
  attribution consumption, emails, and user-facing duplicate-access dialogs;
- returns the client secret plus the minimum opaque preparation reference
  needed to claim it.

When the user presses `Jetzt starten`, the client claims the matching
preparation. The claim validates interval, identity, presentation, status, and
expiry, associates the real `checkoutAttemptId`, records the genuine checkout
start exactly once, and consumes funnel attribution exactly once. A missing,
stale, mismatched, or failed preparation falls back to the existing click-time
session path.

Activation rejects every Session carrying preparation metadata unless it was
successfully claimed with valid preparation, checkout-attempt, and funnel-event
identifiers. Claim updates use a stable Stripe idempotency key so same-attempt
retries converge on one claimed Session.

Opening checkout captures any already-usable preparation and then
unconditionally invalidates the pending preparation generation. A response
that arrives after the CTA tap cannot replace the active checkout. Confirmation
against a prepared client secret is fail-closed unless the matching claim for
that checkout attempt has succeeded.

### Persistent Stripe element

Mount one Checkout Elements provider and its Apple-Pay-only Express Checkout
Element as soon as the prepared client secret is available. Keep it mounted in
the payment drawer subtree while the drawer is closed.

The closed subtree:

- preserves measurable Express geometry;
- uses visibility/inert/accessibility controls rather than `display: none`;
- does not register a modal layer, render a backdrop, trap focus, autofocus,
  or block the page while closed;
- mounts no Payment Element until the drawer is opened, so hidden preparation
  gives the wallet first use of the Stripe initialization path.

The same Express instance is revealed after the user opens payment. It must not
be remounted merely to move it into the visible drawer.

### Visible states

- **Prepared and Apple Pay available:** reveal the real black Apple Pay button
  and PayPal together in the already-approved hierarchy.
- **Preparation still pending after an unusually fast click:** retain the
  existing payment-loading treatment and reveal the provider choices together
  when eligibility resolves. Do not show a substitute Apple Pay button.
- **Apple Pay unavailable:** reveal PayPal first and the Stripe fallback below,
  with no empty Apple Pay gap or eligibility error.
- **Preparation/session failure:** keep PayPal usable, expose the current
  retryable Stripe error, and use the existing click-time retry path.

Changing the plan invalidates the mounted provider before the drawer can open
against the wrong price. Superseded prepared Sessions are discarded client-side
and expire automatically; correctness does not depend on active cleanup.

### Tracking semantics

| Moment                                         | Event                           | Routing                                         |
| ---------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| Prepared Session/Express element becomes ready | `checkout_prepared`             | Technical performance diagnostics only          |
| User presses `Jetzt starten`                   | `checkout_started`              | Real funnel and existing analytics destinations |
| User presses Apple Pay or PayPal               | `offer_payment_method_selected` | Provider/method selection diagnostics           |
| Payment succeeds                               | Existing purchase event         | Existing conversion and activation flow         |

Prepared diagnostics must use a preparation identifier rather than a real
`checkoutAttemptId` until claim time. They must not reach Customer.io, Meta, or
the business checkout funnel.

## Designed journey

Status: Nick approved the journey and trade-off on 2026-07-29.

1. An eligible customer reaches the pricing CTA with the default selected plan.
2. Chaarlie silently prepares the selected-plan Session and real Apple Pay
   element. The visible offer remains unchanged.
3. The customer presses `Jetzt starten`.
4. Chaarlie validates and claims the prepared Session, creates the real checkout
   attempt, and opens the existing drawer.
5. Apple Pay and PayPal are visible together. The withdrawal notice remains
   above them and the Stripe fallback remains below.
6. Pressing Apple Pay still opens the native sheet and requires explicit wallet
   authorization. Pressing PayPal still follows the direct PayPal flow.
7. Cancelling a wallet leaves the drawer usable; completing payment follows the
   unchanged Stripe/PayPal activation flow.
8. If the customer changes plan before opening payment, the old preparation is
   discarded and cannot be claimed for the new plan.

## Mockup evidence

The visible target remains the approved artifact:
`plans/mockups/2026-07-27-apple-pay-express-checkout.html`.

No new persistent copy or layout is introduced. The rare not-yet-prepared path
reuses the existing reviewed Apple Pay/payment loading treatment; the approved
steady state remains Apple Pay first, PayPal second, and Stripe fallback below.
Nick has also reviewed the current delayed production behavior on iPhone and
explicitly approved replacing it with the prewarmed journey above.

## Implementation slices

1. Add red route/session tests for preparation, idempotency, expiry, silent
   duplicate access, no funnel/marketing side effects, claim validation, and
   one real checkout start.
2. Implement the prepared-session and claim server contract without changing
   non-offer Checkout Session callers.
3. Add red client tests for capability/visibility/debounce gating, stable
   interval keys, cancellation, plan invalidation, and click-time fallback.
4. Add an opt-in keep-mounted payment drawer lifecycle and persistent
   Express-only preparation; defer Payment Element mounting until open.
5. Separate `checkout_prepared`, `checkout_started`, and
   `payment_method_selected` ownership and prove destination routing.
6. Add lab/browser coverage for ready-before-open, fast-click loading,
   unavailable Apple Pay, plan change, retry, focus containment, and flag-off
   rollback.
7. Run repository readiness checks and a whole-branch counterpart review.

## Verification and stop boundary

At minimum:

```bash
npm exec -- tsx --test \
  tests/stripe-checkout-session-params.spec.ts \
  tests/payment-method-checkout.test.tsx \
  tests/offer-payment-overlay.test.tsx \
  tests/result-offer-pricing-tracking.test.ts \
  tests/stripe-offer-elements-checkout.test.tsx
npm exec -- playwright test tests/offer-payment-overlay.spec.ts --project=chromium
npm run lint
npm run typecheck
npm run build
```

The exact implementation remains behind a default-off prewarm flag until
native iPhone Safari verification. This implementation authorization stops at
a locally verified, review-ready branch. Commit, push, PR, merge, deployment,
flag activation, Stripe Dashboard changes, and real payment attempts require
separate authorization.

## Independent review findings incorporated

- Optimizing the create-session endpoint alone cannot remove the remaining
  Stripe Elements/eligibility delay, so it is complementary rather than the
  primary fix.
- Creating the Session from render-time `useMemo` is unsafe for a persistent
  tree; preparation must be an explicit, ref-guarded effect/state machine.
- A prepared duplicate-access response must stay silent until explicit user
  intent.
- Availability deadlines must be anchored to drawer-open or remain recoverable
  after a long hidden mount.
- Persistent closed content must not activate modal/focus/backdrop behavior.
- The browser lab proves the kept-mounted payment child retains the same
  identity across closed, open, and closed-again states while remaining hidden,
  inert, roleless, backdrop-free, and non-blocking before open.
- Closing retains the modal layer and body lock through the exit animation;
  focus restoration happens only after the sheet is no longer visible.
- Stripe iframes must remain inside the drawer focus boundary when visible.
- Prepared-session activation is fail-closed: unclaimed preparation metadata
  cannot reach account or subscription activation.
- A paid-but-unclaimed prepared Session is captured as a high-signal terminal
  webhook diagnostic and acknowledged so Stripe does not retry permanently.
  Automatic refund, cancellation, email, or other financial remediation is
  intentionally outside this implementation and requires a separate decision.
- Late preparation responses are discarded after checkout opens, and prepared
  confirmation requires an identity-matched successful claim.
- Hidden Express stalls emit one technical `checkout_prepared` diagnostic with
  `walletAvailable: false` after ten seconds without removing the still-pending
  wallet element or preventing visible recovery.
- Stripe's 30-minute minimum expiry needs a server-time margin, so preparation
  uses 31 minutes rather than an exact boundary.
- Replacing Checkout Sessions with deferred custom subscription creation is
  rejected because it would rewrite tax, fulfillment, webhook, welcome, and
  duplicate-access behavior.
