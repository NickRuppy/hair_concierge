import assert from "node:assert/strict"
import test from "node:test"

import { readFile } from "node:fs/promises"

import { isPersonalPlanStage4Enabled } from "../src/lib/personal-plan/release"

test("released Stage 4 ignores obsolete launch flags", () => {
  assert.equal(isPersonalPlanStage4Enabled({}), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "false" }), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "TRUE" }), true)
  assert.equal(isPersonalPlanStage4Enabled({ PERSONAL_PLAN_STAGE4_ENABLED: "true" }), true)
})

test("initial Routine activation is canonical and has no default-off release gate", async () => {
  const releaseSource = await readFile(
    new URL("../src/lib/personal-plan/release.ts", import.meta.url),
    "utf8",
  )
  const completeRouteSource = await readFile(
    new URL("../src/app/api/personal-plan/stage-3/complete/route.ts", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(releaseSource, /PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL/)
  assert.doesNotMatch(releaseSource, /isPersonalPlanStage4AutoActivateInitialEnabled/)
  assert.doesNotMatch(completeRouteSource, /activateInitialRoutine/)
  assert.match(completeRouteSource, /createRoutineProposalStagerRpcAdapter\(\{\s*client:/)
})
