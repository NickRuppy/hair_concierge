import assert from "node:assert/strict"
import test from "node:test"

import { computeHeatProtectantDecision } from "../../../src/lib/personal-plan/categories/heat-protectant"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "../../../src/lib/personal-plan/needs"
import type { PlanHeatToolUseEvent, PlanRoutineContext } from "../../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function decide(events: PlanHeatToolUseEvent[] | "unknown") {
  const routine: PlanRoutineContext = {
    currentProductLoad: { state: "unknown", reason: "current_product_load" },
    shampooFrequency: { state: "unknown", reason: "shampoo_frequency" },
    heatToolUse:
      events === "unknown"
        ? { state: "unknown", reason: "heat_tool_use" }
        : { state: "known", value: events },
    mechanicalExposureSignals: [],
    dryShampooBridgePreference: {
      state: "unknown",
      reason: "dry_shampoo_bridge_preference",
    },
    scalpIrritationState: { state: "unknown", reason: "scalp_irritation_detail" },
  }
  const profile = buildPlanProfile(COMPLETE_V3_PLAN_ENVELOPE, {
    artifactId: "44444444-4444-4444-8444-444444444444",
    projection: "initial_quiz",
    routine,
  })
  return computeHeatProtectantDecision(profile, buildPlanNeedAssessment(profile))
}

const event = (
  route: PlanHeatToolUseEvent["route"],
  frequency: PlanHeatToolUseEvent["frequency"] = "weekly_1x",
): PlanHeatToolUseEvent => ({
  id: `${route}-${frequency}`,
  tool: route === "direct_contact_heat" ? "straightener" : "hair_dryer",
  route,
  frequency,
  sourceRuleIds: [`tools.route.${route}`],
})

test("heat-protectant-direct-contact-basis [heat_protectant.inclusion.direct_heat]", () => {
  const decision = decide([event("direct_contact_heat")])
  assert.equal(decision.needTier, "basis")
  assert.deepEqual(decision.roles, ["pre_heat_protection"])
  assert.deepEqual(decision.frequency, {
    kind: "event_based",
    role: "pre_heat_protection",
    eventRoutes: ["direct_contact_heat"],
    occurrence: "before_every_qualifying_event",
  })
})

test("heat-protectant-airflow-shaping-optional [heat_protectant.inclusion.airflow_shaping]", () => {
  assert.equal(decide([event("airflow_shaping")]).needTier, "optional")
})

test("heat-protectant-ordinary-airflow-none [heat_protectant.inclusion.ordinary_airflow]", () => {
  const decision = decide([event("ordinary_airflow")])
  assert.equal(decision.needTier, "not_needed")
  assert.equal(decision.frequency, null)
})

test("heat-protectant-no-event-none [heat_protectant.inclusion.no_heat_event]", () => {
  assert.equal(decide([]).needTier, "not_needed")
})

test("INITIAL-05 heat-protectant-unknown-deferred [heat_protectant.inclusion.unclassified_tool]", () => {
  const decision = decide("unknown")
  assert.equal(decision.resolution, "deferred_until_post_plan_onboarding")
  assert.equal(decision.needTier, null)
  assert.deepEqual(decision.deferredFacts, ["heat_tool_use"])
})

test("heat-protectant-unclassified-deferred [heat_protectant.inclusion.unclassified_tool]", () => {
  assert.equal(decide([event("unclassified")]).resolution, "deferred_until_post_plan_onboarding")
})

test("heat-protectant tier is route-based rather than frequency-based", () => {
  assert.equal(
    decide([event("airflow_shaping", "daily_1x")]).needTier,
    decide([event("airflow_shaping", "less_than_monthly")]).needTier,
  )
  assert.equal(
    decide([event("direct_contact_heat", "daily_1x")]).needTier,
    decide([event("direct_contact_heat", "less_than_monthly")]).needTier,
  )
})

test("heat-protectant-direct-plus-airflow keeps one Basis event category", () => {
  const decision = decide([
    event("airflow_shaping", "weekly_2x"),
    event("direct_contact_heat", "monthly_1x"),
  ])
  assert.equal(decision.needTier, "basis")
  assert.equal(decision.frequency?.kind, "event_based")
  if (decision.frequency?.kind === "event_based") {
    assert.deepEqual(decision.frequency.eventRoutes, ["direct_contact_heat", "airflow_shaping"])
  }
})
