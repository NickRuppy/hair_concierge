import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyPayPalPaymentFeedback,
  classifyStripePaymentFeedback,
  paymentFeedback,
  type PaymentFeedbackKind,
} from "../src/lib/checkout/payment-feedback"
import {
  isPaymentFeedbackV2Enabled,
  isPaymentSupportEnabled,
  isPaymentSupportUiEnabled,
} from "../src/lib/funnel/flags"

test("payment feedback and support flags are exact-true and default off", () => {
  const keys = [
    "NEXT_PUBLIC_PAYMENT_FEEDBACK_V2_ENABLED",
    "PAYMENT_SUPPORT_ENABLED",
    "NEXT_PUBLIC_PAYMENT_SUPPORT_ENABLED",
  ] as const
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    assert.equal(isPaymentFeedbackV2Enabled(), false)
    assert.equal(isPaymentSupportEnabled(), false)
    assert.equal(isPaymentSupportUiEnabled(), false)
    for (const key of keys) process.env[key] = "TRUE"
    assert.equal(isPaymentFeedbackV2Enabled(), false)
    assert.equal(isPaymentSupportEnabled(), false)
    assert.equal(isPaymentSupportUiEnabled(), false)
    for (const key of keys) process.env[key] = "true"
    assert.equal(isPaymentFeedbackV2Enabled(), true)
    assert.equal(isPaymentSupportEnabled(), true)
    assert.equal(isPaymentSupportUiEnabled(), true)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test("the closed feedback factory covers every customer-visible state", () => {
  const expected: Array<[PaymentFeedbackKind, string]> = [
    ["access_already_active", "not_started"],
    ["checkout_not_loaded", "not_started"],
    ["details_invalid", "failed"],
    ["card_declined", "failed"],
    ["provider_temporarily_unavailable", "failed"],
    ["payment_not_completed", "failed"],
    ["payment_status_pending", "pending"],
    ["access_activation_delayed", "succeeded"],
  ]

  assert.equal(expected.length, 8)
  for (const [kind, truth] of expected) {
    const feedback = paymentFeedback(kind)
    assert.equal(feedback.kind, kind)
    assert.equal(feedback.truth, truth)
    assert.ok(feedback.primaryAction.label.length > 0)
  }
})

test("feedback copy names the safe next step without leaving field errors ambiguous", () => {
  const active = paymentFeedback("access_already_active")
  assert.match(active.description, /Für deine E-Mail/)
  assert.match(active.description, /Melde dich jetzt ein/)

  const expiry = paymentFeedback("details_invalid", { detailsField: "Ablaufdatum" })
  assert.match(expiry.description, /dein Ablaufdatum/)
  assert.doesNotMatch(expiry.description, /deinen Ablaufdatum/)
})

test("Stripe maps only safe structured decline codes and never provider messages", () => {
  const invalid = classifyStripePaymentFeedback({
    confirmationPhase: "after_confirm",
    error: {
      code: "paymentFailed",
      message: "this must never determine customer copy",
      paymentFailed: { declineCode: "invalid_cvc" },
    },
  })
  assert.equal(invalid.kind, "details_invalid")
  assert.match(invalid.description, /Sicherheitscode/i)

  const sensitive = classifyStripePaymentFeedback({
    confirmationPhase: "after_confirm",
    error: {
      code: "paymentFailed",
      message: "stolen card: do not show this",
      paymentFailed: { declineCode: "stolen_card" },
    },
  })
  assert.equal(sensitive.kind, "payment_not_completed")
  assert.doesNotMatch(sensitive.description, /stolen|gestohlen/i)

  const unknownA = classifyStripePaymentFeedback({
    confirmationPhase: "after_confirm",
    error: {
      code: "paymentFailed",
      message: "first private message",
      paymentFailed: { declineCode: "new_code" },
    },
  })
  const unknownB = classifyStripePaymentFeedback({
    confirmationPhase: "after_confirm",
    error: {
      code: "paymentFailed",
      message: "second private message",
      paymentFailed: { declineCode: "new_code" },
    },
  })
  assert.deepEqual(unknownA, unknownB)
})

test("Stripe confirmation phase keeps temporary provider failures truthful", () => {
  assert.equal(
    classifyStripePaymentFeedback({
      confirmationPhase: "before_confirm",
      error: { code: "network_error" },
    }).truth,
    "not_started",
  )
  assert.equal(
    classifyStripePaymentFeedback({
      confirmationPhase: "after_confirm",
      error: { code: "network_error" },
    }).truth,
    "failed",
  )
})

test("PayPal statuses retain duplicate-payment protection and cancellation is neutral", () => {
  const activeAccess = classifyPayPalPaymentFeedback({ status: "checkout_access_already_exists" })
  assert.ok(activeAccess)
  assert.equal(activeAccess.kind, "access_already_active")
  const pending = classifyPayPalPaymentFeedback({ status: "pending" })
  assert.ok(pending)
  assert.equal(pending.kind, "payment_status_pending")
  assert.equal(pending.retryable, false)
  assert.equal(classifyPayPalPaymentFeedback({ status: "cancelled" }), null)
})
