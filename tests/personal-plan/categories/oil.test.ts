import assert from "node:assert/strict"
import test from "node:test"

import { buildOilDecision } from "../../../src/lib/personal-plan/categories/oil"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import type {
  OilFunctionalBenefit,
  PlanCareWeight,
  PlanCategoryDecision,
} from "../../../src/lib/personal-plan/types"
import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizSubmissionEnvelope,
} from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decision(overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {}) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: {
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      texture: "straight",
      thickness: "normal",
      density: "medium",
      goals: ["scalp_balance"],
      currentConcerns: [],
      concernRecurrence: undefined,
      hairLength: "long",
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
      scalpOiliness: "balanced",
      scalpConcerns: [],
      ...overrides,
    },
  }
  const profile = buildPlanProfile(envelope, {
    artifactId: "66666666-6666-4666-8666-666666666666",
    projection: "initial_quiz",
  })
  return buildOilDecision(profile, buildPlanNeedAssessment(profile))
}

function target(result: PlanCategoryDecision) {
  assert.equal(result.target?.category, "oil")
  return result.target
}

function roleTarget(
  result: PlanCategoryDecision,
  role: "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish",
) {
  const found = target(result).roleTargets.find((item) => item.role === role)
  assert.ok(found, `missing Oil role target ${role}`)
  return found
}

const roleRows: ReadonlyArray<{
  name: string
  overrides: Partial<PersonalPlanQuizAnswers>
  role: "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
  tier: "basis" | "optional"
  benefit: OilFunctionalBenefit
}> = [
  {
    name: "oil.dry_finish.low_shine",
    overrides: { currentConcerns: ["low_shine"] },
    role: "dry_finish",
    tier: "basis",
    benefit: "shine",
  },
  {
    name: "oil.dry_finish.shine_goal_direct",
    overrides: { goals: ["shine"], currentConcerns: [] },
    role: "dry_finish",
    tier: "basis",
    benefit: "shine",
  },
  {
    name: "oil.dry_finish.shine_goal_support",
    overrides: { goals: ["shine"], currentConcerns: ["dry_lengths"] },
    role: "dry_finish",
    tier: "optional",
    benefit: "shine",
  },
  {
    name: "oil.dry_finish.frizz_flyaways",
    overrides: { currentConcerns: ["frizz_flyaways"] },
    role: "dry_finish",
    tier: "optional",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.dry_finish.frizz_goal",
    overrides: { goals: ["frizz_surface"], currentConcerns: [] },
    role: "dry_finish",
    tier: "optional",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.dry_finish.dry_rough_support",
    overrides: { currentConcerns: ["dry_lengths"], hairSurface: "rough" },
    role: "dry_finish",
    tier: "optional",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.pre_wash_fibre_treatment.breakage_corroborated",
    overrides: { currentConcerns: ["breakage"], chemicalTreatments: ["colored"] },
    role: "pre_wash_fibre_treatment",
    tier: "basis",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.dry_rough_treated",
    overrides: {
      currentConcerns: ["dry_lengths"],
      hairSurface: "rough",
      chemicalTreatments: ["lightened"],
    },
    role: "pre_wash_fibre_treatment",
    tier: "basis",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.breakage_alone",
    overrides: { currentConcerns: ["breakage"], chemicalTreatments: ["natural"] },
    role: "pre_wash_fibre_treatment",
    tier: "optional",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.split_ends_support",
    overrides: { currentConcerns: ["split_ends"] },
    role: "pre_wash_fibre_treatment",
    tier: "optional",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.dry_rough",
    overrides: { currentConcerns: ["dry_lengths"], hairSurface: "rough" },
    role: "pre_wash_fibre_treatment",
    tier: "optional",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.structural_exposure_only",
    overrides: { currentConcerns: [], chemicalTreatments: ["permed"] },
    role: "pre_wash_fibre_treatment",
    tier: "optional",
    benefit: "slip_manageability",
  },
  {
    name: "oil.pre_wash_fibre_treatment.goal_corroborated",
    overrides: { goals: ["strength_ends"], currentConcerns: ["split_ends"] },
    role: "pre_wash_fibre_treatment",
    tier: "optional",
    benefit: "slip_manageability",
  },
  {
    name: "oil.leave_on_fibre_conditioning.coily_frizz_layer",
    overrides: { texture: "coily", currentConcerns: ["frizz_flyaways"] },
    role: "leave_on_fibre_conditioning",
    tier: "basis",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.leave_on_fibre_conditioning.frizz_direct",
    overrides: { currentConcerns: ["frizz_flyaways"] },
    role: "leave_on_fibre_conditioning",
    tier: "basis",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.leave_on_fibre_conditioning.frizz_support",
    overrides: { currentConcerns: ["frizz_flyaways"], hairSurface: "rough" },
    role: "leave_on_fibre_conditioning",
    tier: "optional",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.leave_on_fibre_conditioning.dry_rough_support",
    overrides: { currentConcerns: ["dry_lengths"], hairSurface: "rough" },
    role: "leave_on_fibre_conditioning",
    tier: "optional",
    benefit: "smoothing_frizz_control",
  },
  {
    name: "oil.leave_on_fibre_conditioning.tangling_support",
    overrides: { currentConcerns: ["tangling"] },
    role: "leave_on_fibre_conditioning",
    tier: "optional",
    benefit: "slip_manageability",
  },
]

