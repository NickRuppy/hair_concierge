import assert from "node:assert/strict"
import test from "node:test"

import { buildScanSentryPayload, captureScanException } from "../src/lib/observability/scan"

test("captureScanException tags and scopes the event under scan.*", () => {
  const thrown = new Error("scan_resolve_decision_missing")
  const tags: Record<string, string> = {}
  let context: Record<string, unknown> | null = null
  let level: string | null = null
  let captured: unknown = null

  captureScanException(
    thrown,
    { route: "resolve", status: 503, reason: "resolve_failed", userId: "user-1" },
    {
      captureException: (error) => {
        captured = error
      },
      withScope: (callback) =>
        callback({
          setContext: (_name, value) => {
            context = value
          },
          setLevel: (value) => {
            level = value
          },
          setTag: (key, value) => {
            tags[key] = value
          },
        }),
    },
  )

  assert.equal(captured, thrown)
  assert.equal(level, "error")
  assert.deepEqual(tags, {
    "scan.route": "resolve",
    "scan.status": "503",
    "scan.reason": "resolve_failed",
  })
  assert.deepEqual(context, {
    route: "resolve",
    status: 503,
    reason: "resolve_failed",
    user_id: "user-1",
  })
})

test("captureScanException honours an explicit warning level, without leaking it into tags/context", () => {
  const tags: Record<string, string> = {}
  let context: Record<string, unknown> | null = null
  let level: string | null = null

  captureScanException(
    new Error("attempt log unavailable"),
    { route: "resolve", status: 200, reason: "attempt_log_write_failed", level: "warning" },
    {
      captureException: () => {},
      withScope: (callback) =>
        callback({
          setContext: (_name, value) => {
            context = value
          },
          setLevel: (value) => {
            level = value
          },
          setTag: (key, value) => {
            tags[key] = value
          },
        }),
    },
  )

  // A fail-open telemetry write must not read as a scan error in Sentry.
  assert.equal(level, "warning")
  assert.deepEqual(tags, {
    "scan.route": "resolve",
    "scan.status": "200",
    "scan.reason": "attempt_log_write_failed",
  })
  assert.deepEqual(context, {
    route: "resolve",
    status: 200,
    reason: "attempt_log_write_failed",
  })
})

test("buildScanSentryPayload omits reason/userId when absent, never emits empty tag values", () => {
  const payload = buildScanSentryPayload({ route: "wishlist", status: 500 })
  assert.deepEqual(payload.tags, { "scan.route": "wishlist", "scan.status": "500" })
  assert.deepEqual(payload.context, { route: "wishlist", status: 500 })
})

test("buildScanSentryPayload carries a distinct tag per scan route, for filtering", () => {
  const routes = ["resolve", "search", "submit", "save", "wishlist"] as const
  for (const route of routes) {
    const payload = buildScanSentryPayload({ route, status: 503 })
    assert.equal(payload.tags["scan.route"], route)
  }
})
