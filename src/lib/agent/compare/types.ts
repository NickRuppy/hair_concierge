import type {
  HairProfileOverrides,
  RoutineInventorySeed,
} from "../../../../scripts/eval-chat/types"
import type { SelectedProductsProjection } from "../tools/select-products"
import type { AgentRoutePacket } from "../orchestrator/route-packet"

export interface AgentCompareScenario {
  id: string
  label: string
  message: string
  hair_profile: HairProfileOverrides
  routine_inventory?: RoutineInventorySeed[]
}

export type CompareSystem = "current" | "agent"

export interface CompareRunResult {
  system: CompareSystem
  answer: string
  latency_ms: number | null
  debug_lines: string[]
  matched_products: Array<{
    name: string
    category: string | null
  }>
  product_trace?: SelectedProductsProjection | null
  route_trace?: AgentRoutePacket | null
  error: string | null
}

export interface AgentCompareRequest {
  scenarioId: string
  prompt: string
  baseUrl?: string | null
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
  prompt: string
  baseUrl?: string | null
}

export interface AgentCompareResponse {
  scenario?: AgentCompareScenario
  userId?: string
  prompt: string
  results: CompareRunResult[]
}

export interface AgentCompareJudgmentDraft {
  winner: "current" | "agent" | "tie"
  primary_reason: "natuerlicher" | "nuetzlicher" | "vorsichtiger" | "personalisierter" | "anderes"
  note: string
}

export interface AgentCompareJudgmentRecord {
  createdAt: string
  user: AgentCompareUserOption
  prompt: string
  context: AgentCompareUserSnapshot
  results: {
    current: CompareRunResult
    agent: CompareRunResult
  }
  judgment: AgentCompareJudgmentDraft
}
