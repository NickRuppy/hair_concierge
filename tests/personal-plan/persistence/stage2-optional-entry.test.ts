import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOptionalStage2Seed,
  openOptionalRefinement,
  type OptionalStage2Context,
} from "@/lib/personal-plan/persistence/stage2-optional-entry"
import type { Stage2PersistedDraft } from "@/lib/personal-plan/persistence/stage2-refinement-service"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"

const triggerContext: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

function draft(overrides: Partial<Stage2PersistedDraft> = {}): Stage2PersistedDraft {
  return {
    id: "draft-parent",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    preparedArtifactSourceId: "lead-1",
    baseInputSnapshot: { source: "legacy" },
    pathVersion: "stage2-v1",
    triggerContext,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
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
    answerProvenance: {
      current_product_categories: "assumed",
      wet_wash_frequency: "assumed",
      towel_handling: "assumed",
      drying_routes: "assumed",
      additional_heat_tools: "assumed",
      night_protection: "assumed",
    },
    moduleProjections: {},
    revision: 0,
    status: "complete",
    refinedVersionId: "refined-1",
    ...overrides,
  }
}

function context(overrides: Partial<OptionalStage2Context> = {}): OptionalStage2Context {
  return {
    personalPlanId: "plan-1",
    currentInitialNeedVersionId: "initial-1",
    initial: {
      prepared_artifact_source_id: null,
      stage1_source_lead_id: "lead-1",
      input_snapshot: { source: "legacy" },
      output_snapshot: { status: "ready" },
    },
    currentDraft: null,
    latestCompleteDraft: draft(),
    legacyPrefillEligible: true,
    ...overrides,
  }
}

test("buildOptionalStage2Seed overlays trusted legacy facts as user provenance and keeps inherited defaults assumed", () => {
  const parent = draft()

  const seed = buildOptionalStage2Seed({
    parentDraft: parent,
    prefill: {
      mappingVersion: "legacy-prefill-v1",
      stage2Answers: {
        currentProductCategories: ["shampoo", "conditioner"],
        wetWashFrequency: "weekly_3_4x",
        towel: { material: "tshirt", technique: "gentle_press" },
      },
      exactInventory: [],
      productHints: [],
      sourceIds: ["usage-1"],
      sourceFingerprint: "legacy-prefill-v1:sha256:" + "a".repeat(64),
    },
  })

  assert.equal(seed.outcome, "applied")
  assert.deepEqual(seed.answers.currentProductCategories, ["shampoo", "conditioner"])
  assert.equal(seed.answers.wetWashFrequency, "weekly_3_4x")
  assert.deepEqual(seed.answers.towel, { material: "tshirt", technique: "gentle_press" })
  assert.deepEqual(seed.answerProvenance, {
    current_product_categories: "user",
    wet_wash_frequency: "user",
    towel_handling: "user",
    drying_routes: "assumed",
    additional_heat_tools: "assumed",
    night_protection: "assumed",
  })
})

test("buildOptionalStage2Seed consumes empty usable Stage2 mappings without converting a parent", () => {
  const seed = buildOptionalStage2Seed({
    parentDraft: draft(),
    prefill: {
      mappingVersion: "legacy-prefill-v1",
      stage2Answers: {},
      exactInventory: [],
      productHints: [],
      sourceIds: [],
      sourceFingerprint: "legacy-prefill-v1:sha256:" + "b".repeat(64),
    },
  })

  assert.equal(seed.outcome, "nothing_usable")
  assert.deepEqual(seed.answers, draft().answers)
  assert.deepEqual(seed.answerProvenance, draft().answerProvenance)
})

test("buildOptionalStage2Seed prunes a partial towel prefill from a parent that had complete assumed towel handling", () => {
  const seed = buildOptionalStage2Seed({
    parentDraft: draft(),
    prefill: {
      mappingVersion: "legacy-prefill-v1",
      stage2Answers: {
        towel: { material: "tshirt" },
      },
      exactInventory: [],
      productHints: [],
      sourceIds: ["profile"],
      sourceFingerprint: "legacy-prefill-v1:sha256:" + "c".repeat(64),
    },
  })

  assert.equal(seed.outcome, "applied")
  assert.deepEqual(seed.answers.towel, { material: "tshirt" })
  assert.equal(seed.completedQuestionIds.includes("towel_handling"), false)
  assert.equal(seed.answerProvenance.towel_handling, undefined)
})

