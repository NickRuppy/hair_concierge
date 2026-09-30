import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOnboardingCareFacts,
  mergeCareHabitsPatch,
  onboardingCareSchema,
  type OnboardingCareValues,
} from "../src/lib/hair-profile/onboarding-care"
import { deriveCareHabitsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import {
  careHabitsV1Schema,
  type CareHabitsV1,
  type FactsProvenance,
} from "../src/lib/user-facts/schema"

/**
 * Clean-switch task 6: the onboarding care-habit steps save through the door. The browser
 * submits the legacy column vocabulary; the server converts it with the ONE existing conversion
 * (`legacyColumnsToCareHabits`) into a `care_habits` patch built like a hand edit. Test-first;
 * the adversarial block at the bottom feeds inputs designed to break it.
 */

const NOW = "2026-09-30T12:00:00.000Z"
const EARLIER = "2026-09-01T08:00:00.000Z"

function doc(value: Record<string, unknown> = {}): CareHabitsV1 {
  return careHabitsV1Schema.parse(value)
}

function provenance(
  kind: "feinschliff_draft" | "legacy_columns" | "onboarding",
  fields: Record<string, "user" | "assumed" | "unknown_historical"> = {},
): FactsProvenance {
  return {
    care_habits: { source: { kind }, schemaVersion: 1, at: EARLIER, fields },
  }
}

function build(input: {
  values: OnboardingCareValues
  careHabits?: CareHabitsV1 | null
  provenance?: FactsProvenance
  row?: Record<string, unknown> | null
}) {
  return buildOnboardingCareFacts({
    values: input.values,
    stored:
      input.careHabits === undefined
        ? null
        : { careHabits: input.careHabits, provenance: input.provenance ?? {} },
    row: input.row ?? null,
    now: NOW,
  })
}

function parse(body: unknown): OnboardingCareValues {
  const result = onboardingCareSchema.safeParse(body)
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  return result.data as OnboardingCareValues
}

const LEGACY_ROW = {
  towel_material: "frottee",
  towel_technique: "rough_rubbing",
  drying_method: "blow_dry",
  styling_tools: ["blow_dryer", "flat_iron"],
  heat_styling: "several_weekly",
  uses_heat_protection: true,
  night_protection: ["silk_satin_pillow"],
  brush_type: ["paddle"],
}

// ---------------------------------------------------------------------------
// Payload contract
// ---------------------------------------------------------------------------

test("schema: accepts every value the onboarding steps submit", () => {
  parse({ styling_tools: ["blow_dryer", "flat_iron", "curling_iron", "wave_iron", "diffuser"] })
  parse({ styling_tools: [], heat_styling: "never", uses_heat_protection: false })
  parse({ heat_styling: "several_weekly" })
  parse({ uses_heat_protection: true })
  parse({ towel_material: "no_towel", towel_technique: null })
  parse({ towel_technique: "gentle_press" })
  parse({ drying_method: "blow_dry_diffuser" })
  parse({ brush_type: ["wide_tooth_comb", "fingers"] })
  parse({ brush_type: null })
  parse({ night_protection: [] })
})

test("schema: duplicates in a list collapse, the order is kept", () => {
  assert.deepEqual(parse({ night_protection: ["pineapple", "pineapple", "loose_tied"] }), {
    night_protection: ["pineapple", "loose_tied"],
  })
})

// ---------------------------------------------------------------------------
// One value group at a time (what each onboarding step submits)
// ---------------------------------------------------------------------------

test("towel material on a profile without a row: a document with the towel, marked user", () => {
  const write = build({ values: { towel_material: "frottee" }, careHabits: null, row: null })
  assert.deepEqual(write.patch, { towel: { material: "frottee" } })
  assert.equal(write.unchanged, undefined)
  assert.deepEqual(write.provenance.source, { kind: "onboarding" })
  assert.equal(write.provenance.at, NOW)
  assert.deepEqual(write.provenance.fields, { towel: "user" })
  assert.equal(write.columns.towel_material, "frottee")
  assert.equal(write.columns.towel_technique, null)
})

test("choosing no towel drops the technique with it", () => {
  const write = build({
    values: { towel_material: "no_towel", towel_technique: null },
    careHabits: doc({ towel: { material: "frottee", technique: "rough_rubbing" } }),
    provenance: provenance("onboarding", { towel: "user" }),
  })
  assert.deepEqual(write.patch, { towel: { material: "no_towel" } })
  assert.deepEqual(write.provenance.fields, { towel: "user" })
  assert.equal(write.columns.towel_technique, null)
})

test("the technique step keeps the stored material", () => {
  const write = build({
    values: { towel_technique: "gentle_press" },
    careHabits: doc({ towel: { material: "mikrofaser" } }),
  })
  assert.deepEqual(write.patch, { towel: { material: "mikrofaser", technique: "gentle_press" } })
  assert.equal(write.columns.towel_material, "mikrofaser")
  assert.equal(write.columns.towel_technique, "gentle_press")
})

test("night protection: an empty list is a real answer, not a missing one", () => {
  const write = build({ values: { night_protection: [] }, careHabits: doc({}) })
  assert.deepEqual(write.patch, { nightProtection: [] })
  assert.deepEqual(write.columns.night_protection, [])
  assert.deepEqual(write.provenance.fields, { nightProtection: "user" })
})

test("night protection is stored in the native order she picked", () => {
  const write = build({
    values: { night_protection: ["pineapple", "silk_satin_pillow"] },
    careHabits: doc({}),
  })
  assert.deepEqual(write.patch, { nightProtection: ["pineapple", "silk_satin_pillow"] })
})

test("brush types go to brushesCombs; clearing them clears the field", () => {
  const set = build({ values: { brush_type: ["paddle", "fingers"] }, careHabits: doc({}) })
  assert.deepEqual(set.patch, { brushesCombs: ["paddle", "fingers"] })
  assert.deepEqual(set.columns.brush_type, ["paddle", "fingers"])

  const cleared = build({
    values: { brush_type: null },
    careHabits: doc({ brushesCombs: ["paddle"] }),
  })
  assert.deepEqual(cleared.patch, { brushesCombs: null })
  assert.equal(cleared.columns.brush_type, null)
})

test("heat tools: the legacy tool list becomes drying routes and additional tools", () => {
  const write = build({
    values: { styling_tools: ["flat_iron", "wave_iron", "diffuser"] },
    careHabits: null,
    row: null,
  })
  assert.deepEqual(write.patch, {
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    additionalHeatTools: ["straightener", "curling_or_wave_iron"],
  })
  // Allowed difference: wave_iron is stored as the combined curling/wave iron → `curling_iron`.
  assert.deepEqual(write.columns.styling_tools, ["diffuser", "flat_iron", "curling_iron"])
  assert.deepEqual(write.provenance.fields, {
    dryingRoutes: "user",
    additionalHeatTools: "user",
  })
})

test("heat frequency after the tools: one event per selected source", () => {
  const write = build({
    values: { heat_styling: "several_weekly" },
    careHabits: doc({ dryingRoutes: [], additionalHeatTools: ["straightener"] }),
  })
  assert.deepEqual(write.patch, {
    heatEvents: { "heat:straightener": { frequency: "weekly_3_4x" } },
  })
  assert.equal(write.columns.heat_styling, "several_weekly")
  assert.deepEqual(write.provenance.fields, { heatEvents: "user" })
})

test("heat protection after the frequency: the flag lands on the sources that ask for it", () => {
  const write = build({
    values: { uses_heat_protection: true },
    careHabits: doc({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
        "heat:straightener": { frequency: "weekly_3_4x" },
      },
    }),
  })
  assert.deepEqual(write.patch, {
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
      "heat:straightener": { frequency: "weekly_3_4x", protectionConsistency: "always" },
    },
  })
  assert.equal(write.columns.uses_heat_protection, true)
})

