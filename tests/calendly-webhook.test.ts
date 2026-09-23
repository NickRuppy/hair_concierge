import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { NextRequest } from "next/server"

import { POST as receiveCalendlyWebhook } from "../src/app/api/calendly/webhook/route"

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

const EVENT_TYPE_URI = "https://api.calendly.com/event_types/20min-uuid"

function inviteeCreatedBody(
  options: {
    utmContent?: string | null
    utmSource?: string | null
    eventType?: string
    rescheduled?: boolean
  } = {},
) {
  const utmSource =
    options.utmSource === null ? {} : { utm_source: options.utmSource ?? "chaarlie_funnel" }
  return JSON.stringify({
    event: "invitee.created",
    payload: {
      ...(options.rescheduled === undefined ? {} : { rescheduled: options.rescheduled }),
      email: "testkim@example.com",
      name: "Testkim Beispiel",
      created_at: "2026-09-22T18:00:00.000000Z",
      scheduled_event: { event_type: options.eventType ?? EVENT_TYPE_URI },
      tracking:
        options.utmContent === null
          ? utmSource
          : { ...utmSource, utm_content: options.utmContent ?? BOOKING_EVENT_ID },
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

test("a reschedule's re-fired invitee.created never reports a second conversion", () => {
  assert.deepEqual(parseCalendlyBookingWebhook(inviteeCreatedBody({ rescheduled: true })), {
    kind: "ignored",
    reason: "rescheduled",
  })
  // An explicit `rescheduled: false` on a first booking still counts.
  assert.equal(
    parseCalendlyBookingWebhook(inviteeCreatedBody({ rescheduled: false })).kind,
    "booking",
  )
})

test("bookings from other sources or meeting types never reach Meta", () => {
  // A different or missing utm_source is not the funnel's embed.
  for (const utmSource of [null, "meta", "some_other_page"] as const) {
    assert.deepEqual(parseCalendlyBookingWebhook(inviteeCreatedBody({ utmSource })), {
      kind: "ignored",
      reason: "not-funnel-source",
    })
  }
  // With a configured event-type URI, other meeting types are ignored even
  // when they somehow carry funnel-shaped UTMs.
  assert.deepEqual(
    parseCalendlyBookingWebhook(
      inviteeCreatedBody({ eventType: "https://api.calendly.com/event_types/other" }),
      {
        eventTypeUri: EVENT_TYPE_URI,
      },
    ),
    { kind: "ignored", reason: "wrong-event-type" },
  )
  const scoped = parseCalendlyBookingWebhook(inviteeCreatedBody(), { eventTypeUri: EVENT_TYPE_URI })
  assert.equal(scoped.kind, "booking")
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

test("the webhook retries Meta failures before acknowledging a booking", async () => {
  const keys = [
    "CALENDLY_WEBHOOK_SIGNING_KEY",
    "META_CAPI_SCHEDULE_ENABLED",
    "META_CAPI_ACCESS_TOKEN",
    "META_PIXEL_ID",
  ] as const
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  const originalWarn = console.warn
  const body = inviteeCreatedBody()
  let deliveries = 0

  try {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SIGNING_KEY
    process.env.META_CAPI_SCHEDULE_ENABLED = "true"
    process.env.META_CAPI_ACCESS_TOKEN = "test-token"
    process.env.META_PIXEL_ID = "test-pixel"
    globalThis.fetch = async () => {
      deliveries++
      return new Response("{}", { status: deliveries === 1 ? 503 : 200 })
    }
    console.warn = () => {}

    const request = () =>
      new NextRequest("https://chaarlie.de/api/calendly/webhook", {
        method: "POST",
        headers: { "calendly-webhook-signature": signedHeader(body) },
        body,
      })
    const failed = await receiveCalendlyWebhook(request())
    assert.equal(failed.status, 503)
    assert.equal(deliveries, 1)

    const retried = await receiveCalendlyWebhook(request())
    assert.equal(retried.status, 200)
    assert.equal(deliveries, 2)

    // Misconfiguration (missing Meta credentials) must NOT 503: retrying
    // cannot heal it, and a permanent 503 gets the webhook disabled.
    delete process.env.META_CAPI_ACCESS_TOKEN
    const skipped = await receiveCalendlyWebhook(request())
    assert.equal(skipped.status, 200)
    assert.equal(deliveries, 2)
  } finally {
    for (const key of keys) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    globalThis.fetch = originalFetch
    console.warn = originalWarn
  }
})
