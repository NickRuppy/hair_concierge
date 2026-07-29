import assert from "node:assert/strict"
import test from "node:test"
import {
  hashPreparedCheckoutToken,
  hasMatchingPreparedCheckoutClaim,
  isOfferCheckoutPrewarmEnabled,
  isOfferElementsCheckoutEnabled,
  preparedCheckoutClaimIdempotencyKey,
  preparedCheckoutExpiresAt,
  preparedCheckoutUnavailablePayload,
  shouldRecordFunnelForCheckoutAction,
  StripeCheckoutSessionRequestSchema,
  validatePreparedCheckoutClaim,
} from "../src/app/api/stripe/create-checkout-session/route"

const validRequest = {
  interval: "month",
  leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
  source: "quiz_result_offer",
}

const preparationToken = "8tZV8TnFh3jCxDG8oxQ6yBVqQHd5VSTKr2IZzgKZV1s"
const preparationId = "c2a89c81-7e93-4d81-98d1-c7cfd7047721"
const checkoutAttemptId = "e32f2c05-9083-4474-9334-346684de6b7e"
const funnelEventId = "a0aeff22-19f2-469f-8c4c-cd834ad9f80a"

function preparedClaimInput(
  overrides: Partial<Parameters<typeof validatePreparedCheckoutClaim>[0]> = {},
) {
  return {
    metadata: {
      checkout_preparation_id: preparationId,
      checkout_preparation_token_hash: hashPreparedCheckoutToken(preparationToken),
      checkout_preparation_status: "prepared",
      checkout_preparation_interval: "month",
      checkout_preparation_price_id: "price_month",
      checkout_preparation_source: "quiz_result_offer",
      checkout_preparation_presentation: "offer_overlay_elements",
      checkout_preparation_identity_hash: "identity-hash",
    },
    sessionStatus: "open",
    expiresAt: 2_000,
    nowSeconds: 1_000,
    lineItemPriceId: "price_month",
    preparationId,
    preparationToken,
    interval: "month" as const,
    priceId: "price_month",
    source: "quiz_result_offer" as const,
    presentation: "offer_overlay_elements" as const,
    identityHash: "identity-hash",
    checkoutAttemptId,
    funnelEventId,
    ...overrides,
  }
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

test("keeps prewarm actions disabled unless the dedicated kill switch is exactly true", () => {
  assert.equal(isOfferCheckoutPrewarmEnabled({}), false)
  assert.equal(
    isOfferCheckoutPrewarmEnabled({ NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED: "true\n" }),
    false,
  )
  assert.equal(
    isOfferCheckoutPrewarmEnabled({ NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED: "true" }),
    true,
  )
})

test("preparation never owns a checkout-start funnel event or touch consumption", () => {
  assert.equal(shouldRecordFunnelForCheckoutAction("prepare"), false)
  assert.equal(shouldRecordFunnelForCheckoutAction("create"), true)
  assert.equal(shouldRecordFunnelForCheckoutAction("claim"), true)
})

test("prepared Sessions leave a safe margin above Stripe's 30-minute expiry minimum", () => {
  const nowSeconds = 1_000_000
  const expiresAt = preparedCheckoutExpiresAt(nowSeconds)

  assert.equal(expiresAt, nowSeconds + 31 * 60)
  assert.equal(expiresAt - nowSeconds > 30 * 60, true)
})

test("prepared checkout failures use one generic client payload", () => {
  assert.deepEqual(preparedCheckoutUnavailablePayload(), {
    status: "unavailable",
    reason: "prepared_checkout_unavailable",
  })
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

test("requires the tightly-scoped preparation contract and keeps legacy creation valid", () => {
  const legacy = StripeCheckoutSessionRequestSchema.safeParse(validRequest)
  const prepared = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    presentation: "offer_overlay_elements",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
  })
  const missingPreparationId = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    presentation: "offer_overlay_elements",
  })
  const genericPreparation = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
  })

  assert.equal(legacy.success, true)
  assert.equal(prepared.success, true)
  assert.equal(missingPreparationId.success, false)
  assert.equal(genericPreparation.success, false)
})

