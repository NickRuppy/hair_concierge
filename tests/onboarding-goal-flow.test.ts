import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveOnboardingGoals,
  getOnboardingGoalCards,
} from "../src/lib/onboarding/goal-flow"

test("desired volume 'more' adds the volume goal", () => {
  const goals = deriveOnboardingGoals(["shine", "healthy_scalp"], "more")

  assert.deepEqual(goals, ["shine", "healthy_scalp", "volume"])
})

test("desired volume 'less' and 'balanced' do not inject the volume goal", () => {
  assert.deepEqual(deriveOnboardingGoals(["shine"], "less"), ["shine"])
  assert.deepEqual(
    deriveOnboardingGoals(["healthy_scalp"], "balanced"),
    ["healthy_scalp"]
  )
})

test("straight onboarding cards are unique and no longer use the old volume chip", () => {
  const straightGoals = getOnboardingGoalCards("straight")
  const keys = straightGoals.map((goal) => goal.key)

  assert.deepEqual(keys, ["healthy_scalp", "less_frizz", "shine"])
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(!keys.includes("volume"))
})
