import assert from "node:assert/strict"
import test from "node:test"

import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"

test("typed refinement errors expose stable recovery codes", () => {
  const error = new Stage2RefinementError("revision_conflict", "Newer progress exists")
  assert.equal(error.name, "Stage2RefinementError")
  assert.equal(error.code, "revision_conflict")
  assert.equal(error.message, "Newer progress exists")
  assert.equal(error instanceof Error, true)
})

test("production refinement failures share the frozen unavailable and snapshot codes", () => {
  for (const code of [
    "temporarily_unavailable",
    "unsupported_snapshot_version",
    "snapshot_too_large",
  ] as const) {
    assert.equal(new Stage2RefinementError(code).code, code)
  }
})
