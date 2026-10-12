import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { projectToolsForDay } from "@/lib/personal-plan/tools/application"
import {
  atDayAnchor,
  placementForAnchor,
  TOOL_CAPABILITIES,
  TOOL_DAY_ANCHORS,
  type ToolAsset,
  type ToolDayAnchor,
  type ToolOccurrence,
} from "@/lib/personal-plan/tools/contracts"
import { buildToolView } from "@/lib/personal-plan/tools/read-view"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * WS6 — the shared day-anchor graph (`D7`, ruled 2026-08-24), ported onto the read-time view.
 *
 * Engine-level parts (the graph, derived placement, instructions per capability, day gating)
 * are asserted here, plus the read-time `applicationGuidance` projected per day. The RENDERED
 * Waschtag assertions (towel before Leave-in, Hitzeschutz before the heated step, Applikator
 * before its scalp product, the rough-rubbing merge) run against the real Anwendung view adapter
 * in `tests/personal-plan-tools-application-wash-day.test.tsx`.
 */

// --- fixtures -----------------------------------------------------------------

function asset(
  assetKey: string,
  family: ToolAsset["family"],
  productType: ToolAsset["productTypes"][number],
  capabilities: ToolAsset["capabilities"],
  labelDe: string,
): ToolAsset {
  return {
    assetKey,
    family,
    productTypes: [productType],
    capabilities,
    ownership: "owned_generic",
    presentationState: "use_yours",
    routeKeys: [`tool:${family}:${assetKey}`],
    labelKey: labelDe,
    purposeKey: `Damit du ${labelDe} sinnvoll einsetzt`,
    imageKey: productType,
  }
}

const TOWEL = asset(
  "asset:drying_textiles:microfiber_towel",
  "drying_textiles",
  "microfiber_towel",
  ["absorb_water"],
  "Mikrofaser-Handtuch",
)
const IRON = asset(
  "asset:heated_styling:heated_rollers",
  "heated_styling",
  "heated_rollers",
  ["create_volume", "set_style"],
  "Thermoroller",
)

function occurrence(
  target: ToolAsset,
  capability: ToolOccurrence["capability"],
  position: ToolDayAnchor,
): ToolOccurrence {
  return {
    occurrenceKey: `occurrence:${target.assetKey}:${position}`,
    assetKey: target.assetKey,
    routeKey: target.routeKeys[0],
    capability,
    anchor: atDayAnchor(position),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  }
}

// --- the graph itself ---------------------------------------------------------

test("the shared day graph is the extended 11-position graph, nightly last", () => {
  assert.deepEqual(
    [...TOOL_DAY_ANCHORS],
    [
      "pre_wash",
      "wet_cleanse",
      "post_cleanse_rinse_off",
      "post_rinse_towel_dry",
      "timed_treatment",
      "damp_leave_on",
      "dry_pre_heat",
      "heat_tool",
      "dry_finish",
      "styling_session",
      "nightly",
    ],
  )
})

test("ToolPlacement is derived from the graph, never defined beside it", () => {
  const derived = TOOL_DAY_ANCHORS.map((position) => placementForAnchor(atDayAnchor(position)))
  assert.deepEqual(derived, [
    "wash",
    "wash",
    "wash",
    "post_wash",
    "post_wash",
    "post_wash",
    "drying",
    "drying",
    "drying",
    "styling",
    "nightly",
  ])
})

test("a step-relative anchor keeps its own graph position", () => {
  const relative = atDayAnchor("post_rinse_towel_dry", { side: "after", stepKey: "conditioner" })
  assert.equal(placementForAnchor(relative), "post_wash")
  const stylingRelative = atDayAnchor("styling_session", { side: "before", stepKey: "oil" })
  assert.equal(
    placementForAnchor(stylingRelative),
    "styling",
    "a step-relative anchor must not collapse into post_wash",
  )
})

// --- every recommended step carries usable instructions -----------------------

