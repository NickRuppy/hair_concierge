# Apple Pay early prewarm and resolved-open gate

Status: implemented and locally verified; not shipped.

## Outcome and source context

Make the real Stripe Apple Pay button ready before the offer payment drawer
opens, so eligible iPhone Safari customers do not watch a grey wallet
placeholder after PayPal is already visible.

This is a performance follow-up to
`plans/2026-07-29-apple-pay-prewarm.md` and the shipped implementation on current
`origin/main`. The payment hierarchy, pricing, withdrawal notice, Stripe
confirmation, PayPal flow, and subscription activation remain unchanged.

Stripe documents that the Express Checkout Element briefly has no buttons
after mount, exposes resolved methods through `ready`, can stay hidden until
that callback, and can reuse an existing Elements instance to save time.
Starting that supported lifecycle at result-page mount is Chaarlie's
performance application of those mechanics; Stripe does not prescribe the
exact offer-page trigger.

## Chosen direction

Build both behaviors now because the user requirement is not merely “usually
faster”; it is “never open the normal eligible drawer with PayPal visible and a
grey Apple Pay placeholder.” The existing in-drawer hold was considered and
rejected for this follow-up because it still opens a payment drawer without the
prominent Apple Pay action; the approved direction keeps that wait at the
triggering CTA. Keep the two behaviors independently reversible:

1. **Earlier prewarm:** start the default-plan prepared Checkout Session and
   hidden Apple-Pay-only Express Checkout Element in the pricing component's
   first visible-page effect. The early path bypasses the CTA intersection
   observer; the observer remains only for the independently reversible legacy
   timing path when the new flag is disabled. Do not debounce the initial
   default plan. If the page first mounts in a background tab, start once on
   the next `visibilitychange` to visible. Retain the current 400 ms debounce
   only after a deliberate plan change, so rapid toggles do not spend the
   four-request page budget.
2. **Resolved-open gate:** when enabled, do not open the drawer while a valid
   same-plan preparation is still resolving. The clicked CTA shows the already
   shipped concept copy `Zahlungsoptionen werden vorbereitet …`. Open as soon
   as Apple Pay resolves available; open a wallet-suppressed Elements fallback
   when it resolves unavailable, preparation fails, or the single five-second
   post-tap deadline expires.

`NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED` continues to own speculative
preparation and the server `prepare` action. A new default-off
`NEXT_PUBLIC_OFFER_CHECKOUT_EARLY_PREWARM_ENABLED` selects page-mount timing
instead of the shipped CTA-visibility timing. Another default-off
`NEXT_PUBLIC_OFFER_CHECKOUT_RESOLVED_OPEN_ENABLED` owns the click gate. The
timing change and gate can therefore be rolled back independently; disabling
the base prewarm flag still disables the whole preparation path. The
resolved-open gate is effective only when early prewarm is also enabled; the
harmful `resolved-open=on / early-prewarm=off` combination short-circuits to
the shipped ungated behavior.

The accepted cost remains one incomplete, expiring Checkout Session for an
eligible result-page visitor who may never reach pricing. There is one
`ResultOfferPricing` mount per rendered result variant, one automatic attempt
per plan/identity key, a 31-minute TTL, and the existing four-request page cap.
Nick already accepted this speculative-session tradeoff. The server-side
`prepare` action remains protected by the existing base prewarm flag.

## Scope and non-goals

In scope:

- initial result-page preparation timing, plan-change debounce, and
  background-tab recovery;
- one pure, testable resolved-open reducer that is also the implementation's
  authoritative state machine;
- busy state and double-submit protection for both the pricing CTA and the
  personal-plan page's `Plan sichern` CTA;
- reuse of the in-flight preparation after a fast tap;
- the existing one-shot terminal wallet boolean:
  `true = available`, `false = unavailable or Express load error`; preparation
  request failure remains a separate owner outcome;
- a five-second post-tap deadline and wallet-suppressed fallback;
- ensuring existing `offer_checkout_opened` and `checkout_started` calls are
  not reached during the waiting branch;
