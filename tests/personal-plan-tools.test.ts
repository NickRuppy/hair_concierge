import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_TOOLS_ROLLOUT_VALUES,
  canAccessPersonalPlanTools,
  resolvePersonalPlanToolsRollout,
} from "@/lib/personal-plan/release"

test("the Tools rollout is server-owned and defaults to on (Rev. 6)", () => {
  assert.deepEqual([...PERSONAL_PLAN_TOOLS_ROLLOUT_VALUES], ["off", "admin", "all"])
  // Rev. 6: the rollout defaults to on; `off` is the emergency switch, `admin` the admin stage,
  // and any other value resolves to `all`.
  assert.equal(resolvePersonalPlanToolsRollout({}), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: undefined }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "" }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "true" }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "ALL" }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: " all " }), "all")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "admin" }), "admin")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: "off" }), "off")
  assert.equal(resolvePersonalPlanToolsRollout({ PERSONAL_PLAN_TOOLS_ROLLOUT: " off " }), "off")
})

test("access requires the server rollout, never a browser answer", () => {
  assert.equal(canAccessPersonalPlanTools({ rollout: "off", isAdmin: true }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: false }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: true }), true)
  assert.equal(canAccessPersonalPlanTools({ rollout: "all", isAdmin: false }), true)
})
