import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_LAUNCH_PRICING_CATALOG,
  resolveSubscriptionPricingCatalog,
  STANDARD_PRICING_CATALOG,
} from "../src/lib/billing/pricing-catalog"
import { PayPalSubscriptionIntentRequestSchema } from "../src/app/api/paypal/create-subscription-intent/route"
import { StripeCheckoutSessionRequestSchema } from "../src/app/api/stripe/create-checkout-session/route"
import { resolveStripeCheckoutPurchasePricing } from "../src/app/api/stripe/webhook/route"

test("the recurring acquisition catalog is owned only by the strict launch flag", () => {
  assert.equal(resolveSubscriptionPricingCatalog(true), PERSONAL_PLAN_LAUNCH_PRICING_CATALOG)
})

test("falls back to standard pricing only when the trusted launch flag is off", () => {
  assert.equal(resolveSubscriptionPricingCatalog(false), STANDARD_PRICING_CATALOG)
})

test("provider request schemas reject a browser-supplied pricing catalog", () => {
  const request = {
    interval: "month",
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    source: "quiz_result_offer",
    pricingCatalog: "personal_plan_launch_v1",
  }

  assert.equal(StripeCheckoutSessionRequestSchema.safeParse(request).success, false)
  assert.equal(PayPalSubscriptionIntentRequestSchema.safeParse(request).success, false)
})

test("Stripe purchase analytics preserves launch catalog and provider Price identity", () => {
  assert.deepEqual(
    resolveStripeCheckoutPurchasePricing(
      {
        metadata: {
          checkout_preparation_pricing_catalog: "personal_plan_launch_v1",
          checkout_preparation_price_id: "price_launch_quarter",
        },
      },
      "quarter",
    ),
    {
      planId: "premium_quarter",
      pricingCatalog: "personal_plan_launch_v1",
      providerPriceId: "price_launch_quarter",
    },
  )
  assert.equal(
    resolveStripeCheckoutPurchasePricing({ metadata: {} }, "quarter").pricingCatalog,
    "standard",
  )
})
