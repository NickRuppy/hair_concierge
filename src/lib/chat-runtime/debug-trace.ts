import type {
  AgenticBlockedToolCall as RuntimeAgenticBlockedToolCall,
  AgenticExecutedToolCall as RuntimeAgenticExecutedToolCall,
  AgenticToolLoopModelStep as RuntimeAgenticToolLoopModelStep,
  AgenticToolLoopTrace as RuntimeAgenticToolLoopTrace,
} from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import type { AgentV2Trace } from "@/lib/agent-v2/contracts"
import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import type {
  ChatCategoryDecision,
  ChatMatchedProductTrace,
  ChatPromptSnapshot,
  ChatRetrievedChunkTrace,
  ChatTraceLatencyBreakdown,
  ChatTurnTrace,
  ConversationStatePersistenceTrace,
  ConversationTurnStateTransition,
  CitationSource,
  ClassificationResult,
  ContentChunk,
  HairProfile,
  LangfusePromptReference,
  Product,
  ProductCategory,
  RecommendationEngineTrace,
  ResponseCompositionTrace,
  RoutinePlan,
  RouterDecision,
} from "@/lib/types"
import { summarizeAgentV2ConversationState } from "@/lib/agent-v2/production/persisted-session-state"

const CHAT_TURN_TRACE_VERSION = 2
const CONTENT_PREVIEW_LIMIT = 240
const SUMMARY_ITEM_LIMIT = 3

type AppAgenticToolLoopTrace = NonNullable<ChatTurnTrace["agentic_tool_loop"]>

export interface RetrievedChunk extends ContentChunk {
  similarity: number
  weighted_similarity: number
  retrieval_path?: "dense" | "lexical" | "hybrid"
  dense_score?: number
  lexical_score?: number
  fused_score?: number
}

export interface RetrieveContextDebug {
  subqueries: string[]
  source_types: string[] | null
  metadata_filter: Record<string, string> | null
  candidate_count_before_rerank: number
  reranked_count: number
  fallback_used: boolean
}

export interface PipelineTraceDraft {
  request_id: string
  started_at: string
  user_message: string
  conversation_id: string | null
  intent: ChatTurnTrace["intent"]
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  conversation_state: ConversationTurnStateTransition
  clarification_questions: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval: ChatTurnTrace["retrieval"]
  decision_context: {
    should_plan_routine: boolean
    routine_plan: RoutinePlan | null
    category_decision: ChatCategoryDecision | null
    engine_trace: RecommendationEngineTrace | null
    matched_products: ChatMatchedProductTrace[]
  }
  prompt_refs: {
    classification: LangfusePromptReference
    synthesis: LangfusePromptReference
  }
  prompt: ChatPromptSnapshot
  response_composition: ResponseCompositionTrace
  engine_variant?: ChatTurnTrace["engine_variant"]
  agentic_tool_loop?: ChatTurnTrace["agentic_tool_loop"]
  agent_v2_trace?: AgentV2Trace | null
  latencies_ms: ChatTraceLatencyBreakdown
}

const DEFAULT_CONVERSATION_STATE_PERSISTENCE: ConversationStatePersistenceTrace = {
  status: "skipped",
  error: null,
}

function toContentPreview(content: string): string {
  return content.length > CONTENT_PREVIEW_LIMIT
    ? `${content.slice(0, CONTENT_PREVIEW_LIMIT)}...`
    : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compactStringValues(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)),
  )
}

function compactRecordIds(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .map((value) => {
          if (typeof value === "string") return value.trim()
          if (isRecord(value) && typeof value.id === "string") return value.id.trim()
          if (isRecord(value) && typeof value.guidance_id === "string") {
            return value.guidance_id.trim()
          }
          return ""
        })
        .filter(Boolean),
    ),
  )
}

function summarizeAgentV2TransitionState(
  transition: ConversationTurnStateTransition,
): Record<string, unknown> | null {
  const nextState = transition.next_state
  if (
    !isRecord(nextState) ||
    nextState.version !== 2 ||
    nextState.engine !== "agent_v2_care_balance"
  ) {
    return null
  }

  return {
    ...summarizeAgentV2ConversationState(
      nextState as Parameters<typeof summarizeAgentV2ConversationState>[0],
    ),
    changed_fields: transition.changed_fields,
  }
}

