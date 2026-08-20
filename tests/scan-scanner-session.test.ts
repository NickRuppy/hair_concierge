import assert from "node:assert/strict"
import test from "node:test"

import { createScanSessionState, restartScanSessionState } from "../src/lib/scan/scanner-session"

test("createScanSessionState: returns the fully-reset default shape", () => {
  assert.deepEqual(createScanSessionState(), {
    paused: false,
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
  paused.detecting = true

  restartScanSessionState(paused, 10)

  // Clearing `paused` would leave the loop stopped with no visibilitychange left to
  // restart it; clearing `detecting` could overlap a `detect()` still in flight.
  assert.equal(paused.paused, true)
  assert.equal(paused.detecting, true)
})
