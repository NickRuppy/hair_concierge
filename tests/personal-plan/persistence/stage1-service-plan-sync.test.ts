import assert from "node:assert/strict"
import test from "node:test"

import type {
  SyncPlanWithFacts,
  SyncPlanWithFactsResult,
} from "../../../src/lib/personal-plan/facts-recompute/types"
import {
  createStage1PersistenceService,
  type CreateInitialNeedRequest,
  type Stage1PersistenceDependencies,
} from "../../../src/lib/personal-plan/persistence/stage1-service"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

/**
 * Central profile PR2 task 5(b): once Stage 1 builds its source from the profile facts, a plan
 * whose current initial version differs from the facts hash must move through the plan-sync
 * lane. `createOrReuseInitialNeed`'s "initial changed" branch stales the open refinement draft
 * and nulls the refined head without a clone, so it must never run for a facts-driven difference.
 */

const USER_ID = "user-1"
const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"

type ExistingPlan = NonNullable<
  Awaited<ReturnType<NonNullable<Stage1PersistenceDependencies["loadExistingPlan"]>>>
>

function plan(overrides: Partial<ExistingPlan["currentInitial"]> = {}): ExistingPlan {
  return {
    personalPlanId: "plan-1",
    currentInitial: {
      needVersionId: "initial-1",
      inputHash: "hash-of-an-older-facts-state",
      outputSnapshot: { initial: 1 },
      ...overrides,
    },
  }
}

function baseDeps(
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
    loadArtifact: async () => ({ id: ARTIFACT_ID, quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "created-initial",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-08T02:00:00.000Z"),
    ...overrides,
  }
}

/** The hash Stage 1 computes for the fixture source (what an unchanged plan carries). */
async function currentHash(): Promise<string> {
  let hash = ""
  await createStage1PersistenceService(
    baseDeps({
      createOrReuseInitialNeed: async (request) => {
        hash = request.inputHash
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "n",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  ).loadOrCreate({ userId: USER_ID })
  return hash
}

function recorder() {
  const events: string[] = []
  const laneInputs: unknown[] = []
  const creates: CreateInitialNeedRequest[] = []
  return { events, laneInputs, creates }
}

test("a plan whose initial differs from the facts hash goes through the lane, never createOrReuseInitialNeed", async () => {
  const rec = recorder()
  const reads: ExistingPlan[] = [
    plan(),
    plan({ needVersionId: "initial-2", outputSnapshot: { initial: 2 } }),
  ]
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => {
        rec.events.push("load")
        return reads.shift()!
      },
      syncPlanWithFacts: async (input) => {
        rec.events.push("lane")
        rec.laneInputs.push(input)
        return {
          status: "rebased",
          personalPlanId: "plan-1",
          initialNeedVersionId: "initial-2",
          refinedVersionId: null,
          activeRoutineVersionId: null,
        }
      },
      createOrReuseInitialNeed: async (request) => {
        rec.creates.push(request)
        throw new Error("the destructive initial-changed branch must not run")
      },
    }),
  )

  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "completed",
    personalPlanId: "plan-1",
    needVersionId: "initial-2",
    outputSnapshot: { initial: 2 },
  })
  assert.deepEqual(rec.events, ["load", "lane", "load"])
  assert.deepEqual(rec.laneInputs, [{ userId: USER_ID }])
  assert.equal(rec.creates.length, 0)
})

test("a lane that could not rebase leaves the old initial, which is returned without creating", async () => {
  const unavailable: SyncPlanWithFactsResult = {
    status: "unavailable",
    reason: "facts_not_computable",
    retryable: false,
  }
  for (const lane of [
    async () => unavailable,
    async (): Promise<SyncPlanWithFactsResult> => ({
      status: "unchanged",
      personalPlanId: "plan-1",
    }),
    async (): Promise<SyncPlanWithFactsResult> => {
      throw new Error("lane boom")
    },
  ] satisfies SyncPlanWithFacts[]) {
    let laneCalls = 0
    let creates = 0
    const service = createStage1PersistenceService(
      baseDeps({
        loadExistingPlan: async () => plan(),
        syncPlanWithFacts: async () => {
          laneCalls += 1
          return lane()
        },
        createOrReuseInitialNeed: async () => {
          creates += 1
          throw new Error("must not create")
        },
      }),
    )
    assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
      status: "completed",
      personalPlanId: "plan-1",
      needVersionId: "initial-1",
      outputSnapshot: { initial: 1 },
    })
    assert.equal(laneCalls, 1)
    assert.equal(creates, 0)
  }
})

test("without a lane dep a differing plan is still returned as is, never recreated", async () => {
  let creates = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => plan(),
      createOrReuseInitialNeed: async () => {
        creates += 1
        throw new Error("must not create")
      },
    }),
  )
  const result = await service.loadOrCreate({ userId: USER_ID })
  assert.equal(result.status, "completed")
  assert.equal(creates, 0)
})

test("an equal hash takes today's path: create is called, the lane is not", async () => {
  const hash = await currentHash()
  let laneCalls = 0
  let creates = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => plan({ inputHash: hash }),
      syncPlanWithFacts: async () => {
        laneCalls += 1
        return { status: "no_plan" }
      },
      createOrReuseInitialNeed: async (request) => {
        creates += 1
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "created-initial",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )
  const result = await service.loadOrCreate({ userId: USER_ID })
  assert.equal(result.status === "completed" && result.needVersionId, "created-initial")
  assert.equal(creates, 1)
  assert.equal(laneCalls, 0)
})

