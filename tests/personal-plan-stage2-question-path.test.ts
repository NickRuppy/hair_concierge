import assert from "node:assert/strict"
import test from "node:test"

import {
  pruneStage2Answers,
  getEffectiveDryShampooBridgePreference,
  getStage2DryingRouteOptions,
  getStage2ModulePathStates,
  isStage2QuestionAnswerValid,
  isStage2TowelMaterialDerived,
  resolveStage2Path,
  resolveStage2RefinementContract,
  validateStage2Answers,
} from "../src/lib/personal-plan/refinement/question-path"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import type { PersonalPlanRefinementAnswersV1 } from "../src/lib/personal-plan/refinement/types"
import type { ToolFamily } from "../src/lib/personal-plan/tools/contracts"

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
    dryingRoutes: [],
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

/* ── Hair Tools (rollout on): the tools block, derived thing-fields, filtered drying ─────── */

const toolsOn = { ...neutralContext, toolsEnabled: true as const }

/** A member whose Produkte and the old Gewohnheiten were answered with the rollout off. */
const answeredBeforeTools = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x" as const,
  towel: { material: "frottee" as const, technique: "rough_rubbing" as const },
  dryingRoutes: ["ordinary_blow_dry" as const],
  additionalHeatTools: ["straightener" as const],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_2x" as const },
    "heat:straightener": {
      frequency: "weekly_1x" as const,
      protectionConsistency: "always" as const,
    },
  },
  nightProtection: ["silk_satin_pillow" as const],
}
const answeredBeforeToolsIds = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "heat:ordinary_blow_dry",
  "heat:straightener",
  "night_protection",
] as const

test("rollout on: the tools block sits between Produkte and Gewohnheiten; thing-questions leave", () => {
  const before = resolveStage2Path({
    triggerContext: toolsOn,
    answers: answeredBeforeTools,
    completedQuestionIds: [...answeredBeforeToolsIds],
  })
  assert.deepEqual(before.orderedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "tools_overview",
    "towel_handling",
    "drying_routes",
    "heat:ordinary_blow_dry",
    "heat:straightener",
    // Rev. 6: the night question closes Gewohnheiten (the length is unknown here, so it asks).
    "night_wear",
  ])
  assert.equal(before.firstUnresolvedQuestionId, "tools_overview")

  const after = resolveStage2Path({
    triggerContext: toolsOn,
    answers: {
      ...answeredBeforeTools,
      // Abtrocknen & Entwirren + Trocknen & Stylen + Nachtschutz, in wash-day order.
      toolFamiliesWithSomething: [
        "drying_textiles",
        "brushes_combs",
        "airflow",
        "heated_styling",
        "heatless_styling",
        "securing_sectioning",
        "night_protection",
      ],
    },
    completedQuestionIds: [...answeredBeforeToolsIds, "tools_overview"],
  })
  assert.deepEqual(after.orderedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "tools_overview",
    "tools:drying_textiles:1",
    "tools:brushes_combs:1",
    "tools:brushes_combs:2",
    "tools:airflow:1",
    "tools:heated_styling:1",
    "tools:heatless_styling:1",
    "tools:securing_sectioning:1",
    "tools:securing_sectioning:2",
    "tools:night_protection:1",
    "towel_handling",
    "drying_routes",
    "heat:ordinary_blow_dry",
    "heat:straightener",
    "night_wear",
  ])
  assert.equal(after.firstUnresolvedQuestionId, "tools:drying_textiles:1")
  // Gewohnheiten keeps every earlier answer; only the new night question is open (Rev. 6).
  const modules = getStage2ModulePathStates(after.orderedQuestionIds, after.completedQuestionIds)
  assert.equal(modules.products.status, "complete")
  assert.equal(modules.tools.status, "open")
  assert.deepEqual(modules.habits.openQuestionIds, ["night_wear"])
  // Hair that cannot be tied has no night question: Gewohnheiten stays complete.
  const short = resolveStage2Path({
    triggerContext: { ...toolsOn, hairLength: "short" },
    answers: answeredBeforeTools,
    completedQuestionIds: [...answeredBeforeToolsIds],
  })
  assert.equal(
    getStage2ModulePathStates(short.orderedQuestionIds, short.completedQuestionIds).habits.status,
    "complete",
  )
})

