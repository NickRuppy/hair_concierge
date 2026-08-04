import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest } from "next/server"
import {
  canonicalOneTimeClaimMetadata,
  canonicalOneTimeClaimMetadataPatch,
  classifyCheckoutInitializationFailure,
  classifyOneTimeStripeSessionRecovery,
  hashPreparedCheckoutToken,
  hasMatchingPreparedCheckoutClaim,
  isOfferElementsCheckoutEnabled,
  hasCanonicalOneTimeClaimMetadata,
  POST,
  preparedCheckoutApplicationExpiresAt,
  preparedCheckoutClaimIdempotencyKey,
  preparedCheckoutCreateIdempotencyKey,
  preparedCheckoutExpiresAt,
  preparedCheckoutUnavailablePayload,
  reportPreparedCheckoutControlOutcome,
  reportMissingExactOfferFunnelContext,
  reusableOneTimeStripeSessionClientSecret,
  reportStripeCheckoutInitializationFailure,
  resolveCheckoutFunnelContext,
  resolveStripeCheckoutSessionCreateOptions,
  resolvePreparedCheckoutPricing,
  resolveOneTimeConsentFunnelContext,
  shouldRecordFunnelForCheckoutAction,
  StripeCheckoutSessionRequestSchema,
  validatePreparedCheckoutCanonicalMetadataRepair,
  validatePreparedCheckoutClaim,
  quizOfferMembershipCreateIdempotencyKey,
} from "../src/app/api/stripe/create-checkout-session/route"

const routeSource = readFileSync(
  new URL("../src/app/api/stripe/create-checkout-session/route.ts", import.meta.url),
  "utf8",
)

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
    checkoutAttemptId,
    checkoutSessionAttemptId: "3bb694df-6cdf-4615-a8c7-4a0c787c2a34",
  })

  assert.equal(parsed.success, true)
})

test("accepts only one-time prepare/claim and rejects direct creation or a missing lead", () => {
  const oneTimeBase = {
    purchaseKind: "personal_plan_once" as const,
    leadId: "8d9675fe-f955-46a2-84dc-0ef5e94009d1",
    funnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
    source: "quiz_result_offer" as const,
    presentation: "offer_overlay_elements" as const,
  }
  const unsupportedDirectCreate = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    checkoutAttemptId,
    funnelEventId,
  })
  const validPreparation = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "prepare",
    preparationId,
    preparationToken,
  })
  const validClaim = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "claim",
    preparationId,
    preparationToken,
    preparedSessionId: "cs_test_personal_plan_once",
    checkoutAttemptId,
    funnelEventId,
  })
  const claimWithMembershipSessionAttempt = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    action: "claim",
    preparationId,
    preparationToken,
    preparedSessionId: "cs_test_personal_plan_once",
    checkoutAttemptId,
    checkoutSessionAttemptId: "3bb694df-6cdf-4615-a8c7-4a0c787c2a34",
    funnelEventId,
  })
  const claimWithFakeConsent = StripeCheckoutSessionRequestSchema.safeParse({
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
  const preparationWithoutLead = StripeCheckoutSessionRequestSchema.safeParse({
    ...oneTimeBase,
    leadId: undefined,
    action: "prepare",
    preparationId,
    preparationToken,
  })

  assert.equal(unsupportedDirectCreate.success, false)
  assert.equal(validPreparation.success, true)
  assert.equal(validClaim.success, true)
  assert.equal(claimWithMembershipSessionAttempt.success, false)
  assert.equal(claimWithFakeConsent.success, false)
  assert.equal(withSubscriptionInterval.success, false)
  assert.equal(withoutAttempt.success, false)
  assert.equal(browserAmount.success, false)
  assert.equal(preparationWithoutLead.success, false)
})

test("unsupported one-time direct creation stops at the request boundary", async () => {
  const response = await POST(
    new NextRequest("https://chaarlie.de/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        purchaseKind: "personal_plan_once",
        leadId: validRequest.leadId,
        funnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
        source: "quiz_result_offer",
        presentation: "offer_overlay_elements",
        checkoutAttemptId,
        funnelEventId,
      }),
    }),
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "bad request" })
})

