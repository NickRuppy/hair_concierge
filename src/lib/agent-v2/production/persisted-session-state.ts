import {
  AgentV2RoutineThreadContextSchema,
  AgentV2SessionMemoryWriteSchema,
  type AgentV2RoutineThreadContext,
  type AgentV2SessionMemoryWrite,
} from "@/lib/agent-v2/contracts"
import { readPendingFollowupAction } from "@/lib/agent-v2/pending-followup-action"
import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import type {
  SupportedProductClaim,
  UnsupportedRequestedSignal,
} from "@/lib/agent/tools/select-products"

export const AGENT_V2_PRODUCTION_ENGINE = "agent_v2_care_balance" as const

export type AgentV2StoredProductProjection = Pick<
  Partial<AgentV2SelectProductsProjection>,
  "tool_name" | "category" | "valid_product_ids" | "products"
>

export interface AgentV2ConversationStateV2 {
  version: 2
  engine: typeof AGENT_V2_PRODUCTION_ENGINE
  agent_v2: {
    routine_thread_context: AgentV2RoutineThreadContext | null
    prior_selected_product_projections: AgentV2StoredProductProjection[]
    session_memory: AgentV2SessionMemoryWrite[]
  }
}

export interface LegacyConversationStateV1 {
  version: 1
  active_topic?: unknown
  routine_layer?: unknown
  pending_offer?: unknown
  answered_slots?: unknown
  last_assistant_action?: unknown
  last_product_category?: unknown
  agent_v2_routine_thread_context?: unknown
  agent_v2_prior_selected_product_projections?: unknown
  agent_v2_session_memory?: unknown
}

export type PersistedConversationState = LegacyConversationStateV1 | AgentV2ConversationStateV2

export interface AgentV2ConversationStateTransition {
  previous_state: AgentV2ConversationStateV2
  next_state: AgentV2ConversationStateV2
  reason: string
  changed_fields: string[]
  classifier_override: null
  updated_by_engine: typeof AGENT_V2_PRODUCTION_ENGINE
}

const AGENT_V2_SELECTABLE_CATEGORIES = new Set([
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
])

export function createDefaultAgentV2ConversationState(): AgentV2ConversationStateV2 {
  return {
    version: 2,
    engine: AGENT_V2_PRODUCTION_ENGINE,
    agent_v2: {
      routine_thread_context: null,
      prior_selected_product_projections: [],
      session_memory: [],
    },
  }
}

export function normalizeAgentV2ConversationState(value: unknown): AgentV2ConversationStateV2 {
  if (!isRecord(value)) return createDefaultAgentV2ConversationState()

  if (value.version === 2 && value.engine === AGENT_V2_PRODUCTION_ENGINE) {
    const agentV2 = isRecord(value.agent_v2) ? value.agent_v2 : {}
    return buildAgentV2State({
      routineThreadContext: agentV2.routine_thread_context,
      priorSelectedProductProjections: agentV2.prior_selected_product_projections,
      sessionMemory: agentV2.session_memory,
    })
  }

  return buildAgentV2State({
    routineThreadContext: value.agent_v2_routine_thread_context,
    priorSelectedProductProjections: value.agent_v2_prior_selected_product_projections,
    sessionMemory: value.agent_v2_session_memory,
  })
}

export function summarizeAgentV2ConversationState(state: AgentV2ConversationStateV2): {
  version: 2
  engine: typeof AGENT_V2_PRODUCTION_ENGINE
  routine_thread: {
    active: boolean
    current_layer: string | null
    visible_step_count: number
  }
  prior_product_projection_count: number
  session_memory_count: number
} {
  const routineThread = state.agent_v2.routine_thread_context
  return {
    version: 2,
    engine: AGENT_V2_PRODUCTION_ENGINE,
    routine_thread: {
      active: routineThread?.active === true,
      current_layer: routineThread?.current_layer ?? null,
      visible_step_count: routineThread?.visible_steps.length ?? 0,
    },
    prior_product_projection_count: state.agent_v2.prior_selected_product_projections.length,
    session_memory_count: state.agent_v2.session_memory.length,
  }
}

