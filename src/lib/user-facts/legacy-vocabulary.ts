import type {
  AdditionalHeatTool,
  DryingRoute,
  Stage2HeatEventSource,
} from "@/lib/personal-plan/refinement/types"
import type { HeatStyling, ProductFrequency } from "@/lib/vocabulary/frequencies"
import type { DryingMethod } from "@/lib/vocabulary/onboarding-care"
import type {
  ChemicalTreatment,
  CuticleCondition,
  ScalpCondition,
  StylingTool,
} from "@/lib/vocabulary/profile-labels"

/**
 * Pure forward/inverse vocabulary tables shared by `deriveLegacyColumns` (task 2, this
 * program's write-side specification oracle) and the still-live onboarding writer (task 5).
 * No I/O, no `server-only` — every table here is a plain object literal.
 */

// ---------------------------------------------------------------------------
// Drying method <-> drying route
// (inverse of `src/lib/personal-plan/legacy-prefill.ts:100-104`)
// ---------------------------------------------------------------------------

export const DRYING_ROUTE_TO_DRYING_METHOD: Record<DryingRoute, DryingMethod> = {
  air_dry: "air_dry",
  ordinary_blow_dry: "blow_dry",
  diffuser_or_airflow_shaping: "blow_dry_diffuser",
}

export const DRYING_METHOD_TO_DRYING_ROUTE: Record<DryingMethod, DryingRoute> = {
  air_dry: "air_dry",
  blow_dry: "ordinary_blow_dry",
  blow_dry_diffuser: "diffuser_or_airflow_shaping",
}

// ---------------------------------------------------------------------------
// Heat source (Stage-2 heat event source, plus the `diffuser_or_airflow_shaping`
// drying-route id) <-> `hair_profiles.styling_tools` vocabulary
// (extends `src/lib/personal-plan/legacy-prefill.ts:105-111`)
// ---------------------------------------------------------------------------

export type HeatSourceInput = Stage2HeatEventSource | "diffuser_or_airflow_shaping"

export const HEAT_SOURCE_TO_STYLING_TOOL: Record<HeatSourceInput, StylingTool> = {
  ordinary_blow_dry: "blow_dryer",
  diffuser_airflow_shaping: "diffuser",
  diffuser_or_airflow_shaping: "diffuser",
  dryer_brush: "hot_air_brush",
  hot_air_styler: "multi_tool",
  straightener: "flat_iron",
  curling_or_wave_iron: "curling_iron",
  thermal_rollers: "thermal_rollers",
}

export type StylingToolHeatInput = { dryingRoute: DryingRoute } | { tool: AdditionalHeatTool }

export const STYLING_TOOL_TO_HEAT_INPUT: Record<StylingTool, StylingToolHeatInput> = {
  blow_dryer: { dryingRoute: "ordinary_blow_dry" },
  diffuser: { dryingRoute: "diffuser_or_airflow_shaping" },
  hot_air_brush: { tool: "dryer_brush" },
  multi_tool: { tool: "hot_air_styler" },
  flat_iron: { tool: "straightener" },
  curling_iron: { tool: "curling_or_wave_iron" },
  wave_iron: { tool: "curling_or_wave_iron" },
  thermal_rollers: { tool: "thermal_rollers" },
}

// ---------------------------------------------------------------------------
// Product frequency <-> heat styling level
// (`PRODUCT_FREQUENCIES` src/lib/vocabulary/frequencies.ts -> `HEAT_STYLING_LEVELS`)
// ---------------------------------------------------------------------------

export const PRODUCT_FREQUENCY_TO_HEAT_STYLING: Record<ProductFrequency, HeatStyling> = {
  daily_1x: "daily",
  weekly_5_6x: "several_weekly",
  weekly_3_4x: "several_weekly",
  weekly_2x: "several_weekly",
  weekly_1x: "once_weekly",
  biweekly_1x: "rarely",
  monthly_1x: "rarely",
  less_than_monthly: "rarely",
}

export const HEAT_STYLING_TO_PRODUCT_FREQUENCY: Record<HeatStyling, ProductFrequency | null> = {
  daily: "daily_1x",
  several_weekly: "weekly_3_4x",
  once_weekly: "weekly_1x",
  rarely: "less_than_monthly",
  never: null,
}

// ---------------------------------------------------------------------------
// Hair surface (v3 quiz vocabulary) <-> cuticle condition
// (today's writer output, `src/lib/quiz/link-to-profile.ts:33-90` CUTICLE_MAP)
// ---------------------------------------------------------------------------

export type HairSurfaceInput = "smooth" | "slightly_uneven" | "rough"

export const HAIR_SURFACE_TO_CUTICLE_CONDITION: Record<HairSurfaceInput, CuticleCondition> = {
  smooth: "smooth",
  slightly_uneven: "slightly_rough",
  rough: "rough",
}

// ---------------------------------------------------------------------------
// Scalp concern (v3 quiz vocabulary) <-> scalp condition, priority order
// ---------------------------------------------------------------------------

export type ScalpConcernInput = "irritated" | "oily_dandruff" | "dry_dandruff"

export const SCALP_CONCERN_TO_SCALP_CONDITION: Record<ScalpConcernInput, ScalpCondition> = {
  irritated: "irritated",
  oily_dandruff: "dandruff",
  dry_dandruff: "dry_flakes",
}

export const SCALP_CONCERN_PRIORITY: readonly ScalpConcernInput[] = [
  "irritated",
  "oily_dandruff",
  "dry_dandruff",
]

// ---------------------------------------------------------------------------
// Chemical treatment (v3 quiz vocabulary) <-> `hair_profiles.chemical_treatment`
// ---------------------------------------------------------------------------

export type ChemicalTreatmentInput =
  | "natural"
  | "colored"
  | "lightened"
  | "permed"
  | "chemically_straightened"

export const CHEMICAL_TREATMENT_TO_COLUMN: Record<ChemicalTreatmentInput, ChemicalTreatment> = {
  natural: "natural",
  colored: "colored",
  lightened: "bleached",
  permed: "permed",
  chemically_straightened: "chemically_straightened",
}