test("no heat tools at all: the client sends never + no protection with the empty list", () => {
  const write = build({
    values: { styling_tools: [], heat_styling: "never", uses_heat_protection: false },
    careHabits: doc({
      dryingRoutes: [],
      additionalHeatTools: ["straightener"],
      heatEvents: { "heat:straightener": { frequency: "weekly_3_4x" } },
    }),
  })
  assert.deepEqual(write.patch, { additionalHeatTools: [], heatEvents: {} })
  assert.equal(write.columns.heat_styling, "never")
  assert.deepEqual(write.columns.styling_tools, [])
  assert.equal(write.columns.uses_heat_protection, false)
})

test("drying method: a single choice becomes the drying route", () => {
  const write = build({
    values: { drying_method: "air_dry" },
    careHabits: doc({ dryingRoutes: [], additionalHeatTools: [] }),
  })
  assert.deepEqual(write.patch, { dryingRoutes: ["air_dry"] })
  assert.equal(write.columns.drying_method, "air_dry")
})

// ---------------------------------------------------------------------------
// Hand-edit semantics
// ---------------------------------------------------------------------------

test("a partial step never erases answers it does not show", () => {
  const stored = doc({
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "weekly_2x",
    oilPurposes: ["scalp"],
    towel: { material: "frottee", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
    },
    brushesCombs: ["wide_tooth_comb"],
  })
  const write = build({
    values: { night_protection: ["silk_satin_bonnet"] },
    careHabits: stored,
    provenance: provenance("feinschliff_draft", { towel: "user", heatEvents: "assumed" }),
  })
  assert.deepEqual(write.patch, { nightProtection: ["silk_satin_bonnet"] })
  assert.deepEqual(write.provenance.fields, { nightProtection: "user" })
  const merged = mergeCareHabitsPatch(stored, write.patch)
  for (const key of Object.keys(stored) as Array<keyof CareHabitsV1>) {
    assert.deepEqual(merged[key], stored[key], `${key} survives`)
  }
})

