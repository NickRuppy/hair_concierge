import { loadGuidance } from "@/lib/agent/guidance/load-guidance"
import {
  createOpenAIToolModelClient,
  type AgentModelClient,
} from "@/lib/agent/orchestrator/model-client"
import { AGENT_FINAL_RENDER_PROMPT } from "@/lib/agent/orchestrator/prompt"
import {
  deriveRequestedGoal,
  runShadowAgentTurn,
} from "@/lib/agent/orchestrator/run-shadow-agent-turn"
import type { AgentToolName } from "@/lib/agent/orchestrator/tool-definitions"
import type {
  AgentActiveProfileSignal,
  AgentConcern,
  AgentRoutePacket,
  AgentRuntimePacket,
  AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import {
  isActiveProfileSignalField,
  isActiveSignalSelectionEffect,
} from "@/lib/agent/orchestrator/route-packet"
import {
  isGuidanceId,
  isSelectableProductCategory,
  type GuidanceId,
  type SelectableProductCategory,
} from "@/lib/agent/contracts"
import {
  createBuildOrFixRoutineTool,
  type RoutineObjective,
} from "@/lib/agent/tools/build-or-fix-routine"
import { getUserContext, type UserContextProjection } from "@/lib/agent/tools/get-user-context"
import {
  createSelectProductsTool,
  type SelectedProductsProjection,
  type SelectProductsToolResult,
} from "@/lib/agent/tools/select-products"
import {
  buildRecommendationEngineTrace,
  getRuntimeCategoryDecision,
} from "@/lib/recommendation-engine"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_CHAT_COMPLETION_MODEL } from "@/lib/openai/chat"
import { buildPipelineTraceDraft } from "@/lib/rag/debug-trace"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"
import { loadUserMemoryContext, type UserMemoryContext } from "@/lib/rag/user-memory"
import type {
  ChatCategoryDecision,
  ChatPromptSnapshot,
  ClassificationResult,
  IntentType,
  LangfusePromptReference,
  Message,
  Product,
  ProductCategory,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
} from "@/lib/types"

type ConversationHistoryProjection = Array<{
  role: Message["role"]
  content: string | null
  created_at: string
}>

type ProductionUserContext = UserContextProjection & {
  conversation_history: ConversationHistoryProjection
}

interface ProductionAgentPipelineDeps {
  modelClient?: AgentModelClient
}

async function measureAsync<T>(work: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
}

function createTextStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      // Agent v1 renders the full bounded-agent answer before returning to /api/chat.
      // Keep the stream wrapper so the existing SSE persistence/debug envelope stays unchanged.
      if (content.length > 0) {
        controller.enqueue(encoder.encode(content))
      }
      controller.close()
    },
  })
}

function normalizeSelectableCategory(value: unknown): SelectableProductCategory {
  if (typeof value !== "string" || !isSelectableProductCategory(value)) {
    throw new Error("Agent requested select_products without a supported category")
  }

  return value
}