/** Lena (§6): textiles, brushes, airflow, heated, heatless, securing and night ticked. */
function lenaAnswers() {
  return {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x" as const,
    toolFamiliesWithSomething: [
      "drying_textiles",
      "brushes_combs",
      "airflow",
      "heated_styling",
      "heatless_styling",
      "securing_sectioning",
      "night_protection",
    ] as ToolFamily[],
    toolForms: {
      "drying_textiles:1": ["microfiber_towel"],
      "brushes_combs:1": ["wide_tooth_comb"],
      "brushes_combs:2": ["round_brush"],
      "airflow:1": ["hair_dryer", "hot_air_brush"],
      "heated_styling:1": ["flat_iron"],
      "heatless_styling:1": [],
      "securing_sectioning:1": [],
      "securing_sectioning:2": [],
      "night_protection:1": ["pillowcase"],
    } as PersonalPlanRefinementAnswersV1["toolForms"],
  }
}
const lenaToolIds = [
  "current_product_categories",
  "wet_wash_frequency",
  "tools_overview",
  "tools:drying_textiles:1",
  "tools:brushes_combs:1",
  "tools:brushes_combs:2",
  "tools:airflow:1",
  "tools:heated_styling:1",
  "tools:heatless_styling:1",
  "tools:securing_sectioning:1",
  "tools:securing_sectioning:2",
  "tools:night_protection:1",
] as const

test("rollout on: settled pages derive the thing-fields and open one heat question pair per tool", () => {
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers: lenaAnswers(),
    completedQuestionIds: [...lenaToolIds],
  })
  assert.deepEqual(contract.answers.additionalHeatTools, ["dryer_brush", "straightener"])
  assert.deepEqual(contract.answers.nightProtection, ["silk_satin_pillow"])
  assert.deepEqual(contract.answers.towel, { material: "mikrofaser" })
  assert.deepEqual(contract.path.orderedQuestionIds.slice(lenaToolIds.length), [
    "towel_handling",
    "drying_routes",
    "heat:dryer_brush",
    "heat:straightener",
    "night_wear",
  ])
  assert.equal(contract.path.firstUnresolvedQuestionId, "towel_handling")
  assert.equal(isStage2TowelMaterialDerived(toolsOn, lenaAnswers()), true)
  // §6: Föhn + Warmluftbürste, no Diffusor-Aufsatz → „Mit Diffusor" is absent.
  assert.deepEqual(getStage2DryingRouteOptions(toolsOn, lenaAnswers()), [
    "air_dry",
    "ordinary_blow_dry",
  ])
  const withDiffuser = {
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, "airflow:1": ["hair_dryer", "diffuser"] },
  } as PersonalPlanRefinementAnswersV1
  assert.deepEqual(getStage2DryingRouteOptions(toolsOn, withDiffuser), [
    "air_dry",
    "ordinary_blow_dry",
    "diffuser_or_airflow_shaping",
  ])
})

test("rollout on: the towel question asks only the technique when the material is derived", () => {
  const answers = { ...lenaAnswers(), towel: { technique: "gentle_press" } as never }
  const path = resolveStage2Path({
    triggerContext: toolsOn,
    answers,
    completedQuestionIds: [...lenaToolIds, "towel_handling"],
  })
  assert.equal(path.completedQuestionIds.includes("towel_handling"), true)
  assert.equal(path.firstUnresolvedQuestionId, "drying_routes")
})

