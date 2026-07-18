import assert from "node:assert/strict"
import test from "node:test"

import { isBrowserRecordableFunnelMilestone } from "../src/lib/funnel/server"
import { recordFunnelEventWithRpc, recordFunnelPurchaseFromSession } from "../src/lib/funnel/server"
import type { SupabaseBillingAnalyticsClient } from "../src/lib/billing/types"

test("browser funnel writes cannot claim server-confirmed conversions", () => {
  assert.equal(isBrowserRecordableFunnelMilestone("landing_viewed"), true)
  assert.equal(isBrowserRecordableFunnelMilestone("quiz_completed"), true)
  assert.equal(isBrowserRecordableFunnelMilestone("checkout_started"), true)
  assert.equal(isBrowserRecordableFunnelMilestone("lead_captured"), false)
  assert.equal(isBrowserRecordableFunnelMilestone("purchase_completed"), false)
})

test("record helper maps signed context and touch into the atomic RPC contract", async () => {
  let captured: Record<string, unknown> | null = null
  const data = [{ inserted: true, funnel_session_id: "20000000-0000-4000-8000-000000000002" }]
  const result = await recordFunnelEventWithRpc(
    async (args) => {
      captured = args
      return { data, error: null }
    },
    {
      context: {
        visitorId: "10000000-0000-4000-8000-000000000001",
        sessionId: "20000000-0000-4000-8000-000000000002",
        packageKey: "scalp_check_placeholder",
        issuedAt: Date.parse("2026-07-11T10:00:00.000Z"),
      },
      eventId: "30000000-0000-4000-8000-000000000003",
      milestone: "checkout_started",
      checkoutProvider: "paypal",
      checkoutReference: "intent-123",
      occurredAt: "2026-07-11T10:05:00.000Z",
      properties: { source: "quiz_result_offer" },
      touch: {
        visitorId: "10000000-0000-4000-8000-000000000001",
        sessionId: "20000000-0000-4000-8000-000000000002",
        capturedAt: Date.parse("2026-07-11T10:00:00.000Z"),
        entryPath: "/lp/scalp-check",
        utmSource: "meta",
      },
    },
  )

  assert.equal(result, data)
  const rpcArgs = captured as unknown as Record<string, unknown>
  assert.equal(rpcArgs.p_package_key, "scalp_check_placeholder")
  assert.equal(rpcArgs.p_landing_slug, "scalp-check")
  assert.equal(rpcArgs.p_checkout_provider, "paypal")
  assert.equal(rpcArgs.p_checkout_reference, "intent-123")
  assert.equal(rpcArgs.p_occurred_at, "2026-07-11T10:05:00.000Z")
  assert.deepEqual(rpcArgs.p_first_touch, { utm_source: "meta" })
})

test("record helper surfaces RPC failures", async () => {
  const rpcError = new Error("database unavailable")
  await assert.rejects(
    recordFunnelEventWithRpc(async () => ({ data: null, error: rpcError }), {
      context: {
        visitorId: "10000000-0000-4000-8000-000000000001",
        sessionId: "20000000-0000-4000-8000-000000000002",
        packageKey: "default_organic",
        issuedAt: Date.now(),
      },
      eventId: crypto.randomUUID(),
      milestone: "quiz_started",
    }),
    rpcError,
  )
})

test("browser funnel helper retains wall-clock occurrence when none is supplied", async () => {
  let occurredAt = ""
  const before = Date.now()
  await recordFunnelEventWithRpc(
    async (args) => {
      occurredAt = String(args.p_occurred_at)
      return { data: null, error: null }
    },
    {
      context: {
        visitorId: "10000000-0000-4000-8000-000000000001",
        sessionId: "20000000-0000-4000-8000-000000000002",
        packageKey: "default_organic",
        issuedAt: Date.now(),
      },
      eventId: crypto.randomUUID(),
      milestone: "quiz_started",
    },
  )
  const after = Date.now()

  assert.ok(Date.parse(occurredAt) >= before)
  assert.ok(Date.parse(occurredAt) <= after)
})

test("purchase helper returns typed permanent and transient outcomes", async () => {
  function client(input: { row: Record<string, unknown> | null; rpcError?: unknown }) {
    const builder = {
      select() {
        return builder
      },
      eq() {
        return builder
      },
      async maybeSingle() {
        return { data: input.row, error: null }
      },
    }
    return {
      from: () => builder,
      rpc: async () => ({ data: null, error: input.rpcError ?? null }),
    } as unknown as SupabaseBillingAnalyticsClient
  }
  const purchase = {
    sessionId: "session-1",
    eventId: "stripe:purchase_completed:cs_123",
    provider: "stripe" as const,
    reference: "cs_123",
    userId: "user-1",
    occurredAt: "2026-07-11T10:05:00.000Z",
  }

  assert.deepEqual(await recordFunnelPurchaseFromSession(client({ row: null }), purchase), {
    ok: false,
    kind: "permanent",
    error: "Funnel session does not exist",
  })
  const transient = await recordFunnelPurchaseFromSession(
    client({
      row: {
        visitor_id: "visitor-1",
        package_key: "default_organic",
        first_seen_at: "2026-07-11T10:00:00.000Z",
      },
      rpcError: new Error("RPC unavailable"),
    }),
    purchase,
  )
  assert.equal(transient.ok, false)
  if (!transient.ok) {
    assert.equal(transient.kind, "transient")
    assert.equal(transient.error, "RPC unavailable")
  }
})
