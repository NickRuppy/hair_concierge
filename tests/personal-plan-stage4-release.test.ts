import assert from "node:assert/strict"
import test from "node:test"

import { isPersonalPlanStage4Enabled } from "../src/lib/personal-plan/release"

test("Stage 4 release gate is strict and default-off", () => {
  assert.equal(isPersonalPlanStage4Enabled({}), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "false" }), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "TRUE" }), false)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "true" }), true)
})
