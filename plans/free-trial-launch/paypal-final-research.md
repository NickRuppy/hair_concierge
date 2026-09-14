# PayPal trial mechanism — final research note

13 September 2026. Read-only review of the current PayPal Subscriptions API documentation and the existing Chaarlie PayPal paths. This is execution research, not a provider mutation or proof that the merchant account supports each proposed plan.

## What the documented API supports

PayPal explicitly supports up to **two** `TRIAL` billing cycles followed by one `REGULAR` cycle. Trial cycles are finite and ordered by `sequence`; a regular cycle with `total_cycles: 0` recurs indefinitely. A free trial can use fixed price `0`, while a discounted paid trial has its own fixed price. [Offer a trial period](https://developer.paypal.com/subscriptions/trial-period/) (updated 24 July 2026) shows both the one-free-trial and free-plus-discounted-trial shapes; [the API schema](https://developer.paypal.com/api/subscriptions/v1/definitions/plan_collection/) defines the two-trial/one-regular limit.

That directly models the agreed catalogue:

| New enrollment | Billing cycles |
| --- | --- |
| Monthly | `TRIAL`: 7 × `DAY`, EUR 0, once → `REGULAR`: 1 × `MONTH`, EUR 9.99, indefinitely |
| Annual | `TRIAL`: 7 × `DAY`, EUR 0, once → `TRIAL`: 1 × `YEAR`, EUR 69.99, once → `REGULAR`: 1 × `YEAR`, EUR 99.99, indefinitely |

Although PayPal calls the EUR 69.99 annual phase `TRIAL`, Chaarlie must treat it as the first paid membership period: its successful sale is the paid conversion and its period/end dates are paid-access facts. The label is a PayPal billing-cycle classification, not a product entitlement.

These are the supported catalogue shapes, not yet the selected initial-enrollment mechanism. The authorization-clock analysis below may require the initial PayPal flow to use equivalent **no-free-cycle** schedules with a future provider start and an app-managed seven-day access period, so the first provider collection occurs exactly seven days after verified authorization.

The plan's `payment_failure_threshold` cannot supply Chaarlie's strict first-charge policy. PayPal says it retries failed payments every five days up to twice per billing cycle and carries an outstanding balance forward; suspension happens only after the threshold is exceeded. [Payment failures and recovering balances](https://developer.paypal.com/subscriptions/payment-failure-retry/) (updated 24 July 2026). A verified first failure must immediately converge Chaarlie to locked access, and the stored trial deadline must also deny access when no successful payment exists even if no failure webhook arrives.

The required provider signals are documented: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, and, critically, `PAYMENT.SALE.COMPLETED` for a paid subscription sale. [Subscriptions webhooks](https://developer.paypal.com/subscriptions/webhooks/) (updated 10 July 2026). A PayPal subscription becoming `ACTIVE` is the provider fact required to establish the authorized free trial; it is not proof of a nonzero payment.

There is a material clock constraint. `POST /v1/billing/subscriptions` returns an `APPROVAL_PENDING` subscription and its `start_time` defaults to the current time. [Create subscription API](https://developer.paypal.com/api/subscriptions/v1/subscriptions-create/). PayPal's documented button flow also creates the subscription before the buyer completes the agreement. [Subscriptions integration](https://developer.paypal.com/platforms/subscriptions/integrate/). Thus creation time is not safely equivalent to authorization time.

There is a documented **candidate** for the agreed clock, but it needs provider proof. PayPal says a future `start_time` may be changed while it remains future. [Future start](https://developer.paypal.com/platforms/subscriptions/customize/future-date/). Its Subscriptions v1 patch endpoint allows `start_time` replacement, but only for subscriptions in `ACTIVE` or `SUSPENDED` status. [Update subscription API](https://developer.paypal.com/api/subscriptions/v1/subscriptions-patch). Therefore a no-free-cycle plan can be created with a provisional future start, approved by the payer, then—after a verified `ACTIVE` read—patched to the provider-evidenced authorization time plus seven days, provided that new time is still future. With no setup fee, the future-start documentation says regular payments begin at `start_time`; Chaarlie can grant app trial access from verified authorization until that patched provider boundary.

This sequence is viable only if all of the following are proven against the merchant account: (1) the consent completes before the provisional future start, (2) the `ACTIVE` status has a trustworthy provider timestamp for the authorization moment, rather than a delayed webhook receipt, (3) `PATCH /v1/billing/subscriptions/{id}` accepts the future `start_time` after approval and durably changes the first billing boundary, and (4) the final read confirms exactly seven days from that provider authorization time. If patching fails, times out, or the provisional start passes before approval, Chaarlie must not grant trial access; reconcile/cancel the agreement rather than inventing an app-only later deadline.

The public PayPal documentation reviewed does not explicitly say that a plan's free `TRIAL` cycle begins on activation rather than on `start_time`; no such source was found. Accordingly, the initial implementation should use the no-free-cycle future-start candidate above if it passes the proof, rather than assume a provider free-cycle has the required anchor. Do not calculate Chaarlie's original trial end from browser click, local intent creation, redirect, or a default PayPal `start_time`.

## Existing Chaarlie seams

The repository already retrieves and cancels PayPal subscriptions in `src/lib/paypal/subscriptions.ts` (`retrievePayPalSubscription`, `cancelPayPalSubscription`) and currently immediately cancels on `POST /api/paypal/cancel-subscription` before mirroring the app-side paid-through date. `src/lib/paypal/subscription-plan-change.ts` already invokes `/v1/billing/subscriptions/{id}/revise`, sends `PayPal-Request-Id`, obtains the approval link, and verifies the target plan after return.

That is useful reuse, but current semantics are paid-subscription semantics: the cancellation route must gain trial-aware entitlement handling, and current interval-change validation must be extended to pin a trial's original end date and offer snapshot.

## Cancellation, restoration and plan changes

Cancellation is a documented direct `POST /v1/billing/subscriptions/{id}/cancel` operation returning `204`. [Cancel subscription API](https://developer.paypal.com/api/subscriptions/v1/subscriptions-cancel). It is immediate at PayPal, so the app must preserve its separately stored original trial end and grant trial access only until that instant. The prior agreement cannot be “uncancelled.”

For **restore after cancellation**, use a separate no-free-cycle plan and create a replacement subscription with `start_time` equal to the original trial end. PayPal documents future-start subscriptions specifically for a new subscription after a current one ends, and permits changing the start date while it remains in the future. [Start a subscription for a future date](https://developer.paypal.com/platforms/subscriptions/customize/future-date/) (updated 26 June 2026). The replacement shapes are:

| Restore target | No-free-cycle replacement schedule |
| --- | --- |
| Monthly | `REGULAR`: EUR 9.99 monthly |
| Annual | `TRIAL`: EUR 69.99 annual, once → `REGULAR`: EUR 99.99 annual indefinitely |

The future-start documentation says regular payments begin on `start_time`; it does not prove every detail of approval, status and first collection for the merchant's exact plan. Therefore, creation/approval is a candidate implementation mechanism, and the app must only replace the cancelled state after it has verified the new subscription and kept the original timestamp unchanged. If approval is abandoned, the cancelled trial remains cancelled and expires at its original end.

For **changing monthly ↔ annual during an active trial**, the viable first mechanism is the existing `/revise` path, not cancel-and-create. PayPal documents that a revision to a plan under the same product requires PayPal payer re-consent and that failure or abandonment leaves the existing plan billed; the changed price takes effect on the next billing cycle with no automatic proration. [Upgrade or downgrade a subscription](https://developer.paypal.com/platforms/subscriptions/customize/revise-subscriptions/) (updated 26 June 2026). This gives the desired abandonment behavior and, if the next billing time remains the original seven-day end, avoids overlap.

However, PayPal's public revision document does **not** explicitly state that revising between plans with different trial/regular cycle shapes preserves a currently running trial's original end. Treat `/revise` as the chosen candidate, with a release-blocking provider proof: start a seven-day trial, revise on day three in each direction, complete/abandon approval, and inspect `start_time`, `billing_info.next_billing_time`, plan ID and transaction schedule. Do not cancel the old agreement as a fallback before the provider proves that behavior.

## First-payment failure and fresh paid recovery

At the original stored trial end, Chaarlie must deny paid content unless a nonzero payment has succeeded. This expiry rule is independent of webhook arrival: the read-time entitlement resolver must expire access when `now >= original_trial_end` and there is no verified paid sale, including when a failure webhook was delayed, dropped, or never received. A verified `BILLING.SUBSCRIPTION.PAYMENT.FAILED` event then immediately converges the stored status and recovery UI, but is not a precondition for locking.

Because PayPal will otherwise retry and carry the balance forward, recovery cannot blindly create another collectible subscription. The implementation sequence is:

1. Retrieve the old agreement and its transactions; reconcile any `PAYMENT.SALE.COMPLETED` or processing/ambiguous payment before offering recovery.
2. If the original sale is conclusively failed/unpaid, cancel the old agreement and re-retrieve it to establish that it cannot keep collecting. A cancellation request alone is not enough to conclude that a payment racing it cannot settle.
3. Create an **immediate, no-free-cycle paid** subscription using the selected interval. For annual recovery this is the one-time EUR 69.99 annual phase then EUR 99.99 annual; monthly is EUR 9.99 regular. Do not claim access from approval or `BILLING.SUBSCRIPTION.ACTIVATED` alone.
4. Start paid access only after the verified `PAYMENT.SALE.COMPLETED` for the replacement. Persist the sale timestamp and PayPal `next_billing_time`; these must demonstrate a full paid month/year measured from successful collection, as Nick chose. If delayed approval/authentication means those dates do not align, this provider sequence cannot meet the policy without an explicit provider-supported adjustment.

PayPal documents future starts and ordinary cycles, but it does not document the exact delayed-payment annual-boundary behavior Chaarlie wants. There is no basis to invent an arbitrary app or API date adjustment to manufacture the boundary. This is an execution-proof gap, not an undecided commercial policy: it blocks the dependent recovery activation until a supported provider sequence proves the full period from the verified sale. The bounded live-provider test described in the parent plan remains required before activation.

## Material limits and required proof

1. **Catalogue.** Verify live plan shapes, EUR amounts, product identity, tax treatment, `payment_failure_threshold`, and webhook subscriptions before code accepts IDs. The currently known PayPal draft is not evidence of the agreed annual EUR 69.99 → EUR 99.99 schedule.
2. **Authorization clock.** Prove that the provider's first paid-charge boundary is seven full days after verified payer approval, not seven days after an `APPROVAL_PENDING` object was created. Persist the provider's verified start/billing facts and the `ACTIVATED` evidence; do not grant access from the return URL or move only Chaarlie's deadline later than PayPal's.
3. **Revision.** Prove the active-trial monthly↔annual revisions retain the original deadline, do not add a new free cycle, and leave the old plan operative when approval is abandoned. This is the main provider-specific gap.
4. **Replacement and recovery.** Prove the future-start no-free replacement creates no overlap, and immediate paid recovery produces exactly EUR 9.99 or EUR 69.99 and a full period from the completed sale. Inspect both subscription detail and transaction history after every cancellation/ambiguous response. No arbitrary post-hoc date adjustment is an acceptable fallback.
5. **Notifications.** The docs above name events but do not settle Chaarlie's German consumer-notice obligations. Required-notice/tax review remains an external launch gate; no optional trial-reminder programme is proposed.

No new customer-facing decision is needed from this research. The only remaining PayPal constraint is that release cannot claim plan-change/recovery compatibility until the documented but unproven behaviors above are verified against the merchant account with the already-required scoped live run sheet.