- a PostHog-only `checkout_preparation_outcome` event measuring wait duration
  and prepared/unavailable/timeout/failure outcome without entering the funnel;
- a page-mount-to-wallet-ready field on `checkout_prepared`;
- checkout regression coverage and native-device rollout measurements.

Not in scope:

- a fake or merchant-rendered Apple Pay button;
- opening the native Apple Pay sheet before the customer taps it;
- changing checkout pricing, legal copy, plan selection, PayPal, confirmation,
  activation, emails, or Stripe Dashboard configuration;
- counting page-load preparation or a waiting CTA as a checkout attempt/open;
- changing the reactivation checkout's use of `SubscriptionPlanSelector`;
- claiming that Lighthouse can measure native Apple Pay eligibility in
  headless Chrome.

After the five-second deadline, the attempt deliberately favors an immediately
usable PayPal/card flow over a late Apple Pay upgrade. A late `true` does not
insert Apple Pay into the open fallback drawer.

## Target map

- `src/components/quiz/result-offer-pricing.tsx`
  owns initial preparation, plan-change scheduling, visibility recovery,
  terminal wallet result, async wait coordination, attempt creation, claim, and
  actual drawer opening. `prepareOfferCheckout` returns
  `Promise<PreparedOfferCheckout | null>` instead of `Promise<void>`.
  `preparedCheckoutRef` mirrors usable prepared state and
  `preparedWalletAvailabilityRef` mirrors the child callback, so an awaiting
  request does not read a stale React closure.
- `src/lib/stripe/offer-checkout-ready-gate.ts`
  owns `reduceOfferCheckoutReadyGate`, the one authoritative reducer for
  `idle`, `waiting`, `open_prepared`, and `open_fallback`. Component refs mirror
  reducer state, the in-flight wait token, prepared Session, and terminal wallet
  boolean for async freshness; they do not duplicate transition logic.
- `src/components/checkout/subscription-plan-selector.tsx`
  gains optional `busy` and `busyLabel` props; defaults leave
  `membership-reactivation-checkout.tsx` unchanged. Its existing full plan
  `actionLabel` remains the idle label.
- `src/components/personal-plan-offer/personal-plan-offer.tsx`
  keeps its current numeric `openCheckoutRequestId`, receives a plain
  `onCheckoutWaitingChange(waiting)` callback from `ResultOfferPricing`, and
  mirrors busy/disabled state on `Plan sichern`. The pricing CTA owns its local
  busy presentation directly.
- `src/components/checkout/payment-method-checkout.tsx`,
  `src/components/checkout/stripe-offer-elements-checkout.tsx`, and
  `StripeOfferElementsCheckoutContent` thread a named
  `suppressExpressWallet` prop. It keeps the Elements presentation and
  Payment Element, makes the derived `holdPaymentChoices` false regardless of
  `holdPaymentChoicesUntilResolved`, does not render the
  Express element, pending overlay, or failed/unavailable wallet banner, and
  does not arm the Express initial-response/loading timeout effects. It leaves
  PayPal plus Payment Element usable.
- `src/lib/analytics/events.ts`, `src/lib/analytics/routes.ts`, and
  `src/lib/analytics/destinations/posthog.ts` define technical gate
  observability that never routes to Meta or Customer.io.
- `docs/analytics/offer-page-tracking.md` records the immediate CTA tap,
  technical wait outcome, actual drawer-open, and genuine checkout-start
  distinction. It also records the historical break: silent preparations move
  out of `checkout_prepared.walletAvailable=false` into
  `checkout_preparation_outcome=prewarm_silent`.
- `src/lib/funnel/flags.ts`,
  `docs/stripe-express-checkout-release.md`, and the flag assertions in
  `tests/result-offer-pricing-tracking.test.ts` define the new default-off
  rollback boundary.
