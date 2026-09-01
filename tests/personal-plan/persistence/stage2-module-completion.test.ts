import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementService,
  type Stage2PersistedDraft,
  type Stage2RefinementPersistence,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { createRefinedNeedSnapshot } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2ModuleProjections,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

/**
 * Module completion projects a new refined Need version from a PARTIALLY
 * completed refinement draft: the user's own answers ∪ the typed resolver's
 * assumptions. The draft stays `in_progress`, so the second module can still be
 * answered later.
 *
 * The fake below mirrors `personal_plan_complete_stage2_module`
 * (supabase/migrations/20260825130000_personal_plan_complete_stage2_module.sql):
 * the module-lineage replay short-circuit, the revision CAS, the
 * `ON CONFLICT … DO NOTHING` + re-select hash-collision path, the staling of
 * active product drafts of the previous version, the advance of
 * `current_refined_need_version_id`, and the `refined_need` source-change
 * enqueue. The migration must not be applied to a remote DB, so this fake is
 * the highest fidelity available here; live verification is deferred.
 */

const TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

/** Section A answers, all answered by the user. */
const PRODUCTS_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "daily_1x",
}
const PRODUCTS_QUESTION_IDS: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
]

/** Section B answers, all answered by the user. */
const HABITS_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  towel: { material: "frottee", technique: "rough_rubbing" },
  dryingRoutes: ["air_dry"],
  additionalHeatTools: [],
  nightProtection: [],
}
const HABITS_QUESTION_IDS: Stage2QuestionId[] = [
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

function userProvenance(questionIds: readonly Stage2QuestionId[]): Stage2AnswerProvenance {
  const provenance: Stage2AnswerProvenance = {}
  for (const id of questionIds) provenance[id] = "user"
  return provenance
}

type ModuleCompletionCall = {
  module: string
  expectedRevision: number
  inputSnapshot: Record<string, unknown>
  outputSnapshot: Record<string, unknown>
  inputHash: string
}

function createModuleRefinementDb(seed: {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
  revision: number
}) {
  const row = {
    id: "draft-1",
    status: "in_progress" as Stage2PersistedDraft["status"],
    answers: structuredClone(seed.answers),
    completedQuestionIds: [...seed.completedQuestionIds],
    answerProvenance: { ...seed.answerProvenance },
    moduleProjections: {} as Stage2ModuleProjections,
    revision: seed.revision,
    resultRefinedNeedVersionId: null as string | null,
  }
  const needVersions: Array<{ id: string; inputHash: string }> = []
  const productDrafts: Array<{ id: string; status: string; refinedNeedVersionId: string }> = []
  const sourceChanges: Array<{ sourceKind: string; sourceKey: string }> = []
  const plan = {
    currentRefinedNeedVersionId: null as string | null,
    // Matches the draft's base_initial_need_version_id until Stage 1 recomputes.
    currentInitialNeedVersionId: "initial-1" as string | null,
  }
  const moduleCalls: ModuleCompletionCall[] = []
  const moduleOutcomes: string[] = []
  const completeCalls: Array<{ expectedRevision: number; inputHash: string }> = []
  let sequence = 0

  function toPersisted(): Stage2PersistedDraft {
    return {
      id: row.id,
      personalPlanId: "plan-1",
      baseInitialNeedVersionId: "initial-1",
      schemaVersion: 1,
      preparedArtifactSourceId: "artifact-1",
      baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
      pathVersion: "stage2-v1",
      triggerContext: TRIGGER_CONTEXT,
      answers: structuredClone(row.answers),
      completedQuestionIds: [...row.completedQuestionIds],
      answerProvenance: { ...row.answerProvenance },
      moduleProjections: structuredClone(row.moduleProjections),
      revision: row.revision,
      status: row.status,
      refinedVersionId: row.resultRefinedNeedVersionId,
    }
  }

  /** ON CONFLICT (personal_plan_id, parent_need_version_id, input_hash) DO NOTHING + re-select. */
  function upsertNeedVersion(inputHash: string): string {
    const existing = needVersions.find((candidate) => candidate.inputHash === inputHash)
    if (existing) return existing.id
    sequence += 1
    const created = { id: `refined-${sequence}`, inputHash }
    needVersions.push(created)
    return created.id
  }

  function advanceHead(needVersionId: string) {
    for (const productDraft of productDrafts) {
      if (productDraft.status === "active" && productDraft.refinedNeedVersionId !== needVersionId) {
        productDraft.status = "stale"
      }
    }
    plan.currentRefinedNeedVersionId = needVersionId
    sourceChanges.push({ sourceKind: "refined_need", sourceKey: needVersionId })
  }

  const persistence: Stage2RefinementPersistence = {
    async loadOrCreate() {
      return toPersisted()
    },
    async reopen() {
      throw new Error("unexpected reopen")
    },
    async save(input) {
      if (row.status !== "in_progress" || row.revision !== input.expectedRevision) {
        return { outcome: "revision_conflict", revision: row.revision }
      }
      row.answers = structuredClone(input.answers)
      row.completedQuestionIds = [...input.completedQuestionIds]
      row.answerProvenance = { ...input.answerProvenance }
      row.revision += 1
      return { outcome: "saved", revision: row.revision }
    },
    async complete(input) {
      completeCalls.push({ expectedRevision: input.expectedRevision, inputHash: input.inputHash })
      if (row.status === "complete") {
        return { outcome: "already_completed", refinedVersionId: row.resultRefinedNeedVersionId! }
      }
      if (row.status !== "in_progress" || row.revision !== input.expectedRevision) {
        return { outcome: "revision_conflict", revision: row.revision }
      }
      if (!/^[0-9a-f]{64}$/.test(input.inputHash)) throw new Error("invalid_refined_need")
      const needVersionId = upsertNeedVersion(input.inputHash)
      row.status = "complete"
      row.resultRefinedNeedVersionId = needVersionId
      advanceHead(needVersionId)
      return { outcome: "completed", refinedVersionId: needVersionId }
    },
    async completeModule(input) {
      moduleCalls.push({
        module: input.module,
        expectedRevision: input.expectedRevision,
        inputSnapshot: input.inputSnapshot,
        outputSnapshot: input.outputSnapshot,
        inputHash: input.inputHash,
      })
      // Guard order mirrors the SQL: a moved Stage-1 source invalidates every
      // recorded projection, so it is checked BEFORE the replay branch, and the
      // replay only fires for a still-open draft with a recorded version id.
      if (plan.currentInitialNeedVersionId !== input.draft.baseInitialNeedVersionId) {
        moduleOutcomes.push("stale_source")
        return { outcome: "stale_source" }
      }
      const projected = row.moduleProjections[input.module]
      if (
        projected &&
        row.status === "in_progress" &&
        projected.needVersionId !== undefined &&
        projected.projectedAtRevision === input.expectedRevision
      ) {
        moduleOutcomes.push("already_projected")
        return {
          outcome: "already_projected",
          refinedVersionId: projected.needVersionId,
          stage3Handoff: projected.stage3Handoff,
        }
      }
      if (row.status !== "in_progress" || row.revision !== input.expectedRevision) {
        moduleOutcomes.push("revision_conflict")
        return { outcome: "revision_conflict", revision: row.revision }
      }
      if (!/^[0-9a-f]{64}$/.test(input.inputHash)) throw new Error("invalid_refined_need")
      const needVersionId = upsertNeedVersion(input.inputHash)
      const stage3Handoff = input.module === "products"
      row.moduleProjections = {
        ...row.moduleProjections,
        [input.module]: {
          needVersionId,
          projectedAtRevision: row.revision,
          stage3Handoff,
        },
      }
      advanceHead(needVersionId)
      moduleOutcomes.push("completed")
      return { outcome: "completed", refinedVersionId: needVersionId, stage3Handoff }
    },
  }

  return {
    persistence,
    row,
    needVersions,
    productDrafts,
    sourceChanges,
    plan,
    moduleCalls,
    moduleOutcomes,
    completeCalls,
  }
}

function createService(db: ReturnType<typeof createModuleRefinementDb>) {
  return createStage2RefinementService({
    userId: "user-1",
    persistence: db.persistence,
    snapshotBuilder: (snapshotInput) =>
      createRefinedNeedSnapshot({ ...snapshotInput, createdAt: "2026-08-25T10:00:00.000Z" }),
  })
}

test("module completion projects a new refined version from user answers ∪ assumptions", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  db.productDrafts.push({ id: "product-1", status: "active", refinedNeedVersionId: "refined-old" })
  const service = createService(db)

  const result = await service.completeModule({ module: "products", expectedRevision: 2 })

  assert.equal(result.module, "products")
  assert.equal(result.status, "in_progress")
  assert.equal(result.stage3Handoff, true)
  assert.equal(result.nextHref, "/plan-start")
  assert.equal(db.needVersions.length, 1)
  assert.equal(result.refinedVersionId, db.needVersions[0]!.id)
  assert.equal(db.plan.currentRefinedNeedVersionId, result.refinedVersionId)
  assert.equal(db.sourceChanges.at(-1)!.sourceKind, "refined_need")
  assert.equal(
    db.productDrafts[0]!.status,
    "stale",
    "the Stage-3 draft of the previous version is staled (reconciliation is task 1.6)",
  )

  // The draft stays open and keeps ONLY the user's own answers: an assumption
  // must never harden into stored truth.
  assert.equal(db.row.status, "in_progress")
  assert.equal(db.row.revision, 2)
  assert.deepEqual(db.row.answers, PRODUCTS_ANSWERS)
  assert.deepEqual(db.row.completedQuestionIds, PRODUCTS_QUESTION_IDS)

  const projected = db.moduleCalls[0]!.inputSnapshot as {
    answers: PersonalPlanRefinementAnswersV1
    completedQuestionIds: Stage2QuestionId[]
  }
  assert.equal(projected.answers.wetWashFrequency, "daily_1x", "user answer survives")
  assert.deepEqual(
    projected.answers.towel,
    { material: "mikrofaser", technique: "gentle_press" },
    "the open habits question is filled by the resolver",
  )
  assert.deepEqual(projected.answers.dryingRoutes, ["air_dry"])
  assert.ok(projected.completedQuestionIds.includes("night_protection"))
})

