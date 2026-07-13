import { createHash } from "node:crypto"
import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"
import { isFunnelMetaCustomDataEnabled } from "@/lib/funnel/flags"

const DEFAULT_META_CAPI_API_VERSION = "v24.0"
const DEFAULT_TIMEOUT_MS = 1500

const META_EVENT_NAMES = {
  payment_completed: "Purchase",
  payment_failed: "PaymentFailed",
  purchase_completed: "Purchase",
  refund_completed: "RefundCompleted",
  subscription_cancelled: "SubscriptionCancelled",
  subscription_expired: "SubscriptionExpired",
  subscription_started: "Subscribe",
  subscription_updated: "SubscriptionUpdated",
} as const

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizedEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase()
  return value || null
}

function metaEventId(input: BillingAnalyticsDeliveryInput) {
  if (
    input.event.provider === "stripe" &&
    (input.event.event_name === "purchase_completed" ||
      input.event.event_name === "subscription_started") &&
    typeof input.event.payload.checkout_session_id === "string"
  ) {
    return input.event.payload.checkout_session_id
  }

  if (typeof input.event.payload.meta_event_id === "string")
    return input.event.payload.meta_event_id
  return input.event.source_object_id ?? input.event.event_key
}

function customData(input: BillingAnalyticsDeliveryInput) {
  const { event } = input
  const funnelPackageKey =
    isFunnelMetaCustomDataEnabled() && typeof event.payload.funnel_package_key === "string"
      ? event.payload.funnel_package_key
      : undefined
  return {
    currency: typeof event.payload.currency === "string" ? event.payload.currency : undefined,
    value: typeof event.payload.value === "number" ? event.payload.value : undefined,
    provider: event.provider,
    provider_subscription_id: event.provider_subscription_id ?? undefined,
    subscription_status:
      typeof event.payload.subscription_status === "string"
        ? event.payload.subscription_status
        : undefined,
    interval: typeof event.payload.interval === "string" ? event.payload.interval : undefined,
    canonical_event_name: event.event_name,
    funnel_package_key: funnelPackageKey,
  }
}

export async function deliverBillingAnalyticsToMeta(
  input: BillingAnalyticsDeliveryInput,
): Promise<BillingAnalyticsDeliveryResult> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN
  const pixelId = process.env.META_PIXEL_ID ?? process.env.NEXT_PUBLIC_META_PIXEL_ID
  if (!accessToken) return { ok: false, skipped: true, error: "META_CAPI_ACCESS_TOKEN is not set" }
  if (!pixelId) return { ok: false, skipped: true, error: "META_PIXEL_ID is not set" }

  const email = normalizedEmail(input.profile?.email)
  const userData: Record<string, string | string[]> = {
    external_id: sha256(input.event.user_id),
  }
  if (email) userData.em = sha256(email)

  const body = {
    data: [
      {
        event_name: META_EVENT_NAMES[input.event.event_name],
        event_time: Math.floor(new Date(input.event.occurred_at).getTime() / 1000),
        action_source: "website",
        event_id: metaEventId(input),
        user_data: userData,
        custom_data: Object.fromEntries(
          Object.entries(customData(input)).filter(([, value]) => value !== undefined),
        ),
      },
    ],
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  }

  const version = process.env.META_CAPI_API_VERSION ?? DEFAULT_META_CAPI_API_VERSION
  const url = new URL(`https://graph.facebook.com/${version}/${pixelId}/events`)
  url.searchParams.set("access_token", accessToken)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text().catch(() => "")
    if (!response.ok) {
      return { ok: false, status: response.status, error: `${response.status} ${text}`.trim() }
    }
    return {
      ok: true,
      status: response.status,
      providerRequestId: response.headers.get("x-fb-trace-id") ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Meta CAPI error",
    }
  } finally {
    clearTimeout(timeout)
  }
}