test("rollout on: Frottee is derived from its card and keeps the technique question", () => {
  const answers = {
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, "drying_textiles:1": ["frottee"] },
    towel: { material: "frottee" as const, technique: "rough_rubbing" as const },
  } as PersonalPlanRefinementAnswersV1
  assert.equal(isStage2TowelMaterialDerived(toolsOn, answers), true)
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers,
    completedQuestionIds: [...lenaToolIds, "towel_handling"],
  })
  assert.deepEqual(contract.answers.towel, { material: "frottee", technique: "rough_rubbing" })
  assert.equal(contract.path.completedQuestionIds.includes("towel_handling"), true)
})

test("rollout on: a Nichts-davon textiles page is kein Handtuch and skips the towel question", () => {
  const answers = {
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, "drying_textiles:1": [] },
    towel: { material: "frottee" as const, technique: "rough_rubbing" as const },
  } as PersonalPlanRefinementAnswersV1
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers,
    completedQuestionIds: [...lenaToolIds, "towel_handling"],
  })
  assert.deepEqual(contract.answers.towel, { material: "no_towel" })
  assert.equal(contract.path.orderedQuestionIds.includes("towel_handling"), false)
  assert.equal(contract.path.firstUnresolvedQuestionId, "drying_routes")
})

test("rollout on: drying routes are offered per owned airflow form; others cannot complete", () => {
  const noAirflow = {
    ...lenaAnswers(),
    toolFamiliesWithSomething: ["drying_textiles", "brushes_combs"] as ToolFamily[],
  }
  assert.deepEqual(getStage2DryingRouteOptions(toolsOn, noAirflow), ["air_dry"])
  const hotAirBrushOnly = {
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, "airflow:1": ["hot_air_brush"] },
  } as PersonalPlanRefinementAnswersV1
  assert.deepEqual(getStage2DryingRouteOptions(toolsOn, hotAirBrushOnly), [
    "air_dry",
    "ordinary_blow_dry",
  ])
  const towelDone = {
    towel: { material: "mikrofaser" as const, technique: "gentle_press" as const },
  }
  const ids = [...lenaToolIds, "towel_handling", "drying_routes"] as const
  // A route the tools no longer back reopens the question …
  const reopened = resolveStage2Path({
    triggerContext: toolsOn,
    answers: { ...noAirflow, ...towelDone, dryingRoutes: ["ordinary_blow_dry"] },
    completedQuestionIds: [...ids],
  })
  assert.equal(reopened.firstUnresolvedQuestionId, "drying_routes")
  // … an offered one completes it, and a stored empty answer stays valid.
  for (const dryingRoutes of [["air_dry"], []] as const) {
    const path = resolveStage2Path({
      triggerContext: toolsOn,
      answers: { ...noAirflow, ...towelDone, dryingRoutes: [...dryingRoutes] },
      completedQuestionIds: [...ids],
    })
    assert.equal(path.completedQuestionIds.includes("drying_routes"), true)
  }
  // Before the airflow page is settled every route is offered.
  assert.deepEqual(getStage2DryingRouteOptions(toolsOn, {}), [
    "air_dry",
    "ordinary_blow_dry",
    "diffuser_or_airflow_shaping",
  ])
  assert.deepEqual(getStage2DryingRouteOptions(neutralContext, noAirflow), [
    "air_dry",
    "ordinary_blow_dry",
    "diffuser_or_airflow_shaping",
  ])
})

