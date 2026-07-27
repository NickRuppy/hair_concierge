import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildOfferPaymentConfirmationCopy,
  offerPaymentOverlayReducer,
  type OfferPaymentOverlayState,
} from "../src/components/checkout/offer-payment-overlay"
import { isOfferPaymentOverlayEnabled } from "../src/lib/funnel/flags"

test("offer payment overlay dismissal reducer keeps checkout alive until confirmation", () => {
  const initial: OfferPaymentOverlayState = { pendingDismissal: null }
  const closeRequested = offerPaymentOverlayReducer(initial, {
    type: "request_dismissal",
    reason: "close",
  })
  assert.deepEqual(closeRequested, { pendingDismissal: "close" })

  const continued = offerPaymentOverlayReducer(closeRequested, { type: "continue_payment" })
  assert.deepEqual(continued, { pendingDismissal: null })

  const planChangeRequested = offerPaymentOverlayReducer(continued, {
    type: "request_dismissal",
    reason: "plan_change",
  })
  assert.deepEqual(planChangeRequested, { pendingDismissal: "plan_change" })

  const repeatedCloseRequest = offerPaymentOverlayReducer(planChangeRequested, {
    type: "request_dismissal",
    reason: "close",
  })
  assert.strictEqual(repeatedCloseRequest, planChangeRequested)

  const reset = offerPaymentOverlayReducer(planChangeRequested, { type: "reset" })
  assert.deepEqual(reset, { pendingDismissal: null })
})

test("offer payment overlay uses the approved German confirmation copy", () => {
  assert.equal(
    buildOfferPaymentConfirmationCopy("Quartal"),
    "Deine Eingaben werden verworfen. Dein ausgewählter Plan „Quartal“ bleibt erhalten.",
  )
})

test("offer payment overlay exposes separate abort and plan-change callbacks", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /onConfirmedAbort: \(\) => void/)
  assert.match(source, /onConfirmedPlanChange: \(\) => void/)
  assert.match(source, /restoreFocusRef\?: React\.RefObject<HTMLElement \| null>/)
  assert.match(source, /requestDismissal\("plan_change"\)/)
  assert.match(source, /onConfirmedPlanChange\(\)/)
  assert.match(source, /onConfirmedAbort\(\)/)
})

test("offer payment overlay keeps payment children mounted and inert under confirmation", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /inert=\{confirmationOpen\}/)
  assert.match(source, /aria-hidden=\{confirmationOpen \? "true" : undefined\}/)
  assert.match(source, /role="alertdialog"/)
  assert.match(source, /Weiter bezahlen/)
  assert.match(source, /Zahlung abbrechen/)
})

test("offer payment overlay requests z-110 sheet layering through the current BottomSheet seam", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /rootClassName="[^"]*z-\[110\]/)
  assert.match(source, /modalPriority=\{MODAL_LAYER_PRIORITIES\.checkoutOverlay\}/)
  assert.match(source, /restoreFocusRef=\{restoreFocusRef\}/)
  assert.match(source, /"z-\[110\] h-\[calc\(100dvh-48px\)\]/)
  assert.match(source, /h-\[calc\(100dvh-48px\)\]/)
  assert.match(source, /sm:w-\[min\(620px,calc\(100vw-32px\)\)\]/)
  assert.match(source, /sm:-translate-x-1\/2/)
})

test("offer payment overlay feature flag is strict default off", () => {
  const previous = process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED

  try {
    delete process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED
    assert.equal(isOfferPaymentOverlayEnabled(), false)

    process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED = "false"
    assert.equal(isOfferPaymentOverlayEnabled(), false)

    process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED = "true"
    assert.equal(isOfferPaymentOverlayEnabled(), true)
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED
    } else {
      process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED = previous
    }
  }
})
