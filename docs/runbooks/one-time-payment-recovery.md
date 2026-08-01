# One-time personal-plan payment recovery

This runbook is for a captured €29.99 one-time personal-plan payment where provider truth is paid but local activation, database access, confirmation, or delivery evidence did not complete.

Do not run `--apply` until all of the following are true:

- the PR1 database migration and code have been deployed to production;
- a dry-run for the exact target has been reviewed and approved;
- Nick has separately authorized production recovery for that exact provider target.

The command never creates a new Stripe Checkout Session, captures a new PayPal Order, refunds a payment, or enables the public one-time offer assignment. Refunds remain an explicit provider-side/manual operation outside this command.

## Dry-run first

Stripe:

```bash
npm run billing:one-time:recover -- --provider=stripe --stripe-session=<stripe_checkout_session_id>
```

PayPal by token:

```bash
npm run billing:one-time:recover -- --provider=paypal --paypal-token=<paypal_order_intent_token>
```

PayPal by provider order and capture:

```bash
npm run billing:one-time:recover -- --provider=paypal --paypal-order=<paypal_order_id> --paypal-capture=<paypal_capture_id>
```

Dry-run performs provider verification and read-only reconciliation only. Output is intentionally sanitized: it reports provider, fixed amount/currency, whether a paid timestamp exists, whether the canonical consent matches, and boolean/count reconciliation stages. It must not print email, token, session, order, capture, payment intent, user, lead, consent IDs, raw provider payloads, consent text, or secrets.

## Apply after approval

Apply requires both `--apply` and an exact `--confirm-session` match:

```bash
npm run billing:one-time:recover -- --provider=stripe --stripe-session=<stripe_checkout_session_id> --apply --confirm-session=<stripe_checkout_session_id>
```

For PayPal order plus capture, the confirmation value is `<paypal_order_id>:<paypal_capture_id>`:

```bash
npm run billing:one-time:recover -- --provider=paypal --paypal-order=<paypal_order_id> --paypal-capture=<paypal_capture_id> --apply --confirm-session=<paypal_order_id>:<paypal_capture_id>
```

Apply reuses the provider-specific activation path and the canonical one-time activation service. It must not handcraft purchase, consent, analytics, access, or delivery rows.

## Expected post-apply receipt

The sanitized receipt should show:

- purchase persisted;
- purchase and consent bound to a user;
- confirmation accepted;
- plan delivery evidence recorded;
- active access state;
- one canonical purchase analytics outbox event and delivery counts;
- first-access evidence either recorded or still false until the customer opens the result page.

If any stage remains false after an approved apply, stop and investigate. Do not retry with a different target and do not refund from this command.