function normalizeRoutineObjective(value: unknown): RoutineObjective | null {
  return value === "build_routine" || value === "fix_routine" ? value : null
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

function normalizeGuidanceIds(value: unknown): GuidanceId[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is GuidanceId => typeof item === "string" && isGuidanceId(item))
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

export function mapAgentIntent(route: AgentRoutePacket): IntentType {
  switch (route.user_job) {
    case "product_pick":
    case "compare_or_decide":
      return "product_recommendation"
    case "routine_structure":
      return "routine_help"
    case "troubleshoot":
      return "diagnosis"
    case "usage":
      return "hair_care_advice"
    case "unsupported_or_unclear":
      return "general_chat"
  }
}

export function mapAgentProductCategory(route: AgentRoutePacket): ProductCategory {
  if (route.product_category) return route.product_category
  return route.user_job === "routine_structure" ? "routine" : null
}

function deriveResponseMode(selectedProducts: SelectedProductsProjection | null): ResponseMode {
  return selectedProducts?.decision === "needs_more_info" ? "clarify_only" : "answer_direct"
}

export function buildClassification(route: AgentRoutePacket): ClassificationResult {
  return {
    intent: mapAgentIntent(route),
    product_category: mapAgentProductCategory(route),
    complexity: route.guidance_ids.length > 1 ? "multi_constraint" : "simple",
    needs_clarification: Boolean(route.ambiguity),
    retrieval_mode: "hybrid",
    normalized_filters: {
      user_job: route.user_job,
      concerns: route.concerns,
      active_profile_signals: route.active_profile_signals.map(
        (signal) => `${signal.field}:${signal.value}:${signal.selection_effect}`,
      ),
      ambiguity: route.ambiguity,
    },
    router_confidence: route.confidence,
  }
}

export function buildRouterDecision(params: {
  route: AgentRoutePacket
  selectedProducts: SelectedProductsProjection | null
}): RouterDecision {
  const responseMode = deriveResponseMode(params.selectedProducts)
  const policyOverrides = ["agent_v1_front_door"]

  if (params.selectedProducts?.product_response_policy) {
    policyOverrides.push(`product_policy:${params.selectedProducts.product_response_policy}`)
  }

  if (params.route.validation_warnings.length > 0) {
    policyOverrides.push("agent_route_validation_warnings")
  }

  return {
    retrieval_mode: "hybrid",
    response_mode: responseMode,
    clarification_reason:
      responseMode === "clarify_only"
        ? (params.selectedProducts?.missing_info[0]?.detail ?? params.route.ambiguity ?? undefined)
        : undefined,
    slot_completeness: responseMode === "clarify_only" ? 0.5 : 1,
    confidence: params.route.confidence,
    policy_overrides: policyOverrides,
  }
}

function promptRef(name: string): LangfusePromptReference {
  return {
    name,
    version: null,
    label: "code",
    is_fallback: true,
  }
}

function buildPromptSnapshot(params: {
  message: string
  packet: AgentRuntimePacket
}): ChatPromptSnapshot {
  return {
    model: DEFAULT_CHAT_COMPLETION_MODEL,
    temperature: 0,
    prompt_ref: promptRef("bounded-agent-final-render"),
    system_prompt: AGENT_FINAL_RENDER_PROMPT,
    messages: [
      { role: "system", content: AGENT_FINAL_RENDER_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          message: params.message,
          packet: params.packet,
        }),
      },
    ],
  }
}

export function productsForRenderedPacket(params: {
  runtimePacket: AgentRuntimePacket
  selectedProducts: Product[]
}): Product[] {
  const renderedProducts = params.runtimePacket.selected_products?.products ?? []
  if (renderedProducts.length === 0) return []

  const productsById = new Map(params.selectedProducts.map((product) => [product.id, product]))

  return renderedProducts
    .map((product) => productsById.get(product.product_id) ?? null)
    .filter((product): product is Product => Boolean(product))
}

async function loadConversationHistory(conversationId: string): Promise<Message[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(10)

  if (error) {
    console.error("Failed to load production agent conversation history:", error)
    return []
  }

  return (data as Message[]) ?? []
}

function projectConversationHistory(messages: Message[]): ConversationHistoryProjection {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    created_at: message.created_at,
  }))
}

function makeAgentTools(params: {
  message: string
  userContext: ProductionUserContext
  memoryContext: UserMemoryContext
  onSelectProducts: (result: SelectProductsToolResult) => void
}): Record<AgentToolName, (input: Record<string, unknown>) => Promise<unknown>> {
  const selectProducts = createSelectProductsTool({
    onResult: params.onSelectProducts,
  })
  const buildOrFixRoutine = createBuildOrFixRoutineTool()

  return {
    get_user_context: async () => params.userContext,
    load_guidance: async (input) => loadGuidance(normalizeGuidanceIds(input.ids)),
    select_products: async (input) =>
      selectProducts({
        category: normalizeSelectableCategory(input.category),
        message: params.message,
        hairProfile: params.userContext.profile,
        memoryContext: params.memoryContext,
        routineItems: params.userContext.routine_inventory,
        userJob: normalizeAgentUserJob(input.userJob),
        concerns: normalizeAgentConcerns(input.concerns),
        requestedGoal: normalizeRequestedGoal(input.requestedGoal, params.message),
        activeProfileSignals: normalizeActiveProfileSignals(input.activeProfileSignals),
      }),
    build_or_fix_routine: async (input) =>
      buildOrFixRoutine({
        objective: normalizeRoutineObjective(input.objective),
        message: params.message,
        hairProfile: params.userContext.profile,
      }),
  }
}

