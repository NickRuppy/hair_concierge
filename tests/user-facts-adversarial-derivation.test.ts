import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveCareHabitsColumns,
  deriveDiagnosticsColumns,
  deriveLegacyColumns,
} from "@/lib/user-facts/derive-legacy-columns"
import type { CareHabitsV1, DiagnosticsV1 } from "@/lib/user-facts/schema"
import {
  CONCERN_TO_PROFILE_CONCERN_MAP,
  GOAL_TO_PROFILE_GOAL_MAP,
  resolveVolumeBalanceGoal,
} from "@/lib/quiz/normalization"
import { deriveDesiredVolumeFromGoals } from "@/lib/hair-profile/derived"

// ---------------------------------------------------------------------------
// Fixture helpers (blind to the implementation under test)
// ---------------------------------------------------------------------------

function makeDiagnostics(overrides: Partial<DiagnosticsV1>): DiagnosticsV1 {
  return {
    texture: "straight",
    thickness: "normal",
    density: "medium",
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: [],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    goals: [],
    currentConcerns: [],
    concernRecurrence: null,
    currentConcernsOtherText: null,
    source: {
      kind: "personal_plan_v3",
      version: 3,
      leadId: "lead-1",
      artifactId: "art-1",
      raw: {},
    },
    ...overrides,
  } as DiagnosticsV1
}

function makeCareHabits(overrides: Partial<CareHabitsV1>): CareHabitsV1 {
  return { ...overrides }
}

// Oracle helper: map a list of currentConcerns/goals values through today's production
// tables, preserving input order and applying no cap (the spec's stated deviation from
// projectQuizAnswersToLegacyVocabulary's own aggregate ordering/cap behavior).
function oracleConcerns(currentConcerns: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of currentConcerns) {
    const mapped = CONCERN_TO_PROFILE_CONCERN_MAP[value]
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped)
      out.push(mapped)
    }
  }
  return out
}

function oracleGoals(
  goals: readonly string[],
  volumeCtx: { thickness?: string; density?: string; structure?: string },
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of goals) {
    const mapped =
      value === "volume_balance"
        ? resolveVolumeBalanceGoal(volumeCtx)
        : GOAL_TO_PROFILE_GOAL_MAP[value]
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped)
      out.push(mapped)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Diagnostics: scalp_condition priority
// ---------------------------------------------------------------------------

test("scalp_condition: all three concerns in reverse order -> irritated wins by priority", () => {
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({ scalpConcerns: ["dry_dandruff", "oily_dandruff", "irritated"] }),
  )
  assert.equal(result.scalp_condition, "irritated")
})

test("scalp_condition: [dry_dandruff, oily_dandruff] -> dandruff (priority, not input order)", () => {
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({ scalpConcerns: ["dry_dandruff", "oily_dandruff"] }),
  )
  assert.equal(result.scalp_condition, "dandruff")
})

test("scalp_condition: [] -> null", () => {
  const result = deriveDiagnosticsColumns(makeDiagnostics({ scalpConcerns: [] }))
  assert.equal(result.scalp_condition, null)
})

// ---------------------------------------------------------------------------
// Diagnostics: concerns (no cap, order kept, dedupe via mapping)
// ---------------------------------------------------------------------------

test("concerns: 7 incl. all 3 droppable ones -> exactly the 4 mapped, original order, no cap", () => {
  const input = [
    "low_shine",
    "dry_lengths",
    "lost_shape",
    "frizz_flyaways",
    "low_volume_or_weighed_down",
    "hair_loss_or_thinning",
    "tangling",
  ] as const
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({ currentConcerns: [...input] as DiagnosticsV1["currentConcerns"] }),
  )
  assert.deepEqual(result.concerns, oracleConcerns(input))
  assert.deepEqual(result.concerns, ["dryness", "frizz", "hair_loss", "tangling"])
})

test("concerns: single [frizz_flyaways] -> [frizz]", () => {
  const result = deriveDiagnosticsColumns(makeDiagnostics({ currentConcerns: ["frizz_flyaways"] }))
  assert.deepEqual(result.concerns, ["frizz"])
})

