import assert from "node:assert/strict"
import test from "node:test"

import {
  FUNNEL_EVENT_MAX_BODY_BYTES,
  FUNNEL_EVENT_MAX_PROPERTIES_BYTES,
  parseFunnelEventPayload,
} from "../src/lib/funnel/api"

const eventId = "30000000-0000-4000-8000-000000000003"

test("accepts a bounded browser milestone payload", () => {
  assert.deepEqual(
    parseFunnelEventPayload(
      JSON.stringify({ eventId, milestone: "quiz_completed", properties: { step: 10 } }),
    ),
    {
      ok: true,
      value: { eventId, milestone: "quiz_completed", properties: { step: 10 } },
    },
  )
})

test("rejects malformed IDs and server-confirmed milestones", () => {
  assert.deepEqual(parseFunnelEventPayload("not json"), {
    ok: false,
    error: "invalid_json",
    status: 400,
  })
  assert.equal(
    parseFunnelEventPayload(JSON.stringify({ eventId: "bad", milestone: "quiz_started" })).ok,
    false,
  )
  for (const milestone of ["lead_captured", "purchase_completed", "unknown"]) {
    assert.deepEqual(parseFunnelEventPayload(JSON.stringify({ eventId, milestone })), {
      ok: false,
      error: "invalid_milestone",
      status: 400,
    })
  }
})

test("enforces UTF-8 body and property byte limits", () => {
  const oversizedProperties = { value: "x".repeat(FUNNEL_EVENT_MAX_PROPERTIES_BYTES) }
  assert.deepEqual(
    parseFunnelEventPayload(
      JSON.stringify({ eventId, milestone: "quiz_started", properties: oversizedProperties }),
    ),
    { ok: false, error: "properties_too_large", status: 413 },
  )
  assert.deepEqual(parseFunnelEventPayload("x".repeat(FUNNEL_EVENT_MAX_BODY_BYTES + 1)), {
    ok: false,
    error: "payload_too_large",
    status: 413,
  })
})
