import assert from "node:assert/strict"
import test from "node:test"

import {
  isPersonalPlanStage4AutoActivateInitialEnabled,
  isPersonalPlanStage4Enabled,
} from "../src/lib/personal-plan/release"

test("Stage 4 release gate is strict and default-off", () => {
  assert.equal(isPersonalPlanStage4Enabled({}), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "false" }), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "TRUE" }), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "true" }), true)
})

test("initial Routine auto-activation is strict, default-off, and requires Stage 4", () => {
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
    false,
  )
  assert.equal(
    isPersonalPlanStage4AutoActivateInitialEnabled({
      PERSONAL_PLAN_STAGE4_ENABLED: "true",
      PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL: "true",
    }),
    true,
  )
})
