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