test("products-first completion keeps assumption-only heat use unresolved", async () => {
  const db = createModuleRefinementDb({
    answers: {
      currentProductCategories: ["heat_protectant"],
      wetWashFrequency: "daily_1x",
    },
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const service = createService(db)

  await service.completeModule({ module: "products", expectedRevision: 2 })

  const projected = db.moduleCalls[0]!
  assert.equal(projected.inputSnapshot.habitsModuleUserComplete, false)
  const output =
    projected.outputSnapshot as import("@/lib/personal-plan/types").InitialNeedPlanSnapshot
  assert.deepEqual(output.profile.routine.heatToolUse, {
    state: "unknown",
    reason: "heat_tool_use",
  })
  assert.deepEqual(
    output.decisions.find((decision) => decision.category === "heat_protectant"),
    {
      category: "heat_protectant",
      resolution: "deferred_until_post_plan_onboarding",
      needTier: null,
      roles: [],
      target: {
        category: "heat_protectant",
        roles: [],
        qualifyingRoutes: [],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: ["heat_tool_use"],
    },
  )
})

test("products-first completion without owned heat protection preserves non-heat decisions", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const service = createService(db)

  await service.completeModule({ module: "products", expectedRevision: 2 })

  const projected = db.moduleCalls[0]!
  const projectedInput = projected.inputSnapshot as {
    answers: PersonalPlanRefinementAnswersV1
    completedQuestionIds: Stage2QuestionId[]
  }
  const legacyProjection = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: "initial-1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
    triggerContext: TRIGGER_CONTEXT,
    answers: projectedInput.answers,
    completedQuestionIds: projectedInput.completedQuestionIds,
    createdAt: "2026-08-25T10:00:00.000Z",
  })
  const output =
    projected.outputSnapshot as import("@/lib/personal-plan/types").InitialNeedPlanSnapshot

  assert.deepEqual(output.profile.routine.heatToolUse, { state: "known", value: [] })
  assert.deepEqual(output.decisions, legacyProjection.outputSnapshot.decisions)
  assert.deepEqual(output.coverage, legacyProjection.outputSnapshot.coverage)
})