test("quiz-offer membership idempotency is stable within a Session attempt and fresh on retry", () => {
  const firstSessionAttemptId = "3bb694df-6cdf-4615-a8c7-4a0c787c2a34"
  const retrySessionAttemptId = "fe4c3c27-05b3-4d9b-9a03-aa3ca99fbb1f"
  const first = resolveStripeCheckoutSessionCreateOptions({
    isPreparation: false,
    isOneTimePurchase: false,
    source: "quiz_result_offer",
    checkoutAttemptId,
    checkoutSessionAttemptId: firstSessionAttemptId,
  })
  const replay = resolveStripeCheckoutSessionCreateOptions({
    isPreparation: false,
    isOneTimePurchase: false,
    source: "quiz_result_offer",
    checkoutAttemptId,
    checkoutSessionAttemptId: firstSessionAttemptId,
  })
  const retry = resolveStripeCheckoutSessionCreateOptions({
    isPreparation: false,
    isOneTimePurchase: false,
    source: "quiz_result_offer",
    checkoutAttemptId,
    checkoutSessionAttemptId: retrySessionAttemptId,
  })
  const legacyAsset = resolveStripeCheckoutSessionCreateOptions({
    isPreparation: false,
    isOneTimePurchase: false,
    source: "quiz_result_offer",
    checkoutAttemptId,
  })

  assert.deepEqual(first, {
    idempotencyKey: quizOfferMembershipCreateIdempotencyKey(firstSessionAttemptId),
  })
  assert.deepEqual(replay, first)
  assert.notDeepEqual(retry, first)
  assert.deepEqual(legacyAsset, {
    idempotencyKey: quizOfferMembershipCreateIdempotencyKey(checkoutAttemptId),
  })
  assert.match(
    routeSource,
    /exactOfferFunnelSessionId = source === "quiz_result_offer" \? funnelSessionId : undefined/,
  )
  assert.match(
    routeSource,
    /resolveFunnelContextForLead\(resolvedLeadId, exactOfferFunnelSessionId\)/,
  )
})

test("pinned offer attribution falls back only to the same signed cookie session", () => {
  const exactSessionId = "7a9675fe-f955-46a2-84dc-0ef5e94009d2"
  const leadContext = { sessionId: exactSessionId, isInternalTest: true }
  const matchingCookie = { sessionId: exactSessionId, packageKey: "personal-plan-membership-v1" }
  const otherCookie = {
    sessionId: "9f3922cf-ce08-4454-b03d-f64bf3261bb0",
    packageKey: "personal-plan-membership-v1",
  }

  assert.equal(
    resolveCheckoutFunnelContext({
      shouldRecord: true,
      exactOfferFunnelSessionId: exactSessionId,
      leadFunnelContext: leadContext,
      cookieFunnelContext: otherCookie,
    }),
    leadContext,
  )
  assert.equal(
    resolveCheckoutFunnelContext({
      shouldRecord: true,
      exactOfferFunnelSessionId: exactSessionId,
      leadFunnelContext: null,
      cookieFunnelContext: matchingCookie,
    }),
    matchingCookie,
  )
  assert.equal(
    resolveCheckoutFunnelContext({
      shouldRecord: true,
      exactOfferFunnelSessionId: exactSessionId,
      leadFunnelContext: null,
      cookieFunnelContext: otherCookie,
    }),
    null,
  )
  assert.equal(
    resolveCheckoutFunnelContext({
      shouldRecord: false,
      exactOfferFunnelSessionId: exactSessionId,
      leadFunnelContext: leadContext,
      cookieFunnelContext: matchingCookie,
    }),
    null,
  )
})

