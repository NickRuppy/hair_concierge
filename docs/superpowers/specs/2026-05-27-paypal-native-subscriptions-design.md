# PayPal Native Subscriptions - Design Spec

**Date:** 2026-05-27
**Status:** Approved direction from planning conversation
**Owner:** Nick
**Related:** `docs/superpowers/specs/2026-04-19-stripe-subscription-design.md`, `plans/2026-04-19-stripe-subscription.md`

---

## 1. Context

Chaarlie already sells one Premium membership through Stripe Embedded Checkout. The audience is mainly German, where PayPal is a highly relevant payment method. Because the business is a US LLC, PayPal should not be offered through Stripe's PayPal payment method. Chaarlie needs a native PayPal checkout option that feels like a fast express payment path while preserving the existing Stripe-based card/SEPA path.

This spec adds PayPal as a first-class second payment provider while preserving one product model: the same Premium membership, same three billing intervals, same displayed prices, same entitlement behavior, and the same post-payment account activation experience.

### Settled decisions

- Use **provider-neutral subscription records** instead of adding more provider-specific state directly to `profiles`.
- Keep `profiles.subscription_status`, `profiles.subscription_interval`, `profiles.current_period_end`, and `profiles.subscription_tier_id` as the fast entitlement mirror used by gates.
- Keep the same intervals and prices as Stripe:
  - Monthly: `€7,49`
  - Quarterly: `€17,49`
  - Yearly: `€49,99`
- Treat those discounted amounts as the real recurring PayPal plan prices for the first PayPal release. Stripe can continue to implement the same customer-facing amount through a coupon; PayPal plans do not need to reproduce Stripe coupon mechanics.
- PayPal should be presented as the first express checkout action when enabled, not as a separate second-class purchase route.
- PayPal cancellation should follow Stripe-like paid-through behavior: future billing stops, access remains until the current paid period ends.
- Add scheduled reconciliation so entitlement downgrades do not rely only on a final webhook.
- Prevent double payment across providers. A user with active, past-due, or still-paid-through Premium access must not be able to start a second Stripe or PayPal subscription.
- PayPal visibility must be guarded by `NEXT_PUBLIC_PAYPAL_ENABLED` so the revenue path can be disabled without reverting code.
- Existing Stripe subscribers must be backfilled into `billing_subscriptions` when the provider-neutral table is introduced.
- PayPal Product and Billing Plans are created manually in the PayPal dashboard, then validated by a repo script before live use.

### PayPal docs reviewed

- PayPal Subscriptions integration: https://developer.paypal.com/docs/subscriptions/integrate/
- PayPal Subscriptions API: https://developer.paypal.com/docs/api/subscriptions/v1/
- PayPal subscription webhooks: https://developer.paypal.com/docs/subscriptions/reference/webhooks/
- PayPal JS SDK reference: https://developer.paypal.com/sdk/js/v1/reference/
- PayPal webhook verification: https://developer.paypal.com/docs/api/webhooks/v1/

### Non-goals

- Do not add a third payment provider.
- Do not build a full billing ledger with invoices, refunds, disputes, revenue reports, credits, or internal accounting workflows.
- Do not replace Stripe Embedded Checkout.
- Do not move Stripe payment methods into custom UI.
- Do not implement PayPal plan switching in the first PayPal release unless explicitly added later.
- Do not implement PayPal refunds or dispute handling beyond webhook-safe logging in this release.
- Do not change recommendation, quiz, onboarding, or chat behavior except where payment activation gates access.

---

## 2. Product Behavior

### Checkout selection

After a user chooses Monthly, Quarterly, or Yearly, the checkout area should treat PayPal as the express mobile-friendly path and keep card/SEPA as the expandable fallback:

1. Show the official PayPal checkout button first when `NEXT_PUBLIC_PAYPAL_ENABLED=true`.
2. Show a small "oder" divider.
3. Show a single "Karte / SEPA" control that expands the existing Stripe Embedded Checkout fields only when selected.
4. If PayPal is disabled, keep the current Stripe-only checkout behavior.

