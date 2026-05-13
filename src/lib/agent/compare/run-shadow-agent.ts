import type { GuidanceId } from "@/lib/agent/contracts"
import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import { createOpenAIToolModelClient } from "@/lib/agent/orchestrator/model-client"
import {
  deriveRequestedGoal,
  runShadowAgentTurn,
} from "@/lib/agent/orchestrator/run-shadow-agent-turn"
import { createBuildOrFixRoutineTool } from "@/lib/agent/tools/build-or-fix-routine"
import type { RoutineObjective } from "@/lib/agent/tools/build-or-fix-routine"
import type {
  SelectableProductCategory,
  SelectedProductsProjection,
} from "@/lib/agent/tools/select-products"
import { createSelectProductsTool } from "@/lib/agent/tools/select-products"
import { getUserContext } from "@/lib/agent/tools/get-user-context"
import { loadUserMemoryContext } from "@/lib/rag/user-memory"
import type {
  AgentActiveProfileSignal,
  AgentConcern,
  AgentRoutePacket,
  AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import {
  isActiveProfileSignalField,
  isActiveSignalSelectionEffect,
} from "@/lib/agent/orchestrator/route-packet"
import { createDefaultConversationState } from "@/lib/rag/conversation-state"
import type { ConversationState, RoutineLayer, RoutineProductCategory } from "@/lib/types"
import { createTestSession, upsertHairProfile } from "../../../../scripts/eval-chat/client"
import type {
  AgentCompareScenario,
  AgentCompareTurnResult,
  AgentCompareUserRequest,
  CompareRunResult,
} from "./types"

function getRequiredCompareEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }

  return { supabaseUrl, serviceRoleKey, anonKey }
}

function normalizeMatchedProducts(
  projection: SelectedProductsProjection | null,
): CompareRunResult["matched_products"] {
  if (!projection) return []

  return projection.products.map((product) => ({
    name: product.name,
    category: projection.category,
  }))
}

function normalizeTurns(params: { prompt?: string; turns?: string[] }): string[] {
  const turns = params.turns?.map((turn) => turn.trim()).filter((turn) => turn.length > 0) ?? []
  if (turns.length > 0) return turns

  const prompt = params.prompt?.trim() ?? ""
  return prompt.length > 0 ? [prompt] : []
}

function buildShadowDebugLines(params: {
  toolCallNames: string[]
  guidanceIds: string[]
  selectedProducts: SelectedProductsProjection | null
  routeTrace?: AgentRoutePacket | null
}): string[] {
  const lines = [`tools: ${params.toolCallNames.join(" -> ")}`]

  if (params.routeTrace) {
    lines.push(`route: ${params.routeTrace.user_job}`)
    lines.push(`playbook: ${params.routeTrace.required_playbook_id ?? "none"}`)
    if (params.routeTrace.product_category) {
      lines.push(`category: ${params.routeTrace.product_category}`)
    }
    if (params.routeTrace.concerns.length > 0) {
      lines.push(`concerns: ${params.routeTrace.concerns.join(", ")}`)
    }
    if (params.routeTrace.active_profile_signals.length > 0) {
      lines.push(
        `active_signals: ${params.routeTrace.active_profile_signals
          .map((signal) => `${signal.field}=${signal.value}(${signal.selection_effect})`)
          .join(", ")}`,
      )
    }
  }

  if (params.guidanceIds.length > 0) {
    lines.push(`guidance: ${params.guidanceIds.join(", ")}`)
  }

  if (params.selectedProducts) {
    lines.push(`decision: ${params.selectedProducts.decision}`)
    lines.push(`product_policy: ${params.selectedProducts.product_response_policy}`)
    lines.push(`policy_reason: ${params.selectedProducts.policy_reason}`)
    if (params.selectedProducts.unsupported_requested_signals.length > 0) {
      lines.push(
        `unsupported_signals: ${params.selectedProducts.unsupported_requested_signals
          .map((signal) => `${signal.field}=${signal.value}`)
          .join(", ")}`,
      )
    }
    lines.push(`products: ${params.selectedProducts.products.length}`)
  }

  return lines
}

