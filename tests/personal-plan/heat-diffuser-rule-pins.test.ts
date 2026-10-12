import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { DIFFUSER_AS_BLOW_DRY_RULE_ID } from "../../src/lib/personal-plan/heat-diffuser-rule"
import {
  heatEventDayContext,
  oilProtocolSupportsHeatEvent,
} from "../../src/lib/personal-plan/oil-heat-context"
import { normalizedProfileFromNeedSnapshot } from "../../src/lib/personal-plan/routine/application-adapter"
import type { PlanHeatToolUseEvent, PlanRoutineContext } from "../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

/**
 * The Diffusor rule moves ONLY the Hitzeschutz tier. A flag-on Diffusor member's plan event is
 * `airflow_shaping` plus a marker, and every other reader — leave-in `recurringHeat`, mask
 * `hasMeaningfulExposure`, needs (`heatSignals` / `ordinaryAirflowExposure`), the Oil carrier day
 * context, the Anwendung profile and the heat-occurrence compiler — must keep its previous outcome.
 */

const diffuserEvent = (marked: boolean): PlanHeatToolUseEvent => ({
  id: "heat:diffuser_airflow_shaping",
  tool: "hair_dryer",
  route: "airflow_shaping",
  frequency: "weekly_3_4x",
  sourceRuleIds: [
    "post_plan_onboarding:heat_tool_use",
    ...(marked ? [DIFFUSER_AS_BLOW_DRY_RULE_ID] : []),
  ],
})

function routine(events: PlanHeatToolUseEvent[]): PlanRoutineContext {
  return {
    currentProductLoad: { state: "known", value: { categories: ["shampoo"], oilPurposes: [] } },
    shampooFrequency: { state: "known", value: "weekly_2x" },
    heatToolUse: { state: "known", value: events },
    mechanicalExposureSignals: [],
    dryShampooBridgePreference: { state: "unknown", reason: "dry_shampoo_bridge_preference" },
    scalpIrritationState: { state: "unknown", reason: "scalp_irritation_detail" },
  }
}

function plan(events: PlanHeatToolUseEvent[]) {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-10-10T12:00:00.000Z",
    routine: routine(events),
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected a ready plan")
  return result.snapshot
}

/** The events with the marker stripped, so snapshots compare on everything else. */
function withoutMarker<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replaceAll(`,"${DIFFUSER_AS_BLOW_DRY_RULE_ID}"`, "")) as T
}

test("a marked Diffusor changes the Hitzeschutz decision and nothing else in the plan", () => {
  const marked = plan([diffuserEvent(true)])
  const plain = plan([diffuserEvent(false)])

  const tier = (snapshot: typeof marked) =>
    snapshot.decisions.find((decision) => decision.category === "heat_protectant")?.needTier
  assert.equal(tier(plain), "optional")
  assert.equal(tier(marked), "not_needed")

  // Leave-in, mask, oil and every other category decision: identical to the unmarked outcome.
  const others = (snapshot: typeof marked) =>
    snapshot.decisions.filter((decision) => decision.category !== "heat_protectant")
  assert.deepEqual(withoutMarker(others(marked)), others(plain))

  // Needs: the Diffusor is still a heat signal on the airflow route, never ordinary airflow.
  const damage = marked.assessments.damage
  assert.ok(damage.heatSignals.includes("heat_route:airflow_shaping"))
  assert.deepEqual(damage.ordinaryAirflowExposure, { state: "known", events: [] })
  assert.deepEqual(withoutMarker(marked.assessments), plain.assessments)
  assert.equal(marked.assessments.heatExposure.state, "present")
  assert.deepEqual(
    marked.assessments.heatExposure.events.map((event) => event.route),
    ["airflow_shaping"],
  )
})

test("the Oil carrier day context and protocol support read a marked Diffusor as before", () => {
  const event = diffuserEvent(true)
  assert.equal(heatEventDayContext(event), "wash_family")
  assert.equal(
    oilProtocolSupportsHeatEvent(
      ["wash_day", "intensive_care_day", "bond_repair_day", "clarifying_wash_day"],
      event,
    ),
    true,
  )
  assert.equal(oilProtocolSupportsHeatEvent(["styling_day"], event), false)
})

test("the Anwendung profile keeps a marked Diffusor as an airflow_shaping blow-dry event", () => {
  const marked = plan([diffuserEvent(true)])
  const profile = normalizedProfileFromNeedSnapshot(marked)
  const plainProfile = normalizedProfileFromNeedSnapshot(plan([diffuserEvent(false)]))
  assert.deepEqual(profile.heatEvents, [
    { id: "heat:diffuser_airflow_shaping", tool: "hair_dryer", route: "airflow_shaping" },
  ])
  assert.equal(profile.dryingRoute, "blow_dry")
  // The compiler reads this profile only, so its heat-occurrence materialization is unchanged.
  assert.deepEqual(profile, plainProfile)
})

test("with a Glätteisen the marked Diffusor does not widen the protectant's routes", () => {
  const iron: PlanHeatToolUseEvent = {
    id: "heat:straightener",
    tool: "straightener",
    route: "direct_contact_heat",
    frequency: "weekly_1x",
    sourceRuleIds: ["post_plan_onboarding:heat_tool_use"],
  }
  const decision = plan([diffuserEvent(true), iron]).decisions.find(
    (candidate) => candidate.category === "heat_protectant",
  )
  assert.equal(decision?.needTier, "basis")
  assert.deepEqual(
    decision?.target?.category === "heat_protectant" && decision.target.qualifyingRoutes,
    ["direct_contact_heat"],
  )
})
