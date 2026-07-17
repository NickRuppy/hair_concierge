import assert from "node:assert/strict"
import test from "node:test"

import {
  deliverMetaOfferView,
  handleMetaOfferViewRequest,
  type MetaOfferViewRouteDependencies,
} from "../src/app/api/analytics/meta-offer-view/route"

const payload = {
  entryContext: "quiz_completion" as const,
  leadId: "10000000-0000-4000-8000-000000000001",
  metaEventId: "30000000-0000-4000-8000-000000000001",
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://chaarlie.de/api/analytics/meta-offer-view", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

test("Meta offer endpoint validates, limits, and passes only request-bound delivery data", async () => {
  const rateLimitCalls: Array<{ identifier: string; prefix: string }> = []
  const deliveries: unknown[] = []
  const dependencies: MetaOfferViewRouteDependencies = {
    enabled: true,
    checkRateLimit: async (identifier, config) => {
      rateLimitCalls.push({ identifier, prefix: config.prefix })
      return { allowed: true }
    },
    deliver: async (input) => {
      deliveries.push(input)
      return { ok: true }
    },
  }
  const result = await handleMetaOfferViewRequest(
    request(payload, {
      cookie: "_fbp=fb.1.1720000000000.123456; _fbc=fb.1.1720000000000.click-123",
      "user-agent": "ExampleBrowser/1.0",
    }),
    dependencies,
  )

  assert.deepEqual(result, { body: { ok: true }, status: 202 })
  assert.deepEqual(rateLimitCalls, [
    { identifier: "203.0.113.7", prefix: "meta-offer-view-ip" },
    { identifier: payload.leadId, prefix: "meta-offer-view-lead" },
  ])
  assert.deepEqual(deliveries, [
    {
      ...payload,
      clientIpAddress: "203.0.113.7",
      clientUserAgent: "ExampleBrowser/1.0",
      fbc: "fb.1.1720000000000.click-123",
      fbp: "fb.1.1720000000000.123456",
    },
  ])
})

test("Meta offer endpoint is a benign no-op while its flag is off", async () => {
  let deliveries = 0
  const result = await handleMetaOfferViewRequest(request(payload), {
    enabled: false,
    checkRateLimit: async () => ({ allowed: true }),
    deliver: async () => {
      deliveries += 1
      return { ok: true }
    },
  })

  assert.deepEqual(result, { body: { ok: true, skipped: true }, status: 202 })
  assert.equal(deliveries, 0)
})

test("Meta offer endpoint rejects forged context, unknown keys, and malformed IDs", async () => {
  const dependencies: MetaOfferViewRouteDependencies = {
    enabled: true,
    checkRateLimit: async () => ({ allowed: true }),
    deliver: async () => ({ ok: true }),
  }

  for (const invalid of [
    { ...payload, entryContext: "result_email" },
    { ...payload, extra: "not-allowed" },
    { ...payload, metaEventId: "not-a-uuid" },
    { ...payload, leadId: "not-a-uuid" },
  ]) {
    assert.deepEqual(await handleMetaOfferViewRequest(request(invalid), dependencies), {
      body: { error: "invalid_payload" },
      status: 400,
    })
  }
})

test("Meta offer endpoint accepts the deterministic UUID-v8 event ID used by the client", async () => {
  let deliveredEventId: string | undefined
  const result = await handleMetaOfferViewRequest(
    request({ ...payload, metaEventId: "30000000-0000-8000-8000-000000000001" }),
    {
      enabled: true,
      checkRateLimit: async () => ({ allowed: true }),
      deliver: async (input) => {
        deliveredEventId = input.metaEventId
        return { ok: true }
      },
    },
  )

  assert.deepEqual(result, { body: { ok: true }, status: 202 })
  assert.equal(deliveredEventId, "30000000-0000-8000-8000-000000000001")
})

test("Meta offer endpoint rejects missing server-owned lead evidence", async () => {
  const result = await handleMetaOfferViewRequest(request(payload), {
    enabled: true,
    checkRateLimit: async () => ({ allowed: true }),
    deliver: async () => ({ ok: false, reason: "lead_not_eligible" }),
  })

  assert.deepEqual(result, { body: { error: "lead_not_eligible" }, status: 404 })
})

test("Meta offer delivery requires recent quiz evidence and constructs the canonical event", async () => {
  const conversions: unknown[] = []
  const missing = await deliverMetaOfferView(
    { ...payload, clientIpAddress: "203.0.113.7" },
    {
      now: () => new Date("2026-07-17T12:00:00.000Z"),
      findEligibleLead: async (_leadId, createdAfter) => {
        assert.equal(createdAfter, "2026-07-16T12:00:00.000Z")
        return null
      },
      deliver: async () => {
        throw new Error("must not send without proof")
      },
    },
  )
  assert.deepEqual(missing, { ok: false, reason: "lead_not_eligible" })

  const delivered = await deliverMetaOfferView(
    { ...payload, clientIpAddress: "203.0.113.7" },
    {
      findEligibleLead: async () => ({ email: "person@example.com", name: "Änne Müller" }),
      deliver: async (conversion) => {
        conversions.push(conversion)
        return { ok: true, status: 200 }
      },
    },
  )

  assert.deepEqual(delivered, { ok: true })
  assert.deepEqual(conversions, [
    {
      eventName: "ViewContent",
      eventId: payload.metaEventId,
      eventSourceUrl: "https://chaarlie.de/result",
      user: {
        clientIpAddress: "203.0.113.7",
        clientUserAgent: undefined,
        email: "person@example.com",
        externalId: payload.leadId,
        fbc: undefined,
        fbp: undefined,
        name: "Änne Müller",
      },
      customData: { content_name: "quiz_result_offer_view" },
    },
  ])
})

test("Meta offer endpoint bounds streamed bodies before rate limiting", async () => {
  let checks = 0
  const dependencies: MetaOfferViewRouteDependencies = {
    enabled: true,
    checkRateLimit: async () => {
      checks += 1
      return { allowed: true }
    },
    deliver: async () => ({ ok: true }),
  }
  const oversized = request({ ...payload, padding: "x".repeat(17_000) }, { "content-length": "1" })

  assert.deepEqual(await handleMetaOfferViewRequest(oversized, dependencies), {
    body: { error: "payload_too_large" },
    status: 413,
  })
  assert.equal(checks, 0)
})

test("Meta offer endpoint isolates delivery failures from its validated request contract", async () => {
  const result = await handleMetaOfferViewRequest(request(payload), {
    enabled: true,
    checkRateLimit: async () => ({ allowed: true }),
    deliver: async () => ({ ok: false, reason: "delivery_failed" }),
  })

  assert.deepEqual(result, { body: { error: "delivery_failed" }, status: 503 })
})
