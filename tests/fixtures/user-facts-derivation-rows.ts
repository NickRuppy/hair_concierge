import type { CareHabitsV1, DiagnosticsV1 } from "../../src/lib/user-facts/schema"

/**
 * The shared row source for the SQL/TypeScript derivation parity lane
 * (`tests/user-facts-derive-parity.test.ts`): every row is written through
 * `public.user_facts_save_v1` on PGlite and the resulting `hair_profiles`
 * columns are compared against `deriveLegacyColumns` from
 * `src/lib/user-facts/derive-legacy-columns.ts`.
 *
 * Rows carry INPUTS only, deliberately: the parity test is differential, so the
 * TypeScript oracle supplies the expected values and cannot silently agree with
 * a wrong literal. The rules those inputs exercise (and their expected outputs)
 * are pinned separately, as literals, by
 * `tests/user-facts-derive-legacy-columns.test.ts` (TypeScript side) and
 * `tests/user-facts-save-v1-migration.test.ts` (SQL side).
 *
 * Coverage map — one or more rows per rule of the task-2 brief:
 *   1 scalar copy-through / absent       4-7 array vocabularies, goals, volume
 *   2 mapped scalars                     8   drying-method priority
 *   3 scalp-condition priority           9-12 heat columns
 *                                        13-15 towel / night / brushes
 */

const V3_SOURCE: DiagnosticsV1["source"] = {
  kind: "personal_plan_v3",
  version: 3,
  leadId: "lead-parity",
  raw: { kind: "personal_plan", version: 3, answers: {} },
}

function diagnostics(overrides: Partial<DiagnosticsV1>): DiagnosticsV1 {
  return { source: V3_SOURCE, ...overrides } as DiagnosticsV1
}

function careHabits(overrides: Partial<CareHabitsV1>): CareHabitsV1 {
  return { ...overrides } as CareHabitsV1
}

export type DerivationRow = {
  name: string
  diagnostics?: DiagnosticsV1
  careHabits?: CareHabitsV1
}

