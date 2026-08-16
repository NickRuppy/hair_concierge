import assert from "node:assert/strict"
import test from "node:test"

import { stage1ExampleVerdictAllowed } from "../../../src/lib/personal-plan/products/authorities"
import type { PlanCategoryDecision } from "../../../src/lib/personal-plan/types"

function decision(needTier: PlanCategoryDecision["needTier"]): PlanCategoryDecision {
  return {
    category: "shampoo",
    resolution: "resolved",
    needTier,
    roles: ["shampoo_everyday"],
    target: null,
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as unknown as PlanCategoryDecision
}

test("an ideal verdict is always allowed, regardless of need tier", () => {
  assert.equal(stage1ExampleVerdictAllowed(decision("basis"), "ideal"), true)
  assert.equal(stage1ExampleVerdictAllowed(decision("optional"), "ideal"), true)
  assert.equal(stage1ExampleVerdictAllowed(decision("not_needed"), "ideal"), true)
  assert.equal(stage1ExampleVerdictAllowed(decision(null), "ideal"), true)
})

test("a supportive verdict is allowed for both basis and optional need tiers", () => {
  assert.equal(stage1ExampleVerdictAllowed(decision("basis"), "supportive"), true)
  assert.equal(stage1ExampleVerdictAllowed(decision("optional"), "supportive"), true)
})

test("a supportive verdict is not allowed outside basis/optional need tiers", () => {
  assert.equal(stage1ExampleVerdictAllowed(decision("not_needed"), "supportive"), false)
  assert.equal(stage1ExampleVerdictAllowed(decision(null), "supportive"), false)
})
