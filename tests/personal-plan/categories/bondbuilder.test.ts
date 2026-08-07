import assert from "node:assert/strict"
import test from "node:test"

import { buildBondbuilderDecision } from "../../../src/lib/personal-plan/categories/bondbuilder"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import type {
  PlanDamageAssessment,
  PlanProfile,
  SupportedPersonalPlanQuizEnvelope,
} from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

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
    artifactId: "66666666-6666-4666-8666-666666666666",
    projection: "initial_quiz",
  })
}

function decide(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  assessmentPatch: Partial<PlanDamageAssessment> = {},
) {
  const planProfile = profile(overrides)
  const assessment = buildPlanNeedAssessment(planProfile)
  return buildBondbuilderDecision(planProfile, {
    ...assessment.damage,
    ...assessmentPatch,
  })
}

test("bondbuilder-lightened-basis: bondbuilder.inclusion.lightened creates Basis protocol course", () => {
  const decision = decide({
    chemicalTreatments: ["lightened"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.equal(decision.target?.category, "bondbuilder")
  assert.equal(decision.frequency?.kind, "product_protocol_course")
  assert.ok(decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.lightened"))
})

test("bondbuilder-straightened-basis: bondbuilder.inclusion.chemical_straightening creates Basis", () => {
  const decision = decide({
    chemicalTreatments: ["chemically_straightened"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.chemical_straightening"),
  )
})

test("bondbuilder-colored-only: bondbuilder.inclusion.colored_only stays optional", () => {
  const decision = decide({
    chemicalTreatments: ["colored"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "optional")
  assert.equal(decision.frequency?.kind, "product_protocol_course")
  assert.ok(decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.colored_only"))
})

test("bondbuilder-permed-only: bondbuilder.inclusion.permed_only stays optional", () => {
  const decision = decide({
    chemicalTreatments: ["permed"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "optional")
  assert.ok(decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.permed_only"))
})

test("bondbuilder-colored-permed: bondbuilder.inclusion.colored_and_permed creates Basis", () => {
  const decision = decide({
    chemicalTreatments: ["colored", "permed"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.colored_and_permed"),
  )
})

test("bondbuilder-colored-breakage: bondbuilder.inclusion.colored_with_damage creates Basis", () => {
  const decision = decide({
    chemicalTreatments: ["colored"],
    currentConcerns: ["breakage"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.colored_with_damage"),
  )
})

test("bondbuilder-permed-rough: bondbuilder.inclusion.permed_with_damage creates Basis", () => {
  const decision = decide({
    chemicalTreatments: ["permed"],
    currentConcerns: [],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.permed_with_damage"),
  )
})

test("bondbuilder-breakage-only: bondbuilder.inclusion.one_strong_indicator stays optional", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: ["breakage"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "optional")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.one_strong_indicator"),
  )
})

test("bondbuilder-breakage-rough: bondbuilder.inclusion.two_strong_indicators creates Basis", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: ["breakage"],
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.two_strong_indicators"),
  )
})

test("bondbuilder-hair-damage-snaps: two strong indicators create Basis", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: ["hair_damage"],
    hairSurface: "smooth",
    elasticResponse: "snaps",
  })

  assert.equal(decision.needTier, "basis")
  assert.ok(decision.reasons.some((reason) => reason.id === "bondbuilder.reason.hair_damage"))
  assert.ok(decision.reasons.some((reason) => reason.id === "bondbuilder.reason.snaps"))
})

test("bondbuilder-breakage-split: split ends do not turn one strong indicator into Basis", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: ["breakage", "split_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "optional")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.reason.split_ends_context"),
  )
})

test("bondbuilder-split-only: split ends alone are not a Bondbuilder job", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: ["split_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "not_needed")
  assert.equal(decision.target, null)
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.reason.split_ends_context"),
  )
})

test("bondbuilder-strength-goal-only: strength goal is context only", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: [],
    goals: ["strength_ends"],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.needTier, "not_needed")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.reason.strength_goal_context"),
  )
})

test("bondbuilder-stretches-stays-only: stretches_stays has no tier effect", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_stays",
  })

  assert.equal(decision.needTier, "not_needed")
  assert.equal(decision.frequency, null)
})

test("bondbuilder-severe-heat-only: Heat exposure does not create Bondbuilder need", () => {
  const decision = decide(
    {
      chemicalTreatments: ["natural"],
      currentConcerns: [],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
    },
    { heatSignals: ["heat_level:severe"] },
  )

  assert.equal(decision.needTier, "not_needed")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.reason.heat_prevention_primary"),
  )
})

test("bondbuilder-high-repair-dedup: derived high repair priority plus breakage remains optional", () => {
  const decision = decide(
    {
      chemicalTreatments: ["natural"],
      currentConcerns: ["breakage"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
    },
    { repairPriority: "high" },
  )

  assert.equal(decision.needTier, "optional")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.inclusion.one_strong_indicator"),
  )
})

test("bondbuilder-v2-combined-migration: historical combined concern remains split-only context", () => {
  const envelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    version: 2,
    answers: {
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      currentConcerns: ["breakage_or_split_ends"],
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    },
  } as SupportedPersonalPlanQuizEnvelope
  const planProfile = buildPlanProfile(envelope, {
    artifactId: "77777777-7777-4777-8777-777777777777",
    projection: "initial_quiz",
  })
  const decision = buildBondbuilderDecision(
    planProfile,
    buildPlanNeedAssessment(planProfile).damage,
  )

  assert.equal(decision.needTier, "not_needed")
  assert.ok(
    decision.reasons.some((reason) => reason.id === "bondbuilder.reason.split_ends_context"),
  )
  assert.ok(decision.reasons.every((reason) => reason.id !== "bondbuilder.reason.breakage"))
})

test("bondbuilder-complete-neutral-profile resolves deterministically", () => {
  const decision = decide({
    chemicalTreatments: ["natural"],
    currentConcerns: [],
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
  })

  assert.equal(decision.resolution, "resolved")
  assert.equal(decision.deferredFacts.length, 0)
  assert.equal(decision.executionState, "available")
})
