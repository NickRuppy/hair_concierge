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

test("one-time Stripe preparation starts only after consent while PayPal remains available", () => {
  assert.match(checkoutSource, /personal-plan-one-time-consent-copy/)
  assert.match(checkoutSource, /checked=\{accepted\}/)
  assert.match(
    checkoutSource,
    /const stripeCheckoutEnabled = stripeAvailable && visible && accepted/,
  )
  assert.match(checkoutSource, /data-offer-payment-placeholder="apple_pay"/)
  assert.match(checkoutSource, /aria-disabled="true"/)
  assert.match(checkoutSource, /Apple Pay[\s\S]{0,180}Nach Einwilligung verfügbar/)
  assert.match(checkoutSource, /action: "prepare"/)
  assert.match(checkoutSource, /preparationToken: stripePreparationCredential\.preparationToken/)
  assert.match(checkoutSource, /action: "claim"/)
  assert.match(checkoutSource, /body\.status !== "prepared" && body\.status !== "recovered"/)
  assert.match(checkoutSource, /setStripeProviderLocked\(body\.provider_locked === "stripe"\)/)
  assert.match(
    checkoutSource,
    /preparation\.claimFunnelEventId \?\? createFunnelEventId\(\)[\s\S]*preparation\.claimFunnelEventId = funnelEventId/,
  )
  assert.match(checkoutSource, /onBeforeConfirm=\{handleBeforeStripeConfirm\}/)
  assert.match(checkoutSource, /consentAccepted=\{accepted\}/)
  assert.match(checkoutSource, /canStartPayment && stripeCheckoutEnabled \? \(/)
  assert.match(checkoutSource, /const paypalPaymentOption =/)
  assert.match(checkoutSource, /\{paypalPaymentOption\}/)
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

test("one-time Express containment renders PayPal without mounting Stripe", () => {
  assert.match(
    pricingSource,
    /checkoutPresentationFixture\.overlay &&[\s\S]*checkoutPresentationFixture\.expressElements[\s\S]*isOfferPaymentOverlayEnabled\(\) && isStripeExpressCheckoutEnabled\(\)/,
  )
  assert.match(pricingSource, /stripeElementsEnabled=\{expressElementsEnabled\}/)
  assert.match(
    pricingSource,
    /availableProviders: \[[\s\S]*expressElementsEnabled && stripePublishableKey \? \["stripe"\] : \[\]/,
  )
  assert.match(pricingSource, /\[expressElementsEnabled, offerContext, onCheckoutOpen\]/)
  assert.match(checkoutSource, /stripeCheckoutEnabled = stripeAvailable && visible && accepted/)
  assert.match(
    checkoutSource,
    /canStartPayment && !stripeAvailable \? \([\s\S]*paypalPaymentOption[\s\S]*\) : canStartPayment && stripeCheckoutEnabled \? \(/,
  )
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

test("one-time Apple Pay does no provider work before drawer open and consent", () => {
  assert.doesNotMatch(pricingSource, /const oneTimePrewarmEnabled =/)
  assert.doesNotMatch(pricingSource, /oneTimePrewarmEligible/)
  assert.doesNotMatch(pricingSource, /stripePreparationRefreshRequestId/)
  assert.doesNotMatch(pricingSource, /keepMounted=\{oneTimePrewarmEligible\}/)
  assert.match(pricingSource, /open \? \(/)
  assert.doesNotMatch(pricingSource, /onStripePreparationStateChange/)

  const openCheckout = pricingSource.slice(
    pricingSource.indexOf(
      "const openCheckout = useCallback",
      pricingSource.indexOf("function PersonalPlanOneTimePricing"),
    ),
    pricingSource.indexOf(
      "useEffect(() =>",
      pricingSource.indexOf("const openCheckout = useCallback"),
    ),
  )
  assert.match(openCheckout, /const nextAttemptId = createFunnelEventId\(\)/)
  assert.match(openCheckout, /trackAppEvent\("offer_checkout_opened"/)

  assert.match(checkoutSource, /checkoutAttemptId: string \| null/)
  assert.doesNotMatch(checkoutSource, /onStripePreparationStateChangeRef/)
  assert.match(
    checkoutSource,
    /if \(visibleRef\.current\) \{[\s\S]*setError\(checkoutStartError\)[\s\S]*reportStripeCustomerError/,
  )
  assert.match(checkoutSource, /visible: boolean/)
  assert.match(checkoutSource, /visible=\{visible\}/)
  assert.match(checkoutSource, /if \(!checkoutAttemptId \|\| !offerContext/)
  assert.match(checkoutSource, /canStartPayment && stripeCheckoutEnabled \? \(/)
  assert.match(checkoutSource, /preparedStripeCheckoutRef\.current = null/)
  assert.match(checkoutSource, /prepared_checkout_control:prepared_checkout_unavailable/)
  assert.match(checkoutSource, /throw createAlreadyReportedPreparedCheckoutError\(error\)/)
})

test("one-time pricing preserves the offer-to-provider analytics journey", () => {
  assert.match(pricingSource, /trackAppEvent\("pricing_viewed"/)
  assert.match(pricingSource, /trackAppEvent\("offer_checkout_opened"/)
  assert.match(pricingSource, /\.\.\.personalPlanOneTimeCommerce/)
  assert.match(pricingSource, /checkoutAttemptId=\{attemptId\}/)
  assert.match(checkoutSource, /trackAppEvent\("checkout_started"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_method_selected"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_option_viewed"/)
  assert.match(checkoutSource, /claimOfferPaymentOptionView/)
  assert.match(checkoutSource, /onPaymentMethodSelected=\{handlePaymentMethodSelected\}/)
  assert.match(checkoutSource, /onPaymentOptionViewed=\{handlePaymentOptionViewed\}/)
  assert.match(checkoutSource, /providerReady=\{paypalReady\}/)
  assert.match(checkoutSource, /data-offer-payment-placeholder="paypal"/)
  assert.match(checkoutSource, /PayPal wird geladen …/)
  assert.match(checkoutSource, /if \(stripeAvailable\) setPaypalReady\(false\)/)
  assert.match(checkoutSource, /Boolean\(process\.env\.NEXT_PUBLIC_PAYPAL_CLIENT_ID\?\.trim\(\)\)/)
  assert.match(
    checkoutSource,
    /const stripeAvailable = stripeElementsEnabled && stripePublishableKeyPresent/,
  )
  assert.match(paypalSource, /onInit=\{\(\) => onReady\?\.\(\)\}/)
  assert.match(paypalSource, /onPaymentMethodSelected\?\.\(\)/)
  assert.match(paypalSource, /onCheckoutStarted\?\.\(funnelEventId\)/)
})

test("one-time pricing ignores duplicate checkout-open requests until the attempt closes", () => {
  assert.match(pricingSource, /const openRef = useRef\(false\)/)
  assert.match(
    pricingSource,
    /const openCheckout = useCallback\(\(\) => \{\s*if \(openRef\.current\) return\s*openRef\.current = true/,
  )
  assert.match(pricingSource, /const close = useCallback\(\(\) => \{\s*openRef\.current = false/)
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

test("personal-plan lab and live offer have no provider-prewarm controls", () => {
  assert.match(offerLabSource, /<PersonalPlanOffer[\s\S]*isInternalTest[\s\S]*offerTracking=/)
  assert.match(
    offerLabSource,
    /checkoutPresentationFixture=\{\{[\s\S]*expressElements: params\.expressElements !== "off",[\s\S]*overlay: params\.overlay !== "off"/,
  )
  assert.doesNotMatch(offerLabSource, /disableCheckoutPrewarm/)
  assert.doesNotMatch(personalPlanOfferSource, /disableCheckoutPrewarm/)
  assert.doesNotMatch(personalPlanOfferSource, /checkoutWaiting/)
  assert.doesNotMatch(pricingSource, /oneTimePrewarmEnabled/)
  assert.doesNotMatch(pricingSource, /checkoutPrewarmEnabled/)
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
    /onChange=\{\(event\) => \{[\s\S]*markFirstEngagement\(\)[\s\S]*setPaypalReady\(false\)[\s\S]*setAccepted\(event\.target\.checked\)/,
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
  assert.match(pricingSource, /const openRef = useRef\(false\)/)
  assert.match(
    pricingSource,
    /const openCheckout = useCallback\(\(\) => \{\s*if \(openRef\.current\) return\s*openRef\.current = true/,
  )
  assert.match(
    pricingSource,
    /const close = useCallback\(\(\) => \{\s*openRef\.current = false[\s\S]*setAttemptId\(null\)/,
  )
  assert.match(
    checkoutSource,
    /checkoutStartedProvidersRef\.current\.clear\(\)[\s\S]*firstEngagementRef\.current = false[\s\S]*\}, \[checkoutAttemptId\]\)/,
  )
  assert.match(pricingSource, /setAttemptId\(nextAttemptId\)\s*setOpen\(true\)/)
})
