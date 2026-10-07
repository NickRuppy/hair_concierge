import assert from "node:assert/strict"
import test from "node:test"

import {
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
    ...overrides,
  }
}

function storedDraft(value: Stage2PersistedDraft): Record<string, unknown> {
  return {
    id: value.id,
    personal_plan_id: value.personalPlanId,
    base_initial_need_version_id: value.baseInitialNeedVersionId,
    schema_version: value.schemaVersion,
    answers: value.answers,
    completed_question_ids: value.completedQuestionIds,
    answer_provenance: value.answerProvenance,
    module_projections: value.moduleProjections,
    revision: value.revision,
    status: value.status,
    result_refined_need_version_id: value.refinedVersionId,
  }
}

test("eligible fully-assumed complete parent opens with a skipped seed and no legacy reads", async () => {
  const reads: string[] = []
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []
  const parent = draft({ revision: 7 })
  const opened = draft({ id: "draft-opened", status: "in_progress", refinedVersionId: null })
  const client = {
    from(table: string) {
      reads.push(table)
      let status: unknown
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          if (key === "status") status = value
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          let data: unknown
          switch (table) {
            case "personal_plans":
              data = {
                id: "plan-1",
                current_initial_need_version_id: "initial-1",
                enrollment_purchase_source_id: "enrollment-1",
                active_routine_version_id: "routine-1",
                legacy_prefill_v1: null,
              }
              break
            case "personal_plan_need_versions":
              data = {
                id: "initial-1",
                ...context().initial,
                output_snapshot: {
                  renderedOrder: ["shampoo", "conditioner"],
                  decisions: [],
                  profile: { scalp: { concerns: [] } },
                },
              }
              break
            case "personal_plan_refinement_drafts":
              data = status === "complete" ? storedDraft(parent) : null
              break
            case "personal_plan_migration_enrollments":
              data = { id: "enrollment-1" }
              break
            case "hair_profiles":
              data = { shampoo_frequency: "weekly_3_4x" }
              break
            default:
              throw new Error(`unexpected read from ${table}`)
          }
          return { data, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args })
      return {
        data: { outcome: "skipped_existing_state", draft: storedDraft(opened) },
        error: null,
      }
    },
  }

  const result = await openOptionalRefinement({
    userId: "user-1",
    module: "products",
    client: client as never,
  })

  assert.deepEqual(
    reads.filter((table) => table === "hair_profiles" || table === "user_product_usage"),
    [],
    "optional refinement must not read hair_profiles or user_product_usage",
  )
  assert.equal(reads.includes("personal_plan_migration_enrollments"), false)
  assert.deepEqual(rpcCalls, [
    {
      name: "personal_plan_open_optional_refinement_v1",
      args: {
        p_user_id: "user-1",
        p_module: "products",
        p_expected_personal_plan_id: "plan-1",
        p_expected_base_initial_need_version_id: "initial-1",
        p_expected_parent_draft_id: "draft-parent",
        p_expected_parent_revision: 7,
        p_seed_outcome: "skipped_existing_state",
        p_seed_answers: {},
        p_seed_completed_question_ids: [],
        p_seed_answer_provenance: {},
        p_source_fingerprint: "legacy-prefill-v1:skipped",
        p_source_ids: [],
      },
    },
  ])
  assert.equal(result.id, opened.id)
})

const skippedSeed = {
  outcome: "skipped_existing_state",
  answers: {},
  completedQuestionIds: [],
  answerProvenance: {},
  sourceFingerprint: "legacy-prefill-v1:skipped",
  sourceIds: [],
}

test("openOptionalRefinement reuses an existing in-progress draft even without a complete parent", async () => {
  const existing = draft({ id: "draft-open", status: "in_progress", refinedVersionId: null })
  const result = await openOptionalRefinement({
    userId: "user-1",
    module: "habits",
    deps: {
      loadContext: async () => context({ currentDraft: existing, latestCompleteDraft: null }),
      openPreparedDraft: async (request) => {
        const { context: _context, ...publicRequest } = request
        assert.deepEqual(publicRequest, {
          userId: "user-1",
          module: "habits",
          personalPlanId: "plan-1",
          baseInitialNeedVersionId: "initial-1",
          parentDraftId: null,
          parentRevision: null,
          seed: skippedSeed,
        })
        return existing
      },
    },
  })

  assert.equal(result.id, "draft-open")
})

for (const provenance of ["assumed", "user"] as const) {
  test(`openOptionalRefinement clones a complete parent with ${provenance} provenance using a skipped seed`, async () => {
    const parent = draft({
      revision: 3,
      answerProvenance: {
        ...draft().answerProvenance,
        current_product_categories: provenance,
      },
    })
    const opened = draft({ id: "draft-cloned", status: "in_progress", refinedVersionId: null })
    const result = await openOptionalRefinement({
      userId: "user-1",
      module: "products",
      deps: {
        loadContext: async () => context({ latestCompleteDraft: parent }),
        openPreparedDraft: async (request) => {
          const { context: _context, ...publicRequest } = request
          assert.deepEqual(publicRequest, {
            userId: "user-1",
            module: "products",
            personalPlanId: "plan-1",
            baseInitialNeedVersionId: "initial-1",
            parentDraftId: "draft-parent",
            parentRevision: 3,
            seed: skippedSeed,
          })
          return opened
        },
      },
    })

    assert.equal(result.id, "draft-cloned")
  })
}

test("openOptionalRefinement rejects missing parent state without opening a draft", async () => {
  await assert.rejects(
    openOptionalRefinement({
      userId: "user-1",
      module: "products",
      deps: {
        loadContext: async () => context({ latestCompleteDraft: null }),
        openPreparedDraft: async () => {
          assert.fail("must not open a draft without current or complete state")
        },
      },
    }),
    /stage2_optional_parent_unavailable/,
  )
})
