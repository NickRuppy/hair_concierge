import assert from "node:assert/strict"
import test from "node:test"
import {
  classifyOneTimeStripeSessionRecovery,
  hashPreparedCheckoutToken,
  hasMatchingPreparedCheckoutClaim,
  isOfferCheckoutPrewarmEnabled,
  isOfferElementsCheckoutEnabled,
  preparedCheckoutClaimIdempotencyKey,
  preparedCheckoutExpiresAt,
  preparedCheckoutUnavailablePayload,
  reusableOneTimeStripeSessionClientSecret,
  resolvePreparedCheckoutPricing,
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

test("accepts only the narrow one-time personal-plan request contract", () => {
  const oneTimeBase = {
    purchaseKind: "personal_plan_once" as const,
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    funnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    source: "quiz_result_offer" as const,
    presentation: "offer_overlay_elements" as const,
  }
  const validOneTime = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    checkoutAttemptId,
    funnelEventId,
    consentAccepted: true,
    consentCopyVersion: "2026-07-31",
  })
  const validPreparation = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "prepare",
    preparationId,
  })
  const validClaim = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "claim",
    preparationId,
    preparationToken,
    preparedSessionId: "cs_test_personal_plan_once",
    checkoutAttemptId,
    funnelEventId,
    consentAccepted: true,
    consentCopyVersion: "2026-07-31",
  })
  const claimWithoutConsent = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "claim",
    preparationId,
    preparationToken,
    preparedSessionId: "cs_test_personal_plan_once",
    checkoutAttemptId,
    funnelEventId,
  })
  const withSubscriptionInterval = StripeCheckoutSessionRequestSchema.safeParse({
    purchaseKind: "personal_plan_once",
    interval: "month",
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    source: "quiz_result_offer",
    presentation: "offer_overlay_elements",
    checkoutAttemptId,
    funnelEventId,
  })
  const withoutAttempt = StripeCheckoutSessionRequestSchema.safeParse({
    purchaseKind: "personal_plan_once",
    source: "quiz_result_offer",
    presentation: "offer_overlay_elements",
  })
  const browserAmount = StripeCheckoutSessionRequestSchema.safeParse({
    purchaseKind: "personal_plan_once",
    source: "quiz_result_offer",
    presentation: "offer_overlay_elements",
    checkoutAttemptId,
    funnelEventId,
    amount: 1,
  })

  assert.equal(validOneTime.success, true)
  assert.equal(validPreparation.success, true)
  assert.equal(validClaim.success, true)
  assert.equal(claimWithoutConsent.success, false)
  assert.equal(withSubscriptionInterval.success, false)
  assert.equal(withoutAttempt.success, false)
  assert.equal(browserAmount.success, false)
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

test("one-time checkout reuses only an open Stripe Session with a client secret", () => {
  assert.equal(
    reusableOneTimeStripeSessionClientSecret({
      status: "open",
      client_secret: "cs_secret_reusable",
    }),
    "cs_secret_reusable",
  )
  assert.equal(
    reusableOneTimeStripeSessionClientSecret({
      status: "expired",
      client_secret: "cs_secret_expired",
    }),
    null,
  )
  assert.deepEqual(
    classifyOneTimeStripeSessionRecovery({
      status: "open",
      client_secret: "cs_secret_reusable",
    }),
    { type: "reuse", clientSecret: "cs_secret_reusable" },
  )
  assert.deepEqual(
    classifyOneTimeStripeSessionRecovery({
      status: "expired",
      client_secret: "cs_secret_expired",
    }),
    { type: "replace" },
  )
  assert.deepEqual(
    classifyOneTimeStripeSessionRecovery({ status: "complete", client_secret: null }),
    { type: "complete" },
  )
  assert.equal(
    reusableOneTimeStripeSessionClientSecret({
      status: "complete",
      client_secret: "cs_secret_complete",
    }),
    null,
  )
  assert.equal(
    reusableOneTimeStripeSessionClientSecret({
      status: "open",
      client_secret: null,
    }),
    null,
  )
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

test("derives a prepared launch claim from its allowlisted stored Price after flag-off", () => {
  const envKey = "STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_MONTHLY"
  const previous = process.env[envKey]
  process.env[envKey] = "price_launch_month"
  try {
    const resolved = resolvePreparedCheckoutPricing({
      isOneTimePurchase: false,
      lineItemPriceId: "price_launch_month",
      metadata: {
        checkout_preparation_interval: "month",
        checkout_preparation_price_id: "price_launch_month",
        checkout_preparation_pricing_catalog: "personal_plan_launch_v1",
      },
      requestedInterval: "month",
    })

    assert.equal(resolved?.interval, "month")
    assert.equal(resolved?.priceId, "price_launch_month")
    assert.equal(resolved?.pricingCatalog, "personal_plan_launch_v1")
    assert.equal(resolved?.analyticsPlan.amount, 9.99)
  } finally {
    if (previous === undefined) delete process.env[envKey]
    else process.env[envKey] = previous
  }
})

test("rejects prepared subscription Prices with unknown or mismatched catalog metadata", () => {
  const envKey = "STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_MONTHLY"
  const previous = process.env[envKey]
  process.env[envKey] = "price_launch_month"
  try {
    const base = {
      isOneTimePurchase: false,
      lineItemPriceId: "price_launch_month",
      requestedInterval: "month" as const,
    }
    assert.equal(
      resolvePreparedCheckoutPricing({
        ...base,
        metadata: {
          checkout_preparation_interval: "month",
          checkout_preparation_price_id: "price_launch_month",
          checkout_preparation_pricing_catalog: "standard",
        },
      }),
      null,
    )
    assert.equal(
      resolvePreparedCheckoutPricing({
        ...base,
        lineItemPriceId: "price_unknown",
        metadata: {
          checkout_preparation_interval: "month",
          checkout_preparation_price_id: "price_unknown",
          checkout_preparation_pricing_catalog: "personal_plan_launch_v1",
        },
      }),
      null,
    )
  } finally {
    if (previous === undefined) delete process.env[envKey]
    else process.env[envKey] = previous
  }
})

test("accepts a pre-deploy standard prepared Session without catalog metadata", () => {
  const envKey = "STRIPE_PRICE_ID_MONTHLY"
  const previous = process.env[envKey]
  process.env[envKey] = "price_standard_month"
  try {
    const resolved = resolvePreparedCheckoutPricing({
      isOneTimePurchase: false,
      lineItemPriceId: "price_standard_month",
      metadata: {
        checkout_preparation_interval: "month",
        checkout_preparation_price_id: "price_standard_month",
      },
      requestedInterval: "month",
    })

    assert.equal(resolved?.pricingCatalog, "standard")
    assert.equal(resolved?.analyticsPlan.amount, 14.99)
  } finally {
    if (previous === undefined) delete process.env[envKey]
    else process.env[envKey] = previous
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
      { ...metadata, personal_plan_once_consent_id: "consent-1" },
      checkoutAttemptId,
      funnelEventId,
      "consent-1",
    ),
    true,
  )
  assert.equal(
    hasMatchingPreparedCheckoutClaim(
      { ...metadata, personal_plan_once_consent_id: "consent-2" },
      checkoutAttemptId,
      funnelEventId,
      "consent-1",
    ),
    false,
  )
  assert.equal(
    hasMatchingPreparedCheckoutClaim(
      metadata,
      "fe4c3c27-05b3-4d9b-9a03-aa3ca99fbb1f",
      funnelEventId,
    ),
    false,
  )
})
