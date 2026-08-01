import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { StripeCheckoutSession } from "@stripe/stripe-js"

import {
  getPreparedCheckoutSyncRemainingMs,
  createStripeOfferElementsState,
  formatCheckoutTotal,
  getChangedApplePayAvailability,
  getApplePayAvailability,
  getStripeExpressCheckoutExceptionReason,
  getStripeOfferElementsErrorMessage,
  hasApplePayMethod,
  isWalletDebugEnabled,
  isWalletExpressDomProbeEnabled,
  isWalletPaymentEligibilityProbeEnabled,
  normalizeWalletDebugMethods,
  reconcilePaymentElementApplePayAvailability,
  synchronizePreparedCheckoutSession,
  StripeOfferElementsCheckoutContent,
  stripeOfferCheckoutAppearance,
  stripeOfferExpressCheckoutOptions,
} from "../src/components/checkout/stripe-offer-elements-checkout"

const zeroAmount = {
  amount: "0,00 €",
  minorUnitsAmount: 0,
}

const sessionTotal = {
  total: {
    appliedBalance: zeroAmount,
    balanceAppliedToNextInvoice: false,
    discount: zeroAmount,
    shippingRate: zeroAmount,
    subtotal: {
      amount: "34,99 €",
      minorUnitsAmount: 3499,
    },
    surcharge: zeroAmount,
    taxExclusive: zeroAmount,
    taxInclusive: zeroAmount,
    total: {
      amount: "34,99 €",
      minorUnitsAmount: 3499,
    },
  },
} satisfies Pick<StripeCheckoutSession, "total">

const stripeOfferElementsSource = readFileSync(
  new URL("../src/components/checkout/stripe-offer-elements-checkout.tsx", import.meta.url),
  "utf8",
)

const applePayAvailable = {
  amazonPay: false,
  applePay: true,
  googlePay: false,
  link: false,
  paypal: false,
  klarna: false,
}

test("offer Checkout Elements helpers keep Apple Pay gated and submit labels session-backed", () => {
  assert.equal(hasApplePayMethod({ availablePaymentMethods: undefined }), false)
  assert.equal(hasApplePayMethod({ availablePaymentMethods: applePayAvailable }), true)
  assert.equal(getApplePayAvailability({ availablePaymentMethods: undefined }), "unavailable")
  assert.equal(
    getApplePayAvailability({
      availablePaymentMethods: {
        ...applePayAvailable,
        applePay: false,
      },
    }),
    "unavailable",
  )
  assert.equal(getApplePayAvailability({ availablePaymentMethods: applePayAvailable }), "available")
  assert.equal(getChangedApplePayAvailability({ paymentMethods: undefined }), "unavailable")
  assert.equal(
    getChangedApplePayAvailability({
      paymentMethods: {
        applePay: { available: true },
      },
    }),
    "available",
  )
  assert.equal(
    getChangedApplePayAvailability({
      paymentMethods: {
        applePay: { available: false },
      },
    }),
    "unavailable",
  )
  assert.equal(
    getChangedApplePayAvailability({
      paymentMethods: {
        paypal: { available: true },
      },
    }),
    "unavailable",
  )
  assert.equal(formatCheckoutTotal(sessionTotal), "34,99 €")
  assert.equal(formatCheckoutTotal(null), "Wird berechnet")

  assert.deepEqual(
    createStripeOfferElementsState({
      applePayAvailable: true,
      canConfirm: true,
      confirming: false,
      session: sessionTotal,
    }),
    {
      applePayReady: true,
      canSubmit: true,
      confirming: false,
      errorMessage: null,
      totalLabel: "34,99 €",
    },
  )

  assert.equal(
    createStripeOfferElementsState({
      applePayAvailable: false,
      canConfirm: true,
      confirming: true,
      session: sessionTotal,
    }).canSubmit,
    false,
  )

  assert.deepEqual(stripeOfferExpressCheckoutOptions.paymentMethods, {
    applePay: "always",
    googlePay: "never",
    link: "never",
    paypal: "never",
    amazonPay: "never",
    klarna: "never",
  })
  assert.deepEqual(stripeOfferExpressCheckoutOptions.layout, {
    maxColumns: 1,
    maxRows: 1,
    overflow: "auto",
  })
  assert.equal(
    stripeOfferExpressCheckoutOptions.layout?.overflow !== "never" ||
      stripeOfferExpressCheckoutOptions.layout?.maxRows === 0,
    true,
    "Stripe only accepts overflow=never when maxRows=0",
  )
  assert.equal(stripeOfferExpressCheckoutOptions.buttonType?.applePay, "plain")
  assert.equal(stripeOfferCheckoutAppearance.variables?.borderRadius, "26px")
  assert.match(getStripeOfferElementsErrorMessage(), /Zahlung konnte nicht bestätigt werden/)
})

