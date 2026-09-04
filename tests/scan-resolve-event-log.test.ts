import assert from "node:assert/strict"
import test from "node:test"

import {
  completeScanResolveAttempt,
  createScanResolveAttemptId,
  recordScanResolveAttempt,
  resetAttemptLogCaptureThrottleForTests,
} from "../src/lib/scan/resolve-event-log"
import type { captureScanException } from "../src/lib/observability/scan"

function stubCapture() {
  const captured: unknown[] = []
  const capture = ((error: unknown, details: unknown) => {
    captured.push({ error, details })
  }) as typeof captureScanException
  return { capture, captured }
}

function stubClient(response: { error: unknown } | (() => never)) {
  let inserted: unknown = null
  let table: string | null = null
  const client = {
    from(name: string) {
      table = name
      return {
        insert: async (row: unknown) => {
          inserted = row
          if (typeof response === "function") response()
          return response
        },
      }
    },
  }
  return { client, inserted: () => inserted, table: () => table }
}

test("creates an opaque UUID attempt id", () => {
  assert.match(
    createScanResolveAttemptId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
})

test("records a started attempt with canonical value", async () => {
  const { client, inserted, table } = stubClient({ error: null })

  await recordScanResolveAttempt(client as never, {
    attemptId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    identifierType: "ean",
    rawValue: "0022796976116",
  })

  assert.equal(table(), "scan_resolve_events")
  assert.deepEqual(inserted(), {
    id: "00000000-0000-4000-8000-000000000001",
    user_id: "user-1",
    identifier_type: "ean",
    raw_value: "0022796976116",
    canonical_value: "00022796976116",
  })
})

test("completes exactly the same unfinished attempt with the v2 terminal outcome", async () => {
  let updated: unknown = null
  const filters: Array<[string, unknown]> = []
  const client = {
    from(name: string) {
      assert.equal(name, "scan_resolve_events")
      return {
        update(row: unknown) {
          updated = row
          return {
            eq(column: string, value: unknown) {
              filters.push([column, value])
              return {
                is(column: string, value: unknown) {
                  filters.push([column, value])
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      }
    },
  }

  await completeScanResolveAttempt(client as never, {
    attemptId: "00000000-0000-4000-8000-000000000001",
    lookupOutcome: "hit",
    terminalOutcome: "resolved",
    matchedProductId: "prod-1",
    failureStage: null,
  })

  assert.deepEqual(
    { ...(updated as Record<string, unknown>), completed_at: "<timestamp>" },
    {
      lookup_outcome: "hit",
      terminal_outcome: "resolved",
      matched_product_id: "prod-1",
      failure_stage: null,
      completed_at: "<timestamp>",
    },
  )
  assert.equal(typeof (updated as { completed_at: unknown }).completed_at, "string")
  assert.deepEqual(filters, [
    ["id", "00000000-0000-4000-8000-000000000001"],
    ["completed_at", null],
  ])
})

test("non-GTIN raw value logs a null canonical value", async () => {
  const { client, inserted } = stubClient({ error: null })

  await recordScanResolveAttempt(client as never, {
    attemptId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    identifierType: "ean",
    rawValue: "1234",
  })

  assert.equal((inserted() as { canonical_value: unknown }).canonical_value, null)
})

test("fail-open: an insert error never throws", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const { client } = stubClient({ error: { message: "boom" } })
  const { capture } = stubCapture()

  await assert.doesNotReject(
    recordScanResolveAttempt(
      client as never,
      {
        attemptId: "00000000-0000-4000-8000-000000000001",
        userId: "user-1",
        identifierType: "ean",
        rawValue: "4012345678901",
      },
      capture,
    ),
  )
})

test("fail-open: a thrown client error never propagates", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const { client } = stubClient(() => {
    throw new Error("network down")
  })
  const { capture } = stubCapture()

  await assert.doesNotReject(
    recordScanResolveAttempt(
      client as never,
      {
        attemptId: "00000000-0000-4000-8000-000000000001",
        userId: "user-1",
        identifierType: "ean",
        rawValue: "4012345678901",
      },
      capture,
    ),
  )
})

test("fail-open: a completion error never propagates", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const client = {
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                is: async () => ({ error: { message: "completion unavailable" } }),
              }
            },
          }
        },
      }
    },
  }
  const { capture } = stubCapture()

  await assert.doesNotReject(
    completeScanResolveAttempt(
      client as never,
      {
        attemptId: "00000000-0000-4000-8000-000000000001",
        lookupOutcome: "miss",
        terminalOutcome: "unknown_product",
        matchedProductId: null,
        failureStage: null,
      },
      capture,
    ),
  )
})

test("a start-write failure captures once to Sentry with the attempt_log_write_failed reason", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const { client } = stubClient({ error: { message: "boom" } })
  const { capture, captured } = stubCapture()

  await recordScanResolveAttempt(
    client as never,
    {
      attemptId: "00000000-0000-4000-8000-000000000001",
      userId: "user-1",
      identifierType: "ean",
      rawValue: "4012345678901",
    },
    capture,
  )

  assert.equal(captured.length, 1)
  assert.deepEqual((captured[0] as { details: unknown }).details, {
    route: "resolve",
    status: 200,
    reason: "attempt_log_write_failed",
  })
})

test("a completion-write failure also captures to Sentry", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const client = {
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                is: async () => ({ error: { message: "completion unavailable" } }),
              }
            },
          }
        },
      }
    },
  }
  const { capture, captured } = stubCapture()

  await completeScanResolveAttempt(
    client as never,
    {
      attemptId: "00000000-0000-4000-8000-000000000001",
      lookupOutcome: "miss",
      terminalOutcome: "unknown_product",
      matchedProductId: null,
      failureStage: null,
    },
    capture,
  )

  assert.equal(captured.length, 1)
})

test("a second write failure within the 60s throttle window does not capture again", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const { client } = stubClient({ error: { message: "boom" } })
  const { capture, captured } = stubCapture()
  const attempt = {
    attemptId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    identifierType: "ean",
    rawValue: "4012345678901",
  }

  await recordScanResolveAttempt(client as never, attempt, capture)
  assert.equal(captured.length, 1)

  await recordScanResolveAttempt(client as never, attempt, capture)
  assert.equal(captured.length, 1)
})

test("a write failure after the throttle window resets captures again", async () => {
  resetAttemptLogCaptureThrottleForTests()
  const { client } = stubClient({ error: { message: "boom" } })
  const { capture, captured } = stubCapture()
  const attempt = {
    attemptId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
    identifierType: "ean",
    rawValue: "4012345678901",
  }

  await recordScanResolveAttempt(client as never, attempt, capture)
  assert.equal(captured.length, 1)

  // Simulates the 60s window having elapsed without a real sleep.
  resetAttemptLogCaptureThrottleForTests()
  await recordScanResolveAttempt(client as never, attempt, capture)
  assert.equal(captured.length, 2)
})
