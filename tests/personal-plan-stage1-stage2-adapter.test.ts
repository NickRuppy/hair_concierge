import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  buildPlanRoutineContextFromCompletedRefinement,
  deriveStage2TriggerContext,
} from "../src/lib/personal-plan/refinement/stage1-adapter"
import type { PlanRoutineContext } from "../src/lib/personal-plan/types"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
} from "../src/lib/personal-plan/refinement/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const irritatedOilyEnvelope = {
  ...COMPLETE_V3_PLAN_ENVELOPE,
  answers: {
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    scalpOiliness: "oily" as const,
    scalpConcerns: ["irritated" as const],
  },
}

const completedAnswers: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: ["shampoo"],
  wetWashFrequency: "weekly_2x",
  scalpIrritationDetail: "mild_sensitive_or_itchy",
  dryShampooBridgePreference: "accept",
  dryShampooVisibleHairColor: "dark",
  towel: { material: "no_towel" },
  dryingRoutes: ["diffuser_or_airflow_shaping"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:diffuser_airflow_shaping": {
      frequency: "weekly_1x",
      protectionConsistency: "always",
    },
    "heat:straightener": {
      frequency: "monthly_1x",
      protectionConsistency: "sometimes",
    },
  },
  nightProtection: [],
}

const completedQuestionIds: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "scalp_irritation_detail",
  "dry_shampoo_bridge_preference",
  "dry_shampoo_visible_hair_color",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "heat:diffuser_airflow_shaping",
  "heat:straightener",
  "night_protection",
]

function initialSnapshot() {
  const result = computeNeedPlan({
    rawEnvelope: irritatedOilyEnvelope,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected a ready initial plan")
  return result.snapshot
}

test("a real Stage 1 snapshot drives Stage 2 triggers and a refined Stage 1 recomputation", () => {
  const initial = initialSnapshot()
  const triggerContext = deriveStage2TriggerContext(initial)

  assert.deepEqual(triggerContext, {
    relevantCategories: initial.renderedOrder,
    hasReportedIrritatedScalp: true,
    dryShampooBridgeEligibility: "eligible",
  })

  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext,
    answers: completedAnswers,
    completedQuestionIds,
  })

  assert.deepEqual(routine, {
    currentProductLoad: {
      state: "known",
      value: {
        categories: ["shampoo"],
        oilPurposes: [],
      },
    },
    shampooFrequency: { state: "known", value: "weekly_2x" },
    heatToolUse: {
      state: "known",
      value: [
        {
          id: "heat:diffuser_airflow_shaping",
          tool: "hair_dryer",
          route: "airflow_shaping",
          frequency: "weekly_1x",
          sourceRuleIds: ["post_plan_onboarding:heat_tool_use"],
        },
        {
          id: "heat:straightener",
          tool: "straightener",
          route: "direct_contact_heat",
          frequency: "monthly_1x",
          sourceRuleIds: ["post_plan_onboarding:heat_tool_use"],
        },
      ],
    },
    mechanicalExposureSignals: [],
    dryShampooBridgePreference: { state: "known", value: "accept" },
    scalpIrritationState: { state: "known", value: "mild_sensitive_or_itchy" },
  })

  const refined = computeNeedPlan({
    rawEnvelope: irritatedOilyEnvelope,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:10:00.000Z",
    routine,
  })

  assert.equal(refined.status, "ready")
  if (refined.status !== "ready") return
  assert.equal(refined.snapshot.profile.source.projection, "refined_post_plan")
  assert.equal(refined.snapshot.deferredFacts.includes("shampoo_frequency"), false)
  assert.equal(refined.snapshot.deferredFacts.includes("heat_tool_use"), false)
  assert.equal(refined.snapshot.deferredFacts.includes("dry_shampoo_bridge_preference"), false)
  assert.equal(refined.snapshot.deferredFacts.includes("scalp_irritation_detail"), false)
  assert.equal(
    refined.snapshot.decisions.find((decision) => decision.category === "heat_protectant")
      ?.needTier,
    "basis",
  )
})

test("refined towel technique projects only explicit rough rubbing as mechanical exposure", () => {
  const triggerContext = deriveStage2TriggerContext(initialSnapshot())

  for (const [towel, expected] of [
    [{ material: "frottee", technique: "rough_rubbing" }, ["towel_rough_rubbing"]],
    [{ material: "frottee", technique: "gentle_press" }, []],
    [{ material: "no_towel" }, []],
  ] as const) {
    const routine: PlanRoutineContext = buildPlanRoutineContextFromCompletedRefinement({
      triggerContext,
      answers: { ...completedAnswers, towel },
      completedQuestionIds,
    })

    assert.deepEqual(routine.mechanicalExposureSignals, expected)
  }
})

