import assert from "node:assert/strict"
import test from "node:test"

import {
  canTrackOfferEngagement,
  claimOfferEngagement,
  offerEngagementStorageKey,
} from "../src/lib/analytics/offer-engagement"
import { sendCustomerIoOfferEngagement } from "../src/lib/customerio/offer-engagement-client"
import {
  customerIoOfferEngagementSchema,
  deliverCustomerIoOfferEngagement,
} from "../src/lib/customerio/offer-engagement"
import {
  handleOfferEngagementRequest,
  type OfferEngagementRouteDependencies,
} from "../src/app/api/analytics/offer-engaged/route"

function context(offerVariant = "default") {
  return {
    funnelSessionId: "20000000-0000-4000-8000-000000000093",
    leadId: "10000000-0000-4000-8000-000000000093",
    offerRevision: "product_led_v2",
    offerVariant,
    offerViewId: "40000000-0000-4000-8000-000000000093",
  }
}

function eventPayload() {
  return {
    entryContext: "result_email" as const,
    focusRoutine: false,
    funnelEventId: "30000000-0000-4000-8000-000000000093",
    funnelPackageKey: "default_organic",
    funnelSessionId: "20000000-0000-4000-8000-000000000093",
    leadId: "10000000-0000-4000-8000-000000000093",
    needLane: "moisture",
    offerRevision: "product_led_v2",
    offerVariant: "default",
    offerViewId: "40000000-0000-4000-8000-000000000093",
    distinctSectionCount: 3,
    reason: "section_depth" as const,
    sourceSection: "mini_routine" as const,
  }
}

test("offer engagement is claimed once per result-tab session and offer variant", () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }

  assert.equal(claimOfferEngagement(context(), storage), true)
  assert.equal(claimOfferEngagement(context(), storage), false)
  assert.equal(claimOfferEngagement(context("alternate"), storage), true)
})

test("offer engagement falls back to the view id when no lead is available", () => {
  const key = offerEngagementStorageKey({ ...context(), leadId: null })
  assert.match(key, /40000000-0000-4000-8000-000000000093/)
})

test("offer engagement remains best effort when storage is unavailable", () => {
  const storage = {
    getItem: () => {
      throw new Error("storage blocked")
    },
    setItem: () => undefined,
  }

  assert.equal(claimOfferEngagement(context(), storage), true)
  assert.equal(claimOfferEngagement(context(), null), true)
})

test("offer engagement requires explicit analytics consent", () => {
  assert.equal(canTrackOfferEngagement(null), false)
  assert.equal(
    canTrackOfferEngagement({ essential: true, analytics: false, marketing: true, ts: 1 }),
    false,
  )
  assert.equal(
    canTrackOfferEngagement({ essential: true, analytics: true, marketing: false, ts: 1 }),
    true,
  )
})

test("Customer.io offer engagement rejects missing analytics consent", () => {
  assert.equal(
    customerIoOfferEngagementSchema.safeParse({
      ...eventPayload(),
      analyticsConsent: false,
    }).success,
    false,
  )
})

test("cold result engagement attaches to the email-keyed Customer.io quiz profile", async () => {
  const deliveries: unknown[] = []
  const parsed = customerIoOfferEngagementSchema.parse({
    ...eventPayload(),
    analyticsConsent: true,
  })

  const result = await deliverCustomerIoOfferEngagement(parsed, {
    findLeadEmail: async () => "  CURLY@example.com ",
    track: async (delivery) => {
      deliveries.push(delivery)
      return { ok: true, status: 200 }
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(deliveries, [
    {
      event: "offer_engaged",
      messageId: "offer_engaged:30000000-0000-4000-8000-000000000093",
      userId: "curly@example.com",
      properties: {
        conditioner_module_id: undefined,
        distinct_section_count: 3,
        entry_context: "result_email",
        focus_routine: false,
        funnel_event_id: "30000000-0000-4000-8000-000000000093",
        funnel_package_key: "default_organic",
        funnel_session_id: "20000000-0000-4000-8000-000000000093",
        lead_id: "10000000-0000-4000-8000-000000000093",
        need_lane: "moisture",
        offer_revision: "product_led_v2",
        offer_variant: "default",
        offer_view_id: "40000000-0000-4000-8000-000000000093",
        reason: "section_depth",
        shampoo_module_id: undefined,
        source_section: "mini_routine",
        suggested_category: undefined,
      },
    },
  ])
})

test("Customer.io offer engagement uses a keepalive server request without sending email", async () => {
  const calls: Array<[string | URL | Request, RequestInit | undefined]> = []
  const sent = await sendCustomerIoOfferEngagement(eventPayload(), {
    send: async (input, init) => {
      calls.push([input, init])
      return new Response(null, { status: 202 })
    },
  })

  assert.equal(sent, true)
  assert.equal(calls[0]?.[0], "/api/analytics/offer-engaged")
  assert.equal(calls[0]?.[1]?.keepalive, true)
  const body = JSON.parse(String(calls[0]?.[1]?.body)) as Record<string, unknown>
  assert.equal(body.analyticsConsent, true)
  assert.equal(body.leadId, eventPayload().leadId)
  assert.equal("email" in body, false)
})

test("Customer.io offer engagement retries transient failures with one stable event id", async () => {
  const bodies: string[] = []
  const delays: number[] = []
  let attempt = 0
  const sent = await sendCustomerIoOfferEngagement(eventPayload(), {
    send: async (_input, init) => {
      bodies.push(String(init?.body))
      attempt += 1
      return new Response(null, { status: attempt === 1 ? 503 : 202 })
    },
    wait: async (delayMs) => {
      delays.push(delayMs)
    },
  })

  assert.equal(sent, true)
  assert.equal(attempt, 2)
  assert.deepEqual(delays, [250])
  assert.equal(bodies[0], bodies[1])
})

test("offer engagement endpoint applies IP and per-lead limits before delivery", async () => {
  const rateLimitCalls: Array<{ identifier: string; prefix: string }> = []
  const deliveries: unknown[] = []
  const dependencies: OfferEngagementRouteDependencies = {
    checkRateLimit: async (identifier, config) => {
      rateLimitCalls.push({ identifier, prefix: config.prefix })
      return { allowed: true }
    },
    deliver: async (input) => {
      deliveries.push(input)
      return { ok: true }
    },
  }
  const result = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
      body: JSON.stringify({ ...eventPayload(), analyticsConsent: true }),
    }),
    dependencies,
  )

  assert.deepEqual(result, { body: { ok: true }, status: 202 })
  assert.deepEqual(rateLimitCalls, [
    { identifier: "203.0.113.7", prefix: "offer-engaged-ip" },
    { identifier: eventPayload().leadId, prefix: "offer-engaged-lead" },
  ])
  assert.equal(deliveries.length, 1)
})