function summarizeInput(input: Record<string, unknown>): string | null {
  const parts: string[] = []

  for (const key of ["category", "intent", "objective", "layer", "requestedCategory"]) {
    const value = input[key]
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`${key}=${value.trim()}`)
    }
  }

  for (const key of ["categories", "profileFocus"]) {
    const value = input[key]
    if (Array.isArray(value)) {
      parts.push(`${key}_count=${value.length}`)
    }
  }

  const keys = Object.keys(input).sort()
  if (keys.length > 0) {
    parts.push(`input_keys=${keys.slice(0, SUMMARY_ITEM_LIMIT).join(", ")}`)
  }

  return parts.length > 0 ? toContentPreview(parts.join("; ")) : null
}

function getProjectionRecord(output: unknown): Record<string, unknown> | null {
  if (!isRecord(output)) return null

  return isRecord(output.projection) ? output.projection : output
}

function hasAnyKey(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => key in record)
}

function readSummaryString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readSummaryArrayLength(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return Array.isArray(value) ? value.length : 0
}

function summarizeGuidanceOutput(
  call: RuntimeAgenticExecutedToolCall,
  fallbackGuidanceIds: string[],
): string {
  const projection = getProjectionRecord(call.output)
  const outputGuidanceIds = projection ? compactStringValues(projection.loaded_guidance_ids) : []
  const guidanceIds = outputGuidanceIds.length > 0 ? outputGuidanceIds : fallbackGuidanceIds

  return guidanceIds.length > 0
    ? toContentPreview(`guidance_ids=${guidanceIds.join(", ")}`)
    : "guidance_ids=0"
}

function summarizeSelectedProductsProjection(projection: Record<string, unknown>): string {
  return toContentPreview(
    [
      `category=${readSummaryString(projection, "category") ?? "unknown"}`,
      `decision=${readSummaryString(projection, "decision") ?? "unknown"}`,
      `policy=${readSummaryString(projection, "product_response_policy") ?? "unknown"}`,
      `products=${readSummaryArrayLength(projection, "products")}`,
      `missing_info=${readSummaryArrayLength(projection, "missing_info")}`,
    ].join("; "),
  )
}

function summarizeSelectedProductsOutput(params: {
  call: RuntimeAgenticExecutedToolCall
  selectedProducts: SelectedProductsProjection | null
}): string {
  const outputProjection = getProjectionRecord(params.call.output)
  if (
    outputProjection &&
    hasAnyKey(outputProjection, [
      "category",
      "decision",
      "product_response_policy",
      "products",
      "missing_info",
    ])
  ) {
    return summarizeSelectedProductsProjection(outputProjection)
  }

  return params.selectedProducts
    ? summarizeSelectedProductsProjection(
        params.selectedProducts as unknown as Record<string, unknown>,
      )
    : "products=0"
}

function summarizeRoutineProjection(projection: Record<string, unknown>): string {
  const steps = Array.isArray(projection.steps) ? projection.steps : []

  return toContentPreview(
    [
      `objective=${readSummaryString(projection, "objective") ?? "unknown"}`,
      `steps=${steps.length}`,
      `labels=${steps
        .map((step) => (isRecord(step) && typeof step.label === "string" ? step.label.trim() : ""))
        .filter(Boolean)
        .slice(0, SUMMARY_ITEM_LIMIT)
        .join(", ")}`,
      `missing_info=${readSummaryArrayLength(projection, "missing_info")}`,
    ].join("; "),
  )
}

function summarizeRoutineOutput(params: {
  call: RuntimeAgenticExecutedToolCall
  routinePlan: BuildOrFixRoutineProjection | null
}): string {
  const outputProjection = getProjectionRecord(params.call.output)
  if (outputProjection && hasAnyKey(outputProjection, ["objective", "steps", "missing_info"])) {
    return summarizeRoutineProjection(outputProjection)
  }

  return params.routinePlan
    ? summarizeRoutineProjection(params.routinePlan as unknown as Record<string, unknown>)
    : "steps=0"
}

