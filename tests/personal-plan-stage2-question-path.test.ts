import assert from "node:assert/strict"
import test from "node:test"

import {
  pruneStage2Answers,
  getEffectiveDryShampooBridgePreference,
  resolveStage2Path,
  resolveStage2RefinementContract,
  validateStage2Answers,
} from "../src/lib/personal-plan/refinement/question-path"

const neutralContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

test("unknown bridge eligibility suppresses and prunes stale bridge answers", () => {
  const path = resolveStage2Path({
    triggerContext: { ...neutralContext, dryShampooBridgeEligibility: "unknown" },
    answers: {
      currentProductCategories: [],
      dryShampooBridgePreference: "accept",
      dryShampooVisibleHairColor: "dark",
    },
    completedQuestionIds: ["dry_shampoo_bridge_preference", "dry_shampoo_visible_hair_color"],
  })

  assert.equal(path.orderedQuestionIds.includes("dry_shampoo_bridge_preference"), false)
  assert.equal(path.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"), false)
  assert.deepEqual(path.prunedAnswerKeys, [
    "dryShampooBridgePreference",
    "dryShampooVisibleHairColor",
  ])
})

test("Dry Shampoo branches distinguish existing use, accepted bridge, and decline", () => {
  const existing = resolveStage2Path({
    triggerContext: { ...neutralContext, dryShampooBridgeEligibility: "eligible" },
    answers: { currentProductCategories: ["dry_shampoo"] },
    completedQuestionIds: [],
  })
  assert.equal(existing.orderedQuestionIds.includes("dry_shampoo_bridge_preference"), false)
  assert.equal(existing.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"), true)
  assert.equal(
    getEffectiveDryShampooBridgePreference({ currentProductCategories: ["dry_shampoo"] }),
    "accept",
  )

  const accepted = resolveStage2Path({
    triggerContext: { ...neutralContext, dryShampooBridgeEligibility: "eligible" },
    answers: { currentProductCategories: [], dryShampooBridgePreference: "accept" },
    completedQuestionIds: [],
  })
  assert.equal(accepted.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"), true)

  const declined = resolveStage2Path({
    triggerContext: { ...neutralContext, dryShampooBridgeEligibility: "eligible" },
    answers: {
      currentProductCategories: [],
      dryShampooBridgePreference: "decline",
      dryShampooVisibleHairColor: "dark",
    },
    completedQuestionIds: [],
  })
  assert.equal(declined.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"), false)
  assert.deepEqual(declined.prunedAnswerKeys, ["dryShampooVisibleHairColor"])
})

test("ineligible bridge omits both bridge pages while an irritated quiz requires clarification", () => {
  const path = resolveStage2Path({
    triggerContext: {
      ...neutralContext,
      hasReportedIrritatedScalp: true,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: { currentProductCategories: [] },
    completedQuestionIds: [],
  })
  assert.deepEqual(path.orderedQuestionIds.slice(0, 3), [
    "current_product_categories",
    "wet_wash_frequency",
    "scalp_irritation_detail",
  ])
  assert.equal(path.orderedQuestionIds.includes("dry_shampoo_bridge_preference"), false)
  assert.equal(path.orderedQuestionIds.includes("dry_shampoo_visible_hair_color"), false)
})

test("conditional parent edits prune only stale descendants", () => {
  const pruned = pruneStage2Answers({
    triggerContext: { ...neutralContext, hasReportedIrritatedScalp: false },
    answers: {
      currentProductCategories: [],
      oilPurposes: ["dry_finish"],
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      towel: { material: "no_towel", technique: "gentle_press" },
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: [],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    },
    completedQuestionIds: [
      "oil_purposes",
      "scalp_irritation_detail",
      "heat:straightener",
      "towel_handling",
    ],
  })
  assert.deepEqual(pruned.answers, {
    currentProductCategories: [],
    towel: { material: "no_towel" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
  })
  assert.deepEqual(pruned.completedQuestionIds, ["towel_handling"])
  assert.deepEqual(pruned.prunedAnswerKeys, [
    "scalpIrritationDetail",
    "oilPurposes",
    "towel",
    "heatEvents",
  ])
})

test("path inserts irritation, Oil and separately ordered heat questions without changing base order", () => {
  const path = resolveStage2Path({
    triggerContext: { ...neutralContext, hasReportedIrritatedScalp: true },
    answers: {
      currentProductCategories: ["oil"],
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: ["dryer_brush", "straightener"],
    },
    completedQuestionIds: [],
  })
  assert.deepEqual(path.orderedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "scalp_irritation_detail",
    "oil_purposes",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "heat:ordinary_blow_dry",
    "heat:diffuser_airflow_shaping",
    "heat:dryer_brush",
    "heat:straightener",
    "night_protection",
  ])
})

test("completion distinguishes completed empty multi-select pages from unanswered and validates values", () => {
  const answers = {
    currentProductCategories: [],
    wetWashFrequency: "does_not_wash" as const,
    towel: { material: "no_towel" as const },
    dryingRoutes: ["air_dry" as const],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const required = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ] as const
  const complete = resolveStage2Path({
    triggerContext: neutralContext,
    answers,
    completedQuestionIds: [...required],
  })
  assert.equal(complete.firstUnresolvedQuestionId, null)
  assert.deepEqual(complete.completedQuestionIds, required)
  const unanswered = resolveStage2Path({
    triggerContext: neutralContext,
    answers,
    completedQuestionIds: required.slice(0, -1),
  })
  assert.equal(unanswered.firstUnresolvedQuestionId, "night_protection")
  assert.deepEqual(
    validateStage2Answers({
      triggerContext: neutralContext,
      answers: { ...answers, currentProductCategories: ["unsupported" as never] },
      completedQuestionIds: [...required],
    }),
    ["current_product_categories is invalid or incomplete"],
  )
})

test("invalid, duplicate, and out-of-order arrays cannot count as completed", () => {
  for (const currentProductCategories of [
    ["unsupported"],
    ["shampoo", "shampoo"],
    ["oil", "shampoo"],
  ] as const) {
    const path = resolveStage2Path({
      triggerContext: neutralContext,
      answers: { currentProductCategories: currentProductCategories as never },
      completedQuestionIds: ["current_product_categories"],
    })
    assert.equal(path.firstUnresolvedQuestionId, "current_product_categories")
  }
})

test("a completed but invalid compound towel page remains unresolved and strips an orphan technique", () => {
  const path = resolveStage2Path({
    triggerContext: neutralContext,
    answers: { towel: { material: "frottee" } },
    completedQuestionIds: ["towel_handling"],
  })
  assert.equal(path.firstUnresolvedQuestionId, "current_product_categories")
  const towelPath = resolveStage2Path({
    triggerContext: neutralContext,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "does_not_wash",
      towel: { material: "frottee" },
    },
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency", "towel_handling"],
  })
  assert.equal(towelPath.firstUnresolvedQuestionId, "towel_handling")
  const pruned = pruneStage2Answers({
    triggerContext: neutralContext,
    answers: { towel: { material: undefined, technique: "gentle_press" } as never },
    completedQuestionIds: ["towel_handling"],
  })
  assert.deepEqual(pruned.answers.towel, { material: undefined })
})

test("an invalid marked-complete answer is absent from both canonical completion lists", () => {
  const contract = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: { currentProductCategories: ["unsupported" as never] },
    completedQuestionIds: ["current_product_categories"],
  })
  assert.equal(contract.completedQuestionIds.includes("current_product_categories"), false)
  assert.equal(contract.path.completedQuestionIds.includes("current_product_categories"), false)
})

test("D2: an empty drying answer no longer completes the question", () => {
  const empty = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: { dryingRoutes: [] },
    completedQuestionIds: ["drying_routes"],
  })
  assert.equal(empty.completedQuestionIds.includes("drying_routes"), false)
  assert.ok(empty.validationErrors.includes("drying_routes is invalid or incomplete"))

  for (const dryingRoutes of [
    ["air_dry"],
    ["air_dry", "ordinary_blow_dry"],
    ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
  ] as const) {
    const contract = resolveStage2RefinementContract({
      triggerContext: neutralContext,
      answers: { dryingRoutes: [...dryingRoutes] },
      completedQuestionIds: ["drying_routes"],
    })
    assert.ok(
      contract.completedQuestionIds.includes("drying_routes"),
      `${dryingRoutes.join("+")} must complete the question`,
    )
  }
  // The legacy `[]` is still readable data — it is not pruned or rewritten.
  assert.deepEqual(
    pruneStage2Answers({
      triggerContext: neutralContext,
      answers: { dryingRoutes: [] },
      completedQuestionIds: ["drying_routes"],
    }).answers.dryingRoutes,
    [],
  )
})

