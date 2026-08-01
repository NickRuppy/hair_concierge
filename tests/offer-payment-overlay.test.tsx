import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildOfferPaymentConfirmationCopy,
  getOfferPaymentOverlayDismissalOutcome,
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

test("offer payment overlay only confirms dismissal after an engaged payment attempt", () => {
  assert.equal(
    getOfferPaymentOverlayDismissalOutcome({ reason: "close", checkoutEngaged: false }),
    "abort",
  )
  assert.equal(
    getOfferPaymentOverlayDismissalOutcome({ reason: "plan_change", checkoutEngaged: false }),
    "plan_change",
  )
  assert.equal(
    getOfferPaymentOverlayDismissalOutcome({ reason: "close", checkoutEngaged: true }),
    "confirm",
  )
  assert.equal(
    getOfferPaymentOverlayDismissalOutcome({ reason: "plan_change", checkoutEngaged: true }),
    "confirm",
  )
  assert.equal(getOfferPaymentOverlayDismissalOutcome({ reason: "close" }), "confirm")
})

test("offer payment overlay exposes separate abort and plan-change callbacks", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /onConfirmedAbort: \(\) => void/)
  assert.match(source, /onConfirmedPlanChange: \(\) => void/)
  assert.match(source, /checkoutEngaged\?: boolean/)
  assert.match(source, /checkoutEngaged = true/)
  assert.match(source, /restoreFocusRef\?: React\.RefObject<HTMLElement \| null>/)
  assert.match(source, /requestDismissal\("plan_change"\)/)
  assert.match(source, /onConfirmedPlanChange\(\)/)
  assert.match(source, /onConfirmedAbort\(\)/)
  assert.match(source, /getOfferPaymentOverlayDismissalOutcome\(\{ reason, checkoutEngaged \}\)/)
})

test("offer payment overlay offers descendants only the dismissal action seam", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /export type OfferPaymentOverlayRenderActions = \{\n  requestDismissal:/)
  assert.match(
    source,
    /typeof children === "function" \? children\(\{ requestDismissal \}\) : children/,
  )
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

test("offer payment overlay pauses payment-option exposure while confirmation occludes checkout", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )
  const exposureSource = readFileSync(
    new URL("../src/components/checkout/payment-option-exposure.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /PaymentOptionExposureVisibilityGate/)
  assert.match(source, /visible=\{!confirmationOpen\}/)
  assert.match(exposureSource, /visible: visible && checkoutSurfaceVisible/)
})

test("offer payment overlay can keep prepared payment content mounted while closed", () => {
  const overlaySource = readFileSync(
    new URL("../src/components/checkout/offer-payment-overlay.tsx", import.meta.url),
    "utf8",
  )
  const bottomSheetSource = readFileSync(
    new URL("../src/components/ui/bottom-sheet.tsx", import.meta.url),
    "utf8",
  )

  assert.match(overlaySource, /keepMounted\?: boolean/)
  assert.match(overlaySource, /keepMounted=\{keepMounted\}/)
  assert.match(bottomSheetSource, /keepMounted\?: boolean/)
  assert.match(bottomSheetSource, /if \(!mounted \|\| \(!visible && !keepMounted\)\) return null/)
  assert.match(bottomSheetSource, /!visible && "pointer-events-none invisible"/)
  assert.match(bottomSheetSource, /role=\{modalActive \? "dialog" : undefined\}/)
  assert.match(bottomSheetSource, /inert=\{!modalActive\}/)
  assert.match(bottomSheetSource, /if \(!visible \|\| !rootElement\) return/)
  assert.match(bottomSheetSource, /if \(!visible && previousFocusRef\.current\)/)
  assert.match(bottomSheetSource, /data-state=\{visible && !closing \? "open" : "closed"\}/)
  assert.doesNotMatch(bottomSheetSource, /aria-hidden=\{!modalActive/)
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
