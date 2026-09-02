import assert from "node:assert/strict"
import test from "node:test"

import {
  PLAN_OPENING_BEAT_MS,
  PLAN_OPENING_SLOW_HINT_AFTER_MS,
  PLAN_OPENING_START_TTL_MS,
  peekPlanOpeningStart,
  remainingPlanOpeningDelayMs,
  writePlanOpeningStart,
} from "../src/app/plan-bereit/opening-beat"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    size: () => values.size,
  }
}

test("the opening beat subtracts the time /welcome already showed the frame", () => {
  const now = 10_000
  assert.equal(remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, now - 500, now), 700)
  assert.equal(
    remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, now - PLAN_OPENING_BEAT_MS, now),
    0,
  )
  assert.equal(remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, now - 5_000, now), 0)
})

test("a missing, future, or stale marker falls back to the full beat", () => {
  const now = 1_000_000
  assert.equal(remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, null, now), PLAN_OPENING_BEAT_MS)
  assert.equal(
    remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, now + 50, now),
    PLAN_OPENING_BEAT_MS,
  )
  assert.equal(
    remainingPlanOpeningDelayMs(PLAN_OPENING_BEAT_MS, now - PLAN_OPENING_START_TTL_MS - 1, now),
    PLAN_OPENING_BEAT_MS,
  )
  assert.equal(
    remainingPlanOpeningDelayMs(PLAN_OPENING_SLOW_HINT_AFTER_MS, Number.NaN, now),
    PLAN_OPENING_SLOW_HINT_AFTER_MS,
  )
})

test("the marker survives repeated reads (StrictMode double-effects must not lose it)", () => {
  const storage = memoryStorage()
  assert.equal(writePlanOpeningStart(storage, 42_000), true)
  assert.equal(peekPlanOpeningStart(storage), 42_000)
  assert.equal(peekPlanOpeningStart(storage), 42_000)
  assert.equal(storage.size(), 1)
})

test("a corrupt marker is discarded instead of poisoning the beat", () => {
  const storage = memoryStorage()
  storage.setItem("chaarlie:personal-plan:plan-opening-start:v1", "not-a-number")
  assert.equal(peekPlanOpeningStart(storage), null)
})
