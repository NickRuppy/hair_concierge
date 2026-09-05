import assert from "node:assert/strict"
import test from "node:test"

import {
  REARM_EMPTY_DETECTIONS,
  SCAN_TIMEOUT_MS,
  STABLE_READ_REQUIRED_MATCHES,
  advanceActiveClock,
  applyRawDetection,
  createScanSessionState,
  noteEmptyDetection,
  restartScanSessionState,
  shouldFireTimeout,
  type ScanSessionState,
} from "../src/lib/scan/scanner-session"

test("createScanSessionState: returns the fully-reset default shape", () => {
  assert.deepEqual(createScanSessionState(), {
    paused: false,
    sheetPaused: false,
    detecting: false,
    frameCounter: 0,
    blockedValue: null,
    emptyDetections: 0,
    activeMs: 0,
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
  })
})

test("createScanSessionState: returns a fresh object each call — mutating one does not leak into the next", () => {
  const first = createScanSessionState()
  first.paused = true
  first.lastFiredValue = "4006381333931"
  first.frameCounter = 42
  first.hint = "Mehr Licht hilft"

  const second = createScanSessionState()

  assert.notEqual(first, second)
  assert.equal(second.paused, false)
  assert.equal(second.lastFiredValue, null)
  assert.equal(second.frameCounter, 0)
  assert.equal(second.hint, null)
})

test("createScanSessionState: two calls produce deeply-equal but distinct objects", () => {
  const a = createScanSessionState()
  const b = createScanSessionState()
  assert.deepEqual(a, b)
  assert.notEqual(a, b)
})

test("restartScanSessionState: re-arms the guards that would block a second scan", () => {
  const session = createScanSessionState()
  session.lastFiredValue = "4006381333931"
  session.hasDecoded = true
  session.timeoutFired = true
  session.lastRawValue = "4006381333931"
  session.consecutiveMatch = 2
  session.rawDetectionsWithoutStableRead = 7
  session.frameCounter = 120
  session.detectionAttempts = 40
  session.hint = "Mehr Licht hilft"
  session.lastBoundingBoxRatio = 0.4
  session.meanLuma = 30

  restartScanSessionState(session, 5_000)

  // The same barcode must be able to fire again, and the 3s search fallback must re-arm.
  assert.equal(session.lastFiredValue, null)
  assert.equal(session.hasDecoded, false)
  assert.equal(session.timeoutFired, false)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.frameCounter, 0)
  assert.equal(session.detectionAttempts, 0)
  assert.equal(session.hint, null)
  assert.equal(session.lastBoundingBoxRatio, null)
  assert.equal(session.meanLuma, null)
  // The timeout and the hint window are measured from the restart, not from camera start.
  assert.equal(session.startTime, 5_000)
  assert.equal(session.lastDetectionTime, 5_000)
  assert.equal(session.hintChangedAt, 5_000)
})

test("restartScanSessionState: mutates in place so the running detection loop sees it", () => {
  const session = createScanSessionState()
  const loopReference = session
  session.lastFiredValue = "4006381333931"

  restartScanSessionState(session, 1)

  assert.equal(loopReference, session)
  assert.equal(loopReference.lastFiredValue, null)
})

test("restartScanSessionState: keeps camera/loop lifecycle flags, not scan-attempt state", () => {
  const paused = createScanSessionState()
  paused.paused = true
  paused.sheetPaused = true
  paused.detecting = true

  restartScanSessionState(paused, 10)

  // Clearing `paused` would leave the loop stopped with no visibilitychange left to
  // restart it; clearing `sheetPaused` would restart detection behind an open sheet;
  // clearing `detecting` could overlap a `detect()` still in flight.
  assert.equal(paused.paused, true)
  assert.equal(paused.sheetPaused, true)
  assert.equal(paused.detecting, true)
})

// ---------------------------------------------------------------------------
// applyRawDetection — the stable-read state machine + the D6 re-arm rule
// ---------------------------------------------------------------------------

const EAN_A = "4006381333931"
const EAN_B = "4005808179701"

/** Stand-in for `validateEanInput`: everything is valid except the listed rejects. */
function fakeValidate(...rejects: string[]) {
  return (raw: string): { ok: true; value: string } | { ok: false } =>
    rejects.includes(raw) ? { ok: false } : { ok: true, value: raw }
}

function read(
  session: ScanSessionState,
  rawValue: string,
  now = 0,
  validate = fakeValidate(),
): string | null {
  return applyRawDetection(session, { rawValue, boundingBoxRatio: 0.3, now }, validate).fire
}

