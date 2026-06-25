import {
  type AgentV2AnswerMode,
  type AgentV2RoutineThreadContext,
  type AgentV2RoutineThreadStep,
  type AgentV2SessionMemoryWrite,
  type AgentV2TerminalAnswer,
} from "@/lib/agent-v2/contracts"
import { readPendingFollowupAction } from "@/lib/agent-v2/pending-followup-action"
import type { AgentV2RoutineProjection } from "@/lib/agent-v2/tools/routine-projection"
import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import type {
  AgentV2ConversationStateV2,
  AgentV2StoredProductProjection,
} from "@/lib/agent-v2/production/persisted-session-state"

export function collectSurfacedProductIds(answer: AgentV2TerminalAnswer): string[] {
  const ids = new Set(answer.tool_grounding.product_ids)
  if (answer.answer_mode === "product_recommendation") {
    for (const recommendation of answer.payload.recommendations) {
      ids.add(recommendation.product_id)
    }
  }
  return [...ids]
}

export function collectTrustedSurfacedProductProjections(params: {
  projections: readonly AgentV2SelectProductsProjection[]
  answer: AgentV2TerminalAnswer
}): AgentV2StoredProductProjection[] {
  const surfacedProductIds = new Set(collectSurfacedProductIds(params.answer))
  if (surfacedProductIds.size === 0) return []

  return params.projections.flatMap((projection) => {
    const products = projection.products.filter((product) =>
      surfacedProductIds.has(product.product_id),
    )
    if (products.length === 0) return []

    return [
      {
        tool_name: "select_products",
        category: projection.category,
        valid_product_ids: (projection.valid_product_ids ?? []).filter((productId) =>
          surfacedProductIds.has(productId),
        ),
        products: products.map((product) => ({
          product_id: product.product_id,
          rank: product.rank,
          name: product.name,
          brand: product.brand,
          price_eur: product.price_eur,
          currency: product.currency,
          fit_reason: product.fit_reason,
          caveat: product.caveat,
          supported_claims: product.supported_claims,
          unsupported_requested_signals: product.unsupported_requested_signals,
        })),
      } satisfies AgentV2StoredProductProjection,
    ]
  })
}

export function mergePriorSelectedProductProjections(params: {
  previous: readonly AgentV2StoredProductProjection[]
  next: readonly AgentV2StoredProductProjection[]
}): AgentV2StoredProductProjection[] {
  const projectionsByKey = new Map<string, AgentV2StoredProductProjection>()

  for (const projection of [...params.previous, ...params.next]) {
    const productIds = (projection.products ?? [])
      .map((product) => product.product_id)
      .filter(Boolean)
      .join(",")
    if (!productIds) continue
    projectionsByKey.set(`${projection.category ?? "none"}:${productIds}`, projection)
  }

  return [...projectionsByKey.values()].slice(-3)
}

export function mergeAgentV2SessionMemory(params: {
  previous: readonly AgentV2SessionMemoryWrite[]
  accepted: readonly AgentV2SessionMemoryWrite[]
}): AgentV2SessionMemoryWrite[] {
  const memoryByKey = new Map<string, AgentV2SessionMemoryWrite>()

  for (const entry of [...params.previous, ...params.accepted]) {
    memoryByKey.set(`${entry.type}:${entry.text}:${entry.evidence_quote}`, entry)
  }

  return [...memoryByKey.values()].slice(-8)
}

export function buildRoutineThreadVisibleSteps(
  projection: AgentV2RoutineProjection | null,
): AgentV2RoutineThreadContext["visible_steps"] {
  return (projection?.visible_steps ?? []).map((step, index) => ({
    step_id: step.step_id,
    label_de: step.label,
    category: step.category,
    action: normalizeRoutineThreadAction(step.action),
    necessity: normalizeRoutineThreadNecessity(step.necessity),
    already_in_current_routine:
      step.action === "keep" ? true : step.action === "add" ? false : null,
    order: index + 1,
    routine_layer: projection?.routine_layer ?? null,
  }))
}

export function updateAgentV2ProductionRoutineThreadContext(params: {
  previous: AgentV2RoutineThreadContext | null
  answer: AgentV2TerminalAnswer
  message: string
  routineProjection: AgentV2RoutineProjection | null
  visibleFailure: boolean
}): AgentV2RoutineThreadContext {
  if (params.visibleFailure && params.previous) return params.previous

  const keepsRoutineTrack =
    params.answer.routine_context.active || params.answer.answer_mode === "routine"
  if (!keepsRoutineTrack) {
    return buildInactiveRoutineThreadContext(
      params.answer.answer_mode,
      readPendingFollowupAction(params.answer),
    )
  }

  const categories = collectRoutineThreadCategories(params.answer)
  const visibleSteps = updateRoutineThreadVisibleSteps({
    previous: params.previous?.visible_steps ?? [],
    answer: params.answer,
    routineProjection: params.routineProjection,
  })

  return {
    active: true,
    current_layer:
      params.answer.routine_context.routine_layer ?? params.previous?.current_layer ?? null,
    last_answer_mode: params.answer.answer_mode,
    last_routine_categories: [
      ...new Set([...(params.previous?.last_routine_categories ?? []), ...categories]),
    ],
    last_user_goal:
      params.answer.answer_mode === "routine" || !params.previous?.last_user_goal
        ? params.message
        : params.previous.last_user_goal,
    summary_de:
      String(params.answer.payload.user_facing_answer_de ?? "").slice(0, 500) ||
      params.previous?.summary_de ||
      null,
    pending_followup_action: readPendingFollowupAction(params.answer),
    visible_steps: visibleSteps,
  }
}

