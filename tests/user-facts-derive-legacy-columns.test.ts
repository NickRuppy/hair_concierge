import assert from "node:assert/strict"
import test from "node:test"

import type { CareHabitsV1, DiagnosticsV1 } from "../src/lib/user-facts/schema"
import {
  deriveCareHabitsColumns,
  deriveDiagnosticsColumns,
  deriveLegacyColumns,
} from "../src/lib/user-facts/derive-legacy-columns"

// Minimal valid diagnostics/care-habits fixtures. Table rows only override the
// fields the rule under test cares about; every other field is either omitted
// (to test "absent") or filled with an arbitrary valid value.
function diagnostics(overrides: Partial<DiagnosticsV1>): DiagnosticsV1 {
  return {
    source: {
      kind: "personal_plan_v3",
      version: 3,
      leadId: "lead-1",
      raw: { kind: "personal_plan", version: 3, answers: {} },
    },
    ...overrides,
  } as DiagnosticsV1
}

function careHabits(overrides: Partial<CareHabitsV1>): CareHabitsV1 {
  return { ...overrides } as CareHabitsV1
}

// ---------------------------------------------------------------------------
// Diagnostics rules 1-7
// ---------------------------------------------------------------------------

test("rule 1: hair_texture/thickness/density/hair_length copy through, absent -> null", () => {
  const full = deriveDiagnosticsColumns(
    diagnostics({ texture: "wavy", thickness: "fine", density: "low", hairLength: "long" }),
  )
  assert.equal(full.hair_texture, "wavy")
  assert.equal(full.thickness, "fine")
  assert.equal(full.density, "low")
  assert.equal(full.hair_length, "long")

  const empty = deriveDiagnosticsColumns(diagnostics({}))
  assert.equal(empty.hair_texture, null)
  assert.equal(empty.thickness, null)
  assert.equal(empty.density, null)
  assert.equal(empty.hair_length, null)
})

test("rule 2: cuticle_condition/protein_moisture_balance/scalp_type map or copy, absent -> null", () => {
  const smooth = deriveDiagnosticsColumns(diagnostics({ hairSurface: "smooth" }))
  assert.equal(smooth.cuticle_condition, "smooth")
  const slightlyUneven = deriveDiagnosticsColumns(diagnostics({ hairSurface: "slightly_uneven" }))
  assert.equal(slightlyUneven.cuticle_condition, "slightly_rough")
  const rough = deriveDiagnosticsColumns(diagnostics({ hairSurface: "rough" }))
  assert.equal(rough.cuticle_condition, "rough")

  const full = deriveDiagnosticsColumns(
    diagnostics({ elasticResponse: "stretches_stays", scalpOiliness: "oily" }),
  )
  assert.equal(full.protein_moisture_balance, "stretches_stays")
  assert.equal(full.scalp_type, "oily")

  const empty = deriveDiagnosticsColumns(diagnostics({}))
  assert.equal(empty.cuticle_condition, null)
  assert.equal(empty.protein_moisture_balance, null)
  assert.equal(empty.scalp_type, null)
})

test("rule 3: scalp_condition is a priority pick over scalpConcerns", () => {
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ scalpConcerns: ["dry_dandruff", "irritated"] }))
      .scalp_condition,
    "irritated",
  )
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ scalpConcerns: ["oily_dandruff", "dry_dandruff"] }))
      .scalp_condition,
    "dandruff",
  )
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ scalpConcerns: ["dry_dandruff"] })).scalp_condition,
    "dry_flakes",
  )
  assert.equal(deriveDiagnosticsColumns(diagnostics({ scalpConcerns: [] })).scalp_condition, null)
  assert.equal(deriveDiagnosticsColumns(diagnostics({})).scalp_condition, null)
})

test("rule 4: chemical_treatment maps every value, order preserved, deduped; absent -> [], [] -> []", () => {
  assert.deepEqual(
    deriveDiagnosticsColumns(
      diagnostics({
        chemicalTreatments: ["colored", "lightened", "permed", "chemically_straightened"],
      }),
    ).chemical_treatment,
    ["colored", "bleached", "permed", "chemically_straightened"],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ chemicalTreatments: [] })).chemical_treatment,
    [],
  )
  // Controller ruling 2026-09-15 (task-2-3-amendment-brief.md): legacy readers
  // rely on the historical NOT NULL DEFAULT '{}' contract for this column, so an
  // absent fact still projects as [] (never NULL) for this legacy projection.
  assert.deepEqual(deriveDiagnosticsColumns(diagnostics({})).chemical_treatment, [])
})

