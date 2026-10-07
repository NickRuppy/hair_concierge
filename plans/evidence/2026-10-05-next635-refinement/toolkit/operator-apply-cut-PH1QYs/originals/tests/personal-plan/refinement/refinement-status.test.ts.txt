import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRefinementStatusResponse,
  refinementStatusResponseSchema,
} from "@/lib/personal-plan/refinement/refinement-status"
import type { ModuleBannerDismissalState } from "@/lib/personal-plan/lifecycle/repository"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2ModuleProjections,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

/**
 * Pure derivation tests for the module-status API contract (Task 1.7): progress math,
 * the persisted Modul-1 handoff marker, and the banner's "next open module" + dismissal
 * wiring. Route-level wiring (auth, no-plan, real Supabase reads) lives in
 * tests/personal-plan-refinement-status-route.test.ts.
 */

const TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

const NO_DISMISSALS: ModuleBannerDismissalState = { dismissedModules: new Set() }

function dismissals(...modules: Array<"products" | "habits">): ModuleBannerDismissalState {
  return { dismissedModules: new Set(modules) }
}

test("a fresh plan with no draft: both modules open, progress 2/4, banner points at products", () => {
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: {},
      completedQuestionIds: [] as Stage2QuestionId[],
      answerProvenance: {},
    },
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })

  assert.equal(refinementStatusResponseSchema.safeParse(result).success, true)
  assert.deepEqual(
    result.modules.map((m) => [m.module, m.status]),
    [
      ["products", "open"],
      ["habits", "open"],
    ],
  )
  assert.ok(result.modules[0].openQuestionCount > 0)
  assert.deepEqual(result.progress, { completedSteps: 2, totalSteps: 4 })
  assert.equal(result.module1HandedOff, false)
  assert.deepEqual(result.banner, { visible: true, module: "products", dismissed: false })
})

test("partial products answers: products stays open with the correct open-question count", () => {
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: { currentProductCategories: ["shampoo"] },
      completedQuestionIds: ["current_product_categories"] as Stage2QuestionId[],
      answerProvenance: { current_product_categories: "user" },
    },
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })

  const products = result.modules.find((m) => m.module === "products")
  assert.equal(products?.status, "open")
  // products path here is [current_product_categories, wet_wash_frequency]; one answered.
  assert.equal(products?.openQuestionCount, 1)
  assert.deepEqual(result.progress, { completedSteps: 2, totalSteps: 4 })
})

test("products module complete via lineage: 3/4 and the handoff marker is surfaced", () => {
  const productsAnswers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "daily_1x",
  }
  const moduleProjections: Stage2ModuleProjections = {
    products: { needVersionId: "need-v2", projectedAtRevision: 1, stage3Handoff: true },
  }

  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: productsAnswers,
      completedQuestionIds: [
        "current_product_categories",
        "wet_wash_frequency",
      ] as Stage2QuestionId[],
      answerProvenance: { current_product_categories: "user", wet_wash_frequency: "user" },
    },
    moduleProjections,
    bannerDismissals: NO_DISMISSALS,
  })

  assert.equal(result.modules.find((m) => m.module === "products")?.status, "complete")
  assert.equal(result.modules.find((m) => m.module === "habits")?.status, "open")
  assert.deepEqual(result.progress, { completedSteps: 3, totalSteps: 4 })
  assert.equal(result.module1HandedOff, true)
  // The next open module is habits now, and it has never been dismissed.
  assert.deepEqual(result.banner, { visible: true, module: "habits", dismissed: false })
})

test("both modules complete: 4/4, no open module left, banner not visible", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "daily_1x",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const completedQuestionIds: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ]
  const moduleProjections: Stage2ModuleProjections = {
    products: { needVersionId: "need-v2", projectedAtRevision: 1, stage3Handoff: true },
    habits: { needVersionId: "need-v3", projectedAtRevision: 2, stage3Handoff: false },
  }

  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers,
      completedQuestionIds,
      answerProvenance: Object.fromEntries(completedQuestionIds.map((id) => [id, "user"])),
    },
    moduleProjections,
    bannerDismissals: NO_DISMISSALS,
  })

  assert.deepEqual(
    result.modules.map((m) => m.status),
    ["complete", "complete"],
  )
  assert.deepEqual(result.progress, { completedSteps: 4, totalSteps: 4 })
  assert.equal(result.module1HandedOff, true)
  assert.deepEqual(result.banner, { visible: false, module: null, dismissed: false })
})

test("assumed-only answers (no user provenance) count as open, matching direct-accept semantics", () => {
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: { currentProductCategories: ["shampoo"], wetWashFrequency: "daily_1x" },
      completedQuestionIds: [
        "current_product_categories",
        "wet_wash_frequency",
      ] as Stage2QuestionId[],
      answerProvenance: {
        current_product_categories: "assumed",
        wet_wash_frequency: "assumed",
      },
    },
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })

  assert.equal(result.modules.find((m) => m.module === "products")?.status, "open")
  assert.deepEqual(result.progress, { completedSteps: 2, totalSteps: 4 })
})

test("banner: dismissing the current open module hides it without affecting the module list", () => {
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: {},
      completedQuestionIds: [] as Stage2QuestionId[],
      answerProvenance: {},
    },
    moduleProjections: {},
    bannerDismissals: dismissals("products"),
  })

  assert.deepEqual(result.banner, { visible: false, module: "products", dismissed: true })
  assert.equal(result.modules.find((m) => m.module === "products")?.status, "open")
})

test("banner reappears once a different module becomes the next open one, even if the old dismissal is still stored", () => {
  const productsAnswers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "daily_1x",
  }
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: productsAnswers,
      completedQuestionIds: [
        "current_product_categories",
        "wet_wash_frequency",
      ] as Stage2QuestionId[],
      answerProvenance: { current_product_categories: "user", wet_wash_frequency: "user" },
    },
    moduleProjections: {
      products: { needVersionId: "need-v2", projectedAtRevision: 1, stage3Handoff: true },
    },
    // "products" was dismissed earlier, but it is no longer the open module.
    bannerDismissals: dismissals("products"),
  })

  assert.deepEqual(result.banner, { visible: true, module: "habits", dismissed: false })
})
