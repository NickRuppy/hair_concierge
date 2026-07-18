import { recordFunnelPurchaseFromSession } from "@/lib/funnel/server"
import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function checkoutReference(input: BillingAnalyticsDeliveryInput) {
  const explicit = payloadString(input.event.payload, "checkout_reference")
  if (explicit) return explicit

  if (input.event.provider === "paypal") {
    return input.event.provider_subscription_id?.trim() || null
  }

  return (
    payloadString(input.event.payload, "checkout_session_id") ??
    input.event.source_object_id?.trim() ??
    null
  )
}

export async function deliverBillingAnalyticsToFunnel(
  input: BillingAnalyticsDeliveryInput,
): Promise<BillingAnalyticsDeliveryResult> {
  if (input.event.event_name !== "purchase_completed") {
    return { ok: false, permanent: true, error: "Funnel delivery requires purchase_completed" }
  }

  const sessionId = payloadString(input.event.payload, "funnel_session_id")
  if (!sessionId) {
    return { ok: false, permanent: true, error: "Funnel delivery requires funnel_session_id" }
  }

  const reference = checkoutReference(input)
  if (!reference) {
    return { ok: false, permanent: true, error: "Funnel delivery requires checkout reference" }
  }

  const result = await recordFunnelPurchaseFromSession(input.supabase, {
    sessionId,
    packageKey: payloadString(input.event.payload, "funnel_package_key"),
    eventId: input.event.event_key,
    provider: input.event.provider,
    reference,
    userId: input.event.user_id,
    occurredAt: input.event.occurred_at,
  })

  if (result.ok) return { ok: true }
  return {
    ok: false,
    permanent: result.kind === "permanent",
    error: result.error,
  }
}
