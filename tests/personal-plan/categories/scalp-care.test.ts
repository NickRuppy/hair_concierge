import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import { computeScalpCareDecision } from "../../../src/lib/personal-plan/categories/scalp-care"
import type { PlanNeedAssessment, PlanRoutineContext } from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decision(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  routine?: Partial<PlanRoutineContext>,
  assessmentOverrides?: Partial<PlanNeedAssessment>,
) {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  }
  const base = buildPlanProfile(envelope, {
    artifactId: "70000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
  })
  const profile = buildPlanProfile(envelope, {
    artifactId: "70000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
    routine: routine ? { ...base.routine, ...routine } : undefined,
  })
  const assessments = { ...buildPlanNeedAssessment(profile), ...assessmentOverrides }
  return computeScalpCareDecision(profile, assessments)
}

test("INITIAL-04 / scalp_care.inclusion.buildup_deferred for unknown product load", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: [],
    currentConcerns: [],
    density: "low",
    goals: ["scalp_balance"],
  })

  assert.equal(result.category, "scalp_care")
  assert.equal(result.resolution, "deferred_until_post_plan_onboarding")
  assert.equal(result.needTier, null)
  assert.deepEqual(result.roles, [])
  assert.equal(result.target, null)
  assert.equal(result.frequency, null)
  assert.equal(result.executionState, "available")
  assert.deepEqual(result.deferredFacts, ["current_product_load"])
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.inclusion.buildup_deferred"))
})

test("SC-01 / known absent buildup resolves not_needed", () => {
  const result = decision(
    {
      scalpOiliness: "balanced",
      scalpConcerns: [],
      currentConcerns: [],
      goals: ["scalp_balance"],
    },
    undefined,
    {
      scalpBuildup: { knowledgeState: "known", state: "absent", sourceFacts: [] },
    },
  )

  assert.equal(result.resolution, "resolved")
  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.deferredFacts, [])
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.inclusion.none"))
})

test("SC-02 / scalp_care.role.comfort for dry scalp is optional only", () => {
  const result = decision({
    scalpOiliness: "dry",
    scalpConcerns: [],
    currentConcerns: [],
  })

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["scalp_comfort"])
  assert.deepEqual(result.target, {
    category: "scalp_care",
    roles: ["scalp_comfort"],
    roleTargets: [{ role: "scalp_comfort", coverage: "supporting" }],
  })
  assert.deepEqual(result.frequency, {
    kind: "role_keyed_product_protocol",
    roleFrequencies: [{ role: "scalp_comfort", cadence: "as_needed_according_to_product" }],
  })
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.inclusion.never_basis"))
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.role.comfort"))
})

test("SC-03 / scalp_care.role.flake_oil_adjunct for oily scalp has no exfoliant role", () => {
  const result = decision({
    scalpOiliness: "oily",
    scalpConcerns: [],
    currentConcerns: [],
  })

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["scalp_flake_oil_adjunct"])
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.role.flake_oil_adjunct"))
})

test("SC-04 / oily dandruff keeps Shampoo primary and Scalp Care optional", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: ["oily_dandruff"],
    currentConcerns: [],
  })
  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["scalp_flake_oil_adjunct"])
})

for (const fixture of [
  {
    name: "SC-10 / low density alone creates no density role",
    overrides: { density: "low" as const, goals: ["scalp_balance" as const] },
  },
  {
    name: "SC-11 / scalp balance goal alone creates no role",
    overrides: { density: "medium" as const, goals: ["scalp_balance" as const] },
  },
]) {
  test(fixture.name, () => {
    const result = decision(
      {
        scalpOiliness: "balanced",
        scalpConcerns: [],
        currentConcerns: [],
        ...fixture.overrides,
      },
      undefined,
      {
        scalpBuildup: { knowledgeState: "known", state: "absent", sourceFacts: [] },
      },
    )
    assert.equal(result.needTier, "not_needed")
    assert.deepEqual(result.roles, [])
  })
}

