import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { observeOnceVisible } from "../src/lib/analytics/observe-once-visible"
import {
  canConfirmPreparedOfferCheckout,
  canUseApplePayCapabilitySignal,
  claimOfferProviderLock,
  isCurrentOfferCheckoutPreparationGeneration,
  isOfferCheckoutPrewarmPageRequestLimitReached,
  readPreparedOfferCheckoutResponse,
  releaseOfferProviderLock,
} from "../src/components/quiz/result-offer-pricing"
import { isOfferCheckoutPrewarmEnabled } from "../src/lib/funnel/flags"
import { STRIPE_PRICING_PLANS } from "../src/lib/stripe/pricing-plans"

const pricingSource = readFileSync(
  new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url),
  "utf8",
)
const planSelectorSource = readFileSync(
  new URL("../src/components/checkout/subscription-plan-selector.tsx", import.meta.url),
  "utf8",
)

test("offer analytics plan metadata matches canonical purchase IDs and advertised values", () => {
  assert.deepEqual(
    STRIPE_PRICING_PLANS.map(({ analyticsId, amount, currency, interval }) => ({
      analyticsId,
      amount,
      currency,
      interval,
    })),
    [
      { analyticsId: "premium_month", amount: 14.99, currency: "EUR", interval: "month" },
      { analyticsId: "premium_quarter", amount: 34.99, currency: "EUR", interval: "quarter" },
      { analyticsId: "premium_year", amount: 99.99, currency: "EUR", interval: "year" },
    ],
  )
})

