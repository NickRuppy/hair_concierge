import assert from "node:assert/strict"
import test from "node:test"

import { checkRateLimitWithRpc, FUNNEL_EVENT_RATE_LIMIT } from "../src/lib/rate-limit"

test("funnel limiter uses normalized signed-session keys", async () => {
  let captured: Record<string, unknown> | null = null
  const result = await checkRateLimitWithRpc(
    " ABC-SESSION ",
    FUNNEL_EVENT_RATE_LIMIT,
    async (args) => {
      captured = args
      return { data: true, error: null }
    },
  )
  assert.deepEqual(result, { allowed: true })
  assert.deepEqual(captured, {
    p_key: "funnel-event:abc-session",
    p_limit: 60,
    p_window_ms: 60_000,
  })
})

test("funnel limiter fails closed when its service is unavailable", async () => {
  const originalError = console.error
  console.error = () => undefined
  try {
    const result = await checkRateLimitWithRpc("session", FUNNEL_EVENT_RATE_LIMIT, async () => ({
      data: null,
      error: new Error("unavailable"),
    }))
    assert.deepEqual(result, { allowed: false, error: "service_unavailable" })
  } finally {
    console.error = originalError
  }
})

test("funnel limiter returns an ordinary rejection when quota is exhausted", async () => {
  const result = await checkRateLimitWithRpc("session", FUNNEL_EVENT_RATE_LIMIT, async () => ({
    data: false,
    error: null,
  }))
  assert.deepEqual(result, { allowed: false })
})
