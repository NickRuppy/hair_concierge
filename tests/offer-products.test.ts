import assert from "node:assert/strict"
import test from "node:test"

import {
  getPersonalPlanOnceStripePriceId,
  PERSONAL_PLAN_ONCE_PRODUCT,
  validatePersonalPlanOnceStripePrice,
} from "../src/lib/billing/offer-products"

test("the €29.99 one-time product remains server-owned", () => {
  assert.deepEqual(PERSONAL_PLAN_ONCE_PRODUCT, {
    amount: 29.99,
    amountMinor: 2_999,
    analyticsId: "personal_plan_once",
    currency: "EUR",
    description: "Einmalige Erstellung eines persönlichen Haarplans · Kein Abo",
    name: "Persönlicher Haarplan",
    paypalCategory: "DIGITAL_GOODS",
    plannedRegularPrice: 49.99,
    sku: "personal_plan_once",
  })
  assert.equal(
    getPersonalPlanOnceStripePriceId({ STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE: " price_once " }),
    "price_once",
  )
})

test("Stripe validation rejects a recurring or differently priced resource", () => {
  const valid = {
    active: true,
    currency: "eur",
    id: "price_once",
    metadata: { product_kind: "personal_plan_once" },
    product: {
      active: true,
      metadata: { product_kind: "personal_plan_once" },
      name: "Persönlicher Haarplan",
    },
    recurring: null,
    tax_behavior: "inclusive",
    type: "one_time",
    unit_amount: 2999,
  }
  assert.deepEqual(validatePersonalPlanOnceStripePrice(valid, "price_once"), [])
  assert.deepEqual(
    validatePersonalPlanOnceStripePrice(
      { ...valid, recurring: { interval: "month" }, type: "recurring" },
      "price_once",
    ),
    ["price_recurring"],
  )
})
