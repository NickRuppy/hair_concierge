import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"
import {
  resolvePurchaseFunnelAttribution,
  type PurchaseFunnelAttribution,
} from "@/lib/funnel/purchase-attribution"

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com"
const DEFAULT_TIMEOUT_MS = 1500

function withoutUnresolvedFunnelProperties(payload: Record<string, unknown>) {
  const properties = { ...payload }
  const reportedFunnelPackageKey = properties.funnel_package_key
  delete properties.funnel_attribution_issue
  delete properties.funnel_attribution_status
  delete properties.funnel_package_key
  delete properties.landing_variant
  delete properties.offer_variant
  delete properties.quiz_variant
  delete properties.reported_funnel_package_key
  return {
    properties,
    reportedFunnelPackageKey:
      typeof reportedFunnelPackageKey === "string" && reportedFunnelPackageKey.trim()
        ? reportedFunnelPackageKey.trim()
        : null,
  }
}

function purchaseFunnelProperties(
  payload: Record<string, unknown>,
  attribution: Exclude<PurchaseFunnelAttribution, { kind: "transient" }>,
) {
  const { properties, reportedFunnelPackageKey } = withoutUnresolvedFunnelProperties(payload)
  if (attribution.kind === "resolved") {
    return {
      ...properties,
      funnel_attribution_status: "resolved",
      funnel_package_key: attribution.snapshot.packageKey,
      funnel_session_id: attribution.snapshot.sessionId,
      landing_variant: attribution.snapshot.landingVariant,
      offer_variant: attribution.snapshot.offerVariant,
      quiz_variant: attribution.snapshot.quizVariant,
    }
  }

  return {
    ...properties,
    funnel_attribution_issue:
      attribution.kind === "missing" ? "session_id_missing" : attribution.issue,
    funnel_attribution_status: attribution.kind,
    ...(reportedFunnelPackageKey ? { reported_funnel_package_key: reportedFunnelPackageKey } : {}),
  }
}

export async function deliverBillingAnalyticsToPostHog(
  input: BillingAnalyticsDeliveryInput,
): Promise<BillingAnalyticsDeliveryResult> {
  const apiKey = process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return { ok: false, skipped: true, error: "POSTHOG_PROJECT_API_KEY is not set" }

  const host =
    process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST
  let eventPayload = input.event.payload
  if (input.event.event_name === "purchase_completed") {
    const attribution = await resolvePurchaseFunnelAttribution(input.supabase, input.event.payload)
    if (attribution.kind === "transient") {
      return { ok: false, error: attribution.error }
    }
    eventPayload = purchaseFunnelProperties(input.event.payload, attribution)
  }
  const properties = {
    ...eventPayload,
    billing_provider: input.event.provider,
    provider_customer_id: input.event.provider_customer_id,
    provider_subscription_id: input.event.provider_subscription_id,
    source_event_id: input.event.source_event_id,
    source_object_id: input.event.source_object_id,
    event_key: input.event.event_key,
    source: "billing_analytics_outbox",
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: input.event.user_id,
        event: input.event.event_name,
        properties,
        timestamp: input.event.occurred_at,
      }),
      signal: controller.signal,
    })
    const text = await response.text().catch(() => "")
    if (!response.ok) {
      return { ok: false, status: response.status, error: `${response.status} ${text}`.trim() }
    }
    return { ok: true, status: response.status }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown PostHog error",
    }
  } finally {
    clearTimeout(timeout)
  }
}
