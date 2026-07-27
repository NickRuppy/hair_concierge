import assert from "node:assert/strict"
import test from "node:test"
import {
  isOfferElementsCheckoutEnabled,
  StripeCheckoutSessionRequestSchema,
} from "../src/app/api/stripe/create-checkout-session/route"

const validRequest = {
  interval: "month",
  leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
  source: "quiz_result_offer",
}

test("accepts the allowlisted Elements presentation only for quiz-result offers", () => {
  const parsed = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    presentation: "offer_overlay_elements",
  })

  assert.equal(parsed.success, true)
})

test("rejects generic UI modes and non-offer Elements presentation requests", () => {
  const rawUiMode = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    ui_mode: "elements",
  })
  const nonOfferPresentation = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    source: "pricing_page",
    presentation: "offer_overlay_elements",
  })

  assert.equal(rawUiMode.success, false)
  assert.equal(nonOfferPresentation.success, false)
})

test("requires both public checkout flags before accepting an Elements session", () => {
  assert.equal(isOfferElementsCheckoutEnabled({}), false)
  assert.equal(
    isOfferElementsCheckoutEnabled({ NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED: "true" }),
    false,
  )
  assert.equal(
    isOfferElementsCheckoutEnabled({ NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED: "true" }),
    false,
  )
  assert.equal(
    isOfferElementsCheckoutEnabled({
      NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED: "true",
      NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED: "true",
    }),
    true,
  )
})

test("rejects Elements presentation for membership reactivation inputs", () => {
  const withCheckoutContext = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    presentation: "offer_overlay_elements",
    checkoutContext: "membership_reactivation",
  })
  const withReturnDestination = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    presentation: "offer_overlay_elements",
    returnDestination: "/routine",
  })

  assert.equal(withCheckoutContext.success, false)
  assert.equal(withReturnDestination.success, false)
})
