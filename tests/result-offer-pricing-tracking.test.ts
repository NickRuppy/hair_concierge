import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { observeOnceVisible } from "../src/lib/analytics/observe-once-visible"
import {
  createOverlayPresentationWatchdog,
  claimOfferProviderLock,
  getMembershipCheckoutSummary,
  getPersonalPlanOneTimeCheckoutSummary,
  isUnexpectedCheckoutNavigationPath,
  releaseOfferProviderLock,
  shouldRotateStripeSessionAttemptOnRetry,
  trackStripeJsAvailability,
} from "../src/components/quiz/result-offer-pricing"
import {
  PERSONAL_PLAN_LAUNCH_PRICING_PLANS,
  STRIPE_PRICING_PLANS,
} from "../src/lib/stripe/pricing-plans"

const sourcePath = new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url)

test("offer analytics plan metadata matches canonical advertised values", () => {
  const readPlans = (
    plans: typeof STRIPE_PRICING_PLANS | typeof PERSONAL_PLAN_LAUNCH_PRICING_PLANS,
  ) =>
    plans.map(({ analyticsId, amount, currency, interval }) => ({
      analyticsId,
      amount,
      currency,
      interval,
    }))
  assert.deepEqual(readPlans(STRIPE_PRICING_PLANS), [
    { analyticsId: "premium_month", amount: 14.99, currency: "EUR", interval: "month" },
    { analyticsId: "premium_quarter", amount: 34.99, currency: "EUR", interval: "quarter" },
    { analyticsId: "premium_year", amount: 99.99, currency: "EUR", interval: "year" },
  ])
  assert.deepEqual(readPlans(PERSONAL_PLAN_LAUNCH_PRICING_PLANS), [
    { analyticsId: "premium_month", amount: 9.99, currency: "EUR", interval: "month" },
    { analyticsId: "premium_quarter", amount: 19.99, currency: "EUR", interval: "quarter" },
    { analyticsId: "premium_year", amount: 69.99, currency: "EUR", interval: "year" },
  ])
})

test("checkout summaries retain the selected immutable offer", () => {
  assert.deepEqual(getMembershipCheckoutSummary("quarter"), {
    commerceKind: "membership",
    interval: "quarter",
    planName: "Quartal",
    priceLabel: "€34,99",
    stickyLine: "Quartal · €34,99",
  })
  assert.deepEqual(getPersonalPlanOneTimeCheckoutSummary(), {
    commerceKind: "one_time",
    planName: "Haarplan",
    priceLabel: "29,99 €",
    referencePriceLabel: "49,99 €",
    stickyLine: "Haarplan · 29,99 €",
  })
})

test("provider locking rejects a competing payment provider until released", () => {
  const stripe = claimOfferProviderLock(null, "stripe")
  assert.deepEqual(stripe, { accepted: true, provider: "stripe" })
  assert.deepEqual(claimOfferProviderLock(stripe.provider, "paypal"), {
    accepted: false,
    provider: "stripe",
  })
  assert.deepEqual(releaseOfferProviderLock(stripe.provider, "stripe"), {
    accepted: true,
    provider: null,
  })
})

