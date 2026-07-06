import { createHash } from "node:crypto"

import * as Sentry from "@sentry/nextjs"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/checkout"

type ProductIntakeStage =
  | "approve_reviewed_product"
  | "link_existing_product"
  | "request_more_info"
  | "reject_submission"
  | "append_addition_record"
  | "send_review_notification"
  | "promote_product"

type BreadcrumbLevel = "debug" | "info" | "warning" | "error"

export interface ProductIntakeSentryDetails {
  stage: ProductIntakeStage
  submissionId?: string | null
  approvedProductId?: string | null
  productId?: string | null
  userId?: string | null
  source?: string | null
  sourceConversationId?: string | null
  category?: string | null
  intakeMethod?: string | null
  status?: string | null
  reason?: string | null
  notificationResult?: "sent" | "already_sent" | "no_message_needed" | "failed" | null
  committed?: boolean | null
}

export interface ProductIntakeSentryPayload {
  tags: Record<string, string>
  context: Record<string, unknown>
}

interface ProductIntakeScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setLevel?(level: BreadcrumbLevel): void
  setTag(key: string, value: string): void
}

interface ProductIntakeSentrySink {
  captureException(error: unknown): void
  flush?(timeout?: number): Promise<boolean>
  init?(options: Record<string, unknown>): void
  withScope(callback: (scope: ProductIntakeScopeLike) => void): void
}

let scriptSentryInitialized = false

export function initProductIntakeScriptSentry(sink: ProductIntakeSentrySink = Sentry) {
  if (scriptSentryInitialized || !process.env.NEXT_PUBLIC_SENTRY_DSN || !sink.init) {
    return
  }

  sink.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  })
  scriptSentryInitialized = true
}

export function buildProductIntakeSentryPayload(
  details: ProductIntakeSentryDetails,
): ProductIntakeSentryPayload {
  const context: Record<string, unknown> = {
    stage: details.stage,
  }
  const tags: Record<string, string> = {
    "product_intake.stage": details.stage,
  }

  addOptional(context, "submission_id", details.submissionId)
  addOptional(context, "approved_product_id", details.approvedProductId)
  addOptional(context, "product_id", details.productId)
  addOptional(context, "user_hash", details.userId ? hashProductIntakeUserId(details.userId) : null)
  addOptional(context, "source", details.source)
  addOptional(
    context,
    "source_conversation_hash",
    details.sourceConversationId ? hashProductIntakeIdentifier(details.sourceConversationId) : null,
  )
  addOptional(context, "source_conversation_present", Boolean(details.sourceConversationId) || null)
  addOptional(context, "category", details.category)
  addOptional(context, "intake_method", details.intakeMethod)
  addOptional(context, "status", details.status)
  addOptional(context, "reason", details.reason)
  addOptional(context, "notification_result", details.notificationResult)
  addOptional(context, "committed", details.committed)

  addTag(tags, "product_intake.source", details.source)
  addTag(tags, "product_intake.category", details.category)
  addTag(tags, "product_intake.intake_method", details.intakeMethod)
  addTag(tags, "product_intake.status", details.status)
  addTag(tags, "product_intake.reason", details.reason)
  addTag(tags, "product_intake.notification_result", details.notificationResult)

  return { tags, context }
}

export function hashProductIntakeUserId(userId: string): string {
  return hashProductIntakeIdentifier(userId)
}

function hashProductIntakeIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10)
}

export function captureProductIntakeException(
  error: unknown,
  details: ProductIntakeSentryDetails,
  sink: ProductIntakeSentrySink = Sentry,
) {
  const payload = buildProductIntakeSentryPayload(details)
  sink.withScope((scope) => {
    for (const [key, value] of Object.entries(payload.tags)) {
      scope.setTag(key, value)
    }
    scope.setContext("product_intake", payload.context)
    scope.setLevel?.("error")
    sink.captureException(error)
  })
}

export async function flushProductIntakeSentry(
  timeoutMs = 2000,
  sink: ProductIntakeSentrySink = Sentry,
): Promise<boolean> {
  if (!sink.flush) return false
  try {
    return await sink.flush(timeoutMs)
  } catch {
    return false
  }
}

function addOptional(target: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return
  target[key] = value
}

function addTag(target: Record<string, string>, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return
  target[key] = String(value)
}
