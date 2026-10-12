import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRefinementStatusFromModuleStates,
  buildRefinementStatusResponse,
  refinementStatusResponseSchema,
} from "@/lib/personal-plan/refinement/refinement-status"
import type { ModuleBannerDismissalState } from "@/lib/personal-plan/lifecycle/repository"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2Module,
  Stage2ModulePathState,
  Stage2ModuleStatus,
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

function dismissals(...modules: Stage2Module[]): ModuleBannerDismissalState {
  return { dismissedModules: new Set(modules) }
}

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

function pathState(status: Stage2ModuleStatus, openCount = 0): Stage2ModulePathState {
  return {
    questionIds: [],
    completedQuestionIds: [],
    openQuestionIds: Array.from({ length: openCount }, (_, i) => `heat:open_${i}` as never),
    status,
  }
}

function states(
  products: Stage2ModuleStatus,
  tools: Stage2ModuleStatus,
  habits: Stage2ModuleStatus,
): Record<Stage2Module, Stage2ModulePathState> {
  return {
    products: pathState(products, products === "open" ? 2 : 0),
    tools: pathState(tools, tools === "open" ? 3 : 0),
    habits: pathState(habits, habits === "open" ? 4 : 0),
  }
}

test("with tools not applicable the response lists three modules and the meter still reads x von 4", () => {
  const result = buildRefinementStatusResponse({
    moduleStatusInput: {
      triggerContext: TRIGGER_CONTEXT,
      answers: { currentProductCategories: ["shampoo"], wetWashFrequency: "daily_1x" },
      completedQuestionIds: [
        "current_product_categories",
        "wet_wash_frequency",
      ] as Stage2QuestionId[],
      answerProvenance: { current_product_categories: "user", wet_wash_frequency: "user" },
    },
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })

  assert.deepEqual(
    result.modules.map((entry) => [entry.module, entry.status]),
    [
      ["products", "complete"],
      ["tools", "not_applicable"],
      ["habits", "open"],
    ],
  )
  assert.equal(result.modules.find((m) => m.module === "tools")?.openQuestionCount, 0)
  assert.deepEqual(result.progress, { completedSteps: 3, totalSteps: 4 })
  assert.deepEqual(result.banner, { visible: true, module: "habits", dismissed: false })
})

test("an applicable tools module raises the meter to x von 5 and is asked between products and habits", () => {
  const open = buildRefinementStatusFromModuleStates({
    states: states("complete", "open", "open"),
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })
  assert.deepEqual(open.progress, { completedSteps: 3, totalSteps: 5 })
  assert.deepEqual(open.banner, { visible: true, module: "tools", dismissed: false })
  assert.equal(open.modules.find((m) => m.module === "tools")?.openQuestionCount, 3)

  const toolsDone = buildRefinementStatusFromModuleStates({
    states: states("complete", "complete", "open"),
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })
  assert.deepEqual(toolsDone.progress, { completedSteps: 4, totalSteps: 5 })
  assert.deepEqual(toolsDone.banner, { visible: true, module: "habits", dismissed: false })

  const allDone = buildRefinementStatusFromModuleStates({
    states: states("complete", "complete", "complete"),
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })
  assert.deepEqual(allDone.progress, { completedSteps: 5, totalSteps: 5 })
  assert.equal(allDone.banner.visible, false)
})

test("a not_applicable module is never the banner module and never counted", () => {
  const result = buildRefinementStatusFromModuleStates({
    states: states("complete", "not_applicable", "open"),
    moduleProjections: {},
    bannerDismissals: dismissals("tools"),
  })
  assert.deepEqual(result.banner, { visible: true, module: "habits", dismissed: false })
  assert.deepEqual(result.progress, { completedSteps: 3, totalSteps: 4 })

  const allDone = buildRefinementStatusFromModuleStates({
    states: states("complete", "not_applicable", "complete"),
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })
  assert.deepEqual(allDone.progress, { completedSteps: 4, totalSteps: 4 })
  assert.deepEqual(allDone.banner, { visible: false, module: null, dismissed: false })
})

test("the response schema accepts not_applicable and 4..5 steps only", () => {
  const base = buildRefinementStatusFromModuleStates({
    states: states("open", "not_applicable", "open"),
    moduleProjections: {},
    bannerDismissals: NO_DISMISSALS,
  })
  assert.ok(refinementStatusResponseSchema.safeParse(base).success)
  assert.ok(
    refinementStatusResponseSchema.safeParse({
      ...base,
      progress: { completedSteps: 2, totalSteps: 5 },
    }).success,
  )
  assert.ok(
    !refinementStatusResponseSchema.safeParse({
      ...base,
      progress: { completedSteps: 2, totalSteps: 6 },
    }).success,
  )
  assert.ok(
    !refinementStatusResponseSchema.safeParse({
      ...base,
      progress: { completedSteps: 2, totalSteps: 3 },
    }).success,
  )
  assert.ok(
    !refinementStatusResponseSchema.safeParse({ ...base, modules: base.modules.slice(1) }).success,
  )
})
