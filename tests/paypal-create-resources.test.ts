import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  DEFAULT_PAYPAL_WEBHOOK_EVENTS,
  buildPayPalPlanPayload,
  buildPayPalProductPayload,
  buildPayPalWebhookPayload,
  formatPayPalSetupEnv,
} from "../scripts/paypal/create-resources"

test("buildPayPalProductPayload creates a digital service product for Chaarlie Premium", () => {
  assert.deepEqual(buildPayPalProductPayload(), {
    name: "Chaarlie Premium",
    description: "Chaarlie Premium membership",
    type: "SERVICE",
  })
})

test("buildPayPalPlanPayload creates active infinite fixed-price plans", () => {
  assert.deepEqual(buildPayPalPlanPayload("quarter", "PROD-123"), {
    product_id: "PROD-123",
    name: "Chaarlie Premium Quartal",
    description: "Chaarlie Premium, Quartal",
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 3 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: "34.99", currency_code: "EUR" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: "0", currency_code: "EUR" },
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  })
})

test("buildPayPalWebhookPayload subscribes to the subscription events we handle", () => {
  const payload = buildPayPalWebhookPayload("https://preview.example/api/paypal/webhook")

  assert.equal(payload.url, "https://preview.example/api/paypal/webhook")
  assert.deepEqual(
    payload.event_types.map((event) => event.name),
    DEFAULT_PAYPAL_WEBHOOK_EVENTS,
  )
})

test("formatPayPalSetupEnv prints the env vars needed by checkout and validation", () => {
  const output = formatPayPalSetupEnv({
    productId: "PROD-123",
    planIds: {
      month: "P-month",
      quarter: "P-quarter",
      year: "P-year",
    },
    webhookId: "WH-123",
  })

  assert.match(output, /PAYPAL_PRODUCT_ID=PROD-123/)
  assert.match(output, /PAYPAL_PLAN_ID_MONTHLY=P-month/)
  assert.match(output, /PAYPAL_PLAN_ID_QUARTERLY=P-quarter/)
  assert.match(output, /PAYPAL_PLAN_ID_ANNUAL=P-year/)
  assert.match(output, /PAYPAL_WEBHOOK_ID=WH-123/)
})

test("resource setup script documents only the runtime-supported PayPal environments", () => {
  const source = readFileSync(
    new URL("../scripts/paypal/create-resources.ts", import.meta.url),
    "utf8",
  )

  assert.match(source, /PAYPAL_ENVIRONMENT must be either sandbox or live/)
  assert.doesNotMatch(source, /environment === "production"/)
})
