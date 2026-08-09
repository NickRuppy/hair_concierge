import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import { buildMaskDecision } from "../../../src/lib/personal-plan/categories/mask"
import type {
  PlanDamageAssessment,
  PlanProfile,
  SupportedPersonalPlanQuizEnvelope,
} from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function maskTarget(decision: ReturnType<typeof buildMaskDecision>) {
  assert.equal(decision.target?.category, "mask")
  return decision.target
}

function profile(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  envelopeOverrides: Partial<SupportedPersonalPlanQuizEnvelope> = {},
): PlanProfile {
  const envelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    ...envelopeOverrides,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  } as SupportedPersonalPlanQuizEnvelope

  return buildPlanProfile(envelope, {
    artifactId: "55555555-5555-4555-8555-555555555555",
    projection: "initial_quiz",
  })
}

function decide(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  assessmentPatch: Partial<PlanDamageAssessment> = {},
) {
  const planProfile = profile(overrides)
  const assessment = buildPlanNeedAssessment(planProfile)
  return buildMaskDecision(planProfile, {
    ...assessment.damage,
    ...assessmentPatch,
  })
}

test("mask-no-job: mask.inclusion.no_job returns not_needed", () => {
  const decision = decide({
    texture: "straight",
    thickness: "normal",
    goals: ["volume_balance"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "not_needed")
  assert.equal(decision.target, null)
  assert.equal(decision.frequency, null)
  assert.deepEqual(
    decision.reasons.map((reason) => reason.id),
    ["mask.inclusion.no_job"],
  )
})

test("mask-one-observed-need: mask.inclusion.one_observed_need keeps dry lengths optional", () => {
  const decision = decide({
    currentConcerns: ["dry_lengths"],
    goals: ["moisture"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(decision.frequency?.kind, "unscheduled_as_needed")
  assert.deepEqual(
    decision.reasons.map((reason) => reason.id),
    ["mask.inclusion.one_observed_need", "mask.reason.dry_lengths"],
  )
})

test("mask-two-observed-needs: mask.inclusion.two_observed_needs creates high weekly Basis", () => {
  const decision = decide({
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "basis")
  assert.equal(maskTarget(decision).needStrength, "high")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "weekly_1x")
    assert.equal(decision.frequency.placementState, "blocked_until_wash_frequency_known")
  }
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.two_observed_needs"))
})

test("mask-observed-plus-moderate-exposure: mask.inclusion.observed_plus_exposure creates standard Basis", () => {
  const decision = decide(
    {
      currentConcerns: ["tangling"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    },
    {
      mechanicalLevel: "moderate",
      mechanicalSignals: ["mechanical_level:moderate"],
    },
  )

  assert.equal(decision.needTier, "basis")
  assert.equal(maskTarget(decision).needStrength, "standard")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "biweekly_1x")
  }
})

test("mask-rough-rubbing-only: moderate mechanical exposure alone remains optional", () => {
  const decision = decide(
    {
      currentConcerns: [],
      goals: ["volume_balance"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
      texture: "straight",
    },
    {
      mechanicalLevel: "moderate",
      mechanicalSignals: ["towel_rough_rubbing"],
      repairPriority: "medium",
    },
  )

  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.exposure_only"))
})

test("mask-frequent-ordinary-airflow: route-aware exposure may support, but alone stays optional", () => {
  const frequentOrdinaryAirflow = {
    state: "known" as const,
    events: [
      {
        id: "frequent-ordinary-airflow",
        tool: "hair_dryer" as const,
        route: "ordinary_airflow" as const,
        frequency: "weekly_3_4x" as const,
        sourceRuleIds: ["test.ordinary-airflow"],
      },
    ],
  }
  const exposureOnly = decide(
    {
      currentConcerns: [],
      goals: ["volume_balance"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
      texture: "straight",
    },
    { ordinaryAirflowExposure: frequentOrdinaryAirflow },
  )
  const observedPlusExposure = decide(
    {
      currentConcerns: ["tangling"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    },
    { ordinaryAirflowExposure: frequentOrdinaryAirflow },
  )

  assert.equal(exposureOnly.needTier, "optional")
  assert.equal(observedPlusExposure.needTier, "basis")
})

test("mask-rare-heat-plus-one-need stays optional until shared Heat level is moderate", () => {
  const decision = decide(
    {
      currentConcerns: ["tangling"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    },
    { heatLevel: "low", heatSignals: ["heat_route:ordinary_airflow"] },
  )

  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.one_observed_need"))
})

test("mask-observed-plus-high-repair: mask.inclusion.observed_plus_exposure creates high Basis", () => {
  const decision = decide({
    currentConcerns: [],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["lightened"],
  })

  assert.equal(decision.needTier, "basis")
  assert.equal(maskTarget(decision).needStrength, "high")
  assert.equal(maskTarget(decision).repairSupportLevel, "high")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "weekly_1x")
  }
})

test("mask-high-fine-weight-sensitive: fine weighed-down high need becomes light and biweekly", () => {
  const decision = decide({
    thickness: "fine",
    currentConcerns: ["dry_lengths", "low_volume_or_weighed_down"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(maskTarget(decision).weight, "light")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "biweekly_1x")
  }
})

test("mask-standard-weight-sensitive: standard weighed-down Basis becomes every three weeks", () => {
  const decision = decide(
    {
      thickness: "normal",
      currentConcerns: ["tangling", "low_volume_or_weighed_down"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    },
    {
      mechanicalLevel: "moderate",
      mechanicalSignals: ["mechanical_level:moderate"],
    },
  )

  assert.equal(maskTarget(decision).weight, "light")
  assert.equal(maskTarget(decision).needStrength, "standard")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "every_3_weeks")
  }
})

test("mask-exposure-only: mask.inclusion.exposure_only stays optional", () => {
  const decision = decide({
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["colored"],
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(maskTarget(decision).repairSupportLevel, "medium")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.exposure_only"))
})

test("mask-elasticity-only: mask.inclusion.non_balanced_elasticity is optional and guides care direction", () => {
  const decision = decide({
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "snaps",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(maskTarget(decision).careDirection, "moisture")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "mask.inclusion.non_balanced_elasticity"),
  )
})

test("mask-lightened-only: mask.inclusion.exposure_only keeps high repair optional", () => {
  const decision = decide({
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["lightened"],
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(maskTarget(decision).repairSupportLevel, "high")
  assert.equal(decision.frequency?.kind, "unscheduled_as_needed")
})

test("mask-lightened-rough: mask.inclusion.observed_plus_exposure creates high repair Basis", () => {
  const decision = decide({
    currentConcerns: [],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["lightened"],
  })

  assert.equal(decision.needTier, "basis")
  assert.equal(maskTarget(decision).repairSupportLevel, "high")
  assert.equal(maskTarget(decision).needStrength, "high")
})

test("mask-hair-damage-only: mask.inclusion.one_observed_need keeps hair damage optional", () => {
  const decision = decide({
    currentConcerns: ["hair_damage"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.reason.hair_damage"))
})

test("mask-hair-damage-plus-exposure: mask.inclusion.observed_plus_exposure creates Basis", () => {
  const decision = decide({
    currentConcerns: ["hair_damage"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["colored"],
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.reason.hair_damage"))
})

test("mask-split-ends-only: mask.inclusion.split_ends_supporting is optional and supporting-only", () => {
  const decision = decide({
    currentConcerns: ["split_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(maskTarget(decision).repairSupportLevel, "medium")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.split_ends_supporting"))
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.reason.split_ends_supporting"))
})

test("mask-split-ends-plus-exposure remains optional", () => {
  const decision = decide({
    currentConcerns: ["split_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["colored"],
  })
  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.some((reason) => reason.id === "mask.inclusion.split_ends_supporting"))
})

test("mask-normalized-split-only: normalized V2 split route is still optional only", () => {
  const decision = decide({
    currentConcerns: ["split_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.every((reason) => reason.id !== "mask.reason.breakage"))
})

test("mask-missing-wash-frequency: Basis tier stays visible while placement is blocked", () => {
  const decision = decide({
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "basis")
  assert.deepEqual(decision.deferredFacts, ["shampoo_frequency"])
  assert.equal(decision.resolution, "partially_resolved")
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.placementState, "blocked_until_wash_frequency_known")
  }
})

test("mask-base-cadence-faster-than-washes: refined known wash frequency can place regular Mask cadence", () => {
  const base = profile({
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })
  const refinedProfile: PlanProfile = {
    ...base,
    source: { ...base.source, projection: "refined_post_plan" },
    routine: {
      ...base.routine,
      shampooFrequency: { state: "known", value: "monthly_1x" },
    },
  }
  const decision = buildMaskDecision(refinedProfile, buildPlanNeedAssessment(refinedProfile).damage)

  assert.equal(decision.needTier, "basis")
  assert.deepEqual(decision.deferredFacts, [])
  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.placementState, "placed_on_eligible_wash")
  }
})

test("mask-cadence-placement-tie: Stage 1 keeps category cadence stable and leaves day tie to Stage 3", () => {
  const decision = decide({
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.frequency?.kind, "mask_regular_interval")
  if (decision.frequency?.kind === "mask_regular_interval") {
    assert.equal(decision.frequency.baseInterval, "weekly_1x")
  }
})

test("mask-hair-loss-only: hair loss creates no Mask need", () => {
  const decision = decide({
    goals: ["volume_balance"],
    currentConcerns: ["hair_loss_or_thinning"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(decision.needTier, "not_needed")
  assert.ok(decision.reasons.every((reason) => reason.id !== "mask.reason.hair_loss_or_thinning"))
})

test("mask-concern-recurrence-only: recurrence never promotes tier or cadence", () => {
  const recurrent = decide({
    goals: ["volume_balance"],
    currentConcerns: [],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })
  const nonRecurrent = decide({
    goals: ["volume_balance"],
    currentConcerns: [],
    concernRecurrence: { concernId: "dry_lengths", frequency: "rather_not" },
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(recurrent.needTier, "not_needed")
  assert.deepEqual(recurrent.frequency, nonRecurrent.frequency)
})
