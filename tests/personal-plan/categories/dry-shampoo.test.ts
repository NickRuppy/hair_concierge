import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import { computeDryShampooDecision } from "../../../src/lib/personal-plan/categories/dry-shampoo"
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
  const base = buildPlanProfile(envelope, {
    artifactId: "60000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
  })
  const profile = buildPlanProfile(envelope, {
    artifactId: "60000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
    routine: routine ? { ...base.routine, ...routine } : undefined,
  })
  return computeDryShampooDecision(profile, buildPlanNeedAssessment(profile))
}

test("dry-shampoo-01 / dry_shampoo.inclusion.none when bridge preference is not applicable", () => {
  const result = decision({
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })

  assert.equal(result.category, "dry_shampoo")
  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.roles, [])
  assert.equal(result.target, null)
  assert.equal(result.frequency, null)
  assert.deepEqual(result.deferredFacts, [])
  assert.ok(result.reasons.some((reason) => reason.id === "dry_shampoo.inclusion.none"))
})

test("dry-shampoo-02 / dry_shampoo.inclusion.offer_bridge defers the optional bridge question", () => {
  const result = decision({
    scalpOiliness: "oily",
    scalpConcerns: [],
  })

  assert.equal(result.resolution, "deferred_until_post_plan_onboarding")
  assert.equal(result.needTier, null)
  assert.deepEqual(result.deferredFacts, ["dry_shampoo_bridge_preference"])
  assert.ok(result.reasons.some((reason) => reason.id === "dry_shampoo.inclusion.offer_bridge"))
})

test("dry-shampoo-03 / dry_shampoo.inclusion.accepted_bridge creates optional root refresh", () => {
  const result = decision(
    { scalpOiliness: "oily", scalpConcerns: [] },
    { dryShampooBridgePreference: { state: "known", value: "accept" } },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["root_refresh_bridge"])
  assert.deepEqual(result.target, {
    category: "dry_shampoo",
    roles: ["root_refresh_bridge"],
    cadenceAdjustment: "keep",
  })
  assert.deepEqual(result.frequency, {
    kind: "unscheduled_as_needed",
    roles: ["root_refresh_bridge"],
    boundary: "between_washes_max_twice_before_next_wash",
  })
  assert.ok(result.reasons.some((reason) => reason.id === "dry_shampoo.inclusion.accepted_bridge"))
})

test("dry-shampoo-04 / dry_shampoo.inclusion.declined_bridge omits bridge use", () => {
  const result = decision(
    { scalpOiliness: "oily", scalpConcerns: [] },
    { dryShampooBridgePreference: { state: "known", value: "decline" } },
  )

  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.roles, [])
  assert.ok(result.reasons.some((reason) => reason.id === "dry_shampoo.inclusion.declined_bridge"))
})

test("dry-shampoo-stable-bridge / accepted bridge is byte-stable", () => {
  const first = decision(
    { scalpOiliness: "oily", scalpConcerns: [] },
    { dryShampooBridgePreference: { state: "known", value: "accept" } },
  )
  const second = decision(
    { scalpOiliness: "oily", scalpConcerns: [] },
    { dryShampooBridgePreference: { state: "known", value: "accept" } },
  )

  assert.deepEqual(second, first)
})