export const DIAGNOSTICS_DERIVATION_ROWS: readonly DerivationRow[] = [
  {
    name: "rule 1/2: every scalar answered",
    diagnostics: diagnostics({
      texture: "wavy",
      thickness: "fine",
      density: "low",
      hairLength: "long",
      hairSurface: "slightly_uneven",
      elasticResponse: "stretches_stays",
      scalpOiliness: "oily",
    }),
  },
  {
    name: "rule 1/2: nothing answered but the source envelope",
    diagnostics: diagnostics({}),
  },
  {
    name: "rule 2: hairSurface smooth",
    diagnostics: diagnostics({ hairSurface: "smooth" }),
  },
  {
    name: "rule 2: hairSurface rough",
    diagnostics: diagnostics({ hairSurface: "rough" }),
  },
  {
    name: "rule 3: scalp concerns pick irritated over dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff", "irritated"] }),
  },
  {
    name: "rule 3: scalp concerns pick oily_dandruff over dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["oily_dandruff", "dry_dandruff"] }),
  },
  {
    name: "rule 3: only dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff"] }),
  },
  {
    name: "rule 3: scalp concerns explicitly none",
    diagnostics: diagnostics({ scalpConcerns: [] }),
  },
  {
    name: "rule 4: every chemical treatment, order preserved",
    diagnostics: diagnostics({
      chemicalTreatments: ["colored", "lightened", "permed", "chemically_straightened"],
    }),
  },
  {
    name: "rule 4: chemical treatments explicitly none",
    diagnostics: diagnostics({ chemicalTreatments: [] }),
  },
  {
    name: "rule 4: natural",
    diagnostics: diagnostics({ chemicalTreatments: ["natural"] }),
  },
  {
    name: "rule 5: concerns map, order preserved",
    diagnostics: diagnostics({
      currentConcerns: [
        "dry_lengths",
        "frizz_flyaways",
        "hair_damage",
        "hair_loss_or_thinning",
        "breakage",
      ],
    }),
  },
  {
    name: "rule 5: every concern value unmapped",
    diagnostics: diagnostics({ currentConcerns: ["low_shine"] }),
  },
  {
    name: "rule 5: mapped and unmapped concerns interleaved",
    diagnostics: diagnostics({
      currentConcerns: ["low_shine", "dry_lengths", "lost_shape", "low_volume_or_weighed_down"],
    }),
  },
  {
    name: "rule 5: concerns explicitly none",
    diagnostics: diagnostics({ currentConcerns: [] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to volume by fine thickness",
    diagnostics: diagnostics({ thickness: "fine", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to volume by low density",
    diagnostics: diagnostics({ thickness: "normal", density: "low", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by coarse thickness",
    diagnostics: diagnostics({ thickness: "coarse", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by curly texture",
    diagnostics: diagnostics({ texture: "curly", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance unresolvable",
    diagnostics: diagnostics({
      thickness: "normal",
      density: "medium",
      texture: "straight",
      goals: ["volume_balance"],
    }),
  },
  {
    name: "rule 6: the whole mappable goal vocabulary",
    diagnostics: diagnostics({
      goals: [
        "moisture",
        "frizz_surface",
        "shine",
        "shape_definition",
        "strength_ends",
        "scalp_balance",
      ],
    }),
  },
  {
    name: "rule 6: two goals collapsing onto less_frizz",
    diagnostics: diagnostics({ goals: ["frizz_surface", "manageability_styling"] }),
  },
  {
    name: "rule 6: goals explicitly none",
    diagnostics: diagnostics({ goals: [] }),
  },
  {
    name: "rule 7: a resolved less_volume goal alongside another goal",
    diagnostics: diagnostics({ texture: "coily", goals: ["moisture", "volume_balance"] }),
  },
  {
    name: "rule 7: goals with no volume direction",
    diagnostics: diagnostics({ goals: ["moisture"] }),
  },
  {
    name: "full v3-native document",
    diagnostics: diagnostics({
      texture: "coily",
      thickness: "coarse",
      density: "high",
      hairLength: "very_short",
      hairSurface: "rough",
      elasticResponse: "snaps",
      chemicalTreatments: ["colored", "lightened"],
      scalpOiliness: "dry",
      scalpConcerns: ["oily_dandruff"],
      goals: ["volume_balance", "moisture", "manageability_styling"],
      currentConcerns: ["breakage", "split_ends", "tangling"],
      concernRecurrence: { concernId: "breakage", frequency: "often" },
    }),
  },
]

export const CARE_HABITS_DERIVATION_ROWS: readonly DerivationRow[] = [
  {
    name: "rule 8: diffuser wins the drying-method priority",
    careHabits: careHabits({
      dryingRoutes: ["air_dry", "diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:diffuser_airflow_shaping": {
          frequency: "weekly_1x",
          protectionConsistency: "always",
        },
      },
    }),
  },
  {
    name: "rule 8: ordinary blow dry wins over air dry",
    careHabits: careHabits({
      dryingRoutes: ["air_dry", "ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_1x" } },
    }),
  },
  {
    name: "rule 8/9: air dry only, no heat source selected",
    careHabits: careHabits({ dryingRoutes: ["air_dry"] }),
  },
  {
    name: "rule 8/9: drying routes explicitly none",
    careHabits: careHabits({ dryingRoutes: [] }),
  },
  {
    name: "rule 9: neither drying routes nor additional heat tools answered",
    careHabits: careHabits({ nightProtection: ["silk_satin_pillow"] }),
  },
  {
    name: "rule 10: highest frequency across two events wins",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "daily_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 10: several_weekly bucket",
    careHabits: careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 10: rarely bucket",
    careHabits: careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 10: a selected source with no recorded event at all",
    careHabits: careHabits({
      additionalHeatTools: ["straightener", "thermal_rollers"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_5_6x", protectionConsistency: "no" },
      },
    }),
  },
  {
    name: "rule 10: every selected source missing its event",
    careHabits: careHabits({ additionalHeatTools: ["thermal_rollers"] }),
  },
  {
    name: "rule 11: canonical tool order, input order reversed",
    careHabits: careHabits({
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
  },
  {
    name: "rule 11: every heat source at once",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      additionalHeatTools: [
        "dryer_brush",
        "hot_air_styler",
        "straightener",
        "curling_or_wave_iron",
        "thermal_rollers",
      ],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
        "heat:diffuser_airflow_shaping": {
          frequency: "weekly_1x",
          protectionConsistency: "always",
        },
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:hot_air_styler": { frequency: "biweekly_1x", protectionConsistency: "always" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:curling_or_wave_iron": {
          frequency: "less_than_monthly",
          protectionConsistency: "always",
        },
        "heat:thermal_rollers": { frequency: "monthly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 12: one 'sometimes' among 'always' turns protection off",
    careHabits: careHabits({
      additionalHeatTools: ["straightener", "curling_or_wave_iron"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
      },
    }),
  },
  {
    name: "rule 12: ordinary blow dry carries no protection answer at all",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_1x" } },
    }),
  },
  {
    name: "rule 12: ordinary blow dry plus an always-protected tool",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 12: unsure protection",
    careHabits: careHabits({
      additionalHeatTools: ["hot_air_styler"],
      heatEvents: {
        "heat:hot_air_styler": { frequency: "weekly_1x", protectionConsistency: "unsure" },
      },
    }),
  },
  {
    name: "rule 13: towel material and technique",
    careHabits: careHabits({ towel: { material: "mikrofaser", technique: "gentle_press" } }),
  },
  {
    name: "rule 13: no towel, no technique",
    careHabits: careHabits({ towel: { material: "no_towel" } }),
  },
  {
    name: "rule 14: night protection answered",
    careHabits: careHabits({ nightProtection: ["silk_satin_bonnet", "pineapple"] }),
  },
  {
    name: "rule 14: night protection explicitly none",
    careHabits: careHabits({ nightProtection: [] }),
  },
  {
    name: "rule 15: brushes answered",
    careHabits: careHabits({ brushesCombs: ["paddle", "wide_tooth_comb"] }),
  },
  {
    name: "rule 15: brushes explicitly none",
    careHabits: careHabits({ brushesCombs: [] }),
  },
  {
    name: "a full care-habits document including non-derived fields",
    careHabits: careHabits({
      currentProductCategories: ["shampoo", "conditioner"],
      wetWashFrequency: "weekly_3_4x",
      oilPurposes: ["prewash_lengths"],
      towel: { material: "tshirt", technique: "rough_rubbing" },
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["curling_or_wave_iron"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_5_6x" },
        "heat:curling_or_wave_iron": { frequency: "weekly_2x", protectionConsistency: "always" },
      },
      nightProtection: ["loose_tied"],
      brushesCombs: ["boar_bristle", "fingers"],
    }),
  },
]
