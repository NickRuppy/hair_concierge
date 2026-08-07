import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { StripeCheckoutSession } from "@stripe/stripe-js"

import {
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

test("Stripe lifecycle seams report mounted before ready and confirmation without duplicating a provider mount", () => {
  assert.match(
    stripeOfferElementsSource,
    /export type OfferCheckoutProviderLifecycleCallback = \(\s*provider: OfferPaymentOptionProvider,\s*option: OfferPaymentOption,\s*\) => void/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onClientMounted\?: OfferCheckoutProviderLifecycleCallback/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onProviderReady\?: OfferCheckoutProviderLifecycleCallback/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onConfirmStarted\?: OfferCheckoutProviderLifecycleCallback/,
  )
  assert.match(
    stripeOfferElementsSource,
    /const mountedProviderOptionsRef = useRef\(new Set<OfferPaymentOption>\(\)\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /const reportClientMounted = useCallback\(\s*\(option: OfferPaymentOption\) => \{[\s\S]*?mountedProviderOptionsRef\.current\.has\(option\)[\s\S]*?onClientMounted\?\.\("stripe", option\)/,
  )

  const expressMounted = stripeOfferElementsSource.indexOf('reportClientMounted("apple_pay")')
  const expressReady = stripeOfferElementsSource.indexOf("onReady: handleExpressCheckoutReady")
  const paymentLoaderStart = stripeOfferElementsSource.indexOf(
    "onLoaderStart={() => {\n                  if (!visibleRef.current) return",
  )
  const paymentReady = stripeOfferElementsSource.indexOf("onReady={() => {")
  const confirmStarted = stripeOfferElementsSource.indexOf(
    "reportConfirmStarted(getStripeOfferPaymentOption(paymentMethodType))",
  )
  const providerConfirm = stripeOfferElementsSource.indexOf(
    "const result = await checkout.confirm(",
  )

  assert.ok(expressMounted > -1)
  assert.ok(expressReady > expressMounted)
  assert.ok(paymentLoaderStart > -1)
  assert.ok(paymentReady > paymentLoaderStart)
  assert.ok(confirmStarted > -1)
  assert.ok(providerConfirm > confirmStarted)
  assert.match(
    stripeOfferElementsSource,
    /useEffect\(\(\) => \{\s*mountedProviderOptionsRef\.current\.clear\(\)\s*readyProviderOptionsRef\.current\.clear\(\)\s*confirmStartedProviderOptionsRef\.current\.clear\(\)\s*providerLoadStartedOptionsRef\.current\.clear\(\)\s*providerLoadTimeoutOptionsRef\.current\.clear\(\)\s*\}, \[checkoutAttemptId, checkoutKey\]\)/,
  )
})

test("Express Checkout bypasses only Payment Element readiness and traces every retained guard", () => {
  assert.match(stripeOfferElementsSource, /!expressCheckoutConfirmEvent && !checkout\.canConfirm/)
  assert.match(stripeOfferElementsSource, /"checkout_unavailable"/)
  assert.match(stripeOfferElementsSource, /"confirmation_in_flight"/)
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

test("membership Checkout Elements has no prepared-session synchronization gate", () => {
  const html = renderToStaticMarkup(
    <StripeOfferElementsCheckoutContent
      checkoutAttemptId="attempt-prepared"
      checkoutResult={{
        type: "success",
        checkout: {
          canConfirm: true,
          confirm: async () => ({ type: "success" }),
          getExpressCheckoutElement: () => null,
          ...sessionTotal,
        },
      }}
      initialApplePayAvailability="available"
      onRetry={() => {}}
      paymentElement={<div data-testid="payment-element">Card fields</div>}
      paymentElementReady
      renderExpressCheckoutElement={() => <div data-testid="express-element" />}
      secondaryPaymentMethod={<div data-testid="secondary-payment-method">PayPal</div>}
      visible
    />,
  )

  assert.match(html, /data-offer-payment-step="apple_pay"/)
  assert.match(html, /data-testid="secondary-payment-method"/)
  assert.match(html, /data-testid="payment-element"/)
  assert.doesNotMatch(stripeOfferElementsSource, /preparedCheckout/)
  assert.doesNotMatch(stripeOfferElementsSource, /synchronizePreparedCheckoutSession/)
  assert.doesNotMatch(stripeOfferElementsSource, /prepared_checkout_not_synchronized/)
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

test("cold offer Elements mount normal Express lifecycle without prewarm gates", () => {
  assert.match(stripeOfferElementsSource, /clientSecret\?: string \| null/)
  assert.match(
    stripeOfferElementsSource,
    /if \(clientSecret\) return Promise\.resolve\(clientSecret\)[\s\S]*return fetchClientSecret\?\.\(\) \?\? null/,
  )
  assert.match(
    stripeOfferElementsSource,
    /if \(!clientSecretPromise\) \{[\s\S]*role="alert"[\s\S]*Erneut versuchen/,
  )
  assert.doesNotMatch(
    stripeOfferElementsSource,
    /Stripe Checkout requires a resolved client secret/,
  )
  assert.match(stripeOfferElementsSource, /paymentElementEnabled = true/)
  assert.match(stripeOfferElementsSource, /const showPaymentElement = paymentElementEnabled/)
  assert.match(
    stripeOfferElementsSource,
    /applePayLoadingDeadlineRef\.current = Date\.now\(\) \+ APPLE_PAY_CHECKOUT_LOADING_TIMEOUT_MS/,
  )
  assert.match(stripeOfferElementsSource, /onBeforeConfirm/)
  assert.match(
    stripeOfferElementsSource,
    /await \(onBeforeConfirm\?\.\(\) \?\? Promise\.resolve\(true\)\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /const showSecondaryPaymentMethod = visible === true && Boolean\(secondaryPaymentMethod\)/,
  )
  assert.match(stripeOfferElementsSource, /option="apple_pay"/)
  assert.match(stripeOfferElementsSource, /providerReady=\{applePayProviderReady\}/)
  assert.match(stripeOfferElementsSource, /option="card_and_more"/)
  assert.match(stripeOfferElementsSource, /available=\{paymentElementReady\}/)
  assert.match(stripeOfferElementsSource, /providerReady=\{paymentElementReady\}/)
  assert.match(stripeOfferElementsSource, /visible=\{visible\}/)
  assert.match(stripeOfferElementsSource, /setPaymentElementReady\(true\)/)
  assert.match(stripeOfferElementsSource, /setPaymentElementReady\(false\)/)
  assert.match(stripeOfferElementsSource, /applePayFailed && !expressDomProbeEnabled/)
  assert.doesNotMatch(stripeOfferElementsSource, /holdPaymentChoicesUntilResolved/)
  assert.doesNotMatch(stripeOfferElementsSource, /suppressExpressWallet/)
  assert.doesNotMatch(stripeOfferElementsSource, /onApplePayAvailabilityResolved/)
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

test("cold Apple Pay lifecycle keeps independent options visible while Apple Pay resolves", () => {
  const renderState = (initialApplePayAvailability: "pending" | "failed") =>
    renderToStaticMarkup(
      <StripeOfferElementsCheckoutContent
        checkoutResult={{ type: "loading" }}
        initialApplePayAvailability={initialApplePayAvailability}
        onRetry={() => {}}
        paymentElement={<div data-testid="payment-element">Card fields</div>}
        renderExpressCheckoutElement={() => <div data-testid="express-element" />}
        secondaryPaymentMethod={<div data-testid="secondary-payment-method">PayPal</div>}
        visible
      />,
    )

  const pendingHtml = renderState("pending")
  assert.match(pendingHtml, /Apple Pay wird geladen/)
  assert.match(pendingHtml, /data-testid="secondary-payment-method"/)
  assert.match(pendingHtml, /data-testid="payment-element"/)

  const failedHtml = renderState("failed")
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
    /preparationFailureReported[\s\S]*?isHandledPreparedCheckoutControlError\(checkoutResult\.error\)[\s\S]*?isAlreadyReportedPreparedCheckoutError\(checkoutResult\.error\)[\s\S]*?reportedCheckoutLoadErrorRef\.current = false/,
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

test("Stripe readiness watchdogs are one-shot, cancel on ready or load error, and do not alter provider behavior", () => {
  assert.match(stripeOfferElementsSource, /const PAYMENT_ELEMENT_READY_TIMEOUT_MS = 10_000/)
  assert.match(stripeOfferElementsSource, /const reportProviderLoadTimeout = useCallback/)
  assert.match(stripeOfferElementsSource, /providerLoadTimeoutOptionsRef\.current\.has\(option\)/)
  assert.match(stripeOfferElementsSource, /signal: "checkout_experience_degraded"/)
  assert.match(stripeOfferElementsSource, /status: "provider_ready_timeout"/)
  assert.match(stripeOfferElementsSource, /reportProviderLoadTimeout\("apple_pay"\)/)
  assert.match(
    stripeOfferElementsSource,
    /onLoaderStart=\{\(\) => \{[\s\S]*if \(!visibleRef\.current\) return[\s\S]*reportProviderLoadStarted\("card_and_more"\)[\s\S]*window\.setTimeout\([\s\S]*reportProviderLoadTimeout\("card_and_more"\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /onReady=\{\(\) => \{\s*clearPaymentElementReadyTimer\(\)/,
  )
  assert.match(
    stripeOfferElementsSource,
    /const handlePaymentElementLoadError = useCallback\([\s\S]*if \(!visibleRef\.current\) return[\s\S]*clearPaymentElementReadyTimer\(\)/,
  )
  assert.doesNotMatch(stripeOfferElementsSource, /AbortController/)
})
