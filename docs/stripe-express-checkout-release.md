# Stripe Express Checkout release preflight

This is a preflight checklist for the offer payment overlay only. It does not
perform Stripe Dashboard changes, enable flags, or make production calls.

## Flag and rollback boundary

- `NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED` is strict default-off: only
  the literal value `"true"` may select the Elements flow.
- It is effective only when `NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED` is also
  enabled. With the overlay flag off, the offer keeps its existing surface.
- Disable the express flag to restore PR #245's Embedded Checkout in the
  overlay without reverting code. Verify that rollback in the target
  environment before activation.

## Stripe environment preflight

Complete these separately in Stripe test mode and Stripe live mode:

- Register the exact wallet domain with Stripe and serve the flow via HTTPS.
- Confirm wallet-domain registration is complete for the environment being
  tested; test registration does not cover live, and vice versa.
- On a supported Safari configuration (macOS and iPhone with an active Apple
  Pay wallet), verify Apple Pay can complete the intended subscription test.
- In an unsupported browser/device, verify Apple Pay is absent with no empty
  row or spacing, and PayPal is the first payment action.
- Inspect the active Stripe Payment Method Configuration and record the actual
  fallback methods shown by the Payment Element. Do not infer them from a
  fixture or hard-code illustrative methods.

## Checkout and tracking test matrix

In test mode, exercise and record evidence for:

- each subscription interval and displayed total;
- Apple Pay cancellation, failure recovery, and a successful return route;
- fallback card/available-method failure recovery and successful return;
- duplicate-access handling and repeated confirm clicks;
- automatic tax, the checkout total, and return/activation behavior;
- one explicit `Ja, jetzt starten` action producing one checkout attempt and
  one Meta `InitiateCheckout`. Wallet availability, cancellation, and Stripe
  element setup must not produce an extra Meta event.

## Hard activation blockers

Do not enable the express flag for customers, or newly pair it with the overlay
flag in an environment, until all of these are resolved and evidenced:

- `/widerruf`, AGB, and the contract-confirmation email consistently describe
  the approved preserved 14-day withdrawal policy.
- The remote contract-confirmation copy and Stripe-facing confirmation text are
  consistent with that policy; no stale immediate-loss declaration remains.
- The legal pages are reachable in the target environment and the quiet
  `Details ansehen` link points to `/widerruf` without a checkout checkbox.

This document intentionally makes no claim that the external Stripe, legal,
wallet, or remote-copy checks above have been performed.
