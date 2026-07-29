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
    surcharge: zeroAmount,
    subtotal: {
      amount: "34,99 €",
      minorUnitsAmount: 3499,
    },
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
  assert.equal(stripeOfferCheckoutAppearance.variables?.buttonExpressCheckoutBorderRadius, "26px")
  assert.match(getStripeOfferElementsErrorMessage(), /Zahlung konnte nicht bestätigt werden/)
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
  assert.match(
    stripeOfferElementsSource,
    /applePayFailed && !holdPaymentChoices && !expressDomProbeEnabled/,
  )
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