test("applyRawDetection: two consecutive matching reads fire once", () => {
  const session = createScanSessionState()

  assert.equal(read(session, EAN_A, 100), null)
  assert.equal(session.consecutiveMatch, 1)

  assert.equal(read(session, EAN_A, 200), EAN_A)
  assert.equal(session.lastFiredValue, EAN_A)
  assert.equal(session.hasDecoded, true)
  // The fire consumes the streak so the next frame starts a fresh one.
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.lastRawValue, null)
  assert.equal(session.rawDetectionsWithoutStableRead, 0)
  assert.equal(session.lastDetectionTime, 200)
  assert.equal(session.lastBoundingBoxRatio, 0.3)
})

test("applyRawDetection: a third and fourth identical read do not re-fire", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  assert.equal(read(session, EAN_A, 200), EAN_A)

  assert.equal(read(session, EAN_A, 300), null)
  assert.equal(read(session, EAN_A, 400), null)
  assert.equal(session.lastFiredValue, EAN_A)
})

test("applyRawDetection: an invalid checksum resets the streak without firing", () => {
  const session = createScanSessionState()
  const validate = fakeValidate("1234567890123")

  assert.equal(read(session, "1234567890123", 100, validate), null)
  assert.equal(read(session, "1234567890123", 200, validate), null)
  // Streak consumed even though nothing fired: the bad read must re-earn two matches.
  assert.equal(session.consecutiveMatch, 0)
  assert.equal(session.lastFiredValue, null)
  assert.equal(session.hasDecoded, false)
  // Raw hits still count towards the "seen but never stable" hint telemetry.
  assert.equal(session.rawDetectionsWithoutStableRead, 2)
})

test("applyRawDetection: a raw hit clears the empty-detection re-arm counter", () => {
  const session = createScanSessionState()
  noteEmptyDetection(session)
  noteEmptyDetection(session)
  assert.equal(session.emptyDetections, 2)

  read(session, EAN_A, 100)

  assert.equal(session.emptyDetections, 0)
})

test("D6: after a restart the previously fired value is blocked while it stays in frame", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  assert.equal(read(session, EAN_A, 200), EAN_A)

  // Sheet closed / "Nochmal scannen" with the bottle still in view.
  restartScanSessionState(session, 1_000)
  assert.equal(session.blockedValue, EAN_A)
  assert.equal(session.lastFiredValue, null)

  // Holding it still never re-opens anything, however many stable reads it earns.
  for (const now of [1_100, 1_200, 1_300, 1_400]) {
    assert.equal(read(session, EAN_A, now), null)
  }
  assert.equal(session.lastFiredValue, null)
  assert.equal(session.hasDecoded, false)
})

test("D6: three empty detections release the block and the value fires again", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  read(session, EAN_A, 200)
  restartScanSessionState(session, 1_000)

  noteEmptyDetection(session)
  noteEmptyDetection(session)
  // Still blocked after two empty attempts.
  assert.equal(session.blockedValue, EAN_A)
  assert.equal(read(session, EAN_A, 1_100), null)

  // The raw hit reset the counter, so the barcode has to leave the frame properly.
  noteEmptyDetection(session)
  noteEmptyDetection(session)
  noteEmptyDetection(session)
  assert.equal(session.blockedValue, null)
  assert.equal(session.lastFiredValue, null)

  // Empty attempts deliberately do NOT touch the read streak (they never did — empty
  // results skipped `handleRawDetections` entirely), so the blocked read at 1_100 left a
  // streak of 1 banked and the very next matching read completes the pair and fires.
  assert.equal(session.consecutiveMatch, 1)
  assert.equal(read(session, EAN_A, 1_500), EAN_A)
})

test("D6: a block released on an empty frame still needs two matching reads from cold", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  read(session, EAN_A, 200)
  restartScanSessionState(session, 1_000)

  // Barcode leaves the frame before it is ever re-read, so no streak is banked.
  noteEmptyDetection(session)
  noteEmptyDetection(session)
  noteEmptyDetection(session)
  assert.equal(session.blockedValue, null)
  assert.equal(session.consecutiveMatch, 0)

  assert.equal(read(session, EAN_A, 1_500), null)
  assert.equal(read(session, EAN_A, 1_600), EAN_A)
})