test("completed current-product categories clear current-product-load deferrals", () => {
  const triggerContext = deriveStage2TriggerContext(initialSnapshot())
  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext,
    answers: {
      ...completedAnswers,
      currentProductCategories: [],
      dryShampooBridgePreference: "decline",
    },
    completedQuestionIds,
  })

  const refined = computeNeedPlan({
    rawEnvelope: irritatedOilyEnvelope,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:10:00.000Z",
    routine,
  })

  assert.equal(refined.status, "ready")
  if (refined.status !== "ready") return
  assert.equal(refined.snapshot.deferredFacts.includes("current_product_load"), false)
  assert.equal(
    refined.snapshot.decisions
      .find((decision) => decision.category === "deep_cleansing_shampoo")
      ?.deferredFacts.includes("current_product_load"),
    false,
  )
  assert.equal(
    refined.snapshot.decisions
      .find((decision) => decision.category === "scalp_care")
      ?.deferredFacts.includes("current_product_load"),
    false,
  )
})

test("current product categories stay inventory-routing facts instead of frequency load", () => {
  const triggerContext = deriveStage2TriggerContext(initialSnapshot())
  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext,
    answers: {
      ...completedAnswers,
      currentProductCategories: ["leave_in", "oil", "dry_shampoo"],
      wetWashFrequency: "weekly_1x",
      oilPurposes: ["dry_finish", "scalp"],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "scalp_irritation_detail",
      "dry_shampoo_visible_hair_color",
      "oil_purposes",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "heat:diffuser_airflow_shaping",
      "heat:straightener",
      "night_protection",
    ],
  })

  const refined = computeNeedPlan({
    rawEnvelope: irritatedOilyEnvelope,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:10:00.000Z",
    routine,
  })

  assert.equal(refined.status, "ready")
  if (refined.status !== "ready") return
  assert.equal(refined.snapshot.assessments.resetLoad.knowledgeState, "known")
  assert.equal(refined.snapshot.assessments.resetLoad.knownScore, 2)
  assert.deepEqual(refined.snapshot.assessments.resetLoad.missingInputs, [])
  assert.deepEqual(refined.snapshot.assessments.scalpBuildup, {
    knowledgeState: "known",
    state: "absent",
    sourceFacts: [],
  })
  assert.deepEqual(
    refined.snapshot.decisions.find((decision) => decision.category === "deep_cleansing_shampoo")
      ?.deferredFacts,
    [],
  )
  assert.deepEqual(
    refined.snapshot.decisions
      .find((decision) => decision.category === "scalp_care")
      ?.roles.includes("scalp_exfoliant"),
    false,
  )
})

test("the adapter rejects an incomplete refinement contract", () => {
  const triggerContext = deriveStage2TriggerContext(initialSnapshot())

  assert.throws(
    () =>
      buildPlanRoutineContextFromCompletedRefinement({
        triggerContext,
        answers: { currentProductCategories: [] },
        completedQuestionIds: ["current_product_categories"],
      }),
    /Stage 2 refinement is incomplete/,
  )
})

test("an untriggered scalp detail stays an explicit unknown", () => {
  const initial = initialSnapshot()
  const triggerContext = {
    ...deriveStage2TriggerContext(initial),
    hasReportedIrritatedScalp: false,
  }
  const answers = { ...completedAnswers, scalpIrritationDetail: undefined }
  const ids = completedQuestionIds.filter((id) => id !== "scalp_irritation_detail")

  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext,
    answers,
    completedQuestionIds: ids,
  })

  assert.deepEqual(routine.scalpIrritationState, {
    state: "unknown",
    reason: "scalp_irritation_detail",
  })
})

test("an ineligible bridge, no wet washing and no heat remain explicit canonical facts", () => {
  const triggerContext = {
    relevantCategories: ["shampoo"] as const,
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible" as const,
  }
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: [],
    wetWashFrequency: "does_not_wash",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const ids: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ]

  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext: {
      ...triggerContext,
      relevantCategories: [...triggerContext.relevantCategories],
    },
    answers,
    completedQuestionIds: ids,
  })

  assert.deepEqual(routine.shampooFrequency, { state: "known", value: "does_not_wash" })
  assert.deepEqual(routine.heatToolUse, { state: "known", value: [] })
  assert.deepEqual(routine.dryShampooBridgePreference, {
    state: "unknown",
    reason: "dry_shampoo_bridge_preference",
  })
})

test("an existing Dry Shampoo records an accepted bridge without asking the bridge question", () => {
  const triggerContext = {
    relevantCategories: ["shampoo"] as const,
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "eligible" as const,
  }
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: ["dry_shampoo"],
    wetWashFrequency: "weekly_2x",
    dryShampooVisibleHairColor: "dark",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const ids: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "dry_shampoo_visible_hair_color",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ]

  const routine = buildPlanRoutineContextFromCompletedRefinement({
    triggerContext: {
      ...triggerContext,
      relevantCategories: [...triggerContext.relevantCategories],
    },
    answers,
    completedQuestionIds: ids,
  })

  assert.deepEqual(routine.dryShampooBridgePreference, { state: "known", value: "accept" })
})
