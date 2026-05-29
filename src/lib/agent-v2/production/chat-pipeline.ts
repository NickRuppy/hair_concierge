import { getOpenAI } from "@/lib/openai/client"
import { createBuildOrFixRoutineTool } from "@/lib/agent/tools/build-or-fix-routine"
import { buildCareBalanceToolContext } from "@/lib/agent/tools/care-balance-context"
import { getUserContext, type UserContextProjection } from "@/lib/agent/tools/get-user-context"
import {
  createSelectProductsTool,
  type SelectProductsToolResult,
} from "@/lib/agent/tools/select-products"
import { loadAgentV2ProductionConversationHistory } from "@/lib/agent-v2/production/conversation-history"
import { buildAgentV2ProductToolMessage } from "@/lib/agent-v2/runtime/product-tool-context"
import {
  type AgentV2RoutineLayer,
  type AgentV2RoutineThreadContext,
  type AgentV2SafetyMode,
  type AgentV2SessionMemoryWrite,
  type AgentV2TerminalAnswer,
} from "@/lib/agent-v2/contracts"
import { runAgentV2ResponsesTurn } from "@/lib/agent-v2/runtime/responses-agent"
import { loadAgentV2AdvisorGuidance } from "@/lib/agent-v2/tools/guidance-tool"
import {
  projectRoutineForAgentV2,
  type AgentV2RoutineProjection,
} from "@/lib/agent-v2/tools/routine-projection"
import {
  projectSelectProductsForAgentV2,
  type AgentV2SelectProductsProjection,
} from "@/lib/agent-v2/tools/select-products-projection"
import {
  buildAgentV2Classification,
  buildAgentV2RouterDecision,
  deriveEngineArtifacts,
  deriveIntent,
  deriveMatchedProducts,
  deriveProductCategory,
} from "@/lib/agent-v2/production/product-output"
import {
  buildRoutineThreadVisibleSteps,
  collectTrustedSurfacedProductProjections,
  mergeAgentV2SessionMemory,
  mergePriorSelectedProductProjections,
  updateAgentV2ProductionRoutineThreadContext,
} from "@/lib/agent-v2/production/session-state"
import {
  AGENT_V2_PRODUCTION_ENGINE,
  normalizeAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
  type AgentV2ConversationStateV2,
} from "@/lib/agent-v2/production/persisted-session-state"
import { loadAgentV2ConversationState as loadPersistedConversationState } from "@/lib/rag/conversation-state-store"
import { buildPipelineTraceDraft } from "@/lib/rag/debug-trace"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"
import { loadUserMemoryContext, type UserMemoryContext } from "@/lib/rag/user-memory"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import { buildRecommendationEngineRuntimeFromPersistence } from "@/lib/recommendation-engine/runtime"
import type { EffectiveCareContext } from "@/lib/recommendation-engine/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ChatPromptSnapshot,
  ClassificationResult,
  HairProfile,
  LangfusePromptReference,
  Message,
} from "@/lib/types"
import type { RoutineProduct } from "@/lib/vocabulary"

type RecentConversationMessage = {
  role: "user" | "assistant"
  content: string
}

type AgentV2ResponsesClient = Parameters<typeof runAgentV2ResponsesTurn>[0]["client"]
type AgentV2RuntimeToolExecutionContext = {
  effectiveCareContext?: EffectiveCareContext
}
type AgentV2StoredProductProjection = Partial<AgentV2SelectProductsProjection>
type AgentV2ProductionTraceTiming = {
  modelMs: number | null
  toolMs: number | null
}

interface ProductionAgentV2PipelineDeps {
  client?: AgentV2ResponsesClient
  loadConversationHistory?: (conversationId: string) => Promise<Message[]>
  getUserContext?: (userId: string) => Promise<UserContextProjection>
  loadUserMemoryContext?: (userId: string) => Promise<UserMemoryContext>
  loadConversationState?: (conversationId: string) => Promise<unknown>
  createSelectProductsTool?: typeof createSelectProductsTool
  createBuildOrFixRoutineTool?: typeof createBuildOrFixRoutineTool
  runAgentV2ResponsesTurn?: typeof runAgentV2ResponsesTurn
}

const ROUTINE_PRODUCT_CATEGORY_VALUES = new Set<RoutineProduct>([
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
])

async function measureAsync<T>(work: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
}

function sumFiniteLatencies(values: readonly (number | null | undefined)[]): number | null {
  const latencies = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  )
  if (latencies.length === 0) return null
  return latencies.reduce((sum, value) => sum + value, 0)
}