test("Stripe.js null and rejected loads remain observable after explicit open", async () => {
  const failures: Array<{ errorCode: string }> = []
  trackStripeJsAvailability(Promise.resolve(null), (failure) => failures.push(failure))
  trackStripeJsAvailability(Promise.reject(new Error("blocked")), (failure) =>
    failures.push(failure),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(failures.map((failure) => failure.errorCode).sort(), [
    "stripe_js_load_failed",
    "stripe_js_unavailable",
  ])
})

test("overlay presentation watchdog reports only a real visibility timeout", () => {
  const callbacks: Array<() => void> = []
  const cleared: unknown[] = []
  let failures = 0
  const dependencies = {
    clearTimeout: (timer: unknown) => {
      cleared.push(timer)
    },
    setTimeout: (callback: () => void) => {
      callbacks.push(callback)
      return callbacks.length as unknown as ReturnType<typeof setTimeout>
    },
    timeoutMs: 50,
  }

  const visible = createOverlayPresentationWatchdog(() => {
    failures += 1
  }, dependencies)
  visible.start()
  visible.start()
  assert.equal(callbacks.length, 1)
  visible.markVisible()
  assert.equal(failures, 0)
  assert.equal(cleared.length, 1)

  const missing = createOverlayPresentationWatchdog(() => {
    failures += 1
  }, dependencies)
  missing.start()
  callbacks[1]?.()
  // The watchdog itself is one-shot; a scheduler cannot make it report twice.
  callbacks[1]?.()
  assert.equal(failures, 1)

  const dismissed = createOverlayPresentationWatchdog(() => {
    failures += 1
  }, dependencies)
  dismissed.start()
  dismissed.stop()
  assert.equal(failures, 1)
})

test("membership retry reuses uncertain transports and rotates known failed Session attempts", () => {
  assert.equal(shouldRotateStripeSessionAttemptOnRetry("network"), false)
  assert.equal(shouldRotateStripeSessionAttemptOnRetry("provider_response"), true)
  assert.equal(shouldRotateStripeSessionAttemptOnRetry("invalid_payload"), true)
})

test("membership orchestration is cold and creates a session only for an explicit attempt", async () => {
  const source = await readFile(sourcePath, "utf8")
  assert.doesNotMatch(source, /action:\s*"prepare"/)
  assert.doesNotMatch(source, /action:\s*"claim"/)
  assert.doesNotMatch(source, /PreparedOfferCheckout|ReadyGate|action:\s*"prepare"/)
  assert.match(source, /const openCheckout = useCallback/)
  assert.match(source, /checkoutAttemptId: attemptId/)
  assert.match(source, /checkoutSessionAttemptId,/)
  assert.match(source, /funnelSessionId: offerContext\?\.funnelSessionId/)
  assert.match(source, /stripeFunnelEventRef\.current\?\.attemptId !== attemptId/)
  assert.match(source, /const funnelEventId = stripeFunnelEventRef\.current\.funnelEventId/)
  assert.match(source, /fetch\("\/api\/stripe\/create-checkout-session"/)
  assert.match(source, /const stripePromise = getOfferStripePromise\(\)/)
  assert.match(source, /trackStripeJsAvailability\(stripePromise/)
  assert.match(source, /setStripe\(stripePromise\)/)
  assert.match(source, /onPaymentMethodSelected=\{\(provider, paymentMethodType\) =>/)
  assert.match(source, /paymentMethodType,/)
  assert.match(source, /trackAppEvent\("offer_plan_selected"/)
  assert.match(source, /trackAppEvent\("offer_checkout_opened"/)
  assert.match(source, /trackAppEvent\("offer_payment_method_selected"/)
  assert.match(source, /trackAppEvent\("offer_payment_option_viewed"/)
  assert.match(source, /trackAppEvent\("checkout_start_failed"/)
  assert.match(source, /capturePaymentFailure\(\{/)
  assert.match(source, /attempts\.claimFailure\(/)
  assert.match(source, /trackCheckoutLifecycle\(attemptId,[\s\S]*transition: "preparation_started"/)
  assert.match(
    source,
    /trackCheckoutLifecycle\(attemptId,[\s\S]*transition: "prepared_response_received"/,
  )
  assert.match(source, /trackCheckoutLifecycle\(attemptId,[\s\S]*transition: "payment_engaged"/)
  assert.match(
    source,
    /const retryId = attempts\.retry\(\)[\s\S]*rotateStripeSessionAttemptOnRetryRef\.current[\s\S]*setCheckoutSessionAttemptId\(createFunnelEventId\(\)\)[\s\S]*setCheckoutInterval\(null\)[\s\S]*setCheckoutInterval\(selectedInterval\)/,
  )
  assert.match(
    source,
    /catch \(cause\) \{[\s\S]*shouldRotateStripeSessionAttemptOnRetry\("network"\)/,
  )
  assert.match(
    source,
    /if \(!response\.ok\) \{[\s\S]*shouldRotateStripeSessionAttemptOnRetry\("provider_response"\)/,
  )
  assert.match(source, /attempts\.end\(\)/)
  assert.match(source, /attempts\.hide\(\)/)
})

test("overlay checkout attempts hide without ending provider identity and resume without business reopen", async () => {
  const source = await readFile(sourcePath, "utf8")
  assert.match(source, /attempts\.hide\(\)/)
  assert.match(source, /attempts\.resume\(\)/)
  assert.match(source, /attempts\.end\(\)/)
  assert.match(source, /const \[checkoutVisible, setCheckoutVisible\] = useState\(false\)/)
  assert.match(source, /open=\{checkoutVisible\}/)
  assert.match(source, /keepMounted=\{Boolean\(checkoutInterval\)\}/)
  assert.match(source, /setCheckoutVisible\(false\)[\s\S]*setEngaged\(false\)/)
  assert.doesNotMatch(
    source,
    /onConfirmedAbort=\{\(\) => close\(\)\}[\s\S]*open=\{checkoutInterval !== null\}/,
  )
  assert.match(
    source,
    /onConfirmedAbort=\{\(\) =>\s*engaged \|\| !express\s*\? endCheckout\(\{[\s\S]*endReason: "customer_aborted"[\s\S]*\}\)\s*: close\(\)/,
  )
  assert.match(source, /onPresentationStateChange=\{onOverlayPresentationStateChange\}/)
  assert.match(source, /"overlay_visibility_timeout"/)
  assert.match(source, /"unexpected_navigation"/)
  assert.match(source, /signal: "checkout_experience_degraded"/)
  assert.match(source, /"overlay_not_visible"/)
  assert.match(source, /"unexpected_route"/)
  assert.match(source, /window\.history\.pushState = observedPushState/)
})

test("checkout navigation classification catches the confirmed landing reset without flagging success", () => {
  assert.equal(isUnexpectedCheckoutNavigationPath("/result/lead-123", "/result/lead-123"), false)
  assert.equal(isUnexpectedCheckoutNavigationPath("/result/lead-123", "/welcome"), false)
  for (const legalPath of ["/datenschutz", "/impressum", "/agb", "/widerruf", "/kontakt"]) {
    assert.equal(isUnexpectedCheckoutNavigationPath("/result/lead-123", legalPath), false)
  }
  assert.equal(isUnexpectedCheckoutNavigationPath("/result/lead-123", "/lp/haarplan"), true)
  assert.equal(isUnexpectedCheckoutNavigationPath("/result/lead-123", "/quiz"), true)
})

test("one-time drawer stays mounted across hidden same-plan resumes", async () => {
  const source = await readFile(sourcePath, "utf8")
  const oneTime = source.slice(
    source.indexOf("function PersonalPlanOneTimePricing"),
    source.indexOf("function MembershipResultOfferPricing"),
  )
  assert.match(oneTime, /attempts\.hide\(\)/)
  assert.match(oneTime, /attempts\.resume\(\)/)
  assert.match(oneTime, /attempts\.end\(\)/)
  assert.match(oneTime, /keepMounted=\{Boolean\(attemptId\)\}/)
  assert.match(oneTime, /attemptId \? \(/)
  assert.match(oneTime, /<PersonalPlanOneTimeCheckout/)
  assert.doesNotMatch(
    oneTime,
    /setAttemptId\(null\)[\s\S]*setOpen\(false\)[\s\S]*setEngaged\(false\)/,
  )
  assert.match(oneTime, /trackCheckoutLifecycle\([\s\S]*transition: "opened"/)
  assert.match(oneTime, /trackCheckoutLifecycle\([\s\S]*transition: "resumed"/)
  assert.match(oneTime, /trackCheckoutLifecycle\([\s\S]*transition: "dismissed"/)
  assert.doesNotMatch(oneTime, /checkoutWaiting|ResolvedOpen|oneTimePrewarm/i)
})

test("one-time pricing keeps the launch anchor and trust stack in the approved order", async () => {
  const source = await readFile(sourcePath, "utf8")
  const oneTime = source.slice(
    source.indexOf("function PersonalPlanOneTimePricing"),
    source.indexOf("function MembershipResultOfferPricing"),
  )

  assert.match(source, /plannedRegularPrice[\s\S]*\.toFixed\(2\)/)
  assert.match(
    oneTime,
    /Launch-Preis[\s\S]*<s[^>]*>[\s\S]*\{personalPlanOneTimeReferencePriceLabel\}[\s\S]*<\/s>[\s\S]*<strong[^>]*>€29,99<\/strong>/,
  )
  assert.match(
    oneTime,
    /14 Tage Geld-zurück-Garantie · Einmalzahlung · Kein Abo[\s\S]*PayPal · Apple Pay \(auf unterstützten Geräten\) · Visa · Mastercard[\s\S]*Zahlungsdaten verarbeitet dein gewählter Anbieter\.[\s\S]*Mehr zum Datenschutz\./,
  )
  assert.doesNotMatch(oneTime, /Sicher bezahlen über deinen gewählten Zahlungsanbieter\./)
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