function buildAgentV2State(params: {
  routineThreadContext: unknown
  priorSelectedProductProjections: unknown
  sessionMemory: unknown
}): AgentV2ConversationStateV2 {
  return {
    ...createDefaultAgentV2ConversationState(),
    agent_v2: {
      routine_thread_context: normalizeRoutineThreadContext(params.routineThreadContext),
      prior_selected_product_projections: normalizePriorProductProjections(
        params.priorSelectedProductProjections,
      ),
      session_memory: normalizeSessionMemory(params.sessionMemory),
    },
  }
}

function normalizeRoutineThreadContext(value: unknown): AgentV2RoutineThreadContext | null {
  const candidate = isRecord(value) ? { ...value } : value
  if (isRecord(candidate)) {
    candidate.pending_followup_action = readPendingFollowupAction(candidate)
    delete candidate.pending_routine_action
  }

  const parsed = AgentV2RoutineThreadContextSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function normalizePriorProductProjections(value: unknown): AgentV2StoredProductProjection[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((projection): AgentV2StoredProductProjection[] => {
      if (!isRecord(projection)) return []
      const products = normalizeProjectedProducts(projection.products)
      if (products.length === 0) return []

      return [
        {
          tool_name: "select_products",
          category: normalizeProjectionCategory(projection.category),
          valid_product_ids: normalizeStringArray(projection.valid_product_ids).filter((id) =>
            products.some((product) => product.product_id === id),
          ),
          products,
        },
      ]
    })
    .slice(-3)
}

function normalizeProjectedProducts(
  value: unknown,
): NonNullable<AgentV2StoredProductProjection["products"]> {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((product, index) => {
      if (!isRecord(product)) return []
      const productId = typeof product.product_id === "string" ? product.product_id : null
      const name = typeof product.name === "string" ? product.name : null
      if (!productId || !name) return []

      return [
        {
          product_id: productId,
          rank: typeof product.rank === "number" ? product.rank : index + 1,
          name,
          brand: typeof product.brand === "string" ? product.brand : null,
          price_eur: typeof product.price_eur === "number" ? product.price_eur : null,
          currency: typeof product.currency === "string" ? product.currency : null,
          fit_reason: typeof product.fit_reason === "string" ? product.fit_reason : "",
          caveat: typeof product.caveat === "string" ? product.caveat : null,
          supported_claims: normalizeSupportedProductClaims(product.supported_claims),
          unsupported_requested_signals: normalizeUnsupportedRequestedSignals(
            product.unsupported_requested_signals,
          ),
        },
      ]
    })
    .slice(0, 3)
}

function normalizeProjectionCategory(value: unknown): AgentV2StoredProductProjection["category"] {
  return typeof value === "string" && AGENT_V2_SELECTABLE_CATEGORIES.has(value)
    ? (value as NonNullable<AgentV2SelectProductsProjection["category"]>)
    : null
}

function normalizeSessionMemory(value: unknown): AgentV2SessionMemoryWrite[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => {
      const parsed = AgentV2SessionMemoryWriteSchema.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    })
    .slice(-8)
}

function normalizeSupportedProductClaims(value: unknown): SupportedProductClaim[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((claim) => {
    if (!isRecord(claim)) return []
    if (
      typeof claim.field !== "string" ||
      typeof claim.value !== "string" ||
      typeof claim.label !== "string" ||
      !isRecord(claim.evidence)
    ) {
      return []
    }

    return [claim as unknown as SupportedProductClaim]
  })
}

function normalizeUnsupportedRequestedSignals(value: unknown): UnsupportedRequestedSignal[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((signal) => {
    if (!isRecord(signal)) return []
    if (
      typeof signal.field !== "string" ||
      typeof signal.value !== "string" ||
      typeof signal.reason !== "string" ||
      typeof signal.user_message !== "string"
    ) {
      return []
    }

    return [signal as unknown as UnsupportedRequestedSignal]
  })
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
