import assert from "node:assert/strict"
import test from "node:test"

import { isBrowserRecordableFunnelMilestone } from "../src/lib/funnel/server"
import { recordFunnelEventWithRpc } from "../src/lib/funnel/server"

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
