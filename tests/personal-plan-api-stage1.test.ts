import assert from "node:assert/strict"
import test from "node:test"

import {
  handleStage1LoadOrCreate,
  type Stage1RouteDeps,
} from "../src/app/api/personal-plan/stage-1/route"
import type { PersonalPlanJourneyAccess } from "../src/lib/personal-plan/journey-access"

const stage1Access: PersonalPlanJourneyAccess = {
  kind: "personal_plan_start",
  frontier: "stage1",
  nextHref: "/plan-start",
  allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
}

function dependencies(overrides: Partial<Stage1RouteDeps> = {}): Stage1RouteDeps {
  return {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () => stage1Access,
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

test("Stage 1 rejects an unreachable owner before constructing persistence", async () => {
  let constructed = false
  const result = await handleStage1LoadOrCreate(
    dependencies({
      loadJourneyAccess: async () => ({ kind: "paid_pending", recoveryHref: "/plan-bereit" }),
      persistence: {
        ...dependencies().persistence,
        createOrReuseInitialNeed: async () => {
          constructed = true
          throw new Error("must not run")
        },
      },
    }),
  )
  assert.deepEqual(result, { status: 409, body: { error: "activation_pending" } })
  assert.equal(constructed, false)
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