test("rollout on: adding a heat tool later reopens only that tool's heat question", () => {
  const complete = {
    ...lenaAnswers(),
    towel: { material: "mikrofaser" as const, technique: "gentle_press" as const },
    dryingRoutes: ["air_dry" as const],
    heatEvents: {
      "heat:dryer_brush": {
        frequency: "weekly_1x" as const,
        protectionConsistency: "always" as const,
      },
      "heat:straightener": {
        frequency: "weekly_1x" as const,
        protectionConsistency: "sometimes" as const,
      },
    },
    nightWear: "open" as const,
  }
  const completeIds = [
    ...lenaToolIds,
    "towel_handling",
    "drying_routes",
    "heat:dryer_brush",
    "heat:straightener",
    "night_wear",
  ] as const
  const done = resolveStage2Path({
    triggerContext: toolsOn,
    answers: complete,
    completedQuestionIds: [...completeIds],
  })
  assert.equal(done.firstUnresolvedQuestionId, null)

  const withCurlingIron = resolveStage2Path({
    triggerContext: toolsOn,
    answers: {
      ...complete,
      toolForms: { ...complete.toolForms, "heated_styling:1": ["flat_iron", "curling_iron"] },
    },
    completedQuestionIds: [...completeIds],
  })
  const modules = getStage2ModulePathStates(
    withCurlingIron.orderedQuestionIds,
    withCurlingIron.completedQuestionIds,
  )
  assert.equal(modules.tools.status, "complete")
  assert.deepEqual(modules.habits.openQuestionIds, ["heat:curling_or_wave_iron"])
})

test("rollout on: page answers are validated per page", () => {
  const answers = {
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, "brushes_combs:1": ["round_brush"] },
  } as PersonalPlanRefinementAnswersV1
  const path = resolveStage2Path({
    triggerContext: toolsOn,
    answers,
    completedQuestionIds: [...lenaToolIds],
  })
  assert.equal(path.firstUnresolvedQuestionId, "tools:brushes_combs:1")
  assert.equal(
    isStage2QuestionAnswerValid("tools_overview", { toolFamiliesWithSomething: [] }),
    true,
  )
  assert.equal(
    isStage2QuestionAnswerValid("tools:airflow:1", { toolForms: { "airflow:1": ["hair_dryer"] } }),
    true,
  )
  assert.equal(isStage2QuestionAnswerValid("tools:airflow:1", {}), false)
})

test("rollout on: prune keeps per-page answers, empties unticked families and drops unknown keys", () => {
  const pruned = pruneStage2Answers({
    triggerContext: toolsOn,
    answers: {
      toolFamiliesWithSomething: ["airflow"],
      toolForms: {
        "airflow:1": ["hair_dryer"],
        "night_protection:1": ["bonnet"],
        // The August drafts stored one array per FAMILY; that shape is not a page answer.
        airflow: ["hair_dryer"],
      } as never,
    },
    completedQuestionIds: [],
  })
  assert.deepEqual(pruned.answers.toolForms, {
    "airflow:1": ["hair_dryer"],
    "night_protection:1": [],
  })
  assert.deepEqual(pruned.prunedAnswerKeys, ["toolForms"])
})

test("rollout off: tool answers are kept untouched, nothing is derived, the path is today's", () => {
  const answers = {
    ...answeredBeforeTools,
    ...lenaAnswers(),
    toolForms: { ...lenaAnswers().toolForms, airflow: ["hair_dryer"] } as never,
  }
  const contract = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers,
    completedQuestionIds: [...answeredBeforeToolsIds],
  })
  assert.deepEqual(contract.answers, answers)
  assert.deepEqual(contract.prunedAnswerKeys, [])
  assert.deepEqual(contract.path.orderedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "heat:ordinary_blow_dry",
    "heat:straightener",
    "night_protection",
  ])
  assert.equal(contract.isComplete, true)
})

test("rollout on: a complete draft whose path grew loads complete with an open first question", () => {
  const session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: toolsOn,
    answers: answeredBeforeTools,
    completedQuestionIds: [...answeredBeforeToolsIds],
    status: "complete",
    completedHandoff: { refinedVersionId: "refined-1", nextHref: "/plan-start" },
    tolerateGrownPath: true,
  })
  assert.equal(session.status, "complete")
  assert.equal(session.path.firstUnresolvedQuestionId, "tools_overview")
  const modules = getStage2ModulePathStates(
    session.path.orderedQuestionIds,
    session.path.completedQuestionIds,
  )
  // Rev. 6: the night question joined Gewohnheiten, so it is the one open habits question.
  assert.deepEqual(
    [modules.products.status, modules.tools.status, modules.habits.status],
    ["complete", "open", "open"],
  )
  assert.deepEqual(modules.habits.openQuestionIds, ["night_wear"])
  // Its stored thing-facts are not touched before the tools are settled.
  assert.deepEqual(session.answers.additionalHeatTools, ["straightener"])
  assert.deepEqual(session.answers.nightProtection, ["silk_satin_pillow"])
})

