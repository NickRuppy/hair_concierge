import assert from "node:assert/strict"
import test from "node:test"

import { reportUnexpectedStage2Error } from "../src/lib/observability/personal-plan-stage2"

test("the Stage-2 report carries class, code and vetted reason — never the raw message", () => {
  const tags: Record<string, string> = {}
  const captured: Error[] = []
  const contexts: Record<string, unknown> = {}
  const originalError = console.error
  const logged: unknown[] = []
  console.error = (...args: unknown[]) => logged.push(args)
  try {
    reportUnexpectedStage2Error(
      "stage2_optional_entry",
      Object.assign(new Error("stage2_legacy_profile_read_failed"), { code: "42703" }),
      {
        withScope: (callback) =>
          callback({
            setTag: (key, value) => (tags[key] = value),
            setContext: (name, context) => (contexts[name] = context),
          }),
        captureException: (error) => captured.push(error as Error),
      },
    )
  } finally {
    console.error = originalError
  }

  assert.equal(captured.length, 1)
  assert.equal(captured[0].name, "PersonalPlanStage2UnexpectedError")
  assert.equal(
    captured[0].message,
    "personal_plan_stage2_unexpected_error:stage2_optional_entry:Error:42703:stage2_legacy_profile_read_failed",
  )
  assert.deepEqual(tags, { "stage2.route": "stage2_optional_entry", "stage2.error_name": "Error" })
})

test("a free-text message (which may carry a user id) is never reported", () => {
  const captured: Error[] = []
  const contexts: Record<string, unknown> = {}
  const logged: unknown[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => logged.push(args)
  try {
    reportUnexpectedStage2Error("stage2_load_or_save", new Error("user 1111-2222 has no row"), {
      withScope: (callback) =>
        callback({ setTag: () => undefined, setContext: (n, c) => (contexts[n] = c) }),
      captureException: (error) => captured.push(error as Error),
    })
  } finally {
    console.error = originalError
  }
  assert.equal(
    captured[0].message,
    "personal_plan_stage2_unexpected_error:stage2_load_or_save:Error",
  )
  assert.equal(JSON.stringify([logged, contexts, captured[0].message]).includes("1111-2222"), false)
})