test("concerns: absent -> null", () => {
  const { currentConcerns: _omit, ...rest } = makeDiagnostics({})
  const result = deriveDiagnosticsColumns(rest as DiagnosticsV1)
  assert.equal(result.concerns, null)
})

// ---------------------------------------------------------------------------
// Diagnostics: goals incl. volume_balance resolution + desired_volume
// ---------------------------------------------------------------------------

test("goals: volume_balance with thickness normal + density medium + texture straight -> dropped; desired_volume null", () => {
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({
      thickness: "normal",
      density: "medium",
      texture: "straight",
      goals: ["volume_balance"],
    }),
  )
  const expectedGoals = oracleGoals(["volume_balance"], {
    thickness: "normal",
    density: "medium",
    structure: "straight",
  })
  assert.deepEqual(expectedGoals, [])
  assert.deepEqual(result.goals, [])
  assert.equal(result.desired_volume, deriveDesiredVolumeFromGoals([], null))
  assert.equal(result.desired_volume, null)
})

test("goals: volume_balance with texture curly -> less_volume + desired_volume 'less'", () => {
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({
      thickness: "normal",
      density: "medium",
      texture: "curly",
      goals: ["volume_balance"],
    }),
  )
  const expectedGoals = oracleGoals(["volume_balance"], {
    thickness: "normal",
    density: "medium",
    structure: "curly",
  })
  assert.deepEqual(expectedGoals, ["less_volume"])
  assert.deepEqual(result.goals, ["less_volume"])
  assert.equal(result.desired_volume, "less")
})

test("goals: volume_balance with thickness fine AND density high -> 'volume' (fine wins per today's priority)", () => {
  const ctx = { thickness: "fine", density: "high", structure: "straight" }
  const expectedGoals = oracleGoals(["volume_balance"], ctx)
  assert.deepEqual(
    expectedGoals,
    ["volume"],
    "oracle sanity check: fine-or-low-density branch wins",
  )

  const result = deriveDiagnosticsColumns(
    makeDiagnostics({
      thickness: "fine",
      density: "high",
      texture: "straight",
      goals: ["volume_balance"],
    }),
  )
  assert.deepEqual(result.goals, ["volume"])
  assert.equal(result.desired_volume, "more")
})

test("goals: 8 goals -> >= 6 mapped outputs, no cap, order kept, dedupe (frizz_surface + manageability_styling -> one less_frizz)", () => {
  const input = [
    "moisture",
    "frizz_surface",
    "shine",
    "shape_definition",
    "strength_ends",
    "scalp_balance",
    "manageability_styling",
    "volume_balance",
  ] as const
  const ctx = { thickness: "normal", density: "medium", structure: "straight" }
  const result = deriveDiagnosticsColumns(
    makeDiagnostics({
      thickness: "normal",
      density: "medium",
      texture: "straight",
      goals: [...input] as DiagnosticsV1["goals"],
    }),
  )
  const expected = oracleGoals(input, ctx)
  assert.deepEqual(result.goals, expected)
  assert.deepEqual(result.goals, [
    "moisture",
    "less_frizz",
    "shine",
    "curl_definition",
    "anti_breakage",
    "healthy_scalp",
  ])
  assert.ok((result.goals as string[]).length >= 6, "no cap: today's projection caps at 5")
})

test("goals: [] -> goals column [] and desired_volume null", () => {
  const result = deriveDiagnosticsColumns(makeDiagnostics({ goals: [] }))
  assert.deepEqual(result.goals, [])
  assert.equal(result.desired_volume, null)
})

test("goals: absent -> goals null and desired_volume null", () => {
  const { goals: _omit, ...rest } = makeDiagnostics({})
  const result = deriveDiagnosticsColumns(rest as DiagnosticsV1)
  assert.equal(result.goals, null)
  assert.equal(result.desired_volume, null)
})