- `ResultOfferPricing` gains one optional `checkoutLifecycleFixture` prop that
  supplies fake prepare/claim operations and a fake payment-checkout renderer.
  Production callers omit it and retain the real route and Stripe renderer.
- `src/components/checkout/offer-payment-overlay-lab.tsx` gains an
  owner-lifecycle fixture around the real `ResultOfferPricing` using that seam.
- `tests/result-offer-pricing-prewarm.spec.ts` drives that fake lifecycle
  through a dedicated `/labs/offer-page?variant=payment-prewarm` surface so it
  cannot add a second modal participant to the existing overlay lab.

## Designed user journey

1. An eligible customer lands on a result page. In the first visible-page
   effect, Chaarlie creates the same short-lived prepared Checkout Session,
   loads Stripe, and mounts the real Express Checkout Element off-screen.
2. No drawer, backdrop, focus trap, funnel checkout event, email, charge,
   checkout attempt, or subscription is created. The offer and CTAs remain
   visually unchanged.
3. In the normal path, Apple Pay eligibility resolves before the customer taps
   either `Jetzt starten — €34,99 im Quartal` or `Plan sichern`.
4. The tap then calls the existing real open path: create one checkout attempt,
   claim the matching preparation, emit the existing open/start analytics at
   their current real transitions, and open the drawer. Apple Pay and PayPal
   are visible together, with card/other methods below. If checkout is already
   open, a repeated request preserves the current idempotent attempt and inline
   scroll-into-view behavior.
5. If either CTA is tapped before readiness resolves, no checkout attempt or
   open event exists yet. The triggering control is disabled and shows
   `Zahlungsoptionen werden vorbereitet …`. Repeated requests are ignored.
6. Exactly one terminal transition follows:
   - `available`: use the same preparation, enter the real open path, and show
     Apple Pay plus PayPal, but only if
     `isPreparedOfferCheckoutUsable(preparation, selectedInterval)` still
     passes at commit time; expiry instead commits cold fallback;
   - `unavailable` or preparation failure: use the prepared Session when one
     exists, enter the real open path with `suppressExpressWallet`, and show
     PayPal plus a Payment Element that begins mounting with no wallet gap or
     error banner;
   - no terminal result five seconds after the tap:
     - if the prepared Session exists but only wallet readiness is late, keep
       and claim that Session, suppress the wallet UI for this attempt, and
       ignore a later wallet-ready callback;
     - if the preparation request itself still has no usable Session, fence its
       late response and enter the existing cold open path. That one rare path
       can leave the late prepared Session unused until expiry.
   - a preparation promise rejection is caught and commits the preparation
     failure fallback; it never escapes the click handler.
7. Every terminal/abort path resets waiting state in `finally`. Because no
   checkout attempt exists while waiting, a failed gate cannot permanently
   deaden `checkoutAttemptController`.
8. The customer still taps the real black Stripe Apple Pay control to open the
   native sheet and explicitly authorizes with the side button. PayPal and card
   remain unchanged.
9. A plan change invalidates the old preparation. The new plan prewarms after
   the retained 400 ms plan-change debounce, subject to the existing cap.
10. Closing the drawer retains
    `prewarmSuppressedUntilPlanChangeRef=true`; a second open without a plan
    change uses the existing cold path and does not create an automatic
    preparation loop.
11. Non-eligible, flag-off, or otherwise non-prewarming traffic has no in-flight
    preparation and enters the existing real open path synchronously in the
    same event-loop tick with no waiting label.
12. Each completed gate emits one PostHog-only technical outcome with
    `waitDurationMs`; preparation still remains distinct from the genuine
    funnel checkout events. The delegated `offer_cta_clicked` still records the
    user's tap immediately; dashboards correlate its temporary CTA-to-open gap
    with `checkout_preparation_outcome` rather than treating the gap as a fake
    checkout open.

### Deadline ownership

