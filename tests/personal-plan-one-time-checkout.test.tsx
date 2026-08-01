import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const pricingSource = readFileSync(
  new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url),
  "utf8",
)
const checkoutSource = readFileSync(
  new URL("../src/components/checkout/personal-plan-one-time-checkout.tsx", import.meta.url),
  "utf8",
)
const paypalSource = readFileSync(
  new URL("../src/components/checkout/paypal-one-time-button.tsx", import.meta.url),
  "utf8",
)
const offerLabSource = readFileSync(
  new URL("../src/app/labs/offer-page/page.tsx", import.meta.url),
  "utf8",
)

test("one-time pricing renders only the approved personal-plan offer", () => {
  assert.match(pricingSource, /resolvePersonalPlanPricingMode\(offerVariant\) === "one_time"/)
  assert.match(pricingSource, /Einmalige Erstellung/)
  assert.match(pricingSource, /Persönlicher Haarplan/)
  assert.match(pricingSource, /Haarplan für €29,99 freischalten/)
  assert.match(pricingSource, /Einmalzahlung · Kein Abo/)
  assert.match(pricingSource, /Auf dein Haar, deine Ziele und Bedürfnisse abgestimmt/)
  assert.match(pricingSource, /Komplette Routine mit passenden Produkten/)
  assert.match(pricingSource, /Analyse deiner aktuellen Pflege/)
})

