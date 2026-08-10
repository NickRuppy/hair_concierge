import assert from "node:assert/strict"
import test from "node:test"

import { buildLeaveInDecision } from "../../../src/lib/personal-plan/categories/leave-in"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import type {
  LeaveInFunction,
  PlanCareDirection,
  PlanCareWeight,
  PlanHeatToolUseEvent,
  PlanProfile,
  PlanRepairSupportLevel,
  PlanRoutineContext,
} from "../../../src/lib/personal-plan/types"
import { INITIAL_UNKNOWN_ROUTINE_CONTEXT } from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function heatEvent(frequency: PlanHeatToolUseEvent["frequency"]): PlanHeatToolUseEvent {
  return {
    id: `heat-${frequency}`,
    tool: "hair_dryer",
    route: "airflow_shaping",
    frequency,
    sourceRuleIds: ["test.heat"],
  }
}

function profile(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  routine: PlanRoutineContext = INITIAL_UNKNOWN_ROUTINE_CONTEXT,
): PlanProfile {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: {
      ...COMPLETE_V3_PLAN_ENVELOPE.answers,
      texture: "straight",
      thickness: "normal",
      density: "medium",
      goals: ["shine"],
      currentConcerns: [],
      concernRecurrence: undefined,
      hairLength: "long",
      hairSurface: "smooth",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
      scalpConcerns: [],
      ...overrides,
    },
  }
  return buildPlanProfile(envelope, {
    artifactId: "55555555-5555-4555-8555-555555555555",
    projection: "initial_quiz",
    routine,
  })
}

function decision(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  routine: PlanRoutineContext = INITIAL_UNKNOWN_ROUTINE_CONTEXT,
) {
  const built = profile(overrides, routine)
  return buildLeaveInDecision(built, buildPlanNeedAssessment(built))
}

function target(result: ReturnType<typeof decision>) {
  assert.equal(result.target?.category, "leave_in")
  return result.target
}

test("leave-in-no-job / leave_in.inclusion.no_job", () => {
  const result = decision({ goals: ["shine"], currentConcerns: [] })
  assert.equal(result.needTier, "optional")
  assert.ok(target(result).functions.some((item) => item.function === "shine_support"))

  const trulyNoJob = decision({ goals: ["scalp_balance"], currentConcerns: [] })
  assert.equal(trulyNoJob.needTier, "not_needed")
})

test("leave-in-replacement-eligible-no-job / replacement capability does not create need", () => {
  const result = decision({
    thickness: "fine",
    hairLength: "very_short",
    goals: ["scalp_balance"],
    currentConcerns: [],
  })

  assert.equal(result.needTier, "not_needed")
})

test("leave-in-fine-short-replacement / leave_in.relationship.conditioner_replacement", () => {
  const result = decision({
    thickness: "fine",
    hairLength: "very_short",
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
    elasticResponse: "snaps",
  })

  assert.equal(result.needTier, "basis")
  assert.equal(target(result).conditionerReplacementEligible, true)
  assert.equal(target(result).weight, "light" satisfies PlanCareWeight)
  assert.equal(target(result).careDirection, "moisture" satisfies PlanCareDirection)
})

test("leave-in-tangling-manageability / leave_in.inclusion.detangling", () => {
  const result = decision({
    thickness: "fine",
    currentConcerns: ["tangling"],
    goals: ["manageability_styling"],
  })

  assert.equal(result.needTier, "basis")
  assert.ok(
    target(result).functions.some(
      (item) =>
        item.function === ("detangle" satisfies LeaveInFunction) &&
        item.priority === 3 &&
        item.ownership === "required",
    ),
  )
})

test("leave-in-care-heat-combined / leave_in.inclusion.recurring_heat_care", () => {
  const result = decision(
    { thickness: "fine", currentConcerns: ["dry_lengths"], goals: ["moisture"] },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: { state: "known", value: [heatEvent("weekly_1x")] },
    },
  )

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["post_wash_leave_in", "pre_heat_application"])
  assert.deepEqual(result.frequency, {
    kind: "after_each_eligible_wash",
    roles: ["post_wash_leave_in"],
    dependsOn: "wet_wash_total",
    placementState: "known_after_refined_wash_cadence",
  })
})

test("leave-in-shine-or-definition-only does not claim Heat carrier role", () => {
  const routine: PlanRoutineContext = {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    heatToolUse: { state: "known", value: [heatEvent("weekly_1x")] },
  }
  for (const overrides of [
    { goals: ["shine" as const], currentConcerns: [] },
    {
      texture: "wavy" as const,
      goals: ["shape_definition" as const],
      currentConcerns: [],
    },
  ]) {
    const result = decision(overrides, routine)
    assert.equal(result.needTier, "optional")
    assert.deepEqual(result.roles, ["post_wash_leave_in"])
    assert.equal(
      target(result).functions.some((item) => item.function === "heat_protect"),
      false,
    )
  }
})

test("leave-in-care-plus-owned-heat-protectant / Stage 1 does not force consolidation", () => {
  const result = decision(
    { currentConcerns: ["dry_lengths"], goals: ["moisture"] },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: { state: "known", value: [heatEvent("weekly_1x")] },
    },
  )

  assert.equal(result.needTier, "basis")
  assert.ok(result.reasons.some((reason) => reason.id === "leave_in.inclusion.dry_moisture_goal"))
  assert.ok(result.roles.includes("pre_heat_application"))
})

