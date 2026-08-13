import assert from "node:assert/strict"
import test from "node:test"

import {
  isPersonalPlanStage4AutoActivateInitialEnabled,
  isPersonalPlanStage4Enabled,
} from "../src/lib/personal-plan/release"

test("released Stage 4 ignores obsolete launch flags", () => {
  assert.equal(isPersonalPlanStage4Enabled({}), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "false" }), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "TRUE" }), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "true" }), true)
})

test("initial Routine auto-activation remains a strict, default-off write gate", () => {
  assert.equal(isPersonalPlanStage4AutoActivateInitialEnabled({}), false)
  assert.equal(
    isPersonalPlanStage4AutoActivateInitialEnabled({
      PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL: "false",
    }),
    false,
  )
  assert.equal(
    isPersonalPlanStage4AutoActivateInitialEnabled({
      PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL: "TRUE",
    }),
    false,
  )
  assert.equal(
    isPersonalPlanStage4AutoActivateInitialEnabled({
      PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL: "true",
    }),
    true,
  )
})
