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

test("one-time payments remain visibly disabled until canonical consent is accepted", () => {
  assert.match(checkoutSource, /personal-plan-one-time-consent-copy/)
  assert.match(checkoutSource, /checked=\{accepted\}/)
  assert.match(checkoutSource, /disabled[\s\S]{0,220} Pay/)
  assert.match(checkoutSource, /disabled[\s\S]{0,220}PayPal/)
  assert.match(checkoutSource, /disabled[\s\S]{0,260}Zahlungspflichtig bestellen — €29,99/)
  assert.match(checkoutSource, /\{accepted && canStartPayment \? \(/)
  assert.match(checkoutSource, /stripeSelected \? \(/)
  assert.match(checkoutSource, /Mit Apple Pay oder Karte bezahlen/)
  assert.match(checkoutSource, /consentAccepted: true/)
  assert.match(checkoutSource, /consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION/)
  assert.match(checkoutSource, /funnelSessionId/)
  assert.match(paypalSource, /consentAccepted: true/)
  assert.match(paypalSource, /consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION/)
  assert.match(paypalSource, /funnelSessionId/)
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

test("offer lab can force the personal-plan pricing arm for browser-only verification", () => {
  assert.match(offerLabSource, /pricingArm\?: string/)
  assert.match(offerLabSource, /pricingArm === "one_time"/)
  assert.match(offerLabSource, /pricingArm === "membership"/)
  assert.match(offerLabSource, /personal-plan-one-time-v1/)
  assert.match(offerLabSource, /personal-plan-v1/)
})

test("provider initialization is recorded only after a usable provider response", () => {
  const stripeFetchClientSecret = checkoutSource.slice(
    checkoutSource.indexOf("const fetchClientSecret"),
    checkoutSource.indexOf("return body.client_secret"),
  )
  assert.doesNotMatch(stripeFetchClientSecret, /setError\(null\)/)
  assert.match(
    checkoutSource,
    /const funnelEventId = createFunnelEventId\(\)[\s\S]*funnelEventId,[\s\S]*typeof body\.client_secret !== "string"[\s\S]*throw new Error\("one-time Stripe session creation failed"\)[\s\S]*trackCheckoutStarted\("stripe", "explicit_provider_action", funnelEventId\)/,
  )
  assert.match(
    paypalSource,
    /const funnelEventId = createFunnelEventId\(\)[\s\S]*funnelEventId,[\s\S]*typeof body\.token !== "string"[\s\S]*throw new Error\("PayPal order creation failed"\)[\s\S]*onCheckoutStarted\?\.\(funnelEventId\)[\s\S]*return body\.orderId/,
  )
})
