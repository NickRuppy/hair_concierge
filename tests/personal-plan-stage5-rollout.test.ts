import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPersonalPlanStage5,
  PERSONAL_PLAN_STAGE5_CONTRACT_VERSION,
} from "../src/lib/personal-plan/stage5-access"

test("Stage 5 is available by default to every eligible Personal Plan owner", () => {
  assert.equal(canAccessPersonalPlanStage5({ isEligiblePersonalPlanOwner: true }), true)
  assert.equal(canAccessPersonalPlanStage5({ isEligiblePersonalPlanOwner: false }), false)
})

test("Stage 5 uses V2 as its only production contract generation", () => {
  assert.equal(PERSONAL_PLAN_STAGE5_CONTRACT_VERSION, 2)
})
