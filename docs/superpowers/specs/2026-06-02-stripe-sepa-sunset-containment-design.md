# Stripe SEPA Sunset Containment Design

## Reader Line

This spec replaces the earlier SEPA immediate-access architecture plan. It defines the smaller containment path for sunsetting SEPA Direct Debit in new Stripe Checkout Sessions while preserving renewal safety for users who already have active SEPA subscriptions.

## User Situation

Chaarlie no longer wants to offer SEPA for new purchases because delayed settlement, pending payment states, possible reversals, and renewal uncertainty add too much operational risk. Users who have not already received app access through an active subscription should switch to another payment method.

## Promised End State

- New Stripe subscription Checkout Sessions do not offer SEPA Direct Debit.
- Completed unpaid SEPA Checkout Sessions do not grant new access in this release.
- Existing active SEPA subscriptions are not broken by a global Stripe Dashboard change during this release.
- Normal failed-payment/dispute paths remain active for existing subscriptions.
- Card Checkout continues to work.
- Existing SEPA subscriptions are audited and handled as a migration/renewal decision, not silently broken.

## Stripe Evidence

- Checkout Sessions in this codebase rely on Dashboard-managed payment methods because `payment_method_types` is omitted from `stripe.checkout.sessions.create`.
- Stripe documents `excluded_payment_method_types` on Checkout Sessions as the per-session way to exclude methods when payment methods are managed through the Dashboard: https://docs.stripe.com/api/checkout/sessions/create
- Stripe documents SEPA as a delayed-notification method; a completed Checkout can mean the debit is authorized but funds are not yet available: https://docs.stripe.com/billing/subscriptions/sepa-debit
- Stripe subscription renewal invoices use invoice, subscription, customer invoice default, and legacy source payment-method priority. Subscription payment method availability can affect renewal success: https://docs.stripe.com/billing/invoices/subscription and https://docs.stripe.com/billing/subscriptions/payment-methods-setting
- Stripe Customer Portal supports a `payment_method_update` flow that lets customers add a new payment method and sets it as the customer invoice default payment method: https://docs.stripe.com/customer-management/portal-deep-links
- Stripe also documents a Checkout setup-mode path to collect a new payment method and update the subscription's `default_payment_method`: https://docs.stripe.com/payments/checkout/subscriptions/update-payment-details

## Scope

In scope:

- Code-level SEPA exclusion for new Stripe Checkout Sessions.
- Rejection of unpaid Checkout Sessions, including SEPA, for new access.
- Existing async failure/dispute revocation behavior.
- Removal of the local `stripe_checkout_intents` WIP from this release because the remote migration was never applied and SEPA is being sunset.
- Tests proving SEPA is excluded from new Checkout creation.
- Tests proving completed unpaid SEPA does not grant access.
- An operational audit plan for existing SEPA subscribers and renewals.

Out of scope:

- Global Stripe Dashboard disabling of SEPA during this release.
- Large checkout-attempt/table rename or webhook file split.
- A new Stripe checkout-intents table or migration.
- Migration of all existing SEPA subscribers in code.
- Customer-facing email copy implementation for renewal migration.
- Cleanup of already duplicated live Stripe subscriptions.

## Chosen Approach

Use a small server-side containment patch:

1. Add `excluded_payment_method_types: ["sepa_debit"]` to new Stripe subscription Checkout Session creation.
2. Reject completed unpaid Checkout Sessions for new access, including SEPA.
3. Keep normal failure/dispute handling for existing subscriptions.
4. Fulfill delayed non-SEPA Checkout success from `checkout.session.async_payment_succeeded`, while skipping SEPA async success during the sunset.
5. Remove the local `stripe_checkout_intents` WIP from the final release.
6. Do not globally disable SEPA in Stripe until existing SEPA subscriptions are audited.
7. Handle renewals with a separate operational migration path.

## Renewal Handling Recommendation

For existing SEPA subscribers, use a temporary grandfathering approach:

- Let existing SEPA subscriptions continue charging while the subscriber is migrated.
- Audit active subscriptions with `default_payment_method.type === "sepa_debit"`.
- Ask affected users to update to card through Stripe Customer Portal or a subscription-specific payment update link.
- Prefer subscription-specific update where possible so the new card becomes `subscription.default_payment_method` for that subscription.
- After a deadline, choose one policy: keep grandfathering, cancel at period end, or enforce card-only renewal.

Do not globally disable SEPA until this audit confirms whether disabling it affects renewal collection for active SEPA subscriptions.
