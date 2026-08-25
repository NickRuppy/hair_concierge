import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type { ToolFamily, ToolReportedForm } from "@/lib/personal-plan/tools/contracts"
import type { ToolFormPageKey } from "@/lib/personal-plan/tools/labels"
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
  "normal",
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
  nightProtection?: NightProtection[]
  /**
   * Families the user indicated they own something in, captured by the overview.
   *
   * Family-keyed on purpose: the four Feinschliff sections are presentation
   * headers and must never be persisted. Absent means the overview was never
   * submitted (unknown); present means it was, and every family outside this
   * list has been materialized as an explicit `[]` in `toolForms`.
   */
  toolFamiliesWithSomething?: ToolFamily[]
  /**
   * Broad reported forms per persisted Tool family. An absent key is `unknown`
   * (skipped or migrated); `[]` is the user's explicit `Nichts davon`.
   *
   * Values are `ToolReportedForm`: a family may carry an answer-only token
   * („Nur Finger", `D9b`) beside its real forms. Route logic strips those.
   */
  toolForms?: Partial<Record<ToolFamily, ToolReportedForm[]>>
}

/**
 * The `D8` path version of the persisted refinement contract (standing rule,
 * ruled 2026-08-24).
 *
 * Any change to a persisted answer key, or to the meaning of a question's
 * completion predicate, bumps this and ships a decoder. Completed rows validate
 * against their completion-time contract, never against today's — the load-time
 * half of that is `createStage2RefinementSession`, which trusts the stored
 * `status` + handoff instead of re-deriving completeness.
 *
 * Enforcement: `tests/personal-plan-stage2-answer-schema-snapshot.test.ts`
 * pins the answer keys and the required-question semantics against this number.
 *
 * | Version | Change | Decoder |
 * | --- | --- | --- |
 * | 1 | the shipped Feinschliff contract | `toolSections` → `toolFamiliesWithSomething` (WS5/C7) |
 * | 2 | `drying_routes` no longer completes on `[]` (`D2`); `toolForms.brushes_combs` may carry `fingers` (`D9b`); `heatEvents["heat:diffuser_airflow_shaping"].protectionConsistency` is forbidden (`R1`) | legacy `[]` drying answers stay readable but stop completing the question; an absent `fingers` token is simply absent; the diffuser source's stored `protectionConsistency` is dropped on read |
 */
export const STAGE2_QUESTION_PATH_VERSION = 2

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
  | "night_protection"
export type Stage2HeatEventQuestionId = `heat:${Stage2HeatEventSource}`
export type Stage2ToolOverviewQuestionId = "tools_overview"
export type Stage2ToolFormQuestionId = `tools:${ToolFormPageKey}`
export type Stage2ToolQuestionId = Stage2ToolOverviewQuestionId | Stage2ToolFormQuestionId
export type Stage2QuestionId =
  | Stage2StaticQuestionId
  | Stage2HeatEventQuestionId
  | Stage2ToolQuestionId

export const STAGE2_TOOL_OVERVIEW_QUESTION_ID: Stage2ToolOverviewQuestionId = "tools_overview"

export function isStage2ToolQuestionId(id: Stage2QuestionId): id is Stage2ToolQuestionId {
  return id === STAGE2_TOOL_OVERVIEW_QUESTION_ID || id.startsWith("tools:")
}
export type Stage2AnswerKey = keyof PersonalPlanRefinementAnswersV1

export type Stage2TriggerContext = {
  relevantCategories: Stage2ProductCategory[]
  hasReportedIrritatedScalp: boolean
  dryShampooBridgeEligibility: "unknown" | "eligible" | "ineligible"
  /**
   * Server-owned Hair Tools rollout. Absent/false keeps the exact current
   * Feinschliff path; the browser never sets it.
   */
  toolsEnabled?: boolean
}

export type Stage2PathState = {
  orderedQuestionIds: Stage2QuestionId[]
  requiredQuestionIds: Stage2QuestionId[]
  completedQuestionIds: Stage2QuestionId[]
  firstUnresolvedQuestionId: Stage2QuestionId | null
  prunedAnswerKeys: Stage2AnswerKey[]
}