function readAgentV2ModelStepLatencyMs(step: unknown): number | null {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null
  const latencyMs = (step as { latency_ms?: unknown }).latency_ms
  return typeof latencyMs === "number" && Number.isFinite(latencyMs) ? latencyMs : null
}

function summarizeAgentV2ProductionTraceTiming(
  trace: Awaited<ReturnType<typeof runAgentV2ResponsesTurn>>["trace"],
): AgentV2ProductionTraceTiming {
  return {
    modelMs: sumFiniteLatencies(trace.model_steps.map(readAgentV2ModelStepLatencyMs)),
    toolMs: sumFiniteLatencies(trace.tool_calls.map((call) => call.latency_ms)),
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

function projectRecentMessages(messages: Message[]): RecentConversationMessage[] {
  return messages.flatMap((message): RecentConversationMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return []
    const content = message.content?.trim()
    return content ? [{ role: message.role, content }] : []
  })
}

function promptRef(name: string): LangfusePromptReference {
  return {
    name,
    version: null,
    label: "code",
    is_fallback: true,
  }
}

function buildAgentV2PromptSnapshot(params: {
  message: string
  recentMessages: RecentConversationMessage[]
  model: string
}): ChatPromptSnapshot {
  const recentMessageRoles = params.recentMessages.slice(-4).map((message) => message.role)

  return {
    kind: "agent_v2_responses",
    model: params.model,
    temperature: 0,
    prompt_ref: promptRef("agent-v2-responses-care-balance"),
    system_prompt: "agent_v2_responses_care_balance",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          latest_user_message_chars: params.message.length,
          recent_message_count: params.recentMessages.length,
          recent_message_roles: recentMessageRoles,
          engine: "agent_v2_care_balance",
        }),
      },
    ],
  }
}

function buildAgentV2CareBalanceContext(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
) {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(profile, routineItems)
  const rowsWithActions = runtime.careBalance.rows.filter(
    (row) => row.recommendation !== "no_action",
  )
  return buildCareBalanceToolContext({
    runtime,
    rows: rowsWithActions.length > 0 ? rowsWithActions : runtime.careBalance.rows,
  })
}

function readAgentV2EffectiveCareContext(
  input: Record<string, unknown>,
): EffectiveCareContext | null {
  const value = input.effective_care_context
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const normalized = (value as { normalized?: unknown }).normalized
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return null
  const routineInventory = (normalized as { routineInventory?: unknown }).routineInventory
  if (
    !routineInventory ||
    typeof routineInventory !== "object" ||
    Array.isArray(routineInventory)
  ) {
    return null
  }
  return value as EffectiveCareContext
}

function createEmptyAgentV2HairProfile(): HairProfile {
  return {
    id: "",
    user_id: "",
    hair_texture: null,
    thickness: null,
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: [],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "",
    updated_at: "",
  }
}

function buildAgentV2EffectiveHairProfile(
  fallback: HairProfile | null,
  effectiveContext: EffectiveCareContext | null,
): HairProfile | null {
  if (!effectiveContext) return fallback

  const profile = effectiveContext.normalized
  return {
    ...(fallback ?? createEmptyAgentV2HairProfile()),
    hair_texture: profile.hairTexture,
    thickness: profile.thickness,
    density: profile.density,
    concerns: [...profile.concerns],
    wash_frequency: profile.washFrequency,
    heat_styling: profile.heatStyling,
    styling_tools: profile.stylingTools ? [...profile.stylingTools] : null,
    goals: [...profile.goals],
    cuticle_condition: profile.cuticleCondition,
    protein_moisture_balance: profile.proteinMoistureBalance,
    scalp_type: profile.scalpType,
    scalp_condition: profile.scalpCondition,
    chemical_treatment: [...profile.chemicalTreatment],
    current_routine_products: Object.values(profile.routineInventory).flatMap((item) =>
      item?.present === true && ROUTINE_PRODUCT_CATEGORY_VALUES.has(item.category as RoutineProduct)
        ? [item.category as RoutineProduct]
        : [],
    ),
    towel_material: profile.towelMaterial,
    towel_technique: profile.towelTechnique,
    drying_method: profile.dryingMethod,
    brush_type: profile.brushType,
    night_protection: profile.nightProtection ? [...profile.nightProtection] : null,
    uses_heat_protection: profile.usesHeatProtection,
  }
}

function buildAgentV2EffectiveRoutineItems(
  fallback: PersistenceRoutineItemRow[],
  effectiveContext: EffectiveCareContext | null,
): PersistenceRoutineItemRow[] {
  if (!effectiveContext) return fallback

  return Object.values(effectiveContext.normalized.routineInventory).flatMap((item) =>
    item?.present === true
      ? [
          {
            category: item.category,
            product_name: item.productName,
            frequency_range: item.frequencyBand,
          },
        ]
      : [],
  )
}