test("module completion records the projection lineage and the Modul-1 handoff marker", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const service = createService(db)

  const result = await service.completeModule({ module: "products", expectedRevision: 2 })

  assert.deepEqual(db.row.moduleProjections, {
    products: {
      needVersionId: result.refinedVersionId,
      projectedAtRevision: 2,
      stage3Handoff: true,
    },
  })
  // The marker is readable again after a reload, so the Stage-3 entry survives
  // one even though the draft is still `in_progress`.
  const reloaded = await db.persistence.loadOrCreate("user-1")
  assert.equal(reloaded.moduleProjections.products?.stage3Handoff, true)
  assert.equal(reloaded.status, "in_progress")
})

test("habits-first module completion writes a version without a Stage-3 handoff marker", async () => {
  const db = createModuleRefinementDb({
    answers: HABITS_ANSWERS,
    completedQuestionIds: HABITS_QUESTION_IDS,
    answerProvenance: userProvenance(HABITS_QUESTION_IDS),
    revision: 4,
  })
  const service = createService(db)

  const result = await service.completeModule({ module: "habits", expectedRevision: 4 })

  assert.equal(result.status, "in_progress")
  assert.equal(result.stage3Handoff, false)
  assert.equal(db.needVersions.length, 1)
  assert.equal(db.row.moduleProjections.habits?.stage3Handoff, false)
  assert.equal(db.row.moduleProjections.products, undefined)

  const projected = db.moduleCalls[0]!.inputSnapshot as { answers: PersonalPlanRefinementAnswersV1 }
  assert.deepEqual(
    projected.answers.towel,
    { material: "frottee", technique: "rough_rubbing" },
    "user answer survives",
  )
  assert.deepEqual(
    projected.answers.currentProductCategories,
    [],
    "the open products question is filled by the resolver",
  )
})

