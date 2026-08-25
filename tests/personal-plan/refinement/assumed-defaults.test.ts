import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import {
  STAGE2_ASSUMPTION_RULES,
  resolveAssumedAnswers,
  selectStage2Answers,
} from "@/lib/personal-plan/refinement/assumed-defaults"
import { buildPlanRoutineContextFromCompletedRefinement } from "@/lib/personal-plan/refinement/stage1-adapter"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

/* ── shared fixtures ────────────────────────────────────────────────────── */

function triggerContext(overrides: Partial<Stage2TriggerContext> = {}): Stage2TriggerContext {
  return {
    relevantCategories: ["shampoo", "conditioner"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
    ...overrides,
  }
}

const IRRITATED_SCALP_CONTEXT = triggerContext({ hasReportedIrritatedScalp: true })
const BRIDGE_ELIGIBLE_CONTEXT = triggerContext({ dryShampooBridgeEligibility: "eligible" })

function resolve(
  context: Stage2TriggerContext,
  answers: PersonalPlanRefinementAnswersV1 = {},
  userAnsweredQuestionIds?: readonly Stage2QuestionId[],
) {
  return resolveAssumedAnswers({ triggerContext: context, answers, userAnsweredQuestionIds })
}

/* ── rule-ID fixtures: one per rule, attackable individually ─────────────── */

test("rule assume:current_product_categories:none assumes no owned products", () => {
  const resolution = resolve(triggerContext())
  assert.deepEqual(resolution.answers.currentProductCategories, [])
  assert.ok(resolution.appliedRuleIds.includes("assume:current_product_categories:none"))
})

test("rule assume:wet_wash_frequency:weekly_2x assumes two wet washes per week", () => {
  const resolution = resolve(triggerContext())
  assert.equal(resolution.answers.wetWashFrequency, "weekly_2x")
  assert.ok(resolution.appliedRuleIds.includes("assume:wet_wash_frequency:weekly_2x"))
})

test("rule assume:scalp_irritation_detail:normal fires only for an irritated-scalp context", () => {
  const irritated = resolve(IRRITATED_SCALP_CONTEXT)
  assert.equal(irritated.answers.scalpIrritationDetail, "normal")
  assert.ok(irritated.appliedRuleIds.includes("assume:scalp_irritation_detail:normal"))

  const plain = resolve(triggerContext())
  assert.equal(plain.answers.scalpIrritationDetail, undefined)
  assert.ok(!plain.appliedRuleIds.includes("assume:scalp_irritation_detail:normal"))
})

test("rule assume:dry_shampoo_bridge_preference:decline introduces no new dry shampoo", () => {
  const eligible = resolve(BRIDGE_ELIGIBLE_CONTEXT)
  assert.equal(eligible.answers.dryShampooBridgePreference, "decline")
  assert.ok(eligible.appliedRuleIds.includes("assume:dry_shampoo_bridge_preference:decline"))

  const ineligible = resolve(triggerContext())
  assert.equal(ineligible.answers.dryShampooBridgePreference, undefined)
})

test("rule assume:dry_shampoo_visible_hair_color:light_blonde fires when the user already uses dry shampoo", () => {
  const resolution = resolve(triggerContext(), { currentProductCategories: ["dry_shampoo"] })
  assert.equal(resolution.answers.dryShampooVisibleHairColor, "light_blonde")
  assert.ok(
    resolution.appliedRuleIds.includes("assume:dry_shampoo_visible_hair_color:light_blonde"),
  )
  // A user answer must survive untouched.
  assert.deepEqual(resolution.answers.currentProductCategories, ["dry_shampoo"])
})

test("rule assume:dry_shampoo_visible_hair_color:light_blonde also fires when the user accepted the bridge", () => {
  const resolution = resolve(BRIDGE_ELIGIBLE_CONTEXT, { dryShampooBridgePreference: "accept" })
  assert.equal(resolution.answers.dryShampooVisibleHairColor, "light_blonde")
  assert.equal(resolution.answers.dryShampooBridgePreference, "accept")
})

test("rule assume:oil_purposes:prewash_lengths fires when the user reported an oil", () => {
  const resolution = resolve(triggerContext(), { currentProductCategories: ["oil"] })
  assert.deepEqual(resolution.answers.oilPurposes, ["prewash_lengths"])
  assert.ok(resolution.appliedRuleIds.includes("assume:oil_purposes:prewash_lengths"))
})

test("rule assume:oil_purposes:prewash_lengths never fires without a user oil answer", () => {
  const resolution = resolve(triggerContext())
  assert.equal(resolution.answers.oilPurposes, undefined)
  assert.ok(!resolution.appliedRuleIds.includes("assume:oil_purposes:prewash_lengths"))
})

test("rule assume:towel_handling:mikrofaser_gentle_press covers a fully open towel question", () => {
  const resolution = resolve(triggerContext())
  assert.deepEqual(resolution.answers.towel, {
    material: "mikrofaser",
    technique: "gentle_press",
  })
  assert.ok(resolution.appliedRuleIds.includes("assume:towel_handling:mikrofaser_gentle_press"))
})

test("rule assume:towel_technique:gentle_press keeps a user-chosen material", () => {
  const resolution = resolve(triggerContext(), { towel: { material: "frottee" } })
  assert.deepEqual(resolution.answers.towel, { material: "frottee", technique: "gentle_press" })
  assert.ok(resolution.appliedRuleIds.includes("assume:towel_technique:gentle_press"))
  assert.ok(!resolution.appliedRuleIds.includes("assume:towel_handling:mikrofaser_gentle_press"))
})

test("no towel rule fires when the user answered 'kein Handtuch'", () => {
  const resolution = resolve(triggerContext(), { towel: { material: "no_towel" } })
  assert.deepEqual(resolution.answers.towel, { material: "no_towel" })
  assert.ok(!resolution.assumedQuestionIds.includes("towel_handling"))
})

test("rule assume:drying_routes:air_dry assumes air drying only", () => {
  const resolution = resolve(triggerContext())
  assert.deepEqual(resolution.answers.dryingRoutes, ["air_dry"])
  assert.ok(resolution.appliedRuleIds.includes("assume:drying_routes:air_dry"))
  assert.deepEqual(resolution.answers.heatEvents, {})
})

test("rule assume:additional_heat_tools:none assumes no heat styling tools", () => {
  const resolution = resolve(triggerContext())
  assert.deepEqual(resolution.answers.additionalHeatTools, [])
  assert.ok(resolution.appliedRuleIds.includes("assume:additional_heat_tools:none"))
})

test("rule assume:heat_event:ordinary_airflow_minimum assumes the lowest frequency and no protection field", () => {
  const resolution = resolve(triggerContext(), { dryingRoutes: ["ordinary_blow_dry"] })
  assert.deepEqual(resolution.answers.heatEvents, {
    "heat:ordinary_blow_dry": { frequency: "less_than_monthly" },
  })
  assert.ok(resolution.appliedRuleIds.includes("assume:heat_event:ordinary_airflow_minimum"))
})

test("rule assume:heat_event:protected_minimum assumes lowest frequency plus consistent protection", () => {
  const resolution = resolve(triggerContext(), { additionalHeatTools: ["straightener"] })
  assert.deepEqual(resolution.answers.heatEvents, {
    "heat:straightener": { frequency: "less_than_monthly", protectionConsistency: "always" },
  })
  assert.ok(resolution.appliedRuleIds.includes("assume:heat_event:protected_minimum"))
})

test("rule assume:night_protection:none assumes no special night protection", () => {
  const resolution = resolve(triggerContext())
  assert.deepEqual(resolution.answers.nightProtection, [])
  assert.ok(resolution.appliedRuleIds.includes("assume:night_protection:none"))
})

test("every declared rule id is unique and documented with a condition and a rationale", () => {
  const ruleIds = STAGE2_ASSUMPTION_RULES.map((rule) => rule.ruleId)
  assert.equal(new Set(ruleIds).size, ruleIds.length)
  for (const rule of STAGE2_ASSUMPTION_RULES) {
    assert.ok(rule.condition.length > 0, `${rule.ruleId} needs a condition`)
    assert.ok(rule.rationale.length > 0, `${rule.ruleId} needs a rationale`)
  }
})

test("every declared rule id is reachable — no dead rule in the table", () => {
  const reachable = new Set(
    [
      resolve(triggerContext()),
      resolve(IRRITATED_SCALP_CONTEXT),
      resolve(BRIDGE_ELIGIBLE_CONTEXT),
      resolve(triggerContext(), { currentProductCategories: ["dry_shampoo"] }),
      resolve(triggerContext(), { currentProductCategories: ["oil"] }),
      resolve(triggerContext(), { towel: { material: "frottee" } }),
      resolve(triggerContext(), { dryingRoutes: ["ordinary_blow_dry"] }),
      resolve(triggerContext(), { additionalHeatTools: ["straightener"] }),
    ].flatMap((resolution) => resolution.appliedRuleIds),
  )
  assert.deepEqual(
    STAGE2_ASSUMPTION_RULES.map((rule) => rule.ruleId).filter((ruleId) => !reachable.has(ruleId)),
    [],
  )
})

test("every applied rule id exists in the declared rule table", () => {
  const declared = new Set(STAGE2_ASSUMPTION_RULES.map((rule) => rule.ruleId))
  const resolution = resolve(IRRITATED_SCALP_CONTEXT, {
    currentProductCategories: ["dry_shampoo", "oil"],
    towel: { material: "frottee" },
    dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["straightener"],
  })
  for (const ruleId of resolution.appliedRuleIds) assert.ok(declared.has(ruleId), ruleId)
})

/* ── no-regression: the no-answers case is today's direct-acceptance output ─ */

const NO_ANSWER_EXPECTATIONS = [
  {
    name: "plain context",
    context: triggerContext(),
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
      additionalHeatTools: [],
      heatEvents: {},
      nightProtection: [],
    },
  },
  {
    name: "irritated scalp context",
    context: IRRITATED_SCALP_CONTEXT,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      scalpIrritationDetail: "normal",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
      additionalHeatTools: [],
      heatEvents: {},
      nightProtection: [],
    },
  },
  {
    name: "dry shampoo bridge eligible context",
    context: BRIDGE_ELIGIBLE_CONTEXT,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      dryShampooBridgePreference: "decline",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
      additionalHeatTools: [],
      heatEvents: {},
      nightProtection: [],
    },
  },
] as const

