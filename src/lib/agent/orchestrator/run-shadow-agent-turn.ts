import type { AgentModelClient, AgentToolCallHistory } from "@/lib/agent/orchestrator/model-client"
import {
  AGENT_FINAL_RENDER_PROMPT,
  AGENT_ROUTE_CLASSIFIER_PROMPT,
} from "@/lib/agent/orchestrator/prompt"
import { type AgentToolName } from "@/lib/agent/orchestrator/tool-definitions"
import {
  buildAgentRoutePacket,
  buildAgentRuntimePacket,
  type AgentRuntimePacket,
  type AgentRoutePacket,
} from "@/lib/agent/orchestrator/route-packet"
import type { GuidanceLoadResult } from "@/lib/agent/contracts"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import { shouldApplyPendingRoutineAnswerOverride } from "@/lib/rag/conversation-state"
import type { ConversationState, RoutineLayer } from "@/lib/types"

function nextRuntimeToolId(toolCalls: AgentToolCallHistory[]): string {
  return `runtime-${toolCalls.length + 1}`
}

export function deriveRequestedGoal(message: string): "shine" | null {
  return /gl(?:a|ae|ä)nz|gloss|shine/i.test(message) ? "shine" : null
}

function hasFallbackCaveat(product: SelectedProductsProjection["products"][number]): boolean {
  return /^fallback:/i.test(product.caveat?.trim() ?? "")
}

function stripFallbackMarker(value: string | null): string | null {
  if (!value) return value

  const stripped = value.replace(/^fallback:\s*/i, "").trim()
  return stripped.length > 0 ? stripped : null
}

function sanitizeComparisonFactForRender(fact: string): string | null {
  if (/^fallback:\s*(?:ja|nein)?$/i.test(fact.trim())) {
    return null
  }

  return stripFallbackMarker(fact)
}

