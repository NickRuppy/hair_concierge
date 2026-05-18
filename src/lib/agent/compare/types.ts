import type {
  HairProfileOverrides,
  RoutineInventorySeed,
} from "../../../../scripts/eval-chat/types"
import type { SelectedProductsProjection } from "../tools/select-products"
import type { AgentRoutePacket } from "../orchestrator/route-packet"
import type { AgentV2RequestInterpretation, AgentV2Trace } from "@/lib/agent-v2/contracts"

export type AgentV2RequestInterpretationTrace = AgentV2RequestInterpretation

export type AgentV2CompareTrace = AgentV2Trace

export interface AgentCompareScenario {
  id: string
  label: string
  message: string
  hair_profile: HairProfileOverrides
  routine_inventory?: RoutineInventorySeed[]
}

export type CanonicalCompareSystem = "classic" | "tool_loop" | "agent_v2"
export type LegacyCompareSystem = "current" | "agent"
export type CompareSystem = CanonicalCompareSystem
export type CompareSystemInput = CompareSystem | LegacyCompareSystem

export type AgentCompareToolLoopVariant =
  | "baseline"
  | "inline_context"
  | "guidance_tool"
  | "composer_context"

export interface AgentCompareTurnResult {
  turn: number
  prompt: string
  answer: string
  latency_ms: number | null
  debug_lines?: string[]
  matched_products: CompareRunResult["matched_products"]
  product_trace?: SelectedProductsProjection | null
  route_trace?: AgentRoutePacket | null
  tool_loop_trace?: unknown
  agent_v2_trace?: AgentV2CompareTrace
  state_transition?: unknown
  error: string | null
}

export interface CompareRunResult {
  system: CompareSystemInput
  display_label?: string
  answer: string
  latency_ms: number | null
  debug_lines: string[]
  matched_products: Array<{
    name: string
    category: string | null
  }>
  product_trace?: SelectedProductsProjection | null
  route_trace?: AgentRoutePacket | null
  tool_loop_trace?: unknown
  agent_v2_trace?: AgentV2CompareTrace
  state_transition?: unknown
  turns?: AgentCompareTurnResult[]
  error: string | null
}

export interface AgentCompareRequest {
  scenarioId: string
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
  blinded?: boolean
  toolLoopVariant?: AgentCompareToolLoopVariant
  systems?: CompareSystemInput[]
}

export interface AgentCompareUserOption {
  id: string
  label: string
  full_name: string | null
}

export interface AgentCompareUserSnapshot {
  user_id: string
  derived_signals: string[]
  routine_inventory: Array<{
    category: string
    product_name: string | null
    frequency_range: string | null
  }>
  relevant_memory: Array<{
    id: string
    kind: string
    content: string
  }>
}

export interface AgentCompareUserRequest {
  userId: string
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
  blinded?: boolean
  toolLoopVariant?: AgentCompareToolLoopVariant
  systems?: CompareSystemInput[]
}

export interface AgentCompareResponse {
  scenario?: AgentCompareScenario
  userId?: string
  prompt: string
  turns?: string[]
  blinded?: boolean
  toolLoopVariant?: AgentCompareToolLoopVariant
  results: CompareRunResult[]
}

export interface AgentCompareJudgmentDraft {
  winner: "current" | "agent" | "tie"
  primary_reason: "natuerlicher" | "nuetzlicher" | "vorsichtiger" | "personalisierter" | "anderes"
  note: string
  failure_bucket?:
    | "semantic_state_conflict"
    | "tool_not_called"
    | "unsupported_claim"
    | "invented_product"
    | "latency"
    | "other"
    | "none"
  critical_product_claim_failure?: boolean
}

export interface AgentCompareRolloutMetrics {
  blinded_winner: CanonicalCompareSystem | "tie"
  failure_bucket: NonNullable<AgentCompareJudgmentDraft["failure_bucket"]>
  critical_product_claim_failure: boolean
  latency_ms: Partial<Record<CanonicalCompareSystem, number | null>>
  tool_loop_model_steps: number | null
  tool_loop_tool_calls: number | null
  agent_v2_model_steps?: number | null
  agent_v2_tool_calls?: number | null
}

export interface AgentCompareAnalysisSnapshot {
  setup: {
    mode: "single_turn" | "multi_turn"
    turn_count: number
    blinded: boolean
    tool_loop_variant: AgentCompareToolLoopVariant | null
    user_label: string
  }
  prompts: string[]
  results: Array<{
    label: string
    system: string
    latency_ms: number | null
    answer_chars: number
    debug_lines: string[]
    tool_calls: string[]
    guidance_ids: string[]
    product_policy: string | null
    product_category: string | null
    selected_products: string[]
    state_summary: string[]
    turns: Array<{
      turn: number
      answer_chars: number
      tool_calls: string[]
      guidance_ids: string[]
      product_policy: string | null
      selected_products: string[]
    }>
  }>
}

export interface AgentCompareJudgmentRecord {
  createdAt: string
  user: AgentCompareUserOption
  prompt: string
  toolLoopVariant?: AgentCompareToolLoopVariant
  context: AgentCompareUserSnapshot
  results: {
    current: CompareRunResult
    agent: CompareRunResult
  }
  judgment: AgentCompareJudgmentDraft
  rollout_metrics?: AgentCompareRolloutMetrics
  analysis_snapshot?: AgentCompareAnalysisSnapshot
}
