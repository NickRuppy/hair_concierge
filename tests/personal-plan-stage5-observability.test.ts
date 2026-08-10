import assert from "node:assert/strict"
import test from "node:test"

import {
  capturePersonalPlanApplicationFailure,
  type PersonalPlanApplicationSentrySink,
} from "../src/lib/observability/personal-plan-application"

test("Stage 5 failure observability only emits operational identifiers and never raw product or profile data", () => {
  const tags: Record<string, string> = {}
  let context: Record<string, unknown> | undefined
  let captured: unknown
  const sink: PersonalPlanApplicationSentrySink = {
    withScope(callback) {
      callback({
        setTag(key, value) {
          tags[key] = value
        },
        setContext(_name, value) {
          context = value
        },
        setFingerprint() {},
        setLevel() {},
      })
    },
    captureException(error) {
      captured = error
    },
  }

  capturePersonalPlanApplicationFailure(
    {
      reason: "missing_protocol",
      durationMs: 17.2,
      planId: "plan-1",
      routineVersionId: "routine-1",
      refinedVersionId: "refined-1",
    },
    sink,
  )

  assert.deepEqual(tags, {
    "personal_plan.stage": "application",
    "personal_plan.failure_reason": "missing_protocol",
  })
  assert.deepEqual(context, {
    reason: "missing_protocol",
    duration_ms: 17,
    plan_id: "plan-1",
    routine_version_id: "routine-1",
    refined_version_id: "refined-1",
  })
  assert.equal((captured as Error).message, "personal_plan_application_unavailable")
})
