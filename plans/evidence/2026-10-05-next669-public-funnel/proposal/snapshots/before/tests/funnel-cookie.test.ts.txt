import assert from "node:assert/strict"
import test from "node:test"

import {
  decodeFunnelContext,
  decodeFunnelTouch,
  encodeFunnelContext,
  encodeFunnelTouch,
  shouldReplacePendingTouch,
} from "../src/lib/funnel/cookie"

const secret = "test-signing-secret"
const now = Date.now()
const context = {
  visitorId: "10000000-0000-4000-8000-000000000001",
  sessionId: "20000000-0000-4000-8000-000000000002",
  packageKey: "default_organic",
  issuedAt: now,
}

test("round trips a signed funnel context", async () => {
  const encoded = await encodeFunnelContext(context, secret)
  assert.deepEqual(await decodeFunnelContext(encoded, secret, now), context)
})

test("preserves campaign touch through same-session quiz navigation", () => {
  const touch = {
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    capturedAt: now,
    entryPath: "/lp/scalp-check",
    utmSource: "meta",
  }
  assert.equal(shouldReplacePendingTouch("/quiz", context.sessionId, touch), false)
  assert.equal(shouldReplacePendingTouch("/lp/scalp-check", context.sessionId, touch), true)
  assert.equal(shouldReplacePendingTouch("/quiz", crypto.randomUUID(), touch), true)
})

test("rejects tampering, unknown packages, and expired contexts", async () => {
  const encoded = await encodeFunnelContext(context, secret)
  assert.equal(await decodeFunnelContext(`${encoded}x`, secret, now), null)
  assert.equal(await decodeFunnelContext(encoded, "wrong-secret", now), null)
  assert.equal(await decodeFunnelContext(encoded, secret, now + 91 * 24 * 60 * 60 * 1000), null)

  const unknown = await encodeFunnelContext({ ...context, packageKey: "unknown" }, secret)
  assert.equal(await decodeFunnelContext(unknown, secret, now), null)
})

test("touch cookies expire independently", async () => {
  const touch = {
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    capturedAt: now,
    entryPath: "/lp/scalp-check",
    utmSource: "meta",
  }
  const encoded = await encodeFunnelTouch(touch, secret)
  assert.deepEqual(await decodeFunnelTouch(encoded, secret, now), touch)
  assert.equal(await decodeFunnelTouch(encoded, secret, now + 16 * 60 * 1000), null)
})
