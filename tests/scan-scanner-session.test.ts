import assert from "node:assert/strict"
import test from "node:test"

import { createScanSessionState } from "../src/lib/scan/scanner-session"

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