for (const expectation of NO_ANSWER_EXPECTATIONS) {
  test(`no-answers resolution matches the literal direct-acceptance defaults (${expectation.name})`, () => {
    const resolution = resolve(expectation.context)
    assert.deepEqual(resolution.answers, expectation.answers)
  })

  test(`no-answers resolution equals buildDirectAcceptanceStage2Defaults (${expectation.name})`, () => {
    const resolution = resolve(expectation.context)
    const legacy = buildDirectAcceptanceStage2Defaults(expectation.context)
    assert.deepEqual(resolution.answers, legacy.answers)
    assert.deepEqual(resolution.orderedQuestionIds, legacy.completedQuestionIds)
    assert.deepEqual(resolution.assumedQuestionIds, legacy.completedQuestionIds)
  })
}

/* ── totality + fixed point over a partial-answer matrix ─────────────────── */

const TOTALITY_SCENARIOS: Array<{
  name: string
  context: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
}> = [
  { name: "no answers", context: triggerContext(), answers: {} },
  { name: "irritated scalp context, no answers", context: IRRITATED_SCALP_CONTEXT, answers: {} },
  { name: "bridge eligible, no answers", context: BRIDGE_ELIGIBLE_CONTEXT, answers: {} },
  {
    name: "categories with oil",
    context: triggerContext(),
    answers: { currentProductCategories: ["shampoo", "oil"] },
  },
  {
    name: "categories with dry shampoo",
    context: triggerContext(),
    answers: { currentProductCategories: ["dry_shampoo"] },
  },
  {
    name: "bridge eligible and accepted",
    context: BRIDGE_ELIGIBLE_CONTEXT,
    answers: { dryShampooBridgePreference: "accept" },
  },
  {
    name: "towel material only",
    context: triggerContext(),
    answers: { towel: { material: "frottee" } },
  },
  {
    name: "no towel",
    context: triggerContext(),
    answers: { towel: { material: "no_towel" } },
  },
  {
    name: "one heat source",
    context: triggerContext(),
    answers: { dryingRoutes: ["ordinary_blow_dry"] },
  },
  {
    name: "three heat sources",
    context: triggerContext(),
    answers: {
      dryingRoutes: ["air_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: ["straightener", "thermal_rollers"],
    },
  },
  {
    name: "seven heat sources",
    context: IRRITATED_SCALP_CONTEXT,
    answers: {
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: [
        "dryer_brush",
        "hot_air_styler",
        "straightener",
        "curling_or_wave_iron",
        "thermal_rollers",
      ],
    },
  },
  {
    name: "partially answered heat event",
    context: triggerContext(),
    answers: {
      additionalHeatTools: ["straightener", "curling_or_wave_iron"],
      heatEvents: { "heat:straightener": { frequency: "daily_1x", protectionConsistency: "no" } },
    },
  },
  {
    name: "does not wash",
    context: triggerContext(),
    answers: { wetWashFrequency: "does_not_wash" },
  },
  {
    name: "everything the user could have answered in module products",
    context: IRRITATED_SCALP_CONTEXT,
    answers: {
      currentProductCategories: ["shampoo", "oil", "dry_shampoo"],
      wetWashFrequency: "weekly_3_4x",
      scalpIrritationDetail: "mild_sensitive_or_itchy",
      dryShampooVisibleHairColor: "dark",
      oilPurposes: ["damp_leave_on", "dry_finish"],
    },
  },
]

for (const scenario of TOTALITY_SCENARIOS) {
  test(`resolution yields a complete canonical path (${scenario.name})`, () => {
    const resolution = resolve(scenario.context, scenario.answers)
    const contract = resolveStage2RefinementContract({
      triggerContext: scenario.context,
      answers: resolution.answers,
      completedQuestionIds: resolution.orderedQuestionIds,
    })
    assert.deepEqual(contract.validationErrors, [])
    assert.equal(contract.isComplete, true)
    assert.equal(contract.path.firstUnresolvedQuestionId, null)
    assert.deepEqual(contract.path.orderedQuestionIds, resolution.orderedQuestionIds)
  })

  test(`resolution projects a plan routine context (${scenario.name})`, () => {
    const resolution = resolve(scenario.context, scenario.answers)
    assert.doesNotThrow(() =>
      buildPlanRoutineContextFromCompletedRefinement({
        triggerContext: scenario.context,
        answers: resolution.answers,
        completedQuestionIds: resolution.orderedQuestionIds,
      }),
    )
  })

  test(`resolution is a stable fixed point (${scenario.name})`, () => {
    const first = resolve(scenario.context, scenario.answers)
    const second = resolve(scenario.context, first.answers)
    assert.deepEqual(second.answers, first.answers)
    assert.deepEqual(second.orderedQuestionIds, first.orderedQuestionIds)
    assert.deepEqual(second.appliedRuleIds, [])
    assert.deepEqual(second.assumedQuestionIds, [])
  })

  test(`assumed ids are exactly the path questions the user left open (${scenario.name})`, () => {
    const resolution = resolve(scenario.context, scenario.answers)
    const assumed = new Set(resolution.assumedQuestionIds)
    assert.equal(resolution.assumedQuestionIds.length, assumed.size)
    assert.equal(resolution.appliedRuleIds.length, resolution.assumedQuestionIds.length)
    for (const questionId of resolution.assumedQuestionIds) {
      assert.ok(resolution.orderedQuestionIds.includes(questionId), questionId)
    }
    // Assumed ids follow canonical path order.
    assert.deepEqual(
      resolution.assumedQuestionIds,
      resolution.orderedQuestionIds.filter((id) => assumed.has(id)),
    )
  })
}

/* ── provenance: only user answers are trusted ───────────────────────────── */

test("answers whose question id is not user-answered are re-resolved from scratch", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["oil"],
    wetWashFrequency: "daily_1x",
    oilPurposes: ["scalp"],
    towel: { material: "frottee", technique: "rough_rubbing" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
    nightProtection: ["silk_satin_pillow"],
  }
  const resolution = resolve(triggerContext(), answers, ["wet_wash_frequency", "towel_handling"])

  assert.equal(resolution.answers.wetWashFrequency, "daily_1x")
  assert.deepEqual(resolution.answers.towel, { material: "frottee", technique: "rough_rubbing" })
  assert.deepEqual(resolution.answers.currentProductCategories, [])
  assert.equal(resolution.answers.oilPurposes, undefined)
  assert.deepEqual(resolution.answers.dryingRoutes, ["air_dry"])
  assert.deepEqual(resolution.answers.heatEvents, {})
  assert.deepEqual(resolution.answers.nightProtection, [])
})

