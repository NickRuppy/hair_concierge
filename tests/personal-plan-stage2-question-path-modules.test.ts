import assert from "node:assert/strict"
import test from "node:test"

import { createStage2HeatEventId } from "../src/lib/personal-plan/refinement/heat-events"
import {
  getOrderedQuestionIds,
  getStage2ModulePathStates,
  getStage2QuestionModule,
  resolveStage2Path,
} from "../src/lib/personal-plan/refinement/question-path"
import {
  STAGE2_HEAT_EVENT_SOURCES,
  STAGE2_MODULES,
  type Stage2QuestionId,
  type Stage2StaticQuestionId,
} from "../src/lib/personal-plan/refinement/types"

const neutralContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

const ALL_STATIC_QUESTION_IDS: Stage2StaticQuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "scalp_irritation_detail",
  "dry_shampoo_bridge_preference",
  "dry_shampoo_visible_hair_color",
  "oil_purposes",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

test("every base question on a minimal path maps to a module and all three modules are present", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: [] },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)

  assert.deepEqual(modules.products.questionIds, [
    "current_product_categories",
    "wet_wash_frequency",
  ])
  assert.deepEqual(modules.habits.questionIds, [
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ])
  for (const id of path.orderedQuestionIds) {
    assert.ok(["products", "habits"].includes(getStage2QuestionModule(id)))
  }
  // No tool question is on the path yet: the module exists but has nothing to ask.
  assert.deepEqual(modules.tools.questionIds, [])
  assert.equal(modules.tools.status, "not_applicable")
})

test("tools question ids map to the tools module and never throw", () => {
  assert.equal(getStage2QuestionModule("tools_overview"), "tools")
  assert.equal(getStage2QuestionModule("tools:wash_application:1"), "tools")
  assert.equal(getStage2QuestionModule("tools:securing_sectioning:2"), "tools")
  // Neighbouring ids keep their module.
  assert.equal(getStage2QuestionModule("towel_handling"), "habits")
  assert.equal(getStage2QuestionModule("heat:straightener"), "habits")
})

test("STAGE2_MODULES is ordered products, tools, habits", () => {
  assert.deepEqual([...STAGE2_MODULES], ["products", "tools", "habits"])
})

test("a module with zero path questions is not_applicable; one with questions is open/complete", () => {
  const states = getStage2ModulePathStates(["current_product_categories", "night_protection"], [])
  assert.equal(states.tools.status, "not_applicable")
  assert.equal(states.products.status, "open")
  assert.equal(states.habits.status, "open")

  const withTools = getStage2ModulePathStates(
    ["current_product_categories", "tools_overview", "tools:airflow:1", "night_protection"],
    ["tools_overview", "tools:airflow:1"],
  )
  assert.deepEqual(withTools.tools.questionIds, ["tools_overview", "tools:airflow:1"])
  assert.equal(withTools.tools.status, "complete")

  const partial = getStage2ModulePathStates(
    ["tools_overview", "tools:airflow:1"],
    ["tools_overview"],
  )
  assert.deepEqual(partial.tools.openQuestionIds, ["tools:airflow:1"])
  assert.equal(partial.tools.status, "open")
  // A module with no questions of its own is not_applicable, never "complete".
  assert.equal(partial.products.status, "not_applicable")
  assert.equal(partial.habits.status, "not_applicable")
})

test("oil conditional question belongs to the products module", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: ["oil"] },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  assert.ok(path.orderedQuestionIds.includes("oil_purposes"))
  assert.ok(modules.products.questionIds.includes("oil_purposes"))
  assert.ok(!modules.habits.questionIds.includes("oil_purposes"))
})