test("visibility-based pricing tracking preserves funnel attribution metadata", () => {
  assert.match(pricingSource, /const funnelEventId = createFunnelEventId\(\)/)
  assert.match(pricingSource, /offerTracking \?\? getCurrentFunnelContext\(\)/)
  assert.match(pricingSource, /offerContext\?\.funnelSessionId \?\? context\?\.funnelSessionId/)
  assert.match(pricingSource, /offerContext\?\.funnelPackageKey \?\? context\?\.funnelPackageKey/)
  assert.match(pricingSource, /pricingRevision: OFFER_PRICING_REVISION/)
  assert.match(pricingSource, /availableIntervals: STRIPE_PRICING_PLANS/)
  assert.match(pricingSource, /trackAppEvent\("pricing_viewed", \{\s*\.\.\.offerContext,/)
})

test("offer pricing tracks plan, checkout, payment-method, and sanitized failure diagnostics", () => {
  assert.match(pricingSource, /trackAppEvent\("offer_plan_selected"/)
  assert.match(pricingSource, /trackAppEvent\("offer_checkout_opened"/)
  assert.match(pricingSource, /checkoutPresentation:/)
  assert.match(pricingSource, /trackAppEvent\("offer_payment_method_selected"/)
  assert.match(pricingSource, /trackAppEvent\("checkout_start_failed"/)
  assert.match(pricingSource, /errorCode: "stripe_session_request_failed"/)
  assert.match(pricingSource, /errorCode: "stripe_js_load_failed"/)
  assert.doesNotMatch(pricingSource, /errorCode: error\.message/)
  assert.match(planSelectorSource, /data-offer-cta=\{offerTracking \? "pricing_primary"/)
  assert.match(pricingSource, /<SubscriptionPlanSelector\s*offerTracking/)
  assert.match(pricingSource, /const nextAttempt = checkoutAttemptController\.open\(\)/)
  assert.match(pricingSource, /if \(!nextAttempt\.isNew\)/)
  assert.match(pricingSource, /const nextCheckoutAttemptId = nextAttempt\.checkoutAttemptId/)
  assert.match(pricingSource, /checkoutAttemptId: nextCheckoutAttemptId/)
  assert.match(
    pricingSource,
    /checkoutAttemptId,\s*\n\s*(?:\.\.\.\(expressElementsEnabled[\s\S]*?\),\s*\n\s*)?\}\),/,
  )
  assert.match(pricingSource, /checkoutStartTrigger: "automatic_mount"/)
  assert.match(pricingSource, /checkoutStartTrigger: "explicit_provider_action"/)
  assert.match(pricingSource, /isStripeExpressCheckoutEnabled/)
  assert.match(
    pricingSource,
    /const expressElementsEnabled = paymentOverlayEnabled && isStripeExpressCheckoutEnabled\(\)/,
  )
  assert.match(
    pricingSource,
    /expressElementsEnabled \? \{ presentation: "offer_overlay_elements" \} : \{\}/,
  )
  assert.match(pricingSource, /expressElementsEnabled=\{expressElementsEnabled\}/)
  assert.match(pricingSource, /lockedProvider=\{expressElementsEnabled \? lockedProvider : null\}/)
  assert.match(pricingSource, /onProviderLockClaim=\{expressElementsEnabled/)
  assert.match(pricingSource, /onProviderLockRelease=\{expressElementsEnabled/)
  assert.match(pricingSource, /paymentMethodType\?: "apple_pay" \| "payment_element"/)
  assert.match(pricingSource, /resetOfferProviderLock\(\)/)
  assert.match(pricingSource, /checkoutAttemptController\.claimFailure\(/)
  assert.match(pricingSource, /checkoutAttemptController\.retry\(\)/)
  assert.match(pricingSource, /checkoutAttemptController\.close\(\)/)
  assert.match(pricingSource, /setCheckoutAttemptId\(null\)/)
  assert.match(pricingSource, /setCheckoutAttemptId\(nextCheckoutAttemptId\)/)
  assert.match(
    pricingSource,
    /if \(!stripePublishableKey && \(paymentOverlayEnabled \|\| !paypalEnabled\)\) \{[\s\S]*?attemptId: nextCheckoutAttemptId,[\s\S]*?errorCode: "stripe_publishable_key_missing"/,
  )
  assert.match(pricingSource, /if \(!paymentOverlayEnabled\) scrollInlineCheckoutIntoView\(\)/)
})

test("offer provider lock rejects a competing same-frame payment claim", () => {
  const stripeClaim = claimOfferProviderLock(null, "stripe")
  assert.deepEqual(stripeClaim, { accepted: true, provider: "stripe" })
  assert.deepEqual(claimOfferProviderLock(stripeClaim.provider, "paypal"), {
    accepted: false,
    provider: "stripe",
  })
  assert.deepEqual(releaseOfferProviderLock(stripeClaim.provider, "paypal"), {
    accepted: false,
    provider: "stripe",
  })
  assert.deepEqual(releaseOfferProviderLock(stripeClaim.provider, "stripe"), {
    accepted: true,
    provider: null,
  })
  assert.deepEqual(claimOfferProviderLock(null, "paypal"), {
    accepted: true,
    provider: "paypal",
  })
})

test("Apple Pay prewarm is gated by native wallet capability and a strict public flag", () => {
  const previous = process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED

  try {
    delete process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED
    assert.equal(isOfferCheckoutPrewarmEnabled(), false)

    process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED = "false"
    assert.equal(isOfferCheckoutPrewarmEnabled(), false)

    process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED = "true"
    assert.equal(isOfferCheckoutPrewarmEnabled(), true)
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED
    } else {
      process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED = previous
    }
  }

  assert.equal(canUseApplePayCapabilitySignal(undefined), false)
  assert.equal(canUseApplePayCapabilitySignal({} as Window), false)
  assert.equal(
    canUseApplePayCapabilitySignal({
      ApplePaySession: { canMakePayments: () => false },
    } as unknown as Window & { ApplePaySession: { canMakePayments: () => boolean } }),
    false,
  )
  assert.equal(
    canUseApplePayCapabilitySignal({
      ApplePaySession: { canMakePayments: () => true },
    } as Window & { ApplePaySession: { canMakePayments: () => boolean } }),
    true,
  )
  assert.equal(
    canUseApplePayCapabilitySignal({
      ApplePaySession: {
        canMakePayments: () => {
          throw new DOMException("blocked", "InvalidAccessError")
        },
      },
    } as unknown as Window & { ApplePaySession: { canMakePayments: () => boolean } }),
    false,
  )
})

test("offer pricing prewarms only technical Stripe preparation and claims before confirm", () => {
  assert.match(pricingSource, /isOfferCheckoutPrewarmEnabled/)
  assert.match(pricingSource, /action: "prepare"/)
  assert.match(pricingSource, /preparationId/)
  const prepareBody = pricingSource.match(
    /body: JSON\.stringify\(\{\s*action: "prepare"[\s\S]*?\}\),/,
  )?.[0]
  assert.ok(prepareBody)
  assert.doesNotMatch(prepareBody, /checkoutAttemptId/)
  assert.doesNotMatch(prepareBody, /funnelEventId/)
  assert.match(pricingSource, /trackAppEvent\("checkout_prepared"/)
  assert.match(pricingSource, /walletAvailable/)
  assert.match(pricingSource, /action: "claim"/)
  assert.match(pricingSource, /preparedSessionId: preparation\.sessionId/)
  assert.match(pricingSource, /checkoutAttemptId: attemptId/)
  assert.match(pricingSource, /funnelEventId/)
  assert.match(pricingSource, /onBeforeStripeConfirm=\{handleBeforeStripeConfirm\}/)
  assert.match(pricingSource, /prepared_checkout_claim_failed/)
  assert.match(pricingSource, /prewarmSuppressedUntilPlanChangeRef\.current = true/)
})

test("prepared checkout responses require the canonical fields and a numeric expiry", () => {
  assert.deepEqual(
    readPreparedOfferCheckoutResponse({
      status: "prepared",
      client_secret: "secret",
      session_id: "session",
      preparation_token: "token",
      expires_at: 1_800_000_000,
    }),
    {
      clientSecret: "secret",
      expiresAt: 1_800_000_000,
      preparationToken: "token",
      sessionId: "session",
    },
  )
  assert.equal(
    readPreparedOfferCheckoutResponse({
      status: "prepared",
      client_secret: "secret",
      session_id: "session",
      preparation_token: "token",
    }),
    null,
  )
  assert.equal(
    readPreparedOfferCheckoutResponse({
      status: "prepared",
      client_secret: "secret",
      session_id: "session",
      preparation_token: "token",
      expires_at: "1800000000",
    }),
    null,
  )
  assert.equal(
    readPreparedOfferCheckoutResponse({
      status: "prepared",
      client_secret: "secret",
      session_id: "session",
      preparation_token: "token",
      expires_at: Number.NaN,
    }),
    null,
  )
})

test("prewarm hold and timing are tied to an actual usable preparation request", () => {
  assert.match(
    pricingSource,
    /holdPaymentChoicesUntilResolved=\{Boolean\(preparedCheckoutForRender\)\}/,
  )
  assert.doesNotMatch(pricingSource, /holdPaymentChoicesUntilResolved=\{checkoutPrewarmEnabled\}/)
  assert.match(
    pricingSource,
    /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?startedAt: Date\.now\(\),/,
  )
  assert.doesNotMatch(
    pricingSource,
    /const startedAt = Date\.now\(\)[\s\S]*?const timer = window\.setTimeout/,
  )
  assert.match(pricingSource, /prewarmAttemptedKeysRef\.current\.has\(requestKey\)/)
  assert.match(pricingSource, /prewarmAttemptedKeysRef\.current\.add\(requestKey\)/)
  assert.match(
    pricingSource,
    /prewarmAttemptedKeysRef\.current\.delete\(`\$\{selectedInterval\}:\$\{leadId \?\? "anonymous"\}`\)/,
  )
})

test("prewarm caps actual prepare requests at four for the page lifetime", () => {
  assert.equal(isOfferCheckoutPrewarmPageRequestLimitReached(0), false)
  assert.equal(isOfferCheckoutPrewarmPageRequestLimitReached(3), false)
  assert.equal(isOfferCheckoutPrewarmPageRequestLimitReached(4), true)
  assert.equal(isOfferCheckoutPrewarmPageRequestLimitReached(5), true)

  assert.match(pricingSource, /const offerCheckoutPrewarmPageRequestLimit = 4/)
  assert.match(pricingSource, /const prewarmActualRequestCountRef = useRef\(0\)/)
  assert.match(
    pricingSource,
    /prewarmAttemptedKeysRef\.current\.has\(requestKey\)\) return\s*\n\s*if \(isOfferCheckoutPrewarmPageRequestLimitReached\(prewarmActualRequestCountRef\.current\)\) return/,
  )
  assert.match(
    pricingSource,
    /ensureStripePromise\(\)\s*\n\s*prewarmActualRequestCountRef\.current \+= 1\s*\n\s*const response = await fetch\("\/api\/stripe\/create-checkout-session"/,
  )
  assert.match(
    pricingSource,
    /prewarmAttemptedKeysRef\.current\.add\(requestKey\)\s*\n\s*const promise = prepareOfferCheckout/,
  )
  assert.doesNotMatch(pricingSource, /prewarmActualRequestCountRef\.current = 0/)
})

test("late preparation responses cannot enter a checkout after its generation is invalidated", () => {
  assert.equal(isCurrentOfferCheckoutPreparationGeneration(3, 3), true)
  assert.equal(isCurrentOfferCheckoutPreparationGeneration(4, 3), false)

  const openCheckoutSource = pricingSource.match(
    /function openCheckout\(\) \{[\s\S]*?\n  \}\n\n  useEffect/,
  )?.[0]
  assert.ok(openCheckoutSource)
  const captureIndex = openCheckoutSource.indexOf("const matchingPreparation")
  const invalidateIndex = openCheckoutSource.indexOf("prewarmGenerationRef.current += 1")
  const claimIndex = openCheckoutSource.indexOf("claimPreparedCheckout(matchingPreparation")
  assert.ok(captureIndex >= 0)
  assert.ok(invalidateIndex > captureIndex)
  assert.ok(claimIndex > invalidateIndex)
  assert.match(
    openCheckoutSource,
    /prewarmGenerationRef\.current \+= 1\s*\n\s*prewarmRequestRef\.current = null\s*\n\s*preparedClaimRef\.current = null/,
  )
  assert.match(
    pricingSource,
    /isCurrentOfferCheckoutPreparationGeneration\(prewarmGenerationRef\.current, generation\)/,
  )
})

test("prepared Checkout Elements confirms only after its identity-matched claim succeeds", async () => {
  const activePreparation = { attemptId: "attempt-1", preparationId: "preparation-1" }

  assert.equal(await canConfirmPreparedOfferCheckout(null, null), true)
  assert.equal(await canConfirmPreparedOfferCheckout(activePreparation, null), false)
  assert.equal(
    await canConfirmPreparedOfferCheckout(activePreparation, {
      attemptId: "attempt-2",
      preparationId: "preparation-1",
      promise: Promise.resolve(true),
    }),
    false,
  )
  assert.equal(
    await canConfirmPreparedOfferCheckout(activePreparation, {
      attemptId: "attempt-1",
      preparationId: "preparation-2",
      promise: Promise.resolve(true),
    }),
    false,
  )
  assert.equal(
    await canConfirmPreparedOfferCheckout(activePreparation, {
      attemptId: "attempt-1",
      preparationId: "preparation-1",
      promise: Promise.resolve(false),
    }),
    false,
  )
  assert.equal(
    await canConfirmPreparedOfferCheckout(activePreparation, {
      attemptId: "attempt-1",
      preparationId: "preparation-1",
      promise: Promise.resolve(true),
    }),
    true,
  )

  assert.match(pricingSource, /const \[activePreparedCheckout, setActivePreparedCheckout\]/)
  assert.match(
    pricingSource,
    /const preparedCheckoutForRender =\s*\n\s*checkoutInterval !== null\s*\n\s*\? activePreparedCheckout/,
  )
  assert.match(
    pricingSource,
    /canConfirmPreparedOfferCheckout\(\s*activePreparedCheckout,\s*preparedClaimRef\.current,/,
  )
})

test("hidden prewarm records a single availability timeout without closing the prepared checkout", () => {
  assert.match(pricingSource, /const offerCheckoutPrewarmAvailabilityTimeoutMs = 10_000/)
  assert.match(
    pricingSource,
    /window\.setTimeout\(\(\) => \{\s*recordPreparedApplePayAvailability\(preparedCheckout, false\)/,
  )
  assert.match(
    pricingSource,
    /preparedWalletTelemetryTrackedRef\.current\.has\(preparation\.preparationId\)/,
  )
  assert.match(
    pricingSource,
    /preparedWalletTelemetryTrackedRef\.current\.add\(preparation\.preparationId\)/,
  )
  const timeoutEffect = pricingSource.match(
    /const timer = window\.setTimeout\(\(\) => \{\s*recordPreparedApplePayAvailability\(preparedCheckout, false\)\s*\}, offerCheckoutPrewarmAvailabilityTimeoutMs\)\s*\n\s*return \(\) => window\.clearTimeout\(timer\)/,
  )?.[0]
  assert.ok(timeoutEffect)
  assert.doesNotMatch(timeoutEffect, /setPreparedCheckout\(null\)/)
  assert.doesNotMatch(timeoutEffect, /setActivePreparedCheckout\(null\)/)
})

test("pricing visibility waits for intersection and fires exactly once", () => {
  const observerState: { callback?: IntersectionObserverCallback } = {}
  let disconnected = 0
  let observed = 0
  let tracked = 0

  class FakeObserver {
    constructor(next: IntersectionObserverCallback) {
      observerState.callback = next
    }
    observe() {
      observed += 1
    }
    disconnect() {
      disconnected += 1
    }
  }

  const cleanup = observeOnceVisible(
    {} as Element,
    () => {
      tracked += 1
    },
    FakeObserver,
  )

  assert.equal(observed, 1)
  assert.equal(tracked, 0)
  observerState.callback?.(
    [{ isIntersecting: false } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  assert.equal(tracked, 0)
  observerState.callback?.(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  observerState.callback?.(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  assert.equal(tracked, 1)
  assert.ok(disconnected >= 1)
  cleanup()
})

test("pricing visibility falls back to one immediate event without IntersectionObserver", () => {
  let tracked = 0
  observeOnceVisible(
    {} as Element,
    () => {
      tracked += 1
    },
    undefined,
  )
  assert.equal(tracked, 1)
})
