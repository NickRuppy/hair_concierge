import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPaymentSupportRequest,
  paymentSupportReportKey,
  parsePaymentSupportResponse,
} from "../src/components/checkout/use-payment-support-report"
import { paymentFeedback } from "../src/lib/checkout/payment-feedback"

test("builds the minimal support request without identity or provider prose", () => {
  const request = buildPaymentSupportRequest({
    checkoutAttemptId: "attempt-123",
    checkoutContext: "result_one_time",
    feedback: paymentFeedback("card_declined", { provider: "stripe", method: "card" }),
  })
  assert.deepEqual(request, {
    checkoutAttemptId: "attempt-123",
    checkoutContext: "result_one_time",
    feedbackKind: "card_declined",
    provider: "stripe",
    method: "card",
  })
  assert.doesNotMatch(JSON.stringify(request), /email|leadId|userId|message|reference|note/)
})

test("accepts only a stable report code response", () => {
  assert.equal(parsePaymentSupportResponse({ reportCode: "PAY-7K2M9ABC" }), "PAY-7K2M9ABC")
  assert.throws(() => parsePaymentSupportResponse({ reportCode: "ticket-1" }))
  assert.throws(() => parsePaymentSupportResponse({ reportCode: "PAY-7K2M9ABC", email: "x@y.de" }))
})

test("a new feedback kind gets a distinct report-state identity", () => {
  const base = {
    checkoutAttemptId: "checkout-attempt-123",
    checkoutContext: "result_one_time" as const,
  }
  assert.notEqual(
    paymentSupportReportKey({
      ...base,
      feedback: paymentFeedback("payment_not_completed", {
        provider: "stripe",
        method: "card",
      }),
    }),
    paymentSupportReportKey({
      ...base,
      feedback: paymentFeedback("payment_status_pending", {
        provider: "stripe",
        method: "card",
      }),
    }),
  )
})
