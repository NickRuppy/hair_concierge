import { after, NextResponse } from "next/server"
import { cookies } from "next/headers"

import {
  createPaymentSupportCase,
  getPaymentSupportReportedFacts,
  parsePaymentSupportRequest,
  PaymentSupportPersistenceError,
  type PaymentSupportCaseResult,
  type PaymentSupportIdentity,
  type PaymentSupportRequest,
} from "@/lib/billing/payment-support"
import { deliverPaymentSupportReceipt } from "@/lib/billing/payment-support-delivery"
import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { isPaymentSupportEnabled } from "@/lib/funnel/flags"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { capturePaymentFailure } from "@/lib/observability/payment-client"
import type { PaymentErrorFamily } from "@/lib/observability/payment-client"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  PAYMENT_SUPPORT_IP_RATE_LIMIT,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const OBSERVABILITY_FAMILY_BY_REPORTED_FAMILY: Record<string, PaymentErrorFamily> = {
  access: "control_outcome",
  checkout_load: "provider_session",
  details: "authorization",
  decline: "declined",
  provider: "provider_unavailable",
  payment: "processing",
  pending: "processing",
  activation: "entitlement_state",
}

type PaymentSupportPostDependencies = {
  enabled: () => boolean
  checkRateLimit: typeof checkRateLimit
  retryAfterSeconds: () => number
  resolveIdentity: (request: PaymentSupportRequest) => Promise<PaymentSupportIdentity | null>
  createCase: (
    identity: PaymentSupportIdentity,
    request: PaymentSupportRequest,
  ) => Promise<PaymentSupportCaseResult>
  deliverReceipt: (caseId: string) => Promise<void>
  recordSentryDelivery: (caseId: string, eventId: string | undefined) => Promise<void>
  schedule: (task: () => Promise<void>) => void
  captureReport: (input: {
    identity: PaymentSupportIdentity
    request: PaymentSupportRequest
    result: PaymentSupportCaseResult
  }) => string | undefined
}

type PaymentSupportIdentityDependencies = {
  getAuthenticatedUserId: () => Promise<string | null>
  getFunnelCookieValue: () => Promise<string | undefined>
  resolveFunnelContext: typeof resolveFunnelCookieContext
  lookupLeadId: (context: {
    sessionId: string
    visitorId: string
    packageKey: string
  }) => Promise<string | null>
}

const defaultIdentityDependencies: PaymentSupportIdentityDependencies = {
  getAuthenticatedUserId: async () => {
    const auth = await createClient()
    const { data, error } = await auth.auth.getUser()
    return error ? null : (data.user?.id ?? null)
  },
  getFunnelCookieValue: async () => (await cookies()).get(FUNNEL_SESSION_COOKIE)?.value,
  resolveFunnelContext: resolveFunnelCookieContext,
  lookupLeadId: async (context) => {
    const { data, error } = await createAdminClient()
      .from("funnel_sessions")
      .select("lead_id")
      .eq("id", context.sessionId)
      .eq("visitor_id", context.visitorId)
      .eq("package_key", context.packageKey)
      .maybeSingle()
    return error || typeof data?.lead_id !== "string" ? null : data.lead_id
  },
}

export async function resolvePaymentSupportIdentity(
  request: PaymentSupportRequest,
  overrides: Partial<PaymentSupportIdentityDependencies> = {},
): Promise<PaymentSupportIdentity | null> {
  const dependencies = { ...defaultIdentityDependencies, ...overrides }
  if (request.checkoutContext === "reactivation") {
    const userId = await dependencies.getAuthenticatedUserId()
    return userId ? { kind: "user", id: userId } : null
  }

  const context = await dependencies.resolveFunnelContext(await dependencies.getFunnelCookieValue())
  if (!context) return null
  const leadId = await dependencies.lookupLeadId(context)
  return leadId ? { kind: "lead", id: leadId } : null
}

async function persistPaymentSupportCase(
  identity: PaymentSupportIdentity,
  request: PaymentSupportRequest,
) {
  return createPaymentSupportCase(createAdminClient(), {
    identity,
    request,
    ...getPaymentSupportReportedFacts(request.feedbackKind),
  })
}

