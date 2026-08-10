"use client"

import { useCallback, useState } from "react"

import type { PaymentFeedback } from "@/lib/checkout/payment-feedback"

export type PaymentSupportCheckoutContext = "result_membership" | "result_one_time" | "reactivation"

export type PaymentSupportReportState =
  | { status: "idle" | "submitting" | "failed" }
  | { status: "reported"; reportCode: string }

const IDLE_REPORT_STATE: PaymentSupportReportState = { status: "idle" }

export function paymentSupportReportKey(input: {
  checkoutAttemptId: string | null | undefined
  checkoutContext: PaymentSupportCheckoutContext
  feedback: PaymentFeedback | null
}) {
  return `${input.checkoutAttemptId ?? ""}\u0000${input.checkoutContext}\u0000${input.feedback?.kind ?? ""}`
}

export function buildPaymentSupportRequest(input: {
  checkoutAttemptId: string
  checkoutContext: PaymentSupportCheckoutContext
  feedback: PaymentFeedback
}) {
  return {
    checkoutAttemptId: input.checkoutAttemptId,
    checkoutContext: input.checkoutContext,
    feedbackKind: input.feedback.kind,
    provider:
      input.feedback.provider === "stripe" || input.feedback.provider === "paypal"
        ? input.feedback.provider
        : ("unknown" as const),
    method: input.feedback.method,
  }
}

export function parsePaymentSupportResponse(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid payment support response")
  }
  const record = input as Record<string, unknown>
  if (
    Object.keys(record).length !== 1 ||
    typeof record.reportCode !== "string" ||
    !/^PAY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ_]{8}$/.test(record.reportCode)
  ) {
    throw new Error("invalid payment support response")
  }
  return record.reportCode
}

export function usePaymentSupportReport(input: {
  checkoutAttemptId: string | null | undefined
  checkoutContext: PaymentSupportCheckoutContext
  feedback: PaymentFeedback | null
}) {
  const activeKey = paymentSupportReportKey(input)
  const [stored, setStored] = useState<{
    key: string
    state: PaymentSupportReportState
  }>({ key: activeKey, state: IDLE_REPORT_STATE })
  const state = stored.key === activeKey ? stored.state : IDLE_REPORT_STATE

  const report = useCallback(async () => {
    if (!input.checkoutAttemptId || !input.feedback) return
    if (state.status === "submitting" || state.status === "reported") return
    setStored({ key: activeKey, state: { status: "submitting" } })
    try {
      const response = await fetch("/api/billing/payment-support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildPaymentSupportRequest({
            checkoutAttemptId: input.checkoutAttemptId,
            checkoutContext: input.checkoutContext,
            feedback: input.feedback,
          }),
        ),
      })
      if (!response.ok) throw new Error("payment support request failed")
      const reportCode = parsePaymentSupportResponse(await response.json())
      setStored({ key: activeKey, state: { status: "reported", reportCode } })
    } catch {
      setStored({ key: activeKey, state: { status: "failed" } })
    }
  }, [activeKey, input.checkoutAttemptId, input.checkoutContext, input.feedback, state.status])

  return { report, state }
}
