import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2HeatEventId,
  getStage2HeatEventDefinition,
  getSelectedStage2HeatEventSources,
  ignoresStoredStage2HeatProtection,
  projectStage2HeatEvents,
  requiresStage2HeatProtection,
} from "../src/lib/personal-plan/refinement/heat-events"

test("heat events retain distinct source-keyed identities", () => {
  assert.equal(createStage2HeatEventId("ordinary_blow_dry"), "heat:ordinary_blow_dry")
  assert.equal(createStage2HeatEventId("diffuser_airflow_shaping"), "heat:diffuser_airflow_shaping")
  assert.deepEqual(getSelectedStage2HeatEventSources({ dryingRoutes: ["ordinary_blow_dry"] }), [
    "ordinary_blow_dry",
  ])
})

test("all sources have the approved event mapping and source-order projection", () => {
  assert.deepEqual(getStage2HeatEventDefinition("ordinary_blow_dry"), {
    tool: "hair_dryer",
    route: "ordinary_airflow",
  })
  assert.deepEqual(getStage2HeatEventDefinition("diffuser_airflow_shaping"), {
    tool: "hair_dryer",
    route: "airflow_shaping",
  })
  assert.deepEqual(getStage2HeatEventDefinition("thermal_rollers"), {
    tool: "other",
    route: "direct_contact_heat",
  })
  assert.equal(requiresStage2HeatProtection("ordinary_blow_dry"), false)
  assert.equal(requiresStage2HeatProtection("straightener"), true)
  // `R1` (2026-08-24): the diffuser source is diffuser drying (`D2a`) at tier
  // `not_needed` (`A11`), so it no longer raises the heat-protection question.
  assert.equal(requiresStage2HeatProtection("diffuser_airflow_shaping"), false)
  assert.equal(ignoresStoredStage2HeatProtection("diffuser_airflow_shaping"), true)
  assert.equal(ignoresStoredStage2HeatProtection("straightener"), false)

  const events = projectStage2HeatEvents({
    dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["thermal_rollers", "straightener"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
      "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "always" },
      "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "sometimes" },
      "heat:thermal_rollers": { frequency: "less_than_monthly", protectionConsistency: "unsure" },
    },
  })
  assert.deepEqual(
    events.map((event) => event.id),
    [
      "heat:ordinary_blow_dry",
      "heat:diffuser_airflow_shaping",
      "heat:straightener",
      "heat:thermal_rollers",
    ],
  )
})

test("every approved source retains its exact ID and mapping", () => {
  assert.deepEqual(
    [
      ["ordinary_blow_dry", "hair_dryer", "ordinary_airflow"],
      ["diffuser_airflow_shaping", "hair_dryer", "airflow_shaping"],
      ["dryer_brush", "dryer_brush", "airflow_shaping"],
      ["hot_air_styler", "hot_air_styler", "airflow_shaping"],
      ["straightener", "straightener", "direct_contact_heat"],
      ["curling_or_wave_iron", "curling_iron", "direct_contact_heat"],
      ["thermal_rollers", "other", "direct_contact_heat"],
    ].map(([source, tool, route]) => ({
      id: createStage2HeatEventId(source as never),
      ...getStage2HeatEventDefinition(source as never),
      expected: { tool, route },
    })),
    [
      {
        id: "heat:ordinary_blow_dry",
        tool: "hair_dryer",
        route: "ordinary_airflow",
        expected: { tool: "hair_dryer", route: "ordinary_airflow" },
      },
      {
        id: "heat:diffuser_airflow_shaping",
        tool: "hair_dryer",
        route: "airflow_shaping",
        expected: { tool: "hair_dryer", route: "airflow_shaping" },
      },
      {
        id: "heat:dryer_brush",
        tool: "dryer_brush",
        route: "airflow_shaping",
        expected: { tool: "dryer_brush", route: "airflow_shaping" },
      },
      {
        id: "heat:hot_air_styler",
        tool: "hot_air_styler",
        route: "airflow_shaping",
        expected: { tool: "hot_air_styler", route: "airflow_shaping" },
      },
      {
        id: "heat:straightener",
        tool: "straightener",
        route: "direct_contact_heat",
        expected: { tool: "straightener", route: "direct_contact_heat" },
      },
      {
        id: "heat:curling_or_wave_iron",
        tool: "curling_iron",
        route: "direct_contact_heat",
        expected: { tool: "curling_iron", route: "direct_contact_heat" },
      },
      {
        id: "heat:thermal_rollers",
        tool: "other",
        route: "direct_contact_heat",
        expected: { tool: "other", route: "direct_contact_heat" },
      },
    ],
  )
})

test("all protection consistency values are valid for a qualifying event", () => {
  for (const protectionConsistency of ["always", "sometimes", "no", "unsure"] as const) {
    assert.equal(
      projectStage2HeatEvents({
        additionalHeatTools: ["straightener"],
        heatEvents: { "heat:straightener": { frequency: "weekly_1x", protectionConsistency } },
      })[0].protectionConsistency,
      protectionConsistency,
    )
  }
})

test("R1: the diffuser source projects without protection and ignores a legacy stored value", () => {
  // Under path version 1 this event REQUIRED `protectionConsistency`; under
  // version 2 it must not carry one, and a row written before the change stays
  // valid with its stored value simply dropped (fixture 125).
  const [withoutValue] = projectStage2HeatEvents({
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: { "heat:diffuser_airflow_shaping": { frequency: "weekly_1x" } },
  })
  assert.equal(withoutValue.protectionConsistency, undefined)

  const [legacy] = projectStage2HeatEvents({
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "no" },
    },
  })
  assert.equal(legacy.protectionConsistency, undefined, "the stored value is ignored, not read")
})

test("projection rejects missing protection and protection on ordinary airflow", () => {
  assert.throws(() =>
    projectStage2HeatEvents({
      additionalHeatTools: ["dryer_brush"],
      heatEvents: { "heat:dryer_brush": { frequency: "weekly_1x" } },
    }),
  )
  assert.throws(() =>
    projectStage2HeatEvents({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.throws(() =>
    projectStage2HeatEvents({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "not_a_frequency" as never } },
    }),
  )
  assert.throws(() =>
    projectStage2HeatEvents({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": {
          frequency: "weekly_1x",
          protectionConsistency: "not_a_consistency" as never,
        },
      },
    }),
  )
})