test("offer engagement endpoint blocks rotating IDs at the IP boundary", async () => {
  const rateLimitCalls: string[] = []
  let deliveries = 0
  const result = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({ ...eventPayload(), analyticsConsent: true }),
    }),
    {
      checkRateLimit: async (identifier) => {
        rateLimitCalls.push(identifier)
        return { allowed: false }
      },
      deliver: async () => {
        deliveries += 1
        return { ok: true }
      },
    },
  )

  assert.deepEqual(result, { body: { error: "rate_limited" }, status: 429 })
  assert.deepEqual(rateLimitCalls, ["203.0.113.8"])
  assert.equal(deliveries, 0)
})

test("offer engagement endpoint blocks repeated delivery at the lead boundary", async () => {
  let rateLimitChecks = 0
  let deliveries = 0
  const result = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ ...eventPayload(), analyticsConsent: true }),
    }),
    {
      checkRateLimit: async () => {
        rateLimitChecks += 1
        return { allowed: rateLimitChecks === 1 }
      },
      deliver: async () => {
        deliveries += 1
        return { ok: true }
      },
    },
  )

  assert.deepEqual(result, { body: { error: "rate_limited" }, status: 429 })
  assert.equal(rateLimitChecks, 2)
  assert.equal(deliveries, 0)
})

test("offer engagement endpoint normalizes missing leads and invalid consent", async () => {
  const dependencies: OfferEngagementRouteDependencies = {
    checkRateLimit: async () => ({ allowed: true }),
    deliver: async () => ({ ok: false, reason: "lead_not_found" }),
  }
  const missing = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...eventPayload(), analyticsConsent: true }),
    }),
    dependencies,
  )
  const invalid = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...eventPayload(), analyticsConsent: false }),
    }),
    dependencies,
  )

  assert.deepEqual(missing, { body: { error: "lead_not_found" }, status: 404 })
  assert.deepEqual(invalid, { body: { error: "invalid_payload" }, status: 400 })
})

test("offer engagement endpoint bounds actual bytes without trusting Content-Length", async () => {
  const oversizedBody = JSON.stringify({
    ...eventPayload(),
    analyticsConsent: true,
    padding: "x".repeat(17_000),
  })
  let rateLimitChecks = 0
  const dependencies: OfferEngagementRouteDependencies = {
    checkRateLimit: async () => {
      rateLimitChecks += 1
      return { allowed: true }
    },
    deliver: async () => ({ ok: true }),
  }

  const missingHeader = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      body: oversizedBody,
    }),
    dependencies,
  )
  const forgedHeader = await handleOfferEngagementRequest(
    new Request("https://chaarlie.de/api/analytics/offer-engaged", {
      method: "POST",
      headers: { "content-length": "1" },
      body: oversizedBody,
    }),
    dependencies,
  )

  assert.deepEqual(missingHeader, { body: { error: "payload_too_large" }, status: 413 })
  assert.deepEqual(forgedHeader, { body: { error: "payload_too_large" }, status: 413 })
  assert.equal(rateLimitChecks, 0)
})
