import assert from "node:assert/strict"
import test from "node:test"

import { DIFFUSER_AS_BLOW_DRY_RULE_ID } from "../src/lib/personal-plan/heat-diffuser-rule"
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
  // Without the Diffusor rule (rollout off) the diffuser source keeps today's contract.
  assert.equal(requiresStage2HeatProtection("diffuser_airflow_shaping"), true)
  assert.equal(ignoresStoredStage2HeatProtection("diffuser_airflow_shaping"), false)

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

const DIFFUSER_AS_BLOW_DRY = { diffuserAsBlowDry: true } as const

test("Diffusor rule: no protection question, but the event keeps its airflow_shaping route", () => {
  assert.equal(
    requiresStage2HeatProtection("diffuser_airflow_shaping", DIFFUSER_AS_BLOW_DRY),
    false,
  )
  assert.equal(
    ignoresStoredStage2HeatProtection("diffuser_airflow_shaping", DIFFUSER_AS_BLOW_DRY),
    true,
  )
  assert.equal(ignoresStoredStage2HeatProtection("straightener", DIFFUSER_AS_BLOW_DRY), false)
  assert.equal(requiresStage2HeatProtection("straightener", DIFFUSER_AS_BLOW_DRY), true)
  assert.equal(requiresStage2HeatProtection("dryer_brush", DIFFUSER_AS_BLOW_DRY), true)
  // The definition is the rule-free one: leave-in, mask, oil, needs and the Anwendung read it.
  assert.deepEqual(getStage2HeatEventDefinition("diffuser_airflow_shaping"), {
    tool: "hair_dryer",
    route: "airflow_shaping",
  })
})

test("Diffusor rule: the source projects without protection and ignores a stored value", () => {
  const [withoutValue] = projectStage2HeatEvents(
    {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: { "heat:diffuser_airflow_shaping": { frequency: "weekly_1x" } },
    },
    DIFFUSER_AS_BLOW_DRY,
  )
  assert.equal(withoutValue.protectionConsistency, undefined)
  assert.equal(withoutValue.route, "airflow_shaping")

  // Four production members hold a value stored while the question was still asked.
  const [legacy] = projectStage2HeatEvents(
    {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "no" },
      },
    },
    DIFFUSER_AS_BLOW_DRY,
  )
  assert.equal(legacy.protectionConsistency, undefined, "the stored value is ignored, not read")
  assert.equal(legacy.frequency, "weekly_1x")
})

test("Diffusor rule off: a stored protection answer keeps today's event, unmarked", () => {
  const [event] = projectStage2HeatEvents({
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "always" },
    },
  })
  assert.equal(event.route, "airflow_shaping")
  assert.equal(event.protectionConsistency, "always")
  assert.deepEqual(event.ruleIds, [])
})

test("Diffusor rule: marker on the projected event; a Diffusor stored without protection reads as blow-drying even with the rule off", () => {
  const answers = {
    dryingRoutes: ["diffuser_or_airflow_shaping" as const],
    additionalHeatTools: ["dryer_brush" as const],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_1x" as const },
      "heat:dryer_brush": {
        frequency: "weekly_1x" as const,
        protectionConsistency: "sometimes" as const,
      },
    },
  }
  for (const options of [DIFFUSER_AS_BLOW_DRY, undefined]) {
    const [diffuser, brush] = projectStage2HeatEvents(answers, options)
    assert.deepEqual(diffuser.ruleIds, [DIFFUSER_AS_BLOW_DRY_RULE_ID])
    assert.equal(diffuser.protectionConsistency, undefined)
    assert.equal(diffuser.route, "airflow_shaping")
    assert.deepEqual(brush.ruleIds, [])
    assert.equal(brush.protectionConsistency, "sometimes")
  }
  // A stored value under the rule is dropped and still marked.
  const [legacy] = projectStage2HeatEvents(
    {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": { frequency: "weekly_1x", protectionConsistency: "no" },
      },
    },
    DIFFUSER_AS_BLOW_DRY,
  )
  assert.deepEqual(legacy.ruleIds, [DIFFUSER_AS_BLOW_DRY_RULE_ID])
})

test("Diffusor rule: other sources still reject a missing protection answer", () => {
  assert.throws(() =>
    projectStage2HeatEvents(
      {
        additionalHeatTools: ["dryer_brush"],
        heatEvents: { "heat:dryer_brush": { frequency: "weekly_1x" } },
      },
      DIFFUSER_AS_BLOW_DRY,
    ),
  )
})
