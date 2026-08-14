import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPersonalPlanStage5,
  isPersonalPlanStage5UseCaseCoverageEnabled,
  PERSONAL_PLAN_STAGE5_CONTRACT_VERSION,
} from "../src/lib/personal-plan/stage5-access"

test("Stage 5 is available by default to every eligible Personal Plan owner", () => {
  assert.equal(canAccessPersonalPlanStage5({ isEligiblePersonalPlanOwner: true }), true)
  assert.equal(canAccessPersonalPlanStage5({ isEligiblePersonalPlanOwner: false }), false)
})

test("application use-case coverage has an explicit reversible activation switch", () => {
  assert.equal(isPersonalPlanStage5UseCaseCoverageEnabled({}), false)
  assert.equal(
    isPersonalPlanStage5UseCaseCoverageEnabled({
      PERSONAL_PLAN_STAGE5_USE_CASE_COVERAGE_ENABLED: "true",
    }),
    true,
  )
  assert.equal(
    isPersonalPlanStage5UseCaseCoverageEnabled({
      PERSONAL_PLAN_STAGE5_USE_CASE_COVERAGE_ENABLED: "false",
    }),
    false,
  )
})

test("Stage 5 uses V2 as its only production contract generation", () => {
  assert.equal(PERSONAL_PLAN_STAGE5_CONTRACT_VERSION, 2)
})
