import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import {
  buildMetaConversionPayload,
  deliverMetaConversion,
  isMetaScheduleCapiEnabled,
} from "../src/lib/analytics/meta-capi"
import {
  parseCalendlyBookingWebhook,
  verifyCalendlyWebhookSignature,
} from "../src/lib/calendly/webhook"

const SIGNING_KEY = "test-signing-key"
const BOOKING_EVENT_ID = "80000000-0000-8000-8000-000000000042"

function signedHeader(rawBody: string, options: { key?: string; atMs?: number } = {}) {
  const t = Math.floor((options.atMs ?? Date.now()) / 1000)
  const v1 = createHmac("sha256", options.key ?? SIGNING_KEY)
    .update(`${t}.${rawBody}`)
    .digest("hex")
  return `t=${t},v1=${v1}`
}

function inviteeCreatedBody(options: { utmContent?: string | null } = {}) {
  return JSON.stringify({
    event: "invitee.created",
    payload: {
      email: "testkim@example.com",
      name: "Testkim Beispiel",
      created_at: "2026-09-22T18:00:00.000000Z",
      tracking:
        options.utmContent === null
          ? { utm_source: "chaarlie_funnel" }
          : {
              utm_source: "chaarlie_funnel",
              utm_content: options.utmContent ?? BOOKING_EVENT_ID,
            },
    },
  })
}

test("a correctly signed fresh webhook verifies; tampering, wrong keys, and stale timestamps fail", () => {
  const body = inviteeCreatedBody()
  const header = signedHeader(body)

  assert.equal(
    verifyCalendlyWebhookSignature({ header, rawBody: body, signingKey: SIGNING_KEY }),
    true,
  )
  assert.equal(
    verifyCalendlyWebhookSignature({ header, rawBody: body + " ", signingKey: SIGNING_KEY }),
    false,
  )
  assert.equal(
    verifyCalendlyWebhookSignature({
      header: signedHeader(body, { key: "wrong-key" }),
      rawBody: body,
      signingKey: SIGNING_KEY,
    }),
    false,
  )
  assert.equal(
    verifyCalendlyWebhookSignature({
      header: signedHeader(body, { atMs: Date.now() - 10 * 60 * 1000 }),
      rawBody: body,
      signingKey: SIGNING_KEY,
    }),
    false,
  )
  for (const header of [null, "", "v1=deadbeef", "t=,v1=", `t=notanumber,v1=${"a".repeat(64)}`]) {
    assert.equal(
      verifyCalendlyWebhookSignature({ header, rawBody: body, signingKey: SIGNING_KEY }),
      false,
    )
  }
})

test("only invitee.created with a round-tripped funnel event id becomes a booking", () => {
  const booking = parseCalendlyBookingWebhook(inviteeCreatedBody())
  assert.deepEqual(booking, {
    kind: "booking",
    bookingEventId: BOOKING_EVENT_ID,
    email: "testkim@example.com",
    name: "Testkim Beispiel",
    createdAt: new Date("2026-09-22T18:00:00.000Z"),
  })

  assert.deepEqual(parseCalendlyBookingWebhook(inviteeCreatedBody({ utmContent: null })), {
    kind: "ignored",
    reason: "no-funnel-event-id",
  })
  assert.deepEqual(parseCalendlyBookingWebhook(inviteeCreatedBody({ utmContent: "not-a-uuid" })), {
    kind: "ignored",
    reason: "no-funnel-event-id",
  })
  assert.deepEqual(
    parseCalendlyBookingWebhook(JSON.stringify({ event: "invitee.canceled", payload: {} })),
    { kind: "ignored", reason: "not-invitee-created" },
  )
  assert.deepEqual(parseCalendlyBookingWebhook("not json"), {
    kind: "ignored",
    reason: "unreadable",
  })
})

test("the Schedule conversion hashes the invitee identity and needs no external id", () => {
  const payload = buildMetaConversionPayload({
    eventName: "Schedule",
    eventId: BOOKING_EVENT_ID,
    eventSourceUrl: "https://chaarlie.de/lp/call",
    eventTime: new Date("2026-09-22T18:00:00.000Z"),
    user: { email: "Testkim@Example.com ", name: "Testkim Beispiel" },
    customData: { content_name: "discovery_call_booking" },
  })

  assert.equal(payload.event_name, "Schedule")
  assert.equal(payload.event_id, BOOKING_EVENT_ID)
  assert.equal(payload.event_time, Math.floor(Date.parse("2026-09-22T18:00:00.000Z") / 1000))
  assert.equal(payload.action_source, "website")
  const userData = payload.user_data as Record<string, unknown>
  assert.match(String(userData.em), /^[0-9a-f]{64}$/)
  assert.match(String(userData.fn), /^[0-9a-f]{64}$/)
  assert.equal("external_id" in userData, false)
  assert.deepEqual(payload.custom_data, { content_name: "discovery_call_booking" })
})

test("delivery is flag-gated and sends one Schedule event to the pixel endpoint", async () => {
  assert.equal(isMetaScheduleCapiEnabled({}), false)
  assert.equal(isMetaScheduleCapiEnabled({ META_CAPI_SCHEDULE_ENABLED: "true" }), true)

  const requests: Array<{ url: string; body: string }> = []
  const fakeFetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
    requests.push({ url: String(url), body: String(init?.body) })
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  const input = {
    eventName: "Schedule" as const,
    eventId: BOOKING_EVENT_ID,
    eventSourceUrl: "https://chaarlie.de/lp/call",
    user: { email: "testkim@example.com" },
  }

  const disabled = await deliverMetaConversion(input, { enabled: false, fetch: fakeFetch })
  assert.deepEqual(disabled, { ok: false, skipped: true, error: "disabled" })
  assert.equal(requests.length, 0)

  const delivered = await deliverMetaConversion(input, {
    enabled: true,
    env: { META_CAPI_ACCESS_TOKEN: "token-1", META_PIXEL_ID: "pixel-1" },
    fetch: fakeFetch,
  })
  assert.equal(delivered.ok, true)
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /graph\.facebook\.com\/v\d+\.\d+\/pixel-1\/events/)
  const sent = JSON.parse(requests[0].body) as { data: Array<{ event_name: string }> }
  assert.equal(sent.data.length, 1)
  assert.equal(sent.data[0].event_name, "Schedule")
})