function buildConversationStateTransition(params: {
  previousState: AgentV2ConversationStateV2
  answer: AgentV2TerminalAnswer
  classification: ClassificationResult
  routineThreadContext: AgentV2RoutineThreadContext
  priorSelectedProductProjections: readonly AgentV2StoredProductProjection[]
  acceptedSessionMemoryWrites: readonly AgentV2SessionMemoryWrite[]
}): AgentV2ConversationStateTransition {
  const previousState = params.previousState
  const nextState: AgentV2ConversationStateV2 = {
    ...previousState,
    version: 2,
    engine: AGENT_V2_PRODUCTION_ENGINE,
    agent_v2: {
      routine_thread_context: params.routineThreadContext,
      prior_selected_product_projections: [...params.priorSelectedProductProjections],
      session_memory: mergeAgentV2SessionMemory({
        previous: previousState.agent_v2.session_memory,
        accepted: params.acceptedSessionMemoryWrites,
      }),
    },
  }

  return {
    previous_state: previousState,
    next_state: nextState,
    reason: "agent_v2_care_balance_answer",
    changed_fields: Object.keys(nextState).filter(
      (key) =>
        previousState[key as keyof AgentV2ConversationStateV2] !==
        nextState[key as keyof AgentV2ConversationStateV2],
    ),
    classifier_override: null,
    updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
  }
}

export function classifyAgentV2ProductionSafetyMode(message: string): AgentV2SafetyMode {
  const normalized = message.toLocaleLowerCase("de-DE")

  if (
    /\b(blutet|bluten|wunde|wunden|offene kopfhaut|brennt stark|verbrennung|eiter|infektion)\b/.test(
      normalized,
    ) ||
    /haare?\s+fall(?:en|t).*(?:b(?:ue|ü)scheln|b(?:ue|ü)schelweise)/.test(normalized) ||
    /\b(pl[oö]tzlich(?:er|e|es)?\s+haarausfall|verschreibungspflichtig|rezeptpflichtig)\b/.test(
      normalized,
    ) ||
    /\b(verliere|verlierst|verliert|haarausfall)\b.{0,120}\b(extrem|sehr|viele?|wochen|nicht besser)\b/.test(
      normalized,
    ) ||
    /\b(extrem|sehr|viele?|wochen)\b.{0,120}\b(haare?|haarausfall)\b/.test(normalized)
  ) {
    return "hard_short_circuit"
  }

  const hasItchWithForegroundSymptom =
    /\bjuck(?:t|en|reiz)\b/.test(normalized) &&
    /\b(ger[oö]tet|rot|r[oö]tlich|brennt|brennen|wund|schmerzt|schmerzen|n[aä]sst|n[aä]ssen|ausschlag|offene stelle|offene stellen|schuppen|schuppt|schupp(?:ig|ige|iger|iges|enden?))\b/.test(
      normalized,
    )
  const hasForegroundSymptom =
    /\b(schmerzt|schmerzen|n[aä]sst|n[aä]ssen|ausschlag|offene stelle|offene stellen)\b/.test(
      normalized,
    ) ||
    /\bkopfhaut\b.*\bbrennt\b/.test(normalized) ||
    /\bbrennt\b.*\bkopfhaut\b/.test(normalized)
  const hasHairLossRedFlag =
    /\b(haarausfall|haarverlust|kahle stelle|kahle stellen|kreisrund(?:er|e|es)? haarausfall|postpartum|schwangerschaft)\b/.test(
      normalized,
    )

  if (hasItchWithForegroundSymptom || hasForegroundSymptom || hasHairLossRedFlag) {
    return "restricted"
  }

  return "normal"
}

function buildRoutineThreadContextFromConversationState(
  state: AgentV2ConversationStateV2,
): AgentV2RoutineThreadContext | null {
  return state.agent_v2.routine_thread_context
}

