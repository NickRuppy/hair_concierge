"use client"

import { AlertCircle, CheckCircle2, Clock3, Flag, LockKeyhole, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PaymentFeedback, PaymentFeedbackAction } from "@/lib/checkout/payment-feedback"
import type { PaymentSupportReportState } from "./use-payment-support-report"

export interface PaymentFeedbackCardProps {
  feedback: PaymentFeedback
  onAction: (action: PaymentFeedbackAction) => void
  /** Optional until the separately approved support lifecycle exists. */
  onReportProblem?: () => void
  reportState?: PaymentSupportReportState
}

function StatusIcon({ feedback }: Pick<PaymentFeedbackCardProps, "feedback">) {
  const className = "h-5 w-5"
  if (feedback.truth === "succeeded" || feedback.kind === "access_already_active")
    return <CheckCircle2 aria-hidden="true" className={className} />
  if (feedback.truth === "pending") return <Clock3 aria-hidden="true" className={className} />
  if (
    feedback.kind === "checkout_not_loaded" ||
    feedback.kind === "provider_temporarily_unavailable"
  )
    return <RefreshCw aria-hidden="true" className={className} />
  return <AlertCircle aria-hidden="true" className={className} />
}

export function PaymentFeedbackCard({
  feedback,
  onAction,
  onReportProblem,
  reportState = { status: "idle" },
}: PaymentFeedbackCardProps) {
  const titleId = `payment-feedback-${feedback.kind}`
  const iconTone =
    feedback.truth === "pending"
      ? "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
      : feedback.truth === "succeeded" || feedback.kind === "access_already_active"
        ? "bg-emerald-50 text-emerald-700"
        : feedback.kind === "checkout_not_loaded" ||
            feedback.kind === "provider_temporarily_unavailable"
          ? "bg-amber-50 text-amber-700"
          : "bg-rose-50 text-rose-700"

  return (
    <section
      aria-labelledby={titleId}
      aria-live="polite"
      className="rounded-2xl border border-[rgba(var(--brand-plum-rgb),0.13)] bg-white p-4 shadow-[0_16px_40px_-34px_rgba(var(--brand-plum-rgb),0.62)] sm:p-5"
      role="status"
    >
      <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 place-items-center rounded-[13px] ${iconTone}`}
        >
          <StatusIcon feedback={feedback} />
        </span>
        <div>
          <h2
            className="text-base font-bold leading-snug tracking-[-0.012em] text-[var(--brand-plum-darkest)]"
            id={titleId}
          >
            {feedback.title}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{feedback.description}</p>
        </div>
      </div>
      {feedback.safetyNote ? (
        <p className="mt-3 flex items-center gap-2 rounded-[10px] bg-[var(--brand-plum-ice)] px-3 py-2 text-xs font-bold leading-4 text-[var(--brand-plum-dark)]">
          <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {feedback.safetyNote}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          className="min-h-[44px]"
          onClick={() => onAction(feedback.primaryAction.type)}
          type="button"
        >
          {feedback.primaryAction.label}
        </Button>
        {feedback.secondaryAction ? (
          <Button
            className="min-h-[44px]"
            onClick={() => onAction(feedback.secondaryAction!.type)}
            type="button"
            variant="outline"
          >
            {feedback.secondaryAction.label}
          </Button>
        ) : null}
      </div>
      {onReportProblem ? (
        <div
          aria-live="polite"
          className="mt-3 border-t border-[rgba(var(--brand-plum-rgb),0.10)] pt-3 text-xs"
        >
          {reportState.status === "reported" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-emerald-700">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Problem gemeldet · Wir informieren dich per E-Mail.
              </span>
              <code className="rounded-md bg-emerald-50 px-2 py-1 font-bold text-[var(--brand-plum-darkest)]">
                {reportState.reportCode}
              </code>
            </div>
          ) : (
            <div className="grid justify-items-start gap-1.5">
              {reportState.status === "failed" ? (
                <span className="font-semibold text-destructive">
                  Melden gerade nicht möglich. Deine Zahlungsoptionen bleiben verfügbar.
                </span>
              ) : null}
              <button
                className="inline-flex min-h-[38px] items-center gap-2 font-bold text-[var(--brand-plum)] disabled:cursor-wait disabled:opacity-60"
                disabled={reportState.status === "submitting"}
                onClick={onReportProblem}
                type="button"
              >
                <Flag aria-hidden="true" className="h-3.5 w-3.5" />
                {reportState.status === "submitting"
                  ? "Wird gemeldet …"
                  : reportState.status === "failed"
                    ? "Problem erneut melden"
                    : "Problem melden"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
