import assert from "node:assert/strict"
import test from "node:test"

import { isPersonalPlanStage3LabEnabled } from "../src/lib/labs/personal-plan-stage3-access"
import { isPersonalPlanStage3Enabled } from "../src/lib/personal-plan/products/release"

test("Stage 3 entry kill-switch is strict and default-off", () => {
  assert.equal(isPersonalPlanStage3Enabled({}), false)
  assert.equal(isPersonalPlanStage3Enabled({ PERSONAL_PLAN_STAGE3_ENABLED: "false" }), false)
  assert.equal(isPersonalPlanStage3Enabled({ PERSONAL_PLAN_STAGE3_ENABLED: "TRUE" }), false)
  assert.equal(isPersonalPlanStage3Enabled({ PERSONAL_PLAN_STAGE3_ENABLED: "true" }), true)
})

test("Stage 3 fixture lab is available only in dev, Preview, or explicitly flagged CI", () => {
  assert.equal(isPersonalPlanStage3LabEnabled({ NODE_ENV: "development" }), true)
  assert.equal(
    isPersonalPlanStage3LabEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    true,
  )
  assert.equal(
    isPersonalPlanStage3LabEnabled({
      CI: "true",
      CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    true,
  )
  assert.equal(
    isPersonalPlanStage3LabEnabled({
      CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    false,
  )
  assert.equal(isPersonalPlanStage3LabEnabled({ CI: "true", NODE_ENV: "production" }), false)
  assert.equal(
    isPersonalPlanStage3LabEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    false,
  )
})
