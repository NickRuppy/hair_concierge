# Apple Pay `canConfirm` hotfix

**Status:** Approved by Nick for implementation on 31 July 2026

**Branch:** `codex/apple-pay-express-canconfirm-hotfix`

## Outcome

Allow an eligible Apple Pay Express Checkout confirmation event to reach
`checkout.confirm({ expressCheckoutConfirmEvent })` even when the pre-event
Checkout session snapshot reports `canConfirm: false`.

This is an integration-only correction. It must not change visible checkout
copy, hierarchy, pricing, providers, preparation, tax, webhooks, entitlements,
or error recovery.

## Production evidence

The controlled live retry for the `+278` test lead produced one claimed monthly
Checkout Session and two Express confirmation callbacks on the same attempt.
The trace recorded `express_confirm_entered` twice after prepared checkout
synchronization succeeded. PostHog recorded checkout start and Apple Pay
exposure but no `offer_payment_method_selected`. Stripe created no PaymentIntent,
customer, subscription, charge, or provider event, and Supabase created no
billing rows.

In the current callback, the first guard rejects `!checkout.canConfirm` before
provider claim and `checkout.confirm`. On the first callback, the other guard
conditions were disproved by the trace and code path: Checkout loaded,
preparation synchronized, and no confirmation was already in flight. The
handler then invokes `paymentFailed`, which explains the native Apple Pay
`Payment Failed` state. The evidence proves the flag was false at this boundary;
it does not prove which internal Stripe requirement made it false. The live
session had a valid email and `automatic_tax.status=complete`, so missing tax
location was not the blocker in this attempt.

## Chosen change

1. Keep the existing guards for a missing Checkout instance, an in-flight
   confirmation, and an unsynchronized prepared session.
2. Keep `checkout.canConfirm` as the ordinary Payment Element submission gate.
3. Do not apply `checkout.canConfirm` to an Express Checkout callback carrying
   `expressCheckoutConfirmEvent`; the wallet event supplies the payment method
   that must be passed to `checkout.confirm`.
4. Record an exact, bounded reason in the query-gated, copyable wallet-debug
   trace for every rejected Express callback (`checkout_unavailable`,
   `confirmation_in_flight`, `prepared_checkout_not_synchronized`, or
   `provider_locked`) so a controlled repeat is directly diagnosable without
   adding a new production analytics event.
5. Change the existing browser fixture that currently codifies the broken
   behavior. With `canConfirm: false`, assert the card button remains disabled
   while Apple Pay reaches `checkout.confirm` exactly once and does not call
   `paymentFailed`; after the successful stub confirmation, Stripe keeps its
   provider lock and PayPal/card remain disabled. Rename the test accordingly.

Stripe's documented Express Checkout flow calls `confirm` with the confirmation
event directly from the event handler. The prior Promise-return change remains
in place for this hotfix so the corrected path preserves the full async handler
lifecycle.

## Designed integration journey

No mockup is required because there is no surface, copy, timing, or feedback
change.

1. The existing overlay displays Apple Pay above PayPal and the card form.
2. The card form remains disabled until its own fields make `canConfirm` true.
3. The user authorizes Apple Pay in the existing native sheet.
4. The Express callback passes its event through the existing preparation and
   provider-lock gates into `checkout.confirm`.
5. Success continues through the unchanged Stripe redirect/webhook/entitlement
   journey; cancellation and real confirmation errors retain current recovery.

Nick explicitly approved this precise hotfix after reviewing the live failure
diagnosis. No new user-facing decision is introduced.

## Previous-fix cleanup audit

Audit PR #290 independently from the hotfix. Do not remove code merely because
the Promise defect was not the active blocker in this live retry.

| PR #290 area                   | Exact scope                                                                                                                                                                                                                                                | Recommendation                                                                                                                                                             | Cost of removal                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Express callback contract      | `StripeOfferExpressRendererProps.onConfirm` plus the two production `onConfirm` callbacks in `stripe-offer-elements-checkout.tsx`                                                                                                                          | **Keep.** Three small production changes match the async callback contract and become relevant once this hotfix reaches `checkout.confirm`.                                | Reintroduces the discarded-Promise defect and removes protection against confirm-event lifetime changes.                                                                       |
| Bounded confirmation capture   | `getStripeExpressCheckoutExceptionReason` and the two Express-only capture branches in `stripe-offer-elements-checkout.tsx`; focused source/privacy tests                                                                                                  | **Keep.** This path will now execute and the diagnostics remain PII-bounded.                                                                                               | Makes the next genuine `checkout.confirm` error opaque again.                                                                                                                  |
| Deferred-Promise browser probe | 51 additions/8 changes in `offer-payment-overlay-lab.tsx` (`deferred` mode, return-state/ref, diagnostic attribute, thenable observer, manual settlement button and query parsing) plus the 21-line Playwright test at `offer-payment-overlay.spec.ts:818` | **Only credible cleanup candidate.** A later PR may remove this lab-only machinery after replacing its pending/settled Promise assertion with equivalent focused coverage. | Loses the only behavioral proof that the injected Express handler returns a thenable which remains pending with `checkout.confirm`; the remaining source-regex test is weaker. |
| Sentry payload test            | 53-line `captureCheckoutException` context test in `checkout-observability.test.ts`                                                                                                                                                                        | **Keep.** It protects the privacy boundary introduced with error capture.                                                                                                  | Risks leaking or silently dropping checkout context in later observability changes.                                                                                            |
| Durable implementation plan    | `plans/2026-07-31-apple-pay-confirm-promise.md` (212 lines)                                                                                                                                                                                                | **Keep as history.** This hotfix records that the Promise hypothesis was not the active blocker for this retry.                                                            | Deleting it violates the repository's durable-plan convention and erases the decision record.                                                                                  |

**Recommendation:** remove nothing from PR #290 during the live incident. If a
follow-up cleanup is still desired after production verification, limit it to
the lab-only deferred-Promise probe and require replacement coverage first. No
production Promise or observability code should be reverted.

The follow-up audit must report exact line/file scope, behavioral coverage lost,
and a recommendation. It does not authorize cleanup edits in this hotfix.

## Verification

1. Update only the existing `confirm=blocked` browser test to the desired
   contract and run it against the unchanged production guard. Record the red
   failure (`confirmation-count` remains `0`).
2. Make the minimal guard correction plus bounded rejection-reason trace.
3. Run focused Stripe component tests and the offer-payment-overlay Playwright
   test.
4. Start the isolated server with `npm run dev:worktree`, use its printed port,
   and run `PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test
tests/offer-payment-overlay.spec.ts --project=chromium --grep "wallet
confirmation bypasses"`.
5. Run `npx tsx --test tests/stripe-offer-elements-checkout.test.tsx
tests/checkout-observability.test.ts` and the full payment-overlay spec.
6. Run the repository `ready-check` skill and `npm run ci:verify` as required.
7. Run Claude whole-branch review and the repository code-review router on the
   final tree; verify findings locally.

## Boundaries

- No Stripe configuration, prices, Checkout Session parameters, migration,
  webhook, database, feature flag, or deployment change.
- No live purchase during implementation.
- Emergency rollback remains the existing
  `NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED=false` kill switch plus redeploy;
  this hotfix does not operate it.
- Stop at a verified review-ready branch; commit/push/PR/merge/deploy require
  separate authorization.
