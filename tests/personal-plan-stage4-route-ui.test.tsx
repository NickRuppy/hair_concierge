import assert from "node:assert/strict"
import test from "node:test"

import { resolveRoutinePage } from "../src/app/routine/page"
import type { PersonalPlanRoutineView } from "../src/lib/personal-plan/routine/contracts"

const activeView: PersonalPlanRoutineView = {
  status: "active",
  personalPlanId: "plan-1",
  planRevision: 3,
  sourceRevision: 4,
  activeVersion: {
    id: "routine-1",
    payload: {
      schemaVersion: 1,
      planId: "11111111-1111-4111-8111-111111111111",
      versionId: "routine-1",
      parentVersionId: null,
      source: {
        refinedVersionId: "22222222-2222-4222-8222-222222222222",
        productPortfolioVersionId: "portfolio-1",
        sourceFingerprint: "a".repeat(64),
        compilerVersion: "test",
        authorityVersions: {},
      },
      intent: { schemaVersion: 1, categories: [] },
      sections: [
        { key: "basis", itemKeys: [] },
        { key: "optional", itemKeys: [] },
      ],
      items: [],
      createdAt: "2026-08-08T00:00:00.000Z",
    },
  },
  pendingProposal: null,
}

test("Routine resolver preserves legacy only for people without a Personal Plan", async () => {
  const noPlan = await resolveRoutinePage({
    getUserId: async () => "user-1",
    stage4Enabled: () => true,
    readView: async () => ({ status: "no_personal_plan" }),
  })
  assert.deepEqual(noPlan, { kind: "legacy" })

  const personalPlan = await resolveRoutinePage({
    getUserId: async () => "user-1",
    stage4Enabled: () => false,
    readView: async ({ enabled }) => {
      assert.equal(enabled, false)
      return activeView
    },
  })
  assert.equal(personalPlan.kind, "personal_plan")
  if (personalPlan.kind === "personal_plan") {
    assert.equal(personalPlan.enabled, false)
    assert.equal(personalPlan.view.activeVersion?.id, "routine-1")
  }
})

test("Routine resolver shows scoped recovery instead of legacy on a Personal Plan read failure", async () => {
  const result = await resolveRoutinePage({
    getUserId: async () => "user-1",
    stage4Enabled: () => true,
    readView: async () => {
      throw new Error("database unavailable")
    },
  })
  assert.deepEqual(result, { kind: "unavailable" })
})
