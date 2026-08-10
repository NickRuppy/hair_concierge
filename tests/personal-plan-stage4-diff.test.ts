import assert from "node:assert/strict"
import test from "node:test"

import {
  diffRoutinePayloads,
  type RoutineCompiledPayload,
} from "../src/lib/personal-plan/routine-candidate-compiler"

function payload(inclusion: "included" | "excluded"): RoutineCompiledPayload {
  return {
    schemaVersion: 1,
    planId: "plan-a",
    versionId: "pending-sql-assignment",
    parentVersionId: null,
    source: {
      refinedVersionId: "refined-a",
      productPortfolioVersionId: "pending-sql-assignment",
      sourceFingerprint: "source",
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: [{ category: "leave_in", inclusion, inclusionSource: "user", assignments: [] }],
    },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items: [],
  }
}

test("semantic diff classifies operation-targeted changes as direct and reports unchanged count", () => {
  const delta = diffRoutinePayloads(payload("included"), payload("excluded"), [
    { kind: "category_inclusion", category: "leave_in", inclusion: "excluded" },
  ])
  assert.deepEqual(delta.direct, [
    {
      kind: "changed",
      itemKey: "category:leave_in",
      explanationKey: "personal_plan.routine.edit.category_inclusion",
    },
  ])
  assert.equal(delta.consequential.length, 0)
  assert.equal(delta.unchangedItemCount, 0)
})