/* ── Diffusor rule: plain blow-drying ──────────────────────────────────────── */

const diffuserHeatAnswers = (
  protectionConsistency?: "always" | "sometimes" | "no" | "unsure",
): PersonalPlanRefinementAnswersV1 => ({
  dryingRoutes: ["diffuser_or_airflow_shaping"],
  heatEvents: {
    "heat:diffuser_airflow_shaping": {
      frequency: "weekly_2x",
      ...(protectionConsistency ? { protectionConsistency } : {}),
    },
  },
})

test("Diffusor rule (rollout on): a Diffusor event is valid without a protection answer", () => {
  assert.equal(
    isStage2QuestionAnswerValid("heat:diffuser_airflow_shaping", diffuserHeatAnswers(), toolsOn),
    true,
  )
})

test("Diffusor rule (rollout on): a stored protection answer is tolerated, never re-opening the question", () => {
  for (const value of ["always", "sometimes", "no", "unsure"] as const) {
    assert.equal(
      isStage2QuestionAnswerValid(
        "heat:diffuser_airflow_shaping",
        diffuserHeatAnswers(value),
        toolsOn,
      ),
      true,
      value,
    )
  }
  const contract = resolveStage2RefinementContract({
    triggerContext: neutralContext,
    answers: diffuserHeatAnswers("no"),
    completedQuestionIds: ["heat:diffuser_airflow_shaping"],
  })
  assert.equal(contract.path.completedQuestionIds.includes("heat:diffuser_airflow_shaping"), true)
})

test("Diffusor rule (rollout off context): a Diffusor stored without protection stays complete — the scanner does not re-ask it", () => {
  // The question no longer exists for it, so a missing answer was given under the rule; an
  // invalid stored value is still invalid.
  assert.equal(
    isStage2QuestionAnswerValid(
      "heat:diffuser_airflow_shaping",
      diffuserHeatAnswers(),
      neutralContext,
    ),
    true,
  )
  assert.equal(
    isStage2QuestionAnswerValid(
      "heat:diffuser_airflow_shaping",
      diffuserHeatAnswers("sometimes"),
      neutralContext,
    ),
    true,
  )
  assert.equal(
    isStage2QuestionAnswerValid(
      "heat:diffuser_airflow_shaping",
      diffuserHeatAnswers("bogus" as never),
      neutralContext,
    ),
    false,
  )
})

test("Diffusor rule: readers without a trigger context tolerate either shape", () => {
  assert.equal(
    isStage2QuestionAnswerValid("heat:diffuser_airflow_shaping", diffuserHeatAnswers()),
    true,
  )
  assert.equal(
    isStage2QuestionAnswerValid("heat:diffuser_airflow_shaping", diffuserHeatAnswers("no")),
    true,
  )
})

test("Diffusor rule: other sources keep their protection requirement and ordinary airflow stays bare", () => {
  const straightener: PersonalPlanRefinementAnswersV1 = {
    additionalHeatTools: ["straightener"],
    heatEvents: { "heat:straightener": { frequency: "weekly_1x" } },
  }
  assert.equal(isStage2QuestionAnswerValid("heat:straightener", straightener, toolsOn), false)
  const ordinary: PersonalPlanRefinementAnswersV1 = {
    dryingRoutes: ["ordinary_blow_dry"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_1x", protectionConsistency: "always" },
    },
  }
  assert.equal(isStage2QuestionAnswerValid("heat:ordinary_blow_dry", ordinary, toolsOn), false)
})