export function buildNextAgentV2SessionState(params: {
  previousState: AgentV2ConversationStateV2
  message: string
  answer: AgentV2TerminalAnswer
  routineProjection: AgentV2RoutineProjection | null
  selectedProductProjections: readonly AgentV2SelectProductsProjection[]
  acceptedSessionMemoryWrites: readonly AgentV2SessionMemoryWrite[]
  visibleFailure: boolean
}): AgentV2ConversationStateV2 {
  if (params.visibleFailure) return params.previousState

  const routineThreadContext = updateAgentV2ProductionRoutineThreadContext({
    previous: params.previousState.agent_v2.routine_thread_context,
    answer: params.answer,
    message: params.message,
    routineProjection: params.routineProjection,
    visibleFailure: params.visibleFailure,
  })
  const visibleSteps = buildRoutineThreadVisibleSteps(params.routineProjection)
  const persistedRoutineThreadContext = {
    ...routineThreadContext,
    visible_steps:
      routineThreadContext.visible_steps.length > 0
        ? routineThreadContext.visible_steps
        : visibleSteps,
  }

  return {
    ...params.previousState,
    agent_v2: {
      routine_thread_context: persistedRoutineThreadContext,
      prior_selected_product_projections: mergePriorSelectedProductProjections({
        previous: params.previousState.agent_v2.prior_selected_product_projections,
        next: collectTrustedSurfacedProductProjections({
          projections: params.selectedProductProjections,
          answer: params.answer,
        }),
      }),
      active_resolved_product_context:
        params.previousState.agent_v2.active_resolved_product_context,
      session_memory: mergeAgentV2SessionMemory({
        previous: params.previousState.agent_v2.session_memory,
        accepted: params.acceptedSessionMemoryWrites,
      }),
    },
  }
}

function normalizeRoutineThreadAction(
  action: string | null | undefined,
): AgentV2RoutineThreadContext["visible_steps"][number]["action"] {
  return action === "keep" || action === "add" || action === "adjust" || action === "remove"
    ? action
    : null
}

function normalizeRoutineThreadNecessity(
  necessity: string | null | undefined,
): AgentV2RoutineThreadContext["visible_steps"][number]["necessity"] {
  return necessity === "core" || necessity === "recommended" || necessity === "optional"
    ? necessity
    : null
}

function buildInactiveRoutineThreadContext(
  answerMode: AgentV2AnswerMode,
  pendingFollowupAction: AgentV2RoutineThreadContext["pending_followup_action"] = null,
): AgentV2RoutineThreadContext {
  return {
    active: false,
    current_layer: null,
    last_answer_mode: answerMode,
    last_routine_categories: [],
    last_user_goal: null,
    summary_de: null,
    pending_followup_action: pendingFollowupAction,
    visible_steps: [],
  }
}

function collectRoutineThreadCategories(answer: AgentV2TerminalAnswer): string[] {
  return [
    ...answer.extracted_constraints.product_categories,
    answer.routine_context.category,
  ].filter((category): category is string => Boolean(category))
}

function updateRoutineThreadVisibleSteps(params: {
  previous: readonly AgentV2RoutineThreadStep[]
  answer: AgentV2TerminalAnswer
  routineProjection: AgentV2RoutineProjection | null
}): AgentV2RoutineThreadStep[] {
  const answer = params.answer
  if (answer.answer_mode === "routine") {
    const projectedSteps = buildRoutineThreadVisibleSteps(params.routineProjection)
    if (projectedSteps.length > 0) return projectedSteps

    const fallbackCategory =
      answer.payload.visible_steps.length === 1 ? answer.routine_context.category : null
    return answer.payload.visible_steps.map((step, index) => ({
      step_id: step.step_id,
      label_de: step.label_de,
      category: fallbackCategory,
      order: index + 1,
      routine_layer: answer.payload.routine_layer,
    }))
  }

  if (
    params.answer.answer_mode === "product_recommendation" &&
    params.answer.routine_context.active &&
    params.answer.routine_context.step_id
  ) {
    const stepId = params.answer.routine_context.step_id
    const existingIndex = params.previous.findIndex((step) => step.step_id === stepId)
    if (existingIndex >= 0) {
      return params.previous.map((step, index) =>
        index === existingIndex
          ? {
              ...step,
              category: params.answer.routine_context.category ?? step.category,
            }
          : step,
      )
    }

    return [
      ...params.previous,
      {
        step_id: stepId,
        label_de: params.answer.routine_context.category ?? stepId,
        category: params.answer.routine_context.category,
        order: params.previous.length + 1,
        routine_layer: params.answer.routine_context.routine_layer,
      },
    ]
  }

  return [...params.previous]
}
