import type { ProductFrequency } from "../../src/lib/vocabulary/frequencies"
import type { CareHabitsV1, DiagnosticsV1 } from "../../src/lib/user-facts/schema"

/**
 * The single row source for the SQL/TypeScript derivation parity lane
 * (`tests/user-facts-derive-parity.test.ts`): every row is written through
 * `public.user_facts_save_v1` on PGlite and the resulting `hair_profiles`
 * columns are compared against `deriveLegacyColumns` from
 * `src/lib/user-facts/derive-legacy-columns.ts`.
 *
 * Rows carry INPUTS only, deliberately: the parity test is differential, so the
 * TypeScript oracle supplies the expected values and cannot silently agree with
 * a wrong literal. The rules those inputs exercise (and their expected outputs)
 * are pinned separately, as literals, by
 * `tests/user-facts-derive-legacy-columns.test.ts` and
 * `tests/user-facts-adversarial-derivation.test.ts` (TypeScript side) and by
 * `tests/user-facts-save-v1-migration.test.ts` (SQL side). Those three files are
 * the human-readable spec and are never edited to match this one.
 *
 * Coverage contract (fix round 1):
 *   - every input case of the two TypeScript suites above, rules 1-15;
 *   - one dedicated row per key of CHEMICAL_TREATMENT_TO_COLUMN,
 *     CONCERN_TO_PROFILE_CONCERN_MAP, GOAL_TO_PROFILE_GOAL_MAP,
 *     PRODUCT_FREQUENCY_TO_HEAT_STYLING and HEAT_SOURCE_TO_STYLING_TOOL, and one
 *     per SCALP_CONCERN_PRIORITY subset.
 *
 * Rule 16 (`deriveLegacyColumns` emitting keys only for non-null domains) has no
 * parity counterpart: it is about which keys the TypeScript function returns,
 * while the SQL side expresses the same thing by recomputing only the columns
 * the written domain owns — asserted directly in
 * `user-facts-save-v1-migration.test.ts` ("a write recomputes only the columns
 * owned by its own domain"). The same goes for the oracle's mutation-safety
 * test: there are no shared references across a database round trip.
 */

const V3_SOURCE: DiagnosticsV1["source"] = {
  kind: "personal_plan_v3",
  version: 3,
  leadId: "lead-parity",
  raw: { kind: "personal_plan", version: 3, answers: {} },
}

/** Sparse document: only the named fields are present, everything else is ABSENT. */
function diagnostics(overrides: Partial<DiagnosticsV1>): DiagnosticsV1 {
  return { source: V3_SOURCE, ...overrides } as DiagnosticsV1
}

/**
 * Fully answered document, mirroring the adversarial suite's `makeDiagnostics`
 * base so its cases can be reproduced here field for field. Its two nullable
 * text fields are omitted rather than set to null: a top-level null in an RPC
 * patch means "clear this key", so passing them would store a document that
 * differs from the one the oracle is handed. Neither field feeds a derived
 * column.
 */
function fullDiagnostics(overrides: Partial<DiagnosticsV1>): DiagnosticsV1 {
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
    source: V3_SOURCE,
    ...overrides,
  } as DiagnosticsV1
}

/**
 * Escape hatch for values the v3 quiz enums cannot express but the production
 * vocabulary tables still map. `CONCERN_TO_PROFILE_CONCERN_MAP` and
 * `GOAL_TO_PROFILE_GOAL_MAP` carry entries for the LEGACY onboarding vocabulary
 * (`dryness`, `frizz`, `volume`, `less_volume`, `healthier_hair`, …) which
 * historical rows and task 6's legacy-columns backfill can put in front of the
 * derivation. The SQL transcribes the whole table, so the parity lane checks the
 * whole table.
 */
function legacyVocabularyDiagnostics(overrides: Record<string, unknown>): DiagnosticsV1 {
  return { source: V3_SOURCE, ...overrides } as unknown as DiagnosticsV1
}

function careHabits(overrides: Partial<CareHabitsV1>): CareHabitsV1 {
  return { ...overrides } as CareHabitsV1
}

/** One heat event on `straightener`, to isolate a single frequency bucket. */
function singleHeatEvent(frequency: ProductFrequency): CareHabitsV1 {
  return careHabits({
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:straightener": { frequency, protectionConsistency: "always" },
    },
  })
}

export type DerivationRow = {
  name: string
  diagnostics?: DiagnosticsV1
  careHabits?: CareHabitsV1
}

