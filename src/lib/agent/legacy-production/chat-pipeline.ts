// Legacy archived production pipeline. Not reachable from /api/chat.
// Kept temporarily for historical reference until the post-ship cleanup pass.

import {
  createOpenAIAgenticToolLoopModelClient,
  type AgenticToolLoopModelClient,
} from "@/lib/agent/orchestrator/model-client"
import { runAgenticToolTurn } from "@/lib/agent/orchestrator/run-agentic-tool-turn"
import { isSelectableProductCategory, type SelectableProductCategory } from "@/lib/agent/contracts"
import {
  createBuildOrFixRoutineTool,
  type BuildOrFixRoutineProjection,
  type BuildOrFixRoutineToolInput,
  type RoutineObjective,
} from "@/lib/agent/tools/build-or-fix-routine"
import { getUserContext, type UserContextProjection } from "@/lib/agent/tools/get-user-context"
import {
  loadAdvisorGuidance,
  normalizeAdvisorGuidanceCategories,
  normalizeAdvisorGuidanceCategory,
  normalizeAdvisorGuidanceIntent,
  normalizeAdvisorProfileFocus,
  type AdvisorGuidanceProjection,
  type LoadAdvisorGuidanceInput,
} from "@/lib/agent/tools/load-advisor-guidance"
import {
  createSelectProductsTool,
  type SelectedProductsProjection,
  type SelectProductsToolResult,
} from "@/lib/agent/tools/select-products"
import {
  buildRecommendationEngineTrace,
  getRuntimeCategoryDecision,
} from "@/lib/recommendation-engine"
import { LANGFUSE_PROMPTS } from "@/lib/langfuse/prompts"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_CHAT_COMPLETION_MODEL } from "@/lib/openai/chat"
import { loadConversationState as loadPersistedConversationState } from "@/lib/rag/conversation-state-store"
import { buildPipelineTraceDraft, projectAgenticToolLoopTraceForApp } from "@/lib/rag/debug-trace"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"
import { loadUserMemoryContext, type UserMemoryContext } from "@/lib/rag/user-memory"
import type {
  ChatCategoryDecision,
  ChatPromptSnapshot,
  ClassificationResult,
  ConversationState,
  IntentType,
  LangfusePromptReference,
  Message,
  Product,
  ProductCategory,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
} from "@/lib/types"

type RecentConversationMessage = {
  role: "user" | "assistant"
  content: string
}

// Legacy production tool-loop pipeline. `/api/chat` now uses the AgentV2 + CareBalance
// production pipeline in `src/lib/agent-v2/production/chat-pipeline.ts`; keep this module
// available for legacy tests and explicit debug comparisons until the final cleanup pass.

interface ProductionAgentPipelineDeps {
  modelClient?: AgenticToolLoopModelClient
  loadConversationHistory?: (conversationId: string) => Promise<Message[]>
  getUserContext?: (userId: string) => Promise<UserContextProjection>
  loadUserMemoryContext?: (userId: string) => Promise<UserMemoryContext>
  loadConversationState?: (conversationId: string) => Promise<ConversationState>
  createSelectProductsTool?: typeof createSelectProductsTool
  createBuildOrFixRoutineTool?: typeof createBuildOrFixRoutineTool
  loadAdvisorGuidance?: (input: LoadAdvisorGuidanceInput) => Promise<AdvisorGuidanceProjection>
}

type SelectProductsToolParams = Parameters<ReturnType<typeof createSelectProductsTool>>[0]

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

function normalizeRoutineLayer(value: unknown) {
  return value === "basics" || value === "goals" || value === "problems" || value === "deep_dive"
    ? value
    : null
}

function normalizeRoutineProductCategory(value: unknown) {
  return typeof value === "string" && isSelectableProductCategory(value) ? value : null
}

function promptRef(name: string): LangfusePromptReference {
  return {
    name,
    version: null,
    label: "code",
    is_fallback: true,
  }
}

function buildToolLoopPromptSnapshot(params: {
  message: string
  recentMessages: RecentConversationMessage[]
  promptRef: LangfusePromptReference
}): ChatPromptSnapshot {
  const recentMessageRoles = params.recentMessages.slice(-4).map((message) => message.role)

  return {
    kind: "agentic_tool_loop",
    model: DEFAULT_CHAT_COMPLETION_MODEL,
    temperature: 0,
    prompt_ref: params.promptRef,
    system_prompt: "agentic_tool_loop",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          latest_user_message_chars: params.message.length,
          recent_message_count: params.recentMessages.length,
          recent_message_roles: recentMessageRoles,
          engine: "agentic_tool_loop",
        }),
      },
    ],
  }
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

