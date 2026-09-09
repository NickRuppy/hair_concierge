/**
 * Device-scoped "have we seen a scan session before" marker for the Wiederkehrer trigger
 * (T10, PR2). No new DB table (per the brief) — this is a client-side approximation of
 * "second session", intentionally device-scoped rather than account-scoped, following the
 * same injectable-storage shape as `category-capture-queue.ts` so production and tests
 * share one contract.
 */

export const SCAN_SESSION_MARKER_KEY = "chaarlie:scan:session-seen:v1"

export type ScanSessionMarkerStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Safe adapter for client integration; SSR callers receive no storage. */
export function createBrowserScanSessionMarkerStorage(): ScanSessionMarkerStorage | null {
  try {
    const candidate = typeof globalThis === "undefined" ? undefined : globalThis.localStorage
    return candidate ?? null
  } catch {
    return null
  }
}

/** Test-only convenience; production callers should inject the browser adapter. */
export function createMemoryScanSessionMarkerStorage(): ScanSessionMarkerStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

/**
 * Records that a `/scan` session happened just now, and reports whether an EARLIER one
 * already had — i.e. whether this is a "returning" session. `null` storage (SSR, or a
 * browser that throws on access in private mode) is always a no-op `false`: never treat an
 * unreadable device as returning, and never let this crash the scan flow.
 */
export function markScanSessionSeen(storage: ScanSessionMarkerStorage | null): boolean {
  if (!storage) return false
  try {
    const seenBefore = storage.getItem(SCAN_SESSION_MARKER_KEY) === "1"
    storage.setItem(SCAN_SESSION_MARKER_KEY, "1")
    return seenBefore
  } catch {
    return false
  }
}
