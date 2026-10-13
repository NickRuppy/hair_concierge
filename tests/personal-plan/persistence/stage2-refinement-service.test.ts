import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementService,
  loadExistingStage2RefinementSession,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { mapDraft } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { stage2ModuleStates } from "@/lib/personal-plan/refinement/module-status"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"
import { createRefinedNeedSnapshot } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

/** Module completion is exercised in stage2-module-completion.test.ts. */
const notCalled = async (): Promise<never> => {
  throw new Error("unexpected persistence call")
}

const context: Stage2TriggerContext = {
  relevantCategories: ["shampoo"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

function draft(overrides: Partial<Stage2PersistedDraft> = {}): Stage2PersistedDraft {
  return {
    id: "draft-1",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
    triggerContext: context,
    answers: {},
    completedQuestionIds: [],
    answerProvenance: {},
    moduleProjections: {},
    revision: 0,
    status: "in_progress",
    refinedVersionId: null,
    ...overrides,
  }
}

test("Stage 2 service prunes server-side and persists the canonical next revision", async () => {
  let saved: unknown
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => draft(),
      reopen: async ({ draft: current }) => ({
        ...current,
        status: "in_progress",
        refinedVersionId: null,
      }),
      save: async (input) => {
        saved = input
        return { outcome: "saved" as const, revision: 1 }
      },
      complete: async () => ({ outcome: "completed" as const, refinedVersionId: "refined-1" }),
      completeModule: notCalled,
    },
  })
  await service.load()
  const session = await service.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
  assert.equal(session.revision, 1)
  assert.deepEqual(
    (saved as { answers: { currentProductCategories?: string[] } }).answers
      .currentProductCategories,
    [],
  )
  assert.deepEqual((saved as { answerProvenance: Record<string, string> }).answerProvenance, {
    current_product_categories: "user",
  })
})

test("Stage 2 service flips an existing assumed answer to user when the user re-answers it", async () => {
  let saved: unknown
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () =>
        draft({
          answers: { wetWashFrequency: "weekly_2x", currentProductCategories: [] },
          completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
          answerProvenance: {
            current_product_categories: "assumed",
            wet_wash_frequency: "assumed",
          },
          revision: 1,
        }),
      reopen: async ({ draft: current }) => ({
        ...current,
        status: "in_progress",
        refinedVersionId: null,
      }),
      save: async (input) => {
        saved = input
        return { outcome: "saved" as const, revision: 2 }
      },
      complete: async () => ({ outcome: "completed" as const, refinedVersionId: "refined-1" }),
      completeModule: notCalled,
    },
  })
  await service.load()
  await service.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "daily_1x",
    expectedRevision: 1,
  })
  assert.deepEqual((saved as { answerProvenance: Record<string, string> }).answerProvenance, {
    current_product_categories: "assumed",
    wet_wash_frequency: "user",
  })
})

test("Stage 2 service prunes provenance for ids a path change dropped from completion", async () => {
  let saved: unknown
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () =>
        draft({
          answers: {
            currentProductCategories: ["dry_shampoo"],
            dryShampooVisibleHairColor: "brown",
          },
          completedQuestionIds: ["current_product_categories", "dry_shampoo_visible_hair_color"],
          answerProvenance: {
            current_product_categories: "assumed",
            dry_shampoo_visible_hair_color: "assumed",
          },
          revision: 1,
        }),
      reopen: async ({ draft: current }) => ({
        ...current,
        status: "in_progress",
        refinedVersionId: null,
      }),
      save: async (input) => {
        saved = input
        return { outcome: "saved" as const, revision: 2 }
      },
      complete: async () => ({ outcome: "completed" as const, refinedVersionId: "refined-1" }),
      completeModule: notCalled,
    },
  })
  await service.load()
  // Switching away from dry shampoo drops dry_shampoo_visible_hair_color
  // from the canonical path, so its provenance entry must be pruned too.
  await service.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 1,
  })
  assert.deepEqual((saved as { answerProvenance: Record<string, string> }).answerProvenance, {
    current_product_categories: "user",
  })
})

test("Stage 2 service maps CAS loss to a typed reloadable revision conflict", async () => {
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => draft(),
      reopen: async ({ draft: current }) => ({
        ...current,
        status: "in_progress",
        refinedVersionId: null,
      }),
      save: async () => ({ outcome: "revision_conflict" as const, revision: 4 }),
      complete: async () => ({ outcome: "completed" as const, refinedVersionId: "refined-1" }),
      completeModule: notCalled,
    },
  })
  await service.load()
  await assert.rejects(
    () =>
      service.saveAnswer({
        questionId: "current_product_categories",
        answer: [],
        expectedRevision: 0,
      }),
    (error: { code?: string }) => error.code === "revision_conflict",
  )
})

test("Stage 2 service refuses completion before the authoritative path is complete", async () => {
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => draft(),
      reopen: async ({ draft: current }) => ({
        ...current,
        status: "in_progress",
        refinedVersionId: null,
      }),
      save: async () => ({ outcome: "saved" as const, revision: 1 }),
      complete: async () => ({ outcome: "completed" as const, refinedVersionId: "refined-1" }),
      completeModule: notCalled,
    },
  })
  await assert.rejects(
    () => service.complete({ expectedRevision: 0 }),
    (error: { code?: string }) => error.code === "incomplete_refinement",
  )
})

