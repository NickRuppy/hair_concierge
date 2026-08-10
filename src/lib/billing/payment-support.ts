import { PAYMENT_FEEDBACK_KINDS, type PaymentFeedbackKind } from "@/lib/checkout/payment-feedback"

export const REPORTABLE_PAYMENT_FEEDBACK_KINDS = PAYMENT_FEEDBACK_KINDS
export type PaymentSupportRequest = {
  checkoutAttemptId: string
  checkoutContext: "result_membership" | "result_one_time" | "reactivation"
  feedbackKind: PaymentFeedbackKind
  provider: "stripe" | "paypal" | "unknown"
  method: "card" | "apple_pay" | "paypal" | "unknown"
}

export type PaymentSupportIdentity = { kind: "lead" | "user"; id: string }
export type PaymentSupportPersistenceInput = {
  identity: PaymentSupportIdentity
  request: PaymentSupportRequest
  reportedPaymentFamily:
    | "access"
    | "checkout_load"
    | "details"
    | "decline"
    | "provider"
    | "payment"
    | "pending"
    | "activation"
  reportedPaymentTruth: "not_started" | "failed" | "pending" | "succeeded" | "unknown"
  reportedRetryable: boolean
}
export type PaymentSupportCaseResult = {
  caseId: string
  reportCode: string
  created: boolean
  receiptDeliveryStatus: "pending" | "sending" | "sent" | "failed" | "delivery_uncertain"
}
export type PaymentSupportPersistenceClient = {
  rpc: (
    name: "create_payment_support_case",
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

const REPORTED_FACTS_BY_FEEDBACK_KIND: Record<
  PaymentFeedbackKind,
  Pick<
    PaymentSupportPersistenceInput,
    "reportedPaymentFamily" | "reportedPaymentTruth" | "reportedRetryable"
  >
> = {
  access_already_active: {
    reportedPaymentFamily: "access",
    reportedPaymentTruth: "not_started",
    reportedRetryable: false,
  },
  checkout_not_loaded: {
    reportedPaymentFamily: "checkout_load",
    reportedPaymentTruth: "not_started",
    reportedRetryable: true,
  },
  details_invalid: {
    reportedPaymentFamily: "details",
    reportedPaymentTruth: "failed",
    reportedRetryable: true,
  },
  card_declined: {
    reportedPaymentFamily: "decline",
    reportedPaymentTruth: "failed",
    reportedRetryable: true,
  },
  provider_temporarily_unavailable: {
    reportedPaymentFamily: "provider",
    reportedPaymentTruth: "failed",
    reportedRetryable: true,
  },
  payment_not_completed: {
    reportedPaymentFamily: "payment",
    reportedPaymentTruth: "failed",
    reportedRetryable: true,
  },
  payment_status_pending: {
    reportedPaymentFamily: "pending",
    reportedPaymentTruth: "pending",
    reportedRetryable: false,
  },
  access_activation_delayed: {
    reportedPaymentFamily: "activation",
    reportedPaymentTruth: "succeeded",
    reportedRetryable: false,
  },
}

export function getPaymentSupportReportedFacts(kind: PaymentFeedbackKind) {
  return REPORTED_FACTS_BY_FEEDBACK_KIND[kind]
}

export class PaymentSupportPersistenceError extends Error {
  constructor(
    public readonly code:
      | "invalid_request"
      | "case_limit_reached"
      | "integrity_error"
      | "persistence_error",
    message: string,
  ) {
    super(message)
    this.name = "PaymentSupportPersistenceError"
  }
}

export function parsePaymentSupportRequest(input: unknown): PaymentSupportRequest {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, [
      "checkoutAttemptId",
      "checkoutContext",
      "feedbackKind",
      "provider",
      "method",
    ])
  ) {
    throw invalidRequest("payment support request contains unsupported fields")
  }
  const { checkoutAttemptId, checkoutContext, feedbackKind, provider, method } = input
  if (!isBoundedString(checkoutAttemptId, 8, 128) || !/^[A-Za-z0-9_-]+$/.test(checkoutAttemptId))
    throw invalidRequest("checkout attempt is invalid")
  if (!isOneOf(checkoutContext, ["result_membership", "result_one_time", "reactivation"] as const))
    throw invalidRequest("checkout context is invalid")
  if (!isOneOf(feedbackKind, REPORTABLE_PAYMENT_FEEDBACK_KINDS))
    throw invalidRequest("feedback kind is invalid")
  if (!isOneOf(provider, ["stripe", "paypal", "unknown"] as const))
    throw invalidRequest("provider is invalid")
  if (!isOneOf(method, ["card", "apple_pay", "paypal", "unknown"] as const))
    throw invalidRequest("payment method is invalid")
  return { checkoutAttemptId, checkoutContext, feedbackKind, provider, method }
}

export async function createPaymentSupportCase(
  client: PaymentSupportPersistenceClient,
  input: PaymentSupportPersistenceInput,
): Promise<PaymentSupportCaseResult> {
  const { data, error } = await client.rpc("create_payment_support_case", {
    p_lead_id: input.identity.kind === "lead" ? input.identity.id : null,
    p_user_id: input.identity.kind === "user" ? input.identity.id : null,
    p_checkout_attempt_id: input.request.checkoutAttemptId,
    p_checkout_context: input.request.checkoutContext,
    p_feedback_kind: input.request.feedbackKind,
    p_provider: input.request.provider,
    p_method: input.request.method,
    p_reported_payment_family: input.reportedPaymentFamily,
    p_reported_payment_truth: input.reportedPaymentTruth,
    p_reported_retryable: input.reportedRetryable,
  })
  if (error) throw mapPersistenceError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (
    !isRecord(row) ||
    !isReportCode(row.report_code) ||
    !isBoundedString(row.case_id, 1, 128) ||
    typeof row.created !== "boolean" ||
    !isOneOf(row.receipt_delivery_status, [
      "pending",
      "sending",
      "sent",
      "failed",
      "delivery_uncertain",
    ] as const)
  ) {
    throw new PaymentSupportPersistenceError(
      "persistence_error",
      "payment support case response is invalid",
    )
  }
  return {
    caseId: row.case_id,
    reportCode: row.report_code,
    created: row.created,
    receiptDeliveryStatus: row.receipt_delivery_status,
  }
}

function mapPersistenceError(error: unknown): PaymentSupportPersistenceError {
  const message =
    isRecord(error) && typeof error.message === "string"
      ? error.message
      : "payment support persistence failed"
  if (message.includes("case limit reached"))
    return new PaymentSupportPersistenceError("case_limit_reached", message)
  if (message.includes("identity integrity") || message.includes("collision limit"))
    return new PaymentSupportPersistenceError("integrity_error", message)
  return new PaymentSupportPersistenceError("persistence_error", message)
}

function invalidRequest(message: string): PaymentSupportPersistenceError {
  return new PaymentSupportPersistenceError("invalid_request", message)
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  )
}
function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max
}
function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
}
function isReportCode(value: unknown): value is string {
  return typeof value === "string" && /^PAY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ_]{8}$/.test(value)
}