test("a user-answered heat event survives while its siblings are assumed", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    additionalHeatTools: ["straightener", "thermal_rollers"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
      "heat:thermal_rollers": { frequency: "daily_1x", protectionConsistency: "no" },
    },
  }
  const resolution = resolve(triggerContext(), answers, [
    "additional_heat_tools",
    "heat:straightener",
  ])

  assert.deepEqual(resolution.answers.heatEvents, {
    "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
    "heat:thermal_rollers": {
      frequency: "less_than_monthly",
      protectionConsistency: "always",
    },
  })
})

test("selectStage2Answers keeps only the given question ids", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["oil"],
    wetWashFrequency: "weekly_1x",
    oilPurposes: ["scalp"],
    nightProtection: [],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "no" },
      "heat:thermal_rollers": { frequency: "weekly_2x", protectionConsistency: "no" },
    },
  }
  assert.deepEqual(selectStage2Answers(answers, ["wet_wash_frequency", "heat:straightener"]), {
    wetWashFrequency: "weekly_1x",
    heatEvents: { "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "no" } },
  })
})

test("selectStage2Answers returns an empty answer set for an empty id list", () => {
  assert.deepEqual(selectStage2Answers({ wetWashFrequency: "weekly_1x" }, []), {})
})

/* ── stale off-path answers never survive into the resolved answer set ───── */