test("one-time payment providers preload independently while consent gates final payment", () => {
  assert.match(checkoutSource, /personal-plan-one-time-consent-copy/)
  assert.match(checkoutSource, /checked=\{accepted\}/)
  assert.doesNotMatch(checkoutSource, /Zahlungsarten erst nach Einwilligung verfügbar/)
  assert.doesNotMatch(checkoutSource, /disabled[\s\S]{0,220} Pay/)
  assert.match(checkoutSource, /action: "prepare"/)
  assert.match(checkoutSource, /action: "claim"/)
  assert.match(checkoutSource, /body\.status !== "prepared" && body\.status !== "recovered"/)
  assert.match(checkoutSource, /setStripeProviderLocked\(body\.provider_locked === "stripe"\)/)
  assert.match(
    checkoutSource,
    /preparation\.claimFunnelEventId \?\? createFunnelEventId\(\)[\s\S]*preparation\.claimFunnelEventId = funnelEventId/,
  )
  assert.match(checkoutSource, /onBeforeConfirm=\{handleBeforeStripeConfirm\}/)
  assert.match(checkoutSource, /consentAccepted=\{accepted\}/)
  assert.match(checkoutSource, /\{canStartPayment \? \(/)
  assert.match(checkoutSource, /stripeSelected \? \(/)
  assert.match(checkoutSource, /Mit Karte bezahlen/)
  assert.match(checkoutSource, /consentAccepted: true/)
  assert.match(checkoutSource, /consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION/)
  assert.match(checkoutSource, /funnelSessionId/)
  assert.match(paypalSource, /consentAccepted: boolean/)
  assert.match(paypalSource, /if \(!consentAccepted\)/)
  assert.match(paypalSource, /consentAccepted: true/)
  assert.match(paypalSource, /consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION/)
  assert.match(paypalSource, /funnelSessionId/)
})

test("one-time Apple Pay prewarms before the drawer opens without creating checkout analytics", () => {
  assert.match(pricingSource, /const oneTimePrewarmEnabled =/)
  assert.match(pricingSource, /canUseApplePayCapabilitySignal/)
  assert.match(pricingSource, /document\.visibilityState !== "visible"/)
  assert.match(pricingSource, /oneTimePrewarmAuthorized/)
  assert.match(pricingSource, /stripePreparationExpiresAtRef/)
  assert.match(pricingSource, /stripePreparationRefreshRequestId/)
  assert.match(pricingSource, /keepMounted=\{oneTimePrewarmEligible\}/)
  assert.match(pricingSource, /visible=\{checkoutOpen\}/)
  assert.match(pricingSource, /onStripePreparationStateChange/)
  assert.match(pricingSource, /onApplePayAvailabilityResolved/)
  assert.match(pricingSource, /Zahlungsoptionen werden vorbereitet/)

  const openCheckout = pricingSource.slice(
    pricingSource.indexOf("const openOneTimeCheckoutNow"),
    pricingSource.indexOf("const closeCheckout"),
  )
  assert.match(openCheckout, /const nextCheckoutAttemptId = createFunnelEventId\(\)/)
  assert.match(openCheckout, /trackAppEvent\("offer_checkout_opened"/)

  assert.match(checkoutSource, /checkoutAttemptId: string \| null/)
  assert.match(checkoutSource, /onStripePreparationStateChangeRef/)
  assert.match(checkoutSource, /if \(visibleRef\.current\) setError\(checkoutStartError\)/)
  assert.match(checkoutSource, /visible: boolean/)
  assert.match(checkoutSource, /visible=\{visible\}/)
  assert.match(checkoutSource, /if \(!checkoutAttemptId \|\| !offerContext/)
})

test("one-time pricing preserves the offer-to-provider analytics journey", () => {
  assert.match(pricingSource, /trackAppEvent\("pricing_viewed"/)
  assert.match(pricingSource, /trackAppEvent\("offer_checkout_opened"/)
  assert.match(pricingSource, /\.\.\.personalPlanOneTimeCommerce/)
  assert.match(pricingSource, /checkoutAttemptId=\{checkoutAttemptId\}/)
  assert.match(checkoutSource, /trackAppEvent\("checkout_started"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_method_selected"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_option_viewed"/)
  assert.match(checkoutSource, /claimOfferPaymentOptionView/)
  assert.match(checkoutSource, /onPaymentMethodSelected=\{handlePaymentMethodSelected\}/)
  assert.match(checkoutSource, /onPaymentOptionViewed=\{handlePaymentOptionViewed\}/)
  assert.match(checkoutSource, /providerReady=\{paypalReady\}/)
  assert.match(paypalSource, /onInit=\{\(\) => onReady\?\.\(\)\}/)
  assert.match(paypalSource, /onPaymentMethodSelected\?\.\(\)/)
  assert.match(paypalSource, /onCheckoutStarted\?\.\(funnelEventId\)/)
})

test("one-time pricing ignores duplicate checkout-open requests until the attempt closes", () => {
  assert.match(pricingSource, /const checkoutOpenRef = useRef\(false\)/)
  assert.match(
    pricingSource,
    /const openOneTimeCheckoutNow = useCallback\(\s*\(suppressWallet: boolean\) => \{\s*if \(checkoutOpenRef\.current\) return\s*checkoutOpenRef\.current = true/,
  )
  assert.match(
    pricingSource,
    /const openCheckout = useCallback\(\(\) => \{\s*if \(checkoutOpenRef\.current \|\| checkoutWaitingRef\.current\) return/,
  )
  assert.match(
    pricingSource,
    /const closeCheckout = useCallback\(\(\) => \{\s*checkoutOpenRef\.current = false/,
  )
})

test("offer lab can force the personal-plan pricing arm for browser-only verification", () => {
  assert.match(offerLabSource, /pricingArm\?: string/)
  assert.match(offerLabSource, /pricingCatalog\?: string/)
  assert.match(offerLabSource, /pricingArm === "one_time"/)
  assert.match(offerLabSource, /pricingArm === "membership"/)
  assert.match(offerLabSource, /personal-plan-one-time-v1/)
  assert.match(offerLabSource, /personal-plan-v1/)
  assert.match(offerLabSource, /pricingCatalog === "personal_plan_launch_v1"/)
})

test("provider initialization is recorded only after a usable provider response", () => {
  const stripePreparation = checkoutSource.slice(
    checkoutSource.indexOf("const fetchClientSecret"),
    checkoutSource.indexOf("const handleBeforeStripeConfirm"),
  )
  const stripeClaim = checkoutSource.slice(
    checkoutSource.indexOf("const handleBeforeStripeConfirm"),
    checkoutSource.indexOf("return ("),
  )
  assert.doesNotMatch(stripePreparation, /trackCheckoutStarted\("stripe"/)
  assert.match(
    stripeClaim,
    /const funnelEventId = preparation\.claimFunnelEventId \?\? createFunnelEventId\(\)[\s\S]*funnelEventId,[\s\S]*body\.status !== "claimed"[\s\S]*return false[\s\S]*trackCheckoutStarted\("stripe", "explicit_provider_action", funnelEventId\)/,
  )
  assert.match(
    paypalSource,
    /const funnelEventId = createFunnelEventId\(\)[\s\S]*funnelEventId,[\s\S]*typeof body\.token !== "string"[\s\S]*throw new Error\("PayPal order creation failed"\)[\s\S]*onCheckoutStarted\?\.\(funnelEventId\)[\s\S]*return body\.orderId/,
  )
})
