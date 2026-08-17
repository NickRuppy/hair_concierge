import { PRODUCT_FREQUENCY_LABELS, type ProductFrequency } from "@/lib/vocabulary/frequencies"

import { getOrderedQuestionIds } from "../refinement/question-path"
import type {
  DryShampooBridgePreference,
  PersonalPlanRefinementAnswersV1,
  ScalpIrritationDetail,
  Stage2QuestionId,
  Stage2TriggerContext,
  TowelMaterial,
  TowelTechnique,
  WetWashFrequency,
} from "../refinement/types"

/**
 * The single source of truth for accepting a Stage-1 Idealplan without running
 * Stage 2 interactively. Every default is deliberately conservative: it must
 * never invent a need the Idealplan did not already show, and every assumption
 * it makes has to be renderable to the user before they accept.
 */

/** Most common wash rhythm; conservative between daily and weekly cleansing. */
export const DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY: ProductFrequency & WetWashFrequency = "weekly_2x"

/** Gentle handling, so no mechanical-exposure signal is assumed. */
export const DIRECT_ACCEPTANCE_TOWEL_MATERIAL: TowelMaterial = "mikrofaser"
export const DIRECT_ACCEPTANCE_TOWEL_TECHNIQUE: TowelTechnique = "gentle_press"

/**
 * Only asked when Stage 1 already recorded an irritated scalp, where Stage 1
 * defers Scalp Care instead of rendering it. "normal" is the only value that
 * does not turn that deferral into an extra role, so the accepted routine stays
 * the plan the user actually saw.
 *
 * The alternative, "mild_sensitive_or_itchy", was surfaced to Nick: it would be
 * more faithful to the reported symptom but adds a `scalp_comfort` role the
 * Idealplan never showed. Plan identity won — the journey promises "accept the
 * plan you see", and the assumption label discloses the assumption so the user
 * can correct it in a real Stage 2.
 */
export const DIRECT_ACCEPTANCE_SCALP_IRRITATION_DETAIL: ScalpIrritationDetail = "normal"

/** Declining the bridge keeps Dry Shampoo out of an Idealplan that never showed it. */
export const DIRECT_ACCEPTANCE_DRY_SHAMPOO_BRIDGE_PREFERENCE: DryShampooBridgePreference = "decline"

export type DirectAcceptanceStage2Defaults = {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
}

export function buildDirectAcceptanceStage2Defaults(
  triggerContext: Stage2TriggerContext,
): DirectAcceptanceStage2Defaults {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: [],
    wetWashFrequency: DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY,
    ...(triggerContext.hasReportedIrritatedScalp
      ? { scalpIrritationDetail: DIRECT_ACCEPTANCE_SCALP_IRRITATION_DETAIL }
      : {}),
    ...(triggerContext.dryShampooBridgeEligibility === "eligible"
      ? { dryShampooBridgePreference: DIRECT_ACCEPTANCE_DRY_SHAMPOO_BRIDGE_PREFERENCE }
      : {}),
    towel: {
      material: DIRECT_ACCEPTANCE_TOWEL_MATERIAL,
      technique: DIRECT_ACCEPTANCE_TOWEL_TECHNIQUE,
    },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    heatEvents: {},
    nightProtection: [],
  }

  // Deriving the completed set from the canonical path keeps the defaults
  // complete by construction when the Stage-2 question path changes.
  return { answers, completedQuestionIds: getOrderedQuestionIds(triggerContext, answers) }
}

export type DirectAcceptanceAssumption = {
  /** The Stage-2 question this assumption stands in for. */
  id: Stage2QuestionId
  label: string
}

/** German assumption lines rendered by the fork screen before the user accepts. */
export function directAcceptanceAssumptions(
  triggerContext: Stage2TriggerContext,
): DirectAcceptanceAssumption[] {
  const washLabel = PRODUCT_FREQUENCY_LABELS[DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY]

  return [
    {
      id: "current_product_categories",
      label: "Du startest ohne bestehende Pflegeprodukte",
    },
    { id: "wet_wash_frequency", label: `Haarwäsche ${washLabel}` },
    ...(triggerContext.hasReportedIrritatedScalp
      ? [
          {
            id: "scalp_irritation_detail" as const,
            label: "Kopfhaut aktuell nicht gereizt",
          },
        ]
      : []),
    ...(triggerContext.dryShampooBridgeEligibility === "eligible"
      ? [
          {
            id: "dry_shampoo_bridge_preference" as const,
            label: "Kein Trockenshampoo zwischen den Wäschen",
          },
        ]
      : []),
    { id: "towel_handling", label: "Haare sanft mit einem Mikrofaser-Handtuch ausdrücken" },
    { id: "drying_routes", label: "Lufttrocknen, kein Föhnen" },
    { id: "additional_heat_tools", label: "Keine Hitze-Styling-Geräte" },
    { id: "night_protection", label: "Kein besonderer Haarschutz über Nacht" },
  ]
}