test("first payment engagement ignores readiness, marks non-empty Payment Element input once, and precedes Stripe confirmation", () => {
  assert.match(stripeOfferElementsSource, /onFirstPaymentEngagement\?: \(\) => void/)
  assert.match(stripeOfferElementsSource, /const firstPaymentEngagementRef = useRef\(false\)/)
  assert.match(
    stripeOfferElementsSource,
    /if \(firstPaymentEngagementRef\.current \|\| !onFirstPaymentEngagement\) return/,
  )
  assert.match(
    stripeOfferElementsSource,
    /useEffect\(\(\) => \{\s*firstPaymentEngagementRef\.current = false\s*\}, \[checkoutAttemptId\]\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onChange=\{\(event(?:: StripePaymentElementChangeEvent)?\) => \{\s*if \(!event\.empty\) markFirstPaymentEngagement\(\)/,
  )

  const confirmCheckoutStart = stripeOfferElementsSource.indexOf(
    "const confirmCheckout = useCallback",
  )
  const firstEngagementInConfirm = stripeOfferElementsSource.indexOf(
    "markFirstPaymentEngagement()",
    confirmCheckoutStart,
  )
  const claimStripeInConfirm = stripeOfferElementsSource.indexOf(
    "claimStripe(paymentMethodType)",
    confirmCheckoutStart,
  )
  assert.ok(firstEngagementInConfirm > confirmCheckoutStart)
  assert.ok(claimStripeInConfirm > firstEngagementInConfirm)

  const paymentReadyStart = stripeOfferElementsSource.indexOf("onReady={() => {")
  const paymentReadyEnd = stripeOfferElementsSource.indexOf("}}", paymentReadyStart)
  assert.ok(paymentReadyStart > -1)
  assert.doesNotMatch(
    stripeOfferElementsSource.slice(paymentReadyStart, paymentReadyEnd),
    /markFirstPaymentEngagement/,
  )
})

test("Express Checkout returns its confirmation promise and keeps ordinary card submission fire-and-forget", () => {
  assert.match(
    stripeOfferElementsSource,
    /onConfirm: \(event: StripeExpressCheckoutElementConfirmEvent\) => Promise<void>/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onConfirm: \(event\) => confirmCheckout\("apple_pay", event\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onConfirm=\{\(event\) => confirmCheckout\("apple_pay", event\)\}/,
  )
  assert.doesNotMatch(
    stripeOfferElementsSource,
    /onConfirm(?::|=\{)\s*\(event\)[\s\S]*?void confirmCheckout\("apple_pay", event\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onClick=\{\(\) => void confirmCheckout\("payment_element"\)\}/,
  )
})

test("Express Checkout bypasses only Payment Element readiness and traces every retained guard", () => {
  assert.match(stripeOfferElementsSource, /!expressCheckoutConfirmEvent && !checkout\.canConfirm/)
  assert.match(stripeOfferElementsSource, /"checkout_unavailable"/)
  assert.match(stripeOfferElementsSource, /"confirmation_in_flight"/)
  assert.match(stripeOfferElementsSource, /"prepared_checkout_not_synchronized"/)
  assert.match(stripeOfferElementsSource, /"payment_element_not_confirmable"/)
  assert.match(
    stripeOfferElementsSource,
    /recordWalletDebugEvent\("express_confirm_rejected", undefined, reason\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /const rejectConfirmation = \(reason: string\) => \{[\s\S]*?expressCheckoutConfirmEvent\?\.paymentFailed/,
  )
  assert.match(
    stripeOfferElementsSource,
    /if \(!claimStripe\(paymentMethodType\)\) \{\s*rejectConfirmation\("provider_locked"\)/,
  )
})

test("Stripe customer-visible confirmation failures emit classified browser payment signals once", () => {
  assert.match(stripeOfferElementsSource, /usePaymentRuntime/)
  assert.match(stripeOfferElementsSource, /useOfferTrackingContext/)
  assert.match(stripeOfferElementsSource, /capturePaymentFailure/)
  assert.match(stripeOfferElementsSource, /signal: "customer_payment_error_observed"/)
  assert.match(stripeOfferElementsSource, /provider: "stripe"/)
  assert.match(stripeOfferElementsSource, /origin: "browser"/)
  assert.match(stripeOfferElementsSource, /truth: "unknown"/)
  assert.match(stripeOfferElementsSource, /live: stripeLive/)
  assert.match(stripeOfferElementsSource, /isInternalTest/)
  assert.match(stripeOfferElementsSource, /method: mapStripeOfferPaymentMethod\(method\)/)
  assert.match(stripeOfferElementsSource, /status: reason/)

  const reasonType = stripeOfferElementsSource.slice(
    stripeOfferElementsSource.indexOf("type StripeCustomerPaymentErrorReason"),
    stripeOfferElementsSource.indexOf("const STRIPE_CUSTOMER_PAYMENT_ERROR_FAMILY_BY_REASON"),
  )
  assert.match(reasonType, /"checkout_unavailable"/)
  assert.match(reasonType, /"prepared_checkout_not_synchronized"/)
  assert.match(reasonType, /"payment_element_not_confirmable"/)
  assert.match(reasonType, /"confirm_error"/)
  assert.match(reasonType, /"confirm_event_invalid"/)
  assert.match(reasonType, /"exception"/)
  assert.doesNotMatch(reasonType, /"confirmation_in_flight"/)
  assert.doesNotMatch(reasonType, /"provider_locked"/)

  const confirmCheckoutSource = stripeOfferElementsSource.slice(
    stripeOfferElementsSource.indexOf("const confirmCheckout = useCallback"),
    stripeOfferElementsSource.indexOf('if (checkoutResult.type === "error")'),
  )
  const reportAndReject = confirmCheckoutSource.indexOf("const reportAndRejectConfirmation")
  const reportCall = confirmCheckoutSource.indexOf(
    "captureStripeCustomerPaymentError",
    reportAndReject,
  )
  const rejectCall = confirmCheckoutSource.indexOf("rejectConfirmation(reason)", reportAndReject)
  assert.ok(reportAndReject > -1)
  assert.ok(reportCall > reportAndReject)
  assert.ok(rejectCall > reportCall)
  assert.match(confirmCheckoutSource, /reportAndRejectConfirmation\("checkout_unavailable"\)/)
  assert.match(
    confirmCheckoutSource,
    /reportAndRejectConfirmation\(confirmationGuardFailureReason\)/,
  )
  assert.match(confirmCheckoutSource, /reason: "confirm_error"/)
  assert.match(confirmCheckoutSource, /reason,\s*source: observabilitySource,\s*\}\)/)
  assert.match(confirmCheckoutSource, /rejectConfirmation\("provider_locked"\)/)
  assert.doesNotMatch(confirmCheckoutSource, /captureCheckoutException\(result\.error/)
  assert.doesNotMatch(confirmCheckoutSource, /Stripe Express Checkout confirmation failed/)
})

test("Express Checkout failures preserve bounded provider errors and classify unknown exceptions safely", () => {
  assert.equal(
    getStripeExpressCheckoutExceptionReason(
      new Error("The confirm method must be called within the confirm event emitted by Stripe"),
    ),
    "confirm_event_invalid",
  )
  assert.equal(
    getStripeExpressCheckoutExceptionReason({
      message: "The confirm method must be called within the confirm event emitted by Stripe",
    }),
    "confirm_event_invalid",
  )
  assert.equal(
    getStripeExpressCheckoutExceptionReason(new Error("network unavailable")),
    "exception",
  )
  const hostileThrownValue = {
    client_secret: "secret",
    email: "person@example.com",
    address: { line1: "Private street" },
    payment_method: { id: "pm_secret" },
  }
  const hostileReason = getStripeExpressCheckoutExceptionReason(hostileThrownValue)
  assert.equal(hostileReason, "exception")
  assert.equal(JSON.stringify(hostileReason).includes("secret"), false)
  assert.equal(JSON.stringify(hostileReason).includes("person@example.com"), false)

  assert.match(stripeOfferElementsSource, /reason: "confirm_error"/)
  assert.match(
    stripeOfferElementsSource,
    /const reason = getStripeExpressCheckoutExceptionReason\(error\)/,
  )
  assert.doesNotMatch(stripeOfferElementsSource, /captureCheckoutException\(error,/)
  assert.doesNotMatch(stripeOfferElementsSource, /Stripe Express Checkout confirmation failed/)
  assert.match(stripeOfferElementsSource, /const message = getStripeOfferElementsErrorMessage\(\)/)
})

test("prepared checkout synchronization runs the claim inside Stripe's server-update boundary", async () => {
  let activateCalls = 0
  let runServerUpdateCalls = 0
  let returnedResponse: Response | null = null
  const activationResponse = new Response(null, { status: 200 })
  const result = await synchronizePreparedCheckoutSession(
    {
      runServerUpdate: async (update) => {
        runServerUpdateCalls += 1
        returnedResponse = await update()
        return { type: "success" }
      },
    },
    async (signal) => {
      activateCalls += 1
      assert.equal(signal.aborted, false)
      return { activated: true, response: activationResponse }
    },
    100,
  )

  assert.equal(runServerUpdateCalls, 1)
  assert.equal(activateCalls, 1)
  assert.equal(returnedResponse, activationResponse)
  assert.equal(result.status, "succeeded")
})

test("prepared checkout synchronization rejects claim, Stripe errors, and timeouts", async () => {
  const claimFailure = await synchronizePreparedCheckoutSession(
    {
      runServerUpdate: async (update) => {
        await update()
        return { type: "success" }
      },
    },
    async () => ({ activated: false, response: new Response(null, { status: 409 }) }),
    100,
  )
  assert.deepEqual(
    {
      status: claimFailure.status,
      reason: claimFailure.status === "failed" && claimFailure.reason,
    },
    { status: "failed", reason: "activation_failed" },
  )

  const stripeFailure = await synchronizePreparedCheckoutSession(
    {
      runServerUpdate: async () => ({ type: "error", error: { message: "refresh failed" } }),
    },
    async () => ({ activated: true, response: new Response(null, { status: 200 }) }),
    100,
  )
  assert.deepEqual(
    {
      status: stripeFailure.status,
      reason: stripeFailure.status === "failed" && stripeFailure.reason,
    },
    { status: "failed", reason: "stripe_update_failed" },
  )

  let timedOutSignalAborted = false
  const timeout = await synchronizePreparedCheckoutSession(
    {
      runServerUpdate: async (update) => {
        await update()
        return new Promise(() => undefined)
      },
    },
    async (signal) => {
      return new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            timedOutSignalAborted = signal.aborted
            reject(new Error("aborted"))
          },
          { once: true },
        )
      })
    },
    5,
  )
  assert.deepEqual(
    { status: timeout.status, reason: timeout.status === "failed" && timeout.reason },
    { status: "failed", reason: "timeout" },
  )
  assert.equal(timedOutSignalAborted, true)
})

test("prepared checkout synchronization timeout includes time spent waiting for Stripe Checkout", () => {
  assert.equal(getPreparedCheckoutSyncRemainingMs(1_000, 1_000), 2_000)
  assert.equal(getPreparedCheckoutSyncRemainingMs(1_000, 2_500), 500)
  assert.equal(getPreparedCheckoutSyncRemainingMs(1_000, 4_000), 0)
})

test("prepared checkout keeps every payment option behind the synchronization gate", () => {
  const html = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutAttemptId="attempt-prepared"
      checkoutResult={{
        type: "success",
        checkout: {
          canConfirm: true,
          confirm: async () => ({ type: "success" }),
          getExpressCheckoutElement: () => null,
          runServerUpdate: async () => ({ type: "success" }),
          ...sessionTotal,
        },
      }}
      initialApplePayAvailability="available"
      onPreparedCheckoutActivate={async () => ({
        activated: true,
        response: new Response(null, { status: 200 }),
      })}
      onPreparedCheckoutSyncFailed={() => assert.fail("sync should not settle during SSR")}
      preparedCheckoutId="prepared-123"
      onRetry={() => {}}
      paymentElement={<div data-testid="payment-element">Card fields</div>}
      paymentElementReady
      renderExpressCheckoutElement={() => <div data-testid="express-element" />}
      secondaryPaymentMethod={<div data-testid="secondary-payment-method">PayPal</div>}
      visible
    />,
  )

  assert.match(html, /aria-label="Zahlungsoptionen werden vorbereitet"/)
  assert.match(html, /aria-hidden="true"/)
  assert.doesNotMatch(html, /data-offer-payment-step="apple_pay"/)
  assert.doesNotMatch(html, /data-testid="secondary-payment-method"/)
  assert.doesNotMatch(html, /data-testid="payment-element"/)
})

test("wallet diagnostics stay query-gated and retain only availability booleans", () => {
  assert.equal(isWalletDebugEnabled("?wallet_debug=1"), true)
  assert.equal(isWalletDebugEnabled("?lead=abc&wallet_debug=1"), true)
  assert.equal(isWalletDebugEnabled("?wallet_debug=true"), false)
  assert.equal(isWalletDebugEnabled(""), false)
  assert.equal(
    isWalletPaymentEligibilityProbeEnabled(
      "?entry=quiz_completion&wallet_debug=1&wallet_probe=payment_eligibility",
    ),
    true,
  )
  assert.equal(isWalletPaymentEligibilityProbeEnabled("?wallet_probe=payment_eligibility"), false)
  assert.equal(isWalletPaymentEligibilityProbeEnabled("?wallet_debug=1"), false)
  assert.equal(
    isWalletExpressDomProbeEnabled(
      "?entry=quiz_completion&wallet_debug=1&wallet_probe=express_dom",
    ),
    true,
  )
  assert.equal(isWalletExpressDomProbeEnabled("?wallet_probe=express_dom"), false)
  assert.equal(isWalletExpressDomProbeEnabled("?wallet_debug=1"), false)

  assert.deepEqual(
    normalizeWalletDebugMethods({
      applePay: true,
      googlePay: false,
    }),
    {
      applePay: true,
      googlePay: false,
    },
  )
  assert.deepEqual(
    normalizeWalletDebugMethods({
      applePay: { available: true, ignored: "do-not-copy" },
      link: { available: false },
      paypal: null,
    }),
    {
      applePay: true,
      link: false,
      paypal: false,
    },
  )
  assert.equal(normalizeWalletDebugMethods(undefined), null)
})

test("Payment Element availability does not hide Apple Pay before its later available event", () => {
  const applePayUnavailable = {
    paymentMethods: {
      applePay: { available: false },
    },
  }
  const applePayAvailable = {
    paymentMethods: {
      applePay: { available: true },
    },
  }

  let availability: "pending" | "available" | "unavailable" | "failed" = "pending"
  availability = reconcilePaymentElementApplePayAvailability(availability, applePayUnavailable)
  assert.equal(availability, "pending")

  availability = reconcilePaymentElementApplePayAvailability(availability, applePayAvailable)
  assert.equal(availability, "available")

  assert.equal(
    reconcilePaymentElementApplePayAvailability("available", applePayUnavailable),
    "available",
  )
  assert.equal(
    reconcilePaymentElementApplePayAvailability("unavailable", applePayAvailable),
    "unavailable",
  )
  assert.equal(
    reconcilePaymentElementApplePayAvailability("pending", { paymentMethods: undefined }),
    "pending",
  )
})

test("Apple Pay availability changes and failures remove it from the exposure gate", () => {
  assert.equal(getApplePayAvailability({ availablePaymentMethods: applePayAvailable }), "available")
  assert.equal(
    getChangedApplePayAvailability({
      paymentMethods: { applePay: { available: false } },
    }),
    "unavailable",
  )
  assert.match(
    stripeOfferElementsSource,
    /const availability = getChangedApplePayAvailability\(event\)[\s\S]*?resolveApplePayAvailability\(availability\)/,
  )
  assert.match(stripeOfferElementsSource, /closeApplePayAvailability\("failed"\)/)
  assert.match(stripeOfferElementsSource, /available=\{applePayProviderReady\}/)
  assert.match(stripeOfferElementsSource, /providerReady=\{applePayProviderReady\}/)
})

test("prewarmed offer Elements mount Express first and defer card methods until visible", () => {
  assert.match(stripeOfferElementsSource, /clientSecret\?: string \| null/)
  assert.match(
    stripeOfferElementsSource,
    /clientSecret \? Promise\.resolve\(clientSecret\) : fetchClientSecret\(\)/,
  )
  assert.match(stripeOfferElementsSource, /paymentElementEnabled = true/)
  assert.match(
    stripeOfferElementsSource,
    /showPaymentElement = paymentElementEnabled && !holdPaymentChoices/,
  )
  assert.match(
    stripeOfferElementsSource,
    /holdPaymentChoicesUntilResolved &&\s*visible === true &&\s*!applePayFailed/,
  )
  assert.match(stripeOfferElementsSource, /holdPaymentChoicesUntilResolved/)
  assert.match(
    stripeOfferElementsSource,
    /applePayLoadingDeadlineRef\.current = Date\.now\(\) \+ APPLE_PAY_CHECKOUT_LOADING_TIMEOUT_MS/,
  )
  assert.match(stripeOfferElementsSource, /Zahlungsoptionen werden vorbereitet/)
  assert.match(
    stripeOfferElementsSource,
    /invisible absolute inset-x-0 top-0 h-\[52px\] overflow-hidden/,
  )
  assert.match(stripeOfferElementsSource, /onBeforeConfirm/)
  assert.match(
    stripeOfferElementsSource,
    /await \(onBeforeConfirm\?\.\(\) \?\? Promise\.resolve\(true\)\)/,
  )
  assert.match(stripeOfferElementsSource, /onApplePayAvailabilityResolved/)
  assert.match(
    stripeOfferElementsSource,
    /showSecondaryPaymentMethod =\s*\n\s*visible === true && !holdPaymentChoices/,
  )
  assert.match(stripeOfferElementsSource, /option="apple_pay"/)
  assert.match(stripeOfferElementsSource, /providerReady=\{applePayProviderReady\}/)
  assert.match(stripeOfferElementsSource, /option="card_and_more"/)
  assert.match(stripeOfferElementsSource, /available=\{paymentElementReady\}/)
  assert.match(stripeOfferElementsSource, /providerReady=\{paymentElementReady\}/)
  assert.match(stripeOfferElementsSource, /visible=\{visible\}/)
  assert.match(stripeOfferElementsSource, /setPaymentElementReady\(true\)/)
  assert.match(stripeOfferElementsSource, /setPaymentElementReady\(false\)/)
  assert.match(
    stripeOfferElementsSource,
    /applePayFailed\s*&&\s*!holdPaymentChoices\s*&&\s*!expressDomProbeEnabled/,
  )
})

test("injected card and more test seam can model a ready provider without changing production readiness", () => {
  const readyHtml = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutAttemptId="attempt-1"
      checkoutResult={{ type: "loading" }}
      onRetry={() => {}}
      paymentElement={<div data-testid="payment-element">Card fields</div>}
      paymentElementReady
      renderExpressCheckoutElement={() => <div data-testid="express-element" />}
      visible
    />,
  )
  const hiddenHtml = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutAttemptId="attempt-1"
      checkoutResult={{ type: "loading" }}
      onRetry={() => {}}
      paymentElement={<div data-testid="payment-element">Card fields</div>}
      paymentElementReady
      renderExpressCheckoutElement={() => <div data-testid="express-element" />}
      visible={false}
    />,
  )

  assert.match(readyHtml, /data-offer-payment-option="card_and_more"/)
  assert.match(readyHtml, /data-testid="payment-element"/)
  assert.match(hiddenHtml, /data-offer-payment-option="card_and_more"/)
  assert.match(hiddenHtml, /data-testid="payment-element"/)
  assert.match(stripeOfferElementsSource, /paymentElementReady: paymentElementReadyOverride/)
  assert.match(
    stripeOfferElementsSource,
    /paymentElementReadyOverride \?\? paymentElementReadyFromProvider/,
  )
})

test("wallet-suppressed offer Elements keep the fallback checkout clear of Express lifecycle UI", () => {
  let expressRenderCount = 0
  const html = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutResult={{ type: "loading" }}
      holdPaymentChoicesUntilResolved
      initialApplePayAvailability="failed"
      onApplePayAvailabilityResolved={() => assert.fail("wallet callback must not fire")}
      onRetry={() => {}}
      paymentElement={<div data-testid="payment-element">Card fields</div>}
      renderExpressCheckoutElement={() => {
        expressRenderCount += 1
        return <div data-testid="express-element" />
      }}
      secondaryPaymentMethod={<div data-testid="secondary-payment-method">PayPal</div>}
      suppressExpressWallet
      visible
    />,
  )

  assert.equal(expressRenderCount, 0)
  assert.match(html, /data-testid="secondary-payment-method"/)
  assert.match(html, /data-testid="payment-element"/)
  assert.match(html, /data-offer-payment-step="payment_element"/)
  assert.doesNotMatch(html, /data-testid="express-element"/)
  assert.doesNotMatch(html, /data-offer-payment-element="apple_pay"/)
  assert.doesNotMatch(html, /Zahlungsoptionen werden vorbereitet/)
  assert.doesNotMatch(html, /Apple Pay wird geladen/)
  assert.doesNotMatch(html, /Apple Pay ist derzeit nicht verfügbar/)
  assert.doesNotMatch(html, /Zahlungsoptionen konnten nicht geladen werden/)

  assert.match(stripeOfferElementsSource, /if \(\s*suppressExpressWallet \|\|\s*!visible \|\|/)
  assert.match(stripeOfferElementsSource, /if \(suppressExpressWallet\) return/)
})

test("failed Apple Pay resolution releases held payment choices in rendered checkout markup", () => {
  const renderState = (initialApplePayAvailability: "pending" | "failed") =>
    renderToStaticMarkup(
      <StripeOfferElementsCheckoutContent
        checkoutResult={{ type: "loading" }}
        holdPaymentChoicesUntilResolved
        initialApplePayAvailability={initialApplePayAvailability}
        onRetry={() => {}}
        paymentElement={<div data-testid="payment-element">Card fields</div>}
        renderExpressCheckoutElement={() => <div data-testid="express-element" />}
        secondaryPaymentMethod={<div data-testid="secondary-payment-method">PayPal</div>}
        visible
      />,
    )

  const heldHtml = renderState("pending")
  assert.match(heldHtml, /aria-label="Zahlungsoptionen werden vorbereitet"/)
  assert.doesNotMatch(heldHtml, /data-testid="secondary-payment-method"/)
  assert.doesNotMatch(heldHtml, /data-testid="payment-element"/)

  const failedHtml = renderState("failed")
  assert.doesNotMatch(failedHtml, /aria-label="Zahlungsoptionen werden vorbereitet"/)
  assert.match(
    failedHtml,
    /aria-label="Zahlungsoptionen konnten nicht geladen werden\. Erneut versuchen"/,
  )
  assert.match(failedHtml, /data-testid="secondary-payment-method"/)
  assert.match(failedHtml, /data-testid="payment-element"/)
  assert.match(failedHtml, /data-offer-payment-step="payment_element"/)
})

test("a Stripe preparation error keeps the independent secondary provider visible", () => {
  const markup = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutResult={{ type: "error", error: { message: "Stripe unavailable" } }}
      onRetry={() => {}}
      secondaryPaymentMethod={<button type="button">PayPal</button>}
    />,
  )

  assert.match(markup, /Die Zahlung konnte nicht bestätigt werden/)
  assert.match(markup, />PayPal</)
  assert.match(stripeOfferElementsSource, /reportedCheckoutLoadErrorRef/)
  assert.match(
    stripeOfferElementsSource,
    /if \(reportedCheckoutLoadErrorRef\.current\) return[\s\S]*?status: "checkout_load_error"/,
  )
  assert.match(
    stripeOfferElementsSource,
    /if \(checkoutResult\.type !== "error"\) \{[\s\S]*?reportedCheckoutLoadErrorRef\.current = false/,
  )
})

test("Payment Element load errors emit one bounded card signal per checkout attempt", () => {
  const handler = stripeOfferElementsSource.slice(
    stripeOfferElementsSource.indexOf("const handlePaymentElementLoadError = useCallback"),
    stripeOfferElementsSource.indexOf(
      "const copyWalletDebugTrace",
      stripeOfferElementsSource.indexOf("const handlePaymentElementLoadError = useCallback"),
    ),
  )

  assert.match(handler, /reportedPaymentElementLoadErrorAttemptRef/)
  assert.match(handler, /signal: "customer_payment_error_observed"/)
  assert.match(handler, /stage: "stripe_embedded_checkout_load"/)
  assert.match(handler, /method: "card"/)
  assert.match(handler, /status: "payment_element_load_error"/)
  assert.doesNotMatch(handler, /capturePaymentFailure\([\s\S]*?event\.error/)
  assert.match(stripeOfferElementsSource, /onLoadError=\{handlePaymentElementLoadError\}/)
})