test("answers that the current path no longer reaches are dropped", () => {
  const resolution = resolve(triggerContext(), {
    currentProductCategories: ["shampoo"],
    oilPurposes: ["dry_finish"],
    scalpIrritationDetail: "burning_painful_or_inflamed",
    dryShampooBridgePreference: "accept",
    dryShampooVisibleHairColor: "dark",
  })
  assert.equal(resolution.answers.oilPurposes, undefined)
  assert.equal(resolution.answers.scalpIrritationDetail, undefined)
  assert.equal(resolution.answers.dryShampooBridgePreference, undefined)
  assert.equal(resolution.answers.dryShampooVisibleHairColor, undefined)
})

test("heat events for a source the user no longer selects are dropped", () => {
  const resolution = resolve(triggerContext(), {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
      "heat:ordinary_blow_dry": { frequency: "daily_1x" },
      "heat:thermal_rollers": { frequency: "daily_1x", protectionConsistency: "no" },
    },
  })
  assert.deepEqual(resolution.answers.heatEvents, {
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
  })
})

/* ── an invalid stored answer is replaced, never trusted ─────────────────── */

test("a structurally invalid stored answer is overwritten by its assumption", () => {
  const resolution = resolve(triggerContext(), {
    wetWashFrequency: "nonsense" as PersonalPlanRefinementAnswersV1["wetWashFrequency"],
    currentProductCategories: ["oil", "shampoo"],
  })
  assert.equal(resolution.answers.wetWashFrequency, "weekly_2x")
  // Unordered category list is invalid too, so it is replaced rather than kept.
  assert.deepEqual(resolution.answers.currentProductCategories, [])
  assert.equal(resolution.answers.oilPurposes, undefined)
})
