import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"
import {
  buildDiscoveryRoutineContext,
  discoveryIntakeHasRoutineAnswers,
  type DiscoveryRoutineContextItem,
} from "../src/lib/discovery/routine-context"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanRoutineContext,
} from "../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Batch 7 (plan §2.3, ruling F3.3): the Idealroutine uses her checklist answers. The pure
 * builder turns items + heat answers into a `PlanRoutineContext` — shampoo frequency from the
 * most frequent shampoo, heat tool use from production's heat projection, the product load
 * from her usages — and everything else stays unknown. Every fixture names the engine rule it
 * reaches, run through the real `computeNeedPlan` with projection `initial_quiz` (the seam
 * the cockpit uses).
 */

function plan(routine: PlanRoutineContext, envelope = COMPLETE_V3_PLAN_ENVELOPE) {
  const result = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: "discovery-fixture",
    projection: "initial_quiz",
    computationVersion: "fixture",
    createdAt: "2026-09-25T00:00:00.000Z",
    routine,
  })
  assert.equal(result.status, "ready")
  return (result as { snapshot: InitialNeedPlanSnapshot }).snapshot
}

function decision(snapshot: InitialNeedPlanSnapshot, category: string): PlanCategoryDecision {
  const found = snapshot.decisions.find((entry) => entry.category === category)
  assert.ok(found, category)
  return found
}

function ruleIds(entry: PlanCategoryDecision): string[] {
  return entry.reasons.map((reason) => reason.id)
}

function item(overrides: Partial<DiscoveryRoutineContextItem>): DiscoveryRoutineContextItem {
  return {
    source: "catalog_search",
    category: "shampoo",
    usageRole: null,
    frequency: null,
    ...overrides,
  }
}

function heat(overrides: Partial<DiscoveryHeatStylingV1>): DiscoveryHeatStylingV1 {
  return { dryingRoutes: [], additionalHeatTools: [], heatEvents: {}, ...overrides }
}

const STRAIGHTENER = heat({
  dryingRoutes: ["air_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: { "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "no" } },
})
const DIFFUSER = heat({
  dryingRoutes: ["diffuser_or_airflow_shaping"],
  heatEvents: {
    "heat:diffuser_airflow_shaping": {
      frequency: "weekly_3_4x",
      protectionConsistency: "sometimes",
    },
  },
})
const BLOW_DRY = heat({
  dryingRoutes: ["ordinary_blow_dry"],
  heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
})
const AIR_DRY = heat({ dryingRoutes: ["air_dry"] })

// --- The gate ---------------------------------------------------------------------------

test("gate: only an intake with new answers (heat, or any item frequency) gets an override", () => {
  assert.equal(discoveryIntakeHasRoutineAnswers([item({})], null), false)
  assert.equal(discoveryIntakeHasRoutineAnswers([], null), false)
  assert.equal(
    discoveryIntakeHasRoutineAnswers([item({ source: "none", frequency: null })], null),
    false,
  )
  assert.equal(discoveryIntakeHasRoutineAnswers([item({ frequency: "unknown" })], null), true)
  assert.equal(discoveryIntakeHasRoutineAnswers([], AIR_DRY), true)
})

// --- Heat protectant ------------------------------------------------------------------------

test("heat_protectant.inclusion.direct_heat: a straightener makes heat protection Basis", () => {
  const entry = decision(plan(buildDiscoveryRoutineContext([], STRAIGHTENER)), "heat_protectant")
  assert.equal(entry.resolution, "resolved")
  assert.equal(entry.needTier, "basis")
  assert.deepEqual(ruleIds(entry), ["heat_protectant.inclusion.direct_heat"])
})

test("heat_protectant.inclusion.airflow_shaping: a diffuser makes it Optional", () => {
  const entry = decision(plan(buildDiscoveryRoutineContext([], DIFFUSER)), "heat_protectant")
  assert.equal(entry.needTier, "optional")
  assert.deepEqual(ruleIds(entry), ["heat_protectant.inclusion.airflow_shaping"])
})

test("heat_protectant.inclusion.ordinary_airflow / no_heat_event: plain föhnen or air drying → not needed", () => {
  const blow = decision(plan(buildDiscoveryRoutineContext([], BLOW_DRY)), "heat_protectant")
  assert.equal(blow.needTier, "not_needed")
  assert.deepEqual(ruleIds(blow), ["heat_protectant.inclusion.ordinary_airflow"])
  const air = decision(plan(buildDiscoveryRoutineContext([], AIR_DRY)), "heat_protectant")
  assert.equal(air.needTier, "not_needed")
  assert.deepEqual(ruleIds(air), ["heat_protectant.inclusion.no_heat_event"])
})

test("heat unknown (not asked): heat protection stays deferred, exactly as the quiz-only plan", () => {
  const entry = decision(
    plan(buildDiscoveryRoutineContext([item({ frequency: "weekly_2x" })], null)),
    "heat_protectant",
  )
  assert.equal(entry.resolution, "deferred_until_post_plan_onboarding")
  assert.deepEqual(entry.deferredFacts, ["heat_tool_use"])
})