test("only a changed value is re-marked user: the unchanged half of a step keeps its marker", () => {
  const write = build({
    values: { towel_material: "frottee", towel_technique: "rough_rubbing" },
    careHabits: doc({ towel: { material: "frottee", technique: "gentle_press" } }),
    provenance: provenance("feinschliff_draft", { towel: "assumed" }),
  })
  assert.deepEqual(write.patch, { towel: { material: "frottee", technique: "rough_rubbing" } })
  assert.deepEqual(write.provenance.fields, { towel: "user" })
})

test("a save that changes nothing is not an edit: nothing to write", () => {
  const stored = doc({
    towel: { material: "frottee", technique: "gentle_press" },
    nightProtection: ["silk_satin_pillow"],
    dryingRoutes: ["air_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
    },
    brushesCombs: [],
  })
  for (const values of [
    { towel_material: "frottee", towel_technique: "gentle_press" },
    { night_protection: ["silk_satin_pillow"] },
    { brush_type: [] },
    { styling_tools: ["flat_iron"] },
    { heat_styling: "once_weekly" },
    { drying_method: "air_dry" },
  ] as OnboardingCareValues[]) {
    const write = build({ values, careHabits: stored, provenance: provenance("onboarding") })
    assert.equal(write.unchanged, true, JSON.stringify(values))
    assert.deepEqual(write.patch, {})
  }
})

test("unchanged columns do not flatten a richer document: per-source answers survive", () => {
  const stored = doc({
    dryingRoutes: ["air_dry", "ordinary_blow_dry"],
    additionalHeatTools: ["straightener", "dryer_brush"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
      "heat:dryer_brush": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
      "heat:straightener": { frequency: "weekly_5_6x", protectionConsistency: "always" },
    },
  })
  const same = build({
    values: {
      styling_tools: ["blow_dryer", "hot_air_brush", "flat_iron"],
      drying_method: "blow_dry",
    },
    careHabits: stored,
  })
  assert.equal(same.unchanged, true)
})

test("adding a tool keeps the per-source answers of the tools that stay", () => {
  const stored = doc({
    dryingRoutes: [],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
    },
  })
  const write = build({
    values: { styling_tools: ["flat_iron", "hot_air_brush"] },
    careHabits: stored,
  })
  assert.deepEqual(write.patch.additionalHeatTools, ["straightener", "dryer_brush"])
  assert.deepEqual(write.patch.heatEvents, {
    // Kept as she answered it (the legacy model only knows the top level `several_weekly`).
    "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
    // The new tool takes the level the legacy model holds for the whole row; its protection is
    // not answered yet (the protection step has not been saved).
    "heat:dryer_brush": { frequency: "weekly_3_4x" },
  })
  assert.equal(write.columns.heat_styling, "several_weekly")
})

test("a changed heat level re-levels every source but keeps the protection answers", () => {
  const stored = doc({
    dryingRoutes: [],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always" },
    },
  })
  const write = build({ values: { heat_styling: "daily" }, careHabits: stored })
  assert.deepEqual(write.patch.heatEvents, {
    "heat:straightener": { frequency: "daily_1x", protectionConsistency: "always" },
  })
  assert.equal(write.columns.heat_styling, "daily")
  assert.equal(write.columns.uses_heat_protection, true)
})

// ---------------------------------------------------------------------------
// Rows without a care_habits document
// ---------------------------------------------------------------------------

test("a row with legacy columns but no document: the door gets the whole converted base", () => {
  const write = build({
    values: { night_protection: [] },
    careHabits: null,
    row: LEGACY_ROW,
  })
  // Every other legacy column is carried into the document, or the door (which derives all 8
  // columns from the document) would blank them.
  assert.deepEqual(write.patch.towel, { material: "frottee", technique: "rough_rubbing" })
  assert.deepEqual(write.patch.brushesCombs, ["paddle"])
  assert.deepEqual(write.patch.nightProtection, [])
  assert.ok(write.patch.dryingRoutes && write.patch.additionalHeatTools && write.patch.heatEvents)
  assert.equal(write.columns.towel_material, "frottee")
  assert.equal(write.columns.heat_styling, "several_weekly")
  assert.deepEqual(write.columns.brush_type, ["paddle"])
  assert.deepEqual(write.columns.night_protection, [])
  // The edit is user, the legacy carry-over is what the backfill calls unknown_historical.
  assert.equal(write.provenance.fields?.nightProtection, "user")
  assert.equal(write.provenance.fields?.towel, "unknown_historical")
  assert.equal(write.provenance.fields?.brushesCombs, "unknown_historical")
  assert.equal(write.provenance.fields?.heatEvents, "unknown_historical")
})

