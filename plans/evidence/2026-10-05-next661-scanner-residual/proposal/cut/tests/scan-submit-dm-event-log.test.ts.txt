import assert from "node:assert/strict"
import test from "node:test"

import {
  recordScanSubmitDmLookupEvent,
  resetSubmitDmLookupCaptureThrottleForTests,
} from "../src/lib/scan/submit-dm-event-log"
import type { captureScanException } from "../src/lib/observability/scan"

function captureStub() {
  const calls: unknown[] = []
  return {
    capture: ((error: unknown, details: unknown) =>
      calls.push({ error, details })) as typeof captureScanException,
    calls,
  }
}

test("writes only the privacy-safe submit lookup measurement", async () => {
  let inserted: unknown = null
  let table: string | null = null
  const client = {
    from(name: string) {
      table = name
      return {
        insert: async (row: unknown) => {
          inserted = row
          return { error: null }
        },
      }
    },
  }

  await recordScanSubmitDmLookupEvent(client as never, {
    outcome: "timeout",
    durationMs: 1500,
    deadlineMs: 1500,
    createdAt: "2026-09-17T08:00:00.000Z",
  })

  assert.equal(table, "scan_submit_dm_lookup_events")
  assert.deepEqual(inserted, {
    outcome: "timeout",
    duration_ms: 1500,
    deadline_ms: 1500,
    created_at: "2026-09-17T08:00:00.000Z",
  })
})

test("is fail-open and rate-limits a degraded submit telemetry warning", async () => {
  resetSubmitDmLookupCaptureThrottleForTests()
  const { capture, calls } = captureStub()
  const warnings: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args)
  }
  const client = {
    from() {
      return {
        insert: async () => ({ error: { message: "sensitive-provider-detail" } }),
      }
    },
  }
  const event = { outcome: "disabled" as const, durationMs: null, deadlineMs: null }

  try {
    await assert.doesNotReject(recordScanSubmitDmLookupEvent(client as never, event, capture))
    await assert.doesNotReject(recordScanSubmitDmLookupEvent(client as never, event, capture))
  } finally {
    console.warn = originalWarn
  }

  assert.equal(calls.length, 1)
  assert.equal(JSON.stringify(warnings).includes("sensitive-provider-detail"), false)
  assert.deepEqual((calls[0] as { details: unknown }).details, {
    route: "submit",
    status: 200,
    reason: "submit_dm_lookup_event_write_failed",
    level: "warning",
  })
})