| Phase                                      | Deadline                         | Effect                                                                                                                                                       |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drawer closed, no tap                      | No behavioral deadline           | Keep listening for Stripe's terminal wallet result. The existing diagnostic timer must not mutate readiness, latch `false`, or suppress a later real `true`. |
| Tap while preparation pending              | 5 seconds from that tap          | The only authoritative click gate; then open wallet-suppressed fallback. This exceeds the previously measured 3.81 s cold wallet-ready time.                 |
| Drawer visible without a gated preparation | Existing Express 5 s/10 s guards | Preserve current retry/loading behavior for legacy, flag-off, and cold paths.                                                                                |

Once the gate commits to prepared or fallback open, it fences late responses
from replacing the active checkout. The existing `attemptId` +
`preparationId` claim check and `canConfirmPreparedOfferCheckout` keep prepared
confirmation fail-closed.

## Mockup evidence

Proposed artifact:
`plans/mockups/2026-07-29-apple-pay-early-prewarm.html`

It uses the real default-plan label and includes:

- unchanged CTA during background preparation;
- CTA-level spinner and `Zahlungsoptionen werden vorbereitet …` only after an
  unusually fast tap;
- the same busy treatment on the later `Plan sichern` entry;
- drawer closed while waiting;
- resolved Apple Pay + PayPal drawer;
- clean PayPal/card fallback for unavailable/failure;
- explicit five-second timeout fallback.

The steady drawer state remains the previously reviewed
`plans/mockups/2026-07-27-apple-pay-express-checkout.html`.

Mockup review: confirmed by Nick on 2026-07-29. Nick approved the reviewed
mockup and asked to proceed with the Stripe-supported early-prewarm direction.

Designed-journey sign-off: confirmed by Nick on 2026-07-29. The accepted
journey includes the wider speculative Session radius, early result-page
preparation, CTA-level waiting only for unusually fast taps, and the
five-second wallet-suppressed fallback.

## Ordered tasks

1. Add failing reducer tests in
   `tests/offer-checkout-ready-gate.test.ts`, then implement
   `reduceOfferCheckoutReadyGate`.
   - Prove duplicate requests are ignored, each terminal result commits once,
     timeout chooses fallback, late terminal events after commit are ignored,
     and reset returns to idle.
     2a. Rewrite the prewarm-specific pinned source assertions to express the new
     intended contract. Run them red and keep this work with Task 2b; do not
     commit or hand off at the red checkpoint.
   - Rewrite the actual pinned contracts in
     `tests/result-offer-pricing-tracking.test.ts`: the
     `SubscriptionPlanSelector` first-prop regex, the
     `checkoutAttemptController.open()` placement, the prewarm timer/cap block,
     the `openCheckout` function-boundary extraction, and the closed-drawer
     telemetry timer.
     2b. Implement earlier timing and flags until the rewritten contracts are green.
   - Add assertions for immediate initial scheduling, one-shot
     `visibilitychange` registration/cleanup/recovery, plan-change-only
     debounce, cap/dedupe, both flags, and bypass of `pricingCtaVisible` on the
     early path while retaining the existing CTA observer as the timing-flag
     rollback path.
   - Initial eligible default plan starts in the first visible effect.
   - Add both default-off timing/gate flag readers and document the base,
     early-timing, and resolved-open matrix in
     `docs/stripe-express-checkout-release.md`.
   - Plan changes retain 400 ms coalescing.
   - Fast taps await the same request; commit fences late generations.
   - Stale-generation and non-OK preparation responses return `null` and never
     resolve or commit the awaiting gate as prepared.
   - Keep a telemetry-only closed-drawer 10 s timer, but make it emit
     `checkout_preparation_outcome: prewarm_silent` without mutating readiness,
     recording `walletAvailable=false`, or suppressing a later genuine `true`.
     Only `handlePreparedApplePayAvailabilityResolved` from the child supplies
     the gate's terminal boolean.
   - Run the updated result-pricing test plus
     `tests/acquisition-funnel-tracking.test.ts`,
     `tests/editorial-pages.test.tsx`, and
     `tests/payment-duplicate-dialog.test.tsx` before this task ends.
