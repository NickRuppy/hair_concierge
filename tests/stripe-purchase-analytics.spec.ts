import assert from "node:assert/strict"
import test from "node:test"

import { buildCheckoutPurchaseAnalytics } from "../src/lib/stripe/purchase-analytics"

test("buildCheckoutPurchaseAnalytics maps Stripe final total, currency, plan, and broad payment method", async () => {
  const retrieveCalls: unknown[][] = []
  const stripe = {
    subscriptions: {
      async retrieve(...args: unknown[]) {
        retrieveCalls.push(args)
        return {
          id: "sub_123",
          default_payment_method: { id: "pm_card", type: "card" },
          items: {
            data: [
              {
                price: {
                  recurring: { interval: "month", interval_count: 3 },
                },
              },
            ],
          },
        }
      },
    },
  }

  const result = await buildCheckoutPurchaseAnalytics(
    {
      amount_total: 3499,
      currency: "eur",
      id: "cs_test_123",
      metadata: { funnel_package_key: "scalp_check_placeholder" },
      payment_method_types: ["card", "sepa_debit"],
      subscription: "sub_123",
    } as any,
    stripe as any,
  )

  assert.deepEqual(result, {
    currency: "EUR",
    funnelPackageKey: "scalp_check_placeholder",
    interval: "quarter",
    paymentMethodType: "card",
    planId: "premium_quarter",
    pricingCatalog: "standard",
    value: 34.99,
  })
  assert.equal(retrieveCalls.length, 1)
  assert.deepEqual(retrieveCalls[0], [
    "sub_123",
    { expand: ["default_payment_method", "items.data.price"] },
  ])
})

test("buildCheckoutPurchaseAnalytics omits payment method when actual method is not expanded", async () => {
  const stripe = {
    subscriptions: {
      async retrieve() {
        return {
          id: "sub_123",
          default_payment_method: "pm_unexpanded",
          items: {
            data: [
              {
                price: {
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        }
      },
    },
  }

  const result = await buildCheckoutPurchaseAnalytics(
    {
      amount_total: 1499,
      currency: "eur",
      id: "cs_test_unexpanded",
      payment_method_types: ["sepa_debit"],
      subscription: "sub_123",
    } as any,
    stripe as any,
  )

  assert.equal(result?.paymentMethodType, undefined)
})

test("buildCheckoutPurchaseAnalytics preserves the trusted launch catalog from Stripe metadata", async () => {
  const stripe = {
    subscriptions: {
      async retrieve() {
        return {
          id: "sub_launch",
          default_payment_method: { id: "pm_launch", type: "card" },
          items: {
            data: [
              {
                price: {
                  recurring: { interval: "year", interval_count: 1 },
                },
              },
            ],
          },
        }
      },
    },
  }

  const result = await buildCheckoutPurchaseAnalytics(
    {
      amount_total: 6999,
      currency: "eur",
      id: "cs_test_launch",
      metadata: { pricing_catalog: "personal_plan_launch_v1" },
      subscription: "sub_launch",
    } as any,
    stripe as any,
  )

  assert.deepEqual(result, {
    currency: "EUR",
    funnelPackageKey: undefined,
    interval: "year",
    paymentMethodType: "card",
    planId: "premium_year",
    pricingCatalog: "personal_plan_launch_v1",
    value: 69.99,
  })
})