function summarizeToolOutput(params: {
  call: RuntimeAgenticExecutedToolCall
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  loadedGuidanceIds: string[]
}): string | null {
  switch (params.call.name) {
    case "load_advisor_guidance":
      return summarizeGuidanceOutput(params.call, params.loadedGuidanceIds)
    case "select_products":
      return summarizeSelectedProductsOutput({
        call: params.call,
        selectedProducts: params.selectedProducts,
      })
    case "build_or_fix_routine":
      return summarizeRoutineOutput({
        call: params.call,
        routinePlan: params.routinePlan,
      })
  }
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === "string" ? value : null
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function projectModelStep(
  step: RuntimeAgenticToolLoopModelStep,
  index: number,
): AppAgenticToolLoopTrace["model_steps"][number] {
  const record = isRecord(step) ? step : {}
  const status = readOptionalString(record, "status")
  const toolCallNames =
    step.type === "tool_calls" ? step.calls.map((call) => call.name).filter(Boolean) : []

  return {
    step_index: index + 1,
    type: step.type,
    finish_reason: readOptionalString(record, "finish_reason"),
    ...(status ? { status } : {}),
    tool_call_names: toolCallNames,
  }
}

function projectToolCall(params: {
  call: RuntimeAgenticExecutedToolCall
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  loadedGuidanceIds: string[]
}): AppAgenticToolLoopTrace["tool_calls"][number] {
  const record = params.call as unknown as Record<string, unknown>
  const latencyMs = readOptionalNumber(record, "latency_ms")

  return {
    id: params.call.id,
    name: params.call.name,
    status: "executed",
    ...(latencyMs !== null ? { latency_ms: latencyMs } : {}),
    input_summary: summarizeInput(params.call.input),
    output_summary: summarizeToolOutput(params),
  }
}

function projectBlockedToolCall(
  call: RuntimeAgenticBlockedToolCall,
): AppAgenticToolLoopTrace["blocked_tool_calls"][number] {
  return {
    id: call.id,
    name: call.name,
    reason: call.reason,
  }
}

function extractAnswerContextCapsuleIds(runtimeTrace: RuntimeAgenticToolLoopTrace): string[] {
  const answerContext = runtimeTrace.answer_context
  if (!isRecord(answerContext)) return []

  return Array.from(
    new Set([
      ...compactStringValues(answerContext.capsule_ids),
      ...compactStringValues(answerContext.capsuleIds),
      ...compactStringValues(answerContext.ids),
      ...compactRecordIds(answerContext.capsules),
    ]),
  )
}

function summarizeConsultationBrief(
  runtimeTrace: RuntimeAgenticToolLoopTrace,
): Record<string, unknown> | null {
  const brief = runtimeTrace.consultation_brief
  if (!brief) return null

  return {
    charter_count: brief.charter.length,
    routine_staging_count: brief.routine_staging.length,
    product_vs_education_count: brief.product_vs_education.length,
    profile_overlay_ids: compactRecordIds(brief.profile_overlays),
    candidate_guidance_ids: compactRecordIds(brief.candidate_guidance),
  }
}

export function projectAgenticToolLoopTraceForApp(params: {
  runtimeTrace: RuntimeAgenticToolLoopTrace
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  latencyMs: number
}): AppAgenticToolLoopTrace {
  const loadedGuidanceIds =
    params.runtimeTrace.advisor_guidance?.loaded_guidance_ids.map((id) => String(id)) ?? []

  return {
    engine_variant: "tool_loop",
    answer_composition_mode: params.runtimeTrace.answer_composition_mode,
    loaded_guidance_ids: loadedGuidanceIds,
    answer_context_capsule_ids: extractAnswerContextCapsuleIds(params.runtimeTrace),
    consultation_brief_summary: summarizeConsultationBrief(params.runtimeTrace),
    repair_attempts: params.runtimeTrace.repair_attempts.map((attempt) => ({
      reason: attempt.reason,
      instruction_label: attempt.instruction_label,
    })),
    failure_stage: params.runtimeTrace.failure_stage,
    visible_failure: params.runtimeTrace.visible_failure,
    model_steps: params.runtimeTrace.model_steps.map(projectModelStep),
    tool_calls: params.runtimeTrace.tool_calls.map((call) =>
      projectToolCall({
        call,
        selectedProducts: params.selectedProducts,
        routinePlan: params.routinePlan,
        loadedGuidanceIds,
      }),
    ),
    blocked_tool_calls: params.runtimeTrace.blocked_tool_calls.map(projectBlockedToolCall),
    guardrails: params.runtimeTrace.guardrails,
    latency_ms: params.latencyMs,
    token_usage: null,
  }
}

export function buildRetrievedChunkTrace(chunks: RetrievedChunk[]): ChatRetrievedChunkTrace[] {
  return chunks.map((chunk) => ({
    chunk_id: chunk.id,
    source_type: chunk.source_type,
    source_name: chunk.source_name,
    retrieval_path: chunk.retrieval_path,
    weighted_similarity: chunk.weighted_similarity,
    similarity: chunk.similarity,
    dense_score: chunk.dense_score,
    lexical_score: chunk.lexical_score,
    fused_score: chunk.fused_score,
    content_preview: toContentPreview(chunk.content),
  }))
}

export function buildMatchedProductTrace(products: Product[]): ChatMatchedProductTrace[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    score: product.recommendation_meta?.score ?? null,
    top_reasons: product.recommendation_meta?.top_reasons ?? [],
    tradeoffs: product.recommendation_meta?.tradeoffs ?? [],
    usage_hint: product.recommendation_meta?.usage_hint ?? null,
    recommendation_meta: product.recommendation_meta ?? null,
  }))
}