2. Thread `suppressExpressWallet` through all three checkout layers.
   - It makes the derived `holdPaymentChoices` false regardless of
     `holdPaymentChoicesUntilResolved`.
   - It renders no Express element, pending overlay, failed banner, unavailable
     banner, or 52 px wallet gap.
   - It retains PayPal and Payment Element using the same prepared Elements
     Session when available.
   - It disables the Express initial-response/loading timeout effects so a
     suppressed wallet cannot emit a false late `walletAvailable=false`.
3. Implement the resolved-open owner flow using the reducer from Task 1.
   - Do not call `checkoutAttemptController.open`, `offer_checkout_opened`, or
     `checkout_started` until the reducer commits to an actual open.
   - Use one stored wait token, one five-second timer, and `try/finally` reset.
   - `prepareOfferCheckout` returns and mirrors
     `PreparedOfferCheckout | null`; catch rejection as preparation failure.
   - Bind every child availability callback to its preparation ID, reject stale
     or fenced IDs, and mirror the first accepted terminal boolean in a ref so
     an obsolete child cannot resolve the current gate.
   - Reuse a returned prepared Session on wallet-only timeout.
   - Preserve the existing already-open idempotence and inline scroll branch.
   - If no eligible in-flight preparation exists, commit to the existing open
     path synchronously with no gate timer or busy copy.
   - Include current preparation usability/expiry in reducer inputs and recheck
     it at commit.
   - The owner reducer/ref, not the remountable child one-shot, ignores terminal
     events after commit.
4. Wire both visible entry controls.
   - Pricing CTA keeps the full plan string while idle.
   - The existing numeric `openCheckoutRequestId`, its `0` seed, and its falsy
     mount guard stay unchanged.
   - `Plan sichern` receives the plain waiting callback and shows feedback while
     its imperative request waits.
   - Its existing `data-offer-cta`, destination, and source-section attributes
     remain unchanged.
   - Optional selector props default to preserving membership reactivation.
   - Update `tests/personal-plan-offer-page.test.tsx` for the waiting callback
     while preserving the numeric request contract.
5. Add the analytics contracts.
   - Keep unrelated preparation, claim, analytics routing, retry, plan change,
     and confirmation contracts green.
   - Add `checkout_preparation_outcome` with outcomes
     `prepared`, `prepared_unusable`, `wallet_unavailable_or_error`, `prepare_failure`,
     `timeout_prepared`, `timeout_cold`, and `prewarm_silent`; route it only to
     PostHog.
   - Extend `checkout_prepared` with `pageMountToWalletReadyMs`, anchored to a
     component-mount timestamp rather than request start.
6. Add the `checkoutLifecycleFixture` seam, extend `OfferPaymentOverlayLab`
   with the real owner, and add
   `tests/result-offer-pricing-prewarm.spec.ts` against
   `/labs/offer-page?variant=payment-prewarm`.
   - Use fixture-supplied fake prepare/claim operations and a fake payment
     renderer. Do not call or intercept the real Stripe route and never create
     Stripe Sessions in automated tests.
   - Cover ready-before-tap, fast pricing CTA, fast final CTA, unavailable,
     preparation failure, wallet-only timeout with Session reuse, session
     timeout cold fallback, plan change, and focus containment.
   - Fixture props cover enabled behavior only. Node/source tests prove the
     built environment flags' off branches.
   - The fixture explicitly forces the enabled base/early/gate path and the
     spec injects `window.ApplePaySession.canMakePayments() => true` before
     hydration. Production code keeps the real flags and capability check.
   - Local execution uses the development lab. CI execution requires the
     existing `CI_OFFER_PAGE_LAB_ENABLED=true` access contract.
   - Put the scenarios in a `test.describe("@ci …")` block so the repository CI
     grep actually executes them.

## Verification

Focused automated checks:

```bash
npm exec -- tsx --test \
  tests/offer-checkout-ready-gate.test.ts \
  tests/result-offer-pricing-tracking.test.ts \
  tests/subscription-plan-selector.test.tsx \
  tests/payment-method-checkout.test.tsx \
  tests/stripe-offer-elements-checkout.test.tsx \
  tests/stripe-checkout-session-params.spec.ts \
  tests/stripe-checkout-session-route-contract.test.ts \
  tests/funnel-variants.test.ts \
  tests/personal-plan-offer-page.test.tsx \
  tests/analytics-tracking.test.ts \
  tests/acquisition-funnel-tracking.test.ts \
  tests/editorial-pages.test.tsx \
  tests/payment-duplicate-dialog.test.tsx \
  tests/offer-payment-overlay.test.tsx
npm exec -- playwright test \
  tests/result-offer-pricing-prewarm.spec.ts \
  tests/offer-payment-overlay.spec.ts \
  --project=chromium
npm run test:node
npm run ci:verify
```

Performance and rollout observability:

- do not use the existing Lighthouse script as proof: it targets production
  public pages and headless Chrome does not expose native Apple Pay capability;
- assert scheduling order in the owner-lifecycle lab, not native Stripe speed;
- after rollout, compare existing Web Vitals plus the new
  `checkout_prepared.pageMountToWalletReadyMs` on real eligible Safari traffic;
- measure gate incidence, `waitDurationMs`, timeout outcome rate, and purchase
  conversion by the new technical outcome;
- start a Vercel redeploy with the resolved-open flag disabled for any
  reproducible dead CTA or duplicate attempt; this is a build-time flag, so
  rollback takes deployment time rather than being an instant runtime toggle.
  After at least 30 eligible checkout taps, a timeout rate
  above 10% or a checkout conversion drop of at least 5 percentage points
  versus the preceding eligible cohort is a rollback signal; smaller samples
  remain diagnostic rather than conclusive.

Manual/browser:

- use `localhost`, not `127.0.0.1`, for hydrated Next.js behavior;
- start the worktree server with `npm run dev:worktree` before Playwright;
- set
  `PLAYWRIGHT_BASE_URL=http://localhost:$(node scripts/worktree-dev.mjs --print-port)`
  when running against that worktree;
- restart that server after adding the new deep `src/lib/stripe` reducer;
- compare default, fast-tap, ready, unavailable, and timeout states with the
  reviewed HTML mockup;
- verify no drawer/backdrop/focus trap or analytics checkout-open exists during
  background preparation or CTA waiting;
- verify both entry controls show feedback and rapid repeat taps create one
  actual attempt;
- verify plan changes cannot claim a stale preparation;
- verify each flag-off behavior independently.

Live release check after separate shipping authorization:

- new quiz on eligible iPhone Safari;
- Apple Pay and PayPal appear together on the normal path;
- a deliberately immediate tap shows only the CTA busy state, never a grey
  Apple Pay placeholder in the drawer;
- five-second silence opens a usable PayPal/card fallback;
- native Apple Pay sheet still opens only from the real Stripe control.

## Review and handoff

Worktree: `.worktrees/apple-pay-early-prewarm`

Branch: `codex/apple-pay-early-prewarm`

Before review-ready handoff, run repository `ready-check`,
`request-code-review`, and one read-only Claude whole-branch review. Do not
commit, push, open or merge a PR, deploy, enable flags, or make real payment
attempts without separate authorization.

Mockup review: confirmed on 2026-07-29.

Designed-journey sign-off: confirmed on 2026-07-29.

Implementation verification: completed on 2026-07-29 against
`origin/main` at `d9085ff1b778fee69df7bb38ad798257fd7720b6`. The focused
owner-flow and checkout suites, the full Node suite, the Chromium lifecycle
lab, the existing payment-overlay suite, typecheck, lint, and production build
passed. The review pass additionally fixed stale preparation callbacks,
successful-prewarm reopen classification, expired-preparation telemetry,
fenced-wait cleanup, and focusable/announced CTA waiting states. Native Apple
Pay eligibility and timing remain a separate post-release check on eligible
iPhone Safari hardware.