test("Stage 2 re-edit creates an in-progress successor without rewriting completed history", async () => {
  const completed = draft({
    status: "complete",
    revision: 6,
    refinedVersionId: "refined-1",
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
  })
  let reopened = false
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => completed,
      reopen: async ({ draft: historical }) => {
        reopened = true
        assert.equal(historical.status, "complete")
        return { ...historical, id: "draft-2", status: "in_progress", refinedVersionId: null }
      },
      save: async ({ draft: successor }) => ({
        outcome: "saved",
        revision: successor.revision + 1,
      }),
      complete: async () => ({ outcome: "completed", refinedVersionId: "refined-2" }),
      completeModule: notCalled,
    },
  })

  await service.load()
  const edited = await service.saveAnswer({
    questionId: "night_protection",
    answer: ["loose_tied"],
    expectedRevision: 6,
  })
  assert.equal(reopened, true)
  assert.equal(edited.status, "in_progress")
  assert.equal(edited.revision, 7)
})

test("a complete draft whose path grew loads as complete and reopens on the first save", async () => {
  // `night_protection` stands in for a question that joined the path after completion.
  const grown = draft({
    status: "complete",
    revision: 6,
    refinedVersionId: "refined-1",
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
    ],
  })
  let reopened = 0
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => grown,
      reopen: async ({ draft: historical }) => {
        reopened += 1
        assert.equal(historical.status, "complete")
        return { ...historical, id: "draft-2", status: "in_progress", refinedVersionId: null }
      },
      save: async ({ draft: successor }) => ({
        outcome: "saved",
        revision: successor.revision + 1,
      }),
      complete: notCalled,
      completeModule: notCalled,
    },
  })

  const loaded = await service.load()
  assert.equal(loaded.status, "complete")
  assert.equal(loaded.path.firstUnresolvedQuestionId, "night_protection")
  assert.equal(reopened, 0)

  const edited = await service.saveAnswer({
    questionId: "night_protection",
    answer: ["loose_tied"],
    expectedRevision: 6,
  })
  assert.equal(reopened, 1)
  assert.equal(edited.status, "in_progress")
  assert.equal(edited.revision, 7)
  assert.equal(edited.path.firstUnresolvedQuestionId, null)
})

test("Stage 2 completion recomputes the refined Need snapshot from the immutable initial input", () => {
  const completedAnswers = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_1x" as const,
    towel: { material: "no_towel" as const },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const completedQuestionIds = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ] as const

  const result = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: "initial-1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
    triggerContext: context,
    answers: completedAnswers,
    completedQuestionIds,
    createdAt: "2026-08-08T10:00:00.000Z",
  })

  assert.equal(result.outputSnapshot.profile.source.projection, "refined_post_plan")
  assert.ok(result.outputSnapshot.decisions.length > 0)
  assert.match(result.inputHash, /^[a-f0-9]{64}$/)
})

/* ── S4: drafts that finished before the Bondbuilder question existed ────── */

const bondbuilderContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "bondbuilder"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}
const PRE_S4_COMPLETE = {
  answers: {
    currentProductCategories: [],
    wetWashFrequency: "weekly_1x" as const,
    towel: { material: "no_towel" as const },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  },
  completedQuestionIds: [
    "current_product_categories" as const,
    "wet_wash_frequency" as const,
    "towel_handling" as const,
    "drying_routes" as const,
    "additional_heat_tools" as const,
    "night_protection" as const,
  ],
}

test("a complete pre-S4 draft with a Bondbuilder need loads, module stays complete, answer assumed", async () => {
  const stored = draft({
    status: "complete",
    revision: 6,
    refinedVersionId: "refined-1",
    triggerContext: bondbuilderContext,
    ...PRE_S4_COMPLETE,
    answerProvenance: Object.fromEntries(
      PRE_S4_COMPLETE.completedQuestionIds.map((id) => [id, "user" as const]),
    ),
  })
  const persistence = {
    loadOrCreate: async () => stored,
    loadExisting: async () => stored,
    reopen: notCalled,
    save: notCalled,
    complete: notCalled,
    completeModule: notCalled,
  }
  const service = createStage2RefinementService({
    userId: "user-1",
    snapshotBuilder: () => {
      throw new Error("unexpected snapshot")
    },
    persistence,
  })

  for (const session of [
    await service.load(),
    await loadExistingStage2RefinementSession({ userId: "user-1", persistence }),
  ]) {
    assert.ok(session)
    assert.equal(session.status, "complete")
    assert.equal(session.path.firstUnresolvedQuestionId, null)
    assert.equal(session.answers.bondbuilderTiming, "no_preference")
    assert.ok(session.completedQuestionIds.includes("bondbuilder_timing"))
  }
})

test("mapDraft normalizes a persisted pre-S4 row; module status stays complete", () => {
  const mapped = mapDraft(
    {
      id: "draft-1",
      personal_plan_id: "plan-1",
      base_initial_need_version_id: "initial-1",
      schema_version: 1,
      answers: PRE_S4_COMPLETE.answers,
      completed_question_ids: PRE_S4_COMPLETE.completedQuestionIds,
      answer_provenance: {},
      module_projections: {},
      revision: 4,
      status: "complete",
      result_refined_need_version_id: "refined-1",
    },
    bondbuilderContext,
    { prepared_artifact_source_id: "artifact-1", input_snapshot: COMPLETE_V3_PLAN_ENVELOPE },
  )
  assert.equal(mapped.answers.bondbuilderTiming, "no_preference")
  assert.equal(mapped.answerProvenance.bondbuilder_timing, "assumed")
  assert.ok(mapped.completedQuestionIds.includes("bondbuilder_timing"))
  const states = stage2ModuleStates(mapped)
  assert.equal(states.products.status, "complete")
  assert.equal(states.habits.status, "complete")
})