function projectRecentMessages(messages: Message[]): RecentConversationMessage[] {
  return messages.flatMap((message): RecentConversationMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return []
    const content = message.content?.trim()
    if (!content) return []
    return [{ role: message.role, content }]
  })
}

function makeAgenticTools(params: {
  onSelectProducts: (result: SelectProductsToolResult) => void
  createSelectProductsTool?: typeof createSelectProductsTool
  createBuildOrFixRoutineTool?: typeof createBuildOrFixRoutineTool
  loadAdvisorGuidance?: (input: LoadAdvisorGuidanceInput) => Promise<AdvisorGuidanceProjection>
}): Parameters<typeof runAgenticToolTurn>[0]["tools"] {
  const selectProducts = (params.createSelectProductsTool ?? createSelectProductsTool)({
    onResult: params.onSelectProducts,
  })
  const buildOrFixRoutine = (params.createBuildOrFixRoutineTool ?? createBuildOrFixRoutineTool)()
  const advisorGuidance = params.loadAdvisorGuidance ?? loadAdvisorGuidance

  return {
    load_advisor_guidance: async (input) =>
      advisorGuidance({
        intent: normalizeAdvisorGuidanceIntent(input.intent),
        category: normalizeAdvisorGuidanceCategory(input.category),
        categories: normalizeAdvisorGuidanceCategories(input.categories),
        profileFocus: normalizeAdvisorProfileFocus(input.profileFocus),
        message: typeof input.message === "string" ? input.message : "",
        userContext:
          input.userContext && typeof input.userContext === "object"
            ? (input.userContext as UserContextProjection)
            : {
                profile: null,
                routine_inventory: [],
                relevant_memory: [],
                derived_signals: [],
                suggested_overlays: [],
                missing_profile: [],
              },
        conversationState:
          input.conversationState && typeof input.conversationState === "object"
            ? (input.conversationState as ConversationState)
            : null,
      }),
    select_products: async (input) =>
      selectProducts({
        ...(input as SelectProductsToolParams),
        category: normalizeSelectableCategory(input.category),
      }),
    build_or_fix_routine: async (input) =>
      buildOrFixRoutine({
        ...(input as unknown as BuildOrFixRoutineToolInput),
        objective: normalizeRoutineObjective(input.objective),
        layer: normalizeRoutineLayer(input.layer),
        requestedCategory: normalizeRoutineProductCategory(input.requestedCategory),
      }),
  }
}

function deriveToolLoopIntent(params: {
  visibleFailure: boolean
  toolNames: string[]
}): IntentType {
  if (params.visibleFailure) return "general_chat"
  if (params.toolNames.includes("select_products")) return "product_recommendation"
  if (params.toolNames.includes("build_or_fix_routine")) return "routine_help"
  if (params.toolNames.includes("load_advisor_guidance")) return "hair_care_advice"
  return "general_chat"
}

function deriveProductCategory(params: {
  visibleFailure: boolean
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  state: ConversationState
}): ProductCategory {
  if (params.visibleFailure) return null
  if (params.selectedProducts?.category) return params.selectedProducts.category
  if (params.routinePlan) return "routine"
  const activeTopic = params.state.active_topic
  return activeTopic === "routine" ? "routine" : activeTopic
}

function hasBlockingRoutineMissingInfo(routinePlan: BuildOrFixRoutineProjection | null): boolean {
  return Boolean(routinePlan?.missing_info.some((item) => item.blocking))
}

function deriveResponseMode(params: {
  visibleFailure: boolean
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
}): ResponseMode {
  return params.visibleFailure ||
    params.selectedProducts?.decision === "needs_more_info" ||
    hasBlockingRoutineMissingInfo(params.routinePlan)
    ? "clarify_only"
    : "answer_direct"
}

function deriveMissingProfilePolicyOverride(
  selectedProducts: SelectedProductsProjection | null,
): string | null {
  if (selectedProducts?.decision !== "needs_more_info") return null
  if (!selectedProducts.missing_info.some((item) => item.blocking)) return null

  switch (selectedProducts.category) {
    case "shampoo":
      return "missing_shampoo_profile"
    case "conditioner":
      return "missing_conditioner_profile"
    case "leave_in":
      return "missing_leave_in_profile"
    case "mask":
      return "missing_mask_profile"
    case "oil":
      return "missing_oil_profile"
    default:
      return null
  }
}

