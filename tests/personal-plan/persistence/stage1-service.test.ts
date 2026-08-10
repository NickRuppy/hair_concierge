import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage1PersistenceService,
  type Stage1PersistenceDependencies,
} from "../../../src/lib/personal-plan/persistence/stage1-service"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

const artifact = {
  id: "11111111-1111-4111-8111-111111111111",
  quizAnswers: COMPLETE_V3_PLAN_ENVELOPE,
}

function dependencies(
  overrides: Partial<Stage1PersistenceDependencies> = {},
): Stage1PersistenceDependencies {
  return {
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    findEntitlement: async () => ({
      accessState: "active",
      enrollmentSourceId: "22222222-2222-4222-8222-222222222222",
      qualifiedAt: "2026-08-08T01:00:00.000Z",
      artifactLeadId: "44444444-4444-4444-8444-444444444444",
    }),
    loadArtifact: async () => artifact,
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: request.userId,
      needVersionId: "33333333-3333-4333-8333-333333333333",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-08T02:00:00.000Z"),
    ...overrides,
  }
}

test("Stage 1 persists only the authenticated user's active new-buyer artifact", async () => {
  const calls: unknown[] = []
  const service = createStage1PersistenceService(
    dependencies({
      createOrReuseInitialNeed: async (request) => {
        calls.push(request)
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "need-1",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )

  const result = await service.loadOrCreate({ userId: "user-1" })

  assert.equal(result.status, "completed")
  assert.equal(calls.length, 1)
  assert.match((calls[0] as { inputHash: string }).inputHash, /^[a-f0-9]{64}$/)
  assert.deepEqual((calls[0] as { inputSnapshot: unknown }).inputSnapshot, artifact.quizAnswers)
})

test("Stage 1 keeps flag-off, non-cohort, and pending states outside all reads and writes", async () => {
  for (const expected of ["personal_plan_not_available", "activation_pending"] as const) {
    let artifactReads = 0
    let writes = 0
    const service = createStage1PersistenceService(
      dependencies({
        isEnabled: () => expected !== "personal_plan_not_available",
        findEntitlement: async () => ({
          accessState: expected === "activation_pending" ? "paid_pending" : "active",
          enrollmentSourceId: "purchase-1",
          qualifiedAt: "2026-08-08T01:00:00.000Z",
          artifactLeadId: "lead-1",
        }),
        loadArtifact: async () => {
          artifactReads += 1
          return artifact
        },
        createOrReuseInitialNeed: async () => {
          writes += 1
          return {
            outcome: "completed",
            personalPlanId: "plan",
            needVersionId: "need",
            outputSnapshot: {},
          }
        },
      }),
    )
    assert.deepEqual(await service.loadOrCreate({ userId: "user-1" }), { status: expected })
    assert.equal(artifactReads, 0)
    assert.equal(writes, 0)
  }
})

test("Stage 1 rejects a paid purchase before the rollout cutoff without mutating", async () => {
  let writes = 0
  const service = createStage1PersistenceService(
    dependencies({
      findEntitlement: async () => ({
        accessState: "active",
        enrollmentSourceId: "purchase-1",
        qualifiedAt: "2026-08-07T23:59:59.999Z",
        artifactLeadId: "lead-1",
      }),
      createOrReuseInitialNeed: async () => {
        writes += 1
        return {
          outcome: "completed",
          personalPlanId: "plan",
          needVersionId: "need",
          outputSnapshot: {},
        }
      },
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: "user-1" }), {
    status: "personal_plan_not_available",
  })
  assert.equal(writes, 0)
})

test("Stage 1 maps unavailable storage and invalid compute sources to typed safe outcomes", async () => {
  const unavailable = createStage1PersistenceService(
    dependencies({
      createOrReuseInitialNeed: async () => ({ outcome: "temporarily_unavailable" }),
    }),
  )
  assert.deepEqual(await unavailable.loadOrCreate({ userId: "user-1" }), {
    status: "temporarily_unavailable",
  })

  const invalid = createStage1PersistenceService(
    dependencies({ loadArtifact: async () => ({ ...artifact, quizAnswers: {} }) }),
  )
  assert.deepEqual(await invalid.loadOrCreate({ userId: "user-1" }), { status: "invalid_source" })
})
