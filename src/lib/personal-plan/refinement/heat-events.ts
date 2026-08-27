import type {
  PersonalPlanRefinementAnswersV1,
  Stage2HeatEventQuestionId,
  Stage2HeatEventRoute,
  Stage2HeatEventSource,
  Stage2HeatEventTool,
} from "./types"
import { STAGE2_HEAT_EVENT_SOURCES } from "./types"
import { HEAT_PROTECTION_CONSISTENCIES } from "./types"
import { PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"

export type Stage2HeatEventDefinition = {
  tool: Stage2HeatEventTool
  route: Stage2HeatEventRoute
}

export const STAGE2_HEAT_EVENT_DEFINITIONS = {
  ordinary_blow_dry: { tool: "hair_dryer", route: "ordinary_airflow" },
  diffuser_airflow_shaping: { tool: "hair_dryer", route: "airflow_shaping" },
  dryer_brush: { tool: "dryer_brush", route: "airflow_shaping" },
  hot_air_styler: { tool: "hot_air_styler", route: "airflow_shaping" },
  straightener: { tool: "straightener", route: "direct_contact_heat" },
  curling_or_wave_iron: { tool: "curling_iron", route: "direct_contact_heat" },
  thermal_rollers: { tool: "other", route: "direct_contact_heat" },
} as const satisfies Record<Stage2HeatEventSource, Stage2HeatEventDefinition>

export function createStage2HeatEventId(source: Stage2HeatEventSource): Stage2HeatEventQuestionId {
  return `heat:${source}`
}

export function getSelectedStage2HeatEventSources(
  answers: PersonalPlanRefinementAnswersV1,
): Stage2HeatEventSource[] {
  const dryingRoutes = answers.dryingRoutes ?? []
  const additionalHeatTools = answers.additionalHeatTools ?? []

  return STAGE2_HEAT_EVENT_SOURCES.filter((source) => {
    if (source === "ordinary_blow_dry") return dryingRoutes.includes("ordinary_blow_dry")
    if (source === "diffuser_airflow_shaping") {
      return dryingRoutes.includes("diffuser_or_airflow_shaping")
    }
    return additionalHeatTools.includes(source)
  })
}

export function getStage2HeatEventDefinition(
  source: Stage2HeatEventSource,
): Stage2HeatEventDefinition {
  return STAGE2_HEAT_EVENT_DEFINITIONS[source]
}

/**
 * Sources whose heat-protection question was asked under an earlier contract and
 * is no longer asked (`R1`, ruled 2026-08-24; path version 2).
 *
 * `diffuser_or_airflow_shaping` is read as diffuser drying (`D2a`), and `A11`
 * puts diffuser drying at tier `not_needed` — so asking „wie konsequent nutzt du
 * Hitzeschutz?" for it contradicted the tier it feeds. Per `D8` the change is
 * decoded rather than migrated: a stored value is ignored on read, and a row
 * completed while the question was still asked stays complete.
 */
const STAGE2_LEGACY_HEAT_PROTECTION_SOURCES = new Set<Stage2HeatEventSource>([
  "diffuser_airflow_shaping",
])

export function requiresStage2HeatProtection(source: Stage2HeatEventSource): boolean {
  if (STAGE2_LEGACY_HEAT_PROTECTION_SOURCES.has(source)) return false
  return getStage2HeatEventDefinition(source).route !== "ordinary_airflow"
}

/** Whether a stored `protectionConsistency` for this source is legacy noise (`R1`). */
export function ignoresStoredStage2HeatProtection(source: Stage2HeatEventSource): boolean {
  return STAGE2_LEGACY_HEAT_PROTECTION_SOURCES.has(source)
}

export type ProjectedStage2HeatEvent = {
  id: Stage2HeatEventQuestionId
  source: Stage2HeatEventSource
  tool: Stage2HeatEventTool
  route: Stage2HeatEventRoute
  frequency: import("@/lib/vocabulary/frequencies").ProductFrequency
  protectionConsistency?: import("./types").HeatProtectionConsistency
}

export function projectStage2HeatEvents(
  answers: PersonalPlanRefinementAnswersV1,
): ProjectedStage2HeatEvent[] {
  return getSelectedStage2HeatEventSources(answers).map((source) => {
    const id = createStage2HeatEventId(source)
    const answer = answers.heatEvents?.[id]
    if (!answer || !PRODUCT_FREQUENCIES.includes(answer.frequency)) {
      throw new Error(`Incomplete heat event: ${id}`)
    }
    if (
      requiresStage2HeatProtection(source) &&
      !HEAT_PROTECTION_CONSISTENCIES.includes(answer.protectionConsistency as never)
    ) {
      throw new Error(`Incomplete heat event: ${id}`)
    }
    if (
      !requiresStage2HeatProtection(source) &&
      answer.protectionConsistency !== undefined &&
      !ignoresStoredStage2HeatProtection(source)
    ) {
      throw new Error(`Ordinary airflow cannot have heat protection consistency: ${id}`)
    }
    // `R1`: a value stored for a legacy source is dropped here, never read on.
    const { protectionConsistency, ...event } = answer
    return {
      id,
      source,
      ...getStage2HeatEventDefinition(source),
      ...event,
      ...(requiresStage2HeatProtection(source) ? { protectionConsistency } : {}),
    }
  })
}
