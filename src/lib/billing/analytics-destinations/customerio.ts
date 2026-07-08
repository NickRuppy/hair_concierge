import { identifyCustomerIoServerPerson, trackCustomerIoServerEvent } from "@/lib/customerio/server"
import type { BillingAnalyticsDeliveryInput, BillingAnalyticsDeliveryResult } from "./types"

function customerIoProperties(input: BillingAnalyticsDeliveryInput) {
  const { event } = input
  return {
    ...event.payload,
    billing_provider: event.provider,
    provider_customer_id: event.provider_customer_id,
    provider_subscription_id: event.provider_subscription_id,
    source_event_id: event.source_event_id,
    source_object_id: event.source_object_id,
    source: "billing_analytics_outbox",
  }
}

function customerIoTraits(input: BillingAnalyticsDeliveryInput) {
  const { event, profile } = input
  const status = String(event.payload.subscription_status ?? profile?.subscription_status ?? "")
  const hasPaidAccess =
    typeof event.payload.has_paid_access === "boolean"
      ? event.payload.has_paid_access
      : status === "active" || status === "past_due"
  const isCancelled = event.event_name === "subscription_cancelled"
  const lastPurchaseAt =
    event.event_name === "purchase_completed" || event.event_name === "payment_completed"
      ? event.occurred_at
      : undefined

  return {
    email: profile?.email ?? undefined,
    has_ever_paid: true,
    has_paid_access: hasPaidAccess,
    is_customer: hasPaidAccess,
    billing_provider: event.provider,
    provider_customer_id: event.provider_customer_id ?? undefined,
    provider_subscription_id: event.provider_subscription_id ?? undefined,
    subscription_status: status || undefined,
    current_period_end:
      typeof event.payload.current_period_end === "string"
        ? event.payload.current_period_end
        : (profile?.current_period_end ?? undefined),
    cancel_at_period_end:
      typeof event.payload.cancel_at_period_end === "boolean"
        ? event.payload.cancel_at_period_end
        : (profile?.cancel_at_period_end ?? undefined),
    subscription_started_at:
      event.event_name === "subscription_started" ? event.occurred_at : undefined,
    subscription_cancelled_at: isCancelled ? event.occurred_at : undefined,
    last_purchase_at: lastPurchaseAt,
    stripe_customer_id:
      event.provider === "stripe"
        ? (event.provider_customer_id ?? profile?.stripe_customer_id ?? undefined)
        : undefined,
    stripe_subscription_id:
      event.provider === "stripe"
        ? (event.provider_subscription_id ?? profile?.stripe_subscription_id ?? undefined)
        : undefined,
    subscription_interval:
      typeof event.payload.interval === "string"
        ? event.payload.interval
        : (profile?.subscription_interval ?? undefined),
  }
}

export async function deliverBillingAnalyticsToCustomerIo(
  input: BillingAnalyticsDeliveryInput,
): Promise<BillingAnalyticsDeliveryResult> {
  const identifyMessageId = `billing:${input.event.event_key}:identify`
  const identifyResult = await identifyCustomerIoServerPerson({
    userId: input.event.user_id,
    traits: customerIoTraits(input),
    messageId: identifyMessageId,
    timestamp: input.event.occurred_at,
  })

  if (!identifyResult.ok) {
    return {
      ok: false,
      skipped: identifyResult.skipped,
      status: identifyResult.status,
      error: identifyResult.error,
    }
  }

  const trackResult = await trackCustomerIoServerEvent({
    userId: input.event.user_id,
    event: input.event.event_name,
    properties: customerIoProperties(input),
    messageId: `${input.event.event_name}:${input.event.event_key}`,
    timestamp: input.event.occurred_at,
  })

  return {
    ok: trackResult.ok,
    skipped: trackResult.skipped,
    status: trackResult.status,
    error: trackResult.error,
  }
}
