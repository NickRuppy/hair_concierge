import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type {
  NightProtection,
  TowelMaterial,
  TowelTechnique,
} from "@/lib/vocabulary/onboarding-care"

export type { ProductFrequency, NightProtection, TowelMaterial, TowelTechnique }

export const STAGE2_PRODUCT_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "heat_protectant",
  "oil",
  "mask",
  "scalp_care",
  "dry_shampoo",
  "bondbuilder",
  "deep_cleansing_shampoo",
] as const
export type Stage2ProductCategory = (typeof STAGE2_PRODUCT_CATEGORIES)[number]
export type WetWashFrequency = ProductFrequency | "does_not_wash"
export const WET_WASH_FREQUENCIES = [...PRODUCT_FREQUENCIES, "does_not_wash"] as const
export const SCALP_IRRITATION_DETAILS = [
  "mild_sensitive_or_itchy",
  "burning_painful_or_inflamed",
] as const
export type ScalpIrritationDetail = (typeof SCALP_IRRITATION_DETAILS)[number]
export const DRY_SHAMPOO_BRIDGE_PREFERENCES = ["accept", "decline"] as const
export type DryShampooBridgePreference = (typeof DRY_SHAMPOO_BRIDGE_PREFERENCES)[number]
export const DRY_SHAMPOO_VISIBLE_HAIR_COLORS = ["light_blonde", "brown", "dark"] as const
export type DryShampooVisibleHairColor = (typeof DRY_SHAMPOO_VISIBLE_HAIR_COLORS)[number]
export const OIL_PURPOSES = ["prewash_lengths", "damp_leave_on", "dry_finish", "scalp"] as const
export type OilPurpose = (typeof OIL_PURPOSES)[number]
export const DRYING_ROUTES = [
  "air_dry",
  "ordinary_blow_dry",
  "diffuser_or_airflow_shaping",
] as const
export type DryingRoute = (typeof DRYING_ROUTES)[number]
export const ADDITIONAL_HEAT_TOOLS = [
  "dryer_brush",
  "hot_air_styler",
  "straightener",
  "curling_or_wave_iron",
  "thermal_rollers",
] as const
export type AdditionalHeatTool = (typeof ADDITIONAL_HEAT_TOOLS)[number]
export const HEAT_PROTECTION_CONSISTENCIES = ["always", "sometimes", "no", "unsure"] as const
export type HeatProtectionConsistency = (typeof HEAT_PROTECTION_CONSISTENCIES)[number]
export const STAGE2_HEAT_EVENT_SOURCES = [
  "ordinary_blow_dry",
  "diffuser_airflow_shaping",
  "dryer_brush",
  "hot_air_styler",
  "straightener",
  "curling_or_wave_iron",
  "thermal_rollers",
] as const
export type Stage2HeatEventSource = (typeof STAGE2_HEAT_EVENT_SOURCES)[number]
export type Stage2HeatEventTool =
  | "hair_dryer"
  | "dryer_brush"
  | "hot_air_styler"
  | "straightener"
  | "curling_iron"
  | "other"
export type Stage2HeatEventRoute = "ordinary_airflow" | "airflow_shaping" | "direct_contact_heat"
export const DETANGLING_STYLING_CONTEXTS = [
  "wet_or_damp_with_slip",
  "wet_or_damp_without_slip",
  "dry",
  "during_blowdry_or_styling",
  "fingers_only",
] as const
export type DetanglingStylingContext = (typeof DETANGLING_STYLING_CONTEXTS)[number]

export type HeatEventAnswer = {
  frequency: ProductFrequency
  protectionConsistency?: HeatProtectionConsistency
}

export type PersonalPlanRefinementAnswersV1 = {
  currentProductCategories?: Stage2ProductCategory[]
  wetWashFrequency?: WetWashFrequency
  scalpIrritationDetail?: ScalpIrritationDetail
  dryShampooBridgePreference?: DryShampooBridgePreference
  dryShampooVisibleHairColor?: DryShampooVisibleHairColor
  oilPurposes?: OilPurpose[]
  towel?: { material: TowelMaterial; technique?: TowelTechnique }
  dryingRoutes?: DryingRoute[]
  additionalHeatTools?: AdditionalHeatTool[]
  heatEvents?: Record<string, HeatEventAnswer>
  detanglingStylingContexts?: DetanglingStylingContext[]
  nightProtection?: NightProtection[]
}

export type Stage2StaticQuestionId =
  | "current_product_categories"
  | "wet_wash_frequency"
  | "scalp_irritation_detail"
  | "dry_shampoo_bridge_preference"
  | "dry_shampoo_visible_hair_color"
  | "oil_purposes"
  | "towel_handling"
  | "drying_routes"
  | "additional_heat_tools"
  | "detangling_styling_contexts"
  | "night_protection"
export type Stage2HeatEventQuestionId = `heat:${Stage2HeatEventSource}`
export type Stage2QuestionId = Stage2StaticQuestionId | Stage2HeatEventQuestionId
export type Stage2AnswerKey = keyof PersonalPlanRefinementAnswersV1

export type Stage2TriggerContext = {
  relevantCategories: Stage2ProductCategory[]
  hasReportedIrritatedScalp: boolean
  dryShampooBridgeEligibility: "unknown" | "eligible" | "ineligible"
}

export type Stage2PathState = {
  orderedQuestionIds: Stage2QuestionId[]
  requiredQuestionIds: Stage2QuestionId[]
  completedQuestionIds: Stage2QuestionId[]
  firstUnresolvedQuestionId: Stage2QuestionId | null
  prunedAnswerKeys: Stage2AnswerKey[]
}
