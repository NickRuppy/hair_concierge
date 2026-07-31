# Apple Pay Checkout Session Synchronization

**Status:** Approved by Nick on 31 July 2026

**Scope:** Stripe Checkout Elements on the result-offer overlay for membership subscriptions; one-time Apple Pay is a regression/control path, not part of the incident fix

**Target outcome:** Keep Apple Pay enabled and make a valid Wallet authorization reach `checkout.confirm`, PaymentIntent creation, and the expected purchase entitlement.

## Outcome contract

- Apple Pay remains visible on eligible Safari/iPhone sessions.
- Card and PayPal behavior remain unchanged.
- Membership prewarming remains enabled when it is healthy.
- A prepared Stripe Checkout Session must be claimed and synchronized before its Apple Pay control can be used.
- A failed prepared-session synchronization recovers to a fresh Checkout Session with Apple Pay still eligible; it must not permanently suppress the wallet.
- No production payment-method or Stripe-account configuration changes are part of this code change.

## Non-goals

- Redesigning the payment overlay or changing its German copy.
- Moving to Stripe-hosted Checkout.
- Removing Automatic Tax, subscriptions, merchant tokens, or recurring-payment disclosure.
- Treating a Wallet tokenization failure as an issuer decline without a PaymentIntent or Charge.

## Incident evidence

The 31 July production attempt establishes these boundaries:

1. Safari opened the Apple Pay sheet and Wallet supplied two different configured cards.
2. Stripe created three valid live `apple_pay` tokens, so domain verification, Wallet setup, device eligibility, and tokenization worked.
3. No token was consumed. Stripe created no PaymentIntent, Charge, Customer, or Subscription.
4. The application emitted no payment-method-selected event, and the React Express Checkout `onConfirm` callback was not entered.
5. Immediately before the Wallet attempts, the server updated the already initialized Checkout Session to change prepared-session metadata to `claimed`.
6. The mounted Checkout client was not asked to synchronize that server update.

This rules out an issuer/card decline for these attempts. The failure is between successful Wallet tokenization and the application's Express Checkout confirmation callback.

## Root-cause hypothesis

**High-confidence hypothesis, still requiring a red/green device test:** the prepared Checkout Session is mutated outside Stripe's Checkout client synchronization boundary.

`result-offer-pricing.tsx` initializes a Checkout Elements tree early from the prepared Session's client secret. When the overlay opens, `claimPreparedCheckout` updates that same Session's metadata on the server. The mounted Stripe client is not refreshed through `checkout.runServerUpdate(...)`. Apple Pay's native sheet is timing-sensitive and can complete tokenization while the Checkout client still holds the pre-claim Session state, after which Stripe's internal express-checkout lifecycle closes before React receives `onConfirm`.