function buildToolLoopRouterDecision(params: {
  visibleFailure: boolean
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  repairAttempted: boolean
}): RouterDecision {
  const responseMode = deriveResponseMode(params)
  const policyOverrides = ["agentic_tool_loop"]

  if (params.selectedProducts?.product_response_policy) {
    policyOverrides.push(`product_policy:${params.selectedProducts.product_response_policy}`)
  }

  const missingProfileOverride = deriveMissingProfilePolicyOverride(params.selectedProducts)
  if (missingProfileOverride) {
    policyOverrides.push(missingProfileOverride)
  }

  if (params.repairAttempted) {
    policyOverrides.push("terminal_protocol_repair_attempted")
  }

  if (params.visibleFailure) {
    policyOverrides.push("visible_failure")
  }

  if (hasBlockingRoutineMissingInfo(params.routinePlan)) {
    policyOverrides.push("missing_routine_frame")
  }

  return {
    retrieval_mode: "agentic_tool_loop",
    response_mode: responseMode,
    clarification_reason:
      responseMode === "clarify_only" && params.visibleFailure
        ? "tool_loop_visible_failure"
        : responseMode === "clarify_only" && params.selectedProducts?.missing_info[0]
          ? params.selectedProducts.missing_info[0].detail
          : responseMode === "clarify_only" && hasBlockingRoutineMissingInfo(params.routinePlan)
            ? "missing_routine_frame"
            : undefined,
    slot_completeness: responseMode === "clarify_only" ? 0.5 : 1,
    confidence: params.visibleFailure ? 0 : params.repairAttempted ? 0.5 : 1,
    policy_overrides: policyOverrides,
  }
}

function buildToolLoopClassification(params: {
  intent: IntentType
  productCategory: ProductCategory
  routerDecision: RouterDecision
  toolNames: string[]
}): ClassificationResult {
  return {
    intent: params.intent,
    product_category: params.productCategory,
    complexity: params.toolNames.length > 1 ? "multi_constraint" : "simple",
    needs_clarification: params.routerDecision.response_mode === "clarify_only",
    retrieval_mode: params.routerDecision.retrieval_mode,
    normalized_filters: {
      engine: "agentic_tool_loop",
      tool_calls: params.toolNames,
    },
    router_confidence: params.routerDecision.confidence,
  }
}

function deriveMatchedProducts(params: {
  surfacedProductIds: string[]
  selectedProductsResult: SelectProductsToolResult | null
}): Product[] {
  const selectedProducts = params.selectedProductsResult?.products ?? []
  if (selectedProducts.length === 0) return []

  const selectedProductsById = new Map(selectedProducts.map((product) => [product.id, product]))
  const surfacedProducts = params.surfacedProductIds.flatMap((id) => {
    const product = selectedProductsById.get(id)
    return product ? [product] : []
  })

  return surfacedProducts.length > 0 ? surfacedProducts : selectedProducts
}

