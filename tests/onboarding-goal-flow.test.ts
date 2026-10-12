import assert from "node:assert/strict"
import test from "node:test"

import { getOrderedGoals } from "../src/lib/vocabulary/onboarding-goals"
import { GOALS } from "../src/lib/vocabulary/concerns-goals"

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
  assert.deepEqual(ordered.slice(0, 5), [
    "volume",
    "shine",
    "less_frizz",
    "healthy_scalp",
    "less_split_ends",
  ])
})

test("getOrderedGoals puts priority goals first for curly", () => {
  const ordered = getOrderedGoals("curly")
  assert.deepEqual(ordered.slice(0, 5), [
    "curl_definition",
    "moisture",
    "less_frizz",
    "strengthen",
    "less_split_ends",
  ])
})

test("getOrderedGoals puts priority goals first for coily", () => {
  const ordered = getOrderedGoals("coily")
  assert.deepEqual(ordered.slice(0, 5), [
    "moisture",
    "strengthen",
    "anti_breakage",
    "healthy_scalp",
    "healthier_hair",
  ])
})