Stripe documents `runServerUpdate` as the client boundary for a server update to an initialized Checkout Session: [Dynamically update line items](https://docs.stripe.com/payments/advanced/dynamically-update-line-items) and [Dynamically update amounts](https://docs.stripe.com/payments/advanced/dynamically-update-amounts?locale=en-GB). The installed Stripe client exposes this API on the Checkout actions object.

## Chosen approach

Synchronize the existing claim through Stripe, before exposing the prepared wallet:

1. Keep the prepared Checkout Elements tree mounted for early Apple Pay availability detection.
2. When an attempt activates a prepared Session, have the mounted Checkout component call:

   ```ts
   checkout.runServerUpdate(async () => {
     const activation = await claimPreparedCheckout(signal)
     if (!activation.activated) throw new Error("prepared_checkout_claim_failed")
     return activation.response
   })
   ```

3. Keep payment choices in the existing preparing state until `runServerUpdate` returns success for the current attempt.
4. Only then expose the Apple Pay control and allow confirmation.
5. Retain `onBeforeConfirm` as a last-line idempotent claim guard, but do not rely on it for Apple Pay because the current failure occurs before React `onConfirm`.
6. If synchronization fails or times out, abort the activation fetch, invalidate that preparation, and remount a fresh, non-prepared Checkout Session. Re-evaluate Apple Pay on the fresh Session; do not set the wallet-suppression flag merely because the prepared claim failed.

The pre-tap membership claim stays because it atomically assigns the prepared Session to the concrete checkout attempt, binds funnel attribution used by later webhooks, and records checkout start before payment-method selection. Deferring it to confirmation would change those funnel and ownership semantics as part of an incident fix. Splitting attribution from Stripe metadata may be a later simplification, but is not required to repair this failure.

This is preferred over disabling prewarming because it preserves the fast wallet path and uses Stripe's supported synchronization primitive. A fresh Session is the recovery path, not the default path.

## Implementation slices

### 1. Add a red-capable synchronization seam

In `src/components/checkout/stripe-offer-elements-checkout.tsx`:

- Extend the narrowed Checkout action type with `runServerUpdate`.
- Add a prepared-session activation callback and attempt key.
- Track `idle | syncing | ready | failed` per Checkout key and attempt ID.
- Run the activation callback exactly once through `checkout.runServerUpdate` when a hidden prepared tree becomes the active visible checkout.
- Return the unconsumed claim `Response` from that callback so Stripe can refresh the initialized Session.
- Keep Express Checkout non-interactive/not exposed while syncing.
- Report structured activation success/failure to the parent.
- Treat both a thrown callback and `runServerUpdate` returning `{ type: "error" }` as synchronization failure.
- Fence late results from a closed attempt or remounted Checkout key.

In `src/components/checkout/payment-method-checkout.tsx`:

- Thread the optional prepared-session activation callback, attempt key, and outcome callback through to `StripeOfferElementsCheckout`.
- Leave the one-time caller unchanged except for satisfying the optional prop contract; do not move its claim lifecycle in this fix.

### 2. Move the prepared claim inside that boundary

In `src/components/quiz/result-offer-pricing.tsx`:

- Remove the fire-and-forget claim from `openCheckoutNow`.
- Pass the existing idempotent `claimPreparedCheckout` operation to the Stripe Checkout component only for a matching prepared Session.
- Preserve its preparation ID, attempt ID, funnel event ID, and one-time consent binding.
- On synchronized success, retain the current overlay and emit browser `checkout_started`; do not emit it from a late claim after a timeout.
- On failure, route the child's synchronization result into the existing unusable-preparation clearing path so it remounts a cold Checkout Session without suppressing Apple Pay.
- Abort the claim fetch when the two-second synchronization deadline expires.
- Preserve PayPal availability while Stripe recovers.

No API payload or provider price changes are required in `src/app/api/stripe/create-checkout-session/route.ts`; its claim endpoint remains the server operation wrapped by `runServerUpdate`.

### 3. Add boundary observability

Add sanitized Sentry breadcrumbs for:

- `prepared_checkout_sync_started`
- `prepared_checkout_sync_succeeded`
- `prepared_checkout_sync_failed`
- Express Checkout `onConfirm` entered
- `checkout.confirm` result

Each must carry only attempt/preparation/session identifiers already safe for operational correlation, plan interval, failure stage, and elapsed time. Do not include Wallet tokens, card details, addresses, or client secrets. Keep these diagnostic-only; do not expand the typed product-analytics event map.

## Verification

### Controlled baseline before implementation

On the same test-mode domain and iPhone, compare the current membership and one-time flows before committing to the full patch:

- If membership fails before React `onConfirm` while one-time reaches it, the pre-tap membership mutation hypothesis is corroborated; proceed.
- If both fail before React `onConfirm`, stop and re-open the root cause before implementing `runServerUpdate`.
- If membership unexpectedly works, repeat with diagnostic breadcrumbs and the exact production-like prewarm flags before changing code.

### Automated state-machine tests

These tests prove the synchronization seam, gating, fencing, and recovery plumbing. They cannot prove Stripe's native Apple Pay lifecycle is repaired because the fixtures do not execute a real Wallet sheet or real Checkout Session; only the native device test below can close the incident.

Update `tests/stripe-offer-elements-checkout.test.tsx` to prove:

- a prepared activation invokes the claim exactly once inside `runServerUpdate`;
- Apple Pay cannot be selected while synchronization is pending;
- success makes the wallet confirmable;
- failure reports recovery and ignores a late success;
- an attempt/key change permits one new synchronization without reusing stale state.

Update `tests/result-offer-pricing-prewarm.spec.ts` and its lab fixture to prove:

- the overlay's prepared path does not expose Apple Pay before claim synchronization succeeds;
- claim failure remounts a cold Session and Apple Pay is not marked permanently unavailable;
- card and PayPal remain available during/recover after the Stripe fallback;
- close/reopen and plan-change flows do not reuse a claimed or stale preparation.

Keep the route-contract tests green to prove claim idempotency and metadata validation are unchanged.

Run:

```bash
npx tsx --test tests/stripe-offer-elements-checkout.test.tsx tests/stripe-checkout-session-route-contract.test.ts tests/payment-method-checkout.test.tsx
npx playwright test tests/result-offer-pricing-prewarm.spec.ts --project=chromium
npm run ci:verify
```

### Native iPhone red/green test

Use Safari on the registered test-mode domain with a real Wallet card and Stripe test keys. Stripe returns test payment credentials and no real charge is made.

1. Baseline the current build: expect tokenization followed by no app `onConfirm`/PaymentIntent, reproducing red.
2. Test the patched build with the same device/card: require sync success, app `onConfirm`, `checkout.confirm`, a successful test PaymentIntent and Subscription, webhook processing, and the expected billing/entitlement row.
3. Repeat with the second Wallet card.
4. Exercise a forced claim failure: require fresh-Session recovery with Apple Pay still available, plus working card and PayPal alternatives.
5. Verify the production-like subscription price, recurring disclosure, Automatic Tax address handling, close/reopen, and retry behavior.

Measure the synchronization hold. Target p95 is at most 800 ms; after 2 seconds, fence the prepared attempt and begin the fresh-Session recovery instead of leaving the wallet tappable against stale state.

Registering a test-mode payment-method domain is a separate non-production Stripe configuration action and needs explicit authorization at execution time if it is still absent.

## User journey (no visual redesign)

1. The user taps the existing pricing CTA.
2. During the existing short preparing state, the app claims and synchronizes the prewarmed Stripe Session.
3. The current payment overlay opens with the same price, Apple Pay, PayPal, and card choices.
4. The user taps Apple Pay, approves a Wallet card, and Stripe hands the express-confirm event to the app.
5. The app calls `checkout.confirm`; Stripe creates and confirms the subscription payment.
6. The existing success path closes/redirects and grants the purchase entitlement.

Recovery: if prepared-session synchronization fails, the overlay keeps its preparing state while a fresh Session mounts. Apple Pay is evaluated again and remains available when Stripe reports it eligible. PayPal and card are not removed. If confirmation itself is declined, the user receives the existing payment error and can retry or choose another method.

Because this plan changes only the invisible lifecycle ordering and reuses the current preparing/error surfaces, it does not require a new visual mockup. The visible hierarchy and copy remain unchanged.

## Release and rollback

- Ship behind the existing checkout/prewarm controls. `NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED=false` is the operational kill switch for the new synchronization path: it forces fresh Sessions while leaving Apple Pay eligible. Do not add a second flag unless implementation evidence shows this control is insufficient.
- Verify test mode before production deployment.
- After deployment, run one explicitly authorized low-value production subscription with Apple Pay and immediately reconcile Session, PaymentIntent, Charge, Subscription, webhook, database entitlement, and settlement/refund state.
- Monitor sync failures, Express `onConfirm` entry, PaymentIntent creation, and payment outcome by attempt ID.
- Rollback is either the existing prewarm kill switch or the code deploy. Keep Apple Pay enabled unless a new production safety decision is explicitly made.

## Acceptance criteria

- The production failure is reproducible in the old flow or otherwise captured at the same synchronization boundary.
- All targeted automated tests pass.
- A native iPhone test-mode Apple Pay authorization consumes the Wallet token and creates the expected successful Stripe objects and local entitlement.
- Forced claim failure recovers through a fresh Session without permanently hiding Apple Pay.
- Card and PayPal regression checks pass.
- One authorized production smoke purchase is fully reconciled before calling the incident closed.
