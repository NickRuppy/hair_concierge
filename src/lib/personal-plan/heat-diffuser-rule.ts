import type { PlanHeatToolUseEvent } from "./types"

/**
 * The Diffusor rule's marker on a plan heat event (Hair Tools). A Diffusor stays an
 * `airflow_shaping` event — leave-in, mask, oil, needs and the Anwendung all keep reading it as
 * today — but for the Hitzeschutz tier it is plain blow-drying: it contributes `not_needed` and
 * never qualifies the airflow upgrade (`categories/heat-protectant.ts`, Stage-3 carrier coverage).
 *
 * The marker travels in the event's `sourceRuleIds`, set by the adapters that project the
 * member's (rollout on) or the Beratung participant's answers, so the category needs no flag.
 */
export const DIFFUSER_AS_BLOW_DRY_RULE_ID = "heat_protectant.diffuser_as_blow_dry"

const DIFFUSER_EVENT_ID = "heat:diffuser_airflow_shaping"

export function isDiffuserBlowDryEvent(
  event: Pick<PlanHeatToolUseEvent, "id" | "sourceRuleIds">,
): boolean {
  return (
    event.id === DIFFUSER_EVENT_ID && event.sourceRuleIds.includes(DIFFUSER_AS_BLOW_DRY_RULE_ID)
  )
}
