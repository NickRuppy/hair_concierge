# Full-period paid recovery — concrete provider candidates

13 September 2026. Targeted final research after the revision 0.46 counterpart review. These candidates preserve Nick’s approved commercial rule; they have not been executed or included in that counterpart verdict. Validate them in T0 before committing dependent adapters. No sandbox resources or live charges are authorized by this document.

## Shared contract

After an unpaid/failed trial, the customer expressly chooses paid membership. First reconcile the old collection and prove it noncollectible; any old success or unresolved processing prevents a second payment attempt. Pin interval, amount, intro eligibility and accepted renewal terms. A successfully received new payment buys one complete calendar month/year from the provider-evidenced success time. Calendar arithmetic must cover the 31st, leap days and timezone display; use a documented provider-compatible end-of-month rule.

If renewal setup fails after money was received, do not classify the payment as failed or offer another charge. Persist and fulfill the paid period, stop any incorrectly dated future collection, and repair through the durable billing-support/outbox path. If fulfillment is impossible, use the existing support/refund procedure; no money is silently discarded. O4 still controls year-two termination and prepaid settlement.

## Stripe: collect the first period, then schedule continuation

Documented candidate:

1. Payment-mode Checkout, existing owned Stripe Customer (or controlled creation), one-time inline Price data tied to the membership Product, and `payment_intent_data.setup_future_usage=off_session`. Monthly: 9.99. Annual: 99.99 one-time amount and the existing 30 EUR once coupon on this Checkout Session, subject to pinned intro eligibility. Do not use a recurring Price in payment mode.
2. Verify canonical `payment_intent.succeeded`, customer/attempt ownership, amount/currency and saved payment method. Stripe’s PaymentIntent has no documented `succeeded_at`; use the canonical provider success-event timestamp, not local webhook arrival or Session creation. Store it once and reconcile duplicate/out-of-order events.
3. Grant the first paid period through success time plus the chosen calendar interval. Persist a durable continuation-creation operation.
4. Create a flexible full-price recurring Subscription with `billing_cycle_anchor=paid_period_end`, `proration_behavior=none`, the same Customer and explicit `default_payment_method`. No trial and no intro coupon on this Subscription. Stripe documents no creation invoice for this no-proration interval; the next full subscription invoice starts at the anchor.
5. Verify the future boundary, zero extra immediate charge and correct 9.99/99.99 recurring price. A lost response is reconciled using stable operation key/provider metadata before retrying; do not create multiple continuations. If repair would occur after the intended anchor is already past, use support/reconciliation rather than invent a retroactive anchor.

Sources: [pinned Checkout API](https://docs.stripe.com/api/checkout/sessions/create?api-version=2026-04-22.dahlia), [billing anchor and proration behavior](https://docs.stripe.com/billing/subscriptions/billing-cycle#configure-proration-behavior), [Checkout discount support](https://docs.stripe.com/payments/checkout/no-cost-orders).

The first membership period is represented by a one-time payment receipt and continuation by recurring invoices. This is **not** the retired one-time Personal Plan product. Use an explicit recovery purpose and membership fulfillment; never route it to legacy one-time Personal Plan fulfillment. Count one membership paid conversion, preserve support linkage, and ensure the accepted checkout terms authorize the future recurring payments. Verify tax, receipt wording, product-restricted coupon compatibility and the real hosted confirmation before activation.

## PayPal: immediate first-period fee, future regular billing

Documented API pieces support a candidate, but not proof of their exact composition:

1. A no-free-cycle plan with an immediate `setup_fee`: 9.99 for the first month or 69.99 for the first year, `setup_fee_failure_action=CANCEL`, and regular billing of 9.99/month or 99.99/year at a provisional future start.
2. The provisional start is creation plus one full calendar interval. Require timely approval before that future date and accepted terms that consistently promise a full interval from successful payment. No setup fee is additional to the advertised first-period price.
3. Verify the nonzero setup-fee transaction, ownership, amount and authoritative success time. `ACTIVE` is insufficient. PayPal does not explicitly document the exact setup-fee success webhook shape; establish it from provider evidence, transaction lookup and reconciliation.
4. PATCH the still-future `start_time` on the active subscription to success plus a calendar interval. Confirm the returned billing facts. Never move collection earlier than consented or allow the provisional date to collect while the operation is unresolved.
5. Treat the successful first payment as paid membership, fulfill its period and durably reconcile continuation. A failed/ambiguous PATCH must neutralize the incorrect collection boundary and trigger support repair; it cannot erase an already successful payment.

Sources: [plan/payment preferences schema](https://developer.paypal.com/api/subscriptions/v1/definitions/plan_collection/), [future-start subscriptions and immediate setup fees](https://developer.paypal.com/platforms/subscriptions/customize/future-date/), [active-subscription start-time PATCH](https://developer.paypal.com/api/subscriptions/v1/subscriptions-patch).

Required proof: actual fee transaction/webhook, supported future PATCH after collection, one charge only, full calendar boundary after delayed approval, setup-fee failure behavior, no late provisional collection, and honest hosted approval/receipt wording. If PayPal’s unavoidable “setup fee” wording misrepresents the first paid membership period, this candidate is not ready; resolve a supported representation rather than hiding provider terms. This is a technical/disclosure constraint, not approval to add a new fee.
