import assert from "node:assert/strict"
import test from "node:test"

import { buildConditionerDecision } from "../../../src/lib/personal-plan/categories/conditioner"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import type {
  ConditionerFunctionalNeed,
  PlanCategoryDecision,
  PlanCareDirection,
  PlanCareWeight,
  PlanRepairSupportLevel,
} from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decision(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  damagePatch: Partial<ReturnType<typeof buildPlanNeedAssessment>["damage"]> = {},
) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: {
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      texture: "straight",
      thickness: "normal",
      density: "medium",
      goals: ["moisture"],
      currentConcerns: [],
      concernRecurrence: undefined,
      hairLength: "long",
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
      ...overrides,
    },
  }
  const profile = buildPlanProfile(envelope, {
    artifactId: "44444444-4444-4444-8444-444444444444",
    projection: "initial_quiz",
  })
  const assessments = buildPlanNeedAssessment(profile)
  return buildConditionerDecision(profile, {
    ...assessments,
    damage: { ...assessments.damage, ...damagePatch },
  })
}

function target(decision: PlanCategoryDecision) {
  assert.equal(decision.target?.category, "conditioner")
  return decision.target
}

test("conditioner-very-short-no-care-signal / conditioner.inclusion.very_short_not_needed", () => {
  const result = decision({
    hairLength: "very_short",
    goals: ["shine"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
  })

  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.roles, [])
  assert.equal(result.target, null)
  assert.equal(result.frequency, null)
})

test("conditioner-very-short-chemical-dryness / conditioner.inclusion.very_short_optional", () => {
  const result = decision({
    hairLength: "very_short",
    thickness: "fine",
    currentConcerns: ["dry_lengths"],
    hairSurface: "smooth",
    elasticResponse: "snaps",
    chemicalTreatments: ["colored"],
  })

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["conditioner_rinse_out"])
  assert.equal(target(result).weight, "light" satisfies PlanCareWeight)
  assert.equal(target(result).careDirection, "moisture" satisfies PlanCareDirection)
  assert.deepEqual(
    result.reasons.map((reason) => reason.id),
    [
      "conditioner.inclusion.very_short_optional",
      "conditioner.weight.thickness",
      "conditioner.balance.elasticity_snaps",
      "conditioner.repair.medium",
    ],
  )
})

test("conditioner-fine-dry-lengths / conditioner.inclusion.length_basis", () => {
  const result = decision({
    thickness: "fine",
    currentConcerns: ["dry_lengths"],
    hairSurface: "smooth",
    elasticResponse: "snaps",
  })

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["conditioner_rinse_out"])
  assert.equal(target(result).weight, "light" satisfies PlanCareWeight)
  assert.equal(target(result).careDirection, "moisture" satisfies PlanCareDirection)
  assert.equal(target(result).repairSupportLevel, "low" satisfies PlanRepairSupportLevel)
  assert.deepEqual(result.frequency, {
    kind: "after_each_eligible_wash",
    roles: ["conditioner_rinse_out"],
    dependsOn: "wet_wash_total",
    placementState: "known_after_refined_wash_cadence",
  })
})

test("conditioner-coarse-curly-damaged / conditioner.weight.control + high repair", () => {
  const result = decision({
    texture: "curly",
    thickness: "coarse",
    goals: ["shape_definition", "frizz_surface"],
    currentConcerns: ["frizz_flyaways", "hair_damage"],
    hairSurface: "rough",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["lightened"],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(target(result).weight, "rich" satisfies PlanCareWeight)
  assert.equal(target(result).careDirection, "protein" satisfies PlanCareDirection)
  assert.equal(target(result).repairSupportLevel, "high" satisfies PlanRepairSupportLevel)
  assert.deepEqual(
    target(result).functionalNeeds.map((item) => item.need),
    ["frizz_smoothing", "definition_support"],
  )
})

test("conditioner-volume-up / conditioner.weight.volume_up lowers target without deleting baseline", () => {
  const result = decision({
    texture: "straight",
    thickness: "coarse",
    goals: ["volume_balance"],
    currentConcerns: ["low_volume_or_weighed_down"],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(target(result).weight, "medium" satisfies PlanCareWeight)
  assert.ok(
    target(result).functionalNeeds.some(
      (item) =>
        item.need === ("volume_support" satisfies ConditionerFunctionalNeed) &&
        item.priority === 3 &&
        item.ownership === "supporting",
    ),
  )
})

test("conditioner repair support consumes shared lane severity", () => {
  const medium = decision(
    { currentConcerns: [], hairSurface: "smooth", chemicalTreatments: ["natural"] },
    { repairPriority: "medium", mechanicalLevel: "moderate", mechanicalSignals: ["towel_rubbing"] },
  )
  const high = decision(
    { currentConcerns: [], hairSurface: "smooth", chemicalTreatments: ["natural"] },
    { repairPriority: "high", heatLevel: "severe", heatSignals: ["heat_frequency:daily"] },
  )

  assert.equal(target(medium).repairSupportLevel, "medium")
  assert.equal(target(high).repairSupportLevel, "high")
})