export async function runProductionAgentPipeline(
  params: PipelineParams,
  deps: ProductionAgentPipelineDeps = {},
): Promise<PipelineResult> {
  const { message, userId, conversationId, requestId } = params
  if (!conversationId) {
    throw new Error("Production agent chat requires a conversation id before orchestration.")
  }

  const startedAt = new Date().toISOString()

  const [
    { result: conversationHistory, durationMs: historyLoadMs },
    { result: userContextBase, durationMs: contextLoadMs },
    { result: memoryContext, durationMs: memoryLoadMs },
  ] = await Promise.all([
    measureAsync(() => loadConversationHistory(conversationId)),
    measureAsync(() => getUserContext(userId)),
    measureAsync(() => loadUserMemoryContext(userId)),
  ])

  const userContext: ProductionUserContext = {
    ...userContextBase,
    conversation_history: projectConversationHistory(conversationHistory),
  }
  const selectedProductsHolder: { current: SelectProductsToolResult | null } = { current: null }

  const agentStart = performance.now()
  const result = await runShadowAgentTurn({
    message,
    modelClient: deps.modelClient ?? createOpenAIToolModelClient(),
    tools: makeAgentTools({
      message,
      userContext,
      memoryContext,
      onSelectProducts: (selection) => {
        selectedProductsHolder.current = selection
      },
    }),
  })
  const agentMs = Math.round(performance.now() - agentStart)

  const selectedProductsResult: SelectProductsToolResult | null = selectedProductsHolder.current
  const selectedProducts = selectedProductsResult?.projection ?? null
  const route = result.route_trace
  const intent = mapAgentIntent(route)
  const productCategory = mapAgentProductCategory(route)
  const routerDecision = buildRouterDecision({ route, selectedProducts })
  const classification = buildClassification(route)
  const matchedProducts = productsForRenderedPacket({
    runtimePacket: result.runtime_packet,
    selectedProducts: selectedProductsResult?.products ?? [],
  })
  const categoryDecision = selectedProductsResult
    ? (getRuntimeCategoryDecision(
        selectedProductsResult.runtime,
        selectedProductsResult.projection.category as ProductCategory,
      ) as ChatCategoryDecision | null)
    : null
  const engineTrace: RecommendationEngineTrace | undefined = selectedProductsResult
    ? buildRecommendationEngineTrace({ runtime: selectedProductsResult.runtime })
    : undefined
  const prompt = buildPromptSnapshot({
    message,
    packet: result.runtime_packet,
  })
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: message,
    conversation_id: conversationId,
    intent,
    product_category: productCategory,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    clarification_questions:
      routerDecision.response_mode === "clarify_only" && selectedProducts?.missing_info[0]
        ? [selectedProducts.missing_info[0].detail]
        : [],
    hair_profile_snapshot: userContext.profile,
    memory_context: memoryContext.promptContext,
    retrieval_debug: {
      source_types: [],
      metadata_filter: null,
      subqueries: [],
      candidate_count_before_rerank: 0,
      reranked_count: 0,
      fallback_used: false,
    },
    retrieval_count: 0,
    retrieved_chunks: [],
    should_plan_routine: route.user_job === "routine_structure",
    category_decision: categoryDecision ?? undefined,
    engine_trace: engineTrace,
    matched_products: matchedProducts,
    classification_prompt_ref: promptRef("bounded-agent-route-classification"),
    prompt,
    latencies_ms: {
      classification_ms: agentMs,
      hair_profile_load_ms: contextLoadMs,
      routine_inventory_load_ms: 0,
      memory_load_ms: memoryLoadMs,
      routine_planning_ms: 0,
      history_load_ms: historyLoadMs,
      router_ms: 0,
      conversation_create_ms: 0,
      retrieval_ms: 0,
      product_matching_ms: selectedProductsResult ? agentMs : 0,
      prompt_build_ms: 0,
      stream_setup_ms: 0,
    },
  })

  return {
    stream: createTextStream(result.final_answer),
    conversationId,
    intent,
    matchedProducts,
    sources: [],
    retrievalSummary: {
      final_context_count: 0,
    },
    routerDecision,
    categoryDecision: categoryDecision ?? undefined,
    engineTrace,
    debugTrace,
  }
}