test("openOptionalRefinement sends a prepared overlay only for a fully assumed completed parent", async () => {
  const opened = draft({ id: "draft-seeded", status: "in_progress", refinedVersionId: null })
  const calls: unknown[] = []

  const result = await openOptionalRefinement({
    userId: "user-1",
    module: "products",
    deps: {
      loadContext: async () => context(),
      loadLegacyPrefillInput: async () => ({
        profile: { shampooFrequency: "weekly_3_4x" },
        usageRows: [
          {
            id: "usage-1",
            category: "conditioner",
            productName: "Conditioner",
            frequencyRange: "weekly_2x",
          },
        ],
      }),
      openPreparedDraft: async (request) => {
        const { context: _context, ...publicRequest } = request
        calls.push(publicRequest)
        return opened
      },
    },
  })

  assert.equal(result.id, "draft-seeded")
  assert.equal(calls.length, 1)
  const { seed, ...request } = calls[0] as {
    seed: { sourceFingerprint: string } & Record<string, unknown>
  } & Record<string, unknown>
  const { sourceFingerprint, ...publicSeed } = seed
  assert.deepEqual(
    { ...request, seed: publicSeed },
    {
      userId: "user-1",
      module: "products",
      personalPlanId: "plan-1",
      baseInitialNeedVersionId: "initial-1",
      parentDraftId: "draft-parent",
      parentRevision: 0,
      seed: {
        outcome: "applied",
        answers: {
          currentProductCategories: ["conditioner"],
          wetWashFrequency: "weekly_3_4x",
          towel: { material: "mikrofaser", technique: "gentle_press" },
          dryingRoutes: ["air_dry"],
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
        answerProvenance: {
          current_product_categories: "user",
          wet_wash_frequency: "user",
          towel_handling: "assumed",
          drying_routes: "assumed",
          additional_heat_tools: "assumed",
          night_protection: "assumed",
        },
        sourceIds: ["usage-1"],
      },
    },
  )
  assert.match(sourceFingerprint, /^legacy-prefill-v1:sha256:[0-9a-f]{64}$/)
})

test("openOptionalRefinement lets an existing in-progress draft win without reading legacy rows", async () => {
  let legacyReads = 0
  const existing = draft({ id: "draft-open", status: "in_progress", refinedVersionId: null })
  const result = await openOptionalRefinement({
    userId: "user-1",
    module: "habits",
    deps: {
      loadContext: async () => context({ currentDraft: existing }),
      loadLegacyPrefillInput: async () => {
        legacyReads += 1
        return { profile: {}, usageRows: [] }
      },
      openPreparedDraft: async (request) => {
        assert.equal(request.parentDraftId, null)
        assert.equal(request.seed.outcome, "skipped_existing_state")
        return existing
      },
    },
  })

  assert.equal(result.id, "draft-open")
  assert.equal(legacyReads, 0)
})

test("openOptionalRefinement skips legacy reads for non-migration or unaccepted plans", async () => {
  const opened = draft({ id: "draft-normal-open", status: "in_progress", refinedVersionId: null })
  let openedRequest: unknown

  const result = await openOptionalRefinement({
    userId: "user-1",
    module: "products",
    deps: {
      loadContext: async () =>
        context({
          legacyPrefillEligible: false,
        }),
      loadLegacyPrefillInput: async () => {
        throw new Error("legacy rows should not be read for ineligible optional entry")
      },
      openPreparedDraft: async (request) => {
        const { context: _context, ...publicRequest } = request
        openedRequest = publicRequest
        return opened
      },
    },
  })

  assert.equal(result.id, "draft-normal-open")
  assert.deepEqual(openedRequest, {
    userId: "user-1",
    module: "products",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    parentDraftId: "draft-parent",
    parentRevision: 0,
    seed: {
      outcome: "skipped_existing_state",
      answers: {},
      completedQuestionIds: [],
      answerProvenance: {},
      sourceFingerprint: "legacy-prefill-v1:skipped",
      sourceIds: [],
    },
  })
})

test("openOptionalRefinement skips overlay when the completed parent has any user provenance", async () => {
  const userParent = draft({
    answerProvenance: {
      current_product_categories: "user",
      wet_wash_frequency: "assumed",
      towel_handling: "assumed",
      drying_routes: "assumed",
      additional_heat_tools: "assumed",
      night_protection: "assumed",
    },
  })
  let openedRequest: unknown

  await openOptionalRefinement({
    userId: "user-1",
    module: "products",
    deps: {
      loadContext: async () => context({ latestCompleteDraft: userParent }),
      loadLegacyPrefillInput: async () => {
        throw new Error("legacy rows should not be read for user-authored drafts")
      },
      openPreparedDraft: async (request) => {
        const { context: _context, ...publicRequest } = request
        openedRequest = publicRequest
        return userParent
      },
    },
  })

  assert.deepEqual(openedRequest, {
    userId: "user-1",
    module: "products",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    parentDraftId: "draft-parent",
    parentRevision: 0,
    seed: {
      outcome: "skipped_existing_state",
      answers: {},
      completedQuestionIds: [],
      answerProvenance: {},
      sourceFingerprint: "legacy-prefill-v1:skipped",
      sourceIds: [],
    },
  })
})