function sanitizeComparisonFactsForRender(
  comparisonFacts: SelectedProductsProjection["comparison_facts"],
): SelectedProductsProjection["comparison_facts"] {
  if (!comparisonFacts) {
    return null
  }

  const sanitized = Object.fromEntries(
    Object.entries(comparisonFacts)
      .map(([productId, facts]) => [
        productId,
        facts
          .map((fact) => sanitizeComparisonFactForRender(fact))
          .filter((fact): fact is string => Boolean(fact)),
      ])
      .filter(([, facts]) => facts.length > 0),
  )

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeSelectedProductsForRender(
  projection: SelectedProductsProjection,
): SelectedProductsProjection {
  return {
    ...projection,
    products: projection.products.map((product) => ({
      ...product,
      fit_reason: stripFallbackMarker(product.fit_reason) ?? product.fit_reason,
      caveat: stripFallbackMarker(product.caveat),
    })),
    comparison_facts: sanitizeComparisonFactsForRender(projection.comparison_facts),
  }
}

function filterComparisonFactsForProducts(
  comparisonFacts: SelectedProductsProjection["comparison_facts"],
  products: SelectedProductsProjection["products"],
): SelectedProductsProjection["comparison_facts"] {
  if (!comparisonFacts || products.length < 2) {
    return null
  }

  const productIds = new Set(products.map((product) => product.product_id))
  const filtered = Object.fromEntries(
    Object.entries(comparisonFacts).filter(([productId]) => productIds.has(productId)),
  )

  return Object.keys(filtered).length >= 2 ? filtered : null
}

function collectUnsupportedRequestedSignalsForProducts(
  products: SelectedProductsProjection["products"],
): SelectedProductsProjection["unsupported_requested_signals"] {
  const seen = new Set<string>()
  const result: SelectedProductsProjection["unsupported_requested_signals"] = []

  for (const product of products) {
    for (const signal of product.unsupported_requested_signals) {
      const key = `${signal.field}:${signal.value}:${signal.reason}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(signal)
    }
  }

  return result
}

function normalizeMessageForRoutinePolicy(message: string): string {
  return message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function hasExplicitProductAskSignal(message: string): boolean {
  const normalized = normalizeMessageForRoutinePolicy(message)

  return /\b(?:welch\w*|welc\w*|empfiehl\w*|empfehl\w*|konkret|produkt\w*|kaufen|nehmen|verwenden|benutzen|auswaehlen|waehlen|passt\s+am\s+besten|gutes?|beste[nsr]?)\b/.test(
    normalized,
  )
}

function shouldOverrideVagueRoutineCategoryFollowup(params: {
  state: ConversationState | null | undefined
  classification: Awaited<ReturnType<AgentModelClient["classifyRoute"]>>
  message: string
}): boolean {
  return Boolean(
    params.state?.active_topic === "routine" &&
    params.classification.product_category &&
    ["product_pick", "compare_or_decide", "usage", "troubleshoot"].includes(
      params.classification.user_job,
    ) &&
    !hasExplicitProductAskSignal(params.message),
  )
}

function shouldSelectRoutineLayerFromBasics(state: ConversationState | null | undefined): boolean {
  return Boolean(
    state?.active_topic === "routine" &&
    state.routine_layer === "basics" &&
    state.pending_offer === "routine_goals_or_problems" &&
    state.last_assistant_action === "answered_routine_basics",
  )
}

function hasRoutineGoalLayerSignal(message: string): boolean {
  const normalized = normalizeMessageForRoutinePolicy(message)

  return /\b(?:ziel|ziele|goal|goals|wunsch|wuensche|moechte|will|richtung|mehr volumen|volumen|glanz|definition|definier|weniger|reduzier|baendigen|wachstum)\b/.test(
    normalized,
  )
}

function hasRoutineProblemLayerSignal(message: string): boolean {
  const normalized = normalizeMessageForRoutinePolicy(message)

  return /\b(?:problem|probleme|concern|concerns|sorge|sorgen|thema|themen|fixen|loesen|verbessern|reparieren|angehen|frizz|trocken|spliss|bruch|kaputt|juck|schupp|fettig|kopfhaut|verknot|knoten)\b/.test(
    normalized,
  )
}

function deriveRoutineLayerForTurn(params: {
  state: ConversationState | null | undefined
  classification: Awaited<ReturnType<AgentModelClient["classifyRoute"]>>
  message: string
}): RoutineLayer | null {
  if (!shouldSelectRoutineLayerFromBasics(params.state)) {
    return null
  }

  if (hasRoutineGoalLayerSignal(params.message)) {
    return "goals"
  }

  if (hasRoutineProblemLayerSignal(params.message)) {
    return "problems"
  }

  return null
}

function buildEffectiveUserContextForRender(params: {
  userContext: UserContextProjection
  conversationState: ConversationState | null | undefined
  route: AgentRoutePacket
}): UserContextProjection {
  if (params.route.user_job !== "routine_structure" || !params.route.routine_layer) {
    return params.userContext
  }

  return {
    ...params.userContext,
    conversation_state: {
      ...(params.conversationState ?? {}),
      ...(typeof (params.userContext as { conversation_state?: unknown }).conversation_state ===
      "object"
        ? ((params.userContext as { conversation_state?: ConversationState }).conversation_state ??
          {})
        : {}),
      active_topic: "routine",
      routine_layer: params.route.routine_layer,
    },
  } as UserContextProjection
}

function prepareSelectedProductsForRender(
  projection: SelectedProductsProjection | null,
): SelectedProductsProjection | null {
  if (!projection || projection.products.length < 2) {
    return projection ? sanitizeSelectedProductsForRender(projection) : projection
  }

  if (projection.category === "leave_in") {
    return sanitizeSelectedProductsForRender(projection)
  }

  const primaryProducts = projection.products.filter((product) => !hasFallbackCaveat(product))
  if (primaryProducts.length === 0 || primaryProducts.length === projection.products.length) {
    return sanitizeSelectedProductsForRender(projection)
  }

  const products = primaryProducts.map((product, index) => ({
    ...product,
    rank: index + 1,
  }))

  return sanitizeSelectedProductsForRender({
    ...projection,
    products,
    comparison_facts: filterComparisonFactsForProducts(projection.comparison_facts, products),
    unsupported_requested_signals: collectUnsupportedRequestedSignalsForProducts(products),
  })
}

async function runRuntimeTool(params: {
  name: AgentToolName
  input: Record<string, unknown>
  tools: Record<AgentToolName, (input: Record<string, unknown>) => Promise<unknown>>
  toolCalls: AgentToolCallHistory[]
}): Promise<unknown> {
  const tool = params.tools[params.name]
  if (!tool) {
    throw new Error(`Unknown tool: ${params.name}`)
  }

  const output = await tool(params.input)
  params.toolCalls.push({
    id: nextRuntimeToolId(params.toolCalls),
    name: params.name,
    input: params.input,
    output,
  })

  return output
}

export async function runShadowAgentTurn(params: {
  message: string
  modelClient: AgentModelClient
  tools: Record<AgentToolName, (input: Record<string, unknown>) => Promise<unknown>>
  conversationState?: ConversationState | null
}): Promise<{
  final_answer: string
  tool_calls: AgentToolCallHistory[]
  route_trace: AgentRoutePacket
  runtime_packet: AgentRuntimePacket
  classification_override: string | null
}> {
  const tool_calls: AgentToolCallHistory[] = []
  const userContext = (await runRuntimeTool({
    name: "get_user_context",
    input: {},
    tools: params.tools,
    toolCalls: tool_calls,
  })) as UserContextProjection
  const modelClassification = await params.modelClient.classifyRoute({
    systemPrompt: AGENT_ROUTE_CLASSIFIER_PROMPT,
    message: params.message,
    userContext,
  })
  const shouldOverridePendingRoutineAnswer = Boolean(
    params.conversationState &&
    modelClassification.user_job !== "routine_structure" &&
    shouldApplyPendingRoutineAnswerOverride({
      state: params.conversationState,
      userMessage: params.message,
    }),
  )
  const shouldOverrideVagueRoutineCategory = shouldOverrideVagueRoutineCategoryFollowup({
    state: params.conversationState,
    classification: modelClassification,
    message: params.message,
  })
  const routineLayerOverride = deriveRoutineLayerForTurn({
    state: params.conversationState,
    classification: modelClassification,
    message: params.message,
  })
  const classificationOverride = shouldOverridePendingRoutineAnswer
    ? "conversation_state_pending_routine_answer"
    : shouldOverrideVagueRoutineCategory
      ? "conversation_state_routine_category_deep_dive"
      : routineLayerOverride && modelClassification.user_job !== "routine_structure"
        ? "conversation_state_routine_layer_selected"
        : null
  const routineRequestedCategory = shouldOverrideVagueRoutineCategory
    ? modelClassification.product_category
    : null
  const classification = shouldOverridePendingRoutineAnswer
    ? {
        ...modelClassification,
        user_job: "routine_structure" as const,
        product_category: null,
        requested_overlay_ids: [],
        requested_topic_ids: [],
        requested_routine_id: null,
        confidence: Math.max(modelClassification.confidence, 0.75),
        evidence: [
          ...modelClassification.evidence.slice(0, 3),
          "Conversation state treats this as answer to pending routine basics.",
        ],
        ambiguity: null,
      }
    : shouldOverrideVagueRoutineCategory
      ? {
          ...modelClassification,
          user_job: "routine_structure" as const,
          product_category: null,
          requested_overlay_ids: [],
          requested_topic_ids: [],
          requested_routine_id: null,
          confidence: Math.max(modelClassification.confidence, 0.75),
          evidence: [
            ...modelClassification.evidence.slice(0, 3),
            "Conversation state treats this vague category follow-up as a routine deep dive.",
          ],
          ambiguity: null,
        }
      : routineLayerOverride && modelClassification.user_job !== "routine_structure"
        ? {
            ...modelClassification,
            user_job: "routine_structure" as const,
            product_category: null,
            requested_overlay_ids: [],
            requested_topic_ids: [],
            requested_routine_id: null,
            confidence: Math.max(modelClassification.confidence, 0.75),
            evidence: [
              ...modelClassification.evidence.slice(0, 3),
              "Conversation state treats this as a selected routine layer.",
            ],
            ambiguity: null,
          }
        : modelClassification
  const routeBase = buildAgentRoutePacket({
    message: params.message,
    userContext,
    classification,
  })
  const route = shouldOverrideVagueRoutineCategory
    ? {
        ...routeBase,
        routine_layer: "deep_dive" as RoutineLayer,
        routine_requested_category: routineRequestedCategory,
      }
    : routineLayerOverride
      ? {
          ...routeBase,
          routine_layer: routineLayerOverride,
        }
      : routeBase
  const guidance = route.guidance_ids.length
    ? ((await runRuntimeTool({
        name: "load_guidance",
        input: { ids: route.guidance_ids },
        tools: params.tools,
        toolCalls: tool_calls,
      })) as GuidanceLoadResult)
    : ({ items: [] } satisfies GuidanceLoadResult)

  let selectedProducts: SelectedProductsProjection | null = null
  let routinePlan: BuildOrFixRoutineProjection | null = null

  for (const toolName of route.tool_plan) {
    if (toolName === "select_products" && route.product_category) {
      selectedProducts = (await runRuntimeTool({
        name: "select_products",
        input: {
          category: route.product_category,
          userJob: route.user_job,
          concerns: route.concerns,
          requestedGoal: deriveRequestedGoal(params.message),
          activeProfileSignals: route.active_profile_signals,
        },
        tools: params.tools,
        toolCalls: tool_calls,
      })) as SelectedProductsProjection
      continue
    }

    if (toolName === "build_or_fix_routine") {
      routinePlan = (await runRuntimeTool({
        name: "build_or_fix_routine",
        input: {
          objective: route.routine_objective,
          layer: route.routine_layer,
          requestedCategory: route.routine_requested_category,
        },
        tools: params.tools,
        toolCalls: tool_calls,
      })) as BuildOrFixRoutineProjection
    }
  }

  const packet = buildAgentRuntimePacket({
    message: params.message,
    route,
    userContext: buildEffectiveUserContextForRender({
      userContext,
      conversationState: params.conversationState,
      route,
    }),
    conversationState: params.conversationState,
    guidance,
    selectedProducts: prepareSelectedProductsForRender(selectedProducts),
    routinePlan,
  })
  const finalAnswer = await params.modelClient.renderFinalAnswer({
    systemPrompt: AGENT_FINAL_RENDER_PROMPT,
    message: params.message,
    packet,
  })

  return {
    final_answer: finalAnswer,
    tool_calls,
    route_trace: route,
    runtime_packet: packet,
    classification_override: classificationOverride,
  }
}
