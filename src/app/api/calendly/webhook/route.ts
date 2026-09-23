import { after, NextResponse, type NextRequest } from "next/server"

import { parseCalendlyBookingWebhook, verifyCalendlyWebhookSignature } from "@/lib/calendly/webhook"
import {
  deliverMetaConversion,
  isMetaScheduleCapiEnabled,
  type MetaConversionInput,
} from "@/lib/analytics/meta-capi"
import { META_DISCOVERY_CALL_EVENT_SOURCE_URL } from "@/lib/analytics/page-url"
import { isFunnelMetaCustomDataEnabled } from "@/lib/funnel/flags"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Calendly `invitee.created` → Meta CAPI `Schedule`.
 *
 * Server-side counterpart of the browser pixel event the discovery-call
 * offer fires on `calendly.event_scheduled`: same `event_id` (minted by the
 * page, round-tripped through Calendly's `utm_content`), so Meta dedupes.
 * This covers bookings whose browsers block the pixel. Calendly retries
 * failed deliveries; a repeated `Schedule` with the same `event_id` is
 * deduplicated by Meta, so the handler needs no local idempotency store.
 */
export async function POST(request: NextRequest) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (!signingKey) {
    return NextResponse.json({ error: "webhook is not configured" }, { status: 503 })
  }

  const rawBody = await request.text()
  const verified = verifyCalendlyWebhookSignature({
    header: request.headers.get("calendly-webhook-signature"),
    rawBody,
    signingKey,
  })
  if (!verified) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  const webhook = parseCalendlyBookingWebhook(rawBody, {
    eventTypeUri: process.env.CALENDLY_EVENT_TYPE_URI ?? null,
  })
  if (webhook.kind === "ignored") {
    // Acknowledged so Calendly does not retry; nothing here is an error.
    return NextResponse.json({ received: true, ignored: webhook.reason })
  }

  const input: MetaConversionInput = {
    eventName: "Schedule",
    eventId: webhook.bookingEventId,
    eventSourceUrl: META_DISCOVERY_CALL_EVENT_SOURCE_URL,
    eventTime: webhook.createdAt,
    user: {
      email: webhook.email,
      name: webhook.name,
    },
    customData: {
      content_name: "discovery_call_booking",
      ...(isFunnelMetaCustomDataEnabled() ? { funnel_package_key: "discovery_call_v1" } : {}),
    },
  }

  after(async () => {
    const result = await deliverMetaConversion(input, {
      enabled: isMetaScheduleCapiEnabled(),
    })
    if (!result.ok && !result.skipped) {
      console.warn("[calendly-webhook] Meta Schedule CAPI delivery failed", {
        eventId: webhook.bookingEventId,
        error: result.error,
        status: result.status,
      })
    }
  })

  return NextResponse.json({ received: true })
}
