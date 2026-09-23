import { createHmac, timingSafeEqual } from "node:crypto"

import { CALENDLY_FUNNEL_UTM_SOURCE } from "./constants"

/**
 * Calendly v2 webhook contract for the discovery-call funnel.
 *
 * The offer page generates the booking's Meta event id at mount, hands it to
 * the browser pixel AND into the Calendly embed as `utm_content`. Calendly
 * returns it inside `payload.tracking` on `invitee.created`, so the server
 * can fire a Meta CAPI `Schedule` with the SAME `event_id` — Meta then
 * deduplicates the browser and server copies. A booking without that id did
 * not come through the funnel page (e.g. a directly shared Calendly link)
 * and is deliberately not reported to Meta.
 */

const SIGNATURE_TOLERANCE_SECONDS = 300
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Verifies `Calendly-Webhook-Signature: t=<unix>,v1=<hex>` where `v1` is
 * HMAC-SHA256 of `${t}.${rawBody}` under the subscription's signing key.
 */
export function verifyCalendlyWebhookSignature({
  header,
  rawBody,
  signingKey,
  now = () => Date.now(),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
}: {
  header: string | null
  rawBody: string
  signingKey: string
  now?: () => number
  toleranceSeconds?: number
}): boolean {
  if (!header || !signingKey) return false

  let timestamp: string | undefined
  let signature: string | undefined
  for (const part of header.split(",")) {
    const separator = part.indexOf("=")
    if (separator < 0) return false
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === "t") timestamp = value
    if (key === "v1") signature = value
  }
  if (!timestamp || !signature || !/^\d{10,}$/.test(timestamp)) return false
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false

  const ageSeconds = Math.abs(now() / 1000 - Number(timestamp))
  if (ageSeconds > toleranceSeconds) return false

  const expected = createHmac("sha256", signingKey).update(`${timestamp}.${rawBody}`).digest()
  const provided = Buffer.from(signature, "hex")
  if (provided.length !== expected.length) return false
  return timingSafeEqual(expected, provided)
}

export type CalendlyBookingWebhook =
  | {
      kind: "booking"
      /** The browser-minted Meta event id (from `tracking.utm_content`). */
      bookingEventId: string
      email: string | null
      name: string | null
      /** When the invitee completed the booking. */
      createdAt: Date
    }
  | {
      kind: "ignored"
      reason:
        | "not-invitee-created"
        | "not-funnel-source"
        | "wrong-event-type"
        | "no-funnel-event-id"
        | "unreadable"
    }

export function parseCalendlyBookingWebhook(
  rawBody: string,
  options: {
    /**
     * Optional exact `scheduled_event.event_type` URI
     * (env `CALENDLY_EVENT_TYPE_URI`). A user-scoped subscription receives
     * every meeting type, so when the URI is configured, other event types
     * are ignored even if they somehow carry funnel-shaped UTMs.
     */
    eventTypeUri?: string | null
  } = {},
): CalendlyBookingWebhook {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return { kind: "ignored", reason: "unreadable" }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "ignored", reason: "unreadable" }
  }
  const body = parsed as Record<string, unknown>
  if (body.event !== "invitee.created") return { kind: "ignored", reason: "not-invitee-created" }

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : null
  if (!payload) return { kind: "ignored", reason: "unreadable" }

  const tracking =
    payload.tracking && typeof payload.tracking === "object" && !Array.isArray(payload.tracking)
      ? (payload.tracking as Record<string, unknown>)
      : null
  // Only bookings stamped by the discovery-call offer count: the embed always
  // sets this utm_source alongside the event id.
  if (tracking?.utm_source !== CALENDLY_FUNNEL_UTM_SOURCE) {
    return { kind: "ignored", reason: "not-funnel-source" }
  }
  if (options.eventTypeUri) {
    const scheduledEvent =
      payload.scheduled_event &&
      typeof payload.scheduled_event === "object" &&
      !Array.isArray(payload.scheduled_event)
        ? (payload.scheduled_event as Record<string, unknown>)
        : null
    if (scheduledEvent?.event_type !== options.eventTypeUri) {
      return { kind: "ignored", reason: "wrong-event-type" }
    }
  }
  const bookingEventId =
    tracking && typeof tracking.utm_content === "string" && UUID_PATTERN.test(tracking.utm_content)
      ? tracking.utm_content
      : null
  if (!bookingEventId) return { kind: "ignored", reason: "no-funnel-event-id" }

  const createdAtRaw = typeof payload.created_at === "string" ? Date.parse(payload.created_at) : NaN

  return {
    kind: "booking",
    bookingEventId,
    email: typeof payload.email === "string" && payload.email.includes("@") ? payload.email : null,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name : null,
    createdAt: Number.isFinite(createdAtRaw) ? new Date(createdAtRaw) : new Date(),
  }
}