for (const row of roleRows) {
  test(`${row.name} / parameterized Stage-1 Oil role row`, () => {
    const result = decision(row.overrides)
    const role = roleTarget(result, row.role)

    assert.equal(role.tier, row.tier)
    assert.ok(
      role.functionalBenefits.some(
        (item) => item.benefit === (row.benefit satisfies OilFunctionalBenefit),
      ),
    )
    assert.ok(result.reasons.some((reason) => reason.id === row.name))
  })
}

test("oil-fine-low-shine / dry finish basis with light target", () => {
  const result = decision({ thickness: "fine", currentConcerns: ["low_shine"] })

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["dry_finish"])
  assert.equal(roleTarget(result, "dry_finish").weight, "light" satisfies PlanCareWeight)
  assert.deepEqual(result.frequency, {
    kind: "role_based_wash_linked",
    roleFrequencies: [
      { role: "dry_finish", tier: "basis", cadence: "finish_after_every_compatible_wash" },
    ],
  })
})

test("oil-fine-healthy-frizz / damp basis plus dry optional", () => {
  const result = decision({ thickness: "fine", currentConcerns: ["frizz_flyaways"] })

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["leave_on_fibre_conditioning", "dry_finish"])
  assert.equal(roleTarget(result, "leave_on_fibre_conditioning").tier, "basis")
  assert.equal(roleTarget(result, "dry_finish").tier, "optional")
})