// --- Leave-in ---------------------------------------------------------------------------

/** Dry lengths only — no rough surface, no moisture goal: a single care signal. */
const DRY_ONLY: PersonalPlanQuizSubmissionEnvelope = {
  ...COMPLETE_V3_PLAN_ENVELOPE,
  answers: {
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    goals: ["shine"],
    currentConcerns: ["dry_lengths"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairSurface: "smooth",
    chemicalTreatments: ["natural"],
  },
}

test("leave_in.inclusion.recurring_heat_care: weekly direct heat upgrades a single-signal leave-in to Basis", () => {
  const without = decision(plan(buildDiscoveryRoutineContext([], AIR_DRY), DRY_ONLY), "leave_in")
  assert.equal(without.needTier, "optional")
  assert.ok(ruleIds(without).includes("leave_in.inclusion.single_care_signal"))

  const withHeat = decision(
    plan(buildDiscoveryRoutineContext([], STRAIGHTENER), DRY_ONLY),
    "leave_in",
  )
  assert.equal(withHeat.needTier, "basis")
  assert.ok(ruleIds(withHeat).includes("leave_in.inclusion.recurring_heat_care"))
})

test("leave-in: heat below weekly is not recurring — no upgrade", () => {
  const rare = heat({
    additionalHeatTools: ["straightener"],
    heatEvents: { "heat:straightener": { frequency: "biweekly_1x", protectionConsistency: "no" } },
  })
  const entry = decision(plan(buildDiscoveryRoutineContext([], rare), DRY_ONLY), "leave_in")
  assert.equal(entry.needTier, "optional")
})

// --- Shampoo cadence ------------------------------------------------------------------------

test("shampoo.cadence.*: the most frequent shampoo is her current frequency", () => {
  const context = buildDiscoveryRoutineContext(
    [
      item({ frequency: "weekly_2x" }),
      item({ frequency: "weekly_3_4x" }),
      // Neither a deep cleanser nor a conditioner sets the shampoo frequency.
      item({ category: "deep_cleansing_shampoo", frequency: "daily_1x" }),
      item({ category: "conditioner", frequency: "daily_1x" }),
    ],
    null,
  )
  assert.deepEqual(context.shampooFrequency, { state: "known", value: "weekly_3_4x" })
  const entry = decision(plan(context), "shampoo")
  // Balanced scalp: 3–4× lies inside the allowed range and is retained.
  assert.ok(ruleIds(entry).includes("shampoo.cadence.retained_current"))
  assert.deepEqual(entry.deferredFacts, [])
})

test("shampoo.cadence.quiz_starting_target: only „Weiß ich nicht“ keeps the frequency unknown", () => {
  const context = buildDiscoveryRoutineContext([item({ frequency: "unknown" })], null)
  assert.equal(context.shampooFrequency.state, "unknown")
  const entry = decision(plan(context), "shampoo")
  assert.ok(ruleIds(entry).includes("shampoo.cadence.quiz_starting_target"))
  assert.deepEqual(entry.deferredFacts, ["shampoo_frequency"])
})

// --- Product load + everything else -------------------------------------------------------

test("product load from her usages and oil roles; „none“, unknown usage and styling are no load", () => {
  const context = buildDiscoveryRoutineContext(
    [
      item({ category: "shampoo" }),
      item({ category: "oil", usageRole: "pre_wash_fibre_treatment" }),
      item({ category: "oil", usageRole: "dry_finish" }),
      item({ category: "scalp_care", usageRole: "scalp_flake_oil_adjunct" }),
      item({ category: "conditioner", usageRole: "pre_wash_conditioner" }),
      item({ source: "none", category: "mask" }),
      item({ category: null }),
    ],
    null,
  )
  assert.deepEqual(context.currentProductLoad, {
    state: "known",
    value: {
      categories: ["shampoo", "conditioner", "oil", "scalp_care"],
      oilPurposes: ["prewash_lengths", "dry_finish", "scalp"],
    },
  })
})

test("never asked: dry-shampoo bridge, scalp irritation and mechanical signals stay unknown/empty", () => {
  const context = buildDiscoveryRoutineContext([item({ frequency: "weekly_2x" })], STRAIGHTENER)
  assert.equal(context.dryShampooBridgePreference.state, "unknown")
  assert.equal(context.scalpIrritationState.state, "unknown")
  assert.deepEqual(context.mechanicalExposureSignals, [])
  assert.deepEqual(context.heatToolUse, {
    state: "known",
    value: [
      {
        id: "heat:straightener",
        tool: "straightener",
        route: "direct_contact_heat",
        frequency: "weekly_2x",
        sourceRuleIds: ["discovery_intake:heat_styling"],
      },
    ],
  })
})
