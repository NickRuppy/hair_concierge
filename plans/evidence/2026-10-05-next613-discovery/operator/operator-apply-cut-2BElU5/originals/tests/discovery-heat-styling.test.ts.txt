import assert from "node:assert/strict"
import test from "node:test"

import {
  describeDiscoveryHeatStyling,
  discoveryHeatEventSources,
  parseDiscoveryHeatStyling,
  type DiscoveryHeatStylingV1,
} from "../src/lib/discovery/heat-styling"

/**
 * Batch 7 (plan §2.2): the „Hitze & Styling" answers as one validated object. Same
 * vocabulary as production Feinschliff (`refinement/types.ts`, `heat-events.ts`): „Keiner
 * dieser Wege" = `dryingRoutes: []`, „Keine weiteren Tools" = `additionalHeatTools: []`, and
 * exactly one heat event per heat source the routes and tools imply — with a heat-protection
 * answer iff the source needs one (plain föhnen does not).
 */

const straightener: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["air_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: { "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always" } },
}

test("a complete answer parses to itself", () => {
  assert.deepEqual(parseDiscoveryHeatStyling(straightener), { ok: true, value: straightener })
})

test("„Keiner dieser Wege“ + „Keine weiteren Tools“ is the empty answer with no events", () => {
  const none = { dryingRoutes: [], additionalHeatTools: [], heatEvents: {} }
  assert.deepEqual(parseDiscoveryHeatStyling(none), { ok: true, value: none })
})

test("air drying implies no heat event", () => {
  const air = { dryingRoutes: ["air_dry"], additionalHeatTools: [], heatEvents: {} }
  assert.equal(parseDiscoveryHeatStyling(air).ok, true)
  assert.deepEqual(discoveryHeatEventSources(air as DiscoveryHeatStylingV1), [])
})

test("plain föhnen needs a frequency but no protection answer; diffuser and tools need both", () => {
  const blow = {
    dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["dryer_brush"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
      "heat:diffuser_airflow_shaping": {
        frequency: "weekly_1x",
        protectionConsistency: "sometimes",
      },
      "heat:dryer_brush": { frequency: "biweekly_1x", protectionConsistency: "no" },
    },
  }
  assert.equal(parseDiscoveryHeatStyling(blow).ok, true)
  assert.deepEqual(discoveryHeatEventSources(blow as DiscoveryHeatStylingV1), [
    "ordinary_blow_dry",
    "diffuser_airflow_shaping",
    "dryer_brush",
  ])

  const withProtection = {
    ...blow,
    heatEvents: {
      ...blow.heatEvents,
      "heat:ordinary_blow_dry": { frequency: "weekly_3_4x", protectionConsistency: "always" },
    },
  }
  assert.deepEqual(parseDiscoveryHeatStyling(withProtection), {
    ok: false,
    reason: "invalid_events",
  })

  const withoutProtection = {
    ...blow,
    heatEvents: { ...blow.heatEvents, "heat:dryer_brush": { frequency: "biweekly_1x" } },
  }
  assert.deepEqual(parseDiscoveryHeatStyling(withoutProtection), {
    ok: false,
    reason: "invalid_events",
  })
})

test("cross-field rejects: a missing event, an extra event, a duplicate answer", () => {
  assert.deepEqual(
    parseDiscoveryHeatStyling({ ...straightener, heatEvents: {} }),
    { ok: false, reason: "invalid_events" },
    "a selected tool without its event",
  )
  assert.deepEqual(
    parseDiscoveryHeatStyling({
      ...straightener,
      heatEvents: {
        ...straightener.heatEvents,
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "no" },
      },
    }),
    { ok: false, reason: "invalid_events" },
    "an event for a tool she did not select",
  )
  assert.deepEqual(
    parseDiscoveryHeatStyling({
      ...straightener,
      heatEvents: { ...straightener.heatEvents, "heat:towel": { frequency: "weekly_1x" } },
    }),
    { ok: false, reason: "invalid_shape" },
    "an unknown event key",
  )
  assert.deepEqual(
    parseDiscoveryHeatStyling({
      ...straightener,
      additionalHeatTools: ["straightener", "straightener"],
    }),
    { ok: false, reason: "invalid_shape" },
  )
})

test("shape rejects: unknown keys, unknown values, „Weiß ich nicht“ as a heat frequency", () => {
  for (const bad of [
    null,
    [],
    { ...straightener, towel: "rough" },
    { ...straightener, dryingRoutes: ["sun"] },
    { ...straightener, additionalHeatTools: ["crimper"] },
    {
      ...straightener,
      heatEvents: {
        "heat:straightener": { frequency: "unknown", protectionConsistency: "always" },
      },
    },
    {
      ...straightener,
      heatEvents: {
        "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "often" },
      },
    },
    {
      ...straightener,
      heatEvents: {
        "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always", extra: 1 },
      },
    },
    { dryingRoutes: ["air_dry"], heatEvents: {} },
  ]) {
    assert.deepEqual(parseDiscoveryHeatStyling(bad), { ok: false, reason: "invalid_shape" })
  }
})

test("the cockpit block names drying, tools with frequency and protection", () => {
  assert.deepEqual(
    describeDiscoveryHeatStyling({
      dryingRoutes: ["ordinary_blow_dry", "air_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
        "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
      },
    }),
    {
      drying: "Lufttrocknen · Gewöhnlich föhnen",
      tools: [
        { label: "Föhnen", frequency: "3–4× pro Woche", protection: null },
        { label: "Glätteisen", frequency: "2× pro Woche", protection: "Hitzeschutz: manchmal" },
      ],
    },
  )
  assert.deepEqual(
    describeDiscoveryHeatStyling({ dryingRoutes: [], additionalHeatTools: [], heatEvents: {} }),
    { drying: "Keiner dieser Wege", tools: [] },
  )
})
