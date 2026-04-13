import assert from "node:assert/strict"
import test from "node:test"

import { deriveVolumeFromGoals } from "../src/lib/onboarding/goal-flow"
import { getOrderedGoals, getGoalLabel } from "../src/lib/vocabulary/onboarding-goals"
import { GOALS } from "../src/lib/vocabulary/concerns-goals"

// --- deriveVolumeFromGoals ---

test("volume goal derives desired_volume 'more'", () => {
  assert.equal(deriveVolumeFromGoals(["shine", "volume"]), "more")
})

test("less_volume goal derives desired_volume 'less'", () => {
  assert.equal(deriveVolumeFromGoals(["less_volume", "moisture"]), "less")
})

test("no volume goal derives desired_volume 'balanced'", () => {
  assert.equal(deriveVolumeFromGoals(["shine", "healthy_scalp"]), "balanced")
})

test("empty goals derives desired_volume 'balanced'", () => {
  assert.equal(deriveVolumeFromGoals([]), "balanced")
})

// --- getOrderedGoals ---

test("getOrderedGoals returns all goals with no duplicates", () => {
  for (const texture of ["straight", "wavy", "curly", "coily"] as const) {
    const ordered = getOrderedGoals(texture)
    assert.equal(ordered.length, GOALS.length, `${texture}: expected ${GOALS.length} goals`)
    assert.equal(new Set(ordered).size, ordered.length, `${texture}: has duplicates`)
  }
})

test("getOrderedGoals puts priority goals first for straight", () => {
  const ordered = getOrderedGoals("straight")
  assert.deepEqual(ordered.slice(0, 5), ["volume", "shine", "less_frizz", "healthy_scalp", "less_split_ends"])
})

test("getOrderedGoals puts priority goals first for curly", () => {
  const ordered = getOrderedGoals("curly")
  assert.deepEqual(ordered.slice(0, 5), ["curl_definition", "moisture", "less_frizz", "strengthen", "less_split_ends"])
})

test("getOrderedGoals puts priority goals first for coily", () => {
  const ordered = getOrderedGoals("coily")
  assert.deepEqual(ordered.slice(0, 5), ["moisture", "strengthen", "anti_breakage", "healthy_scalp", "healthier_hair"])
})

// --- getGoalLabel ---

test("getGoalLabel returns override when it exists", () => {
  assert.equal(getGoalLabel("curl_definition", "curly"), "Locken-Clumping")
  assert.equal(getGoalLabel("curl_definition", "wavy"), "Wellen-Definition")
  assert.equal(getGoalLabel("moisture", "coily"), "Feuchtigkeit versiegeln")
  assert.equal(getGoalLabel("healthy_scalp", "straight"), "Weniger schnell nachfetten")
})

test("getGoalLabel returns default label when no override", () => {
  assert.equal(getGoalLabel("volume", "curly"), "Mehr Volumen")
  assert.equal(getGoalLabel("shine", "coily"), "Mehr Glanz")
  assert.equal(getGoalLabel("anti_breakage", "straight"), "Anti-Haarbruch")
})
