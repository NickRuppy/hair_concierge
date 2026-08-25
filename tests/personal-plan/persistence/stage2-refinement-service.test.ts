import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementService,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"
import { createRefinedNeedSnapshot } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

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
})

test("Stage 2 service marks a saved answer's provenance as user", async () => {
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
    },
  })
  await service.load()
  await service.saveAnswer({
    questionId: "current_product_categories",
    answer: [],
    expectedRevision: 0,
  })
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