Do not expose provider implementation details in user-facing copy. Avoid labels like "über Stripe" or "nativ integriert". Do not use "keine doppelte Zahlung" as a value proposition; double-payment prevention is a system requirement, not checkout marketing copy.

Checkout copy should stay short and expectation-setting. For PayPal, use copy in the spirit of: "PayPal öffnet sich zur Bestätigung. Danach aktivieren wir dein Konto." Do not show paid-through cancellation semantics in checkout; explain those in profile/cancellation UI where they are relevant.

The offer itself must look identical regardless of provider:

- Same selected plan.
- Same price copy.
- Same guarantee copy.
- Same post-payment activation route.

All visible UI copy must be in German.

### Successful PayPal checkout

The successful PayPal path should mirror Stripe:

1. User selects a plan.
2. PayPal button creates or starts a PayPal subscription for the mapped plan ID.
3. User approves in PayPal.
4. Browser returns to `/welcome?provider=paypal&subscription_id=<PAYPAL_SUBSCRIPTION_ID>`.
5. `/welcome` verifies the PayPal subscription server-side.
6. If PayPal already reports the subscription as active, Chaarlie ensures a Supabase user/profile exists and writes the Premium entitlement.
7. If PayPal still reports approval-pending state, `/welcome` shows "Wir aktivieren dein Abo..." and polls briefly while the webhook finalizes activation.
8. Existing `WelcomeClient` lets the user set a password or request a magic link.

PayPal webhooks remain the long-term source for lifecycle changes. The return page is allowed to activate after server verification so the user is not blocked waiting for the webhook.

### Cancellation

Stripe subscriptions keep using Stripe Customer Portal.

PayPal subscriptions use an in-app Chaarlie cancellation action:

1. User opens `Mitgliedschaft`.
2. Chaarlie detects the active provider is PayPal.
3. User sees German copy explaining that the subscription will not renew and access remains until the paid-through date.
4. User confirms with a clear cancellation button.
5. Backend calls PayPal `POST /v1/billing/subscriptions/{id}/cancel`.
6. Chaarlie updates provider state to cancelled and keeps the profile entitlement active until `current_period_end`.
7. Scheduled reconciliation later downgrades the profile after the paid-through date.

Users can also manage PayPal automatic payments inside PayPal, but Chaarlie should not depend on PayPal account navigation as the primary cancellation path.

### Payment failure

Mirror Stripe's permissive current behavior:

- Payment failure does not immediately revoke access.
- `past_due` or provider failed-payment states can keep access temporarily.
- Suspension, cancellation, expiration, or reconciliation after paid-through date removes access.

---

## 3. Data Model

Create a provider-neutral table for the active external subscription state.

Recommended table: `billing_subscriptions`

Core fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `provider text not null check (provider in ('stripe','paypal'))`
- `provider_customer_id text`
- `provider_subscription_id text not null`
- `provider_status text not null`
- `entitlement_status text not null`
- `interval text check (interval in ('month','quarter','year'))`
- `current_period_end timestamptz`
- `cancel_at_period_end boolean not null default false`
- `cancelled_at timestamptz`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

Create a separate `billing_webhook_events` table for idempotency:

- `id uuid primary key default gen_random_uuid()`
- `provider text not null check (provider in ('stripe','paypal'))`
- `provider_event_id text not null`
- `event_type text not null`
- `processed_at timestamptz not null default now()`
- Unique `(provider, provider_event_id)`

Unique constraints:

- Unique `(provider, provider_subscription_id)`
- Partial unique `(user_id)` where `entitlement_status in ('active','past_due','incomplete')`.
- App-level checkout guard that also blocks a new purchase when the profile mirror still grants paid-through access after cancellation.

Profiles remain the entitlement mirror:

- `subscription_status`
- `subscription_interval`
- `current_period_end`
- `subscription_tier_id`

Existing Stripe columns can stay for compatibility during migration:

- `stripe_customer_id`
- `stripe_subscription_id`

Do not add PayPal-specific columns to `profiles` in this release. Read provider details from `billing_subscriptions`.

---

## 4. Provider State Mapping

### Entitlement statuses

Use a small internal vocabulary:

- `active`
- `past_due`
- `canceled`
- `incomplete`

Existing gating already treats `active` and `past_due` as access-granting. Keep that.

### PayPal mapping

- `BILLING.SUBSCRIPTION.ACTIVATED`: `entitlement_status = active`
- `PAYMENT.SALE.COMPLETED`: keep active and refresh paid-through data by retrieving subscription details
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`: `entitlement_status = past_due`
- `BILLING.SUBSCRIPTION.SUSPENDED`: `entitlement_status = past_due` unless current period has already ended, then canceled
- `BILLING.SUBSCRIPTION.CANCELLED`: stop future renewal, keep active until `current_period_end`
- `BILLING.SUBSCRIPTION.EXPIRED`: canceled and downgrade to Free

Important: do not map PayPal `CANCELLED` directly to immediate loss of access if the user has already paid for the current period.

---

## 5. PayPal Setup

Create PayPal app credentials for sandbox and live:

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENVIRONMENT` with `sandbox` or `live`
- `PAYPAL_PLAN_ID_MONTHLY`
- `PAYPAL_PLAN_ID_QUARTERLY`
- `PAYPAL_PLAN_ID_ANNUAL`

Create one PayPal Catalog Product for Chaarlie Premium and three Billing Plans matching the Stripe intervals and displayed discounted prices.

Recommended PayPal plan settings:

- Currency: `EUR`
- Tenure: regular recurring billing only
- Monthly: interval unit month, count 1, amount `7.49`
- Quarterly: interval unit month, count 3, amount `17.49`
- Yearly: interval unit year, count 1, amount `49.99`
- `shipping_preference: NO_SHIPPING`
- `payment_failure_threshold`: use PayPal default or a conservative threshold; Chaarlie's entitlement reconciliation decides access after paid-through date.

Setup path:

- Create PayPal Product and Plans manually in sandbox and live dashboards.
- Add `scripts/paypal/validate-plans.ts` to verify configured env plan IDs before launch.
- Validation must confirm active status, EUR currency, expected fixed price, and expected billing interval/count.

Tax/accounting note: Stripe currently uses automatic tax and a discount coupon. PayPal plans intentionally charge the discounted customer-facing amount as the recurring fixed price in this release.

---

## 6. Risks

- PayPal subscription cancellation can become provider-status `CANCELLED` immediately while the customer should still retain paid-through access. The internal entitlement mirror must handle this separately.
- PayPal payment method updates are handled by PayPal, not by Chaarlie. The Chaarlie profile should explain this when a PayPal user needs to change funding source.
- Webhooks can be delayed or missed. Scheduled reconciliation is required.
- Stripe has a hosted portal; PayPal does not provide an equivalent drop-in portal for this exact flow. Chaarlie must own PayPal cancellation UX.
- German cancellation requirements should receive legal review before live launch. The implementation should make cancellation clear, direct, and confirmable.
- The new `vercel.json` introduced for cron is repo-wide deployment configuration; future deployment settings must be merged into that file rather than creating a second config source.

---

## 7. Promised End-State

Users can choose PayPal as the first express checkout action for the same Chaarlie Premium plans, with card/SEPA still available through the existing Stripe checkout. PayPal purchases activate the same account and entitlement flow as Stripe. PayPal lifecycle changes update the same membership state as Stripe. PayPal users can cancel inside Chaarlie, keep access through their paid period, and are downgraded reliably by webhook or scheduled reconciliation after the paid-through date.
