# Apple Pay Express Checkout in the offer payment overlay

Status: Implemented and verified locally on 2026-07-27 from production PR
#245. The mockup, no-checkbox preserved-withdrawal policy, informational link
placement, and final designed journey are approved. The implementation remains
strict default-off; legal-copy consistency review is still a hard release and
flag-activation prerequisite.

## Outcome and source of truth

Make Apple Pay and the existing direct PayPal subscription button immediately
visible when a customer opens the quiz-result offer payment overlay. Keep
Stripe's remaining enabled payment methods directly below as the standard
fallback, without adding another click to reveal them.

This plan is based on:

- `origin/main` at `cf1ac8b8c4aca6bc5c735758655d1287eb134bed`
- merged production PR
  [#245, `feat(offer): add responsive payment overlay`](https://github.com/NickRuppy/hair_concierge/pull/245)
- the current Stripe SDKs already installed on that commit:
  `@stripe/react-stripe-js` 6.3, `@stripe/stripe-js` 9.4, and `stripe` 22.1
- Stripe's current Checkout Sessions custom Elements and Express Checkout
  Element documentation:
  - [Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element)
  - [Checkout Sessions Express Checkout guide](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=embedded-components)
  - [Checkout Sessions API and custom payment flows](https://docs.stripe.com/payments/checkout-sessions)
  - [wallet testing and domain registration](https://docs.stripe.com/testing/wallets)

These sources cover subscription mode, wallet eligibility, payment-method
display controls, domain registration, and the availability event. Stripe's
public prose still uses the older `custom` UI-mode name in places; the
repository's installed Stripe 22.1 generated types use the current `elements`
enum, so implementation must compile and test against the pinned SDK rather
than copying a stale enum from an example.

The implementation remains gated by the current offer-payment-overlay feature
flag and adds a second, default-off express-checkout flag. Activating either
flag in production, changing Stripe Dashboard configuration, registering a
production domain, or deploying is not part of the implementation handoff.

## Chosen direction

Use a dedicated Stripe Checkout Elements presentation only inside the
quiz-result offer overlay:

1. Render one Stripe `ExpressCheckoutElement` configured to expose Apple Pay
   only in the express slot.
2. Keep the current direct PayPal button immediately underneath it.
3. Render Stripe's `PaymentElement` below an `oder` divider for card and the
   other payment methods enabled for this Checkout Session.
4. Hide the complete Apple Pay row when Stripe reports that Apple Pay is
   unavailable. PayPal then moves to the first position with no empty space.
5. Keep all non-offer surfaces on the current `EmbeddedCheckout` path.

Nick's request already settles the architecture-driving product fork: Apple
Pay and direct PayPal must both be prominent above the standard Stripe
fallback. Enabling Apple Pay only inside today's Embedded Checkout would leave
it nested below PayPal, the divider, and the Stripe section, so it does not
satisfy this hierarchy.

The Express Checkout Element will use:

- `buttonType.applePay = "subscribe"`
- `paymentMethods.applePay = "auto"`
- `paymentMethods.googlePay`, `link`, `paypal`, `amazonPay`, and `klarna`
  set to `"never"` in this top element
- one full-width button row

The offer Elements Checkout Session must also exclude Stripe's own `paypal`
payment-method type so the direct PayPal integration cannot reappear a second
time inside the Payment Element. This exclusion is offer-Elements-specific;
the remaining Dashboard-managed Stripe methods stay eligible below.

Stripe controls final wallet eligibility and the native Apple Pay button.
Chaarlie must not show a substitute Apple Pay button or promise availability
on unsupported browsers, devices, countries, currencies, or unregistered
domains.

### Recorded UX decision: preserve withdrawal right without a checkbox

The reviewed target UI has no consent checkbox above Apple Pay, PayPal, or the
Stripe fallback. Payment-method choice must remain separate from the
subscription's withdrawal treatment.

Nick chose to preserve the statutory 14-day withdrawal right and not rely on
an immediate-loss declaration. The overlay shows one quiet, non-blocking line
before the payment choices:

> Es gilt das gesetzliche 14-tägige Widerrufsrecht. Details ansehen

`Details ansehen` links to `/widerruf`. The complete information remains in the
withdrawal notice and contract-confirmation email. Before enabling this flow
for customers, a focused legal-copy pass must reconcile the AGB, `/widerruf`,
confirmation email, and existing Stripe copy with this policy. The default-off
implementation must not silently rewrite those legal documents. If that review
requires an explicit early-start request or another approval, stop and revise
the journey rather than reintroducing a checkbox as an implementation detail.

### Alternatives considered

#### A. Add Express Checkout beside the existing Embedded Checkout

Easier visually, but not viable: an Express Checkout Element and Embedded
Checkout cannot share the current session/presentation contract. It would
create two Stripe checkout lifecycles in one overlay and complicate
provider-lock, retries, legal consent, and tracking.

#### B. Replace Embedded Checkout everywhere with custom Elements

Creates one Stripe architecture across pricing, quiz offer, and membership
reactivation, but greatly expands regression risk and scope. It would touch
successful payment flows that did not request this UX change.

#### C. Offer-overlay-only custom Elements (selected)

Keeps the requested experience isolated to the reworked PR #245 surface. It
adds a controlled second Stripe presentation while preserving the known-good
Embedded Checkout path everywhere else. The residual cost is maintaining two
Stripe presentation adapters.

## Scope and non-goals

### In scope

- the enabled quiz-result offer payment overlay from PR #245
- Apple Pay eligibility, rendering, confirmation, cancellation, and error
  recovery through Stripe
- the existing direct PayPal button and provider lock
- Stripe Payment Element fallback methods
- live Checkout Session total/cadence display for custom Elements
- current subscription identity, duplicate-access checks, return routing,
  automatic tax, metadata, analytics, Meta semantics, and retry lifecycle
- focused component, route-contract, analytics, and responsive browser tests
- test-mode and release-preflight documentation

### Non-goals

- changing PayPal to Stripe's PayPal payment method
- adding Google Pay or another wallet to the prominent express area
- redesigning the overlay shell, plan selector, success route, or account
  activation
- migrating pricing-page or membership-reactivation Embedded Checkout
- changing prices, billing intervals, Stripe products, or PayPal plans
- enabling flags, changing live Stripe Dashboard settings, deploying, or
  performing a real charge

## Target map and ownership

### Shared Stripe session construction

- `src/lib/stripe/checkout-session-params.ts`
  - introduce an explicit presentation input, for example
    `"embedded_page" | "elements"`
  - retain the current default for all callers
  - keep shared line-item, subscription, identity, automatic-tax, metadata, and
    return-url fields in one deterministic builder
  - set `excluded_payment_method_types: ["paypal"]` only for the offer Elements
    session, preventing a duplicate of the direct PayPal integration
  - after withdrawal-contract confirmation, omit both the current
    immediate-loss `custom_text` and `consent_collection` for
    `ui_mode: "elements"`; do not change the existing Embedded Checkout branch
    in this payment implementation
- `src/app/api/stripe/create-checkout-session/route.ts`
  - accept only a server-validated offer-overlay Elements request
  - authorize it from existing source/context fields rather than a generic
    client-controlled UI mode
  - return the Checkout Session client secret through the current retry and
    duplicate-access path
  - leave pricing/reactivation behavior unchanged

### Offer-specific Stripe presentation

- add a small component under `src/components/checkout/`, tentatively
  `stripe-offer-elements-checkout.tsx`
  - import the Checkout Sessions React bindings from
    `@stripe/react-stripe-js/checkout` and own `CheckoutElementsProvider`
  - render `ExpressCheckoutElement`, `PaymentElement`, the live total, the
    paid-submit button, and local Stripe errors
  - read Apple Pay eligibility from the Express Checkout Element `onReady`
    event's `availablePaymentMethods`
  - call `checkout.confirm({expressCheckoutConfirmEvent})` for Apple Pay
  - call `checkout.confirm()` for the Payment Element submit
  - prevent double confirmation and expose the current provider lock
- `src/components/checkout/payment-method-checkout.tsx`
  - select the new component only when
    `presentation === "offer-overlay"` and the new flag is enabled
  - preserve direct PayPal and current non-overlay Embedded Checkout
  - keep the current Embedded Checkout as rollback behavior when the flag is
    off
- `src/components/quiz/result-offer-pricing.tsx`
  - request the Elements session only for the flagged offer overlay
  - keep `checkoutAttemptId`, retry key, locked-provider, duplicate-access,
    close confirmation, and focus restoration unchanged

### Analytics contracts

- `src/lib/analytics/events.ts` and the current offer analytics bridge
  - retain billing provider as `"stripe"` for Apple Pay
  - add a Stripe payment-method dimension such as `"apple_pay"` rather than
    inventing Apple as a second provider
  - record method selection/confirmation once from the real Express Checkout
    event
  - keep PayPal as provider `"paypal"`
- preserve the PR #245 Meta contract:
  one explicit `Ja, jetzt starten` action owns one `InitiateCheckout` for one
  `checkoutAttemptId`
- mounting the Stripe session, wallet eligibility updates, and Payment Element
  initialization remain internal diagnostics and must not fire another Meta
  `InitiateCheckout`

### Configuration and release notes

- add a documented, default-off flag such as
  `NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED`
- document required Stripe test/live domain registration and HTTPS
- add a read-only preflight that records which fallback methods the active
  Stripe Payment Method Configuration exposes; do not hard-code illustrative
  methods from the mockup
- document the two-flag rollback: disabling the express flag restores the
  current PR #245 Embedded Checkout without reverting code

## Designed journey

Status: Explicitly approved by Nick for implementation on 2026-07-27.

### Eligible Apple Pay customer

1. The customer selects a plan and presses `Ja, jetzt starten`.
2. The existing responsive payment sheet opens, takes focus, locks background
   scroll, and displays the selected plan and current session-backed total.
3. A quiet linked notice states that the statutory 14-day withdrawal right
   applies; it does not require confirmation.
4. Apple Pay appears as the first full-width action; the direct PayPal button
   appears immediately below.
5. Pressing Apple Pay opens the native Apple Pay sheet. Stripe owns wallet
   authentication and confirms the subscription Checkout Session.
6. Success uses the current Stripe return route and account-activation flow.
7. Cancelling the native sheet leaves the overlay open and usable, without
   creating a second checkout attempt or Meta event.

### Apple Pay unavailable

1. Stripe reports no Apple Pay method for the browser/device/session.
2. The Apple Pay area is removed, including its spacing and helper copy.
3. PayPal becomes the first action.
4. Card and the remaining enabled Stripe methods remain available below.
5. No error is shown merely because Apple Pay is ineligible.

### Stripe fallback

1. The customer selects card or another method in the Payment Element.
2. Stripe collects only the billing details required for that method and
   automatic tax.
3. The app displays the live session total and a German payment-obligation
   submit label, for example `Kostenpflichtig abonnieren · 34,99 €`.
4. Submission is disabled while confirming. A retryable failure keeps entered
   state where Stripe permits and shows one actionable error.

### PayPal

1. The customer presses the existing direct PayPal button.
2. Current PayPal provider-lock, popup, subscription, account-activation,
   cancellation, and retry behavior stays intact.
3. Once one provider is confirming, the other provider controls cannot start a
   parallel attempt.

### Overlay exit and recovery

- before provider confirmation, `Plan ändern` and close use the current PR #245
  behavior
- once payment state would be discarded, the existing confirmation boundary
  remains
- session creation failure leaves PayPal usable where possible and offers the
  current Stripe retry
- duplicate-access detection keeps the current dialog and redirects
- reopening after a confirmed abort creates the next logical
  `checkoutAttemptId`; a wallet cancellation does not

## Mockup evidence

- Review artifact:
  `plans/mockups/2026-07-27-apple-pay-express-checkout.html`
- Based on the actual PR #245 overlay lab at
  `/labs/offer-page?variant=payment-overlay`
- Includes:
  - mobile and desktop shell states
  - eligible and unavailable Apple Pay states
  - Apple Pay first, direct PayPal second, Stripe fallback below
  - current German plan and paid-submit copy
  - no withdrawal-consent checkbox in the payment-method UI
  - the approved non-blocking withdrawal-information link before payment
    choices

Status: Approved by Nick on 2026-07-27, including the mobile near-full-height
sheet, Apple Pay/PayPal hierarchy, Stripe fallback, and no-checkbox UI.

## Ordered implementation tasks

### 1. Lock the legal/session contract with red tests

- add builder tests proving the existing embedded session is byte-for-byte
  unchanged for current callers
- add a custom Elements session case for a quiz-result offer subscription
- assert that only the Elements session excludes Stripe PayPal
- assert line item, interval, customer identity, automatic tax, metadata,
  return URL, and duplicate-access semantics
- record the approved preserved-withdrawal policy before coding
- add a red Elements-session assertion that `custom_text` and
  `consent_collection` are absent only after that decision; keep the existing
  Embedded Checkout session contract unchanged in this task
- make a Stripe test-mode session in an implementation-only local spike to
  validate the exact server payload before UI integration

Acceptance: both session presentations are explicit, the old route contract
does not drift, and no legal text disappears as an accidental SDK consequence.

### 2. Add the offer-only Checkout Elements adapter

- add the provider/component using the already-installed Stripe packages
- render Apple Pay-only Express Checkout with the selected display controls
- hide the express container until `onReady`, then reveal it only when Apple
  Pay is available, without reserving a layout gap
- render Payment Element and an app-owned submit path
- derive and display total/currency/recurrence from the Checkout Session, not
  only the locally selected plan
- update every app-owned amount label from the Checkout Session after billing
  or wallet address changes so automatic tax cannot leave a stale paid-submit
  amount
  - handle loading, confirming, wallet cancellation, retryable error, and
    non-retryable error states accessibly

Acceptance: a component test can drive Apple eligible, Apple unavailable,
wallet cancel, wallet confirm, fallback confirm, and double-click prevention.

### 3. Integrate without changing other checkout surfaces

- gate the adapter behind both offer overlay and express flags
- reuse the current client-secret fetch, retry key, identity, return
  destination, and provider lock
- leave the existing Embedded Checkout branch unchanged for default
  presentation, pricing, reactivation, and express-flag-off
- keep PayPal in its current direct integration

Acceptance: existing payment-method and reactivation tests pass unchanged,
apart from intentional test harness additions.

### 4. Extend analytics at payment-method grain

- add Apple Pay method metadata to Stripe selection/confirmation diagnostics
- prove that wallet availability does not count as a customer selection
- prove wallet cancellation does not create a new logical checkout attempt
- prove one CTA action still generates one Meta `InitiateCheckout`
- retain current PayPal event ownership

Acceptance: analytics tests reject duplicate Meta and duplicate method
selection events.

### 5. Expand the safe overlay lab and browser coverage

- add deterministic Apple-eligible and Apple-unavailable lab fixtures without
  real Stripe or PayPal
- verify mobile sheet and centered desktop modal at the existing PR #245
  viewports
- cover keyboard order, focus containment/restoration, scroll lock, close/plan
  confirmation, provider lock, and error recovery
- assert that the Apple row has no residual gap when unavailable
- assert that fallback methods remain visible without a reveal click

Acceptance: overlay Playwright coverage passes on Chromium fixtures; real
Safari/iPhone Apple Pay is covered separately in release preflight because
browser automation cannot authenticate the native wallet sheet.

### 6. Test-mode and production preflight

- verify the test domain is registered for wallet payments
- verify Apple Pay on a supported Safari/macOS and Safari/iPhone device with a
  real wallet-capable test setup
- verify Apple is hidden on an unsupported browser and PayPal/card remain
  usable
- verify a subscription, cancellation, failed confirmation, duplicate access,
  automatic-tax address change, and return route
- inspect Stripe Dashboard events and internal analytics for one attempt and
  one Meta `InitiateCheckout`
- record active fallback methods in test and live Payment Method
  Configurations
- repeat domain/config checks in live mode before flag activation

Acceptance: evidence is captured for both eligibility branches and all current
payment paths before any production flag change.

## Verification

Run, at minimum:

```bash
npm exec -- tsx --test \
  tests/stripe-checkout-session-params.spec.ts \
  tests/payment-method-checkout.test.tsx \
  tests/offer-payment-overlay.test.tsx \
  tests/result-offer-pricing-tracking.test.ts \
  tests/reactivation-checkout-metadata.test.ts
npm exec -- playwright test tests/offer-payment-overlay.spec.ts --project=chromium
npm run lint
npm run typecheck
npm run build
```

The implementation loop must add the focused analytics assertions to
`result-offer-pricing-tracking.test.ts` or a new narrowly named test file, then
include it in the first command.

Manual verification matrix:

- mobile Safari/iPhone: Apple eligible, confirm, cancel, retry
- desktop Safari/macOS: Apple eligible, confirm, cancel
- Chrome without Apple eligibility: no gap; PayPal and fallback available
- PayPal: success, popup cancel, provider lock, retry
- Stripe fallback: card success/failure and each enabled non-card method
- automatic-tax address changes: live total remains accurate
- close, plan change, duplicate access, and return focus
- express flag off: exact PR #245 Embedded Checkout behavior
- offer overlay flag off: current inline fallback behavior

## Review and handoff

- plan-hardening status: complete
- mockup review: approved by Nick on 2026-07-27
- checkbox UX decision: recorded; no checkbox in the target payment UI
- withdrawal policy and link placement: approved by Nick on 2026-07-27
- counterpart plan review: complete; verdict was `Re-shape first`, then
  `Approve with revisions`
- designed-journey sign-off: approved by Nick on 2026-07-27
- implementation authorization: granted by Nick on 2026-07-27 for a
  sub-agent-driven implementation on this worktree
- implementation status: complete and locally review-ready on
  `codex/apple-pay-express-checkout-plan`
- local verification: 81 focused tests, 10 Chromium overlay journeys,
  typecheck, lint with no errors, and production build
- whole-branch review: approved after owner-scoped provider-lock and
  production-adapter browser-coverage revisions

Implementation and release gates:

1. Reviewed mockup approval is complete.
2. Counterpart findings are reconciled into this document.
3. Final designed-journey sign-off is complete.
4. Default-off implementation is authorized.
5. Production flag activation remains blocked until the preserved-withdrawal
   copy is legally reconciled across the AGB, withdrawal notice, contract
   confirmation, and Elements session.

### Counterpart findings ledger

| Finding                                                                               | Disposition                                 | Plan response                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First decide whether Apple Pay nested inside existing Embedded Checkout is sufficient | Rejected as already decided                 | Nick explicitly requested Apple Pay and PayPal prominently above the fallback; the selected custom Elements scope is the narrowest implementation that satisfies that hierarchy.                                  |
| `custom_text` cannot be carried into Elements mode                                    | Accepted, then superseded by legal research | The no-checkbox Elements path omits the immediate-loss copy only after the withdrawal contract is confirmed; current Embedded Checkout remains unchanged in this task.                                            |
| Apple Pay must be gated before the native sheet opens                                 | Superseded                                  | The later user decision removes the checkbox and its gate. If legal review requires approval, the journey must be revised before implementation.                                                                  |
| Consent acceptance needs provider-side/server-side evidence                           | Superseded                                  | The target UX does not claim immediate loss of the withdrawal right. Any later early-start or compensation contract requires its own reviewed evidence design.                                                    |
| Verification commands/test names were stale                                           | Accepted                                    | Commands now use the repository's real `tsx --test` and Playwright invocations and current filenames.                                                                                                             |
| Availability hook named the wrong event                                               | Accepted                                    | The plan now uses React `onReady` and `availablePaymentMethods`.                                                                                                                                                  |
| Automatic-tax changes can stale an app-owned amount label                             | Accepted                                    | Live Checkout Session totals after address changes are now an adapter acceptance criterion.                                                                                                                       |
| Reconsider sequencing because the wider offer page may change                         | Rejected as out of scope                    | Nick explicitly asked to proceed from the just-merged production PR #245 baseline; the default-off flag and exact Embedded Checkout rollback contain that risk.                                                   |
| Define the dual-adapter exit                                                          | Accepted with a bounded policy              | Custom Elements remains offer-overlay-only while the feature is flagged; no migration of other surfaces or retirement of Embedded Checkout is implied. A future consolidation requires its own evidence and plan. |