function normalizeSelectableCategory(value: unknown): SelectableProductCategory {
  if (typeof value !== "string") {
    throw new Error("Agent requested select_products without a valid category")
  }

  return value as SelectableProductCategory
}

function normalizeRoutineObjective(value: unknown): RoutineObjective | null {
  return value === "build_routine" || value === "fix_routine" ? value : null
}

function normalizeRoutineLayer(value: unknown): RoutineLayer | null {
  return value === "basics" || value === "goals" || value === "problems" || value === "deep_dive"
    ? value
    : null
}

function normalizeRoutineProductCategory(value: unknown): RoutineProductCategory | null {
  return value === "shampoo" ||
    value === "conditioner" ||
    value === "mask" ||
    value === "oil" ||
    value === "leave_in" ||
    value === "bondbuilder" ||
    value === "deep_cleansing_shampoo" ||
    value === "dry_shampoo" ||
    value === "peeling"
    ? value
    : null
}

function normalizeAgentUserJob(value: unknown): AgentUserJob | null {
  return typeof value === "string" ? (value as AgentUserJob) : null
}

function normalizeAgentConcerns(value: unknown): AgentConcern[] {
  return Array.isArray(value)
    ? (value.filter((item): item is AgentConcern => typeof item === "string") as AgentConcern[])
    : []
}

function normalizeRequestedGoal(value: unknown, message: string): "shine" | null {
  return value === "shine" ? "shine" : deriveRequestedGoal(message)
}

function normalizeActiveProfileSignals(value: unknown): AgentActiveProfileSignal[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item): AgentActiveProfileSignal[] => {
    if (!item || typeof item !== "object") return []

    const signal = item as Record<string, unknown>
    if (typeof signal.field !== "string") return []
    if (typeof signal.selection_effect !== "string") return []
    if (!isActiveProfileSignalField(signal.field)) return []
    if (!isActiveSignalSelectionEffect(signal.selection_effect)) return []
    if (signal.source !== "message") return []
    if (typeof signal.value !== "string" || signal.value.trim().length === 0) return []

    return [
      {
        field: signal.field,
        value: signal.value.trim(),
        source: "message",
        selection_effect: signal.selection_effect,
        evidence: typeof signal.evidence === "string" ? signal.evidence : "",
      },
    ]
  })
}

export async function runShadowAgentComparison(params: {
  scenario: AgentCompareScenario
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
}): Promise<CompareRunResult> {
  const { supabaseUrl, serviceRoleKey, anonKey } = getRequiredCompareEnv()
  const session = await createTestSession(supabaseUrl, serviceRoleKey, anonKey)

  try {
    await upsertHairProfile(
      session.admin,
      session.userId,
      params.scenario.hair_profile,
      params.scenario.routine_inventory ?? [],
    )

    return runShadowAgentComparisonForUser({
      userId: session.userId,
      prompt: params.prompt,
      turns: params.turns,
      baseUrl: params.baseUrl,
    })
  } finally {
    await session.cleanup()
  }
}

function deriveNextClassicState(params: {
  previousState: ConversationState | null
  routeTrace: AgentRoutePacket
  selectedProducts: SelectedProductsProjection | null
}): ConversationState {
  const previousState = params.previousState ?? createDefaultConversationState()
  const productCategory = params.selectedProducts?.category ?? params.routeTrace.product_category

  if (productCategory) {
    return {
      ...previousState,
      active_topic: productCategory,
      routine_layer: null,
      pending_offer: null,
      last_product_category: productCategory,
      last_assistant_action: "answered_direct",
    }
  }

  if (params.routeTrace.user_job === "routine_structure") {
    const routineLayer = params.routeTrace.routine_layer ?? previousState.routine_layer ?? "basics"

    return {
      ...previousState,
      active_topic: "routine",
      routine_layer: routineLayer,
      pending_offer: routineLayer === "basics" ? "routine_goals_or_problems" : null,
      last_assistant_action:
        routineLayer === "basics" ? "answered_routine_basics" : "answered_routine",
    }
  }

  return {
    ...previousState,
    pending_offer: null,
    last_assistant_action: "answered_direct",
  }
}