test("missing exact offer attribution is reported without identifiers or blocking checkout", () => {
  const captures: Array<{ error: unknown; details: unknown }> = []
  const reported = reportMissingExactOfferFunnelContext(
    {
      shouldRecord: true,
      exactOfferFunnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
      funnelContext: null,
      interval: "month",
    },
    (error, details) => captures.push({ error, details }),
  )

  assert.equal(reported, true)
  assert.equal(captures.length, 1)
  assert.match(String(captures[0]?.error), /quiz offer funnel context unavailable/)
  assert.deepEqual(captures[0]?.details, {
    provider: "stripe",
    stage: "stripe_checkout_session_create",
    source: "quiz_result_offer",
    interval: "month",
    reason: "funnel_context_unavailable",
  })
  assert.equal(
    reportMissingExactOfferFunnelContext(
      {
        shouldRecord: true,
        exactOfferFunnelSessionId: "7a9675fe-f955-46a2-84dc-0ef5e94009d2",
        funnelContext: null,
        interval: "month",
      },
      () => {
        throw new Error("telemetry unavailable")
      },
      () => {},
    ),
    true,
  )
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
  const sessionAttemptOutsideOffer = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    source: "pricing_page",
    checkoutAttemptId,
    checkoutSessionAttemptId: "3bb694df-6cdf-4615-a8c7-4a0c787c2a34",
  })

  assert.equal(rawUiMode.success, false)
  assert.equal(nonOfferPresentation.success, false)
  assert.equal(sessionAttemptOutsideOffer.success, false)
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

test("prepared and recovered one-time Sessions use a capped server-clock application deadline", () => {
  const nowSeconds = 1_000_000
  const expiresAt = preparedCheckoutExpiresAt(nowSeconds)

  assert.equal(expiresAt, nowSeconds + 31 * 60)
  assert.equal(expiresAt - nowSeconds > 30 * 60, true)
  assert.equal(preparedCheckoutApplicationExpiresAt(nowSeconds + 60 * 60, nowSeconds), expiresAt)
  const recoveredOneTimeStripeExpiry = nowSeconds + 60
  assert.equal(
    preparedCheckoutApplicationExpiresAt(recoveredOneTimeStripeExpiry, nowSeconds),
    recoveredOneTimeStripeExpiry,
  )
})

test("prepared checkout retries keep the provider idempotency proof stable until refresh", () => {
  const preparationId = "c2a89c81-7e93-4d81-98d1-c7cfd7047721"
  const refreshedPreparationId = "d3b90d92-8fa4-4e92-a9e2-d8dfe8158832"
  const refreshedToken = "9uAW9UoGi4kDyEH9pyR7zCWrRIe6WTULs3Ja0hLaW2t"

  const first = {
    idempotencyKey: preparedCheckoutCreateIdempotencyKey(preparationId),
    tokenHash: hashPreparedCheckoutToken(preparationToken),
  }
  const retry = {
    idempotencyKey: preparedCheckoutCreateIdempotencyKey(preparationId),
    tokenHash: hashPreparedCheckoutToken(preparationToken),
  }
  const refreshed = {
    idempotencyKey: preparedCheckoutCreateIdempotencyKey(refreshedPreparationId),
    tokenHash: hashPreparedCheckoutToken(refreshedToken),
  }

  assert.deepEqual(retry, first)
  assert.notEqual(refreshed.idempotencyKey, first.idempotencyKey)
  assert.notEqual(refreshed.tokenHash, first.tokenHash)
})

test("prepared checkout failures use one generic client payload", () => {
  assert.deepEqual(preparedCheckoutUnavailablePayload(), {
    status: "unavailable",
    reason: "prepared_checkout_unavailable",
  })
})