test("a row with legacy columns, unchanged save: nothing is written, the row stays as it is", () => {
  const write = build({
    values: { night_protection: ["silk_satin_pillow"], towel_material: "frottee" },
    careHabits: null,
    row: LEGACY_ROW,
  })
  assert.equal(write.unchanged, true)
  assert.deepEqual(write.patch, {})
})

test("a profile row without any care answer: only what she entered is stored", () => {
  const write = build({
    values: { brush_type: ["fingers"] },
    careHabits: null,
    row: {
      towel_material: null,
      towel_technique: null,
      drying_method: null,
      styling_tools: null,
      heat_styling: null,
      uses_heat_protection: false,
      night_protection: null,
      brush_type: null,
    },
  })
  assert.deepEqual(write.patch, { brushesCombs: ["fingers"] })
  assert.deepEqual(write.provenance.fields, { brushesCombs: "user" })
})

test("a legacy_columns-sourced document is an ordinary stored document", () => {
  const stored = doc({
    towel: { material: "frottee" },
    nightProtection: ["pineapple"],
    brushesCombs: ["round"],
  })
  const write = build({
    values: { towel_technique: "rough_rubbing" },
    careHabits: stored,
    provenance: provenance("legacy_columns", {
      towel: "unknown_historical",
      nightProtection: "unknown_historical",
      brushesCombs: "unknown_historical",
    }),
  })
  assert.deepEqual(write.patch, { towel: { material: "frottee", technique: "rough_rubbing" } })
  assert.deepEqual(write.provenance.source, { kind: "onboarding" })
  assert.deepEqual(
    write.provenance.fields,
    { towel: "user" },
    "the carried fields are not re-marked",
  )
})

// ---------------------------------------------------------------------------
// Adversarial
// ---------------------------------------------------------------------------

test("adversarial: unknown values never reach the conversion", () => {
  for (const body of [
    { styling_tools: ["laser_iron"] },
    { heat_styling: "sometimes" },
    { uses_heat_protection: "yes" },
    { towel_material: "bathrobe" },
    { towel_technique: "rubbeln" },
    { drying_method: "sun" },
    { brush_type: ["hands"] },
    { brush_type: "paddle" },
    { night_protection: ["loose_braid"] },
    { night_protection: null },
    { userId: "someone-else", towel_material: "frottee" },
    {},
  ]) {
    assert.equal(onboardingCareSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test("adversarial: empty arrays are answers; a missing document is not an empty one", () => {
  const empty = build({
    values: { styling_tools: [], brush_type: [], night_protection: [] },
    careHabits: null,
    row: null,
  })
  assert.deepEqual(empty.patch.brushesCombs, [])
  assert.deepEqual(empty.patch.nightProtection, [])
  assert.deepEqual(empty.columns.brush_type, [])
})

test("adversarial: a stored NULL document with a row that has only some columns", () => {
  const write = build({
    values: { towel_material: "mikrofaser" },
    careHabits: null,
    row: { ...LEGACY_ROW, towel_technique: null, night_protection: null, brush_type: null },
  })
  assert.equal(write.columns.towel_material, "mikrofaser")
  assert.equal(write.columns.drying_method, "blow_dry", "an untouched column survives the door")
  assert.deepEqual(write.columns.styling_tools, ["blow_dryer", "flat_iron"])
  assert.equal(write.columns.night_protection, null)
})

test("adversarial: a heat level for a profile with no heat source has no place (finding F4)", () => {
  const write = build({ values: { heat_styling: "daily" }, careHabits: null, row: null })
  // The conversion has no slot for a level without a heat source: the save is a no-op.
  assert.equal(write.unchanged, true)
})

test("adversarial: a towel technique without a material has no place (finding F5)", () => {
  const write = build({ values: { towel_technique: "gentle_press" }, careHabits: null, row: null })
  assert.equal(write.unchanged, true)
})

test("adversarial: the written provenance validates and every derived column is a real column", () => {
  const write = build({
    values: { styling_tools: ["flat_iron"], heat_styling: "rarely", uses_heat_protection: true },
    careHabits: null,
    row: null,
  })
  const merged = mergeCareHabitsPatch(null, write.patch)
  assert.deepEqual(deriveCareHabitsColumns(merged), write.columns)
})