test("SC-05 / dry_dandruff creates one category with flake-oil plus comfort roles", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: ["dry_dandruff"],
    currentConcerns: [],
  })

  assert.deepEqual(result.roles, ["scalp_comfort", "scalp_flake_oil_adjunct"])
  assert.equal(result.needTier, "optional")
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.role.dry_flake_comfort"))
})

test("SC-06 / irritated with missing detail is paused and defers scalp_irritation_detail", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated"],
    currentConcerns: [],
  })

  assert.equal(result.resolution, "deferred_until_post_plan_onboarding")
  assert.equal(result.needTier, null)
  assert.deepEqual(result.deferredFacts, ["scalp_irritation_detail"])
  assert.equal(result.executionState, "paused")
  assert.equal(result.executionPauseReason?.id, "scalp_care.clarification.irritation")
})

test("SC-07 / mild irritation detail permits optional comfort role", () => {
  const result = decision(
    { scalpOiliness: "balanced", scalpConcerns: ["irritated"], currentConcerns: [] },
    { scalpIrritationState: { state: "known", value: "mild_sensitive_or_itchy" } },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["scalp_comfort"])
  assert.equal(result.executionState, "available")
})

test("SC-08 / burning painful irritation safety pause suppresses proactive roles", () => {
  const result = decision(
    {
      scalpOiliness: "oily",
      scalpConcerns: ["oily_dandruff", "irritated"],
      currentConcerns: ["hair_loss_or_thinning"],
    },
    { scalpIrritationState: { state: "known", value: "burning_painful_or_inflamed" } },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, [])
  assert.equal(result.executionState, "paused")
  assert.equal(result.executionPauseReason?.id, "scalp_care.safety.pause_all")
})

test("SC-09 / hair_loss_or_thinning creates optional limited-evidence density role only", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: [],
    currentConcerns: ["hair_loss_or_thinning"],
  })

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["density_claim_tonic"])
  assert.deepEqual(result.target, {
    category: "scalp_care",
    roles: ["density_claim_tonic"],
    roleTargets: [
      {
        role: "density_claim_tonic",
        coverage: "primary",
        evidenceLevel: "limited_evidence",
      },
    ],
  })
})

test("SC-12 / present scalp buildup adds an optional exfoliant role", () => {
  const result = decision(
    { scalpOiliness: "balanced", scalpConcerns: [], currentConcerns: [] },
    undefined,
    {
      scalpBuildup: {
        knowledgeState: "known",
        state: "present",
        sourceFacts: ["scalp_care.buildup.dry_shampoo_target"],
      },
    },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["scalp_exfoliant"])
  assert.deepEqual(result.frequency, {
    kind: "role_keyed_product_protocol",
    roleFrequencies: [{ role: "scalp_exfoliant", cadence: "occasional_according_to_product" }],
  })
})

test("SC-21 / hair-loss density job remains optional and uncovered for Stage 2", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: [],
    currentConcerns: ["hair_loss_or_thinning"],
  })

  assert.equal(result.needTier, "optional")
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.role.density_claim"))
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.evidence.limited_density"))
})

test("SC-41 / same canonical inputs serialize byte-stably", () => {
  const first = decision({
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
    currentConcerns: ["hair_loss_or_thinning"],
  })
  const second = decision({
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
    currentConcerns: ["hair_loss_or_thinning"],
  })

  assert.deepEqual(second, first)
})

test("SC-43 / every compatible role signal stays optional and never basis", () => {
  const result = decision(
    {
      scalpOiliness: "dry",
      scalpConcerns: ["dry_dandruff"],
      currentConcerns: ["hair_loss_or_thinning"],
    },
    { scalpIrritationState: { state: "known", value: "mild_sensitive_or_itchy" } },
    {
      scalpBuildup: {
        knowledgeState: "known",
        state: "present",
        sourceFacts: ["scalp_care.buildup.root_regular"],
      },
    },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, [
    "scalp_comfort",
    "scalp_flake_oil_adjunct",
    "density_claim_tonic",
    "scalp_exfoliant",
  ])
  assert.ok(result.reasons.some((reason) => reason.id === "scalp_care.inclusion.never_basis"))
})