function deriveEngineArtifacts(selectedProductsResult: SelectProductsToolResult | null): {
  categoryDecision: ChatCategoryDecision | undefined
  engineTrace: RecommendationEngineTrace | undefined
} {
  if (!selectedProductsResult) {
    return {
      categoryDecision: undefined,
      engineTrace: undefined,
    }
  }

  const productCategory = selectedProductsResult.projection.category as ProductCategory
  return {
    categoryDecision: getRuntimeCategoryDecision(
      selectedProductsResult.runtime,
      productCategory,
    ) as ChatCategoryDecision | undefined,
    engineTrace: buildRecommendationEngineTrace({
      runtime: selectedProductsResult.runtime,
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
    { result: userContext, durationMs: contextLoadMs },
    { result: memoryContext, durationMs: memoryLoadMs },
    { result: conversationState },
  ] = await Promise.all([
    measureAsync(() => (deps.loadConversationHistory ?? loadConversationHistory)(conversationId)),
    measureAsync(() => (deps.getUserContext ?? getUserContext)(userId)),
    measureAsync(() => (deps.loadUserMemoryContext ?? loadUserMemoryContext)(userId)),
    measureAsync(() =>
      deps.loadConversationState
        ? deps.loadConversationState(conversationId)
        : loadPersistedConversationState(createAdminClient(), conversationId),
    ),
  ])

  const recentMessages = projectRecentMessages(conversationHistory)
  const selectedProductsHolder: { current: SelectProductsToolResult | null } = { current: null }
  const promptRefs: { agenticToolLoop: LangfusePromptReference } = {
    agenticToolLoop: promptRef(LANGFUSE_PROMPTS.agenticToolLoop.name),
  }
  const modelClient =
    deps.modelClient ??
    createOpenAIAgenticToolLoopModelClient({
      onManagedPrompt: ({ prompt, ref }) => {
        if (prompt.name === LANGFUSE_PROMPTS.agenticToolLoop.name) {
          promptRefs.agenticToolLoop = ref
        }
      },
    })

  const agentStart = performance.now()
  const toolLoopResult = await runAgenticToolTurn({
    message,
    recentMessages,
    modelClient,
    tools: makeAgenticTools({
      onSelectProducts: (selection) => {
        selectedProductsHolder.current = selection
      },
      createSelectProductsTool: deps.createSelectProductsTool,
      createBuildOrFixRoutineTool: deps.createBuildOrFixRoutineTool,
      loadAdvisorGuidance: deps.loadAdvisorGuidance,
    }),
    userContext,
    conversationState,
    answerCompositionMode: "inline_context",
  })
  const agentMs = Math.round(performance.now() - agentStart)

  const selectedProductsResult = selectedProductsHolder.current
  const toolNames = toolLoopResult.tool_calls.map((call) => call.name)
  const visibleFailure = toolLoopResult.trace.visible_failure
  const intent = deriveToolLoopIntent({
    visibleFailure,
    toolNames,
  })
  const productCategory = deriveProductCategory({
    visibleFailure,
    selectedProducts: toolLoopResult.selected_products,
    routinePlan: toolLoopResult.routine_plan,
    state: toolLoopResult.state_transition.next_state,
  })
  const routerDecision = buildToolLoopRouterDecision({
    visibleFailure,
    selectedProducts: toolLoopResult.selected_products,
    routinePlan: toolLoopResult.routine_plan,
    repairAttempted: toolLoopResult.trace.repair_attempts.length > 0,
  })
  const classification = buildToolLoopClassification({
    intent,
    productCategory,
    routerDecision,
    toolNames,
  })
  const matchedProducts = deriveMatchedProducts({
    surfacedProductIds: toolLoopResult.surfaced_product_ids,
    selectedProductsResult,
  })
  const { categoryDecision, engineTrace } = deriveEngineArtifacts(selectedProductsResult)
  const exposedMatchedProducts = visibleFailure ? [] : matchedProducts
  const exposedCategoryDecision = visibleFailure ? undefined : categoryDecision
  const exposedEngineTrace = visibleFailure ? undefined : engineTrace
  const exposedProductCategory = visibleFailure ? null : productCategory
  const attachmentMode = exposedMatchedProducts.length > 0 ? "cards" : "text_only"
  const prompt = buildToolLoopPromptSnapshot({
    message,
    recentMessages,
    promptRef: promptRefs.agenticToolLoop,
  })
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: `[tool_loop_user_message chars=${message.length}]`,
    conversation_id: conversationId,
    intent,
    product_category: exposedProductCategory,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    conversation_state: toolLoopResult.state_transition,
    clarification_questions:
      routerDecision.response_mode === "clarify_only" && routerDecision.clarification_reason
        ? [routerDecision.clarification_reason]
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
    should_plan_routine: Boolean(toolLoopResult.routine_plan),
    category_decision: exposedCategoryDecision,
    engine_trace: exposedEngineTrace,
    matched_products: exposedMatchedProducts,
    classification_prompt_ref: promptRefs.agenticToolLoop,
    prompt,
    response_composition: {
      path: "agentic_tool_loop",
      migration_mode: "tool_loop",
      fallback_reason: null,
      rendering_path: null,
      plan_type: "tool_loop",
      attachment_mode: attachmentMode,
    },
    engine_variant: "tool_loop",
    agentic_tool_loop: projectAgenticToolLoopTraceForApp({
      runtimeTrace: toolLoopResult.trace,
      selectedProducts: toolLoopResult.selected_products,
      routinePlan: toolLoopResult.routine_plan,
      latencyMs: agentMs,
    }),
    latencies_ms: {
      classification_ms: 0,
      hair_profile_load_ms: contextLoadMs,
      routine_inventory_load_ms: 0,
      memory_load_ms: memoryLoadMs,
      routine_planning_ms: 0,
      history_load_ms: historyLoadMs,
      router_ms: 0,
      conversation_create_ms: 0,
      retrieval_ms: 0,
      product_matching_ms: 0,
      prompt_build_ms: 0,
      stream_setup_ms: 0,
    },
  })

  return {
    stream: createTextStream(toolLoopResult.final_answer),
    conversationId,
    intent,
    matchedProducts: exposedMatchedProducts,
    sources: [],
    conversationStateTransition: toolLoopResult.state_transition,
    retrievalSummary: {
      final_context_count: 0,
    },
    routerDecision,
    categoryDecision: exposedCategoryDecision,
    engineTrace: exposedEngineTrace,
    debugTrace,
    visibleFailure,
  }
}
