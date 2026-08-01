import * as Sentry from "@sentry/nextjs"

import type { CheckoutInterval, CheckoutSource, CheckoutStage } from "@/lib/observability/checkout"

export type PaymentSignal =
  | "customer_payment_error_observed"
  | "provider_payment_failed"
  | "payment_webhook_processing_failed"
  | "payment_integrity_mismatch"
  | "payment_monitor_failed"

export type PaymentProvider = "stripe" | "paypal" | "unknown"
export type PaymentBoundary =
  | "configuration"
  | "provider_session"
  | "customer_authorization"
  | "provider_outcome"
  | "webhook"
  | "billing"
  | "entitlement"
  | "reconciliation"
export type PaymentErrorFamily =
  | "configuration"
  | "provider_session"
  | "not_confirmable"
  | "authentication"
  | "authorization"
  | "declined"
  | "processing"
  | "network"
  | "provider_unavailable"
  | "webhook_processing"
  | "billing_state"
  | "entitlement_state"
  | "timeout"
  | "unknown"
export type PaymentCommerceKind = "subscription" | "one_time" | "unknown"
export type PaymentOrigin = "browser" | "provider_api" | "webhook" | "reconciliation"
export type PaymentMethod = "card" | "apple_pay" | "google_pay" | "paypal" | "unknown"
export type PaymentTruth = "failed" | "succeeded" | "pending" | "unknown"
export type PaymentRetryable = "true" | "false" | "unknown"
export type PaymentFailureLevel = "warning" | "error" | "fatal"

type PaymentBoundaryDetails =
  | { stage: CheckoutStage; boundary?: never }
  | { stage?: never; boundary: PaymentBoundary }

export type PaymentFailureDetails = PaymentBoundaryDetails & {
  signal: PaymentSignal
  provider: PaymentProvider
  errorFamily: PaymentErrorFamily
  commerceKind: PaymentCommerceKind
  origin: PaymentOrigin
  method: PaymentMethod
  truth: PaymentTruth
  live: boolean
  isInternalTest: boolean
  retryable?: PaymentRetryable
  userId?: string | null
  leadId?: string | null
  source?: CheckoutSource
  interval?: CheckoutInterval
  plan?: string | null
  checkoutAttemptId?: string | null
  durationMs?: number | null
  status?: number | string | null
  providerReferencePresent?: boolean | null
  invariant?: string | null
  providerReferenceDigest?: string | null
}

export interface PaymentFailurePayload {
  fingerprint: string[]
  tags: Record<string, string>
  context: Record<string, unknown>
  user: { id: string } | null
  level: PaymentFailureLevel
  message: string
}

interface PaymentScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setFingerprint(value: string[]): void
  setLevel(level: PaymentFailureLevel): void
  setTag(key: string, value: string): void
  setUser(user: { id: string } | null): void
}

export interface PaymentSentrySink {
  captureException(error: unknown): unknown
  withScope(callback: (scope: PaymentScopeLike) => unknown): unknown
}

const PAYMENT_BOUNDARY_BY_STAGE: Record<CheckoutStage, PaymentBoundary> = {
  stripe_checkout_session_create: "configuration",
  stripe_embedded_checkout_client_secret: "provider_session",
  stripe_embedded_checkout_load: "provider_session",
  stripe_express_checkout_confirm: "customer_authorization",
  stripe_prepared_checkout_sync: "provider_session",
  stripe_webhook_activation: "webhook",
  paypal_create_subscription_intent: "provider_session",
  paypal_create_subscription: "provider_session",
  paypal_approve_subscription: "customer_authorization",
  paypal_activation_status_poll: "provider_outcome",
  paypal_webhook_ingestion: "webhook",
  checkout_return: "billing",
  checkout_password_activation: "entitlement",
  checkout_magic_link_activation: "entitlement",
}

const PAYMENT_LEVEL_BY_SIGNAL: Record<PaymentSignal, PaymentFailureLevel> = {
  customer_payment_error_observed: "warning",
  provider_payment_failed: "warning",
  payment_webhook_processing_failed: "error",
  payment_integrity_mismatch: "fatal",
  payment_monitor_failed: "error",
}

export function getPaymentBoundary(stage: CheckoutStage): PaymentBoundary {
  return PAYMENT_BOUNDARY_BY_STAGE[stage]
}

export function getPaymentFailureLevel(signal: PaymentSignal): PaymentFailureLevel {
  return PAYMENT_LEVEL_BY_SIGNAL[signal]
}