test("prepared checkout control outcomes capture a sanitized, correlated degradation signal", async () => {
  const captured: unknown[] = []
  let flushCalls = 0
  const causes = [
    "authorization_unavailable",
    "provider_locked_paypal",
    "provider_locked_stripe",
    "access_conflict",
    "lead_lookup_unavailable",
    "identity_unavailable",
    "preparation_token_mismatch",
    "prepared_session_missing",
    "prepared_pricing_missing",
    "consent_context_missing",
    "claim_validation_failed",
    "canonical_metadata_repair_failed",
    "prepared_client_secret_missing",
    "claim_update_failed",
    "claim_metadata_mismatch",
  ] as const

  for (const cause of causes) {
    await reportPreparedCheckoutControlOutcome(
      {
        cause,
        commerceKind: "one_time",
        isInternalTest: true,
        leadId: validRequest.leadId,
        checkoutAttemptId: "50000000-0000-4000-8000-000000000099",
        source: "quiz_result_offer",
      },
      {
        capture: (details) => {
          captured.push(details)
          return "a".repeat(32)
        },
        flush: async () => {
          flushCalls += 1
          return true
        },
        schedule: (task) => {
          void task()
        },
        environment: {
          VERCEL_ENV: "production",
          STRIPE_SECRET_KEY: "sk_live_safe_test_key",
        },
      },
    )
  }

  assert.equal(flushCalls, causes.length)
  assert.equal(captured.length, causes.length)
  assert.deepEqual(
    captured.map((details) => (details as { status?: unknown }).status),
    causes,
  )
  assert.deepEqual(captured[0], {
    signal: "checkout_experience_degraded",
    provider: "stripe",
    boundary: "provider_session",
    errorFamily: "control_outcome",
    commerceKind: "one_time",
    origin: "provider_api",
    method: "unknown",
    truth: "unknown",
    live: true,
    isInternalTest: true,
    retryable: "true",
    source: "quiz_result_offer",
    leadId: validRequest.leadId,
    checkoutAttemptId: "50000000-0000-4000-8000-000000000099",
    status: "authorization_unavailable",
  })
  assert.equal((captured[1] as { signal?: unknown }).signal, "customer_payment_error_observed")
  assert.equal((captured[3] as { signal?: unknown }).signal, "customer_payment_error_observed")
  assert.doesNotMatch(JSON.stringify(captured), /customer@example.com|cs_[A-Za-z0-9_]+/i)
})

test("prepared checkout control telemetry failure is contained", async () => {
  await assert.doesNotReject(() =>
    reportPreparedCheckoutControlOutcome(
      {
        cause: "provider_locked_paypal",
        commerceKind: "one_time",
        isInternalTest: false,
        source: "quiz_result_offer",
      },
      {
        capture: () => {
          throw new Error("telemetry unavailable")
        },
        flush: async () => {
          throw new Error("flush unavailable")
        },
        environment: {},
      },
    ),
  )
})

test("prepared checkout control telemetry flush does not delay the recovery response", async () => {
  let scheduledTask: (() => Promise<void>) | undefined
  let flushResolved = false
  const report = reportPreparedCheckoutControlOutcome(
    {
      cause: "prepared_session_missing",
      commerceKind: "one_time",
      isInternalTest: false,
      source: "quiz_result_offer",
    },
    {
      capture: () => "a".repeat(32),
      flush: async () => {
        await new Promise<void>((resolve) => setImmediate(resolve))
        flushResolved = true
        return true
      },
      schedule: (task) => {
        scheduledTask = task
      },
      environment: {},
    },
  )

  await report
  assert.equal(flushResolved, false)
  assert.ok(scheduledTask)
  await scheduledTask?.()
  assert.equal(flushResolved, true)
})

test("prepared checkout control telemetry does not schedule a flush without an event receipt", async () => {
  let scheduleCalls = 0

  await reportPreparedCheckoutControlOutcome(
    {
      cause: "provider_locked_stripe",
      commerceKind: "one_time",
      isInternalTest: false,
      source: "quiz_result_offer",
    },
    {
      capture: () => undefined,
      flush: async () => true,
      schedule: () => {
        scheduleCalls += 1
      },
      environment: {},
    },
  )

  assert.equal(scheduleCalls, 0)
})

test("checkout initialization failures retain only closed provider causes", () => {
  assert.deepEqual(classifyCheckoutInitializationFailure({ code: "idempotency_error" }), {
    errorFamily: "provider_session",
    status: "idempotency_conflict",
  })
  assert.deepEqual(classifyCheckoutInitializationFailure({ statusCode: 429 }), {
    errorFamily: "provider_unavailable",
    status: "rate_limited",
  })
  assert.deepEqual(classifyCheckoutInitializationFailure({ code: "price_not_configured" }), {
    errorFamily: "configuration",
    status: "configuration_missing",
  })
  assert.deepEqual(
    classifyCheckoutInitializationFailure(
      new Error("customer@example.com cs_secret_should_not_escape"),
    ),
    { errorFamily: "unknown", status: "unknown" },
  )
})