export const DIAGNOSTICS_DERIVATION_ROWS: readonly DerivationRow[] = [
  // -------------------------------------------------------------------------
  // Rules 1-2: scalar copy-through and mapped scalars, across every enum value
  // -------------------------------------------------------------------------
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
    name: "rule 1/2: the remaining scalar enum values",
    diagnostics: diagnostics({
      texture: "straight",
      thickness: "normal",
      density: "high",
      hairLength: "short",
      hairSurface: "rough",
      elasticResponse: "snaps",
      scalpOiliness: "dry",
    }),
  },
  {
    name: "rule 1/2: coily / coarse / very_long / balanced",
    diagnostics: diagnostics({
      texture: "coily",
      thickness: "coarse",
      density: "medium",
      hairLength: "very_long",
      elasticResponse: "stretches_bounces",
      scalpOiliness: "balanced",
    }),
  },
  {
    name: "rule 1/2: very_short",
    diagnostics: diagnostics({ hairLength: "very_short" }),
  },
  {
    name: "rule 2: hairSurface smooth",
    diagnostics: diagnostics({ hairSurface: "smooth" }),
  },
  {
    name: "rule 2: hairSurface slightly_uneven",
    diagnostics: diagnostics({ hairSurface: "slightly_uneven" }),
  },
  {
    name: "rule 2: hairSurface rough",
    diagnostics: diagnostics({ hairSurface: "rough" }),
  },
  {
    name: "adversarial base: every field answered, all arrays empty",
    diagnostics: fullDiagnostics({}),
  },

  // -------------------------------------------------------------------------
  // Rule 3: scalp_condition priority — every subset of SCALP_CONCERN_PRIORITY
  // -------------------------------------------------------------------------
  {
    name: "rule 3: scalp concerns explicitly none",
    diagnostics: diagnostics({ scalpConcerns: [] }),
  },
  {
    name: "rule 3: only irritated",
    diagnostics: diagnostics({ scalpConcerns: ["irritated"] }),
  },
  {
    name: "rule 3: only oily_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["oily_dandruff"] }),
  },
  {
    name: "rule 3: only dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff"] }),
  },
  {
    name: "rule 3: irritated and oily_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["oily_dandruff", "irritated"] }),
  },
  {
    name: "rule 3: scalp concerns pick irritated over dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff", "irritated"] }),
  },
  {
    name: "rule 3: scalp concerns pick oily_dandruff over dry_dandruff",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff", "oily_dandruff"] }),
  },
  {
    name: "rule 3: all three in reverse priority order",
    diagnostics: diagnostics({ scalpConcerns: ["dry_dandruff", "oily_dandruff", "irritated"] }),
  },

  // -------------------------------------------------------------------------
  // Rule 4: chemical_treatment — every CHEMICAL_TREATMENT_TO_COLUMN key
  // -------------------------------------------------------------------------
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
    name: "rule 4: permed, lightened, colored (adversarial order)",
    diagnostics: diagnostics({ chemicalTreatments: ["permed", "lightened", "colored"] }),
  },
  {
    name: "rule 4: chemically_straightened alone",
    diagnostics: diagnostics({ chemicalTreatments: ["chemically_straightened"] }),
  },

  // -------------------------------------------------------------------------
  // Rule 5: concerns — every v3 concern value, mapped and unmapped
  // -------------------------------------------------------------------------
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
    name: "rule 5: split_ends and tangling",
    diagnostics: diagnostics({ currentConcerns: ["split_ends", "tangling"] }),
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
    name: "rule 5: all seven, including all three droppable values",
    diagnostics: diagnostics({
      currentConcerns: [
        "low_shine",
        "dry_lengths",
        "lost_shape",
        "frizz_flyaways",
        "low_volume_or_weighed_down",
        "hair_loss_or_thinning",
        "tangling",
      ],
    }),
  },
  {
    name: "rule 5: single frizz_flyaways",
    diagnostics: diagnostics({ currentConcerns: ["frizz_flyaways"] }),
  },
  {
    name: "rule 5: concerns explicitly none",
    diagnostics: diagnostics({ currentConcerns: [] }),
  },

  // -------------------------------------------------------------------------
  // Rule 5b (main #611): primary_concern — explicit pick, else sole concern
  // -------------------------------------------------------------------------
  {
    name: "rule 5b: explicit pick among several concerns",
    diagnostics: diagnostics({
      currentConcerns: ["dry_lengths", "breakage"],
      primaryConcern: "breakage",
    }),
  },
  {
    name: "rule 5b: explicit pick projects into the concerns vocabulary (dry_lengths -> dryness)",
    diagnostics: diagnostics({
      currentConcerns: ["tangling", "dry_lengths"],
      primaryConcern: "dry_lengths",
    }),
  },
  {
    name: "rule 5b: explicit pick hair_loss_or_thinning -> hair_loss",
    diagnostics: diagnostics({
      currentConcerns: ["frizz_flyaways", "hair_loss_or_thinning"],
      primaryConcern: "hair_loss_or_thinning",
    }),
  },
  {
    name: "rule 5b: explicit pick without a legacy equivalent -> null",
    diagnostics: diagnostics({
      currentConcerns: ["low_shine", "breakage"],
      primaryConcern: "low_shine",
    }),
  },
  {
    name: "rule 5b: stale pick with several concerns -> null",
    diagnostics: diagnostics({
      currentConcerns: ["breakage", "tangling"],
      primaryConcern: "frizz_flyaways",
    }),
  },
  {
    name: "rule 5b: stale pick with a sole concern -> the sole concern",
    diagnostics: diagnostics({ currentConcerns: ["tangling"], primaryConcern: "breakage" }),
  },
  {
    name: "rule 5b: sole concern, no pick -> the sole concern",
    diagnostics: diagnostics({ currentConcerns: ["split_ends"] }),
  },
  {
    name: "rule 5b: pick but currentConcerns absent -> null",
    diagnostics: diagnostics({ primaryConcern: "breakage" }),
  },

  // -------------------------------------------------------------------------
  // Rules 6-7: goals, volume_balance resolution, desired_volume
  // -------------------------------------------------------------------------
  {
    name: "rule 6/7: volume_balance resolved to volume by fine thickness",
    diagnostics: diagnostics({ thickness: "fine", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to volume by low density",
    diagnostics: diagnostics({ thickness: "normal", density: "low", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance tie-break — fine thickness AND high density",
    diagnostics: diagnostics({
      thickness: "fine",
      density: "high",
      texture: "straight",
      goals: ["volume_balance"],
    }),
  },
  {
    name: "rule 6/7: volume_balance tie-break — low density AND coarse thickness",
    diagnostics: diagnostics({
      thickness: "coarse",
      density: "low",
      texture: "curly",
      goals: ["volume_balance"],
    }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by coarse thickness",
    diagnostics: diagnostics({ thickness: "coarse", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by high density",
    diagnostics: diagnostics({ density: "high", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by wavy texture",
    diagnostics: diagnostics({ texture: "wavy", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by curly texture",
    diagnostics: diagnostics({ texture: "curly", goals: ["volume_balance"] }),
  },
  {
    name: "rule 6/7: volume_balance resolved to less_volume by coily texture",
    diagnostics: diagnostics({ texture: "coily", goals: ["volume_balance"] }),
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
    name: "rule 6/7: volume_balance unresolvable on a fully answered document",
    diagnostics: fullDiagnostics({ goals: ["volume_balance"] }),
  },
  {
    name: "rule 6: the whole mappable v3 goal vocabulary",
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
    name: "rule 6: all eight v3 goals including a dropped volume_balance",
    diagnostics: fullDiagnostics({
      goals: [
        "moisture",
        "frizz_surface",
        "shine",
        "shape_definition",
        "strength_ends",
        "scalp_balance",
        "manageability_styling",
        "volume_balance",
      ],
    }),
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

  // -------------------------------------------------------------------------
  // Legacy vocabulary: the table entries the v3 enums cannot express. One row
  // per remaining key of GOAL_TO_PROFILE_GOAL_MAP and
  // CONCERN_TO_PROFILE_CONCERN_MAP, plus whole-table and unknown-value rows.
  // -------------------------------------------------------------------------
  {
    name: "legacy goal key: less_frizz",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["less_frizz"] }),
  },
  {
    name: "legacy goal key: curl_definition",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["curl_definition"] }),
  },
  {
    name: "legacy goal key: anti_breakage",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["anti_breakage"] }),
  },
  {
    name: "legacy goal key: less_split_ends",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["less_split_ends"] }),
  },
  {
    name: "legacy goal key: healthy_scalp",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["healthy_scalp"] }),
  },
  {
    name: "legacy goal key: volume (desired_volume 'more')",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["volume"] }),
  },
  {
    name: "legacy goal key: less_volume (desired_volume 'less')",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["less_volume"] }),
  },
  {
    name: "legacy goal key: healthier_hair",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["healthier_hair"] }),
  },
  {
    name: "legacy goal key: color_protection",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["color_protection"] }),
  },
  {
    name: "legacy goal key: strengthen",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["strengthen"] }),
  },
  {
    name: "legacy goal keys: the whole GOAL_TO_PROFILE_GOAL_MAP in table order",
    diagnostics: legacyVocabularyDiagnostics({
      goals: [
        "moisture",
        "frizz_surface",
        "less_frizz",
        "shine",
        "shape_definition",
        "curl_definition",
        "strength_ends",
        "anti_breakage",
        "less_split_ends",
        "scalp_balance",
        "healthy_scalp",
        "manageability_styling",
        "volume",
        "less_volume",
        "healthier_hair",
        "color_protection",
        "strengthen",
      ],
    }),
  },
  {
    name: "legacy goal keys: less_volume before volume (both directions present)",
    diagnostics: legacyVocabularyDiagnostics({ goals: ["less_volume", "volume"] }),
  },
  {
    name: "legacy concern key: dryness",
    diagnostics: legacyVocabularyDiagnostics({ currentConcerns: ["dryness"] }),
  },
  {
    name: "legacy concern key: frizz",
    diagnostics: legacyVocabularyDiagnostics({ currentConcerns: ["frizz"] }),
  },
  {
    name: "legacy concern keys: the whole CONCERN_TO_PROFILE_CONCERN_MAP in table order",
    diagnostics: legacyVocabularyDiagnostics({
      currentConcerns: [
        "hair_damage",
        "breakage",
        "split_ends",
        "dryness",
        "dry_lengths",
        "frizz",
        "frizz_flyaways",
        "tangling",
        "hair_loss_or_thinning",
      ],
    }),
  },
  {
    name: "unknown vocabulary values are dropped, not mapped",
    diagnostics: legacyVocabularyDiagnostics({
      goals: ["not_a_goal", "moisture"],
      currentConcerns: ["not_a_concern", "dry_lengths"],
      chemicalTreatments: ["not_a_treatment", "colored"],
      scalpConcerns: ["not_a_scalp_concern"],
      hairSurface: "not_a_surface",
    }),
  },
]