test("D6: a different barcode fires while another value is blocked", () => {
  const session = createScanSessionState()
  read(session, EAN_A, 100)
  read(session, EAN_A, 200)
  restartScanSessionState(session, 1_000)
  assert.equal(session.blockedValue, EAN_A)

  assert.equal(read(session, EAN_B, 1_100), null)
  assert.equal(read(session, EAN_B, 1_200), EAN_B)
  // The block on A survives B firing — only leaving the frame clears it.
  assert.equal(session.blockedValue, EAN_A)
})

test("noteEmptyDetection: counts attempts and is idempotent past the re-arm threshold", () => {
  const session = createScanSessionState()
  session.blockedValue = EAN_A
  session.lastFiredValue = EAN_A

  for (let i = 0; i < REARM_EMPTY_DETECTIONS + 2; i += 1) noteEmptyDetection(session)

  assert.equal(session.emptyDetections, REARM_EMPTY_DETECTIONS + 2)
  assert.equal(session.blockedValue, null)
  assert.equal(session.lastFiredValue, null)
})

// ---------------------------------------------------------------------------
// Active clock — the 3s search fallback measures scanning time, not wall time (F2)
// ---------------------------------------------------------------------------

test("advanceActiveClock: accumulates only the ticks the caller reports", () => {
  const session = createScanSessionState()
  advanceActiveClock(session, 100)
  advanceActiveClock(session, 250)
  assert.equal(session.activeMs, 350)
})

test("advanceActiveClock: ignores non-positive and non-finite deltas", () => {
  const session = createScanSessionState()
  advanceActiveClock(session, 100)
  advanceActiveClock(session, -500)
  advanceActiveClock(session, Number.NaN)
  assert.equal(session.activeMs, 100)
})

test("shouldFireTimeout: fires once at 3000ms of active time and never again", () => {
  const session = createScanSessionState()
  advanceActiveClock(session, SCAN_TIMEOUT_MS - 1)
  assert.equal(shouldFireTimeout(session), false)

  advanceActiveClock(session, 1)
  assert.equal(shouldFireTimeout(session), true)
  assert.equal(session.timeoutFired, true)

  advanceActiveClock(session, 5_000)
  assert.equal(shouldFireTimeout(session), false)
})

test("shouldFireTimeout: paused wall time never counts — a long sheet does not pop the search", () => {
  const session = createScanSessionState()
  // 800ms of real scanning, then 30s behind an open sheet (the caller stops advancing).
  advanceActiveClock(session, 800)
  assert.equal(shouldFireTimeout(session), false)
  // Sheet closes; scanning resumes. Still under the budget.
  advanceActiveClock(session, 900)
  assert.equal(shouldFireTimeout(session), false)
  advanceActiveClock(session, SCAN_TIMEOUT_MS)
  assert.equal(shouldFireTimeout(session), true)
})

test("shouldFireTimeout: a decoded session never fires the fallback", () => {
  const session = createScanSessionState()
  session.hasDecoded = true
  advanceActiveClock(session, SCAN_TIMEOUT_MS * 2)

  assert.equal(shouldFireTimeout(session), false)
  // Not consumed either: the one-shot stays armed for the next attempt.
  assert.equal(session.timeoutFired, false)
})

test("restartScanSessionState: resets the active clock so the fallback re-arms per attempt", () => {
  const session = createScanSessionState()
  advanceActiveClock(session, SCAN_TIMEOUT_MS)
  assert.equal(shouldFireTimeout(session), true)

  restartScanSessionState(session, 9_000)

  assert.equal(session.activeMs, 0)
  assert.equal(session.emptyDetections, 0)
  assert.equal(session.timeoutFired, false)
  advanceActiveClock(session, SCAN_TIMEOUT_MS - 1)
  assert.equal(shouldFireTimeout(session), false)
  advanceActiveClock(session, 1)
  assert.equal(shouldFireTimeout(session), true)
})

test("restartScanSessionState: with nothing fired, an existing block is carried forward", () => {
  const session = createScanSessionState()
  session.blockedValue = EAN_A

  restartScanSessionState(session, 100)

  assert.equal(session.blockedValue, EAN_A)
})

test("STABLE_READ_REQUIRED_MATCHES / REARM_EMPTY_DETECTIONS / SCAN_TIMEOUT_MS: pinned values", () => {
  assert.equal(STABLE_READ_REQUIRED_MATCHES, 2)
  assert.equal(REARM_EMPTY_DETECTIONS, 3)
  assert.equal(SCAN_TIMEOUT_MS, 3000)
})