test("a module whose questions are not all user-answered is rejected and writes nothing", async () => {
  const db = createModuleRefinementDb({
    answers: { currentProductCategories: [] },
    completedQuestionIds: ["current_product_categories"],
    answerProvenance: { current_product_categories: "user" },
    revision: 1,
  })
  const service = createService(db)

  await assert.rejects(
    () => service.completeModule({ module: "products", expectedRevision: 1 }),
    (error: { code?: string }) => error.code === "incomplete_refinement",
  )
  assert.equal(db.moduleCalls.length, 0)
  assert.equal(db.needVersions.length, 0)
  assert.deepEqual(db.row.moduleProjections, {})
})

test("an assumed answer never counts as the user having completed the module", async () => {
  const db = createModuleRefinementDb({
    // Auto-accept wrote every canonical answer synthetically.
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_QUESTION_IDS, ...HABITS_QUESTION_IDS],
    answerProvenance: {
      ...Object.fromEntries(
        [...PRODUCTS_QUESTION_IDS, ...HABITS_QUESTION_IDS].map((id) => [id, "assumed"]),
      ),
    } as Stage2AnswerProvenance,
    revision: 1,
  })
  const service = createService(db)

  await assert.rejects(
    () => service.completeModule({ module: "products", expectedRevision: 1 }),
    (error: { code?: string }) => error.code === "incomplete_refinement",
  )
  assert.equal(db.needVersions.length, 0)
})

test("replaying the same module completion returns the first result without a second version", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const service = createService(db)

  const first = await service.completeModule({ module: "products", expectedRevision: 2 })
  const replay = await service.completeModule({ module: "products", expectedRevision: 2 })

  assert.equal(replay.refinedVersionId, first.refinedVersionId)
  assert.equal(replay.stage3Handoff, true)
  assert.equal(replay.status, "in_progress")
  assert.deepEqual(db.moduleOutcomes, ["completed", "already_projected"])
  assert.equal(db.needVersions.length, 1, "a lost response must not write a second version")
  assert.equal(db.sourceChanges.length, 1)
})

test("a lost revision race maps to a typed revision conflict and writes nothing", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 5,
  })
  const service = createService(db)

  await assert.rejects(
    () => service.completeModule({ module: "products", expectedRevision: 4 }),
    (error: { code?: string }) => error.code === "revision_conflict",
  )
  assert.equal(db.needVersions.length, 0)
  assert.deepEqual(db.row.moduleProjections, {})
  assert.equal(db.plan.currentRefinedNeedVersionId, null)
})