function capturePaymentSupportReport(input: {
  identity: PaymentSupportIdentity
  request: PaymentSupportRequest
  result: PaymentSupportCaseResult
}) {
  const facts = getPaymentSupportReportedFacts(input.request.feedbackKind)
  const family = OBSERVABILITY_FAMILY_BY_REPORTED_FAMILY[facts.reportedPaymentFamily]
  return capturePaymentFailure({
    signal: "customer_payment_issue_reported",
    provider: input.request.provider,
    boundary:
      facts.reportedPaymentFamily === "activation" || facts.reportedPaymentFamily === "access"
        ? "entitlement"
        : "customer_authorization",
    errorFamily: family,
    commerceKind: input.request.checkoutContext === "result_one_time" ? "one_time" : "subscription",
    origin: "browser",
    method: input.request.method,
    truth: facts.reportedPaymentTruth === "not_started" ? "unknown" : facts.reportedPaymentTruth,
    live: process.env.NODE_ENV === "production",
    isInternalTest: false,
    retryable: String(facts.reportedRetryable) as "true" | "false",
    checkoutAttemptId: input.request.checkoutAttemptId,
    leadId: input.identity.kind === "lead" ? input.identity.id : null,
    userId: input.identity.kind === "user" ? input.identity.id : null,
    feedbackKind: input.request.feedbackKind,
    reportCode: input.result.reportCode,
    deliveryState: input.result.receiptDeliveryStatus,
    source: input.request.checkoutContext === "reactivation" ? "reactivation" : "quiz_result_offer",
  })
}

async function recordPaymentSupportSentryDelivery(caseId: string, eventId: string | undefined) {
  const { error } = await createAdminClient()
    .from("payment_support_cases")
    .update({
      sentry_delivery_status: eventId ? "delivered" : "failed",
      sentry_event_id: eventId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
  if (error) throw error
}

const defaultDependencies: PaymentSupportPostDependencies = {
  enabled: isPaymentSupportEnabled,
  checkRateLimit,
  retryAfterSeconds: () => fixedWindowRetryAfterSeconds(PAYMENT_SUPPORT_IP_RATE_LIMIT),
  resolveIdentity: resolvePaymentSupportIdentity,
  createCase: persistPaymentSupportCase,
  deliverReceipt: deliverPaymentSupportReceipt,
  recordSentryDelivery: recordPaymentSupportSentryDelivery,
  schedule: (task) => after(task),
  captureReport: capturePaymentSupportReport,
}

export function createPaymentSupportPostHandler(
  overrides: Partial<PaymentSupportPostDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }
  return async function POST(request: Request) {
    if (!dependencies.enabled()) return NextResponse.json({ error: "not_found" }, { status: 404 })

    let parsed: PaymentSupportRequest
    try {
      parsed = parsePaymentSupportRequest(await request.json())
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    }

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    const rate = await dependencies.checkRateLimit(
      forwarded || "unknown",
      PAYMENT_SUPPORT_IP_RATE_LIMIT,
    )
    if (!rate.allowed) {
      const status = rate.error === "service_unavailable" ? 503 : 429
      return NextResponse.json(
        { error: status === 429 ? "rate_limited" : "service_unavailable" },
        {
          status,
          headers:
            status === 429
              ? { "Retry-After": String(dependencies.retryAfterSeconds()) }
              : undefined,
        },
      )
    }

    const identity = await dependencies.resolveIdentity(parsed)
    if (!identity) return NextResponse.json({ error: "identity_required" }, { status: 401 })

    try {
      const result = await dependencies.createCase(identity, parsed)
      const eventId = result.created
        ? dependencies.captureReport({ identity, request: parsed, result })
        : undefined
      if (result.created || result.receiptDeliveryStatus === "pending") {
        dependencies.schedule(async () => {
          if (result.created) {
            await dependencies.recordSentryDelivery(result.caseId, eventId).catch(() => undefined)
          }
          if (result.receiptDeliveryStatus === "pending") {
            await dependencies.deliverReceipt(result.caseId).catch(() => undefined)
          }
        })
      }
      return NextResponse.json({ reportCode: result.reportCode })
    } catch (error) {
      if (error instanceof PaymentSupportPersistenceError) {
        if (error.code === "case_limit_reached") {
          return NextResponse.json({ error: "case_limit_reached" }, { status: 429 })
        }
        if (error.code === "invalid_request") {
          return NextResponse.json({ error: "invalid_request" }, { status: 400 })
        }
      }
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 })
    }
  }
}

export const POST = createPaymentSupportPostHandler()