test("unexpected checkout initialization failures capture once, flush once, and use live runtime truth", async () => {
  const captured: unknown[] = []
  let flushCalls = 0

  await reportStripeCheckoutInitializationFailure(
    {
      error: { code: "idempotency_error", message: "cs_secret_never_reported" },
      commerceKind: "one_time",
      isInternalTest: true,
      leadId: validRequest.leadId,
      source: "quiz_result_offer",
    },
    {
      capture: (details) => {
        captured.push(details)
        return undefined
      },
      flush: async () => {
        flushCalls += 1
        return true
      },
      environment: {
        VERCEL_ENV: "production",
        STRIPE_SECRET_KEY: "sk_live_safe_test_key",
      },
    },
  )

  assert.equal(captured.length, 1)
  assert.equal(flushCalls, 1)
  assert.deepEqual(captured[0], {
    signal: "payment_checkout_initialization_failed",
    provider: "stripe",
    boundary: "provider_session",
    errorFamily: "provider_session",
    commerceKind: "one_time",
    origin: "provider_api",
    method: "unknown",
    truth: "unknown",
    live: true,
    isInternalTest: true,
    source: "quiz_result_offer",
    leadId: validRequest.leadId,
    status: "idempotency_conflict",
  })
  assert.doesNotMatch(JSON.stringify(captured), /cs_secret|message|token/i)
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

test("keeps tightly-scoped subscription preparation only for the documented asset-drain window", () => {
  const legacy = StripeCheckoutSessionRequestSchema.safeParse(validRequest)
  const prepared = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    presentation: "offer_overlay_elements",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
    preparationToken,
  })
  const missingPreparationId = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    presentation: "offer_overlay_elements",
  })
  const missingPreparationToken = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    presentation: "offer_overlay_elements",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
  })
  const genericPreparation = StripeCheckoutSessionRequestSchema.safeParse({
    ...validRequest,
    action: "prepare",
    preparationId: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
  })

  assert.equal(legacy.success, true)
  assert.equal(prepared.success, true)
  assert.equal(missingPreparationId.success, false)
  assert.equal(missingPreparationToken.success, false)
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

test("one-time prepared claims use the accepted consent's funnel session over a later cookie", () => {
  const consentSessionId = "7a9675fe-f955-46a2-84dc-0ef5e94009d2"
  const cookieSessionId = "1a9675fe-f955-46a2-84dc-0ef5e94009d2"
  const context = resolveOneTimeConsentFunnelContext({
    consentId: "consent-1",
    expectedLeadId: validRequest.leadId,
    expectedFunnelSessionId: consentSessionId,
    consent: {
      id: "consent-1",
      lead_id: validRequest.leadId,
      funnel_session_id: consentSessionId,
      product_kind: "personal_plan_once",
      offer_variant: "personal-plan-one-time-v1",
    },
    funnelSession: {
      id: consentSessionId,
      lead_id: validRequest.leadId,
      visitor_id: "9a9675fe-f955-46a2-84dc-0ef5e94009d2",
      package_key: "default_organic",
      offer_variant: "personal-plan-one-time-v1",
      first_seen_at: "2026-07-31T10:00:00.000Z",
    },
  })

  assert.deepEqual(context, {
    visitorId: "9a9675fe-f955-46a2-84dc-0ef5e94009d2",
    sessionId: consentSessionId,
    packageKey: "default_organic",
    issuedAt: Date.parse("2026-07-31T10:00:00.000Z"),
    leadId: validRequest.leadId,
    offerVariant: "personal-plan-one-time-v1",
  })
  assert.notEqual(context?.sessionId, cookieSessionId)
  assert.deepEqual(canonicalOneTimeClaimMetadata(context!), {
    lead_id: validRequest.leadId,
    funnel_session_id: consentSessionId,
    funnel_package_key: "default_organic",
    offer_variant: "personal-plan-one-time-v1",
  })
  assert.equal(
    hasCanonicalOneTimeClaimMetadata(
      {
        lead_id: validRequest.leadId,
        funnel_session_id: consentSessionId,
        funnel_package_key: "default_organic",
        offer_variant: "personal-plan-one-time-v1",
      },
      context!,
    ),
    true,
  )
  assert.equal(
    hasCanonicalOneTimeClaimMetadata(
      {
        lead_id: validRequest.leadId,
        funnel_session_id: cookieSessionId,
        funnel_package_key: "default_organic",
        offer_variant: "personal-plan-one-time-v1",
      },
      context!,
    ),
    false,
  )
  assert.equal(
    resolveOneTimeConsentFunnelContext({
      consentId: "consent-1",
      expectedLeadId: validRequest.leadId,
      expectedFunnelSessionId: consentSessionId,
      consent: {
        id: "consent-1",
        lead_id: validRequest.leadId,
        funnel_session_id: cookieSessionId,
        product_kind: "personal_plan_once",
        offer_variant: "personal-plan-one-time-v1",
      },
      funnelSession: {
        id: cookieSessionId,
        lead_id: validRequest.leadId,
        visitor_id: "9a9675fe-f955-46a2-84dc-0ef5e94009d2",
        package_key: "default_organic",
        offer_variant: "personal-plan-one-time-v1",
        first_seen_at: "2026-07-31T10:00:00.000Z",
      },
    }),
    null,
  )
})

