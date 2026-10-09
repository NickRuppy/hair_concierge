import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_TOOLS_ROLLOUT_VALUES,
  canAccessPersonalPlanTools,
  resolvePersonalPlanToolsRollout,
} from "@/lib/personal-plan/release"

test("the Tools rollout is server-owned and fails closed", () => {
  assert.deepEqual([...PERSONAL_PLAN_TOOLS_ROLLOUT_VALUES], ["off", "admin", "all"])
  assert.equal(resolvePersonalPlanToolsRollout({}), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: undefined }), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "" }), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "true" }), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "ALL" }), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: " all " }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "admin" }), "admin")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "off" }), "off")
})

test("access requires the server rollout, never a browser answer", () => {
  assert.equal(canAccessPersonalPlanTools({ rollout: "off", isAdmin: true }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: false }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: true }), true)
  assert.equal(canAccessPersonalPlanTools({ rollout: "all", isAdmin: false }), true)
})
