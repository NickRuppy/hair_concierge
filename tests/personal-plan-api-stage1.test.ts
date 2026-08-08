import assert from "node:assert/strict"
import test from "node:test"

import {
  handleStage1LoadOrCreate,
  type Stage1RouteDeps,
} from "../src/app/api/personal-plan/stage-1/route"

function dependencies(overrides: Partial<Stage1RouteDeps> = {}): Stage1RouteDeps {
  return {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    persistence: {
      isEnabled: () => true,
      cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
      findEntitlement: async () => ({
        accessState: "active",
        purchaseId: "purchase-1",
        paidAt: "2026-08-08T01:00:00.000Z",
        artifactLeadId: "lead-1",
      }),
      loadArtifact: async () => null,
      createOrReuseInitialNeed: async () => ({
        outcome: "completed",
        personalPlanId: "plan-1",
        needVersionId: "need-1",
        outputSnapshot: {},
      }),
    },
    ...overrides,
  }
}

test("Stage 1 API derives identity server-side and never accepts a browser user id", async () => {
  const result = await handleStage1LoadOrCreate(
    dependencies({
      persistence: {
        ...dependencies().persistence,
        loadArtifact: async () => null,
      },
    }),
  )
  assert.deepEqual(result, { status: 409, body: { error: "activation_pending" } })
})

test("Stage 1 API preserves typed release and availability responses", async () => {
  assert.deepEqual(
    await handleStage1LoadOrCreate(dependencies({ getAuthenticatedUser: async () => null })),
    { status: 401, body: { error: "unauthorized" } },
  )
  assert.deepEqual(
    await handleStage1LoadOrCreate(
      dependencies({ persistence: { ...dependencies().persistence, isEnabled: () => false } }),
    ),
    { status: 404, body: { error: "personal_plan_not_available" } },
  )
})
