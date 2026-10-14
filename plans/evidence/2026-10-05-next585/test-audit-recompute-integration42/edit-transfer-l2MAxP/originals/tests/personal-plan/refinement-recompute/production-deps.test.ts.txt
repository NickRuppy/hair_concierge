import assert from "node:assert/strict"
import test from "node:test"

import { createProductionStage3RecomputeDeps } from "../../../src/lib/personal-plan/refinement-recompute/production-deps"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  refined: "55555555-5555-4555-8555-555555555555",
}

function routinePayload() {
  return {
    schemaVersion: 1,
    planId: ids.plan,
    versionId: ids.active,
    parentVersionId: null,
    source: {
      refinedVersionId: ids.refined,
      productPortfolioVersionId: ids.active,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items: [],
    createdAt: "2026-08-10T00:00:00.000Z",
  }
}

function fakeAdmin(rows: {
  plan?: Record<string, unknown> | null
  version?: Record<string, unknown> | null
}) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      calls.push(table)
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          if (table === "personal_plans") return { data: rows.plan ?? null, error: null }
          if (table === "personal_plan_routine_versions") {
            return { data: rows.version ?? null, error: null }
          }
          throw new Error(`unexpected table ${table}`)
        },
      }
      return query
    },
  }
  return { client, calls }
}

test("the production routine-state reader returns null with a single read when the plan has no active routine", async () => {
  const { client, calls } = fakeAdmin({ plan: { id: ids.plan, active_routine_version_id: null } })
  const deps = createProductionStage3RecomputeDeps({
    userId: "owner-1",
    admin: client as unknown as never,
  })
  const result = await deps.routineState.loadActiveRoutineVersion({
    userId: "owner-1",
    personalPlanId: ids.plan,
  })
  assert.equal(result, null)
  assert.deepEqual(calls, ["personal_plans"])
})

test("the production routine-state reader composes the plan and version rows, translating undefined source-draft fields to null", async () => {
  const { client } = fakeAdmin({
    plan: { id: ids.plan, active_routine_version_id: ids.active },
    version: {
      id: ids.active,
      payload: routinePayload(),
      source_refined_need_version_id: ids.refined,
      // source_product_draft_id / _revision intentionally absent (legacy row).
    },
  })
  const deps = createProductionStage3RecomputeDeps({
    userId: "owner-1",
    admin: client as unknown as never,
  })
  const result = await deps.routineState.loadActiveRoutineVersion({
    userId: "owner-1",
    personalPlanId: ids.plan,
  })
  assert.deepEqual(result, {
    routineVersionId: ids.active,
    payload: routinePayload(),
    source: {
      refinedVersionId: ids.refined,
      productDraftId: null,
      productDraftRevision: null,
    },
  })
})

test("the production routine-state reader carries real source-draft fields through unchanged", async () => {
  const { client } = fakeAdmin({
    plan: { id: ids.plan, active_routine_version_id: ids.active },
    version: {
      id: ids.active,
      payload: routinePayload(),
      source_refined_need_version_id: ids.refined,
      source_product_draft_id: "draft-1",
      source_product_draft_revision: 3,
    },
  })
  const deps = createProductionStage3RecomputeDeps({
    userId: "owner-1",
    admin: client as unknown as never,
  })
  const result = await deps.routineState.loadActiveRoutineVersion({
    userId: "owner-1",
    personalPlanId: ids.plan,
  })
  assert.deepEqual(result?.source, {
    refinedVersionId: ids.refined,
    productDraftId: "draft-1",
    productDraftRevision: 3,
  })
})

test("the production routine-state reader rejects a routine version row missing its source refined-need id", async () => {
  const { client } = fakeAdmin({
    plan: { id: ids.plan, active_routine_version_id: ids.active },
    version: { id: ids.active, payload: routinePayload() },
  })
  const deps = createProductionStage3RecomputeDeps({
    userId: "owner-1",
    admin: client as unknown as never,
  })
  await assert.rejects(() =>
    deps.routineState.loadActiveRoutineVersion({ userId: "owner-1", personalPlanId: ids.plan }),
  )
})
