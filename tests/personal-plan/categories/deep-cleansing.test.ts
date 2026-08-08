import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import { computeDeepCleansingDecision } from "../../../src/lib/personal-plan/categories/deep-cleansing"
import type { PlanNeedAssessment } from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decision(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  assessmentOverrides: Partial<PlanNeedAssessment> = {},
) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  }
  const profile = buildPlanProfile(envelope, {
    artifactId: "50000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
  })
  const assessments = { ...buildPlanNeedAssessment(profile), ...assessmentOverrides }
  return computeDeepCleansingDecision(profile, assessments)
}

test("INITIAL-04 / deep_cleansing.inclusion.deferred_load for unknown current product load", () => {
  const result = decision({ scalpOiliness: "balanced", currentConcerns: [] })

  assert.equal(result.category, "deep_cleansing_shampoo")
  assert.equal(result.resolution, "deferred_until_post_plan_onboarding")
  assert.equal(result.needTier, null)
  assert.deepEqual(result.roles, [])
  assert.equal(result.target, null)
  assert.equal(result.frequency, null)
  assert.deepEqual(result.deferredFacts, ["current_product_load", "shampoo_frequency"])
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.deferred_load"))
})

test("deep-cleansing-02 / deep_cleansing.load.oily_scalp creates optional residue reset", () => {
  const result = decision({ scalpOiliness: "oily", currentConcerns: [] })

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["residue_reset"])
  assert.deepEqual(result.target, {
    category: "deep_cleansing_shampoo",
    roles: ["residue_reset"],
  })
  assert.deepEqual(result.frequency, {
    kind: "unscheduled_as_needed",
    roles: ["residue_reset"],
    boundary: "bei_bedarf",
  })
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.load.oily_scalp"))
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.optional"))
})

test("deep-cleansing-03 / deep_cleansing.load.weighed_down_corroboration needs another Reset-load signal", () => {
  const weighedOnly = decision({
    scalpOiliness: "balanced",
    currentConcerns: ["low_volume_or_weighed_down"],
  })
  const corroborated = decision({
    scalpOiliness: "oily",
    currentConcerns: ["low_volume_or_weighed_down"],
  })

  assert.equal(weighedOnly.needTier, null)
  assert.equal(corroborated.needTier, "basis")
  assert.deepEqual(corroborated.frequency, {
    kind: "every_nth_wash",
    roles: ["residue_reset"],
    every: 4,
    substitutesRegularShampoo: true,
  })
  assert.ok(
    corroborated.reasons.some(
      (reason) => reason.id === "deep_cleansing.load.weighed_down_corroboration",
    ),
  )
})

test("deep-cleansing-04 / scalp flakes and irritation do not create Reset load", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: ["dry_dandruff", "irritated"],
    currentConcerns: [],
  })

  assert.equal(result.needTier, null)
  assert.deepEqual(result.roles, [])
  assert.equal(result.executionState, "available")
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.deferred_load"))
})

test("deep-cleansing-08 / oily scalp plus weighed-down corroboration becomes Basis every fourth wash", () => {
  const result = decision({
    scalpOiliness: "oily",
    currentConcerns: ["low_volume_or_weighed_down"],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(result.frequency?.kind, "every_nth_wash")
  if (result.frequency?.kind === "every_nth_wash") {
    assert.equal(result.frequency.every, 4)
  }
})

test("deep-cleansing-thresholds / precomputed Reset-load 2-3 is Basis every fourth wash", () => {
  const result = decision(
    { scalpOiliness: "balanced", currentConcerns: [] },
    {
      resetLoad: {
        knowledgeState: "known",
        sourceFacts: ["deep_cleansing.load.leave_in", "deep_cleansing.load.finishing_oil"],
        knownScore: 2,
        unknownSignals: [],
        missingInputs: [],
      },
    },
  )

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.frequency, {
    kind: "every_nth_wash",
    roles: ["residue_reset"],
    every: 4,
    substitutesRegularShampoo: true,
  })
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.basis"))
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.load.leave_in"))
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.load.finishing_oil"))
  assert.deepEqual(result.deferredFacts, [])
})

test("deep-cleansing-01 / known absent product load resolves not_needed", () => {
  const result = decision(
    { scalpOiliness: "balanced", currentConcerns: [] },
    {
      resetLoad: {
        knowledgeState: "known",
        sourceFacts: [],
        knownScore: 0,
        unknownSignals: [],
        missingInputs: [],
      },
    },
  )

  assert.equal(result.resolution, "resolved")
  assert.equal(result.needTier, "not_needed")
  assert.equal(result.executionState, "available")
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.none"))
})

test("deep-cleansing-thresholds / precomputed Reset-load 4+ is Basis every third wash", () => {
  const result = decision(
    { scalpOiliness: "balanced", currentConcerns: [] },
    {
      resetLoad: {
        knowledgeState: "known",
        sourceFacts: [
          "deep_cleansing.load.dry_shampoo_frequent",
          "deep_cleansing.load.leave_in",
          "deep_cleansing.load.finishing_oil",
          "deep_cleansing.load.low_wash_relative_to_load",
        ],
        knownScore: 4,
        unknownSignals: [],
        missingInputs: [],
      },
    },
  )

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.frequency, {
    kind: "every_nth_wash",
    roles: ["residue_reset"],
    every: 3,
    substitutesRegularShampoo: true,
  })
  assert.ok(result.reasons.some((reason) => reason.id === "deep_cleansing.inclusion.high_load"))
  assert.deepEqual(result.deferredFacts, [])
})

test("deep-cleansing-14 / included Reset need pauses for active irritation", () => {
  const result = decision(
    { scalpConcerns: ["irritated"], currentConcerns: [] },
    {
      resetLoad: {
        knowledgeState: "known",
        sourceFacts: ["deep_cleansing.load.dry_shampoo_frequent"],
        knownScore: 3,
        unknownSignals: [],
        missingInputs: [],
      },
    },
  )
  assert.equal(result.needTier, "basis")
  assert.equal(result.executionState, "paused")
  assert.equal(result.executionPauseReason?.id, "deep_cleansing.safety.scalp_pause")
})

test("deep-cleansing-21 / exact Stage-1 result is stable", () => {
  const first = decision({ scalpOiliness: "oily", currentConcerns: ["low_volume_or_weighed_down"] })
  const second = decision({
    scalpOiliness: "oily",
    currentConcerns: ["low_volume_or_weighed_down"],
  })

  assert.deepEqual(second, first)
})
