import type { AgenticConsultationBrief } from "@/lib/agent/orchestrator/agentic-consultation-brief"
import type { AgenticAnswerCompositionMode } from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import type {
  AgentActiveProfileSignal,
  AgentConcern,
  AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import {
  isActiveProfileSignalField,
  isActiveSignalSelectionEffect,
} from "@/lib/agent/orchestrator/route-packet"
import { createBuildOrFixRoutineTool } from "@/lib/agent/tools/build-or-fix-routine"
import type { RoutineObjective } from "@/lib/agent/tools/build-or-fix-routine"
import { getUserContext } from "@/lib/agent/tools/get-user-context"
import {
  loadAdvisorGuidance,
  normalizeAdvisorGuidanceCategory,
  normalizeAdvisorGuidanceCategories,
  normalizeAdvisorGuidanceIntent,
  normalizeAdvisorProfileFocus,
} from "@/lib/agent/tools/load-advisor-guidance"
import type {
  SelectableProductCategory,
  SelectedProductsProjection,
} from "@/lib/agent/tools/select-products"
import { createSelectProductsTool } from "@/lib/agent/tools/select-products"
import { loadUserMemoryContext } from "@/lib/rag/user-memory"
import type { ConversationState, RoutineLayer, RoutineProductCategory } from "@/lib/types"
import { createTestSession, upsertHairProfile } from "../../../../scripts/eval-chat/client"
import type {
  AgentCompareScenario,
  AgentCompareTurnResult,
  AgentCompareToolLoopVariant,
  AgentCompareUserRequest,
  CompareRunResult,
} from "./types"
import {
  resolveAgentCompareAnswerCompositionMode,
  resolveAgentCompareConsultationBriefOverride,
  resolveAgentCompareToolLoopVariant,
  shouldEnableAdvisorGuidanceTool,
} from "./tool-loop-variants"

type AgenticToolLoopRuntimeResult = {
  final_answer?: string
  answer?: string
  selected_products?: SelectedProductsProjection | null
  selectedProducts?: SelectedProductsProjection | null
  product_trace?: SelectedProductsProjection | null
  route_trace?: unknown
  trace?: unknown
  tool_loop_trace?: unknown
  agentic_tool_loop?: unknown
  state_transition?: unknown
  conversation_state_transition?: unknown
  terminal_answer?: {
    state_patch?: unknown
  }
  state_patch?: unknown
  tool_calls?: Array<{ name: string }>
  advisor_guidance?: unknown
}

type AgenticToolLoopRuntime = (params: {
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  modelClient: unknown
  tools: {
    load_advisor_guidance?: (input: Record<string, unknown>) => Promise<unknown>
    select_products: (input: Record<string, unknown>) => Promise<unknown>
    build_or_fix_routine: (input: Record<string, unknown>) => Promise<unknown>
  }
  userContext: Awaited<ReturnType<typeof getUserContext>>
  conversationState?: ConversationState | null
  answerCompositionMode?: AgenticAnswerCompositionMode
  consultationBrief?: AgenticConsultationBrief | null
}) => Promise<AgenticToolLoopRuntimeResult>

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

async function loadRuntime(): Promise<{
  runAgenticToolTurn: AgenticToolLoopRuntime
  modelClient: unknown
}> {
  const runtimeModulePath = "@/lib/agent/orchestrator/run-agentic-tool-turn"
  const modelClientModulePath = "@/lib/agent/orchestrator/model-client"
  const [runtimeModule, modelClientModule] = await Promise.all([
    import(runtimeModulePath),
    import(modelClientModulePath),
  ])

  const runAgenticToolTurn = (runtimeModule as { runAgenticToolTurn?: AgenticToolLoopRuntime })
    .runAgenticToolTurn
  const createModelClient = (
    modelClientModule as { createOpenAIAgenticToolLoopModelClient?: () => unknown }
  ).createOpenAIAgenticToolLoopModelClient

  if (!runAgenticToolTurn || !createModelClient) {
    throw new Error(
      "Agentic tool-loop runtime is not available yet. Expected runAgenticToolTurn and createOpenAIAgenticToolLoopModelClient.",
    )
  }

  return {
    runAgenticToolTurn,
    modelClient: createModelClient(),
  }
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

function normalizeSelectableCategory(value: unknown): SelectableProductCategory {
  if (typeof value !== "string") {
    throw new Error("Tool loop requested select_products without a valid category")
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

function normalizeToolUserContext(
  value: unknown,
  fallback: Awaited<ReturnType<typeof getUserContext>>,
): Awaited<ReturnType<typeof getUserContext>> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Awaited<ReturnType<typeof getUserContext>>
  }

  return fallback
}

function normalizeToolHairProfile(
  value: unknown,
  fallback: Awaited<ReturnType<typeof getUserContext>>["profile"],
): Awaited<ReturnType<typeof getUserContext>>["profile"] {
  if (value === null) return null
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Awaited<ReturnType<typeof getUserContext>>["profile"]
  }

  return fallback
}

function normalizeToolRoutineItems(
  value: unknown,
  fallback: Awaited<ReturnType<typeof getUserContext>>["routine_inventory"],
): Awaited<ReturnType<typeof getUserContext>>["routine_inventory"] {
  return Array.isArray(value)
    ? (value as Awaited<ReturnType<typeof getUserContext>>["routine_inventory"])
    : fallback
}

function normalizeAgentUserJob(value: unknown): AgentUserJob | null {
  return typeof value === "string" ? (value as AgentUserJob) : null
}

function normalizeAgentConcerns(value: unknown): AgentConcern[] {
  return Array.isArray(value)
    ? (value.filter((item): item is AgentConcern => typeof item === "string") as AgentConcern[])
    : []
}

function normalizeRequestedGoal(value: unknown): "shine" | null {
  return value === "shine" ? "shine" : null
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

function extractSelectedProducts(
  result: AgenticToolLoopRuntimeResult,
): SelectedProductsProjection | null {
  return result.selected_products ?? result.selectedProducts ?? result.product_trace ?? null
}

function extractToolLoopTrace(result: AgenticToolLoopRuntimeResult): unknown {
  return result.tool_loop_trace ?? result.agentic_tool_loop ?? result.trace ?? null
}

function extractAnswerContext(result: AgenticToolLoopRuntimeResult): unknown {
  const trace = extractToolLoopTrace(result)
  return trace && typeof trace === "object"
    ? (trace as Record<string, unknown>).answer_context
    : null
}

function extractAdvisorGuidance(result: AgenticToolLoopRuntimeResult): unknown {
  if (result.advisor_guidance) return result.advisor_guidance

  const trace = extractToolLoopTrace(result)
  return trace && typeof trace === "object"
    ? (trace as Record<string, unknown>).advisor_guidance
    : null
}

function extractStateTransition(result: AgenticToolLoopRuntimeResult): unknown {
  return (
    result.state_transition ??
    result.conversation_state_transition ??
    result.terminal_answer?.state_patch ??
    result.state_patch ??
    null
  )
}

function extractNextState(transition: unknown): ConversationState | null {
  if (!transition || typeof transition !== "object") return null

  const nextState = (transition as { next_state?: unknown }).next_state
  return nextState && typeof nextState === "object" ? (nextState as ConversationState) : null
}

function buildDebugLines(params: {
  result: AgenticToolLoopRuntimeResult
  selectedProducts: SelectedProductsProjection | null
  toolLoopVariant: AgentCompareToolLoopVariant
}): string[] {
  const toolNames =
    params.result.tool_calls?.map((call) => call.name).filter((name) => name.length > 0) ?? []
  const lines = [
    `tool_loop_variant: ${params.toolLoopVariant}`,
    `tool_loop: ${toolNames.length > 0 ? toolNames.join(" -> ") : "kein Tool"}`,
  ]

  const answerContext = extractAnswerContext(params.result)
  if (answerContext && typeof answerContext === "object") {
    const capsuleIds = (answerContext as Record<string, unknown>).capsule_ids
    if (Array.isArray(capsuleIds) && capsuleIds.length > 0) {
      lines.push(`answer_context: ${capsuleIds.join(", ")}`)
    }
  }

  const advisorGuidance = extractAdvisorGuidance(params.result)
  if (advisorGuidance && typeof advisorGuidance === "object") {
    const loadedGuidanceIds = (advisorGuidance as Record<string, unknown>).loaded_guidance_ids
    if (Array.isArray(loadedGuidanceIds) && loadedGuidanceIds.length > 0) {
      lines.push(`advisor_guidance: ${loadedGuidanceIds.join(", ")}`)
    }
  }

  if (params.selectedProducts) {
    lines.push(`decision: ${params.selectedProducts.decision}`)
    lines.push(`product_policy: ${params.selectedProducts.product_response_policy}`)
    lines.push(`products: ${params.selectedProducts.products.length}`)
  }

  return lines
}

function normalizeTurns(params: { prompt?: string; turns?: string[] }): string[] {
  const turns = params.turns?.map((turn) => turn.trim()).filter((turn) => turn.length > 0) ?? []
  if (turns.length > 0) return turns

  const prompt = params.prompt?.trim() ?? ""
  return prompt.length > 0 ? [prompt] : []
}

async function runToolLoopTurnsForUser(params: AgentCompareUserRequest): Promise<{
  turns: string[]
  turnResults: AgentCompareTurnResult[]
  finalResult: AgenticToolLoopRuntimeResult
  selectedProducts: SelectedProductsProjection | null
  latencyMs: number
}> {
  const turns = normalizeTurns(params)
  if (turns.length === 0) {
    throw new Error("Tool-loop comparison requires a prompt or at least one turn.")
  }

  const [context, memoryContext, runtime] = await Promise.all([
    getUserContext(params.userId),
    loadUserMemoryContext(params.userId),
    loadRuntime(),
  ])
  const selectProducts = createSelectProductsTool()
  const buildOrFixRoutine = createBuildOrFixRoutineTool()

  const recentMessages: Array<{ role: "user" | "assistant"; content: string }> = []
  const turnResults: AgentCompareTurnResult[] = []
  let conversationState: ConversationState | null = null
  let finalResult: AgenticToolLoopRuntimeResult | null = null
  let finalSelectedProducts: SelectedProductsProjection | null = null
  const toolLoopVariant = resolveAgentCompareToolLoopVariant(params.toolLoopVariant)
  const answerCompositionMode = resolveAgentCompareAnswerCompositionMode(toolLoopVariant)
  const consultationBrief = resolveAgentCompareConsultationBriefOverride(toolLoopVariant)
  const enableAdvisorGuidanceTool = shouldEnableAdvisorGuidanceTool(toolLoopVariant)
  const startedAt = performance.now()

  for (const [index, message] of turns.entries()) {
    const turnStartedAt = performance.now()
    let turnSelectedProducts: SelectedProductsProjection | null = null
    const result = await runtime.runAgenticToolTurn({
      message,
      recentMessages,
      modelClient: runtime.modelClient,
      userContext: context,
      conversationState,
      answerCompositionMode,
      consultationBrief,
      tools: {
        ...(enableAdvisorGuidanceTool
          ? {
              load_advisor_guidance: async (input: Record<string, unknown>) =>
                loadAdvisorGuidance({
                  intent: normalizeAdvisorGuidanceIntent(input.intent),
                  category: normalizeAdvisorGuidanceCategory(input.category),
                  categories: normalizeAdvisorGuidanceCategories(input.categories),
                  profileFocus: normalizeAdvisorProfileFocus(input.profileFocus),
                  message,
                  userContext: normalizeToolUserContext(input.userContext, context),
                  conversationState,
                }),
            }
          : {}),
        select_products: async (input) => {
          const hairProfile = normalizeToolHairProfile(input.hairProfile, context.profile)
          const projection = await selectProducts({
            category: normalizeSelectableCategory(input.category),
            message,
            hairProfile,
            memoryContext,
            routineItems: normalizeToolRoutineItems(input.routineItems, context.routine_inventory),
            userJob: normalizeAgentUserJob(input.userJob),
            concerns: normalizeAgentConcerns(input.concerns),
            requestedGoal: normalizeRequestedGoal(input.requestedGoal),
            activeProfileSignals: normalizeActiveProfileSignals(input.activeProfileSignals),
          })

          turnSelectedProducts = projection
          return projection
        },
        build_or_fix_routine: async (input) =>
          buildOrFixRoutine({
            objective: normalizeRoutineObjective(input.objective),
            message,
            hairProfile: normalizeToolHairProfile(input.hairProfile, context.profile),
            layer: normalizeRoutineLayer(input.layer),
            requestedCategory: normalizeRoutineProductCategory(input.requestedCategory),
          }),
      },
    })

    const selectedProducts = extractSelectedProducts(result) ?? turnSelectedProducts
    const stateTransition = extractStateTransition(result)
    const nextState = extractNextState(stateTransition)
    if (nextState) {
      conversationState = nextState
    }

    const answer = result.final_answer ?? result.answer ?? ""
    turnResults.push({
      turn: index + 1,
      prompt: message,
      answer,
      latency_ms: Math.round(performance.now() - turnStartedAt),
      matched_products: normalizeMatchedProducts(selectedProducts),
      product_trace: selectedProducts,
      tool_loop_trace: extractToolLoopTrace(result),
      state_transition: stateTransition,
      error: null,
    })

    recentMessages.push({ role: "user", content: message }, { role: "assistant", content: answer })
    finalResult = result
    finalSelectedProducts = selectedProducts
  }

  if (!finalResult) {
    throw new Error("Tool-loop comparison did not produce a result.")
  }

  return {
    turns,
    turnResults,
    finalResult,
    selectedProducts: extractSelectedProducts(finalResult) ?? finalSelectedProducts,
    latencyMs: Math.round(performance.now() - startedAt),
  }
}

export async function runToolLoopComparisonForUser(
  params: AgentCompareUserRequest,
): Promise<CompareRunResult> {
  const { turnResults, finalResult, selectedProducts, latencyMs } =
    await runToolLoopTurnsForUser(params)

  return {
    system: "tool_loop",
    answer: finalResult.final_answer ?? finalResult.answer ?? "",
    latency_ms: latencyMs,
    debug_lines: buildDebugLines({
      result: finalResult,
      selectedProducts,
      toolLoopVariant: resolveAgentCompareToolLoopVariant(params.toolLoopVariant),
    }),
    matched_products: normalizeMatchedProducts(selectedProducts),
    product_trace: selectedProducts,
    route_trace: null,
    tool_loop_trace: extractToolLoopTrace(finalResult),
    state_transition: extractStateTransition(finalResult),
    turns: turnResults,
    error: null,
  }
}

export async function runToolLoopComparison(params: {
  scenario: AgentCompareScenario
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
  toolLoopVariant?: AgentCompareToolLoopVariant
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

    return runToolLoopComparisonForUser({
      userId: session.userId,
      prompt: params.prompt,
      turns: params.turns,
      baseUrl: params.baseUrl,
      toolLoopVariant: params.toolLoopVariant,
    })
  } finally {
    await session.cleanup()
  }
}
