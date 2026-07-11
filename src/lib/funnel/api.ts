import { isBrowserRecordableFunnelMilestone, type FunnelMilestone } from "./server"

export const FUNNEL_EVENT_MAX_BODY_BYTES = 8_192
export const FUNNEL_EVENT_MAX_PROPERTIES_BYTES = 4_096
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ValidFunnelEventPayload = {
  eventId: string
  milestone: FunnelMilestone
  properties: Record<string, unknown>
}

export type FunnelEventPayloadResult =
  | { ok: true; value: ValidFunnelEventPayload }
  | { ok: false; error: string; status: 400 | 413 }

export function parseFunnelEventPayload(raw: string): FunnelEventPayloadResult {
  if (new TextEncoder().encode(raw).byteLength > FUNNEL_EVENT_MAX_BODY_BYTES) {
    return { ok: false, error: "payload_too_large", status: 413 }
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return { ok: false, error: "invalid_json", status: 400 }
  }

  if (!isRecord(body)) return { ok: false, error: "invalid_json", status: 400 }
  if (typeof body.eventId !== "string" || !UUID_PATTERN.test(body.eventId)) {
    return { ok: false, error: "invalid_event_id", status: 400 }
  }
  if (typeof body.milestone !== "string" || !isBrowserRecordableFunnelMilestone(body.milestone)) {
    return { ok: false, error: "invalid_milestone", status: 400 }
  }

  const properties = isRecord(body.properties) ? body.properties : {}
  if (
    new TextEncoder().encode(JSON.stringify(properties)).byteLength >
    FUNNEL_EVENT_MAX_PROPERTIES_BYTES
  ) {
    return { ok: false, error: "properties_too_large", status: 413 }
  }

  return {
    ok: true,
    value: { eventId: body.eventId, milestone: body.milestone, properties },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
