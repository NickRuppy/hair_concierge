import {
  AgentV2RoutineThreadContextSchema,
  AgentV2SessionMemoryWriteSchema,
  type AgentV2RoutineThreadContext,
  type AgentV2SessionMemoryWrite,
} from "@/lib/agent-v2/contracts"
import { readPendingFollowupAction } from "@/lib/agent-v2/pending-followup-action"
import type {
  AgentV2ActiveProductContext,
  AgentV2ActiveResolvedProductContext,
  AgentV2StoredProductProjection,
} from "@/lib/agent-v2/resolved-product-selection-adapter"
import { buildPrimaryResolvedProductContext } from "@/lib/agent-v2/resolved-product-selection-adapter"
import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import type {
  SupportedProductClaim,
  UnsupportedRequestedSignal,
} from "@/lib/agent/tools/select-products"

export const AGENT_V2_PRODUCTION_ENGINE = "agent_v2_care_balance" as const

export interface AgentV2ConversationStateV2 {
  version: 2
  engine: typeof AGENT_V2_PRODUCTION_ENGINE
  agent_v2: {
    routine_thread_context: AgentV2RoutineThreadContext | null
    prior_selected_product_projections: AgentV2StoredProductProjection[]
    active_product_contexts: AgentV2ActiveProductContext[]
    active_resolved_product_context: AgentV2ActiveResolvedProductContext | null
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
  agent_v2_active_product_contexts?: unknown
  agent_v2_active_resolved_product_context?: unknown
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
      active_product_contexts: [],
      active_resolved_product_context: null,
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
      activeProductContexts: agentV2.active_product_contexts,
      activeResolvedProductContext: agentV2.active_resolved_product_context,
      sessionMemory: agentV2.session_memory,
    })
  }

  return buildAgentV2State({
    routineThreadContext: value.agent_v2_routine_thread_context,
    priorSelectedProductProjections: value.agent_v2_prior_selected_product_projections,
    activeProductContexts: value.agent_v2_active_product_contexts,
    activeResolvedProductContext: value.agent_v2_active_resolved_product_context,
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
  active_product_context_count: number
  active_resolved_product: {
    product_id: string | null
    category: string | null
  }
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
    active_product_context_count: state.agent_v2.active_product_contexts.length,
    active_resolved_product: {
      product_id:
        buildPrimaryResolvedProductContext(state.agent_v2.active_product_contexts)?.product_id ??
        null,
      category:
        buildPrimaryResolvedProductContext(state.agent_v2.active_product_contexts)?.category ??
        null,
    },
    session_memory_count: state.agent_v2.session_memory.length,
  }
}

function buildAgentV2State(params: {
  routineThreadContext: unknown
  priorSelectedProductProjections: unknown
  activeProductContexts: unknown
  activeResolvedProductContext: unknown
  sessionMemory: unknown
}): AgentV2ConversationStateV2 {
  const activeProductContexts = normalizeActiveProductContexts(
    params.activeProductContexts,
    params.activeResolvedProductContext,
  )
  return {
    ...createDefaultAgentV2ConversationState(),
    agent_v2: {
      routine_thread_context: normalizeRoutineThreadContext(params.routineThreadContext),
      prior_selected_product_projections: normalizePriorProductProjections(
        params.priorSelectedProductProjections,
      ),
      active_product_contexts: activeProductContexts,
      active_resolved_product_context: buildPrimaryResolvedProductContext(activeProductContexts),
      session_memory: normalizeSessionMemory(params.sessionMemory),
    },
  }
}

function normalizeActiveProductContexts(
  value: unknown,
  legacyActiveResolvedProductContext: unknown,
): AgentV2ActiveProductContext[] {
  const normalized = Array.isArray(value)
    ? value.flatMap((entry) => {
        const context = normalizeActiveProductContext(entry)
        return context ? [context] : []
      })
    : []

  if (normalized.length > 0) return normalized.slice(-3)

  const legacyResolved = normalizeActiveResolvedProductContext(legacyActiveResolvedProductContext)
  if (!legacyResolved) return []
  const legacyContext: AgentV2ActiveProductContext = {
    status: "resolved",
    product_id: legacyResolved.product_id,
    submission_id: null,
    category: legacyResolved.category,
    brand_text: null,
    product_name_text: legacyResolved.name,
    display_name: legacyResolved.name,
    original_user_message: legacyResolved.original_user_message,
    source: "product_lookup_selection",
    updated_at: new Date(0).toISOString(),
  }
  return [legacyContext]
}

function normalizeActiveProductContext(value: unknown): AgentV2ActiveProductContext | null {
  if (!isRecord(value)) return null
  const status =
    value.status === "resolved" || value.status === "pending_review" ? value.status : null
  const displayName = typeof value.display_name === "string" ? value.display_name.trim() : ""
  const originalUserMessage =
    typeof value.original_user_message === "string" ? value.original_user_message : null
  const source =
    value.source === "lookup_exact" ||
    value.source === "product_lookup_selection" ||
    value.source === "product_intake_submission" ||
    value.source === "routine_inventory"
      ? value.source
      : null
  if (!status || !displayName || !originalUserMessage || !source) return null

  const productId = typeof value.product_id === "string" ? value.product_id : null
  const submissionId = typeof value.submission_id === "string" ? value.submission_id : null
  if (status === "resolved" && !productId) return null

  return {
    status,
    product_id: productId,
    submission_id: submissionId,
    category: typeof value.category === "string" ? value.category : null,
    brand_text: typeof value.brand_text === "string" ? value.brand_text : null,
    product_name_text: typeof value.product_name_text === "string" ? value.product_name_text : null,
    display_name: displayName,
    original_user_message: originalUserMessage,
    source,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : new Date(0).toISOString(),
  }
}

function normalizeActiveResolvedProductContext(
  value: unknown,
): AgentV2ActiveResolvedProductContext | null {
  if (!isRecord(value)) return null
  const source =
    value.source === "lookup_exact" ||
    value.source === "product_lookup_selection" ||
    value.source === "product_intake_submission" ||
    value.source === "routine_inventory"
      ? value.source
      : null
  if (!source) return null
  const productId = typeof value.product_id === "string" ? value.product_id : null
  const name = typeof value.name === "string" ? value.name : null
  const originalUserMessage =
    typeof value.original_user_message === "string" ? value.original_user_message : null
  if (!productId || !name || !originalUserMessage) return null

  return {
    source,
    product_id: productId,
    name,
    category: typeof value.category === "string" ? value.category : null,
    original_user_message: originalUserMessage,
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