test("rule 5: concerns map, order preserved, deduped, unmapped dropped, no cap", () => {
  assert.deepEqual(
    deriveDiagnosticsColumns(
      diagnostics({
        currentConcerns: [
          "dry_lengths",
          "frizz_flyaways",
          "hair_damage",
          "hair_loss_or_thinning",
          "breakage",
        ],
      }),
    ).concerns,
    ["dryness", "frizz", "hair_damage", "hair_loss", "breakage"],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ currentConcerns: ["low_shine"] })).concerns,
    [],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ currentConcerns: ["dry_lengths", "frizz_flyaways"] }))
      .concerns,
    ["dryness", "frizz"],
  )
  // Controller ruling 2026-09-15 (task-2-3-amendment-brief.md): legacy readers
  // rely on the historical NOT NULL DEFAULT '{}' contract for this column, so an
  // absent fact still projects as [] (never NULL) for this legacy projection.
  assert.deepEqual(deriveDiagnosticsColumns(diagnostics({})).concerns, [])
})

test("rule 6: goals map incl. volume_balance resolution, no cap, absent -> []", () => {
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ thickness: "fine", goals: ["volume_balance"] })).goals
      ?.length,
    1,
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ thickness: "fine", goals: ["volume_balance"] })).goals,
    ["volume"],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ thickness: "coarse", goals: ["volume_balance"] })).goals,
    ["less_volume"],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(
      diagnostics({
        thickness: "normal",
        density: "medium",
        texture: "straight",
        goals: ["volume_balance"],
      }),
    ).goals,
    [],
  )
  assert.deepEqual(
    deriveDiagnosticsColumns(
      diagnostics({
        goals: [
          "moisture",
          "frizz_surface",
          "shine",
          "shape_definition",
          "strength_ends",
          "scalp_balance",
        ],
      }),
    ).goals,
    ["moisture", "less_frizz", "shine", "curl_definition", "anti_breakage", "healthy_scalp"],
  )
  // frizz_surface and manageability_styling both map to less_frizz: deduped, first occurrence wins.
  assert.deepEqual(
    deriveDiagnosticsColumns(diagnostics({ goals: ["frizz_surface", "manageability_styling"] }))
      .goals,
    ["less_frizz"],
  )
  // Controller ruling 2026-09-15 (task-2-3-amendment-brief.md): legacy readers
  // rely on the historical NOT NULL DEFAULT '{}' contract for this column, so an
  // absent fact still projects as [] (never NULL) for this legacy projection.
  assert.deepEqual(deriveDiagnosticsColumns(diagnostics({})).goals, [])
})

test("rule 7: desired_volume derives from the mapped goals column", () => {
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ thickness: "fine", goals: ["volume_balance"] }))
      .desired_volume,
    "more",
  )
  assert.equal(
    deriveDiagnosticsColumns(diagnostics({ thickness: "coarse", goals: ["volume_balance"] }))
      .desired_volume,
    "less",
  )
  assert.equal(deriveDiagnosticsColumns(diagnostics({ goals: ["moisture"] })).desired_volume, null)
  assert.equal(deriveDiagnosticsColumns(diagnostics({})).desired_volume, null)
})

// ---------------------------------------------------------------------------
// Care habits rules 8-16
// ---------------------------------------------------------------------------

test("rule 8: drying_method is a priority pick over dryingRoutes", () => {
  assert.equal(
    deriveCareHabitsColumns(
      careHabits({ dryingRoutes: ["air_dry", "diffuser_or_airflow_shaping"] }),
    ).drying_method,
    "blow_dry_diffuser",
  )
  assert.equal(
    deriveCareHabitsColumns(careHabits({ dryingRoutes: ["air_dry", "ordinary_blow_dry"] }))
      .drying_method,
    "blow_dry",
  )
  assert.equal(
    deriveCareHabitsColumns(careHabits({ dryingRoutes: ["air_dry"] })).drying_method,
    "air_dry",
  )
  assert.equal(deriveCareHabitsColumns(careHabits({ dryingRoutes: [] })).drying_method, null)
  assert.equal(deriveCareHabitsColumns(careHabits({})).drying_method, null)
})

test("rule 9: heat columns when dryingRoutes and additionalHeatTools are both absent, or S is empty", () => {
  const bothAbsent = deriveCareHabitsColumns(careHabits({}))
  assert.equal(bothAbsent.heat_styling, null)
  assert.equal(bothAbsent.styling_tools, null)
  assert.equal(bothAbsent.uses_heat_protection, false)

  const emptySources = deriveCareHabitsColumns(careHabits({ dryingRoutes: ["air_dry"] }))
  assert.equal(emptySources.heat_styling, "never")
  assert.deepEqual(emptySources.styling_tools, [])
  assert.equal(emptySources.uses_heat_protection, false)
})