export async function runShadowAgentComparisonForUser(
  params: AgentCompareUserRequest,
): Promise<CompareRunResult> {
  const turns = normalizeTurns(params)
  const context = await getUserContext(params.userId)
  const memoryContext = await loadUserMemoryContext(params.userId)
  const selectProducts = createSelectProductsTool()
  const buildOrFixRoutine = createBuildOrFixRoutineTool()

  const loadedGuidanceIds: string[] = []
  let selectedProductsProjection: SelectedProductsProjection | null = null
  let finalResult: Awaited<ReturnType<typeof runShadowAgentTurn>> | null = null
  let conversationState: ConversationState | null = null
  const turnResults: AgentCompareTurnResult[] = []
  const startedAt = performance.now()

  for (const [index, message] of turns.entries()) {
    const turnStartedAt = performance.now()
    let turnSelectedProductsProjection: SelectedProductsProjection | null = null

    const result = await runShadowAgentTurn({
      message,
      modelClient: createOpenAIToolModelClient(),
      conversationState,
      tools: {
        get_user_context: async () => context,
        load_guidance: async (input) => {
          const ids = Array.isArray(input.ids) ? (input.ids as GuidanceId[]) : []
          loadedGuidanceIds.push(...ids)
          return loadGuidance(ids)
        },
        select_products: async (input) => {
          const projection = await selectProducts({
            category: normalizeSelectableCategory(input.category),
            message,
            hairProfile: context.profile,
            memoryContext,
            routineItems: context.routine_inventory,
            userJob: normalizeAgentUserJob(input.userJob),
            concerns: normalizeAgentConcerns(input.concerns),
            requestedGoal: normalizeRequestedGoal(input.requestedGoal, message),
            activeProfileSignals: normalizeActiveProfileSignals(input.activeProfileSignals),
          })

          selectedProductsProjection = projection
          turnSelectedProductsProjection = projection
          return projection
        },
        build_or_fix_routine: async (input) =>
          buildOrFixRoutine({
            objective: normalizeRoutineObjective(input.objective),
            message,
            hairProfile: context.profile,
            layer: normalizeRoutineLayer(input.layer),
            requestedCategory: normalizeRoutineProductCategory(input.requestedCategory),
          }),
      },
    })

    conversationState = deriveNextClassicState({
      previousState: conversationState,
      routeTrace: result.route_trace,
      selectedProducts: turnSelectedProductsProjection,
    })
    finalResult = result
    turnResults.push({
      turn: index + 1,
      prompt: message,
      answer: result.final_answer,
      latency_ms: Math.round(performance.now() - turnStartedAt),
      debug_lines: buildShadowDebugLines({
        toolCallNames: result.tool_calls.map((call) => call.name),
        guidanceIds: loadedGuidanceIds,
        selectedProducts: turnSelectedProductsProjection,
        routeTrace: result.route_trace,
      }),
      matched_products: normalizeMatchedProducts(turnSelectedProductsProjection),
      product_trace: turnSelectedProductsProjection,
      route_trace: result.route_trace,
      state_transition: { next_state: conversationState },
      error: null,
    })
  }

  if (!finalResult) {
    throw new Error("Classic comparison did not produce a result.")
  }

  return {
    system: "classic",
    answer: finalResult.final_answer,
    latency_ms: Math.round(performance.now() - startedAt),
    debug_lines: buildShadowDebugLines({
      toolCallNames: finalResult.tool_calls.map((call) => call.name),
      guidanceIds: loadedGuidanceIds,
      selectedProducts: selectedProductsProjection,
      routeTrace: finalResult.route_trace,
    }),
    matched_products: normalizeMatchedProducts(selectedProductsProjection),
    product_trace: selectedProductsProjection,
    route_trace: finalResult.route_trace,
    state_transition: conversationState ? { next_state: conversationState } : undefined,
    turns: turnResults.length > 1 ? turnResults : undefined,
    error: null,
  }
}

export const runClassicAgentComparison = runShadowAgentComparison
export const runClassicAgentComparisonForUser = runShadowAgentComparisonForUser
