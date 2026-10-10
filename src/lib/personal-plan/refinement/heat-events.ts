import type {
  PersonalPlanRefinementAnswersV1,
  Stage2HeatEventQuestionId,
  Stage2HeatEventRoute,
  Stage2HeatEventSource,
  Stage2HeatEventTool,
} from "./types"
import { DIFFUSER_AS_BLOW_DRY_RULE_ID } from "../heat-diffuser-rule"
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
 * question and counts as `not_needed` for the Hitzeschutz tier, because no study measured a
 * diffuser as harsher than a nozzle and none tested a protectant under blow-drying
 * (`plans/2026-10-09-hair-tools-port-evidence-blowdry-heat.md`).
 *
 * Only the question and the Hitzeschutz tier change: the event keeps its `airflow_shaping` route
 * (leave-in, mask, oil, needs and the Anwendung read it as before), and the plan event carries the
 * `DIFFUSER_AS_BLOW_DRY_RULE_ID` marker the tier reads.
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
): Stage2HeatEventDefinition {
  return STAGE2_HEAT_EVENT_DEFINITIONS[source]
}

export function requiresStage2HeatProtection(
  source: Stage2HeatEventSource,
  options?: Stage2HeatRuleOptions,
): boolean {
  if (ignoresStoredStage2HeatProtection(source, options)) return false
  return getStage2HeatEventDefinition(source).route !== "ordinary_airflow"
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
  /**
   * Rule ids the plan event carries: the Diffusor marker when this event is read as plain
   * blow-drying, so the Hitzeschutz tier follows it while every other reader keeps the route.
   */
  ruleIds: string[]
}

/**
 * A Diffusor event stored WITHOUT a protection answer was answered under the Diffusor rule — the
 * question no longer exists for it — so it reads as plain blow-drying wherever it is read, the
 * rollout-off scanner context included. Without the answer it can never be a rollout-off member's
 * (that question was always asked).
 */
export function isDiffuserAnsweredWithoutProtection(
  source: Stage2HeatEventSource,
  answer: { protectionConsistency?: unknown } | undefined,
): boolean {
  return source === "diffuser_airflow_shaping" && answer?.protectionConsistency === undefined
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
    const asBlowDry =
      ignoresStoredStage2HeatProtection(source, options) ||
      isDiffuserAnsweredWithoutProtection(source, answer)
    const requiresProtection = !asBlowDry && requiresStage2HeatProtection(source, options)
    if (
      requiresProtection &&
      !HEAT_PROTECTION_CONSISTENCIES.includes(answer.protectionConsistency as never)
    ) {
      throw new Error(`Incomplete heat event: ${id}`)
    }
    if (!requiresProtection && answer.protectionConsistency !== undefined && !asBlowDry) {
      throw new Error(`Ordinary airflow cannot have heat protection consistency: ${id}`)
    }
    // Under the Diffusor rule a value stored while the question was still asked is dropped here,
    // never read on.
    const { protectionConsistency, ...event } = answer
    return {
      id,
      source,
      ...getStage2HeatEventDefinition(source),
      ...event,
      ...(!asBlowDry && protectionConsistency !== undefined ? { protectionConsistency } : {}),
      ruleIds: asBlowDry ? [DIFFUSER_AS_BLOW_DRY_RULE_ID] : [],
    }
  })
}