test("every capability the plan can anchor carries German instructions", () => {
  for (const capability of TOOL_CAPABILITIES) {
    const projection = projectToolsForDay({
      dayType: "wash_day",
      assets: [IRON],
      occurrences: [occurrence(IRON, capability, "heat_tool")],
      guidance: [],
    })
    const section = projection.sections[0]
    assert.ok(section, `${capability} must produce a section`)
    assert.ok(
      section.actionsDe.length > 0,
      `${capability} renders an empty instruction block — the step is useless`,
    )
    for (const action of section.actionsDe) {
      assert.ok(action.length > 12, `${capability}: "${action}" is not a usable instruction`)
      assert.equal(
        TOOL_CAPABILITIES.some((token) => action.includes(token)),
        false,
        `${capability}: the raw token leaked into user-visible copy — "${action}"`,
      )
    }
  }
})

// --- day gating ---------------------------------------------------------------

test("a heated Tool session happens on wash days and on the styling day", () => {
  const present = [
    "wash_day",
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
    "styling_day",
  ] as const
  for (const dayType of present) {
    const projection = projectToolsForDay({
      dayType,
      assets: [IRON],
      occurrences: [occurrence(IRON, "create_volume", "heat_tool")],
      guidance: [],
    })
    assert.equal(projection.sections.length, 1, `${dayType} must keep the heated Tool step`)
  }
  for (const dayType of ["refresh_day", "between_wash_care_day", "rest_day"] as const) {
    const projection = projectToolsForDay({
      dayType,
      assets: [IRON],
      occurrences: [occurrence(IRON, "create_volume", "heat_tool")],
      guidance: [],
    })
    assert.equal(projection.sections.length, 0, `${dayType} has no styling session`)
  }
})

test("a wash-phase Tool never leaks onto the styling day", () => {
  const projection = projectToolsForDay({
    dayType: "styling_day",
    assets: [TOWEL],
    occurrences: [occurrence(TOWEL, "absorb_water", "post_rinse_towel_dry")],
    guidance: [],
  })
  assert.equal(projection.sections.length, 0)
})

// --- the read-time applicationGuidance on the day graph (Lena, §6) ------------

function lenaGuidance() {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-10-10T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("unreachable")
  const careHabits = {
    toolFamiliesWithSomething: [
      "drying_textiles",
      "brushes_combs",
      "airflow",
      "heated_styling",
      "heatless_styling",
      "securing_sectioning",
      "night_protection",
    ],
    toolForms_wash_application_1: [],
    toolForms_drying_textiles_1: ["microfiber_towel"],
    toolForms_brushes_combs_1: ["wide_tooth_comb"],
    toolForms_brushes_combs_2: ["round_brush"],
    toolForms_airflow_1: ["hair_dryer", "hot_air_brush"],
    toolForms_heated_styling_1: ["flat_iron"],
    toolForms_heatless_styling_1: [],
    toolForms_securing_sectioning_1: [],
    toolForms_securing_sectioning_2: [],
    toolForms_night_protection_1: ["pillowcase"],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry", "ordinary_blow_dry"],
    additionalHeatTools: ["dryer_brush", "straightener"],
    nightProtection: ["silk_satin_pillow"],
  } as const
  const view = buildToolView({
    careHabits: careHabits as never,
    fieldProvenance: Object.fromEntries(Object.keys(careHabits).map((key) => [key, "user"])),
    needSnapshot: computed.snapshot,
    routine: null,
    hasOptionalPage: true,
    toolsEnabled: true,
  })
  assert.ok(view)
  return view!.applicationGuidance
}

test("Lena's read-time guidance projects onto the Waschtag in graph order", () => {
  const guidance = lenaGuidance()
  const projection = projectToolsForDay({ dayType: "wash_day", ...guidance })
  assert.deepEqual(
    projection.sections.map((section) => [section.typeLabelDe, section.anchor.position]),
    [
      ["Grobzinkiger Kamm", "post_rinse_towel_dry"],
      ["Mikrofaser-Handtuch", "post_rinse_towel_dry"],
      ["Föhn", "dry_pre_heat"],
      ["Glätteisen", "heat_tool"],
      ["Glatter Kissenbezug (z. B. Seide, Satin)", "nightly"],
    ],
  )
  // Every Tool she reached for is on the day's shelf exactly once.
  assert.equal(projection.shelf.length, 5)
})

test("Lena's styling day keeps the dryer and the iron, never the towel or the comb", () => {
  const projection = projectToolsForDay({ dayType: "styling_day", ...lenaGuidance() })
  assert.deepEqual(
    projection.sections.map((section) => section.typeLabelDe),
    ["Föhn", "Glätteisen", "Glatter Kissenbezug (z. B. Seide, Satin)"],
  )
})
