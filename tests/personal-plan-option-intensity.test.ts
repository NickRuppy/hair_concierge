import assert from "node:assert/strict"
import { test } from "node:test"

import { getOptionIntensity } from "@/lib/personal-plan-quiz/option-intensity"

test("returns null for fields without a pip ramp", () => {
  assert.equal(getOptionIntensity("scalpConcerns", "oily_dandruff"), null)
  assert.equal(getOptionIntensity("texture", "wavy"), null)
})

test("returns null for unknown option values inside a mapped field", () => {
  assert.equal(getOptionIntensity("resultReliability", "not_a_value"), null)
})

test("frequency scales put the strongest reading at the most pips", () => {
  assert.deepEqual(getOptionIntensity("admission", "often"), { pips: 3, max: 3 })
  assert.deepEqual(getOptionIntensity("admission", "sometimes"), { pips: 2, max: 3 })
  assert.deepEqual(getOptionIntensity("admission", "rather_not"), { pips: 1, max: 3 })
  // Aspiration wording reuses the same underlying frequency values.
  assert.deepEqual(getOptionIntensity("admission", "very"), { pips: 3, max: 3 })
  assert.deepEqual(getOptionIntensity("admission", "less"), { pips: 1, max: 3 })
})

test("reliability and confidence rank the positive extreme highest", () => {
  assert.deepEqual(getOptionIntensity("resultReliability", "mostly"), { pips: 3, max: 3 })
  assert.deepEqual(getOptionIntensity("resultReliability", "rarely"), { pips: 1, max: 3 })
  assert.deepEqual(getOptionIntensity("adaptationConfidence", "yes"), { pips: 3, max: 3 })
  assert.deepEqual(getOptionIntensity("adaptationConfidence", "no"), { pips: 1, max: 3 })
})

test("previous-attempt scale ranks the strongest unmet need highest", () => {
  assert.deepEqual(getOptionIntensity("previousAttempts", "nothing_reliably_worked"), {
    pips: 4,
    max: 4,
  })
  assert.deepEqual(getOptionIntensity("previousAttempts", "mostly_works"), { pips: 1, max: 4 })
})

test("routine clarity ranks an established routine highest and no routine lowest", () => {
  // Options are listed most→least clarity, so pips descend 4-3-2-1 top-to-bottom.
  assert.deepEqual(getOptionIntensity("routineClarity", "clear"), { pips: 4, max: 4 })
  assert.deepEqual(getOptionIntensity("routineClarity", "partial"), { pips: 3, max: 4 })
  assert.deepEqual(getOptionIntensity("routineClarity", "trial_and_error"), { pips: 2, max: 4 })
  assert.deepEqual(getOptionIntensity("routineClarity", "none"), { pips: 1, max: 4 })
})

test("non-ramp framing questions do not receive diagnostic pips", () => {
  assert.equal(getOptionIntensity("meaningfulMoment", "special_occasions"), null)
  assert.equal(getOptionIntensity("routineStyle", "simple_reliable"), null)
})

test("daily time commitment ramps upward", () => {
  assert.deepEqual(getOptionIntensity("dailyTime", "5_minutes"), { pips: 1, max: 4 })
  assert.deepEqual(getOptionIntensity("dailyTime", "20_plus_minutes"), { pips: 4, max: 4 })
})

test("weiß-nicht opt-outs are flagged as unknown with zero pips", () => {
  // Not currently reachable in the pip lists, but the descriptor must be safe.
  const ranks = { unknown: getOptionIntensity("previousAttempts", "unknown") }
  assert.deepEqual(ranks.unknown, { pips: 0, max: 4, unknown: true })
})
