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
  assert.equal(params.ui_mode, "embedded_page")
  assert.deepEqual(params.consent_collection, { terms_of_service: "required" })
  assert.deepEqual(params.custom_text, {
    terms_of_service_acceptance: {
      message:
        "Ich akzeptiere die AGB. Mein gesetzliches 14-tägiges Widerrufsrecht bleibt unberührt: https://chaarlie.de/widerruf.",
    },
  })
})

test("builds the offer-only Checkout Elements session without embedded consent text", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
    presentation: "elements",
  })

  assert.equal(params.ui_mode, "elements")
  assert.deepEqual(params.excluded_payment_method_types, ["sepa_debit", "paypal"])
  assert.equal("consent_collection" in params, false)
  assert.equal("custom_text" in params, false)
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

test("preserves funnel metadata with and without a lead", () => {
  const withLead = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    funnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    funnelPackageKey: "scalp_check_placeholder",
  })
  assert.deepEqual(withLead.metadata, {
    lead_id: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    funnel_session_id: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    funnel_package_key: "scalp_check_placeholder",
  })

  const withoutLead = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
    funnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    funnelPackageKey: "default_organic",
  })
  assert.deepEqual(withoutLead.metadata, {
    funnel_session_id: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    funnel_package_key: "default_organic",
  })
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

test("adds only hashed, short-lived preparation metadata to an Elements Session", () => {
  const params = buildStripeCheckoutSessionParams({
    origin: "https://chaarlie.example",
    priceId: "price_month",
    customerEmail: "lead@example.com",
    presentation: "elements",
    expiresAt: 1_800_000_000,
    metadata: {
      checkout_preparation_id: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
      checkout_preparation_token_hash:
        "6b8d3a953ef1f24455d1c7cc26ecf1f638ad59b2bce90373136a7c4487413f4a",
      checkout_preparation_status: "prepared",
    },
  })

  assert.equal(params.expires_at, 1_800_000_000)
  assert.deepEqual(params.metadata, {
    checkout_preparation_id: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
    checkout_preparation_token_hash:
      "6b8d3a953ef1f24455d1c7cc26ecf1f638ad59b2bce90373136a7c4487413f4a",
    checkout_preparation_status: "prepared",
  })
})
