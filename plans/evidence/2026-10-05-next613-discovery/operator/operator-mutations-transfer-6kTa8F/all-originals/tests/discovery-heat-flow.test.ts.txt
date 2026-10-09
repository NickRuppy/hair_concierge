import assert from "node:assert/strict"
import test from "node:test"

import {
  discoveryHeatSteps,
  heatDraftFrom,
  heatStepKey,
  heatSummaryLabel,
  isHeatStepAnswered,
  setHeatEvent,
  toDiscoveryHeatStyling,
  type DiscoveryHeatDraft,
} from "../src/components/discovery/intake/heat-flow"
import { parseDiscoveryHeatStyling } from "../src/lib/discovery/heat-styling"

/** „Hitze & Styling" step list and the whole object its PUT sends (batch 7, plan §2.1 item 5). */

test("steps: drying, tools, then per heat source its frequency — protection only where production asks", () => {
  const draft: DiscoveryHeatDraft = {
    dryingRoutes: ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["thermal_rollers", "dryer_brush"],
    heatEvents: {},
  }
  assert.deepEqual(discoveryHeatSteps(draft).map(heatStepKey), [
    "drying",
    "tools",
    "frequency:ordinary_blow_dry",
    "frequency:diffuser_airflow_shaping",
    "protection:diffuser_airflow_shaping",
    "frequency:dryer_brush",
    "protection:dryer_brush",
    "frequency:thermal_rollers",
    "protection:thermal_rollers",
    "summary",
  ])
  assert.deepEqual(discoveryHeatSteps({ heatEvents: {} }).map(heatStepKey), [
    "drying",
    "tools",
    "summary",
  ])
})

test("unanswered is not „none“: the multi-selects wait for an answer, [] answers them", () => {
  assert.equal(isHeatStepAnswered({ heatEvents: {} }, { kind: "drying" }), false)
  assert.equal(isHeatStepAnswered({ dryingRoutes: [], heatEvents: {} }, { kind: "drying" }), true)
  assert.equal(isHeatStepAnswered({ heatEvents: {} }, { kind: "tools" }), false)
  assert.equal(
    isHeatStepAnswered({ additionalHeatTools: [], heatEvents: {} }, { kind: "tools" }),
    true,
  )
})

test("the PUT body carries only the CURRENT sources' answers and validates like the route", () => {
  let draft: DiscoveryHeatDraft = {
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {},
  }
  assert.equal(toDiscoveryHeatStyling(draft), null, "incomplete")
  draft = setHeatEvent(draft, "ordinary_blow_dry", { frequency: "daily_1x" })
  draft = setHeatEvent(draft, "straightener", { frequency: "weekly_2x" })
  assert.equal(toDiscoveryHeatStyling(draft), null, "the straightener still owes its protection")
  draft = setHeatEvent(draft, "straightener", { protectionConsistency: "always" })
  const body = toDiscoveryHeatStyling(draft)
  assert.ok(body)
  assert.equal(parseDiscoveryHeatStyling(body).ok, true)

  // She unticks the straightener: its answers stay in the draft, but never reach the PUT.
  const unticked = toDiscoveryHeatStyling({ ...draft, additionalHeatTools: [] })
  assert.deepEqual(unticked, {
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
  })
  assert.equal(heatSummaryLabel(draft), "Föhnen · Glätteisen")
})

test("„Keiner dieser Wege“ + „Keine weiteren Tools“ is a complete, valid answer", () => {
  const body = toDiscoveryHeatStyling({ dryingRoutes: [], additionalHeatTools: [], heatEvents: {} })
  assert.deepEqual(body, { dryingRoutes: [], additionalHeatTools: [], heatEvents: {} })
  assert.equal(heatSummaryLabel(body!), "Kein Hitze-Styling")
  assert.deepEqual(heatDraftFrom(null), { heatEvents: {} })
  assert.deepEqual(heatDraftFrom(body), body)
})