test("R1: the diffuser heat event is complete without protection and tolerates a legacy value", () => {
  const withoutValue = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: { "heat:diffuser_airflow_shaping": { frequency: "weekly_1x" } },
    },
    completedQuestionIds: ["heat:diffuser_airflow_shaping"],
  })
  assert.ok(withoutValue.completedQuestionIds.includes("heat:diffuser_airflow_shaping"))

  const legacy = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "no" },
      },
    },
    completedQuestionIds: ["heat:diffuser_airflow_shaping"],
  })
  assert.ok(
    legacy.completedQuestionIds.includes("heat:diffuser_airflow_shaping"),
    "a row written under the old contract stays complete",
  )

  // An airflow-shaping source that still asks the question keeps demanding it.
  const dryerBrush = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: {
      additionalHeatTools: ["dryer_brush"],
      heatEvents: { "heat:dryer_brush": { frequency: "weekly_1x" } },
    },
    completedQuestionIds: ["heat:dryer_brush"],
  })
  assert.equal(dryerBrush.completedQuestionIds.includes("heat:dryer_brush"), false)
})

test("D9b: `fingers` is a valid brushes answer and is rejected in every other family", () => {
  const context = { ...neutralContext, toolsEnabled: true }
  const brushes = resolveStage2RefinementContract({
    triggerContext: context,
    answers: {
      toolFamiliesWithSomething: ["brushes_combs"],
      toolForms: { brushes_combs: ["wide_tooth_comb", "fingers"] },
    },
    completedQuestionIds: ["tools_overview", "tools:brushes_combs:1"],
  })
  assert.ok(brushes.completedQuestionIds.includes("tools:brushes_combs:1"))

  const elsewhere = resolveStage2RefinementContract({
    triggerContext: context,
    answers: {
      toolFamiliesWithSomething: ["wash_application"],
      toolForms: { wash_application: ["fingers" as never] },
    },
    completedQuestionIds: ["tools_overview", "tools:wash_application:1"],
  })
  assert.equal(elsewhere.completedQuestionIds.includes("tools:wash_application:1"), false)
})