test("dry-shampoo conditional questions belong to the products module", () => {
  const path = resolveStage2Path({
    triggerContext: { ...neutralContext, dryShampooBridgeEligibility: "eligible" },
    answers: { currentProductCategories: [], dryShampooBridgePreference: "accept" },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  assert.ok(path.orderedQuestionIds.includes("dry_shampoo_bridge_preference"))
  assert.ok(path.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"))
  assert.ok(modules.products.questionIds.includes("dry_shampoo_bridge_preference"))
  assert.ok(modules.products.questionIds.includes("dry_shampoo_visible_hair_color"))
})

test("scalp conditional question belongs to the products module", () => {
  const path = resolveStage2Path({
    triggerContext: { ...neutralContext, hasReportedIrritatedScalp: true },
    answers: { currentProductCategories: [] },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  assert.ok(path.orderedQuestionIds.includes("scalp_irritation_detail"))
  assert.ok(modules.products.questionIds.includes("scalp_irritation_detail"))
})

test("zero heat events: habits module has no derived heat ids, still includes night protection", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: [], dryingRoutes: [], additionalHeatTools: [] },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  assert.ok(!modules.habits.questionIds.some((id) => id.startsWith("heat:")))
  assert.ok(modules.habits.questionIds.includes("night_protection"))
})

test("multiple heat events: each derived heat id belongs to habits, in path order", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: {
      currentProductCategories: [],
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: ["straightener"],
    },
    completedQuestionIds: [],
  })
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  const expectedHeatIds = [
    createStage2HeatEventId("ordinary_blow_dry"),
    createStage2HeatEventId("diffuser_airflow_shaping"),
    createStage2HeatEventId("straightener"),
  ]
  const habitsHeatIds = modules.habits.questionIds.filter((id) => id.startsWith("heat:"))
  assert.deepEqual(habitsHeatIds, expectedHeatIds)
  assert.deepEqual(
    habitsHeatIds,
    path.orderedQuestionIds.filter((id) => id.startsWith("heat:")),
  )
  assert.ok(modules.habits.questionIds.includes("night_protection"))
})

test("module status is open while a current-path question is unanswered, complete once all are", () => {
  const partial = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: [] },
    completedQuestionIds: ["current_product_categories"],
  })
  const partialModules = getStage2ModulePathStates(
    partial.orderedQuestionIds,
    partial.completedQuestionIds,
  )
  assert.equal(partialModules.products.status, "open")

  const full = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: [], wetWashFrequency: "does_not_wash" },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
  })
  const fullModules = getStage2ModulePathStates(full.orderedQuestionIds, full.completedQuestionIds)
  assert.equal(fullModules.products.status, "complete")
  // Habits questions were never answered in this fixture, so the other module stays open.
  assert.equal(fullModules.habits.status, "open")
})

test("an invalid marked-complete answer does not count toward module completion", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { currentProductCategories: ["unsupported" as never] },
    completedQuestionIds: ["current_product_categories"],
  })
  assert.ok(!path.completedQuestionIds.includes("current_product_categories"))
  const modules = getStage2ModulePathStates(path.orderedQuestionIds, path.completedQuestionIds)
  assert.ok(modules.products.openQuestionIds.includes("current_product_categories"))
  assert.equal(modules.products.status, "open")
})

test("totality: every canonical question id the path can produce has a module, and unmapped ids fail loudly", () => {
  const seenIds = new Set<Stage2QuestionId>()
  const record = (ids: Stage2QuestionId[]) => {
    for (const id of ids) {
      seenIds.add(id)
      assert.doesNotThrow(() => getStage2QuestionModule(id))
    }
  }

  record(getOrderedQuestionIds(neutralContext, { currentProductCategories: [] }))
  record(
    getOrderedQuestionIds(
      { ...neutralContext, hasReportedIrritatedScalp: true },
      { currentProductCategories: [] },
    ),
  )
  record(
    getOrderedQuestionIds(
      { ...neutralContext, dryShampooBridgeEligibility: "eligible" },
      { currentProductCategories: [], dryShampooBridgePreference: "accept" },
    ),
  )
  record(getOrderedQuestionIds(neutralContext, { currentProductCategories: ["dry_shampoo"] }))
  record(getOrderedQuestionIds(neutralContext, { currentProductCategories: ["oil"] }))
  record(
    getOrderedQuestionIds(neutralContext, {
      currentProductCategories: [],
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: [
        "dryer_brush",
        "hot_air_styler",
        "straightener",
        "curling_or_wave_iron",
        "thermal_rollers",
      ],
    }),
  )

  for (const id of ALL_STATIC_QUESTION_IDS) assert.ok(seenIds.has(id), `missing static id ${id}`)
  for (const source of STAGE2_HEAT_EVENT_SOURCES) {
    assert.ok(seenIds.has(createStage2HeatEventId(source)), `missing heat id for ${source}`)
  }

  assert.throws(() => getStage2QuestionModule("not_a_real_question_id" as Stage2QuestionId))
})