test("requires an opaque token, matching Session reference, and real attempt IDs to claim", () => {
  const validClaim = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "claim",
    presentation: "offer_overlay_elements",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
    preparationToken: "8tZV8TnFh3jCxDG8oxQ6yBVqQHd5VSTKr2IZzgKZV1s",
    preparedSessionId: "cs_test_prepared",
    checkoutAttemptId: "e32f2c05-9083-4474-9334-346684de6b7e",
    funnelEventId: "a0aeff22-19f2-469f-8c4c-cd834ad9f80a",
  })
  const incompleteClaim = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "claim",
    presentation: "offer_overlay_elements",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
  })

  assert.equal(validClaim.success, true)
  assert.equal(incompleteClaim.success, false)
})

test("accepts only the exact preparation token for an open, matching Session", () => {
  assert.deepEqual(validatePreparedCheckoutClaim(preparedClaimInput()), {
    ok: true,
    alreadyClaimed: false,
  })
  assert.deepEqual(
    validatePreparedCheckoutClaim(
      preparedClaimInput({ preparationToken: "wrong-token-value-long-enough-to-pass-schema" }),
    ),
    { ok: false, reason: "invalid" },
  )
})

test("rejects expired or non-open prepared Sessions", () => {
  assert.deepEqual(validatePreparedCheckoutClaim(preparedClaimInput({ expiresAt: 1_000 })), {
    ok: false,
    reason: "stale",
  })
  assert.deepEqual(
    validatePreparedCheckoutClaim(preparedClaimInput({ sessionStatus: "complete" })),
    { ok: false, reason: "stale" },
  )
})

test("rejects claim metadata and line-item mismatches", () => {
  const cases = [
    preparedClaimInput({ interval: "quarter" }),
    preparedClaimInput({ priceId: "price_quarter" }),
    preparedClaimInput({ presentation: undefined }),
    preparedClaimInput({ identityHash: "different-identity" }),
    preparedClaimInput({ lineItemPriceId: "price_quarter" }),
  ]

  for (const input of cases) {
    assert.deepEqual(validatePreparedCheckoutClaim(input), { ok: false, reason: "stale" })
  }
})

test("allows only an idempotent same-attempt claim after a prepared Session is claimed", () => {
  const metadata = {
    ...preparedClaimInput().metadata,
    checkout_preparation_status: "claimed",
    checkout_attempt_id: checkoutAttemptId,
    checkout_funnel_event_id: funnelEventId,
  }
  assert.deepEqual(validatePreparedCheckoutClaim(preparedClaimInput({ metadata })), {
    ok: true,
    alreadyClaimed: true,
  })
  assert.deepEqual(
    validatePreparedCheckoutClaim(
      preparedClaimInput({
        metadata,
        checkoutAttemptId: "fe4c3c27-05b3-4d9b-9a03-aa3ca99fbb1f",
      }),
    ),
    { ok: false, reason: "invalid" },
  )
})

test("claim updates are serialized by preparation id and only accept returned matching metadata", () => {
  const metadata = {
    ...preparedClaimInput().metadata,
    checkout_preparation_status: "claimed",
    checkout_attempt_id: checkoutAttemptId,
    checkout_funnel_event_id: funnelEventId,
  }
  assert.equal(
    preparedCheckoutClaimIdempotencyKey(preparationId),
    `offer-elements-claim:${preparationId}`,
  )
  assert.equal(hasMatchingPreparedCheckoutClaim(metadata, checkoutAttemptId, funnelEventId), true)
  assert.equal(
    hasMatchingPreparedCheckoutClaim(
      metadata,
      "fe4c3c27-05b3-4d9b-9a03-aa3ca99fbb1f",
      funnelEventId,
    ),
    false,
  )
})
