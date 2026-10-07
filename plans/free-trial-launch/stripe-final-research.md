# Stripe trial execution research

13 September 2026. Read-only research against current Stripe documentation. This
resolves the Stripe design direction; it does **not** prove the merchant account
configuration, create a resource, or test a payment.

## Decisive recommendation

Use the existing Stripe Checkout subscription path, extended with a server-owned
trial variant. Do not make a separate zero-value PaymentIntent or a manual
renewal loop.

The local Stripe client pins API version `2026-04-22.dahlia`, which is later
than the 2025 flexible-billing release and whose Checkout documentation exposes
the needed subscription-payment collection parameters. At enrollment, create a
`mode=subscription` Checkout Session with:

- the selected recurring Price;
- `subscription_data.trial_period_days=7`; the returned Stripe `trial_end` is
  the immutable provider deadline recorded by the app;
- `payment_method_collection=always` (the documented default for subscription
  Checkout) so Checkout always collects a PaymentMethod;
- `subscription_data.billing_mode.type=flexible`;
- a server-only 30 EUR, `duration=once` discount only for the annual Price; and
- the existing terms, return-context and attempt metadata contracts.

The clock does **not** begin when the app creates the Checkout Session. Stripe
documents that Checkout generates the Subscription when the customer completes
Checkout, and `trial_period_days` is measured from that subscription creation
moment. The app grants trial access only after server retrieval confirms all of:
the completed Session, `subscription.status === "trialing"`, expected Price and
seven-day `trial_end`, a card PaymentMethod/default payment method, and no
unresolved `pending_setup_intent`. A SetupIntent in `requires_action` must be
completed while the customer is on-session; one in `requires_payment_method`
means no trial enrollment. Browser redirects remain non-authoritative.

This is a direct fit for Stripe's deferred-payment subscription model: Stripe
uses SetupIntents for subscriptions with free trials and documents that they can
authenticate and authorise a card without charging it. A `null`
`pending_setup_intent` means required authentication/authorisation succeeded or
was not required; it does not reserve funds or guarantee a successful charge in
seven days. That is the provider-supported meaning of the agreed card
authorisation gate.

## Prices and introductory annual amount

Use the verified 99.99 EUR annual recurring Price plus the existing server-applied
30 EUR one-time coupon (`8KSV9CZz`), yielding 69.99 EUR for the first *paid*
annual charge and 99.99 EUR for the next annual charge. Do not use the legacy
69.99 EUR recurring Price, which would discount every renewal. Do not attach the
coupon to monthly enrollment, and do not expose a promotion-code field.

This direction is supported, with one important distinction:

- Stripe defines `duration=once` as applying to the first **charge** from a
  subscription, and its coupons guide says it is removed after the first invoice
  finalises. [Coupons guide](https://docs.stripe.com/billing/subscriptions/coupons#coupon-duration)
- Stripe documents the trial's immediate invoice as zero amount. Its changelog
  says coupons are ignored and not redeemed on zero-cost invoices. Therefore a
  modern-account once coupon should remain for the first non-zero annual invoice,
  rather than be spent by the trial invoice. [Trials](https://docs.stripe.com/billing/subscriptions/trials), [zero-cost invoice behaviour](https://docs.stripe.com/changelog/2013-10-29/coupons-apply-invoice-total-balance)

The wording is not perfectly aligned across Stripe documents: the current coupon
guide speaks of the first invoice, while the Invoice API reference says the first
charge; the zero-cost exception says a zero invoice does not redeem the coupon.
The exception only excludes coupons created on an API version predating that 2013
change. The existing coupon was created in 2026, but its exact applied-invoice
behaviour still requires a non-charging preview and first-paid-invoice proof. It
is not safe to infer it from a redirect or from the coupon object alone.

## Cancellation, restoration and interval change

For a trial cancellation, schedule `cancel_at` for the immutable recorded
`trial_end`, rather than immediately deleting the subscription. Flexible billing
mode documents that changing `cancel_at` on a `trialing` subscription preserves
`trial_end`; restoring clears that schedule. This gives cancellation with access
through the original day seven and supports reversal before that date. The app
must still retrieve the subscription and persist provider truth before reporting
either state.

For a trial interval change, directly replace the **existing subscription item**
(provide its item ID; omitting it adds a second item), with
`billing_cycle_anchor=unchanged` and `proration_behavior=none`. This relies on
the documented flexible-mode rule: the anchor never automatically resets, unlike
classic mode where a different interval does reset it. Stripe may generate
zero-amount trial line items for the change; it must not create a non-zero
invoice or payment attempt before the original `trial_end`.

At the same operation, monthly → annual adds the once coupon if the immutable
offer snapshot permits it; annual → monthly removes that annual-only discount.
Retrieve the returned subscription, its latest invoice and the upcoming invoice
preview before accepting the change: assert the original `trial_end` and anchor,
one subscription item, no immediate non-zero invoice, the new selected price,
and the right first-paid/renewal amounts. This is the precise implementation
proof—not a classic-mode assumption.

Existing `src/lib/stripe/subscription-plan-change.ts` provides operation-ledger
and item-replacement precedent, but it is not reusable unchanged: it assumes a
paid current period and rejects every discounted subscription at lines 104-113.
T4 must add a narrower flexible-trial path rather than remove that paid
subscription safety guard generally. A subscription schedule is unnecessary
unless implementation evidence disproves the documented flexible-mode contract.

## First paid invoice, failure and recovery

At the original `trial_end`, Stripe generates the recurring invoice and begins a
new billing cycle. Grant paid access only from verified paid/active provider
state. If the first non-zero invoice is `open`, `processing`, fails, or the
subscription becomes `past_due`, product access remains locked. Do not use the
legacy post-period grace for this cohort.

For Nick's chosen recovery policy, first neutralise or reconcile the old
collectible invoice/subscription. Only when it is not capable of settling may the
user start a **fresh immediate paid Checkout Session** (`mode=subscription`, no
trial) for the selected Price. For annual recovery, reapply the once coupon only
if the immutable offer entitlement says it has not already been consumed. A
Checkout Session generates the subscription when checkout completes; after a
successful payment it contains an active Subscription. This is the closest
supported Stripe construction to a full paid period from actual success: the
new subscription is created at completed checkout, not when the abandoned
recovery Session was opened.

There is no official documented API that retrospectively sets a new
subscription's `billing_cycle_anchor` to an arbitrary later PaymentIntent success
timestamp without a separate subscription update/possible immediate invoice.
So the implementation must compare the paid invoice/payment timestamp and the
returned period/next renewal boundary, and block the recovery handoff if they do
not give the full chosen month/year. A delayed 3DS completion is a required
provider proof case, not a reason to manufacture an anchor or silently shorten
the period.

## What implementation must prove

1. Checkout with a card, seven-day trial and `payment_method_collection=always`
   yields an eligible `trialing` subscription with a usable payment method and
   completed/no-longer-pending SetupIntent; failed setup yields no access and
   releases the eligibility reservation once provider state is non-collectible.
2. Annual trial preview and first non-zero invoice total 69.99 EUR; the following
   annual renewal is 99.99 EUR; monthly is 9.99 EUR and never gets the coupon.
3. Trial cancellation schedules exact original `trial_end`; restore clears the
   schedule. A flexible-mode monthly↔annual item replacement leaves that
   timestamp and anchor unchanged and creates no immediate non-zero invoice.
4. `invoice.payment_failed`, `invoice.paid`, subscription updates/deletes,
   duplicate and out-of-order events all drive the same persisted enrollment
   ledger. Webhook retrieval, not a redirect, controls entitlement.
5. A failed first charge followed by fresh Checkout creates one collectible
   agreement only and gives a full paid calendar interval from completed
   payment; cover delayed authentication and old/new agreement races.

Static fixtures and non-charging invoice previews can validate request shape and
totals. They cannot prove card authorisation, time-dependent conversion,
cancellation timing or a delayed payment boundary. Those remain release-blocking
provider evidence under the plan's existing no-sandbox/no-unapproved-live-charge
boundary.

## Account and integration checks

Current code's common builder is
`src/lib/stripe/checkout-session-params.ts:43` and currently always passes
`automatic_tax: { enabled: true }` at line 77. Do not carry that setting into
the trial variant until the separately-owned tax/registration decision is
cleared. Stripe says a tax registration is needed before automatic tax collects;
enabling it alone does not establish tax treatment. The verified final-price
display decision does not itself make this configuration correct.

Current Stripe plan-change code explicitly rejects discounted subscriptions in
`src/lib/stripe/subscription-plan-change.ts:104-113`; T4 must retain that paid
subscription safety rule while adding the narrower flexible-trial path above.
Existing session creation already flows through
`src/app/api/stripe/create-checkout-session/route.ts:1027`, so this is an
extension of the current subscription path rather than a second payment system.

## Official sources consulted

- [Handle subscriptions with deferred payment](https://docs.stripe.com/billing/subscriptions/deferred-payment): Stripe says it automatically creates SetupIntents for subscriptions that do not need initial payment; it says failures need on-session resolution.
- [Create Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create): `payment_method_collection=always` “will always collect a PaymentMethod”; `subscription` mode sets up fixed-price subscriptions.
- [Use trial periods](https://docs.stripe.com/billing/subscriptions/trials): a trial creates a zero invoice; when it ends Stripe generates an invoice and begins a billing cycle.
- [Coupons and promotion codes](https://docs.stripe.com/billing/subscriptions/coupons#coupon-duration): a once coupon applies to the first invoice/charge and is removed after finalisation.
- [Coupon zero-cost-invoice change](https://docs.stripe.com/changelog/2013-10-29/coupons-apply-invoice-total-balance): “ignored, and not counted as redeemed” on zero-cost invoices.
- [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel): supports scheduled cancellation and reactivation before period end; flexible trialing cancellations preserve `trial_end`.
- [Compare billing modes](https://docs.stripe.com/billing/subscriptions/billing-mode/compare): Stripe recommends flexible mode; it is irreversible per subscription, preserves trial end on cancellation, never automatically resets the anchor, and during a trial only generates line items for changed items.
- [Change subscription price](https://docs.stripe.com/billing/subscriptions/change-price): describes the generic/classic different-interval reset; the flexible-mode comparison is the applicable override for this new cohort.
- [Update subscription API, current version](https://docs.stripe.com/api/subscriptions/update?api-version=2026-04-22.dahlia): supports `billing_cycle_anchor=unchanged`, discounts and `proration_behavior`.
- [Checkout metadata lifecycle](https://docs.stripe.com/metadata/use-cases#set-metadata-indirectly): a Checkout Session generates the Subscription after customer completion.
- [Recurring payments with Checkout](https://docs.stripe.com/recurring-payments): after payment succeeds, Checkout contains the active Subscription.

No customer, subscription, Checkout Session, coupon, Dashboard setting or payment was created or changed for this research.