test("a moved Stage-1 source maps to a reloadable conflict and writes nothing", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  // Stage 1 recomputed: the plan's initial need moved away from the draft's base.
  db.plan.currentInitialNeedVersionId = "initial-2"
  const service = createService(db)

  await assert.rejects(
    () => service.completeModule({ module: "products", expectedRevision: 2 }),
    (error: { code?: string; message?: string }) =>
      error.code === "revision_conflict" &&
      error.message === "The initial need changed; reload refinement",
  )
  assert.deepEqual(db.moduleOutcomes, ["stale_source"])
  assert.equal(db.needVersions.length, 0)
  assert.deepEqual(db.row.moduleProjections, {})
  assert.equal(db.plan.currentRefinedNeedVersionId, null)
})

test("a recorded projection is not replayed once the draft closed or its source moved", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const first = await createService(db).completeModule({ module: "products", expectedRevision: 2 })
  const replayInput = {
    userId: "user-1",
    draft: await db.persistence.loadOrCreate("user-1"),
    module: "products" as const,
    expectedRevision: 2,
    inputSnapshot: {},
    outputSnapshot: {},
    inputHash: "a".repeat(64),
    schemaVersion: 1,
    computationVersion: "test",
  }

  // The draft closed in the meantime (full completion, staling): a replay must
  // reload rather than receive a success for a version that is no longer the draft's.
  db.row.status = "complete"
  assert.deepEqual(await db.persistence.completeModule(replayInput), {
    outcome: "revision_conflict",
    revision: 2,
  })

  // The Stage-1 source moved: the recorded version no longer descends from it.
  db.row.status = "in_progress"
  db.plan.currentInitialNeedVersionId = "initial-2"
  assert.deepEqual(await db.persistence.completeModule(replayInput), { outcome: "stale_source" })

  assert.equal(db.needVersions.length, 1)
  assert.equal(db.row.moduleProjections.products?.needVersionId, first.refinedVersionId)
})

test("completing the second module closes the draft exactly like today's full completion", async () => {
  const seed = {
    answers: { ...PRODUCTS_ANSWERS, ...HABITS_ANSWERS },
    completedQuestionIds: [...PRODUCTS_QUESTION_IDS, ...HABITS_QUESTION_IDS],
    answerProvenance: userProvenance([...PRODUCTS_QUESTION_IDS, ...HABITS_QUESTION_IDS]),
    revision: 6,
  }
  const db = createModuleRefinementDb(seed)
  const service = createService(db)

  const result = await service.completeModule({ module: "habits", expectedRevision: 6 })

  assert.equal(result.status, "complete")
  assert.equal(result.nextHref, "/plan-start")
  assert.equal(db.row.status, "complete")
  assert.equal(db.row.resultRefinedNeedVersionId, result.refinedVersionId)
  assert.equal(db.plan.currentRefinedNeedVersionId, result.refinedVersionId)
  assert.equal(db.moduleCalls.length, 0, "the closing module runs through the full completion RPC")
  assert.equal(db.completeCalls.length, 1)

  // Byte-identical to today's full completion: same computed input hash.
  const reference = createModuleRefinementDb(seed)
  const referenceHandoff = await createService(reference).complete({ expectedRevision: 6 })
  assert.equal(db.completeCalls[0]!.inputHash, reference.completeCalls[0]!.inputHash)
  assert.deepEqual(
    { refinedVersionId: result.refinedVersionId, nextHref: result.nextHref },
    referenceHandoff,
  )
})

test("a rejected module id fails before any persistence call", async () => {
  const db = createModuleRefinementDb({
    answers: PRODUCTS_ANSWERS,
    completedQuestionIds: PRODUCTS_QUESTION_IDS,
    answerProvenance: userProvenance(PRODUCTS_QUESTION_IDS),
    revision: 2,
  })
  const service = createService(db)

  await assert.rejects(
    () => service.completeModule({ module: "colour", expectedRevision: 2 }),
    (error: { code?: string }) => error.code === "completion_failed",
  )
  assert.equal(db.moduleCalls.length, 0)
  assert.equal(db.needVersions.length, 0)
})