function compactList(values: string[] | null | undefined): string[] {
  return (values ?? []).filter(Boolean).slice(0, SUMMARY_ITEM_LIMIT)
}

export function summarizeEngineTraceForLangfuse(
  trace: RecommendationEngineTrace | null | undefined,
): Record<string, unknown> | null {
  if (!trace) return null

  const relevant_categories = Object.values(trace.categories)
    .filter((decision) => decision.relevant)
    .map((decision) => ({
      category: decision.category,
      action: decision.action,
      plan_reason_codes: compactList(decision.planReasonCodes),
      has_current_inventory: Boolean(decision.currentInventory),
      has_target_profile: Boolean(decision.targetProfile),
    }))

  return {
    requested_category: trace.request_context.requestedCategory,
    damage: {
      overall_level: trace.damage.overallLevel,
      structural_level: trace.damage.structuralLevel,
      repair_priority: trace.damage.repairPriority,
      confidence: trace.damage.confidence,
      active_damage_driver_count: trace.damage.activeDamageDrivers.length,
      missing_input_count: trace.damage.missingInputs.length,
    },
    care_needs: trace.care_needs,
    intervention: {
      steps: trace.intervention_plan.steps.map((step) => ({
        category: step.category,
        action: step.action,
        reason_codes: compactList(step.reasonCodes),
      })),
      deferred_step_count: trace.intervention_plan.deferredSteps.length,
    },
    care_balance: {
      rows: trace.care_balance.rows.map((row) => ({
        category: row.category,
        recommendation: row.recommendation,
        primary_status: row.primaryStatus,
        reason_codes: compactList(row.decisiveReasonCodes),
      })),
      legacy_difference_count: trace.legacy_plan_comparison?.differences.length ?? 0,
    },
    relevant_categories,
    unsupported_routine_categories: compactList(trace.unsupported_routine_categories),
  }
}

export function summarizeProductsForLangfuse(
  products: ChatMatchedProductTrace[],
): Array<Record<string, unknown>> {
  return products.slice(0, SUMMARY_ITEM_LIMIT).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    score: product.score,
    top_reasons: compactList(product.top_reasons),
    tradeoffs: compactList(product.tradeoffs),
    has_usage_hint: Boolean(product.usage_hint),
  }))
}