export async function runAgentV2ProductionPipeline(
  params: PipelineParams,
  deps: ProductionAgentV2PipelineDeps = {},
): Promise<PipelineResult> {
  const { message, userId, conversationId, requestId } = params
  if (!conversationId) {
    throw new Error("AgentV2 production chat requires a conversation id before orchestration.")
  }

  const startedAt = new Date().toISOString()
  const [
    { result: conversationHistory, durationMs: historyLoadMs },
    { result: userContext, durationMs: contextLoadMs },
    { result: memoryContext, durationMs: memoryLoadMs },
    { result: rawConversationState },
  ] = await Promise.all([
    measureAsync(() =>
      (deps.loadConversationHistory ?? loadAgentV2ProductionConversationHistory)(conversationId),
    ),
    measureAsync(() => (deps.getUserContext ?? getUserContext)(userId)),
    measureAsync(() => (deps.loadUserMemoryContext ?? loadUserMemoryContext)(userId)),
    measureAsync(() =>
      deps.loadConversationState
        ? deps.loadConversationState(conversationId)
        : loadPersistedConversationState(createAdminClient(), conversationId),
    ),
  ])

  const conversationState = normalizeAgentV2ConversationState(rawConversationState)
  const recentMessages = projectRecentMessages(conversationHistory)
  const careBalanceContext = buildAgentV2CareBalanceContext(
    userContext.profile,
    userContext.routine_inventory,
  )
  const selectedProductResults: SelectProductsToolResult[] = []
  const selectedProductProjections: ReturnType<typeof projectSelectProductsForAgentV2>[] = []
  let latestSelectProductsResult: SelectProductsToolResult | null = null
  let latestRoutineProjection: AgentV2RoutineProjection | null = null
  const selectProducts = (deps.createSelectProductsTool ?? createSelectProductsTool)({
    onResult: (result) => {
      latestSelectProductsResult = result
      selectedProductResults.push(result)
    },
  })
  const buildRoutine = (deps.createBuildOrFixRoutineTool ?? createBuildOrFixRoutineTool)()
  const routineThreadContext = buildRoutineThreadContextFromConversationState(conversationState)
  const priorSelectedProductProjections =
    conversationState.agent_v2.prior_selected_product_projections
  const sessionMemory = conversationState.agent_v2.session_memory
  const runTurn = deps.runAgentV2ResponsesTurn ?? runAgentV2ResponsesTurn
  const agentStart = performance.now()

  const result = await runTurn({
    client: deps.client ?? (getOpenAI() as unknown as AgentV2ResponsesClient),
    message,
    recentMessages,
    userContext: {
      hairProfile: userContext.profile,
      routineInventory: userContext.routine_inventory,
      derivedSignals: userContext.derived_signals,
      relevantMemory: userContext.relevant_memory,
      missingProfile: userContext.missing_profile,
      sessionMemory,
      careBalanceContext,
    },
    currentRoutineLayer: routineThreadContext?.active ? routineThreadContext.current_layer : null,
    routineThreadContext,
    priorSelectedProductProjections,
    safetyMode: classifyAgentV2ProductionSafetyMode(message),
    langfuseMode: "enabled",
    tools: {
      load_advisor_guidance: async (input) => loadAgentV2AdvisorGuidance(input),
      select_products: async (input, executionContext?: AgentV2RuntimeToolExecutionContext) => {
        latestSelectProductsResult = null
        const effectiveCareContext =
          executionContext?.effectiveCareContext ?? readAgentV2EffectiveCareContext(input)
        const effectiveHairProfile = buildAgentV2EffectiveHairProfile(
          userContext.profile,
          effectiveCareContext,
        )
        const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
          userContext.routine_inventory,
          effectiveCareContext,
        )
        const productToolMessage = buildAgentV2ProductToolMessage({
          latestMessage: message,
          recentMessages,
        })
        const projection = await selectProducts({
          category: input.category as Parameters<typeof selectProducts>[0]["category"],
          message: productToolMessage,
          hairProfile: effectiveHairProfile,
          memoryContext,
          routineItems: effectiveRoutineItems,
          effectiveCareContext,
        })
        const rawResult =
          latestSelectProductsResult ??
          ({
            projection,
            products: [],
            effectiveHairProfile,
            runtime: {} as SelectProductsToolResult["runtime"],
          } satisfies SelectProductsToolResult)
        const agentProjection = projectSelectProductsForAgentV2(rawResult, {
          includeCareBalanceContext: true,
        })
        selectedProductProjections.push(agentProjection)
        return agentProjection
      },
      build_or_fix_routine: async (
        input,
        executionContext?: AgentV2RuntimeToolExecutionContext,
      ) => {
        const effectiveCareContext =
          executionContext?.effectiveCareContext ?? readAgentV2EffectiveCareContext(input)
        const effectiveHairProfile = buildAgentV2EffectiveHairProfile(
          userContext.profile,
          effectiveCareContext,
        )
        const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
          userContext.routine_inventory,
          effectiveCareContext,
        )
        const mutationKind = typeof input.mutation_kind === "string" ? input.mutation_kind : null
        const projection = await buildRoutine({
          objective:
            input.objective === "build_routine" || input.objective === "fix_routine"
              ? input.objective
              : "build_routine",
          message,
          hairProfile: effectiveHairProfile,
          layer: input.requested_layer as Parameters<typeof buildRoutine>[0]["layer"],
          requestedCategory: input.requested_category as Parameters<
            typeof buildRoutine
          >[0]["requestedCategory"],
          mutationKind: mutationKind as Parameters<typeof buildRoutine>[0]["mutationKind"],
          routineItems: effectiveRoutineItems,
          effectiveCareContext,
        })
        const agentProjection = projectRoutineForAgentV2(projection, {
          requestedLayer: input.requested_layer as AgentV2RoutineLayer,
          includeCareBalanceContext: true,
        })
        latestRoutineProjection = agentProjection
        return agentProjection
      },
    },
  })
  const agentMs = Math.round(performance.now() - agentStart)
  const agentTiming = summarizeAgentV2ProductionTraceTiming(result.trace)

  const answer = result.final_answer
  const visibleFailure = result.trace.failure_stage !== null
  const intent = deriveIntent(answer)
  const productCategory = visibleFailure ? null : deriveProductCategory(answer)
  const routerDecision = buildAgentV2RouterDecision({ answer, visibleFailure })
  const classification = buildAgentV2Classification({
    answer,
    intent,
    productCategory,
    routerDecision,
  })
  const matchedProducts = visibleFailure
    ? []
    : deriveMatchedProducts({ answer, selectedProductResults })
  const { categoryDecision, engineTrace } = deriveEngineArtifacts(latestSelectProductsResult)
  const exposedCategoryDecision = visibleFailure ? undefined : categoryDecision
  const exposedEngineTrace = visibleFailure ? undefined : engineTrace
  const attachmentMode = matchedProducts.length > 0 ? "cards" : "text_only"
  const prompt = buildAgentV2PromptSnapshot({
    message,
    recentMessages,
    model: result.trace.model,
  })
  const visibleRoutineSteps = buildRoutineThreadVisibleSteps(
    latestRoutineProjection as AgentV2RoutineProjection | null,
  )
  const nextRoutineThreadContext = updateAgentV2ProductionRoutineThreadContext({
    previous: routineThreadContext,
    answer,
    message,
    routineProjection: latestRoutineProjection,
    visibleFailure,
  })
  const nextPriorSelectedProductProjections = visibleFailure
    ? priorSelectedProductProjections
    : mergePriorSelectedProductProjections({
        previous: priorSelectedProductProjections,
        next: collectTrustedSurfacedProductProjections({
          projections: selectedProductProjections,
          answer,
        }),
      })
  const persistedVisibleRoutineSteps =
    nextRoutineThreadContext.visible_steps.length > 0
      ? nextRoutineThreadContext.visible_steps
      : visibleRoutineSteps
  const conversationStateTransition = buildConversationStateTransition({
    previousState: conversationState,
    answer,
    classification,
    routineThreadContext: {
      ...nextRoutineThreadContext,
      visible_steps: persistedVisibleRoutineSteps,
    },
    priorSelectedProductProjections: nextPriorSelectedProductProjections,
    acceptedSessionMemoryWrites: result.accepted_session_memory_writes,
  })
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: `[agent_v2_user_message chars=${message.length}]`,
    conversation_id: conversationId,
    intent,
    product_category: productCategory,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    conversation_state: conversationStateTransition,
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
    should_plan_routine: answer.answer_mode === "routine",
    category_decision: exposedCategoryDecision,
    engine_trace: exposedEngineTrace,
    matched_products: matchedProducts,
    classification_prompt_ref: promptRef("agent-v2-responses-care-balance"),
    prompt,
    response_composition: {
      path: "agent_v2_responses",
      migration_mode: "agent_v2_care_balance",
      fallback_reason: null,
      rendering_path: null,
      plan_type: answer.answer_mode,
      attachment_mode: attachmentMode,
    },
    engine_variant: "agent_v2_care_balance",
    agent_v2_trace: {
      ...result.trace,
      routine_thread_context: {
        ...nextRoutineThreadContext,
        visible_steps: persistedVisibleRoutineSteps,
      },
    },
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
      agent_runtime_ms: agentMs,
      agent_model_ms: agentTiming.modelMs,
      agent_tool_ms: agentTiming.toolMs,
    },
  })

  return {
    stream: createTextStream(String(answer.payload.user_facing_answer_de ?? "")),
    conversationId,
    intent,
    matchedProducts,
    sources: [],
    conversationStateTransition,
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