export const CARE_HABITS_DERIVATION_ROWS: readonly DerivationRow[] = [
  // -------------------------------------------------------------------------
  // Rule 8: drying_method priority
  // -------------------------------------------------------------------------
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
    name: "rule 8: all three routes at once",
    careHabits: careHabits({
      dryingRoutes: ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:diffuser_airflow_shaping": {
          frequency: "weekly_1x",
          protectionConsistency: "always",
        },
      },
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

  // -------------------------------------------------------------------------
  // Rule 9: unanswered vs answered-with-nothing
  // -------------------------------------------------------------------------
  {
    name: "rule 9: neither drying routes nor additional heat tools answered",
    careHabits: careHabits({ nightProtection: ["silk_satin_pillow"] }),
  },
  {
    name: "rule 9: drying routes absent, additional heat tools explicitly none",
    careHabits: careHabits({ additionalHeatTools: [] }),
  },
  {
    name: "rule 9: both question groups answered with nothing",
    careHabits: careHabits({ dryingRoutes: [], additionalHeatTools: [] }),
  },

  // -------------------------------------------------------------------------
  // Rule 10: heat_styling — one row per PRODUCT_FREQUENCY_TO_HEAT_STYLING key
  // -------------------------------------------------------------------------
  {
    name: "rule 10: frequency less_than_monthly",
    careHabits: singleHeatEvent("less_than_monthly"),
  },
  { name: "rule 10: frequency monthly_1x", careHabits: singleHeatEvent("monthly_1x") },
  { name: "rule 10: frequency biweekly_1x", careHabits: singleHeatEvent("biweekly_1x") },
  { name: "rule 10: frequency weekly_1x", careHabits: singleHeatEvent("weekly_1x") },
  { name: "rule 10: frequency weekly_2x", careHabits: singleHeatEvent("weekly_2x") },
  { name: "rule 10: frequency weekly_3_4x", careHabits: singleHeatEvent("weekly_3_4x") },
  { name: "rule 10: frequency weekly_5_6x", careHabits: singleHeatEvent("weekly_5_6x") },
  { name: "rule 10: frequency daily_1x", careHabits: singleHeatEvent("daily_1x") },
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
    name: "rule 10: the LAST listed event is the lower one, the highest still wins",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
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
    name: "rule 10: an event recorded for a source that is NOT selected",
    careHabits: careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:thermal_rollers": { frequency: "daily_1x", protectionConsistency: "sometimes" },
      },
    }),
  },

  // -------------------------------------------------------------------------
  // Rule 11: styling_tools — one row per HEAT_SOURCE_TO_STYLING_TOOL source
  // -------------------------------------------------------------------------
  {
    name: "rule 11: source ordinary_blow_dry -> blow_dryer",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_1x" } },
    }),
  },
  {
    name: "rule 11: drying route diffuser_or_airflow_shaping keys off heat:diffuser_airflow_shaping",
    careHabits: careHabits({
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      heatEvents: { "heat:diffuser_airflow_shaping": { frequency: "daily_1x" } },
    }),
  },
  {
    name: "rule 11: source dryer_brush -> hot_air_brush",
    careHabits: careHabits({
      additionalHeatTools: ["dryer_brush"],
      heatEvents: {
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 11: source hot_air_styler -> multi_tool",
    careHabits: careHabits({
      additionalHeatTools: ["hot_air_styler"],
      heatEvents: {
        "heat:hot_air_styler": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 11: source straightener -> flat_iron",
    careHabits: singleHeatEvent("weekly_1x"),
  },
  {
    name: "rule 11: source curling_or_wave_iron -> curling_iron",
    careHabits: careHabits({
      additionalHeatTools: ["curling_or_wave_iron"],
      heatEvents: {
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
  },
  {
    name: "rule 11: source thermal_rollers -> thermal_rollers",
    careHabits: careHabits({
      additionalHeatTools: ["thermal_rollers"],
      heatEvents: {
        "heat:thermal_rollers": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    }),
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

  // -------------------------------------------------------------------------
  // Rule 12: uses_heat_protection — every HEAT_PROTECTION_CONSISTENCIES value
  // -------------------------------------------------------------------------
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
    name: "rule 12: one 'unsure' among 'always' turns protection off",
    careHabits: careHabits({
      additionalHeatTools: ["straightener", "curling_or_wave_iron"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:curling_or_wave_iron": { frequency: "weekly_1x", protectionConsistency: "unsure" },
      },
    }),
  },
  {
    name: "rule 12: protection answered 'no'",
    careHabits: careHabits({
      additionalHeatTools: ["straightener"],
      heatEvents: { "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "no" } },
    }),
  },
  {
    name: "rule 12: two tools, both 'always'",
    careHabits: careHabits({
      additionalHeatTools: ["straightener", "thermal_rollers"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:thermal_rollers": { frequency: "weekly_1x", protectionConsistency: "always" },
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
    name: "rule 12: ordinary blow dry at daily_1x, still unprotected",
    careHabits: careHabits({
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
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

  // -------------------------------------------------------------------------
  // Rules 13-15: towel, night protection, brushes
  // -------------------------------------------------------------------------
  {
    name: "rule 13: towel material and technique",
    careHabits: careHabits({ towel: { material: "mikrofaser", technique: "gentle_press" } }),
  },
  {
    name: "rule 13: rough_rubbing technique",
    careHabits: careHabits({ towel: { material: "frottee", technique: "rough_rubbing" } }),
  },
  {
    name: "rule 13: no towel, no technique",
    careHabits: careHabits({ towel: { material: "no_towel" } }),
  },
  {
    name: "rule 13: material without a technique",
    careHabits: careHabits({ towel: { material: "turban_mikrofaser" } }),
  },
  {
    name: "rule 13: towel absent",
    careHabits: careHabits({ brushesCombs: ["detangling"] }),
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
    name: "rule 14: every night-protection value",
    careHabits: careHabits({
      nightProtection: [
        "silk_satin_pillow",
        "silk_satin_bonnet",
        "loose_tied",
        "pineapple",
        "length_tip_accessory",
      ],
    }),
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
    name: "rule 15: every brush value",
    careHabits: careHabits({
      brushesCombs: ["wide_tooth_comb", "detangling", "paddle", "round", "boar_bristle", "fingers"],
    }),
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
  {
    name: "an empty care-habits document",
    careHabits: careHabits({}),
  },
]