// ---------------------------------------------------------------------------
// Diagnostics: chemical_treatment, cuticle_condition, misc scalars
// ---------------------------------------------------------------------------

test("chemical_treatment: order kept, lightened -> bleached, absent -> null, [] -> []", () => {
  const withValues = deriveDiagnosticsColumns(
    makeDiagnostics({ chemicalTreatments: ["permed", "lightened", "colored"] }),
  )
  assert.deepEqual(withValues.chemical_treatment, ["permed", "bleached", "colored"])

  const empty = deriveDiagnosticsColumns(makeDiagnostics({ chemicalTreatments: [] }))
  assert.deepEqual(empty.chemical_treatment, [])

  const { chemicalTreatments: _omit, ...rest } = makeDiagnostics({})
  const absent = deriveDiagnosticsColumns(rest as DiagnosticsV1)
  assert.equal(absent.chemical_treatment, null)
})

test("cuticle_condition: slightly_uneven -> slightly_rough", () => {
  const result = deriveDiagnosticsColumns(makeDiagnostics({ hairSurface: "slightly_uneven" }))
  assert.equal(result.cuticle_condition, "slightly_rough")
})

// ---------------------------------------------------------------------------
// deriveLegacyColumns: partial union keying + mutation safety
// ---------------------------------------------------------------------------

test("deriveLegacyColumns: null diagnostics domain -> no diagnostics keys present", () => {
  const result = deriveLegacyColumns({
    diagnostics: null,
    careHabits: makeCareHabits({ nightProtection: ["pineapple"] }),
  })
  assert.equal("hair_texture" in result, false)
  assert.equal("concerns" in result, false)
  assert.equal("night_protection" in result, true)
})

test("deriveLegacyColumns: null careHabits domain -> no care-habits keys present", () => {
  const result = deriveLegacyColumns({
    diagnostics: makeDiagnostics({}),
    careHabits: null,
  })
  assert.equal("drying_method" in result, false)
  assert.equal("heat_styling" in result, false)
  assert.equal("hair_texture" in result, true)
})

test("mutation safety: derived arrays are not the same reference as input arrays", () => {
  const diagnostics = makeDiagnostics({
    currentConcerns: ["dry_lengths"],
    chemicalTreatments: ["colored"],
  })
  const result = deriveDiagnosticsColumns(diagnostics)
  assert.notEqual(result.concerns, diagnostics.currentConcerns)
  assert.notEqual(result.chemical_treatment, diagnostics.chemicalTreatments)
})

// ---------------------------------------------------------------------------
// Care habits: heat derivation
// ---------------------------------------------------------------------------

test("heat: both dryingRoutes and additionalHeatTools absent -> heat_styling/styling_tools null, uses_heat_protection false", () => {
  const result = deriveCareHabitsColumns(makeCareHabits({}))
  assert.equal(result.heat_styling, null)
  assert.equal(result.styling_tools, null)
  assert.equal(result.uses_heat_protection, false)
})

test("heat: dryingRoutes [air_dry] only, additionalHeatTools absent -> S empty -> never/[]/false (NOT null)", () => {
  const result = deriveCareHabitsColumns(makeCareHabits({ dryingRoutes: ["air_dry"] }))
  assert.equal(result.heat_styling, "never")
  assert.deepEqual(result.styling_tools, [])
  assert.equal(result.uses_heat_protection, false)
})

test("heat: dryingRoutes absent + additionalHeatTools [] -> S empty -> never/[]/false", () => {
  const result = deriveCareHabitsColumns(makeCareHabits({ additionalHeatTools: [] }))
  assert.equal(result.heat_styling, "never")
  assert.deepEqual(result.styling_tools, [])
  assert.equal(result.uses_heat_protection, false)
})

test("heat: diffuser_or_airflow_shaping drying route uses heat event key 'heat:diffuser_airflow_shaping' (name mismatch trap)", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": { frequency: "daily_1x" },
      },
    }),
  )
  assert.equal(result.heat_styling, "daily")
  assert.deepEqual(result.styling_tools, ["diffuser"])
})

