import type { RecommendationEngineRuntime } from "@/lib/recommendation-engine/runtime"
import type { CareBalanceRow } from "@/lib/recommendation-engine/types"

export interface CareBalanceToolContext {
  authoritative: false
  mode: "side_by_side"
  rows: CareBalanceToolRow[]
  comparison: RecommendationEngineRuntime["legacyPlanComparison"] | null
}

export interface CareBalanceToolRow {
  category: string
  action: CareBalanceRow["recommendation"]
  status: CareBalanceRow["primaryStatus"]
  strength: CareBalanceRow["recommendationStrength"]
  current_frequency: CareBalanceRow["currentFrequency"]
  cadence_policy: CareBalanceRow["cadencePolicy"]
  reason_codes: string[]
  context_reason_codes: string[]
  selection_hint_codes: string[]
  usage_hint: string
  caveats: string[]
  authoritative: false
}

function buildCareBalanceUsageHint(row: CareBalanceRow): string {
  switch (row.cadencePolicy.kind) {
    case "need_based_support":
      return `need_based_support:${row.currentFrequency ?? "none"}:${row.cadencePolicy.suggestedBand ?? "as_needed"}`
    case "match_heat_exposure":
      return `match_heat_exposure:${row.cadencePolicy.expected}:${row.cadencePolicy.heatExposureTier}`
    case "occasional_reset":
      return `occasional_reset:${row.cadencePolicy.resetNeed}`
    case "match_wash_frequency":
      return `match_wash_frequency:${row.cadencePolicy.expected}`
    case "bridge_between_washes":
      return `bridge_between_washes:${row.cadencePolicy.expected}`
    case "protocol_based":
      return `protocol_based:${row.cadencePolicy.priority}:${row.cadencePolicy.suggestedBand ?? "protocol"}`
    case "baseline_cleansing":
      return `baseline_cleansing:${row.cadencePolicy.washFrequency ?? "unknown"}`
    case "not_applicable":
      return "not_applicable"
  }
}

function buildCareBalanceCaveats(row: CareBalanceRow): string[] {
  if (row.recommendation === "no_action") return []

  return ["side_by_side_non_authoritative", ...row.selectionHints.map((hint) => hint.code)].slice(
    0,
    3,
  )
}

export function projectCareBalanceRowForTool(row: CareBalanceRow): CareBalanceToolRow {
  return {
    category: row.category,
    action: row.recommendation,
    status: row.primaryStatus,
    strength: row.recommendationStrength,
    current_frequency: row.currentFrequency,
    cadence_policy: row.cadencePolicy,
    reason_codes: row.decisiveReasonCodes,
    context_reason_codes: row.contextReasonCodes,
    selection_hint_codes: row.selectionHints.map((hint) => hint.code),
    usage_hint: buildCareBalanceUsageHint(row),
    caveats: buildCareBalanceCaveats(row),
    authoritative: false,
  }
}

export function buildCareBalanceToolContext(params: {
  runtime: RecommendationEngineRuntime
  rows: CareBalanceRow[]
}): CareBalanceToolContext {
  return {
    authoritative: false,
    mode: "side_by_side",
    rows: params.rows.map(projectCareBalanceRowForTool),
    comparison: params.runtime.legacyPlanComparison ?? null,
  }
}
