import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { composeStage1Portfolio } from "../../src/lib/personal-plan/portfolio"
import { INITIAL_UNKNOWN_ROUTINE_CONTEXT } from "../../src/lib/personal-plan/types"
import type { PlanRoutineContext } from "../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

function compute(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]>,
  routine: PlanRoutineContext = INITIAL_UNKNOWN_ROUTINE_CONTEXT,
) {
  const result = computeNeedPlan({
    rawEnvelope: {
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
    },
    artifactId: "99999999-9999-4999-8999-999999999999",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
    routine,
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready plan")
  return result.snapshot
}

function category(snapshot: ReturnType<typeof compute>, id: string) {
  const found = snapshot.decisions.find((decision) => decision.category === id)
  assert.ok(found)
  return found
}

test("portfolio non-coily Leave-in owns persistent damp smoothing and demotes damp Oil", () => {
  const snapshot = compute({
    currentConcerns: ["dry_lengths", "frizz_flyaways"],
    hairSurface: "rough",
  })
  const oil = category(snapshot, "oil")
  assert.equal(category(snapshot, "leave_in").needTier, "basis")
  assert.equal(oil.target?.category, "oil")
  if (oil.target?.category === "oil") {
    assert.equal(
      oil.target.roleTargets.find((item) => item.role === "leave_on_fibre_conditioning")?.tier,
      "optional",
    )
  }
  assert.ok(
    snapshot.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.smoothing.leave_in_primary" &&
        fact.outcome === "duplicate_purchase_suppressed",
    ),
  )
})

test("portfolio preserves the coily two-layer damp smoothing exception", () => {
  const snapshot = compute({ texture: "coily", currentConcerns: ["frizz_flyaways"] })
  const oil = category(snapshot, "oil")
  assert.equal(category(snapshot, "leave_in").needTier, "basis")
  assert.equal(oil.target?.category, "oil")
  if (oil.target?.category === "oil") {
    assert.equal(
      oil.target.roleTargets.find((item) => item.role === "leave_on_fibre_conditioning")?.tier,
      "basis",
    )
  }
  assert.ok(
    snapshot.coverage.some(
      (fact) => fact.ruleId === "portfolio.smoothing.coily_two_layer_exception",
    ),
  )
})

test("portfolio keeps Conditioner baseline while repair categories share distinct jobs", () => {
  const snapshot = compute({
    currentConcerns: ["dry_lengths", "breakage"],
    hairSurface: "rough",
    chemicalTreatments: ["lightened"],
  })
  assert.equal(category(snapshot, "conditioner").needTier, "basis")
  assert.equal(category(snapshot, "leave_in").needTier, "basis")
  assert.equal(category(snapshot, "mask").needTier, "basis")
  assert.equal(category(snapshot, "bondbuilder").needTier, "basis")
  assert.ok(
    snapshot.coverage.some(
      (fact) => fact.ruleId === "portfolio.repair.distinct_roles_no_score_addition",
    ),
  )
  assert.ok(
    snapshot.coverage.some((fact) => fact.ruleId === "portfolio.conditioner.baseline_retained"),
  )
})

test("portfolio keeps wet-wash ownership and defers Heat carrier allocation", () => {
  const routine: PlanRoutineContext = {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    heatToolUse: {
      state: "known",
      value: [
        {
          id: "straightener",
          tool: "straightener",
          route: "direct_contact_heat",
          frequency: "weekly_1x",
          sourceRuleIds: ["test.direct"],
        },
      ],
    },
  }
  const snapshot = compute({ scalpOiliness: "oily" }, routine)
  assert.ok(
    snapshot.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.cleansing.shampoo_owns_total" &&
        fact.primaryCategories[0] === "shampoo",
    ),
  )
  assert.ok(
    snapshot.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.heat.carrier_allocation_deferred" &&
        fact.outcome === "deferred_allocation",
    ),
  )
})

test("portfolio preserves Dry Shampoo as a bridge inside Shampoo's wet-wash budget", () => {
  const routine: PlanRoutineContext = {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    dryShampooBridgePreference: { state: "known", value: "accept" },
  }
  const snapshot = compute({ scalpOiliness: "oily" }, routine)
  assert.ok(
    snapshot.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.cleansing.dry_bridge_preserves_wet_wash" &&
        fact.primaryCategories[0] === "shampoo" &&
        fact.supportingCategories[0] === "dry_shampoo",
    ),
  )
})

test("portfolio records Shampoo/Scalp Care and Deep Cleansing/exfoliant duplicate coverage", () => {
  const snapshot = compute({ scalpOiliness: "dry" })
  assert.ok(
    snapshot.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.scalp.shampoo_primary" &&
        fact.outcome === "duplicate_purchase_suppressed",
    ),
  )

  const decisions = snapshot.decisions.map((decision) => {
    if (decision.category === "deep_cleansing_shampoo") {
      return {
        ...decision,
        resolution: "resolved" as const,
        needTier: "basis" as const,
        roles: ["residue_reset" as const],
        target: {
          category: "deep_cleansing_shampoo" as const,
          roles: ["residue_reset" as const],
        },
      }
    }
    if (decision.category === "scalp_care" && decision.target?.category === "scalp_care") {
      return {
        ...decision,
        roles: [...decision.roles, "scalp_exfoliant" as const],
        target: {
          ...decision.target,
          roles: [...decision.target.roles, "scalp_exfoliant" as const],
          roleTargets: [
            ...decision.target.roleTargets,
            { role: "scalp_exfoliant" as const, coverage: "primary" as const },
          ],
        },
      }
    }
    return decision
  })
  const composed = composeStage1Portfolio(snapshot.profile, decisions)
  assert.ok(
    composed.coverage.some(
      (fact) =>
        fact.ruleId === "portfolio.reset.deep_cleansing_primary" &&
        fact.outcome === "duplicate_purchase_suppressed",
    ),
  )
})