test("no plan yet takes today's path: create is called, the lane is not", async () => {
  let laneCalls = 0
  let creates = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => null,
      syncPlanWithFacts: async () => {
        laneCalls += 1
        return { status: "no_plan" }
      },
      createOrReuseInitialNeed: async (request) => {
        creates += 1
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "created-initial",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )
  assert.equal((await service.loadOrCreate({ userId: USER_ID })).status, "completed")
  assert.equal(creates, 1)
  assert.equal(laneCalls, 0)
})

test("a throwing loadExistingPlan is temporarily_unavailable and creates nothing", async () => {
  let creates = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => {
        throw new Error("database unavailable")
      },
      createOrReuseInitialNeed: async () => {
        creates += 1
        throw new Error("must not create")
      },
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "temporarily_unavailable",
  })
  assert.equal(creates, 0)
})

test("a failing re-read after the lane is temporarily_unavailable", async () => {
  let reads = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadExistingPlan: async () => {
        reads += 1
        if (reads > 1) throw new Error("database unavailable")
        return plan()
      },
      syncPlanWithFacts: async () => ({ status: "unchanged", personalPlanId: "plan-1" }),
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "temporarily_unavailable",
  })
})

// ---------------------------------------------------------------------------
// R07: the migration short-circuit returns before any source read
// ---------------------------------------------------------------------------

const MIGRATION_ENTITLEMENT: Partial<Stage1PersistenceDependencies> = {
  findEntitlement: async () => ({
    accessState: "active",
    enrollmentSourceId: "migration",
    sourceKind: "migration",
    qualifiedAt: "2026-01-01T00:00:00Z",
    artifactLeadId: "old-lead",
    quizSourceKind: "legacy",
  }),
  loadLegacyLead: async () => {
    throw new Error("must not re-read the old quiz")
  },
  createOrReuseInitialNeed: async () => {
    throw new Error("must not create")
  },
}

test("a migration-enrolled user with a plan syncs it first and returns the re-read plan", async () => {
  const events: string[] = []
  const reads = [
    {
      status: "completed" as const,
      personalPlanId: "plan",
      needVersionId: "original",
      outputSnapshot: { v: 1 },
    },
    {
      status: "completed" as const,
      personalPlanId: "plan",
      needVersionId: "rebased",
      outputSnapshot: { v: 2 },
    },
  ]
  const service = createStage1PersistenceService(
    baseDeps({
      ...MIGRATION_ENTITLEMENT,
      loadExistingMigrationPlan: async (owner, enrollment) => {
        assert.equal(owner, USER_ID)
        assert.equal(enrollment, "migration")
        events.push("load")
        return reads.shift()!
      },
      syncPlanWithFacts: async (input) => {
        assert.deepEqual(input, { userId: USER_ID })
        events.push("lane")
        return { status: "unchanged", personalPlanId: "plan" }
      },
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "completed",
    personalPlanId: "plan",
    needVersionId: "rebased",
    outputSnapshot: { v: 2 },
  })
  assert.deepEqual(events, ["load", "lane", "load"])
})

test("a migration user whose lane throws still gets the persisted plan", async () => {
  const persisted = {
    status: "completed" as const,
    personalPlanId: "plan",
    needVersionId: "original",
    outputSnapshot: { v: 1 },
  }
  const service = createStage1PersistenceService(
    baseDeps({
      ...MIGRATION_ENTITLEMENT,
      loadExistingMigrationPlan: async () => persisted,
      syncPlanWithFacts: async () => {
        throw new Error("lane boom")
      },
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), persisted)
})

test("a migration user without a plan keeps today's path and never calls the lane", async () => {
  let laneCalls = 0
  let creates = 0
  const service = createStage1PersistenceService(
    baseDeps({
      ...MIGRATION_ENTITLEMENT,
      loadExistingMigrationPlan: async () => null,
      loadLegacyLead: async () => ({
        id: "old-lead",
        quizAnswers: {
          structure: "wavy",
          thickness: "normal",
          density: "medium",
          hair_length: "medium",
          fingertest: "leicht_uneben",
          pulltest: "stretches_bounces",
          treatment: ["natur"],
          scalp_type: "ausgeglichen",
          has_scalp_issue: false,
          goals: ["moisture"],
          concerns: ["dryness"],
        },
      }),
      syncPlanWithFacts: async () => {
        laneCalls += 1
        return { status: "no_plan" }
      },
      createOrReuseInitialNeed: async (request) => {
        creates += 1
        return {
          outcome: "completed",
          personalPlanId: "plan",
          needVersionId: "created",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )
  assert.equal((await service.loadOrCreate({ userId: USER_ID })).status, "completed")
  assert.equal(creates, 1)
  assert.equal(laneCalls, 0)
})

test("a migration plan read failure stays temporarily_unavailable and never reaches the lane", async () => {
  let laneCalls = 0
  const service = createStage1PersistenceService(
    baseDeps({
      ...MIGRATION_ENTITLEMENT,
      loadExistingMigrationPlan: async () => {
        throw new Error("database unavailable")
      },
      syncPlanWithFacts: async () => {
        laneCalls += 1
        return { status: "no_plan" }
      },
    }),
  )
  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "temporarily_unavailable",
  })
  assert.equal(laneCalls, 0)
})
