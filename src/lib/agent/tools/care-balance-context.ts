import type { RecommendationEngineRuntime } from "@/lib/recommendation-engine/runtime"
import type {
  CareBalanceConflict,
  CareBalanceRow,
  CurrentTurnCareFact,
  ShampooCadenceBand,
  ShampooCadenceAssessment,
} from "@/lib/recommendation-engine/types"
import type { ProductFrequency } from "@/lib/vocabulary"

export interface CareBalanceToolContext {
  mode: "production_decision_context"
  authority: CareBalanceToolAuthority
  rows: CareBalanceToolRow[]
  shampoo_cadence?: CareBalanceToolShampooCadence
  comparison: RecommendationEngineRuntime["legacyPlanComparison"] | null
  current_turn_facts: CareBalanceToolCurrentTurnFact[]
  conflicts: CareBalanceToolConflict[]
}

export interface CareBalanceToolAuthority {
  product_truth: false
  persistent_routine_storage: false
  current_turn_category_decision: true
  soft_product_ranking_hints: true
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
  authority: CareBalanceToolAuthority
}

export interface CareBalanceToolShampooCadence {
  current_frequency: ShampooCadenceAssessment["currentFrequency"]
  target_min: ProductFrequency | null
  target_max: ProductFrequency | null
  target_preferred: ProductFrequency | null
  delta: ShampooCadenceAssessment["delta"]
  position_in_range: ShampooCadenceAssessment["positionInRange"]
  base_band: ShampooCadenceAssessment["baseBand"]
  target_band: ShampooCadenceBand | null
  reason_codes: string[]
  caveat_codes: string[]
}

const CARE_BALANCE_TOOL_AUTHORITY: CareBalanceToolAuthority = {
  product_truth: false,
  persistent_routine_storage: false,
  current_turn_category_decision: true,
  soft_product_ranking_hints: true,
}

export interface CareBalanceToolCurrentTurnFact {
  kind: CurrentTurnCareFact["kind"]
  evidence_quote: string
  source: "current_turn"
}

export interface CareBalanceToolConflict {
  field_path: string
  saved_value: unknown
  current_turn_value: unknown
  evidence_quote: string
}

function buildCareBalanceUsageHint(row: CareBalanceRow): string {
  switch (row.cadencePolicy.kind) {
    case "need_based_support":
      return `need_based_support:${row.currentFrequency ?? "none"}:${row.cadencePolicy.suggestedBand ?? "less_than_monthly"}`
    case "match_heat_exposure":
      return `match_heat_exposure:${row.cadencePolicy.expected}:${row.cadencePolicy.heatExposureTier}`
    case "occasional_reset":
      return `occasional_reset:${row.cadencePolicy.resetNeed}`
    case "match_shampoo_frequency":
      return `match_shampoo_frequency:${row.cadencePolicy.expected}`
    case "bridge_between_washes":
      return `bridge_between_washes:${row.cadencePolicy.expected}`
    case "protocol_based":
      return `protocol_based:${row.cadencePolicy.priority}:${row.cadencePolicy.suggestedBand ?? "protocol"}`
    case "baseline_cleansing":
      return `baseline_cleansing:${row.cadencePolicy.shampooFrequency ?? "unknown"}`
    case "not_applicable":
      return "not_applicable"
  }
}

function buildCareBalanceCaveats(row: CareBalanceRow): string[] {
  if (row.recommendation === "no_action") return []

  return ["current_turn_category_decision", ...row.selectionHints.map((hint) => hint.code)].slice(
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
    authority: CARE_BALANCE_TOOL_AUTHORITY,
  }
}

function projectShampooCadenceForTool(
  assessment: ShampooCadenceAssessment | undefined,
): CareBalanceToolShampooCadence | undefined {
  if (!assessment) return undefined

  if (assessment.currentFrequency === null && assessment.target === null) {
    return undefined
  }

  return {
    current_frequency: assessment.currentFrequency,
    target_min: assessment.target?.minFrequency ?? null,
    target_max: assessment.target?.maxFrequency ?? null,
    target_preferred: assessment.target?.preferredFrequency ?? null,
    delta: assessment.delta,
    position_in_range: assessment.positionInRange,
    base_band: assessment.baseBand,
    target_band: assessment.target?.band ?? null,
    reason_codes: assessment.reasonCodes,
    caveat_codes: assessment.caveatCodes,
  }
}

export function buildCareBalanceToolContext(params: {
  runtime: RecommendationEngineRuntime
  rows: CareBalanceRow[]
}): CareBalanceToolContext {
  const shampooCadence = projectShampooCadenceForTool(params.runtime.shampooCadenceAssessment)

  return {
    mode: "production_decision_context",
    authority: CARE_BALANCE_TOOL_AUTHORITY,
    rows: params.rows.map(projectCareBalanceRowForTool),
    ...(shampooCadence ? { shampoo_cadence: shampooCadence } : {}),
    comparison: params.runtime.legacyPlanComparison ?? null,
    current_turn_facts:
      params.runtime.effectiveContext.currentTurnFacts.map(projectCurrentTurnFact),
    conflicts: params.runtime.effectiveContext.conflicts.map(projectConflict),
  }
}

function projectCurrentTurnFact(fact: CurrentTurnCareFact): CareBalanceToolCurrentTurnFact {
  return {
    kind: fact.kind,
    evidence_quote: fact.evidenceQuote,
    source: "current_turn",
  }
}

function projectConflict(conflict: CareBalanceConflict): CareBalanceToolConflict {
  return {
    field_path: conflict.fieldPath,
    saved_value: conflict.savedValue,
    current_turn_value: conflict.currentTurnValue,
    evidence_quote: conflict.evidenceQuote,
  }
}
