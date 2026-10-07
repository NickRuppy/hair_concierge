import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"

import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  attestStripeTrialCatalog,
  type StripeTrialCatalogClient,
} from "../src/lib/stripe/trial-catalog"

const catalog = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_annual",
}

function fixtures(overrides: { account?: object; price?: object; coupon?: object | null } = {}) {
  const account = { id: "acct_trial", ...overrides.account }
  const product = { id: "prod_trial", active: true }
  const price = {
    id: "price_year",
    active: true,
    livemode: false,
    currency: "eur",
    unit_amount: 9999,
    tax_behavior: "inclusive",
    type: "recurring",
    billing_scheme: "per_unit",
    tiers_mode: null,
    custom_unit_amount: null,
    transform_quantity: null,
    product,
    recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
    ...overrides.price,
  }
  const coupon =
    overrides.coupon === undefined
      ? {
          id: "coupon_annual",
          livemode: false,
          valid: true,
          currency: "eur",
          amount_off: 3000,
          percent_off: null,
          duration: "once",
          applies_to: { products: [product.id] },
        }
      : overrides.coupon
  const calls: Array<{ resource: string; id?: string; expand?: readonly string[] }> = []
  return {
    calls,
    client: {
      accounts: {
        retrieve: async () => {
          calls.push({ resource: "account" })
          return account
        },
      },
      prices: {
        retrieve: async (id: string, options?: { expand?: readonly string[] }) => {
          calls.push({ resource: "price", id, expand: options?.expand })
          return price
        },
      },
      coupons: {
        retrieve: async (id: string, options?: { expand?: readonly string[] }) => {
          calls.push({ resource: "coupon", id, expand: options?.expand })
          return coupon
        },
      },
    } as unknown as StripeTrialCatalogClient,
  }
}

test("attests a sellable annual trial catalog and returns identities only", async () => {
  const { calls, client } = fixtures()
  const offer = createTrialOfferSnapshot("year", catalog)

  assert.deepEqual(
    await attestStripeTrialCatalog({
      stripe: client,
      offer,
      expectedAccountId: "acct_trial",
      expectedLivemode: false,
    }),
    {
      accountId: "acct_trial",
      couponId: "coupon_annual",
      interval: "year",
      offerVersion: "trial_launch_v1",
      priceId: "price_year",
    },
  )
  assert.deepEqual(calls, [
    { resource: "account" },
    { resource: "price", id: "price_year", expand: ["product"] },
    { resource: "coupon", id: "coupon_annual", expand: ["applies_to"] },
  ])
})

test("requires every new-sale price and coupon fact without leaking mismatch detail", async () => {
  const offer = createTrialOfferSnapshot("year", catalog)
  for (const overrides of [
    { price: { active: false } },
    { price: { recurring: { interval: "year", interval_count: 1, usage_type: "metered" } } },
    { price: { product: { id: "prod_trial", active: false } } },
    {
      coupon: {
        id: "coupon_annual",
        livemode: false,
        valid: true,
        currency: "eur",
        amount_off: 3000,
        percent_off: null,
        duration: "once",
        applies_to: { products: ["prod_other"] },
      },
    },
  ]) {
    const values = fixtures(overrides as Parameters<typeof fixtures>[0])
    await assert.rejects(
      attestStripeTrialCatalog({
        stripe: values.client,
        offer,
        expectedAccountId: "acct_trial",
        expectedLivemode: false,
      }),
      /^Error: Stripe trial catalog mismatch$/,
    )
  }
})

test("does not retrieve a coupon for a no-discount monthly offer and propagates provider failures", async () => {
  const { calls, client } = fixtures({
    price: {
      id: "price_month",
      unit_amount: 999,
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    },
  })
  const offer = createTrialOfferSnapshot("month", catalog)
  const result = await attestStripeTrialCatalog({
    stripe: client,
    offer,
    expectedAccountId: "acct_trial",
    expectedLivemode: false,
  })
  assert.equal(result.couponId, null)
  assert.equal(
    calls.some((call) => call.resource === "coupon"),
    false,
  )

  const unavailable = fixtures()
  unavailable.client.prices.retrieve = (async () => {
    throw new Error("Stripe unavailable")
  }) as typeof unavailable.client.prices.retrieve
  await assert.rejects(
    attestStripeTrialCatalog({
      stripe: unavailable.client,
      offer: createTrialOfferSnapshot("year", catalog),
      expectedAccountId: "acct_trial",
      expectedLivemode: false,
    }),
    /Stripe unavailable/,
  )
})
