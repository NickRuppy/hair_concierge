import type { ScanHint } from "@/lib/scan/guidance"

/**
 * All mutable, per-scan-session state the `Scanner` component tracks between camera
 * start and stop: detection debounce/dedupe counters, telemetry inputs for
 * `nextScanHint`, the pause flag, and the timeout/decode guards.
 *
 * Bundled into one object (held in a single ref) so a fresh scan session — the camera
 * reopened after being closed, or restarted after a background/visibility cycle —
 * always starts from a clean, fully-reset state in one place. `createScanSessionState()`
 * must be called once at the start of every session (never partially reset individual
 * fields), otherwise state from a prior session (e.g. a `paused` flag left `true` by a
 * visibilitychange that never resolved, or a `lastFiredValue` that would silently
 * suppress re-firing `onDecoded` for the same barcode on a later session) leaks forward.
 */
export type ScanSessionState = {
  /** Detection loop is paused (tab hidden) and not scheduling frame callbacks. */
  paused: boolean
  /**
   * Detection loop is paused because a sheet covers the viewfinder. Tracked separately
   * from `paused` so the two reasons can never clear each other: closing a sheet while the
   * tab is hidden must not restart the loop, and vice versa.
   */
  sheetPaused: boolean
  /** True while a `detector.detect()` call is in flight, to prevent overlapping calls. */
  detecting: boolean
  frameCounter: number
  detectionAttempts: number
  lastRawValue: string | null
  consecutiveMatch: number
  /** Last EAN successfully fired via `onDecoded`, so a still-in-frame code doesn't refire. */
  lastFiredValue: string | null
  hasDecoded: boolean
  timeoutFired: boolean
  startTime: number
  lastDetectionTime: number
  lastBoundingBoxRatio: number | null
  meanLuma: number | null
  lastLumaSampleTime: number
  rawDetectionsWithoutStableRead: number
  hint: ScanHint | null
  hintChangedAt: number
}

/**
 * Restart the scan attempt inside a session whose camera is still running — the flow
 * returns to scanning after a result/pending sheet is closed or a resolve error bounces
 * back. Every guard that would otherwise suppress a second read of the same product
 * (`lastFiredValue`, `hasDecoded`), the search fallback's one-shot `timeoutFired`, and
 * the hint/telemetry window all start over.
 *
 * Mutates in place on purpose: the detection loop closed over this exact object when the
 * camera started, so assigning a replacement object to the ref would never reach it.
 *
 * Deliberately NOT reset: `paused`, `sheetPaused` and `detecting` are camera/loop
 * lifecycle state rather than scan-attempt state. Clearing a pause flag here would leave
 * the loop stopped with nothing left to restart it (or restart it behind a still-open
 * sheet); clearing `detecting` could let a second `detect()` start while one is in flight.
 */
export function restartScanSessionState(session: ScanSessionState, now: number): void {
  const { paused, sheetPaused, detecting } = session
  Object.assign(session, createScanSessionState(), {
    paused,
    sheetPaused,
    detecting,
    startTime: now,
    lastDetectionTime: now,
    hintChangedAt: now,
  })
}

export function createScanSessionState(): ScanSessionState {
  return {
    paused: false,
    sheetPaused: false,
    detecting: false,
    frameCounter: 0,
    detectionAttempts: 0,
    lastRawValue: null,
    consecutiveMatch: 0,
    lastFiredValue: null,
    hasDecoded: false,
    timeoutFired: false,
    startTime: 0,
    lastDetectionTime: 0,
    lastBoundingBoxRatio: null,
    meanLuma: null,
    lastLumaSampleTime: 0,
    rawDetectionsWithoutStableRead: 0,
    hint: null,
    hintChangedAt: 0,
  }
}
