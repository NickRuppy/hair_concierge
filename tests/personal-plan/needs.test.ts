import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../src/lib/personal-plan/needs"
import { INITIAL_UNKNOWN_ROUTINE_CONTEXT } from "../../src/lib/personal-plan/types"
import type { PlanRoutineContext } from "../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

function assess(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  routine?: PlanRoutineContext,
) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  }
  return buildPlanNeedAssessment(
    buildPlanProfile(envelope, {
      artifactId: "33333333-3333-4333-8333-333333333333",
      projection: "initial_quiz",
      routine,
    }),
  )
}

test("INITIAL-02: quiz-led Shampoo cadence keeps current behavior unknown", () => {
  const assessment = assess()
  assert.deepEqual(assessment.shampooCadence, {
    knowledgeState: "partial",
    sourceFacts: ["scalp.oiliness:balanced"],
    scalpRoute: "balanced",
    preferred: "weekly_2x",
    minimum: "weekly_1x",
    maximum: "weekly_3_4x",
    current: { state: "unknown", reason: "shampoo_frequency" },
  })
})

test("INITIAL-04: oily scalp contributes one Reset point while product load stays deferred", () => {
  const assessment = assess({ scalpOiliness: "oily" })
  assert.equal(assessment.resetLoad.knowledgeState, "partial")
  assert.equal(assessment.resetLoad.knownScore, 1)
  assert.deepEqual(assessment.resetLoad.missingInputs, [
    "current_product_load",
    "shampoo_frequency",
  ])
  assert.equal(assessment.scalpBuildup.state, "unknown")
})

test("known Shampoo frequency is preserved as known within the partial Reset assessment", () => {
  const assessment = assess(
    { scalpOiliness: "oily" },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      shampooFrequency: { state: "known", value: "weekly_2x" },
    },
  )

  assert.deepEqual(assessment.resetLoad.missingInputs, ["current_product_load"])
  assert.ok(!assessment.resetLoad.unknownSignals.includes("shampoo_frequency"))
  assert.ok(assessment.resetLoad.sourceFacts.includes("shampoo_frequency:weekly_2x"))
})

test("INITIAL-05: absent Hair Tools input is unknown rather than no Heat exposure", () => {
  const assessment = assess()
  assert.deepEqual(assessment.heatExposure, {
    knowledgeState: "unknown",
    state: "unknown",
    events: [],
    sourceFacts: [],
  })
})

test("lightened hair preserves the quiz fact and drives high shared repair priority", () => {
  const assessment = assess({
    chemicalTreatments: ["lightened"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    currentConcerns: [],
  })
  assert.equal(assessment.damage.chemicalStress, 4)
  assert.equal(assessment.damage.repairPriority, "high")
  assert.ok(assessment.damage.sourceFacts.includes("chemical_treatment:lightened"))
})

test("shared damage lanes distinguish rare from material Heat and keep elasticity contextual", () => {
  const rareRoutine: PlanRoutineContext = {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    heatToolUse: {
      state: "known",
      value: [
        {
          id: "rare-dryer",
          tool: "hair_dryer",
          route: "ordinary_airflow",
          frequency: "less_than_monthly",
          sourceRuleIds: ["test.rare"],
        },
      ],
    },
  }
  const frequentRoutine: PlanRoutineContext = {
    ...rareRoutine,
    heatToolUse: {
      state: "known",
      value: [
        {
          id: "frequent-dryer",
          tool: "hair_dryer",
          route: "ordinary_airflow",
          frequency: "weekly_3_4x",
          sourceRuleIds: ["test.frequent"],
        },
      ],
    },
  }
  const base = {
    chemicalTreatments: ["natural" as const],
    hairSurface: "smooth" as const,
    elasticResponse: "snaps" as const,
    currentConcerns: [],
  }
  const rare = assess(base, rareRoutine)
  const frequent = assess(base, frequentRoutine)

  assert.equal(rare.damage.structuralLevel, "none")
  assert.ok(rare.damage.structuralSignals.includes("elastic_response:snaps"))
  assert.equal(rare.damage.heatLevel, "low")
  assert.equal(frequent.damage.heatLevel, "moderate")
  assert.equal(frequent.damage.repairPriority, "medium")
})

test("ordinary airflow retains its route and frequency as a distinct Mask exposure fact", () => {
  const assessment = assess(
    {
      chemicalTreatments: ["natural"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      currentConcerns: [],
    },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: {
        state: "known",
        value: [
          {
            id: "frequent-ordinary-airflow",
            tool: "hair_dryer",
            route: "ordinary_airflow",
            frequency: "weekly_3_4x",
            sourceRuleIds: ["test.ordinary-airflow"],
          },
          {
            id: "rare-direct-heat",
            tool: "straightener",
            route: "direct_contact_heat",
            frequency: "monthly_1x",
            sourceRuleIds: ["test.direct-heat"],
          },
        ],
      },
    },
  )

  assert.deepEqual(assessment.damage.ordinaryAirflowExposure, {
    state: "known",
    events: [
      {
        id: "frequent-ordinary-airflow",
        tool: "hair_dryer",
        route: "ordinary_airflow",
        frequency: "weekly_3_4x",
        sourceRuleIds: ["test.ordinary-airflow"],
      },
    ],
  })
  assert.deepEqual(
    assessment.heatExposure.events.map((event) => event.id),
    ["frequent-ordinary-airflow", "rare-direct-heat"],
  )
})

test("refined mechanical exposure maps rough rubbing to moderate and adds nothing otherwise", () => {
  const baseRoutine: PlanRoutineContext = {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    heatToolUse: { state: "known", value: [] },
  }
  const roughRoutine: PlanRoutineContext = {
    ...baseRoutine,
    mechanicalExposureSignals: ["towel_rough_rubbing"],
  }
  const gentleOrNoTowelRoutine: PlanRoutineContext = {
    ...baseRoutine,
    mechanicalExposureSignals: [],
  }
  const profile = {
    chemicalTreatments: ["natural" as const],
    hairSurface: "smooth" as const,
    elasticResponse: "stretches_bounces" as const,
    currentConcerns: [],
  }

  const rough = assess(profile, roughRoutine)
  const gentleOrNoTowel = assess(profile, gentleOrNoTowelRoutine)

  assert.equal(rough.damage.mechanicalLevel, "moderate")
  assert.deepEqual(rough.damage.mechanicalSignals, ["towel_rough_rubbing"])
  assert.equal(rough.damage.repairPriority, "medium")
  assert.equal(gentleOrNoTowel.damage.mechanicalLevel, "none")
  assert.deepEqual(gentleOrNoTowel.damage.mechanicalSignals, [])
})

test("INITIAL-13: hair loss is isolated from repair and exposes the limited-evidence boundary", () => {
  const assessment = assess({
    chemicalTreatments: ["natural"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    currentConcerns: ["hair_loss_or_thinning"],
  })
  assert.deepEqual(assessment.hairLossBoundary, {
    state: "present",
    sourceFacts: ["hair_loss_or_thinning"],
    redFlagDetail: "unassessed",
    cosmeticClaimBoundary: "limited_evidence_only",
  })
  assert.equal(assessment.damage.structuralSignals.includes("hair_loss_or_thinning"), false)
})
