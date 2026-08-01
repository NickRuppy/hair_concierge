import assert from "node:assert/strict"
import test from "node:test"
import {
  PAYPAL_LAUNCH_PLAN_SPECS,
  buildPayPalLaunchPlanPayload,
  formatPayPalLaunchEnv,
  paypalRequestId,
  validatePayPalLaunchPlan,
} from "../scripts/paypal/personal-plan-launch-plans"
import {
  STRIPE_LAUNCH_PRICE_SPECS,
  buildStripeLaunchPriceParams,
  formatStripeLaunchEnv,
  selectExistingStripeLaunchPrice,
  validateStripeLaunchPrice,
} from "../scripts/stripe/personal-plan-launch-prices"
import { EXPECTED_PAYPAL_PLAN_SHAPES_BY_FAMILY } from "../src/lib/paypal/plans"
import { PERSONAL_PLAN_LAUNCH_PRICING_PLANS } from "../src/lib/stripe/pricing-plans"

test("provider tooling and runtime catalogs share one exact launch price contract", () => {
  for (const spec of STRIPE_LAUNCH_PRICE_SPECS) {
    const runtimePlan = PERSONAL_PLAN_LAUNCH_PRICING_PLANS.find(
      (plan) => plan.interval === spec.runtimeInterval,
    )
    assert.equal(Math.round((runtimePlan?.amount ?? 0) * 100), spec.amount)
  }

  for (const spec of PAYPAL_LAUNCH_PLAN_SPECS) {
    const runtimeShape =
      EXPECTED_PAYPAL_PLAN_SHAPES_BY_FAMILY.personal_plan_launch_v1[spec.runtimeInterval]
    assert.deepEqual(runtimeShape, {
      amount: spec.amount,
      currency: "EUR",
      intervalCount: spec.intervalCount,
      intervalUnit: spec.intervalUnit,
    })
  }
})

test("Stripe launch price payloads and env names preserve the launch contract", () => {
  const spec = STRIPE_LAUNCH_PRICE_SPECS[1]
  assert.deepEqual(buildStripeLaunchPriceParams(spec, "prod_launch"), {
    currency: "eur",
    product: "prod_launch",
    unit_amount: 1999,
    recurring: { interval: "month", interval_count: 3 },
    tax_behavior: "inclusive",
    metadata: { pricing_catalog: "personal_plan_launch_v1", billing_interval: "quarter" },
  })
  assert.match(
    formatStripeLaunchEnv({ monthly: "price_1", quarterly: "price_2", annual: "price_3" }),
    /STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_ANNUAL=price_3/,
  )
})

test("Stripe validator rejects a price that belongs to another product", () => {
  const spec = STRIPE_LAUNCH_PRICE_SPECS[0]
  const issues = validateStripeLaunchPrice(
    {
      active: true,
      currency: "eur",
      unit_amount: 999,
      type: "recurring",
      recurring: { interval: "month", interval_count: 1 },
      tax_behavior: "inclusive",
      metadata: { pricing_catalog: "personal_plan_launch_v1", billing_interval: "month" },
      livemode: true,
      product: { id: "prod_wrong", active: true, livemode: true },
    } as never,
    spec,
    "prod_launch",
  )
  assert.deepEqual(issues, ["product"])
})

test("Stripe reuse selects only the matching interval from a complete launch catalog", () => {
  const prices = STRIPE_LAUNCH_PRICE_SPECS.slice(0, 2).map((spec, index) => ({
    id: `price_${index}`,
    active: true,
    currency: "eur",
    unit_amount: spec.amount,
    type: "recurring",
    recurring: { interval: spec.intervalUnit, interval_count: spec.intervalCount },
    tax_behavior: "inclusive",
    metadata: {
      pricing_catalog: "personal_plan_launch_v1",
      billing_interval: spec.runtimeInterval,
    },
    livemode: true,
    product: { id: "prod_launch", active: true, livemode: true },
  }))

  assert.equal(
    selectExistingStripeLaunchPrice(prices as never, STRIPE_LAUNCH_PRICE_SPECS[0], "prod_launch")
      ?.id,
    "price_0",
  )
  assert.equal(
    selectExistingStripeLaunchPrice(prices as never, STRIPE_LAUNCH_PRICE_SPECS[1], "prod_launch")
      ?.id,
    "price_1",
  )
})

test("PayPal launch payload is an active untaxed infinite regular plan with no setup fee", () => {
  const spec = PAYPAL_LAUNCH_PLAN_SPECS[2]
  const payload = buildPayPalLaunchPlanPayload(spec, "PROD-launch")
  assert.equal(payload.name, "Chaarlie Persönlicher Haarplan Launch jährlich")
  assert.equal(payload.billing_cycles[0].total_cycles, 0)
  assert.deepEqual(payload.payment_preferences.setup_fee, { value: "0", currency_code: "EUR" })
  assert.equal("taxes" in payload, false)
  assert.match(paypalRequestId("PROD-launch", "annual"), /^ppl-[a-f0-9]{32}$/)
  assert.equal(paypalRequestId("PROD-launch", "annual").length <= 38, true)
  assert.match(
    formatPayPalLaunchEnv({ monthly: "P-1", quarterly: "P-2", annual: "P-3" }),
    /PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY=P-1/,
  )
})

test("PayPal validator rejects tax and invalid cadence", () => {
  const spec = PAYPAL_LAUNCH_PLAN_SPECS[0]
  const issues = validatePayPalLaunchPlan(
    {
      product_id: "PROD-launch",
      status: "ACTIVE",
      taxes: { percentage: "19" },
      payment_preferences: { setup_fee: { value: "0", currency_code: "EUR" } },
      billing_cycles: [
        {
          tenure_type: "REGULAR",
          total_cycles: 0,
          frequency: { interval_unit: "MONTH", interval_count: 3 },
          pricing_scheme: { fixed_price: { value: "9.99", currency_code: "EUR" } },
        },
      ],
    },
    spec,
    "PROD-launch",
  )
  assert.deepEqual(issues, ["cadence", "taxes"])
})
