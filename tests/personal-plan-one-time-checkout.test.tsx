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
const paypalOrderRouteSource = readFileSync(
  new URL("../src/app/api/paypal/create-order-intent/route.ts", import.meta.url),
  "utf8",
)
const paypalCaptureRouteSource = readFileSync(
  new URL("../src/app/api/paypal/capture-order/route.ts", import.meta.url),
  "utf8",
)
const stripeCheckoutRouteSource = readFileSync(
  new URL("../src/app/api/stripe/create-checkout-session/route.ts", import.meta.url),
  "utf8",
)
const offerLabSource = readFileSync(
  new URL("../src/app/labs/offer-page/page.tsx", import.meta.url),
  "utf8",
)
const personalPlanOfferSource = readFileSync(
  new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
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
  assert.match(checkoutSource, /\) : canStartPayment \? \(/)
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

test("a PayPal-owned checkout stays usable without presenting a generic Stripe failure", () => {
  assert.match(
    stripeCheckoutRouteSource,
    /error: "payment provider already selected", provider_locked: "paypal"/,
  )
  assert.match(checkoutSource, /body\.provider_locked === "paypal"/)
  assert.match(checkoutSource, /PayPal ist bereits ausgewählt/)
  assert.match(checkoutSource, /Karte ist für diesen Zahlungsversuch nicht verfügbar/)
  assert.match(checkoutSource, /onProviderSelected/)
  assert.match(paypalSource, /onProviderSelected\?\.\(\)/)
})

test("PayPal pending capture continues to welcome while an expired intent stops blind retries", () => {
  assert.match(
    paypalCaptureRouteSource,
    /error\.code === "paypal_order_capture_pending"[\s\S]*status: "pending"[\s\S]*status: 202/,
  )
  assert.match(paypalSource, /body\.status === "pending"/)
  assert.match(paypalSource, /window\.location\.assign\(body\.welcomeUrl\)/)
  assert.match(paypalSource, /body\.error === "paypal_order_intent_expired"/)
  assert.match(paypalSource, /Die PayPal-Zahlung ist abgelaufen/)
  assert.match(paypalSource, /mailto:/)
  assert.match(
    paypalOrderRouteSource,
    /createPayPalOrderIntent[\s\S]*isUniqueViolation[\s\S]*consent_id[\s\S]*paypal_order_intent_expired/,
  )
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
  assert.match(
    checkoutSource,
    /if \(visibleRef\.current\) \{[\s\S]*setError\(checkoutStartError\)[\s\S]*reportStripeCustomerError/,
  )
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

test("personal-plan lab keeps synthetic checkout identity from auto-prewarming providers", () => {
  assert.match(
    offerLabSource,
    /<PersonalPlanOffer[\s\S]*disableCheckoutPrewarm[\s\S]*isInternalTest[\s\S]*offerTracking=/,
  )
  assert.match(
    personalPlanOfferSource,
    /<ResultOfferPricing[\s\S]*disableCheckoutPrewarm=\{disableCheckoutPrewarm\}/,
  )
  assert.match(pricingSource, /const oneTimePrewarmEnabled =\s*!disableCheckoutPrewarm &&/)
  assert.match(
    pricingSource,
    /const checkoutPrewarmEnabled =\s*!disableCheckoutPrewarm &&\s*expressElementsEnabled/,
  )
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

test("one-time PayPal reports visible payment failures once and excludes consent and conflicts", () => {
  assert.match(paypalSource, /usePaymentRuntime/)
  assert.match(paypalSource, /useOfferTrackingContext/)
  assert.match(paypalSource, /capturePayPalOneTimeCustomerPaymentError/)
  assert.match(paypalSource, /signal: "customer_payment_error_observed"/)
  assert.match(paypalSource, /provider: "paypal"/)
  assert.match(paypalSource, /commerceKind: "one_time"/)
  assert.match(paypalSource, /origin: "browser"/)
  assert.match(paypalSource, /method: "paypal"/)
  assert.match(paypalSource, /truth: "unknown"/)
  assert.match(paypalSource, /live: paypalLive/)
  assert.match(paypalSource, /isInternalTest/)
  assert.match(paypalSource, /const suppressNextPayPalErrorRef = useRef\(false\)/)

  const createOrderSource = paypalSource.slice(
    paypalSource.indexOf("createOrder={async"),
    paypalSource.indexOf("onApprove={async"),
  )
  assert.match(
    createOrderSource,
    /if \(!consentAccepted\) \{[\s\S]*suppressNextPayPalErrorRef\.current = true[\s\S]*one-time checkout consent required/,
  )
  assert.match(
    createOrderSource,
    /if \(response\.status === 409\) \{[\s\S]*onDuplicateAccess\?\.\(\)[\s\S]*onProviderConflict\?\.\(\)[\s\S]*suppressNextPayPalErrorRef\.current = true/,
  )
  assert.match(createOrderSource, /boundary: "provider_session"/)
  assert.match(
    createOrderSource,
    /setError\("PayPal-Zahlung konnte nicht gestartet werden\. Bitte versuche es erneut\."\)[\s\S]*suppressNextPayPalErrorRef\.current = true[\s\S]*throw new Error\("PayPal order creation failed"\)/,
  )
  assert.match(
    createOrderSource,
    /status: response\.ok \? "order_payload_incomplete" : response\.status/,
  )

  const approveSource = paypalSource.slice(
    paypalSource.indexOf("onApprove={async"),
    paypalSource.indexOf("onCancel={() =>"),
  )
  assert.match(approveSource, /boundary: "customer_authorization"/)
  assert.match(approveSource, /status: "approval_token_missing"/)
  assert.match(approveSource, /boundary: "provider_outcome"/)
  assert.match(
    approveSource,
    /status: response\.ok \? "capture_payload_incomplete" : response\.status/,
  )

  const sdkErrorSource = paypalSource.slice(
    paypalSource.indexOf("onError={(paypalError) =>"),
    paypalSource.indexOf("{busy ? ("),
  )
  assert.match(
    sdkErrorSource,
    /if \(suppressNextPayPalErrorRef\.current\) \{[\s\S]*suppressNextPayPalErrorRef\.current = false[\s\S]*return/,
  )
  assert.match(sdkErrorSource, /status: "paypal_button_error"/)
})

test("one-time PayPal attribution uses the authorized result session, not browser cookies", () => {
  assert.match(
    paypalOrderRouteSource,
    /const funnelContext = \{[\s\S]*visitorId: authorization\.visitorId,[\s\S]*sessionId: authorization\.sessionId,[\s\S]*packageKey: authorization\.packageKey,[\s\S]*issuedAt: authorization\.issuedAt/,
  )
  assert.doesNotMatch(paypalOrderRouteSource, /resolveFunnelCookieContext/)
  assert.doesNotMatch(paypalOrderRouteSource, /resolveFunnelContextForLead/)
})

test("one-time checkout marks a real first interaction and routes its nested close through policy", () => {
  assert.match(checkoutSource, /onFirstPaymentEngagement\?: \(\) => void/)
  assert.match(checkoutSource, /onRequestClose: \(\) => void/)
  assert.match(checkoutSource, /const firstEngagementRef = useRef\(false\)/)
  assert.match(
    checkoutSource,
    /const markFirstEngagement = useCallback\(\(\) => \{[\s\S]*firstEngagementRef\.current = true[\s\S]*onFirstPaymentEngagement\?\.\(\)/,
  )
  assert.match(
    checkoutSource,
    /onChange=\{\(event\) => \{[\s\S]*markFirstEngagement\(\)[\s\S]*setAccepted\(event\.target\.checked\)/,
  )
  assert.match(
    checkoutSource,
    /onClick=\{\(\) => \{[\s\S]*markFirstEngagement\(\)[\s\S]*setStripeSelected\(true\)/,
  )
  assert.match(
    checkoutSource,
    /const handlePaymentMethodSelected = useCallback\([\s\S]*markFirstEngagement\(\)/,
  )
  assert.match(
    checkoutSource,
    /<Button type="button" variant="outline" onClick=\{onRequestClose\}>/,
  )

  const paymentOptionExposure = checkoutSource.slice(
    checkoutSource.indexOf("const handlePaymentOptionViewed"),
    checkoutSource.indexOf("const fetchClientSecret"),
  )
  assert.doesNotMatch(paymentOptionExposure, /markFirstEngagement/)
})

test("one-time checkout keeps each payment attempt isolated", () => {
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
  assert.match(
    checkoutSource,
    /checkoutStartedProvidersRef\.current\.clear\(\)[\s\S]*firstEngagementRef\.current = false[\s\S]*\}, \[checkoutAttemptId\]\)/,
  )
  assert.match(
    pricingSource,
    /setCheckoutEngaged\(false\)\s*setCheckoutAttemptId\(nextCheckoutAttemptId\)/,
  )
})