export function buildPipelineTraceDraft(params: {
  request_id: string
  started_at: string
  user_message: string
  conversation_id: string | null
  intent: ChatTurnTrace["intent"]
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  conversation_state: ConversationTurnStateTransition
  clarification_questions?: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval_debug: RetrieveContextDebug
  retrieval_count: number
  retrieved_chunks: RetrievedChunk[]
  should_plan_routine: boolean
  routine_plan?: RoutinePlan
  category_decision?: ChatCategoryDecision
  engine_trace?: RecommendationEngineTrace | null
  matched_products?: Product[]
  classification_prompt_ref: LangfusePromptReference
  prompt: ChatPromptSnapshot
  response_composition: ResponseCompositionTrace
  engine_variant?: ChatTurnTrace["engine_variant"]
  agentic_tool_loop?: ChatTurnTrace["agentic_tool_loop"]
  agent_v2_trace?: AgentV2Trace | null
  latencies_ms: ChatTraceLatencyBreakdown
}): PipelineTraceDraft {
  const {
    request_id,
    started_at,
    user_message,
    conversation_id,
    intent,
    product_category,
    conversation_history_count,
    classification,
    router_decision,
    conversation_state,
    clarification_questions,
    hair_profile_snapshot,
    memory_context,
    retrieval_debug,
    retrieval_count,
    retrieved_chunks,
    should_plan_routine,
    routine_plan,
    category_decision,
    engine_trace,
    matched_products,
    classification_prompt_ref,
    prompt,
    response_composition,
    engine_variant,
    agentic_tool_loop,
    agent_v2_trace,
    latencies_ms,
  } = params
  const resolvedEngineVariant: ChatTurnTrace["engine_variant"] = agentic_tool_loop
    ? "tool_loop"
    : engine_variant

  return {
    request_id,
    started_at,
    user_message,
    conversation_id,
    intent,
    product_category,
    conversation_history_count,
    classification,
    router_decision,
    conversation_state,
    clarification_questions: clarification_questions ?? [],
    hair_profile_snapshot,
    memory_context,
    retrieval: {
      requested_count: retrieval_count,
      source_types: retrieval_debug.source_types,
      metadata_filter: retrieval_debug.metadata_filter,
      subqueries: retrieval_debug.subqueries,
      candidate_count_before_rerank: retrieval_debug.candidate_count_before_rerank,
      reranked_count: retrieval_debug.reranked_count,
      fallback_used: retrieval_debug.fallback_used,
      final_context_count: retrieved_chunks.length,
      chunks: buildRetrievedChunkTrace(retrieved_chunks),
    },
    decision_context: {
      should_plan_routine,
      routine_plan: routine_plan ?? null,
      category_decision: category_decision ?? null,
      engine_trace: engine_trace ?? null,
      matched_products: buildMatchedProductTrace(matched_products ?? []),
    },
    prompt_refs: {
      classification: classification_prompt_ref,
      synthesis: prompt.prompt_ref,
    },
    prompt,
    response_composition,
    engine_variant: resolvedEngineVariant,
    agentic_tool_loop,
    agent_v2_trace: agent_v2_trace ?? null,
    latencies_ms,
  }
}

export function finalizeChatTurnTrace(
  draft: PipelineTraceDraft,
  params: {
    assistant_content: string
    sources: CitationSource[]
    product_count: number
    status: ChatTurnTrace["status"]
    error?: string | null
    completed_at?: string
    stream_read_ms?: number
    total_ms?: number
    conversation_state_persistence?: ConversationStatePersistenceTrace
  },
): ChatTurnTrace {
  const {
    assistant_content,
    sources,
    product_count,
    status,
    error,
    completed_at,
    stream_read_ms,
    total_ms,
    conversation_state_persistence,
  } = params

  return {
    trace_version: CHAT_TURN_TRACE_VERSION,
    request_id: draft.request_id,
    started_at: draft.started_at,
    completed_at: completed_at ?? new Date().toISOString(),
    status,
    user_message: draft.user_message,
    conversation_id: draft.conversation_id,
    intent: draft.intent,
    product_category: draft.product_category,
    conversation_history_count: draft.conversation_history_count,
    classification: draft.classification,
    router_decision: draft.router_decision,
    conversation_state: draft.conversation_state,
    conversation_state_persistence:
      conversation_state_persistence ?? DEFAULT_CONVERSATION_STATE_PERSISTENCE,
    clarification_questions: draft.clarification_questions,
    hair_profile_snapshot: draft.hair_profile_snapshot,
    memory_context: draft.memory_context,
    retrieval: draft.retrieval,
    decision_context: draft.decision_context,
    prompt_refs: draft.prompt_refs,
    prompt: draft.prompt,
    response_composition: draft.response_composition,
    ...(draft.engine_variant ? { engine_variant: draft.engine_variant } : {}),
    ...(draft.agentic_tool_loop ? { agentic_tool_loop: draft.agentic_tool_loop } : {}),
    ...(draft.agent_v2_trace ? { agent_v2_trace: draft.agent_v2_trace } : {}),
    response: {
      assistant_content,
      sources,
      product_count,
    },
    latencies_ms: {
      ...draft.latencies_ms,
      ...(stream_read_ms !== undefined ? { stream_read_ms } : {}),
      ...(total_ms !== undefined ? { total_ms } : {}),
    },
    error: error ?? null,
  }
}

