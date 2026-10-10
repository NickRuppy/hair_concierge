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

/**
 * The Diffusor rule (Hair Tools): a Diffusor is plain blow-drying. It opens no heat-protection
 * question and sits at the ordinary-airflow route (tier `not_needed`), because no study measured a
 * diffuser as harsher than a nozzle and none tested a protectant under blow-drying
 * (`plans/2026-10-09-hair-tools-port-evidence-blowdry-heat.md`).
 *
 * Readers opt in: the member plan passes `diffuserAsBlowDry` with the tools rollout, the Beratung
 * intake always. Without the option the source keeps today's contract, so a rollout-off member is
 * unchanged. A stored `protectionConsistency` on this source is never an error under either
 * setting — it is simply not read once the rule is on.
 */
export type Stage2HeatRuleOptions = { diffuserAsBlowDry?: boolean }

/** The rule options a member's trigger context selects (the tools rollout). */
export function stage2HeatRuleOptions(triggerContext?: {
  toolsEnabled?: boolean
}): Stage2HeatRuleOptions {
  return { diffuserAsBlowDry: triggerContext?.toolsEnabled === true }
}

export function getStage2HeatEventDefinition(
  source: Stage2HeatEventSource,
  options?: Stage2HeatRuleOptions,
): Stage2HeatEventDefinition {
  if (source === "diffuser_airflow_shaping" && options?.diffuserAsBlowDry === true) {
    return { tool: "hair_dryer", route: "ordinary_airflow" }
  }
  return STAGE2_HEAT_EVENT_DEFINITIONS[source]
}

export function requiresStage2HeatProtection(
  source: Stage2HeatEventSource,
  options?: Stage2HeatRuleOptions,
): boolean {
  return getStage2HeatEventDefinition(source, options).route !== "ordinary_airflow"
}

/** Whether a stored `protectionConsistency` for this source is noise under the Diffusor rule. */
export function ignoresStoredStage2HeatProtection(
  source: Stage2HeatEventSource,
  options?: Stage2HeatRuleOptions,
): boolean {
  return source === "diffuser_airflow_shaping" && options?.diffuserAsBlowDry === true
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
  options?: Stage2HeatRuleOptions,
): ProjectedStage2HeatEvent[] {
  return getSelectedStage2HeatEventSources(answers).map((source) => {
    const id = createStage2HeatEventId(source)
    const answer = answers.heatEvents?.[id]
    if (!answer || !PRODUCT_FREQUENCIES.includes(answer.frequency)) {
      throw new Error(`Incomplete heat event: ${id}`)
    }
    const requiresProtection = requiresStage2HeatProtection(source, options)
    if (
      requiresProtection &&
      !HEAT_PROTECTION_CONSISTENCIES.includes(answer.protectionConsistency as never)
    ) {
      throw new Error(`Incomplete heat event: ${id}`)
    }
    const ignoresStored = ignoresStoredStage2HeatProtection(source, options)
    if (!requiresProtection && answer.protectionConsistency !== undefined && !ignoresStored) {
      throw new Error(`Ordinary airflow cannot have heat protection consistency: ${id}`)
    }
    // Under the Diffusor rule a value stored while the question was still asked is dropped here,
    // never read on.
    const { protectionConsistency, ...event } = answer
    return {
      id,
      source,
      ...getStage2HeatEventDefinition(source, options),
      ...event,
      ...(!ignoresStored && protectionConsistency !== undefined ? { protectionConsistency } : {}),
    }
  })
}
