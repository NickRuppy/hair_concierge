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
const withdrawalSource = readFileSync(
  new URL("../src/app/widerruf/page.tsx", import.meta.url),
  "utf8",
)
const termsSource = readFileSync(new URL("../src/app/agb/page.tsx", import.meta.url), "utf8")
const imprintSource = readFileSync(
  new URL("../src/app/impressum/page.tsx", import.meta.url),
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

test("one-time PayPal records watchdogs, cancellation, and malformed pending capture without changing checkout flow", () => {
  assert.match(paypalSource, /createCheckoutWatchdog/)
  assert.match(paypalSource, /status: "paypal_sdk_ready_timeout"/)
  assert.match(paypalSource, /status: "paypal_create_order_timeout"/)
  assert.match(paypalSource, /status: "paypal_capture_order_timeout"/)
  assert.match(paypalSource, /status: "paypal_capture_pending_missing_welcome_url"/)
  assert.match(paypalSource, /signal: "checkout_experience_degraded"/)
  assert.match(paypalSource, /transition: "provider_cancelled"/)
  assert.match(paypalSource, /capturePayPalOneTimeSdkRecoveryWarning/)
  assert.match(paypalSource, /startPayPalSdkErrorRecovery\(\)/)
  assert.match(paypalSource, /onError=\{\(paypalError\) => \{\s*if \(!visibleRef\.current\) return/)
  assert.match(paypalSource, /finally \{\s*watchdogsRef\.current\.settle\(watchdog\)/)
  assert.match(paypalSource, /if \(visible\) return\s*watchdogsRef\.current\.settleAll\(\)/)
  assert.match(checkoutSource, /<PayPalOneTimeButton[\s\S]*?visible=\{visible\}/)
})

test("one-time payment methods mount immediately without a visible or client consent gate", () => {
  assert.doesNotMatch(checkoutSource, /personal-plan-one-time-consent-copy/)
  assert.doesNotMatch(checkoutSource, /checked=\{accepted\}/)
  assert.match(
    checkoutSource,
    /const stripeCheckoutMounted = stripeAvailable && Boolean\(checkoutAttemptId\)/,
  )
  assert.doesNotMatch(checkoutSource, /Nach Einwilligung verfügbar/)
  assert.match(checkoutSource, /action: "prepare"/)
  assert.match(checkoutSource, /preparationToken: stripePreparationCredential\.preparationToken/)
  assert.match(checkoutSource, /action: "claim"/)
  assert.match(checkoutSource, /resolvePreparedStripeCheckoutState/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "ready"/)
  assert.match(
    checkoutSource,
    /preparation\.claimFunnelEventId \?\? createFunnelEventId\(\)[\s\S]*preparation\.claimFunnelEventId = funnelEventId/,
  )
  assert.match(checkoutSource, /onBeforeConfirm=\{handleBeforeStripeConfirm\}/)
  assert.match(
    checkoutSource,
    /canStartPayment &&[\s\S]*stripeCheckoutMounted &&[\s\S]*preparedStripeCheckoutState\.kind === "ready"/,
  )
  assert.match(checkoutSource, /const paypalPaymentOption =/)
  assert.match(checkoutSource, /\{paypalPaymentOption\}/)
  assert.match(checkoutSource, /stripeSelected &&/)
  assert.match(checkoutSource, /Mit Karte bezahlen/)
  assert.doesNotMatch(checkoutSource, /consentAccepted/)
  assert.doesNotMatch(checkoutSource, /consentCopyVersion/)
  assert.match(checkoutSource, /funnelSessionId/)
  assert.doesNotMatch(paypalSource, /consentAccepted/)
  assert.doesNotMatch(paypalSource, /consentCopyVersion/)
  assert.match(paypalSource, /funnelSessionId/)
  assert.doesNotMatch(paypalOrderRouteSource, /consentAccepted/)
  assert.doesNotMatch(paypalOrderRouteSource, /consentCopyVersion/)
  assert.doesNotMatch(stripeCheckoutRouteSource, /consentAccepted/)
  assert.doesNotMatch(stripeCheckoutRouteSource, /consentCopyVersion/)
})

function getStripeWarmEffect(source: string) {
  const warmCallIndex = source.indexOf("warmOfferStripe()")
  const warmEffectStart = source.lastIndexOf("  useEffect(() => {", warmCallIndex)
  const warmEffectEnd = source.indexOf(
    "\n  }, [canStartPayment, stripeCheckoutMounted])",
    warmCallIndex,
  )

  assert.ok(warmCallIndex >= 0)
  assert.ok(warmEffectStart >= 0)
  assert.ok(warmEffectEnd >= 0)

  return source.slice(warmEffectStart, warmEffectEnd)
}

function assertStripeWarmEffectGuards(source: string) {
  assert.match(
    getStripeWarmEffect(source),
    /if \(!canStartPayment \|\| !stripeCheckoutMounted\) return\s+warmOfferStripe\(\)/,
  )
}

test("one-time Stripe.js warms while the prepared checkout request is pending", () => {
  const warmCallIndex = checkoutSource.indexOf("warmOfferStripe()")
  const prepareCallIndex = checkoutSource.indexOf("void fetchClientSecret()")

  assert.ok(warmCallIndex >= 0)
  assert.ok(prepareCallIndex >= 0)
  assert.ok(warmCallIndex < prepareCallIndex)
  assertStripeWarmEffectGuards(checkoutSource)

  const unguardedWarmSource = checkoutSource.replace(
    "    if (!canStartPayment || !stripeCheckoutMounted) return\n    warmOfferStripe()",
    "    warmOfferStripe()",
  )
  assert.notEqual(unguardedWarmSource, checkoutSource)
  assert.throws(() => assertStripeWarmEffectGuards(unguardedWarmSource))
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
  assert.match(pricingSource, /expressElementsEnabled,[\s\S]*offerContext,[\s\S]*onCheckoutOpen/)
  assert.match(
    checkoutSource,
    /stripeCheckoutMounted = stripeAvailable && Boolean\(checkoutAttemptId\)/,
  )
  assert.match(
    checkoutSource,
    /const primaryPaymentBody =[\s\S]*!stripeAvailable \? \([\s\S]*paypalPaymentOption \? null[\s\S]*stripeCheckoutMounted && preparedStripeCheckoutState\.kind === "ready"/,
  )
})

test("a PayPal-owned checkout stays usable without presenting a generic Stripe failure", () => {
  assert.match(
    stripeCheckoutRouteSource,
    /error: "payment provider already selected", provider_locked: "paypal"/,
  )
  assert.match(checkoutSource, /provider_locked_paypal/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "provider_locked_paypal"/)
  assert.match(checkoutSource, /Dieser Zahlungsversuch läuft bereits über PayPal/)
  assert.match(checkoutSource, /Karte ist für diesen Zahlungsversuch nicht verfügbar/)
  assert.match(checkoutSource, /onProviderSelected/)
  assert.match(
    paypalSource,
    /intentTokenRef\.current = body\.token[\s\S]*onProviderSelected\?\.\(\)/,
  )
  assert.match(checkoutSource, /const paypalStableSlot =/)
  assert.match(checkoutSource, /data-one-time-paypal-stable-slot="true"/)
  assert.match(
    checkoutSource,
    /const primaryPaymentBody =[\s\S]*preparedStripeCheckoutState\.kind === "provider_locked_paypal" \? \([\s\S]*paypalOwnedUnavailableCard/,
  )
  assert.match(
    checkoutSource,
    /paypalOwnedAttempt && !paypalPaymentOption[\s\S]*PayPal kann hier gerade nicht geladen werden/,
  )
  assert.match(checkoutSource, /\{primaryPaymentBody\}\s*\{paypalStableSlot\}/)
  assert.equal((checkoutSource.match(/\{paypalStableSlot\}/g) ?? []).length, 1)
  assert.doesNotMatch(checkoutSource, /secondaryPaymentMethod=\{[\s\S]*paypalPaymentOption/)
})

test("one-time preparation resolves provider ownership before mounting Stripe Elements", () => {
  assert.match(checkoutSource, /PreparedStripeCheckoutState/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "provider_locked_paypal"/)
  assert.match(checkoutSource, /Dieser Zahlungsversuch läuft bereits über PayPal/)
  assert.match(
    checkoutSource,
    /preparedStripeCheckoutState\.kind === "ready"[\s\S]*?<StripeOfferElementsCheckout/,
  )
  assert.doesNotMatch(checkoutSource, /type StripeControlRecovery/)
  assert.doesNotMatch(checkoutSource, /prepared_checkout_control:provider_locked/)
  assert.match(
    checkoutSource,
    /clientSecret=\{preparedStripeCheckoutState\.checkout\.clientSecret\}/,
  )
  assert.match(checkoutSource, /preparedStripeCheckoutState\.checkout\.owner === "stripe"/)
})

test("PayPal pending capture continues to welcome while an expired intent stops blind retries", () => {
  assert.match(
    paypalCaptureRouteSource,
    /error\.code === "paypal_order_capture_pending"[\s\S]*status: "pending"[\s\S]*status: 202/,
  )
  assert.match(paypalSource, /body\.status === "pending"/)
  assert.match(paypalSource, /claimWelcomeNavigation\(body\.welcomeUrl\)/)
  assert.match(paypalSource, /body\.error === "paypal_order_intent_expired"/)
  assert.match(paypalSource, /Die PayPal-Zahlung ist abgelaufen/)
  assert.match(paypalSource, /mailto:/)
  assert.match(
    paypalOrderRouteSource,
    /createPayPalOrderIntent[\s\S]*isUniqueViolation[\s\S]*consent_id[\s\S]*paypal_order_intent_expired/,
  )
})

test("one-time Apple Pay does no provider work before the drawer opens", () => {
  assert.doesNotMatch(pricingSource, /const oneTimePrewarmEnabled =/)
  assert.doesNotMatch(pricingSource, /oneTimePrewarmEligible/)
  assert.doesNotMatch(pricingSource, /stripePreparationRefreshRequestId/)
  assert.doesNotMatch(pricingSource, /keepMounted=\{oneTimePrewarmEligible\}/)
  assert.match(pricingSource, /attemptId \? \(/)
  assert.match(pricingSource, /keepMounted=\{Boolean\(attemptId\)\}/)
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
  assert.match(
    openCheckout,
    /const next = attempts\.open\(\)[\s\S]*const nextAttemptId = next\.checkoutAttemptId/,
  )
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
  assert.match(
    checkoutSource,
    /canStartPayment &&[\s\S]*stripeCheckoutMounted &&[\s\S]*preparedStripeCheckoutState\.kind === "ready"/,
  )
  assert.match(checkoutSource, /preparedStripeCheckoutRef\.current = null/)
  assert.match(checkoutSource, /kind: "unavailable"/)
  assert.match(checkoutSource, /throw createAlreadyReportedPreparedCheckoutError\(error\)/)
})

test("one-time Stripe preparation watchdog reports a late response without changing the request or control recovery", () => {
  assert.match(checkoutSource, /const PREPARED_STRIPE_RESPONSE_TIMEOUT_MS = 10_000/)
  assert.match(checkoutSource, /const reportStripePreparationTimeout = useCallback/)
  assert.match(checkoutSource, /signal: "checkout_experience_degraded"/)
  assert.match(checkoutSource, /status: "provider_request_timeout"/)
  assert.match(checkoutSource, /failureReason: "provider_request_timeout"/)
  assert.match(checkoutSource, /transition: "provider_load_started"/)
  assert.match(checkoutSource, /stripePreparationRequestTimerRef\.current = window\.setTimeout/)
  assert.match(
    checkoutSource,
    /const isCurrentPreparation = \(\) =>[\s\S]*active\.checkoutAttemptId === requestAttemptId[\s\S]*active\.stripePreparationId === requestPreparationId/,
  )
  assert.match(checkoutSource, /if \(!isCurrentPreparation\(\)\) return ""/)
  assert.match(
    checkoutSource,
    /finally \{\s*clearStripePreparationRequestTimer\(requestPreparationId\)/,
  )
  assert.doesNotMatch(checkoutSource, /failureReason: "silent_control_outcome"/)
  assert.doesNotMatch(checkoutSource, /AbortController/)
  assert.match(
    checkoutSource,
    /catch \(error\) \{[\s\S]*setPreparedStripeCheckoutState\(\{ kind: "unavailable" \}\)/,
  )
  const preparationCatch = checkoutSource.slice(
    checkoutSource.indexOf(
      "} catch (error) {",
      checkoutSource.indexOf("prepareStripeClientSecret"),
    ),
    checkoutSource.indexOf("throw createAlreadyReportedPreparedCheckoutError(error)"),
  )
  assert.ok(
    preparationCatch.indexOf('setPreparedStripeCheckoutState({ kind: "unavailable" })') >= 0 &&
      preparationCatch.indexOf('setPreparedStripeCheckoutState({ kind: "unavailable" })') <
        preparationCatch.indexOf("if (visibleRef.current)"),
    "a preparation failure must remain recoverable even if it settles while the sheet is hidden",
  )
})

test("one-time controls render from the preparation union without payment-failure reporting", () => {
  assert.match(checkoutSource, /type PreparedStripeCheckoutState/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "unavailable"/)
  assert.match(checkoutSource, /Haarplan-Zahlung erneut vorbereiten/)
  assert.match(
    checkoutSource,
    /Die Kartenzahlung konnte nicht mit diesem vorbereiteten Zahlungsversuch verbunden werden\./,
  )
  assert.match(checkoutSource, /rotateStripePreparationForRecovery/)
  assert.match(checkoutSource, /stripeControlRecoveryRotatedRef\.current/)
  assert.match(
    checkoutSource,
    /preparedStripeCheckoutState\.kind === "unavailable"[\s\S]*Haarplan-Zahlung erneut vorbereiten/,
  )
  assert.doesNotMatch(checkoutSource, /prepared_checkout_control:provider_locked/)
  assert.match(checkoutSource, /Kartenzahlung wieder öffnen/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "provider_locked_stripe"/)
  assert.match(
    checkoutSource,
    /resolvedState\.kind === "duplicate_access"[\s\S]*setDuplicateDialogOpen\(true\)/,
  )
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "duplicate_access"/)
  assert.match(checkoutSource, /Dein Haarplan-Zugang ist bereits aktiv/)
  assert.match(checkoutSource, /Bestehenden Zugang öffnen/)
  assert.match(
    checkoutSource,
    /const paypalSuppressedByStripeOwner =[\s\S]*preparedStripeCheckoutState\.kind === "duplicate_access"/,
  )
  assert.match(
    checkoutSource,
    /trackCheckoutLifecycle\([\s\S]*recoveryReason:[\s\S]*"prepared_checkout_unavailable"[\s\S]*transition: "recovery_presented"/,
  )
  assert.doesNotMatch(checkoutSource, /silent_control_outcome/)
})

test("one-time preparation credential is not rotated by first mount or same-attempt hide", () => {
  const oneTime = pricingSource.slice(
    pricingSource.indexOf("function PersonalPlanOneTimePricing"),
    pricingSource.indexOf("function MembershipResultOfferPricing"),
  )
  assert.match(
    checkoutSource,
    /useState<PreparedCheckoutCredential>\(createPreparedCheckoutCredential\)/,
  )
  assert.match(checkoutSource, /const mountedCheckoutAttemptIdRef = useRef\(checkoutAttemptId\)/)
  assert.match(
    checkoutSource,
    /if \(mountedCheckoutAttemptIdRef\.current === checkoutAttemptId\) return[\s\S]*setStripePreparationCredential\(createPreparedCheckoutCredential\(\)\)/,
  )
  const hideCheckout = oneTime.slice(
    oneTime.indexOf("const hideCheckout = useCallback"),
    oneTime.indexOf("const endCheckout = useCallback"),
  )
  assert.doesNotMatch(
    hideCheckout,
    /hideCheckout[\s\S]*setAttemptId\(null\)[\s\S]*<PersonalPlanOneTimeCheckout/,
  )
  assert.match(oneTime, /keepMounted=\{Boolean\(attemptId\)\}/)
  assert.match(
    checkoutSource,
    /const paypalSuppressedByStripeOwner =[\s\S]*preparedStripeCheckoutState\.kind === "provider_locked_stripe"/,
  )
  assert.doesNotMatch(
    checkoutSource.slice(
      checkoutSource.indexOf("const paypalSuppressedByStripeOwner ="),
      checkoutSource.indexOf("const paypalPaymentOption ="),
    ),
    /stripeSelected/,
  )
  assert.match(checkoutSource, /const paypalPaymentOption =[\s\S]*!paypalSuppressedByStripeOwner/)
  assert.doesNotMatch(checkoutSource, /visible &&\s*checkoutAttemptId && paypalCheckoutEnabled/)
  assert.match(
    checkoutSource,
    /if \(!visible \|\| wasVisible\) return[\s\S]*isPreparedCheckoutUsable\(cachedPreparation\.expiresAt\)[\s\S]*setStripePreparationCredential\(createPreparedCheckoutCredential\(\)\)/,
  )
  assert.match(checkoutSource, /if \(!isPreparedCheckoutUsable\(preparation\.expiresAt\)\)/)
})

test("a successful Stripe claim records ownership before provider confirmation continues", () => {
  const successfulClaim = checkoutSource.slice(
    checkoutSource.indexOf("preparation.claimed = true"),
    checkoutSource.indexOf("return true", checkoutSource.indexOf("preparation.claimed = true")) +
      "return true".length,
  )

  assert.match(successfulClaim, /setStripeSelected\(true\)/)
  assert.match(successfulClaim, /owner: "stripe"/)
  assert.match(successfulClaim, /trackCheckoutStarted\("stripe"/)
})

test("fresh card selection is rendered independently of PayPal availability", () => {
  const paypalSlot = checkoutSource.slice(
    checkoutSource.indexOf("const paypalStableSlot ="),
    checkoutSource.indexOf("const stripeControlRecoveryCard ="),
  )
  const returnBody = checkoutSource.slice(checkoutSource.indexOf("return ("))

  assert.match(checkoutSource, /const stripeSelectionControl =/)
  assert.match(checkoutSource, /preparedStripeCheckoutState\.kind === "ready" && !stripeSelected/)
  assert.match(checkoutSource, /Mit Karte bezahlen/)
  assert.doesNotMatch(paypalSlot, /stripeSelectionControl/)
  assert.match(
    returnBody,
    /\{primaryPaymentBody\}\s*\{paypalStableSlot\}\s*\{stripeSelectionControl\}/,
  )
})

test("pre-claim Stripe selection keeps PayPal available and exposes a switch-back control", () => {
  const paypalSuppression = checkoutSource.slice(
    checkoutSource.indexOf("const paypalSuppressedByStripeOwner ="),
    checkoutSource.indexOf("const paypalPaymentOption ="),
  )
  const switchBack = checkoutSource.slice(
    checkoutSource.indexOf("const stripeSwitchBackControl ="),
    checkoutSource.indexOf("const paypalStableSlot ="),
  )

  assert.doesNotMatch(paypalSuppression, /stripeSelected/)
  assert.match(paypalSuppression, /preparedStripeCheckoutState\.checkout\.owner === "stripe"/)
  assert.match(switchBack, /stripeSelected/)
  assert.match(switchBack, /preparedStripeCheckoutState\.checkout\.owner !== "stripe"/)
  assert.match(switchBack, /paypalPaymentOption/)
  assert.match(switchBack, /setStripeSelected\(false\)/)
  assert.match(switchBack, /Stattdessen PayPal verwenden/)
})

test("Stripe auto-preparation is single-flight for one preparation id and resets on rotation", () => {
  assert.match(
    checkoutSource,
    /const stripePreparationInFlightRef = useRef<\{[\s\S]*preparationId: string[\s\S]*promise: Promise<string>/,
  )
  assert.match(
    checkoutSource,
    /if \(inFlightPreparation\?\.preparationId === stripePreparationId\) \{[\s\S]*return inFlightPreparation\.promise/,
  )
  assert.match(
    checkoutSource,
    /stripePreparationInFlightRef\.current = \{[\s\S]*preparationId: stripePreparationId,[\s\S]*promise: preparationPromise/,
  )
  assert.match(
    checkoutSource,
    /if \(stripePreparationInFlightRef\.current\?\.promise === preparationPromise\) \{[\s\S]*stripePreparationInFlightRef\.current = null/,
  )
  assert.match(
    checkoutSource,
    /mountedCheckoutAttemptIdRef\.current = checkoutAttemptId[\s\S]*preparedStripeCheckoutRef\.current = null[\s\S]*stripePreparationInFlightRef\.current = null/,
  )
  assert.match(
    checkoutSource,
    /const rotateStripePreparationForRecovery = useCallback\(\(\) => \{[\s\S]*preparedStripeCheckoutRef\.current = null[\s\S]*stripePreparationInFlightRef\.current = null/,
  )
  assert.match(
    checkoutSource,
    /onRetry=\{\(\) => \{[\s\S]*preparedStripeCheckoutRef\.current = null[\s\S]*stripePreparationInFlightRef\.current = null/,
  )
})

test("an expired prepared Stripe checkout returns the parent union to loading before rotation", () => {
  const expiredPreparationBranch = checkoutSource.slice(
    checkoutSource.indexOf("if (!isPreparedCheckoutUsable(preparation.expiresAt))"),
    checkoutSource.indexOf("if (preparation.claimed) return true"),
  )

  assert.match(expiredPreparationBranch, /preparedStripeCheckoutRef\.current = null/)
  assert.match(expiredPreparationBranch, /setPreparedStripeCheckoutState\(\{ kind: "loading" \}\)/)
  assert.match(
    expiredPreparationBranch,
    /setStripePreparationCredential\(createPreparedCheckoutCredential\(\)\)/,
  )
})

test("one-time pricing preserves the offer-to-provider analytics journey", () => {
  assert.match(pricingSource, /trackAppEvent\("pricing_viewed"/)
  assert.match(pricingSource, /trackAppEvent\("offer_checkout_opened"/)
  assert.match(pricingSource, /\.\.\.personalPlanOneTimeCommerce/)
  assert.match(pricingSource, /checkoutAttemptId=\{attemptId\}/)
  assert.match(checkoutSource, /trackAppEvent\("checkout_started"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_method_selected"/)
  assert.match(checkoutSource, /trackAppEvent\("offer_payment_option_viewed"/)
  assert.match(
    checkoutSource,
    /trackCheckoutLifecycle\([\s\S]*transition: "payment_surface_selected"/,
  )
  assert.match(checkoutSource, /trackCheckoutLifecycle\([\s\S]*transition: "preparation_started"/)
  assert.match(
    checkoutSource,
    /trackCheckoutLifecycle\([\s\S]*transition: "prepared_response_received"/,
  )
  assert.match(checkoutSource, /trackCheckoutLifecycle\([\s\S]*transition: "confirm_started"/)
  assert.match(checkoutSource, /trackCheckoutLifecycle\([\s\S]*transition: "claimed"/)
  assert.match(checkoutSource, /trackCheckoutLifecycle\([\s\S]*transition: "provider_ready"/)
  assert.match(checkoutSource, /trackCheckoutLifecycle\([\s\S]*transition: "payment_engaged"/)
  assert.match(checkoutSource, /claimOfferPaymentOptionView/)
  assert.match(checkoutSource, /onPaymentMethodSelected=\{handlePaymentMethodSelected\}/)
  assert.match(checkoutSource, /onPaymentOptionViewed=\{handlePaymentOptionViewed\}/)
  assert.match(checkoutSource, /providerReady=\{paypalReady\}/)
  assert.match(checkoutSource, /data-offer-payment-placeholder="paypal"/)
  assert.match(checkoutSource, /PayPal wird geladen …/)
  assert.match(checkoutSource, /Boolean\(process\.env\.NEXT_PUBLIC_PAYPAL_CLIENT_ID\?\.trim\(\)\)/)
  assert.match(
    checkoutSource,
    /const stripeAvailable = stripeElementsEnabled && stripePublishableKeyPresent/,
  )
  assert.match(
    checkoutSource,
    /const stripeCheckoutMounted = stripeAvailable && Boolean\(checkoutAttemptId\)/,
  )
  assert.match(
    checkoutSource,
    /paymentElementEnabled=\{[\s\S]*stripeSelected \|\| preparedStripeCheckoutState\.checkout\.owner === "stripe"[\s\S]*\}/,
  )
  assert.match(checkoutSource, /visible=\{visible\}/)
  assert.match(
    paypalSource,
    /onInit=\{\(\) => \{[\s\S]*onClientMounted\?\.\(\)[\s\S]*onReady\?\.\(\)/,
  )
  assert.match(
    paypalSource,
    /onPaymentMethodSelected\?\.\(\)[\s\S]*onConfirmStarted\?\.\(\)[\s\S]*fetch\("\/api\/paypal\/create-order-intent"/,
  )
  assert.match(checkoutSource, /onClientMounted=\{\(provider, option\) =>/)
  assert.match(checkoutSource, /onConfirmStarted=\{\(provider, option\) =>/)
  assert.match(checkoutSource, /onProviderReady=\{\(provider, option\) =>/)
  assert.match(paypalSource, /onPaymentMethodSelected\?\.\(\)/)
  assert.match(paypalSource, /onCheckoutStarted\?\.\(funnelEventId\)/)
})

test("one-time pricing ignores duplicate visible opens but resumes a hidden attempt", () => {
  assert.match(
    pricingSource,
    /const attemptsRef = useRef<CheckoutAttemptController \| null>\(null\)/,
  )
  assert.match(
    pricingSource,
    /const openCheckout = useCallback\(\(\) => \{[\s\S]*if \(open\) return[\s\S]*if \(attemptId\) \{[\s\S]*attempts\.resume\(\)/,
  )
  assert.match(
    pricingSource,
    /const hideCheckout = useCallback\(\(\) => \{[\s\S]*attempts\.hide\(\)/,
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
  assert.doesNotMatch(stripePreparation, /trackCheckoutStarted\("stripe"/)
  assert.match(
    checkoutSource,
    /const funnelEventId = preparation\.claimFunnelEventId \?\? createFunnelEventId\(\)[\s\S]*funnelEventId,[\s\S]*body\.status !== "claimed"[\s\S]*return false[\s\S]*trackCheckoutStarted\("stripe", "explicit_provider_action", funnelEventId\)/,
  )
  assert.match(
    paypalSource,
    /const funnelEventId = payPalFunnelEventIdForAttempt\(\)[\s\S]*funnelEventId,[\s\S]*typeof body\.token !== "string"[\s\S]*throw new Error\("PayPal order creation failed"\)[\s\S]*intentTokenRef\.current = body\.token[\s\S]*onProviderSelected\?\.\(\)[\s\S]*onCheckoutStarted\?\.\(funnelEventId\)[\s\S]*return body\.orderId/,
  )
})

test("one-time PayPal reports visible payment failures once and excludes control conflicts", () => {
  assert.match(paypalSource, /usePaymentRuntime/)
  assert.match(paypalSource, /useOfferTrackingContext/)
  assert.match(paypalSource, /capturePayPalOneTimeCustomerPaymentError/)
  assert.match(paypalSource, /signal = "customer_payment_error_observed"/)
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
  assert.doesNotMatch(createOrderSource, /consent/)
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
  assert.match(sdkErrorSource, /startPayPalSdkErrorRecovery\(\)/)
  assert.doesNotMatch(sdkErrorSource, /status: "paypal_button_error"/)
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

test("one-time checkout leads with the approved guarantee and ends with privacy and legal routes", () => {
  const guarantee = checkoutSource.indexOf("14 Tage Geld-zurück-Garantie")
  const paymentOptions = checkoutSource.indexOf("const paypalPaymentOption")
  const privacy = checkoutSource.indexOf("Zahlungsdaten verarbeitet dein gewählter Anbieter")
  assert.ok(guarantee >= 0)
  assert.ok(paymentOptions >= 0)
  assert.ok(privacy >= 0)
  assert.ok(guarantee < privacy)
  assert.match(
    checkoutSource,
    /Wenn Chaarlie für dich nicht hilfreich ist, erhältst du eine vollständige Rückerstattung\./,
  )
  assert.match(checkoutSource, /href="\/datenschutz"/)
  assert.match(checkoutSource, /href="\/agb"/)
  assert.match(checkoutSource, /href="\/widerruf"/)
  assert.match(checkoutSource, /href="\/kontakt"/)
  assert.doesNotMatch(checkoutSource, /Sicher bezahlen über deinen gewählten Zahlungsanbieter/)
})

test("one-time legal pages promise the approved refund treatment without obsolete OS text", () => {
  assert.match(withdrawalSource, /14-Tage-Geld-zurück-Garantie/)
  assert.match(withdrawalSource, /vollständige Rückerstattung/)
  assert.doesNotMatch(
    withdrawalSource,
    /Geld-zurück-Garantie wird für diesen Einmalkauf nicht zugesagt/,
  )
  assert.match(termsSource, /Einmalkauf[\s\S]*14-Tage-Geld-zurück-Garantie/)
  assert.doesNotMatch(imprintSource, /Online-Streitbeilegung|consumers\/odr/)
})

test("one-time checkout isolates terminal attempts while preserving hidden resumes", () => {
  assert.match(
    pricingSource,
    /const attemptsRef = useRef<CheckoutAttemptController \| null>\(null\)/,
  )
  assert.match(
    pricingSource,
    /const hideCheckout = useCallback\(\(\) => \{[\s\S]*attempts\.hide\(\)[\s\S]*setOpen\(false\)[\s\S]*setEngaged\(false\)/,
  )
  assert.match(
    pricingSource,
    /const endCheckout = useCallback\([\s\S]*attempts\.end\(\)[\s\S]*setAttemptId\(null\)/,
  )
  assert.match(
    checkoutSource,
    /checkoutStartedProvidersRef\.current\.clear\(\)[\s\S]*firstEngagementRef\.current = false[\s\S]*\}, \[checkoutAttemptId\]\)/,
  )
  assert.match(
    pricingSource,
    /onConfirmedAbort=\{\(\) =>\s*engaged\s*\? endCheckout\(\{[\s\S]*endReason: "customer_aborted"[\s\S]*\}\)\s*: hideCheckout\(\)/,
  )
  assert.match(pricingSource, /setAttemptId\(nextAttemptId\)\s*setOpen\(true\)/)
})