export function buildRetrievalDebugEventData(draft: PipelineTraceDraft): Record<string, unknown> {
  const toolLoopTrace = draft.agentic_tool_loop ?? null
  const agentV2VisibleFailure = Boolean(draft.agent_v2_trace?.failure_stage)
  const engineVariant = toolLoopTrace ? "tool_loop" : (draft.engine_variant ?? null)

  return {
    request_id: draft.request_id,
    intent: draft.intent,
    product_category: draft.product_category,
    retrieval_mode: draft.router_decision.retrieval_mode,
    response_mode: draft.router_decision.response_mode,
    response_composer_path: draft.response_composition.path,
    engine_variant: engineVariant,
    clarification_questions: draft.clarification_questions,
    policy_overrides: draft.router_decision.policy_overrides,
    subqueries: draft.retrieval.subqueries,
    metadata_filter: draft.retrieval.metadata_filter,
    final_context_count: draft.retrieval.final_context_count,
    matched_products: draft.decision_context.matched_products.map((product) => ({
      id: product.id,
      name: product.name,
      score: product.score,
    })),
    tool_loop_model_step_count: toolLoopTrace?.model_steps.length ?? null,
    tool_loop_total_llm_calls: toolLoopTrace?.model_steps.length ?? null,
    tool_loop_tool_calls: toolLoopTrace?.tool_calls.map((call) => call.name) ?? [],
    tool_loop_blocked_reasons: toolLoopTrace?.blocked_tool_calls.map((call) => call.reason) ?? [],
    loaded_guidance_ids: toolLoopTrace?.loaded_guidance_ids ?? [],
    agent_v2_loaded_guidance_ids: draft.agent_v2_trace?.loaded_guidance_package_ids ?? [],
    agent_v2_tool_calls: draft.agent_v2_trace?.tool_calls.map((call) => call.name) ?? [],
    agent_v2_blocked_reasons:
      draft.agent_v2_trace?.blocked_tool_calls.map((call) => call.reason) ?? [],
    agent_v2_failure_stage: draft.agent_v2_trace?.failure_stage ?? null,
    agent_v2_visible_failure: agentV2VisibleFailure,
    agent_v2_latency_ms: draft.agent_v2_trace
      ? {
          runtime: draft.latencies_ms.agent_runtime_ms ?? null,
          turn_gate: draft.latencies_ms.agent_turn_gate_ms ?? null,
          model: draft.latencies_ms.agent_model_ms ?? null,
          tools: draft.latencies_ms.agent_tool_ms ?? null,
          model_steps: draft.agent_v2_trace.model_steps.length,
          tool_calls: draft.agent_v2_trace.tool_calls.length,
        }
      : null,
    agent_v2_state: summarizeAgentV2TransitionState(draft.conversation_state),
    repair_count: toolLoopTrace?.repair_attempts.length ?? 0,
    failure_stage: toolLoopTrace?.failure_stage ?? null,
    visible_failure: toolLoopTrace?.visible_failure ?? agentV2VisibleFailure,
    agentic_tool_loop: toolLoopTrace
      ? {
          model_step_count: toolLoopTrace.model_steps.length,
          tool_call_count: toolLoopTrace.tool_calls.length,
          blocked_tool_call_count: toolLoopTrace.blocked_tool_calls.length,
          guardrails: toolLoopTrace.guardrails,
          latency_ms: toolLoopTrace.latency_ms ?? null,
          token_usage: toolLoopTrace.token_usage ?? null,
        }
      : null,
  }
}