test("leave-in-definition-goal-only / leave_in.inclusion.definition_only", () => {
  const result = decision({ texture: "wavy", goals: ["shape_definition"], currentConcerns: [] })
  assert.equal(result.needTier, "optional")
  assert.deepEqual(
    target(result).functions.map((item) => item.function),
    ["curl_shape_support"],
  )
})

test("leave-in-coarse-curly-multi-need / rich curl care target", () => {
  const result = decision({
    texture: "curly",
    thickness: "coarse",
    goals: ["frizz_surface", "shape_definition"],
    currentConcerns: ["frizz_flyaways", "lost_shape"],
    hairSurface: "rough",
  })

  assert.equal(result.needTier, "basis")
  assert.equal(target(result).weight, "rich" satisfies PlanCareWeight)
  assert.ok(target(result).functions.some((item) => item.function === "smooth_anti_frizz"))
  assert.ok(target(result).functions.some((item) => item.function === "curl_shape_support"))
})

test("leave-in-lightened-care / chemically treated lengths create basis care", () => {
  const result = decision({
    chemicalTreatments: ["lightened"],
    goals: ["shine"],
    currentConcerns: [],
  })

  assert.equal(result.needTier, "basis")
  assert.equal(target(result).repairSupportLevel, "high" satisfies PlanRepairSupportLevel)
  assert.ok(
    result.reasons.some((reason) => reason.id === "leave_in.inclusion.intensive_treatment_care"),
  )
})

test("leave-in-repair-only / repair support remains optional and supporting", () => {
  const result = decision({ goals: ["strength_ends"], currentConcerns: ["split_ends"] })

  assert.equal(result.needTier, "optional")
  assert.ok(
    target(result).functions.some(
      (item) => item.function === "repair_support" && item.ownership === "supporting",
    ),
  )
})

test("leave-in-dry-alone / leave_in.inclusion.single_care_signal", () => {
  const result = decision({ currentConcerns: ["dry_lengths"], goals: ["shine"] })
  assert.equal(result.needTier, "optional")
  assert.ok(result.reasons.some((reason) => reason.id === "leave_in.inclusion.single_care_signal"))
})

test("leave-in-dry-rough / leave_in.inclusion.dry_rough", () => {
  const result = decision({ currentConcerns: ["dry_lengths"], hairSurface: "rough" })
  assert.equal(result.needTier, "basis")
})

test("leave-in-shine-only / leave_in.inclusion.shine_only", () => {
  const result = decision({ goals: ["shine"], currentConcerns: [] })
  assert.equal(result.needTier, "optional")
  assert.deepEqual(
    target(result).functions.map((item) => item.function),
    ["shine_support"],
  )
})

test("leave-in-coily-alone / leave_in.inclusion.coily_texture", () => {
  const result = decision({ texture: "coily", goals: ["scalp_balance"], currentConcerns: [] })
  assert.equal(result.needTier, "basis")
})

test("leave-in-curly-alone / leave_in.inclusion.single_care_signal", () => {
  const result = decision({ texture: "curly", goals: ["scalp_balance"], currentConcerns: [] })
  assert.equal(result.needTier, "optional")
})

test("leave-in-wavy-alone / leave_in.inclusion.no_job", () => {
  const result = decision({ texture: "wavy", goals: ["scalp_balance"], currentConcerns: [] })
  assert.equal(result.needTier, "not_needed")
})

test("leave-in-recurring-heat-care / heat upgrades an optional care signal", () => {
  const result = decision(
    { currentConcerns: ["dry_lengths"], goals: ["shine"] },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: { state: "known", value: [heatEvent("weekly_1x")] },
    },
  )

  assert.equal(result.needTier, "basis")
  assert.deepEqual(result.roles, ["post_wash_leave_in", "pre_heat_application"])
})

test("leave-in-rare-heat-care / rare heat does not reshape regular Leave-in", () => {
  const result = decision(
    { currentConcerns: ["dry_lengths"], goals: ["shine"] },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: { state: "known", value: [heatEvent("monthly_1x")] },
    },
  )

  assert.equal(result.needTier, "optional")
  assert.deepEqual(result.roles, ["post_wash_leave_in"])
})

test("leave-in-heat-only / Heat protectant owns heat without care signal", () => {
  const result = decision(
    { goals: ["scalp_balance"], currentConcerns: [] },
    {
      ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
      heatToolUse: { state: "known", value: [heatEvent("weekly_1x")] },
    },
  )

  assert.equal(result.needTier, "not_needed")
  assert.deepEqual(result.roles, [])
})

test("leave-in-definition-only / lost shape is optional without care signal", () => {
  const result = decision({
    texture: "curly",
    goals: ["scalp_balance"],
    currentConcerns: ["lost_shape"],
  })
  assert.equal(result.needTier, "optional")
})

test("leave-in-care-plus-definition / care basis may include shape preparation without cast claim", () => {
  const result = decision({
    texture: "wavy",
    goals: ["shape_definition"],
    currentConcerns: ["dry_lengths"],
    hairSurface: "rough",
  })

  assert.equal(result.needTier, "basis")
  assert.ok(target(result).functions.some((item) => item.function === "moisture_softness"))
  assert.ok(target(result).functions.some((item) => item.function === "curl_shape_support"))
})

test("leave-in-between-wash-deferred / no numeric refresh cadence is compiled", () => {
  const result = decision({ currentConcerns: ["dry_lengths"], goals: ["moisture"] })

  assert.notEqual(result.frequency?.kind, "unscheduled_as_needed")
  assert.deepEqual(result.deferredFacts, [])
})
