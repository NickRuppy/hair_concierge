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
import type { ConversationState } from "@/lib/types"

function nextRuntimeToolId(toolCalls: AgentToolCallHistory[]): string {
  return `runtime-${toolCalls.length + 1}`
}

export function deriveRequestedGoal(message: string): "shine" | null {
  return /gl(?:a|ae|ä)nz|gloss|shine/i.test(message) ? "shine" : null
}

function hasFallbackCaveat(product: SelectedProductsProjection["products"][number]): boolean {
  return /^fallback:/i.test(product.caveat?.trim() ?? "")
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

function prepareSelectedProductsForRender(
  projection: SelectedProductsProjection | null,
): SelectedProductsProjection | null {
  if (!projection || projection.products.length < 2) {
    return projection
  }

  if (projection.category === "leave_in") {
    return projection
  }

  const primaryProducts = projection.products.filter((product) => !hasFallbackCaveat(product))
  if (primaryProducts.length === 0 || primaryProducts.length === projection.products.length) {
    return projection
  }

  const products = primaryProducts.map((product, index) => ({
    ...product,
    rank: index + 1,
  }))

  return {
    ...projection,
    products,
    comparison_facts: filterComparisonFactsForProducts(projection.comparison_facts, products),
    unsupported_requested_signals: collectUnsupportedRequestedSignalsForProducts(products),
  }
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
    modelClassification.user_job === "unsupported_or_unclear" &&
    modelClassification.product_category === null &&
    shouldApplyPendingRoutineAnswerOverride({
      state: params.conversationState,
      userMessage: params.message,
    }),
  )
  const classificationOverride = shouldOverridePendingRoutineAnswer
    ? "conversation_state_pending_routine_answer"
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
    : modelClassification
  const route = buildAgentRoutePacket({
    message: params.message,
    userContext,
    classification,
  })
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
        input: { objective: route.routine_objective },
        tools: params.tools,
        toolCalls: tool_calls,
      })) as BuildOrFixRoutineProjection
    }
  }

  const packet = buildAgentRuntimePacket({
    route,
    userContext,
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