test("already-complete one-time prepared claims repair only missing canonical consent metadata", () => {
  const consentId = "0f762541-b540-4d26-8328-28d79737d39c"
  const consentSessionId = "7a9675fe-f955-46a2-84dc-0ef5e94009d2"
  const context = {
    visitorId: "9a9675fe-f955-46a2-84dc-0ef5e94009d2",
    sessionId: consentSessionId,
    packageKey: "default_organic",
    issuedAt: Date.parse("2026-07-31T10:00:00.000Z"),
    leadId: validRequest.leadId,
    offerVariant: "personal-plan-one-time-v1" as const,
  }
  const claimedMetadata = {
    ...preparedClaimInput({
      interval: "one_time",
      priceId: "price_once",
      lineItemPriceId: "price_once",
    }).metadata,
    checkout_preparation_interval: "one_time",
    checkout_preparation_price_id: "price_once",
    checkout_preparation_status: "claimed",
    checkout_attempt_id: checkoutAttemptId,
    checkout_funnel_event_id: funnelEventId,
    personal_plan_once_consent_id: consentId,
  }
  const expectedPatch = {
    lead_id: validRequest.leadId,
    funnel_session_id: consentSessionId,
    funnel_package_key: "default_organic",
    offer_variant: "personal-plan-one-time-v1",
  }

  assert.deepEqual(canonicalOneTimeClaimMetadataPatch(claimedMetadata, context), expectedPatch)
  assert.deepEqual(
    validatePreparedCheckoutCanonicalMetadataRepair({
      metadata: claimedMetadata,
      sessionStatus: "complete",
      lineItemPriceId: "price_once",
      preparationId,
      preparationToken,
      interval: "one_time",
      priceId: "price_once",
      source: "quiz_result_offer",
      presentation: "offer_overlay_elements",
      identityHash: "identity-hash",
      checkoutAttemptId,
      funnelEventId,
      oneTimeConsentId: consentId,
      context,
    }),
    {
      ok: true,
      patch: expectedPatch,
    },
  )
  assert.deepEqual(
    validatePreparedCheckoutCanonicalMetadataRepair({
      metadata: { ...claimedMetadata, lead_id: "9d9675fe-f955-46a2-84dc-0ef5e94009d9" },
      sessionStatus: "complete",
      lineItemPriceId: "price_once",
      preparationId,
      preparationToken,
      interval: "one_time",
      priceId: "price_once",
      source: "quiz_result_offer",
      presentation: "offer_overlay_elements",
      identityHash: "identity-hash",
      checkoutAttemptId,
      funnelEventId,
      oneTimeConsentId: consentId,
      context,
    }),
    {
      ok: false,
    },
  )
  assert.deepEqual(
    validatePreparedCheckoutCanonicalMetadataRepair({
      metadata: claimedMetadata,
      sessionStatus: "open",
      lineItemPriceId: "price_once",
      preparationId,
      preparationToken,
      interval: "one_time",
      priceId: "price_once",
      source: "quiz_result_offer",
      presentation: "offer_overlay_elements",
      identityHash: "identity-hash",
      checkoutAttemptId,
      funnelEventId,
      oneTimeConsentId: consentId,
      context,
    }),
    {
      ok: false,
    },
  )
})
