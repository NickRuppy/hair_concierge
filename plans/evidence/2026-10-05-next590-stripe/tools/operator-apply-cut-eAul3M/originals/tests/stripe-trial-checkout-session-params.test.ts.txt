import assert from "node:assert/strict"
import test from "node:test"
import type { TrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { buildStripeCheckoutSessionParams } from "../src/lib/stripe/checkout-session-params"
import { buildTrialStripeCheckoutSessionParams } from "../src/lib/stripe/trial-checkout-session-params"

const annualOffer: TrialOfferSnapshot = {
  cohort: "trial_v1",
  offerVersion: "trial_launch_v1",
  interval: "year",
  currency: "EUR",
  trialDays: 7,
  firstAmountMinor: 6999,
  renewalAmountMinor: 9999,
  taxBehavior: "inclusive",
  stripePriceId: "price_annual_full_9999",
  stripeCouponId: "coupon_annual_once_3000",
}

const monthlyOffer: TrialOfferSnapshot = {
  ...annualOffer,
  interval: "month",
  firstAmountMinor: 999,
  renewalAmountMinor: 999,
  stripePriceId: "price_monthly_999",
  stripeCouponId: null,
}

test("builds the server-pinned annual seven-day trial Checkout request", () => {
  const params = buildTrialStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    customerEmail: "lead@example.com",
    offer: annualOffer,
    metadata: {
      checkout_attempt_id: "attempt_123",
      trial_cohort: "user_controlled",
      trial_offer_version: "user_controlled",
      trial_offer_id: "user_controlled",
    },
  })

  assert.equal(params.mode, "subscription")
  assert.deepEqual(params.line_items, [{ price: "price_annual_full_9999", quantity: 1 }])
  assert.equal(params.payment_method_collection, "always")
  assert.deepEqual(params.payment_method_types, ["card"])
  assert.equal("excluded_payment_method_types" in params, false)
  assert.deepEqual(params.discounts, [{ coupon: "coupon_annual_once_3000" }])
  assert.deepEqual(params.subscription_data, {
    trial_period_days: 7,
    billing_mode: { type: "flexible" },
    metadata: {
      checkout_attempt_id: "attempt_123",
      trial_cohort: "trial_v1",
      trial_offer_version: "trial_launch_v1",
      trial_offer_id: "trial_v1:trial_launch_v1:year",
    },
  })
  assert.deepEqual(params.metadata, {
    checkout_attempt_id: "attempt_123",
    trial_cohort: "trial_v1",
    trial_offer_version: "trial_launch_v1",
    trial_offer_id: "trial_v1:trial_launch_v1:year",
  })
})

test("builds the monthly 9.99 trial without a coupon", () => {
  const params = buildTrialStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    customerEmail: "lead@example.com",
    offer: monthlyOffer,
  })

  assert.deepEqual(params.line_items, [{ price: "price_monthly_999", quantity: 1 }])
  assert.equal("discounts" in params, false)
  assert.deepEqual(params.subscription_data, {
    trial_period_days: 7,
    billing_mode: { type: "flexible" },
    metadata: {
      trial_cohort: "trial_v1",
      trial_offer_version: "trial_launch_v1",
      trial_offer_id: "trial_v1:trial_launch_v1:month",
    },
  })
})

test("rejects quarterly and mismatched offer snapshots", () => {
  for (const malformedOffer of [
    { ...annualOffer, interval: "quarter" },
    { ...annualOffer, firstAmountMinor: 9999 },
    { ...monthlyOffer, stripeCouponId: "coupon_monthly" },
  ] as unknown as TrialOfferSnapshot[]) {
    assert.throws(
      () =>
        buildTrialStripeCheckoutSessionParams({
          origin: "https://chaarlie.example",
          customerEmail: "lead@example.com",
          offer: malformedOffer,
        }),
      /valid trial offer snapshot/,
    )
  }
})

test("rejects raw one-time and client-price overrides", () => {
  const rawOverrides = [
    { checkoutKind: "personal_plan_once" },
    { priceId: "price_client_controlled" },
  ]

  for (const override of rawOverrides) {
    assert.throws(
      () =>
        buildTrialStripeCheckoutSessionParams({
          origin: "https://chaarlie.example",
          customerEmail: "lead@example.com",
          offer: annualOffer,
          ...override,
        } as unknown as Parameters<typeof buildTrialStripeCheckoutSessionParams>[0]),
      /server-controlled/,
    )
  }
})

test("leaves the legacy builder's paid subscription request unchanged", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_legacy_quarter",
    customerEmail: "lead@example.com",
  })

  assert.equal(params.mode, "subscription")
  assert.deepEqual(params.line_items, [{ price: "price_legacy_quarter", quantity: 1 }])
  assert.equal("payment_method_collection" in params, false)
  assert.equal("discounts" in params, false)
  assert.equal("subscription_data" in params, false)
})
