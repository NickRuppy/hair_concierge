import "server-only"
import type Stripe from "stripe"
import { TrialInvoiceBillingLinkPending, TrialInvoiceReconciliationRequired } from "./trial-invoice"

const INITIAL_BINDING_GRACE_MS = 120_000

/** Signed event hints affect reporting only. They never acknowledge or validate a payment. */
export function isInitialTrialInvoiceBindingRetry(
  event: Stripe.Event,
  error: unknown,
  nowMs: number,
): boolean {
  if (!(error instanceof TrialInvoiceBillingLinkPending)) return false
  const age = nowMs - event.created * 1000
  if (
    event.type !== "invoice.payment_succeeded" ||
    !Number.isSafeInteger(event.created) ||
    event.created <= 0 ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > INITIAL_BINDING_GRACE_MS
  )
    return false
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | { id: string } | null
  }
  if (
    !invoice ||
    typeof invoice !== "object" ||
    event.livemode !== error.livemode ||
    invoice.livemode !== error.livemode ||
    invoice.object !== "invoice" ||
    typeof invoice.id !== "string" ||
    !invoice.id ||
    invoice.status !== "paid" ||
    invoice.billing_reason !== "subscription_create" ||
    invoice.amount_due !== 0 ||
    invoice.amount_paid !== 0 ||
    invoice.amount_remaining !== 0 ||
    invoice.total !== 0 ||
    invoice.currency !== "eur" ||
    invoice.collection_method !== "charge_automatically"
  )
    return false
  const details = invoice.parent?.subscription_details
  const agreementIds = [details?.subscription, invoice.subscription]
    .filter((value) => value != null)
    .map((value) => (typeof value === "string" ? value : value?.id))
  if (!agreementIds.length || agreementIds.some((value) => value !== error.agreementId))
    return false
  const markers = [invoice.metadata, details?.metadata].filter((value) => value != null)
  return (
    markers.some(
      (metadata) =>
        metadata.trial_cohort === "trial_v1" && metadata.trial_enrollment_id === error.enrollmentId,
    ) &&
    markers.every(
      (metadata) =>
        (metadata.trial_cohort === undefined || metadata.trial_cohort === "trial_v1") &&
        (metadata.trial_enrollment_id === undefined ||
          metadata.trial_enrollment_id === error.enrollmentId) &&
        !Object.keys(metadata).some(
          (key) => key.startsWith("trial_continuation_") || key.startsWith("trial_paid_recovery_"),
        ),
    )
  )
}

/** Used only after signature verification. All handler failures still release and return 500. */
export async function respondToStripeWebhookFailure(
  event: Stripe.Event,
  error: unknown,
  deps: {
    releaseClaim: () => Promise<void>
    captureFailure: () => unknown
    now?: () => number
    warn?: typeof console.warn
    error?: typeof console.error
  },
): Promise<Response> {
  await deps.releaseClaim()
  const context = {
    eventId: event.id,
    type: event.type,
    invoiceId: event.data.object?.object === "invoice" ? event.data.object.id : undefined,
    reason:
      error instanceof TrialInvoiceBillingLinkPending
        ? error.reason
        : error instanceof TrialInvoiceReconciliationRequired
          ? "trial_reconciliation_required"
          : "handler_failure",
  }
  if (isInitialTrialInvoiceBindingRetry(event, error, (deps.now ?? Date.now)())) {
    ;(deps.warn ?? console.warn)("[stripe:webhook] retry pending", {
      ...context,
      retryClassification: "initial_trial_binding_grace",
    })
  } else {
    deps.captureFailure()
    ;(deps.error ?? console.error)(
      "[stripe] handler error:",
      { ...context, retryClassification: "alert" },
      error,
    )
  }
  const message = error instanceof Error ? error.message : "unknown"
  return new Response(`handler error: ${message}`, { status: 500 })
}
