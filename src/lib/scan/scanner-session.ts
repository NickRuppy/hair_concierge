import type { ScanHint } from "@/lib/scan/guidance"

/**
 * All mutable, per-scan-session state the scan loop tracks between camera start and
 * stop: detection debounce/dedupe counters, telemetry inputs for `nextScanHint`, and
 * the timeout/decode guards. Why the loop is or is not running is NOT in here — that
 * belongs to the loop controller in `./scanner-loop`.
 *
 * Bundled into one object (held in a single ref) so a fresh scan session — the camera
 * reopened after being closed, or restarted after a background/visibility cycle —
 * always starts from a clean, fully-reset state in one place. `createScanSessionState()`
 * must be called once at the start of every session (never partially reset individual
 * fields), otherwise state from a prior session (e.g. a `lastFiredValue` that would
 * silently suppress re-firing `onDecoded` for the same barcode) leaks forward.
 */
export type ScanSessionState = {
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
  /**
   * D6 re-arm: the value that already fired in a previous attempt of this session and
   * must physically leave the frame before it may fire again. Set by
   * `restartScanSessionState` from the attempt that just ended, cleared by
   * `noteEmptyDetection` after `REARM_EMPTY_DETECTIONS` barcode-free detection attempts.
   *
   * Separate from `lastFiredValue` on purpose: `lastFiredValue` guards *within* one
   * attempt and is wiped on restart (otherwise nothing could ever be scanned twice),
   * while this guard survives the restart and is what stops a closed sheet from
   * re-opening ~0.5s later on a bottle the user never moved (finding F1).
   */
  blockedValue: string | null
  /** Consecutive detection attempts that saw zero barcodes since the last raw hit. */
  emptyDetections: number
  /**
   * Milliseconds the detection loop actually ran, i.e. excluding every stretch it was
   * paused for a sheet or a hidden tab. The 3s search fallback measures THIS, not wall
   * time since `startTime` — otherwise browsing the Merkliste for 30s pops the search
   * sheet on the first resumed tick (finding F2).
   */
  activeMs: number
  hint: ScanHint | null
  hintChangedAt: number
}

/** Consecutive identical raw reads required before a value is validated and fired. */
export const STABLE_READ_REQUIRED_MATCHES = 2

/**
 * Detection attempts with no barcode at all before `blockedValue` is released (D6).
 * Small on purpose: detection runs on ~every 3rd frame, so three empty attempts is a
 * fraction of a second of an empty viewfinder — long enough that a momentary decode
 * miss on a still-held bottle does not count as "the barcode left the frame".
 */
export const REARM_EMPTY_DETECTIONS = 3

/** Active-scanning budget before the one-shot search fallback fires. */
export const SCAN_TIMEOUT_MS = 3000

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
 * Deliberately NOT reset: `detecting` is loop lifecycle state rather than scan-attempt
 * state — clearing it could let a second `detect()` start while one is still in flight.
 */
export function restartScanSessionState(session: ScanSessionState, now: number): void {
  const { detecting } = session
  // D6: whatever fired in the attempt that just ended is presumed to still be in frame
  // (the sheet slid up over a live camera), so it becomes the blocked value instead of
  // being forgotten. An attempt that fired nothing keeps whatever block it inherited —
  // three empty detections, not a restart, are what release it.
  const blockedValue = session.lastFiredValue ?? session.blockedValue
  Object.assign(session, createScanSessionState(), {
    detecting,
    blockedValue,
    startTime: now,
    lastDetectionTime: now,
    hintChangedAt: now,
  })
}

export function createScanSessionState(): ScanSessionState {
  return {
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
    blockedValue: null,
    emptyDetections: 0,
    activeMs: 0,
    hint: null,
    hintChangedAt: 0,
  }
}

