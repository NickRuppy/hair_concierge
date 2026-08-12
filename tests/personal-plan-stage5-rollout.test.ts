import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPersonalPlanStage5,
  parsePersonalPlanStage5V2Enabled,
  parsePersonalPlanStage5Rollout,
  resolvePersonalPlanStage5ContractVersion,
  resolvePersonalPlanStage5Rollout,
} from "../src/lib/personal-plan/stage5-rollout"

test("Stage 5 rollout parsing fails closed for unset and invalid environment values", () => {
  assert.equal(parsePersonalPlanStage5Rollout(undefined), "off")
  assert.equal(parsePersonalPlanStage5Rollout(""), "off")
  assert.equal(parsePersonalPlanStage5Rollout("preview"), "off")
  assert.equal(parsePersonalPlanStage5Rollout("ALL"), "off")
  assert.equal(resolvePersonalPlanStage5Rollout({}), "off")
  assert.equal(
    resolvePersonalPlanStage5Rollout({ PERSONAL_PLAN_STAGE5_ROLLOUT: "internal" }),
    "internal",
  )
})

test("Stage 5 V2 resolver selection is a strict independent fail-closed flag", () => {
  assert.equal(parsePersonalPlanStage5V2Enabled(undefined), false)
  assert.equal(parsePersonalPlanStage5V2Enabled(""), false)
  assert.equal(parsePersonalPlanStage5V2Enabled("1"), false)
  assert.equal(parsePersonalPlanStage5V2Enabled("TRUE"), false)
  assert.equal(parsePersonalPlanStage5V2Enabled("true"), true)
  assert.equal(resolvePersonalPlanStage5ContractVersion({}), 1)
  assert.equal(
    resolvePersonalPlanStage5ContractVersion({ PERSONAL_PLAN_STAGE5_V2_ENABLED: "true" }),
    2,
  )
})

test("Stage 5 rollout restricts access to eligible Personal Plan owners", () => {
  assert.equal(
    canAccessPersonalPlanStage5({
      rollout: "off",
      isEligiblePersonalPlanOwner: true,
      isInternal: true,
    }),
    false,
  )
  assert.equal(
    canAccessPersonalPlanStage5({
      rollout: "internal",
      isEligiblePersonalPlanOwner: true,
      isInternal: false,
    }),
    false,
  )
  assert.equal(
    canAccessPersonalPlanStage5({
      rollout: "internal",
      isEligiblePersonalPlanOwner: true,
      isInternal: true,
    }),
    true,
  )
  assert.equal(
    canAccessPersonalPlanStage5({
      rollout: "all",
      isEligiblePersonalPlanOwner: true,
      isInternal: false,
    }),
    true,
  )
  assert.equal(
    canAccessPersonalPlanStage5({
      rollout: "all",
      isEligiblePersonalPlanOwner: false,
      isInternal: true,
    }),
    false,
  )
})
