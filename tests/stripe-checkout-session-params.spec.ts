import assert from "node:assert/strict"
import test from "node:test"
import { buildStripeCheckoutSessionParams } from "../src/lib/stripe/checkout-session-params"

test("excludes only SEPA Direct Debit from new Stripe Checkout Sessions", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
  })

  assert.deepEqual(params.excluded_payment_method_types, ["sepa_debit"])
})

test("preserves lead metadata without applying launch discounts", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
  })

  assert.deepEqual(params.metadata, { lead_id: "8d9675fe-f955-46a2-84dc-0ef5e94009d1" })
  assert.equal("discounts" in params, false)
})

test("passes customer for customerId input without customer_email", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerId: "cus_123",
    customerEmail: "customer@example.com",
  })

  assert.equal(params.customer, "cus_123")
  assert.equal("customer_email" in params, false)
})

test("passes customer_email when no customerId is available", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "customer@example.com",
  })

  assert.equal(params.customer_email, "customer@example.com")
  assert.equal("customer" in params, false)
})

test("keeps the embedded Checkout return URL on the welcome page", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
  })

  assert.equal(
    params.return_url,
    "https://chaarlie.example/welcome?session_id={CHECKOUT_SESSION_ID}",
  )
})