export function buildPaymentFailurePayload(details: PaymentFailureDetails): PaymentFailurePayload {
  const boundary = details.stage ? getPaymentBoundary(details.stage) : details.boundary
  const level = getPaymentFailureLevel(details.signal)
  const tags: Record<string, string> = {
    "payment.signal": details.signal,
    "payment.provider": details.provider,
    "payment.boundary": boundary,
    "payment.error_family": details.errorFamily,
    "payment.commerce_kind": details.commerceKind,
    "payment.origin": details.origin,
    "payment.method": details.method,
    "payment.truth": details.truth,
    "payment.live": String(details.live),
    "payment.is_internal_test": String(details.isInternalTest),
    "payment.retryable": details.retryable ?? "unknown",
  }
  const context: Record<string, unknown> = {
    provider: details.provider,
    boundary,
    error_family: details.errorFamily,
    provider_reference_present: Boolean(details.providerReferencePresent),
  }

  addSafeInternalId(context, "checkout_attempt_id", details.checkoutAttemptId)
  addSafeInternalId(context, "lead_id", details.leadId)
  addSafeInternalId(context, "user_id", details.userId)
  addOptional(context, "source", details.source)
  addOptional(context, "interval", details.interval)
  addSafeToken(context, "plan", details.plan)
  addOptional(context, "duration_ms", details.durationMs)
  addSafeStatus(context, details.status)
  addOptional(context, "stage", details.stage)

  if (details.source) tags["checkout.source"] = details.source

  const fingerprint = [
    `payment/${details.signal}/${details.provider}/${boundary}/${details.errorFamily}`,
  ]
  if (details.signal === "payment_integrity_mismatch") {
    const finding = safeInternalIdentifier(details.checkoutAttemptId)
      ? details.checkoutAttemptId
      : safeOpaqueDigest(details.providerReferenceDigest)
        ? details.providerReferenceDigest
        : null
    if (safeFingerprintSegment(details.invariant)) fingerprint.push(details.invariant)
    if (finding) fingerprint.push(finding)
  }

  return {
    fingerprint,
    tags,
    context,
    user: safeInternalIdentifier(details.userId)
      ? { id: details.userId }
      : safeInternalIdentifier(details.leadId)
        ? { id: details.leadId }
        : null,
    level,
    message: paymentFailureMessage(details.signal, details.errorFamily),
  }
}

/**
 * Reports an already-classified payment outcome. This deliberately accepts no provider
 * error object: callers must classify it into the closed signal and family above.
 */
export function capturePaymentFailure(
  details: PaymentFailureDetails,
  sink: PaymentSentrySink = Sentry,
): void {
  try {
    containAsyncFailure(
      sink.withScope((scope) => {
        const payload = buildPaymentFailurePayload(details)
        for (const [key, value] of Object.entries(payload.tags)) scope.setTag(key, value)
        scope.setFingerprint(payload.fingerprint)
        scope.setContext("payment", payload.context)
        scope.setLevel(payload.level)
        scope.setUser(payload.user)
        containAsyncFailure(sink.captureException(new Error(payload.message)))
      }),
    )
  } catch {
    // Observability must not alter a payment outcome.
  }
}

function paymentFailureMessage(signal: PaymentSignal, errorFamily: PaymentErrorFamily): string {
  return `Payment signal: ${signal}; error family: ${errorFamily}`
}

function containAsyncFailure(result: unknown): void {
  if (result && typeof (result as PromiseLike<unknown>).then === "function") {
    void Promise.resolve(result).catch(() => undefined)
  }
}

function addOptional(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") return
  target[key] = value
}

function addSafeToken(
  target: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
): void {
  if (!safeFingerprintSegment(value)) return
  target[key] = value
}

function addSafeInternalId(
  target: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
): void {
  if (!safeInternalIdentifier(value)) return
  target[key] = value
}

function addSafeStatus(target: Record<string, unknown>, value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target.status = value
    return
  }
  if (typeof value === "string" && safeFingerprintSegment(value)) target.status = value
}

function safeFingerprintSegment(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,80}$/.test(value)
}

function safeInternalIdentifier(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value)
}

function safeOpaqueDigest(value: string | null | undefined): value is string {
  return typeof value === "string" && /^(?:[a-f0-9]{64}|[a-zA-Z0-9_-]{43})$/.test(value)
}
