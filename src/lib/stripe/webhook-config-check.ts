import * as Sentry from "@sentry/nextjs"

/**
 * Event types billing correctness depends on: subscription lifecycle
 * (updated/deleted) and invoice payment outcomes (succeeded/failed). If the
 * live Stripe webhook endpoint stops forwarding any of these, local
 * billing_subscriptions rows silently go stale until the reconcile cron's
 * expired-active branch (see src/lib/billing/entitlements.ts) eventually
 * catches up — this check exists to surface that gap immediately instead of
 * waiting for the grace window to expire.
 */
export const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
] as const

export type StripeWebhookEndpointSummary = {
  id: string
  url: string
  enabled_events: string[]
  status?: string
}

export type StripeWebhookConfigCheckResult =
  | { status: "ok"; endpointId: string; enabledEvents: string[] }
  | { status: "endpoint_not_found"; webhookUrl: string }
  | {
      status: "missing_events"
      endpointId: string
      enabledEvents: string[]
      missingEvents: string[]
    }
  | { status: "error"; reason: string }

interface SentryScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setFingerprint(value: string[]): void
  setLevel(level: "error"): void
  setTag(key: string, value: string): void
}

interface SentrySinkLike {
  captureMessage(message: string): void
  withScope(callback: (scope: SentryScopeLike) => void): void
}

export type StripeWebhookConfigIssue = Exclude<StripeWebhookConfigCheckResult, { status: "ok" }>

export async function verifyStripeWebhookConfig(deps: {
  listWebhookEndpoints: () => Promise<StripeWebhookEndpointSummary[]>
  webhookUrl: string
  captureIssue?: (issue: StripeWebhookConfigIssue) => void
}): Promise<StripeWebhookConfigCheckResult> {
  const captureIssue = deps.captureIssue ?? captureStripeWebhookConfigIssue
  let endpoints: StripeWebhookEndpointSummary[]
  try {
    endpoints = await deps.listWebhookEndpoints()
  } catch (error) {
    const result: StripeWebhookConfigCheckResult = { status: "error", reason: errorReason(error) }
    captureIssue(result)
    return result
  }

  const target = normalizeWebhookUrl(deps.webhookUrl)
  const endpoint = endpoints.find((candidate) => normalizeWebhookUrl(candidate.url) === target)
  if (!endpoint) {
    const result: StripeWebhookConfigCheckResult = {
      status: "endpoint_not_found",
      webhookUrl: deps.webhookUrl,
    }
    captureIssue(result)
    return result
  }

  const enabledEvents = endpoint.enabled_events ?? []
  if (enabledEvents.includes("*")) {
    return { status: "ok", endpointId: endpoint.id, enabledEvents }
  }

  const missingEvents = REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
    (event) => !enabledEvents.includes(event),
  )
  if (missingEvents.length > 0) {
    const result: StripeWebhookConfigCheckResult = {
      status: "missing_events",
      endpointId: endpoint.id,
      enabledEvents,
      missingEvents,
    }
    captureIssue(result)
    return result
  }

  return { status: "ok", endpointId: endpoint.id, enabledEvents }
}

export function captureStripeWebhookConfigIssue(
  issue: StripeWebhookConfigIssue,
  sink: SentrySinkLike = Sentry,
) {
  sink.withScope((scope) => {
    scope.setTag("stripe_webhook_config.status", issue.status)
    scope.setFingerprint(["stripe-webhook-config-check", issue.status])
    scope.setContext("stripe_webhook_config", { ...issue })
    scope.setLevel("error")
    sink.captureMessage(`Stripe webhook config check failed: ${issue.status}`)
  })
}

function normalizeWebhookUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase()
}

function errorReason(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