/**
 * One raw detection result folded into the session: the stable-read debounce, the
 * dedupe guards and the hint telemetry that used to live inline in `Scanner`'s
 * `handleRawDetections`, plus the D6 block check.
 *
 * `validate` is injected (rather than importing `validateEanInput`) so this module stays
 * a pure state machine with no identifier policy of its own, and so tests can drive the
 * valid/invalid branches without constructing real checksums.
 *
 * Mutates `session` in place, like `restartScanSessionState`: the detection loop closed
 * over this exact object. Returns the value the caller must hand to `onDecoded`, or
 * `null` when this read fires nothing.
 */
export function applyRawDetection(
  session: ScanSessionState,
  input: { rawValue: string; boundingBoxRatio: number | null; now: number },
  validate: (raw: string) => { ok: true; value: string } | { ok: false },
): { fire: string | null } {
  session.lastDetectionTime = input.now
  session.lastBoundingBoxRatio = input.boundingBoxRatio
  // A barcode is in frame, so the "it left the frame" streak restarts from zero.
  session.emptyDetections = 0

  if (input.rawValue === session.lastRawValue) {
    session.consecutiveMatch += 1
  } else {
    session.lastRawValue = input.rawValue
    session.consecutiveMatch = 1
  }

  session.rawDetectionsWithoutStableRead += 1

  if (session.consecutiveMatch < STABLE_READ_REQUIRED_MATCHES) return { fire: null }

  const validated = validate(input.rawValue)
  let fire: string | null = null
  if (validated.ok && session.blockedValue === validated.value) {
    // Controller ruling C1: a blocked read is a *clean* read we are deliberately
    // ignoring, not a failure to read. So it resets the two counters that measure
    // "we cannot read anything here" — the hint telemetry behind "Weniger kippen"
    // and the active clock behind the 3s search fallback — while deliberately NOT
    // setting `hasDecoded`: this attempt has still produced nothing, so the fallback
    // stays armed for the moment the user actually points at something else.
    session.activeMs = 0
    session.rawDetectionsWithoutStableRead = 0
  } else if (validated.ok && session.lastFiredValue !== validated.value) {
    session.lastFiredValue = validated.value
    session.hasDecoded = true
    session.rawDetectionsWithoutStableRead = 0
    session.lastRawValue = null
    fire = validated.value
  }
  // Reset the streak either way: an invalid-checksum read, a still-in-frame duplicate and
  // a blocked value all have to re-earn two fresh consecutive matches before we look
  // again (cheap, and it avoids revalidating a stationary bad read every single frame).
  session.consecutiveMatch = 0
  return { fire }
}

/**
 * One detection attempt that found no barcode at all. Once `REARM_EMPTY_DETECTIONS` of
 * them have run back to back, the frame is considered empty and the D6 block is released
 * — including `lastFiredValue`, so the same product can be scanned again the moment the
 * user brings it back.
 */
export function noteEmptyDetection(session: ScanSessionState): void {
  session.emptyDetections += 1
  if (session.emptyDetections < REARM_EMPTY_DETECTIONS) return
  session.blockedValue = null
  session.lastFiredValue = null
}

/**
 * Add the elapsed time of one loop tick to the active clock. The caller only calls this
 * while the loop is actually running, which is exactly what makes the fallback measure
 * scanning time instead of wall time (F2). Non-positive and non-finite deltas are ignored
 * so a clock glitch can never rewind the budget.
 */
export function advanceActiveClock(session: ScanSessionState, deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return
  session.activeMs += deltaMs
}

/**
 * Whether the one-shot search fallback should fire on this tick. Consumes the one-shot
 * (`timeoutFired`) when it returns `true`, so the caller can dispatch unconditionally.
 * A session that already decoded never fires it and never burns the one-shot.
 */
export function shouldFireTimeout(
  session: ScanSessionState,
  timeoutMs: number = SCAN_TIMEOUT_MS,
): boolean {
  if (session.timeoutFired || session.hasDecoded) return false
  if (session.activeMs < timeoutMs) return false
  session.timeoutFired = true
  return true
}
