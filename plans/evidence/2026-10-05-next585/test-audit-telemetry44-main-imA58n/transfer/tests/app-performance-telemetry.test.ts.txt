import assert from "node:assert/strict"
import test from "node:test"
import {
  appendServerTiming,
  createAppPerformanceEvent,
  outcomeForResponseStatus,
  routeGroupForPathname,
  serializeServerTiming,
  toSentryPerformanceSpanContext,
  toStructuredPerformanceLog,
} from "../src/lib/observability/app-performance"

const correlationId = "123e4567-e89b-42d3-a456-426614174000"

test("accepts only the bounded performance vocabulary and falls back to unknown region", () => {
  const event = createAppPerformanceEvent({
    routeGroup: "routine",
    operation: "proxy_auth",
    outcome: "success",
    durationMs: 12.345,
    region: "",
    roundTripCount: 2,
    correlationId,
  })

  assert.deepEqual(event, {
    route_group: "routine",
    operation: "proxy_auth",
    outcome: "success",
    region: "unknown",
    duration_ms: 12.35,
    round_trip_count: 2,
    correlation_id: correlationId,
  })
})

test("rejects invalid enum values and identifiers from the telemetry envelope", () => {
  assert.throws(
    () =>
      createAppPerformanceEvent({
        routeGroup: "/routine?lead=secret" as "routine",
        operation: "proxy_auth",
        outcome: "success",
        durationMs: 1,
        correlationId,
      }),
    /routeGroup/,
  )
  assert.throws(
    () =>
      createAppPerformanceEvent({
        routeGroup: "routine",
        operation: "custom_query" as "proxy_auth",
        outcome: "success",
        durationMs: 1,
        correlationId,
      }),
    /operation/,
  )
  assert.throws(
    () =>
      createAppPerformanceEvent({
        routeGroup: "routine",
        operation: "proxy_auth",
        outcome: "success",
        durationMs: 1,
        correlationId: "lead_123@example.com",
      }),
    /correlationId/,
  )
})

test("keeps correlation IDs out of Server-Timing and public-safe sink payloads", () => {
  const event = createAppPerformanceEvent({
    routeGroup: "chat",
    operation: "route_data",
    outcome: "transient_error",
    durationMs: 14,
    correlationId,
  })

  assert.equal(serializeServerTiming(event), "app_route_data;dur=14.00")
  assert.equal(
    appendServerTiming("existing;dur=1.00", event),
    "existing;dur=1.00, app_route_data;dur=14.00",
  )
  assert.deepEqual(Object.keys(event).sort(), [
    "correlation_id",
    "duration_ms",
    "operation",
    "outcome",
    "region",
    "route_group",
  ])

  const structuredLog = toStructuredPerformanceLog(event)
  assert.equal(structuredLog.correlation_id, correlationId)
  assert.equal(
    toSentryPerformanceSpanContext(event)["app_performance.correlation_id"],
    correlationId,
  )
  assert.doesNotMatch(serializeServerTiming(event), /correlation|123e4567|chat|region/)
})

test("maps only the seven approved routes to performance groups", () => {
  assert.deepEqual(
    [
      "/plan-start",
      "/plan-bereit",
      "/routine/today",
      "/anwendung/wash-day",
      "/profile/edit/goals",
      "/chat/conversation",
      "/tracker",
    ].map(routeGroupForPathname),
    ["plan_start", "plan_ready", "routine", "anwendung", "profile", "chat", "tracker"],
  )
  assert.equal(routeGroupForPathname("/unknown?email=a@example.com"), null)
  assert.equal(routeGroupForPathname("/routine-private"), null)
})

test("maps response status to the bounded outcome without free-form details", () => {
  assert.equal(outcomeForResponseStatus(200), "success")
  assert.equal(outcomeForResponseStatus(307), "redirect")
  assert.equal(outcomeForResponseStatus(401), "denied")
  assert.equal(outcomeForResponseStatus(403), "denied")
  assert.equal(outcomeForResponseStatus(404), "not_found")
  assert.equal(outcomeForResponseStatus(503), "transient_error")
})

test("accepts only generated UUID v4 correlation identifiers", () => {
  assert.throws(
    () =>
      createAppPerformanceEvent({
        routeGroup: "routine",
        operation: "proxy_access",
        outcome: "success",
        durationMs: 1,
        correlationId: "request-correlation-id",
      }),
    /correlationId/,
  )
})