test("rule 10: heat_styling picks the highest frequency among heat events", () => {
  const daily = deriveCareHabitsColumns(
    careHabits({
      additionalHeatTools: ["straightener"],
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "daily_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(daily.heat_styling, "daily")

  const severalWeekly = deriveCareHabitsColumns(
    careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(severalWeekly.heat_styling, "several_weekly")

  const rarely = deriveCareHabitsColumns(
    careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(rarely.heat_styling, "rarely")
})

test("rule 11 (amended 2026-09-15): styling_tools is emitted in canonical STAGE2_HEAT_EVENT_SOURCES order, regardless of dryingRoutes/additionalHeatTools input order", () => {
  const result = deriveCareHabitsColumns(
    careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener", "dryer_brush"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  // Canonical order is ordinary_blow_dry, dryer_brush, straightener (not the given
  // additionalHeatTools order [straightener, dryer_brush]).
  assert.deepEqual(result.styling_tools, ["blow_dryer", "hot_air_brush", "flat_iron"])

  const reversedInputOrder = deriveCareHabitsColumns(
    careHabits({
      dryingRoutes: ["diffuser_or_airflow_shaping", "ordinary_blow_dry"],
      additionalHeatTools: ["thermal_rollers", "straightener"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": {
          frequency: "weekly_1x",
          protectionConsistency: "always",
        },
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:thermal_rollers": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.deepEqual(reversedInputOrder.styling_tools, [
    "blow_dryer",
    "diffuser",
    "flat_iron",
    "thermal_rollers",
  ])
})

test("rule 12: uses_heat_protection is true only if every protection-carrying event is 'always'", () => {
  const allAlways = deriveCareHabitsColumns(
    careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(allAlways.uses_heat_protection, true)

  const mixed = deriveCareHabitsColumns(
    careHabits({
      additionalHeatTools: ["straightener", "curling_or_wave_iron"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
      },
    }),
  )
  assert.equal(mixed.uses_heat_protection, false)

  const onlyOrdinaryBlowDry = deriveCareHabitsColumns(
    careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_1x" } },
    }),
  )
  assert.equal(onlyOrdinaryBlowDry.uses_heat_protection, false)

  const ordinaryPlusAlways = deriveCareHabitsColumns(
    careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(ordinaryPlusAlways.uses_heat_protection, true)
})

test("rule 13: towel_material/towel_technique copy through, no_towel drops technique, absent -> null", () => {
  const withTechnique = deriveCareHabitsColumns(
    careHabits({ towel: { material: "mikrofaser", technique: "gentle_press" } }),
  )
  assert.equal(withTechnique.towel_material, "mikrofaser")
  assert.equal(withTechnique.towel_technique, "gentle_press")

  const noTowel = deriveCareHabitsColumns(careHabits({ towel: { material: "no_towel" } }))
  assert.equal(noTowel.towel_material, "no_towel")
  assert.equal(noTowel.towel_technique, null)

  const absent = deriveCareHabitsColumns(careHabits({}))
  assert.equal(absent.towel_material, null)
  assert.equal(absent.towel_technique, null)
})

test("rule 14: night_protection copies through, absent -> null, [] -> []", () => {
  assert.deepEqual(
    deriveCareHabitsColumns(careHabits({ nightProtection: ["silk_satin_bonnet"] }))
      .night_protection,
    ["silk_satin_bonnet"],
  )
  assert.deepEqual(
    deriveCareHabitsColumns(careHabits({ nightProtection: [] })).night_protection,
    [],
  )
  assert.equal(deriveCareHabitsColumns(careHabits({})).night_protection, null)
})

test("rule 15: brush_type copies through from brushesCombs, absent -> null, [] -> []", () => {
  assert.deepEqual(
    deriveCareHabitsColumns(careHabits({ brushesCombs: ["paddle", "wide_tooth_comb"] })).brush_type,
    ["paddle", "wide_tooth_comb"],
  )
  assert.deepEqual(deriveCareHabitsColumns(careHabits({ brushesCombs: [] })).brush_type, [])
  assert.equal(deriveCareHabitsColumns(careHabits({})).brush_type, null)
})

test("rule 16: deriveLegacyColumns only emits keys for non-null domains, union when both present", () => {
  const habitsOnly = deriveLegacyColumns({
    diagnostics: null,
    careHabits: careHabits({ dryingRoutes: ["air_dry"] }),
  })
  assert.ok(!("hair_texture" in habitsOnly))
  assert.ok(!("concerns" in habitsOnly))
  assert.ok("drying_method" in habitsOnly)

  const diagnosticsOnly = deriveLegacyColumns({
    diagnostics: diagnostics({ texture: "curly" }),
    careHabits: null,
  })
  assert.ok(!("drying_method" in diagnosticsOnly))
  assert.ok(!("styling_tools" in diagnosticsOnly))
  assert.ok("hair_texture" in diagnosticsOnly)

  const both = deriveLegacyColumns({
    diagnostics: diagnostics({ texture: "curly" }),
    careHabits: careHabits({ dryingRoutes: ["air_dry"] }),
  })
  assert.ok("hair_texture" in both)
  assert.ok("drying_method" in both)
})
