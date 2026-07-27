import assert from "node:assert/strict"
import test from "node:test"
import type { StripeCheckoutSession } from "@stripe/stripe-js"

import {
  createStripeOfferElementsState,
  formatCheckoutTotal,
  getChangedApplePayAvailability,
  getApplePayAvailability,
  getStripeOfferElementsErrorMessage,
  hasApplePayMethod,
  isWalletDebugEnabled,
  normalizeWalletDebugMethods,
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
    overflow: "never",
  })
  assert.equal(stripeOfferExpressCheckoutOptions.buttonType?.applePay, "subscribe")
  assert.match(getStripeOfferElementsErrorMessage(), /Zahlung konnte nicht bestätigt werden/)
})

test("wallet diagnostics stay query-gated and retain only availability booleans", () => {
  assert.equal(isWalletDebugEnabled("?wallet_debug=1"), true)
  assert.equal(isWalletDebugEnabled("?lead=abc&wallet_debug=1"), true)
  assert.equal(isWalletDebugEnabled("?wallet_debug=true"), false)
  assert.equal(isWalletDebugEnabled(""), false)

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
