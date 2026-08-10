import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import { computeShampooDecision } from "../../../src/lib/personal-plan/categories/shampoo"
import type { PlanRoutineContext } from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decision(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  routine?: Partial<PlanRoutineContext>,
) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  }
  const profile = buildPlanProfile(envelope, {
    artifactId: "40000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
    routine: routine
      ? {
          ...buildPlanProfile(envelope, {
            artifactId: "40000000-0000-4000-8000-000000000001",
            projection: "initial_quiz",
          }).routine,
          ...routine,
        }
      : undefined,
  })
  return computeShampooDecision(profile, buildPlanNeedAssessment(profile))
}

test("shampoo-balanced-retained / shampoo.inclusion.basis + shampoo.role.everyday + shampoo.cadence.quiz_starting_target", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })

  assert.equal(result.category, "shampoo")
  assert.equal(result.resolution, "resolved")
  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["shampoo_everyday"])
  assert.deepEqual(result.deferredFacts, ["shampoo_frequency"])
  assert.deepEqual(result.target, {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: "balanced",
    everydayConstraint: "standard",
    requiresTargetedDandruffCapability: false,
  })
  assert.deepEqual(result.frequency, {
    kind: "wet_wash_total",
    mode: "quiz_starting_target",
    target: "weekly_2x",
    allowedRange: { min: "weekly_1x", max: "weekly_3_4x" },
    specialWashSubstitution: true,
  })
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.inclusion.basis"))
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.cadence.quiz_starting_target"))
})

test("shampoo-oily-frequency-low / shampoo.cadence.nearest_boundary when current frequency is below range", () => {
  const result = decision(
    { scalpOiliness: "oily", scalpConcerns: [] },
    { shampooFrequency: { state: "known", value: "weekly_1x" } },
  )

  assert.equal(result.needTier, "basis")
  assert.equal(result.deferredFacts.length, 0)
  assert.equal(result.frequency?.kind, "wet_wash_total")
  if (result.frequency?.kind !== "wet_wash_total") return
  assert.equal(result.frequency.mode, "nearest_boundary")
  assert.equal(result.frequency.target, "weekly_2x")
  assert.deepEqual(result.frequency.allowedRange, { min: "weekly_2x", max: "weekly_5_6x" })
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.cadence.nearest_boundary"))
})

test("shampoo-balanced-retained / in-range current frequency is retained", () => {
  const result = decision(
    { scalpOiliness: "balanced", scalpConcerns: [] },
    { shampooFrequency: { state: "known", value: "weekly_2x" } },
  )
  assert.equal(result.frequency?.kind, "wet_wash_total")
  if (result.frequency?.kind === "wet_wash_total") {
    assert.equal(result.frequency.mode, "retained_current")
    assert.equal(result.frequency.target, "weekly_2x")
  }
})

test("shampoo-dandruff-owned / shampoo.role.dandruff adds the targeted role without Stage-2 product matching", () => {
  const result = decision({
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
  })

  assert.deepEqual(result.roles, ["shampoo_everyday", "shampoo_dandruff"])
  assert.deepEqual(result.target && "roles" in result.target ? result.target.roles : [], [
    "shampoo_everyday",
    "shampoo_dandruff",
  ])
  assert.equal(
    result.target && "requiresTargetedDandruffCapability" in result.target
      ? result.target.requiresTargetedDandruffCapability
      : false,
    true,
  )
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.role.dandruff"))
})

test("shampoo-dandruff-irritated / compositional targeted dandruff plus irritation-compatible constraints", () => {
  const result = decision({
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff", "irritated"],
  })

  assert.deepEqual(result.roles, ["shampoo_everyday", "shampoo_dandruff"])
  assert.equal(
    result.target && "everydayConstraint" in result.target
      ? result.target.everydayConstraint
      : null,
    "irritation_compatible",
  )
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.role.irritated"))
})

test("shampoo-irritation-only / shampoo.role.irritated keeps everyday role and no dandruff role", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated"],
  })

  assert.deepEqual(result.roles, ["shampoo_everyday"])
  assert.equal(
    result.target && "everydayConstraint" in result.target
      ? result.target.everydayConstraint
      : null,
    "irritation_compatible",
  )
  assert.equal(
    result.target && "requiresTargetedDandruffCapability" in result.target
      ? result.target.requiresTargetedDandruffCapability
      : true,
    false,
  )
})

test("shampoo-dry-flakes-only / shampoo.role.dry_flakes uses gentle dry-scalp everyday route without dandruff role", () => {
  const result = decision({
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
  })

  assert.deepEqual(result.roles, ["shampoo_everyday"])
  assert.equal(
    result.target && "everydayConstraint" in result.target
      ? result.target.everydayConstraint
      : null,
    "gentle_dry_scalp",
  )
  assert.equal(result.frequency?.kind, "wet_wash_total")
  if (result.frequency?.kind === "wet_wash_total") {
    assert.equal(result.frequency.target, "weekly_1x")
  }
})

test("shampoo-combined-dandruff / compositional roles retain gentle dry-scalp constraint", () => {
  const combined = decision({
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff", "dry_dandruff"],
  })
  assert.deepEqual(combined.roles, ["shampoo_everyday", "shampoo_dandruff"])
  assert.equal(combined.target?.category, "shampoo")
  if (combined.target?.category === "shampoo") {
    assert.equal(combined.target.everydayConstraint, "gentle_dry_scalp")
  }
  assert.ok(combined.reasons.some((reason) => reason.id === "shampoo.role.dry_flakes"))

  const irritated = decision({
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff", "dry_dandruff", "irritated"],
  })
  assert.equal(irritated.target?.category, "shampoo")
  if (irritated.target?.category === "shampoo") {
    assert.equal(irritated.target.everydayConstraint, "gentle_dry_scalp_and_irritation_compatible")
  }
})

test("shampoo-quiz-starting-target / explicit does_not_wash still keeps the recommended scalp-led target", () => {
  const result = decision(
    { scalpOiliness: "balanced", scalpConcerns: [] },
    { shampooFrequency: { state: "known", value: "does_not_wash" } },
  )

  assert.equal(result.frequency?.kind, "wet_wash_total")
  if (result.frequency?.kind !== "wet_wash_total") return
  assert.equal(result.frequency.mode, "nearest_boundary")
  assert.equal(result.frequency.target, "weekly_1x")
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.cadence.nearest_boundary"))
})

test("shampoo-stable-recompute / identical Stage-1 inputs serialize byte-stably", () => {
  const first = decision({ scalpOiliness: "dry", scalpConcerns: ["dry_dandruff", "irritated"] })
  const second = decision({ scalpOiliness: "dry", scalpConcerns: ["dry_dandruff", "irritated"] })

  assert.deepEqual(second, first)
})

test("shampoo-deep-cleansing-substitution / Shampoo total wash target is marked substitutable", () => {
  const result = decision({ scalpOiliness: "oily", scalpConcerns: [] })

  assert.equal(result.frequency?.kind, "wet_wash_total")
  if (result.frequency?.kind === "wet_wash_total") {
    assert.equal(result.frequency.specialWashSubstitution, true)
  }
  assert.ok(result.reasons.some((reason) => reason.id === "shampoo.cadence.substitution"))
})