test("heat: mixed frequencies where the LAST listed is lower -> highest still wins", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "always" },
      },
    }),
  )
  // ordinary_blow_dry weekly_1x is the highest frequency present (monthly_1x < weekly_1x)
  assert.equal(result.heat_styling, "once_weekly")
})

test("heat: weekly_2x -> several_weekly", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
    }),
  )
  assert.equal(result.heat_styling, "several_weekly")
})

test("heat: ordinary_blow_dry alone (daily_1x) -> uses_heat_protection false, heat_styling 'daily'", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
    }),
  )
  assert.equal(result.heat_styling, "daily")
  assert.equal(result.uses_heat_protection, false)
})

test("heat: ordinary_blow_dry + straightener(always) -> uses_heat_protection true", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  )
  assert.equal(result.uses_heat_protection, true)
})

test("heat: straightener(always) + curling(unsure) -> uses_heat_protection false", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      additionalHeatTools: ["straightener", "curling_or_wave_iron"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "unsure" },
      },
    }),
  )
  assert.equal(result.uses_heat_protection, false)
})

test("styling_tools: dryingRoutes [diffuser_or_airflow_shaping, ordinary_blow_dry], tools [thermal_rollers, straightener] -> route order first, given order preserved", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
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
  // Controller ruling 2026-09-15 (task-2-brief.md rule 11, amended): styling_tools is
  // emitted in canonical STAGE2_HEAT_EVENT_SOURCES order, not input/click order — this
  // expectation encoded the superseded "route order first, given order preserved" rule.
  assert.deepEqual(result.styling_tools, ["blow_dryer", "diffuser", "flat_iron", "thermal_rollers"])
})

// ---------------------------------------------------------------------------
// Care habits: drying_method priority
// ---------------------------------------------------------------------------

test("drying_method: diffuser_or_airflow_shaping beats ordinary_blow_dry beats air_dry", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({
      dryingRoutes: ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    }),
  )
  assert.equal(result.drying_method, "blow_dry_diffuser")
})

test("drying_method: absent or [] -> null", () => {
  const absent = deriveCareHabitsColumns(makeCareHabits({}))
  assert.equal(absent.drying_method, null)
  const empty = deriveCareHabitsColumns(makeCareHabits({ dryingRoutes: [] }))
  assert.equal(empty.drying_method, null)
})

// ---------------------------------------------------------------------------
// Care habits: towel, brushesCombs, nightProtection
// ---------------------------------------------------------------------------

test("towel: {material: no_towel} -> towel_technique null", () => {
  const result = deriveCareHabitsColumns(makeCareHabits({ towel: { material: "no_towel" } }))
  assert.equal(result.towel_material, "no_towel")
  assert.equal(result.towel_technique, null)
})

test("towel: {material: mikrofaser, technique: gentle_press} -> both set", () => {
  const result = deriveCareHabitsColumns(
    makeCareHabits({ towel: { material: "mikrofaser", technique: "gentle_press" } }),
  )
  assert.equal(result.towel_material, "mikrofaser")
  assert.equal(result.towel_technique, "gentle_press")
})

test("towel: absent -> both null", () => {
  const result = deriveCareHabitsColumns(makeCareHabits({}))
  assert.equal(result.towel_material, null)
  assert.equal(result.towel_technique, null)
})

test("brushesCombs: [] -> [] ; absent -> null", () => {
  const empty = deriveCareHabitsColumns(makeCareHabits({ brushesCombs: [] }))
  assert.deepEqual(empty.brush_type, [])
  const absent = deriveCareHabitsColumns(makeCareHabits({}))
  assert.equal(absent.brush_type, null)
})

test("nightProtection: [] -> [] ; absent -> null", () => {
  const empty = deriveCareHabitsColumns(makeCareHabits({ nightProtection: [] }))
  assert.deepEqual(empty.night_protection, [])
  const absent = deriveCareHabitsColumns(makeCareHabits({}))
  assert.equal(absent.night_protection, null)
})
