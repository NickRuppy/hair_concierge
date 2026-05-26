import assert from "node:assert/strict"
import test from "node:test"

import { buildMetaPurchaseAnalytics } from "../src/lib/stripe/purchase-analytics"

test("buildMetaPurchaseAnalytics maps Stripe final total, currency, plan, and broad payment method", async () => {
  const retrieveCalls: unknown[][] = []
  const stripe = {
    subscriptions: {
      async retrieve(...args: unknown[]) {
        retrieveCalls.push(args)
        return {
          id: "sub_123",
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

  const result = await buildMetaPurchaseAnalytics(
    {
      amount_total: 1749,
      currency: "eur",
      id: "cs_test_123",
      payment_method_types: ["card"],
      subscription: "sub_123",
    } as any,
    stripe as any,
  )

  assert.deepEqual(result, {
    contentId: "premium_quarter",
    currency: "EUR",
    eventId: "cs_test_123",
    interval: "quarter",
    paymentMethodType: "card",
    value: 17.49,
  })
  assert.equal(retrieveCalls.length, 1)
})

test("buildMetaPurchaseAnalytics omits ambiguous payment method lists", async () => {
  const stripe = {
    subscriptions: {
      async retrieve() {
        return {
          id: "sub_123",
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

  const result = await buildMetaPurchaseAnalytics(
    {
      amount_total: 749,
      currency: "eur",
      id: "cs_test_ambiguous",
      payment_method_types: ["card", "paypal"],
      subscription: "sub_123",
    } as any,
    stripe as any,
  )

  assert.equal(result?.paymentMethodType, undefined)
})
