import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PaymentFeedbackCard } from "../src/components/checkout/payment-feedback-card"
import { paymentFeedback } from "../src/lib/checkout/payment-feedback"

test("card renders concise accessible payment truth and the model action labels", () => {
  const html = renderToStaticMarkup(
    <PaymentFeedbackCard
      feedback={paymentFeedback("payment_status_pending")}
      onAction={() => {}}
    />,
  )

  assert.match(html, /role="status"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /Zahlungsstatus noch offen/)
  assert.match(html, /Bitte nicht erneut zahlen/)
  assert.match(html, />Zahlungsstatus prüfen</)
  assert.match(html, /min-h-\[44px\]/)
})

test("reporting is hidden by default and only renders with an explicit callback", () => {
  const hidden = renderToStaticMarkup(
    <PaymentFeedbackCard feedback={paymentFeedback("card_declined")} onAction={() => {}} />,
  )
  const enabled = renderToStaticMarkup(
    <PaymentFeedbackCard
      feedback={paymentFeedback("card_declined")}
      onAction={() => {}}
      onReportProblem={() => {}}
    />,
  )

  assert.doesNotMatch(hidden, /Problem melden/)
  assert.match(enabled, /Problem melden/)
})

test("reporting shows honest loading, receipt, and failure states", () => {
  const feedback = paymentFeedback("card_declined")
  const loading = renderToStaticMarkup(
    <PaymentFeedbackCard
      feedback={feedback}
      onAction={() => {}}
      onReportProblem={() => {}}
      reportState={{ status: "submitting" }}
    />,
  )
  const reported = renderToStaticMarkup(
    <PaymentFeedbackCard
      feedback={feedback}
      onAction={() => {}}
      onReportProblem={() => {}}
      reportState={{ status: "reported", reportCode: "PAY-7K2M9ABC" }}
    />,
  )
  const failed = renderToStaticMarkup(
    <PaymentFeedbackCard
      feedback={feedback}
      onAction={() => {}}
      onReportProblem={() => {}}
      reportState={{ status: "failed" }}
    />,
  )

  assert.match(loading, /Wird gemeldet/)
  assert.match(reported, /Problem gemeldet/)
  assert.match(reported, /PAY-7K2M9ABC/)
  assert.match(reported, /per E-Mail/)
  assert.match(failed, /Melden gerade nicht möglich/)
  assert.match(failed, /Problem erneut melden/)
})
