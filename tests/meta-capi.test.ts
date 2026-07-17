import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  buildMetaConversionPayload,
  deliverMetaConversion,
  isMetaLeadCapiEnabled,
  isMetaOfferViewCapiEnabled,
  metaRequestData,
  resolveBrowserFunnelEventId,
} from "../src/lib/analytics/meta-capi"

const VALID_EVENT_ID = "30000000-0000-4000-8000-000000000001"
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

test("non-billing Meta CAPI flags are strict and default off", () => {
  assert.equal(isMetaLeadCapiEnabled({}), false)
  assert.equal(isMetaLeadCapiEnabled({ META_CAPI_LEAD_ENABLED: "TRUE" }), false)
  assert.equal(isMetaLeadCapiEnabled({ META_CAPI_LEAD_ENABLED: "true" }), true)
  assert.equal(isMetaOfferViewCapiEnabled({}), false)
  assert.equal(isMetaOfferViewCapiEnabled({ META_CAPI_OFFER_VIEW_ENABLED: "1" }), false)
  assert.equal(isMetaOfferViewCapiEnabled({ META_CAPI_OFFER_VIEW_ENABLED: "true" }), true)
})

test("Meta conversion payload hashes normalized identity and preserves valid browser data", () => {
  const payload = buildMetaConversionPayload({
    eventName: "Lead",
    eventId: VALID_EVENT_ID,
    eventSourceUrl: "https://chaarlie.de/quiz",
    eventTime: new Date("2026-07-17T12:00:00.000Z"),
    user: {
      email: "  PERSON+Quiz@Example.COM ",
      name: "  Änne   Müller  ",
      externalId: "10000000-0000-4000-8000-000000000001",
      clientIpAddress: "203.0.113.7",
      clientUserAgent: "ExampleBrowser/1.0",
      fbp: "fb.1.1720000000000.123456789",
      fbc: "fb.1.1720000000000.AbCd_123-xyz",
    },
  })

  const userData = payload.user_data as Record<string, unknown>
  assert.equal(payload.event_name, "Lead")
  assert.equal(payload.event_id, VALID_EVENT_ID)
  assert.equal(payload.event_source_url, "https://chaarlie.de/quiz")
  assert.equal(payload.event_time, 1784289600)
  assert.equal(userData.client_ip_address, "203.0.113.7")
  assert.equal(userData.client_user_agent, "ExampleBrowser/1.0")
  assert.equal(userData.fbp, "fb.1.1720000000000.123456789")
  assert.equal(userData.fbc, "fb.1.1720000000000.AbCd_123-xyz")
  assert.match(String(userData.em), /^[0-9a-f]{64}$/)
  assert.match(String(userData.fn), /^[0-9a-f]{64}$/)
  assert.match(String(userData.ln), /^[0-9a-f]{64}$/)
  assert.match(String(userData.external_id), /^[0-9a-f]{64}$/)
  assert.equal(userData.em, sha256("person+quiz@example.com"))
  assert.equal(userData.external_id, sha256("10000000-0000-4000-8000-000000000001"))
  assert.notEqual(userData.fn, "anne")
})

test("Meta request data rejects malformed fbp and fbc values", () => {
  const request = new Request("https://chaarlie.de/quiz", {
    headers: {
      cookie: "_fbp=not-valid; _fbc=fb.1.bad.click; other=value",
      "user-agent": "ExampleBrowser/1.0",
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    },
  })

  assert.deepEqual(metaRequestData(request), {
    clientIpAddress: "203.0.113.8",
    clientUserAgent: "ExampleBrowser/1.0",
  })
})

test("Lead CAPI eligibility distinguishes a browser UUID from the internal fallback", () => {
  assert.deepEqual(resolveBrowserFunnelEventId({ funnelEventId: VALID_EVENT_ID }), {
    browserEventId: VALID_EVENT_ID,
    funnelEventId: VALID_EVENT_ID,
  })

  const missing = resolveBrowserFunnelEventId({})
  assert.equal(missing.browserEventId, null)
  assert.match(missing.funnelEventId, /^[0-9a-f-]{36}$/i)

  const invalid = resolveBrowserFunnelEventId({ funnelEventId: "not-a-uuid" })
  assert.equal(invalid.browserEventId, null)
  assert.match(invalid.funnelEventId, /^[0-9a-f-]{36}$/i)
})

test("Meta transport is default-off and sends test-event payloads without retries", async () => {
  let fetchCalls = 0
  const input = {
    eventName: "ViewContent" as const,
    eventId: VALID_EVENT_ID,
    eventSourceUrl: "https://chaarlie.de/result",
    user: { externalId: "10000000-0000-4000-8000-000000000001" },
    customData: { content_name: "quiz_result_offer_view" },
  }

  const disabled = await deliverMetaConversion(input, {
    enabled: false,
    env: {
      META_CAPI_ACCESS_TOKEN: "secret-token",
      META_PIXEL_ID: "pixel-123",
    },
    fetch: async () => {
      fetchCalls += 1
      return new Response(null, { status: 200 })
    },
  })
  assert.deepEqual(disabled, { ok: false, skipped: true, error: "disabled" })
  assert.equal(fetchCalls, 0)

  const bodies: unknown[] = []
  const enabled = await deliverMetaConversion(input, {
    enabled: true,
    env: {
      META_CAPI_ACCESS_TOKEN: "secret-token",
      META_CAPI_API_VERSION: "v99.0",
      META_CAPI_TEST_EVENT_CODE: "TEST123",
      META_PIXEL_ID: "pixel-123",
    },
    fetch: async (url, init) => {
      fetchCalls += 1
      assert.equal(
        String(url),
        "https://graph.facebook.com/v99.0/pixel-123/events?access_token=secret-token",
      )
      bodies.push(JSON.parse(String(init?.body)))
      return new Response(null, { status: 200, headers: { "x-fb-trace-id": "trace-123" } })
    },
  })

  assert.deepEqual(enabled, { ok: true, status: 200, providerRequestId: "trace-123" })
  assert.equal(fetchCalls, 1)
  assert.equal((bodies[0] as { test_event_code?: string }).test_event_code, "TEST123")
})

test("Meta transport times out and never includes Meta response bodies in errors", async () => {
  const input = {
    eventName: "Lead" as const,
    eventId: VALID_EVENT_ID,
    eventSourceUrl: "https://chaarlie.de/quiz",
    user: { externalId: "10000000-0000-4000-8000-000000000001" },
  }

  const rejected = await deliverMetaConversion(input, {
    enabled: true,
    env: { META_CAPI_ACCESS_TOKEN: "secret", META_PIXEL_ID: "pixel" },
    fetch: async () => new Response("sensitive echoed request", { status: 400 }),
  })
  assert.deepEqual(rejected, { ok: false, status: 400, error: "Meta CAPI request failed" })

  const timedOut = await deliverMetaConversion(input, {
    enabled: true,
    timeoutMs: 1,
    env: { META_CAPI_ACCESS_TOKEN: "secret", META_PIXEL_ID: "pixel" },
    fetch: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
      }),
  })
  assert.deepEqual(timedOut, { ok: false, error: "Meta CAPI request failed" })
})
