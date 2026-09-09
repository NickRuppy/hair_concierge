import assert from "node:assert/strict"
import test from "node:test"

import {
  createMemoryScanSessionMarkerStorage,
  markScanSessionSeen,
  SCAN_SESSION_MARKER_KEY,
} from "../src/lib/scan/triggers/session-marker"

/**
 * The Wiederkehrer trigger's client-side approximation for "second session" (T10): a
 * device-scoped localStorage marker, following the same injectable-storage shape as
 * `category-capture-queue.ts` so production and tests share one contract.
 */

test("markScanSessionSeen: the first call on fresh storage is not a returning session", () => {
  const storage = createMemoryScanSessionMarkerStorage()
  assert.equal(markScanSessionSeen(storage), false)
  assert.equal(storage.getItem(SCAN_SESSION_MARKER_KEY), "1")
})

test("markScanSessionSeen: a second call against the same storage reports returning", () => {
  const storage = createMemoryScanSessionMarkerStorage()
  markScanSessionSeen(storage)
  assert.equal(markScanSessionSeen(storage), true)
})

test("markScanSessionSeen: null storage (SSR, private mode) is always a no-op false", () => {
  assert.equal(markScanSessionSeen(null), false)
})

test("markScanSessionSeen: a storage that throws is treated as a no-op false, never crashes", () => {
  const throwing = {
    getItem() {
      throw new Error("blocked")
    },
    setItem() {
      throw new Error("blocked")
    },
  }
  assert.equal(markScanSessionSeen(throwing), false)
})