test("oil-treated-dry-rough / pre-wash basis with damp and dry support", () => {
  const result = decision({
    thickness: "coarse",
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    chemicalTreatments: ["lightened"],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(roleTarget(result, "pre_wash_fibre_treatment").tier, "basis")
  assert.equal(roleTarget(result, "leave_on_fibre_conditioning").tier, "optional")
  assert.equal(roleTarget(result, "dry_finish").tier, "optional")
})

test("oil-definition-only / Styling ownership retained", () => {
  const result = decision({ texture: "wavy", goals: ["shape_definition"], currentConcerns: [] })

  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.roles, [])
})

test("oil-load-sensitive-weight / lightest normal ideal by thickness", () => {
  const fine = roleTarget(
    decision({ thickness: "fine", currentConcerns: ["low_shine", "low_volume_or_weighed_down"] }),
    "dry_finish",
  )
  const normal = roleTarget(
    decision({ thickness: "normal", currentConcerns: ["low_shine", "low_volume_or_weighed_down"] }),
    "dry_finish",
  )
  const coarse = roleTarget(
    decision({ thickness: "coarse", currentConcerns: ["low_shine", "low_volume_or_weighed_down"] }),
    "dry_finish",
  )

  assert.equal(fine.weight, "light")
  assert.equal(normal.weight, "light")
  assert.equal(coarse.weight, "medium")
})

test("oil-two-basis-roles / shine plus healthy frizz keeps both basis roles", () => {
  const result = decision({ currentConcerns: ["low_shine", "frizz_flyaways"] })

  assert.equal(result.needTier, "basis")
  assert.equal(roleTarget(result, "dry_finish").tier, "basis")
  assert.equal(roleTarget(result, "leave_on_fibre_conditioning").tier, "basis")
})

test("oil-deterministic-recompute / byte-stable facts", () => {
  const first = decision({ currentConcerns: ["low_shine", "frizz_flyaways"] })
  const second = decision({ currentConcerns: ["low_shine", "frizz_flyaways"] })

  assert.deepEqual(first, second)
})

test("oil-breakage-alone / no self-corroboration through combined damage score", () => {
  const result = decision({ currentConcerns: ["breakage"], hairSurface: "rough" })

  assert.equal(roleTarget(result, "pre_wash_fibre_treatment").tier, "optional")
  assert.equal(result.frequency?.kind, "role_based_wash_linked")
  if (result.frequency?.kind === "role_based_wash_linked") {
    assert.equal(
      result.frequency.roleFrequencies.find((item) => item.role === "pre_wash_fibre_treatment")
        ?.cadence,
      "optional_allocation_deferred_to_day_type",
    )
  }
})

test("oil-breakage-chemical-confirmed / chemical driver corroborates basis", () => {
  const result = decision({ currentConcerns: ["breakage"], chemicalTreatments: ["colored"] })

  assert.equal(roleTarget(result, "pre_wash_fibre_treatment").tier, "basis")
  assert.ok(
    result.reasons.some(
      (reason) => reason.id === "oil.pre_wash_fibre_treatment.breakage_corroborated",
    ),
  )
})

test("oil-breakage-snap-confirmed / brittle snapping corroborates basis", () => {
  const result = decision({ currentConcerns: ["breakage"], elasticResponse: "snaps" })

  assert.equal(roleTarget(result, "pre_wash_fibre_treatment").tier, "basis")
})

test("oil-scalp-concern-with-length-job / scalp concern does not suppress length role", () => {
  const result = decision({
    currentConcerns: ["low_shine"],
    scalpOiliness: "oily",
    scalpConcerns: ["irritated"],
  })

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["dry_finish"])
  assert.ok(result.reasons.every((reason) => !reason.id.includes("scalp_treatment")))
})

test("oil-coily-frizz-layer / coily plus frizz keeps damp Oil basis", () => {
  const result = decision({ texture: "coily", currentConcerns: ["frizz_flyaways"] })

  assert.equal(roleTarget(result, "leave_on_fibre_conditioning").tier, "basis")
  assert.ok(
    result.reasons.some(
      (reason) => reason.id === "oil.leave_on_fibre_conditioning.coily_frizz_layer",
    ),
  )
})

test("oil-three-basis-roles / independent triple-role basis", () => {
  const result = decision({
    texture: "coily",
    thickness: "coarse",
    currentConcerns: ["breakage", "frizz_flyaways", "low_shine"],
    chemicalTreatments: ["colored"],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(roleTarget(result, "pre_wash_fibre_treatment").tier, "basis")
  assert.equal(roleTarget(result, "leave_on_fibre_conditioning").tier, "basis")
  assert.equal(roleTarget(result, "dry_finish").tier, "basis")
  assert.deepEqual(result.roles, [
    "pre_wash_fibre_treatment",
    "leave_on_fibre_conditioning",
    "dry_finish",
  ])
})
