import assert from "node:assert/strict"
import test from "node:test"
import { buildPayPalDeferredTrialPlanRequest } from "../src/lib/paypal/trial-plan-shape"

const productId = "PROD-server-owned"
test("deferred monthly plan charges 9.99 monthly without a provider free cycle", () => {
  const plan = buildPayPalDeferredTrialPlanRequest({ interval: "month", productId })
  assert.deepEqual(plan.billing_cycles, [
    {
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: 0,
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "9.99", currency_code: "EUR" } },
    },
  ])
  assert.equal(plan.product_id, productId)
  assert.equal(plan.status, "ACTIVE")
  assert.deepEqual(plan.payment_preferences, { setup_fee: { value: "0", currency_code: "EUR" } })
})
test("deferred annual plan charges 69.99 first year then 99.99 annually without a provider free cycle", () => {
  const plan = buildPayPalDeferredTrialPlanRequest({ interval: "year", productId })
  assert.deepEqual(plan.billing_cycles, [
    {
      tenure_type: "TRIAL",
      sequence: 1,
      total_cycles: 1,
      frequency: { interval_unit: "YEAR", interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "69.99", currency_code: "EUR" } },
    },
    {
      tenure_type: "REGULAR",
      sequence: 2,
      total_cycles: 0,
      frequency: { interval_unit: "YEAR", interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "99.99", currency_code: "EUR" } },
    },
  ])
})
test("deferred plan keeps explicit inclusive tax and rejects unsupported inputs", () => {
  const tax = { percentage: "19", inclusive: true } as const
  assert.deepEqual(
    buildPayPalDeferredTrialPlanRequest({ interval: "month", productId, tax }).taxes,
    tax,
  )
  assert.throws(
    () => buildPayPalDeferredTrialPlanRequest({ interval: "quarter" as never, productId }),
    /monthly or annual/,
  )
  assert.throws(
    () => buildPayPalDeferredTrialPlanRequest({ interval: "month", productId: " " }),
    /product id/,
  )
  for (const percentage of ["", " ", "-1", "1e1", "100.01"]) {
    assert.throws(
      () =>
        buildPayPalDeferredTrialPlanRequest({
          interval: "month",
          productId,
          tax: { percentage, inclusive: true },
        }),
      /tax projection/,
    )
  }
  assert.throws(
    () =>
      buildPayPalDeferredTrialPlanRequest({
        interval: "month",
        productId,
        tax: { percentage: "19", inclusive: false as never },
      }),
    /tax projection/,
  )
})
