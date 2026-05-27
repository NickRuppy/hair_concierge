import {
  AgentV2TerminalAnswerSchema,
  type AgentV2CareCategory,
  type AgentV2RoutineLayer,
  type AgentV2RoutineThreadContext,
  type AgentV2RequestInterpretation,
  type AgentV2SafetyMode,
  type AgentV2SessionMemoryWrite,
  type AgentV2TerminalAnswer,
  type AgentV2Trace,
  type AgentV2ValidationError,
} from "@/lib/agent-v2/contracts"
import { getAgentV2ModelPolicy, type AgentV2ModelPolicy } from "@/lib/agent-v2/model-policy"
import { createAgentV2Trace } from "@/lib/agent-v2/runtime/trace"
import { LoadAgentV2AdvisorGuidanceInputSchema } from "@/lib/agent-v2/tools/guidance-tool"
import type { AgentV2RoutineProjection } from "@/lib/agent-v2/tools/routine-projection"
import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import {
  BuildOrFixRoutineToolInputSchema,
  SelectProductsToolInputSchema,
  buildAgentV2ResponsesTools,
} from "@/lib/agent-v2/tools/tool-definitions"
import {
  validateAgentV2FinalAnswer,
  type AgentV2FinalAnswerValidationContext,
  type AgentV2FinalAnswerValidationResult,
} from "@/lib/agent-v2/validation/final-answer-validator"

type AgentV2ToolName = "load_advisor_guidance" | "select_products" | "build_or_fix_routine"
type AgentV2RepairKind =
  | "terminal_only"
  | "missing_guidance_or_tools"
  | "missing_select_products"
  | "missing_build_or_fix_routine"
  | "unrepairable"
type AgentV2FallbackReason =
  | "generic"
  | "composition_failed"
  | "restricted_safety"
  | "empty_product_result"
  | "routine_ambiguity"

interface AgentV2RepairState {
  kind: AgentV2RepairKind
  requiredTools: AgentV2ToolName[]
  nextToolIndex: number
}

interface AgentV2ResponsesClient {
  responses: {
    create: (input: Record<string, unknown>) => Promise<{ id?: string; output?: unknown[] }>
  }
}

interface AgentV2RuntimeTools {
  load_advisor_guidance: (input: Record<string, unknown>) => Promise<unknown>
  select_products: (input: Record<string, unknown>) => Promise<unknown>
  build_or_fix_routine: (input: Record<string, unknown>) => Promise<unknown>
}

interface AgentV2RuntimeUserContext {
  hairProfile: unknown
  routineInventory: unknown[]
  sessionMemory: AgentV2SessionMemoryWrite[]
  derivedSignals?: string[]
  relevantMemory?: Array<{ kind?: string; content?: string }>
  missingProfile?: unknown[]
}

type AgentV2RoutineThreadStepInput = Partial<
  AgentV2RoutineThreadContext["visible_steps"][number]
> & {
  action_de?: string
  frequency_de?: string | null
  reason_de?: string
}

type AgentV2RoutineThreadContextInput = Omit<AgentV2RoutineThreadContext, "visible_steps"> & {
  visible_steps?: readonly AgentV2RoutineThreadStepInput[]
}

const ROUTINE_THREAD_LAYER_VALUES = new Set<AgentV2RoutineLayer>([
  "basics",
  "goals",
  "problems",
  "deep_dive",
])

export interface AgentV2ResponsesTurnResult {
  final_answer: AgentV2TerminalAnswer
  trace: AgentV2Trace
  accepted_session_memory_writes: AgentV2SessionMemoryWrite[]
}

export function validateAgentV2RuntimeFallbackAnswer(
  answer: unknown,
  context: AgentV2FinalAnswerValidationContext,
): AgentV2FinalAnswerValidationResult {
  const validation = validateAgentV2FinalAnswer(answer, context)
  const terminalAnswer = validation.sanitized_answer
  if (!terminalAnswer || !isDeterministicRuntimeFallbackAnswer(terminalAnswer, context)) {
    return validation
  }

  const errors = validation.errors.filter(
    (error) => !isAllowedRuntimeFallbackRoutineToolMismatch(error),
  )

  return {
    ...validation,
    ok: errors.length === 0,
    errors,
  }
}

function isDeterministicRuntimeFallbackAnswer(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
): boolean {
  const latestRoutineTool = [...context.toolCallHistory]
    .reverse()
    .find((call) => call.name === "build_or_fix_routine")

  return (
    context.safetyMode === "normal" &&
    Boolean(latestRoutineTool) &&
    /fallback after terminal repair failed/i.test(answer.interpreted_intent) &&
    answer.answer_mode === "general_advice" &&
    answer.request_interpretation.primary_intent === "general_advice" &&
    answer.request_interpretation.product_request_kind === "none" &&
    answer.request_interpretation.routine_intent === "none" &&
    answer.tool_grounding.used_product_tool === false &&
    answer.tool_grounding.used_routine_tool === true &&
    answer.tool_grounding.product_ids.length === 0 &&
    answer.tool_grounding.routine_step_ids.length === 0
  )
}

function isAllowedRuntimeFallbackRoutineToolMismatch(error: AgentV2ValidationError): boolean {
  return (
    error.validator_id === "request_interpretation_tool_args_match" &&
    error.path?.[0] === "request_interpretation" &&
    error.path?.[1] === "routine_intent" &&
    /routine_intent/i.test(error.message)
  )
}

export async function runAgentV2ResponsesTurn(params: {
  client: AgentV2ResponsesClient
  message: string
  recentMessages: Array<{ role: string; content: string }>
  userContext: AgentV2RuntimeUserContext
  currentRoutineLayer?: AgentV2RoutineLayer | null
  routineThreadContext?: AgentV2RoutineThreadContextInput | null
  priorSelectedProductProjections?: readonly Partial<AgentV2SelectProductsProjection>[]
  tools: AgentV2RuntimeTools
  safetyMode?: AgentV2SafetyMode
  policyOverrides?: Partial<AgentV2ModelPolicy>
  langfuseMode?: "disabled" | "enabled"
}): Promise<AgentV2ResponsesTurnResult> {
  const safetyMode = params.safetyMode ?? "normal"
  const policy = { ...getAgentV2ModelPolicy(), ...params.policyOverrides }
  const routineThreadContext = normalizeRoutineThreadContext(params.routineThreadContext ?? null)
  const trace = createAgentV2Trace({
    safetyMode,
    policy,
    injectedSessionMemory: params.userContext.sessionMemory,
    routineThreadContext,
    langfuseEnabled: params.langfuseMode === "enabled",
  })
  trace.loaded_guidance_package_ids = [
    "base.advisor_rules.v1",
    "base.answer_contract.v1",
    "base.tone_and_format.v1",
  ]

  if (safetyMode === "hard_short_circuit") {
    return completeWithAnswer(buildSafetyBoundaryAnswer(params.message), trace)
  }

  const toolDefinitions = buildAgentV2ResponsesTools({ safetyMode })
  const allowedExecutableTools = new Set(
    toolDefinitions
      .map((tool) => tool.name)
      .filter((name): name is AgentV2ToolName => isExecutableToolName(name)),
  )
  const selectedProductProjections: AgentV2SelectProductsProjection[] = []
  const routineProjections: AgentV2RoutineProjection[] = []
  const knownHardRuleIds = new Set<string>()
  let executableToolCalls = 0
  let repairUsed = false
  let repairState: AgentV2RepairState | null = null
  let missingTerminalRepairUsed = false
  const inputItems = buildInputItems(
    params.message,
    params.recentMessages,
    params.userContext,
    routineThreadContext,
    safetyMode,
    params.priorSelectedProductProjections ?? [],
  )
  const buildCurrentClarificationFallback = () =>
    buildClarificationFallback({
      message: params.message,
      safetyMode,
      routineThreadContext,
    })
  const buildCurrentValidationContext = (): AgentV2FinalAnswerValidationContext => ({
    selectedProductProjections: [
      ...(params.priorSelectedProductProjections ?? []),
      ...selectedProductProjections,
    ],
    routineProjections,
    latestUserMessage: params.message,
    recentEvidenceText: buildRecentEvidenceText(params.recentMessages, routineThreadContext),
    toolCallHistory: trace.tool_calls,
    safetyMode,
    requiredGuidancePackageIds: [],
    loadedGuidancePackageIds: trace.loaded_guidance_package_ids,
    currentRoutineLayer: params.currentRoutineLayer ?? routineThreadContext?.current_layer ?? null,
    routineThreadContext,
    hasCurrentRoutineInventory: (params.userContext.routineInventory?.length ?? 0) > 0,
    knownHardRuleIds: [...knownHardRuleIds],
  })

  for (let step = 0; step < policy.max_model_steps; step += 1) {
    const modelStepStartedAt = performance.now()
    const response = await params.client.responses.create({
      model: policy.model,
      store: policy.store,
      tools: toolDefinitions,
      parallel_tool_calls: false,
      input: inputItems,
      include: ["reasoning.encrypted_content"],
      reasoning: { effort: policy.reasoning_effort },
      text: { verbosity: policy.text_verbosity },
    })
    const modelStepLatencyMs = Math.round(performance.now() - modelStepStartedAt)

    if (response.id) trace.response_ids.push(response.id)
    const output = response.output ?? []
    inputItems.push(...output)
    const parsedStep = parseResponseOutput(output)
    trace.model_steps.push({
      response_id: response.id ?? null,
      function_calls: parsedStep.functionCalls,
      non_function_items: parsedStep.nonFunctionItems,
      latency_ms: modelStepLatencyMs,
    })

    if (parsedStep.functionCalls.length === 0) {
      const assistantText = extractAssistantText(parsedStep.nonFunctionItems)
      if (assistantText && !repairUsed && policy.max_repair_turns > 0) {
        repairUsed = true
        repairState = {
          kind: "terminal_only",
          requiredTools: [],
          nextToolIndex: 0,
        }
        missingTerminalRepairUsed = true
        trace.bounded_repair_kind = "terminal_only"
        trace.repair_attempts.push({
          reason: "missing_terminal_answer",
          validation_errors: [],
        })
        inputItems.push(buildMissingTerminalRepairInstruction(assistantText))
        continue
      }

      trace.failure_stage = missingTerminalRepairUsed
        ? "missing_terminal_failed"
        : "missing_terminal_answer"
      return completeWithAnswer(buildCurrentClarificationFallback(), trace)
    }

    const terminalCalls = parsedStep.functionCalls.filter(
      (call) => call.name === "submit_final_answer",
    )
    if (terminalCalls.length > 1) {
      trace.failure_stage = "multiple_terminal_answers"
      return completeWithAnswer(buildCurrentClarificationFallback(), trace)
    }

    if (terminalCalls.length === 1) {
      if (parsedStep.functionCalls.length > 1) {
        trace.failure_stage = "terminal_with_other_tool_calls"
        return completeWithAnswer(buildCurrentClarificationFallback(), trace)
      }

      if (repairState && repairState.nextToolIndex < repairState.requiredTools.length) {
        trace.blocked_tool_calls.push({
          name: "submit_final_answer",
          reason: "repair_tool_not_allowed",
        })
        inputItems.push(
          buildFunctionCallOutput(terminalCalls[0].call_id, {
            error: "repair_tool_not_allowed",
            expected_tool: repairState.requiredTools[repairState.nextToolIndex],
          }),
        )
        trace.failure_stage = "repair_failed"
        const fallbackReason = selectFallbackReason(
          trace.validation_errors,
          safetyMode,
          routineThreadContext,
        )
        const knownIntentFallback = buildKnownIntentFallbackAnswer({
          reason: fallbackReason,
          message: params.message,
          safetyMode,
          routineThreadContext,
          trace,
        })
        if (knownIntentFallback) {
          return completeWithKnownFallback(
            knownIntentFallback,
            trace,
            buildCurrentValidationContext(),
          )
        }

        return completeWithAnswer(
          buildFallbackAnswer({
            reason: fallbackReason,
            message: params.message,
            safetyMode,
            routineThreadContext,
          }),
          trace,
        )
      }

      const terminal = parseToolArguments(terminalCalls[0])
      if (!terminal.ok) {
        trace.blocked_tool_calls.push({ name: "submit_final_answer", reason: "invalid_json" })
        trace.failure_stage = "invalid_json"
        return completeWithAnswer(buildCurrentClarificationFallback(), trace)
      }

      const validation = validateAgentV2FinalAnswer(terminal.value, {
        selectedProductProjections: [
          ...(params.priorSelectedProductProjections ?? []),
          ...selectedProductProjections,
        ],
        routineProjections,
        latestUserMessage: params.message,
        recentEvidenceText: buildRecentEvidenceText(params.recentMessages, routineThreadContext),
        toolCallHistory: trace.tool_calls,
        safetyMode,
        requiredGuidancePackageIds: [],
        loadedGuidancePackageIds: trace.loaded_guidance_package_ids,
        currentRoutineLayer:
          params.currentRoutineLayer ?? routineThreadContext?.current_layer ?? null,
        routineThreadContext,
        hasCurrentRoutineInventory: (params.userContext.routineInventory?.length ?? 0) > 0,
        knownHardRuleIds: [...knownHardRuleIds],
      })

      if (validation.ok) {
        trace.validation_errors = []
        trace.validation_warnings = validation.warnings
        trace.dropped_session_memory_writes = validation.dropped_session_memory_writes
        return completeWithAnswer(
          validation.sanitized_answer ?? AgentV2TerminalAnswerSchema.parse(terminal.value),
          trace,
        )
      }

      trace.validation_errors = validation.errors
      trace.validation_warnings = validation.warnings
      trace.dropped_session_memory_writes = validation.dropped_session_memory_writes
      if (repairUsed || policy.max_repair_turns === 0) {
        trace.failure_stage = "repair_failed"
        const fallbackReason = selectFallbackReason(
          validation.errors,
          safetyMode,
          routineThreadContext,
        )
        const knownIntentFallback = buildKnownIntentFallbackAnswer({
          reason: fallbackReason,
          message: params.message,
          safetyMode,
          routineThreadContext,
          trace,
        })
        if (knownIntentFallback) {
          return completeWithKnownFallback(
            knownIntentFallback,
            trace,
            buildCurrentValidationContext(),
          )
        }

        return completeWithAnswer(
          buildFallbackAnswer({
            reason: fallbackReason,
            message: params.message,
            safetyMode,
            routineThreadContext,
          }),
          trace,
        )
      }

      repairState = buildRepairState(validation.errors)
      trace.bounded_repair_kind = repairState.kind
      if (repairState.kind === "unrepairable") {
        trace.failure_stage = "repair_failed"
        const fallbackReason = selectFallbackReason(
          validation.errors,
          safetyMode,
          routineThreadContext,
        )
        const knownIntentFallback = buildKnownIntentFallbackAnswer({
          reason: fallbackReason,
          message: params.message,
          safetyMode,
          routineThreadContext,
          trace,
        })
        if (knownIntentFallback) {
          return completeWithKnownFallback(
            knownIntentFallback,
            trace,
            buildCurrentValidationContext(),
          )
        }

        return completeWithAnswer(
          buildFallbackAnswer({
            reason: fallbackReason,
            message: params.message,
            safetyMode,
            routineThreadContext,
          }),
          trace,
        )
      }

      repairUsed = true
      trace.repair_attempts.push({
        reason: repairState.kind,
        validation_errors: validation.errors,
      })
      inputItems.push(buildTerminalValidationOutput(terminalCalls[0].call_id, validation.errors))
      inputItems.push(buildRepairInstruction(validation.errors, repairState))
      continue
    }

    const repairExecutableTool = getRepairExecutableTool(repairState)
    if (repairState) {
      if (!repairExecutableTool) {
        for (const call of parsedStep.functionCalls) {
          trace.blocked_tool_calls.push({ name: call.name, reason: "repair_tool_not_allowed" })
          inputItems.push(
            buildFunctionCallOutput(call.call_id, { error: "repair_tool_not_allowed" }),
          )
        }
        trace.failure_stage = missingTerminalRepairUsed
          ? "missing_terminal_failed"
          : "repair_failed"
        const fallbackReason = selectFallbackReason(
          trace.validation_errors,
          safetyMode,
          routineThreadContext,
        )
        const knownIntentFallback = buildKnownIntentFallbackAnswer({
          reason: fallbackReason,
          message: params.message,
          safetyMode,
          routineThreadContext,
          trace,
        })
        if (knownIntentFallback) {
          return completeWithKnownFallback(
            knownIntentFallback,
            trace,
            buildCurrentValidationContext(),
          )
        }

        return completeWithAnswer(buildCurrentClarificationFallback(), trace)
      }
      if (
        parsedStep.functionCalls.length !== 1 ||
        parsedStep.functionCalls[0].name !== repairExecutableTool
      ) {
        for (const call of parsedStep.functionCalls) {
          trace.blocked_tool_calls.push({ name: call.name, reason: "repair_tool_not_allowed" })
          inputItems.push(
            buildFunctionCallOutput(call.call_id, { error: "repair_tool_not_allowed" }),
          )
        }
        trace.failure_stage = "repair_failed"
        const fallbackReason = selectFallbackReason(
          trace.validation_errors,
          safetyMode,
          routineThreadContext,
        )
        const knownIntentFallback = buildKnownIntentFallbackAnswer({
          reason: fallbackReason,
          message: params.message,
          safetyMode,
          routineThreadContext,
          trace,
        })
        if (knownIntentFallback) {
          return completeWithKnownFallback(
            knownIntentFallback,
            trace,
            buildCurrentValidationContext(),
          )
        }

        return completeWithAnswer(buildCurrentClarificationFallback(), trace)
      }
    }

    for (const call of parsedStep.functionCalls) {
      if (!isExecutableToolName(call.name) || !allowedExecutableTools.has(call.name)) {
        trace.blocked_tool_calls.push({ name: call.name, reason: "tool_not_allowed" })
        inputItems.push(buildFunctionCallOutput(call.call_id, { error: "tool_not_allowed" }))
        continue
      }

      const parsedArguments = parseToolArguments(call)
      if (!parsedArguments.ok) {
        trace.blocked_tool_calls.push({ name: call.name, reason: "invalid_json" })
        inputItems.push(buildFunctionCallOutput(call.call_id, { error: "invalid_json" }))
        continue
      }

      const validatedArguments = validateExecutableToolArguments(call.name, parsedArguments.value, {
        safetyMode,
      })
      if (!validatedArguments.ok) {
        trace.blocked_tool_calls.push({ name: call.name, reason: "invalid_schema" })
        inputItems.push(buildFunctionCallOutput(call.call_id, { error: "invalid_schema" }))
        continue
      }

      const routineRebuildBlock = shouldBlockUnrequestedRoutineRebuild({
        name: call.name,
        message: params.message,
        routineThreadContext,
        repairState,
      })
      if (routineRebuildBlock.blocked) {
        trace.blocked_tool_calls.push({
          name: call.name,
          reason: routineRebuildBlock.reason,
        })
        inputItems.push(
          buildFunctionCallOutput(call.call_id, { error: routineRebuildBlock.reason }),
        )
        if (repairState && call.name === repairState.requiredTools[repairState.nextToolIndex]) {
          repairState.nextToolIndex += 1
        }
        continue
      }

      if (executableToolCalls >= policy.max_executable_tool_calls) {
        trace.failure_stage = "max_executable_tool_calls"
        return completeWithAnswer(buildCurrentClarificationFallback(), trace)
      }

      executableToolCalls += 1
      const toolStartedAt = performance.now()
      const output = await params.tools[call.name](validatedArguments.value)
      const toolLatencyMs = Math.round(performance.now() - toolStartedAt)
      inputItems.push(buildFunctionCallOutput(call.call_id, output))
      trace.tool_calls.push({
        call_id: call.call_id,
        name: call.name,
        arguments: validatedArguments.value,
        output_summary: summarizeToolOutput(output),
        latency_ms: toolLatencyMs,
      })

      if (call.name === "load_advisor_guidance") {
        collectGuidanceTrace(output, trace, knownHardRuleIds)
      } else if (call.name === "select_products") {
        selectedProductProjections.push(output as AgentV2SelectProductsProjection)
      } else if (call.name === "build_or_fix_routine") {
        routineProjections.push(output as AgentV2RoutineProjection)
      }

      if (repairState && call.name === repairState.requiredTools[repairState.nextToolIndex]) {
        repairState.nextToolIndex += 1
      }
    }

    if (repairState) {
      if (repairState.nextToolIndex < repairState.requiredTools.length) {
        inputItems.push(buildRepairNextToolInstruction(repairState))
      } else {
        inputItems.push(buildRepairSubmitInstruction())
      }
    }
  }

  trace.failure_stage = "max_model_steps"
  return completeWithAnswer(
    buildFallbackAnswer({
      reason: "generic",
      message: params.message,
      safetyMode,
      routineThreadContext,
    }),
    trace,
  )
}

function buildInputItems(
  message: string,
  recentMessages: Array<{ role: string; content: string }>,
  userContext: AgentV2RuntimeUserContext,
  routineThreadContext: AgentV2RoutineThreadContext | null,
  safetyMode: AgentV2SafetyMode,
  priorSelectedProductProjections: readonly Partial<AgentV2SelectProductsProjection>[],
): unknown[] {
  const items: unknown[] = [
    {
      role: "system",
      content:
        "You are AgentV2 for Hair Concierge. Never return plain assistant text to the user. Every user-visible answer must be submitted by calling submit_final_answer exactly once. If unsure, submit a clarification through submit_final_answer. Keep user-facing prose German.",
    },
    {
      role: "system",
      content: buildTerminalPayloadFieldGuidance(),
    },
    {
      role: "system",
      content: buildAnswerQualityGuidance(),
    },
    {
      role: "system",
      content: `Loaded Compare Lab user context. Treat this as the authoritative saved profile/routine context for this turn; do not ask for fields already present here. ${JSON.stringify(
        compactUserContextForModel(userContext),
      )}`,
    },
  ]

  if (routineThreadContext?.active) {
    items.push({
      role: "system",
      content: `Active AgentV2 routine thread context, including visible_steps from the currently visible routine. Preserve routine continuity unless the user explicitly leaves the routine topic. Explanatory follow-ups may use general_advice, but keep routine_context.active=true. Use visible_steps and the previous assistant offer to resolve follow-ups like "dieser Schritt", "der erste Zusatz", "ja, zeig mir passende Produkte dafür", or "das Produkt dafür". For short product follow-ups to a previous routine offer, call select_products only; do not call build_or_fix_routine unless the latest user message asks to change, simplify, lighten, add, remove, replace, rebalance, or rebuild the routine. For pure summary, recap, overview, or explanation follow-ups such as "fass mir das bitte kurz zusammen", answer from this routineThreadContext as general_advice with routine_context.active=true, routine_intent none, and no build_or_fix_routine call. Category comparisons inside an active routine can be general_advice with routine_context.active=true when no mutation is requested. Do not invent a step ID; if unclear, ask a clarification. ${JSON.stringify(
        routineThreadContext,
      )}`,
    })
  }

  const surfacedProductFacts = compactSurfacedProductFactsForModel(priorSelectedProductProjections)
  if (surfacedProductFacts.selected_products.length > 0) {
    items.push({
      role: "system",
      content: `Surfaced product facts from earlier turns in this Compare Lab run. Use the recent conversation and these factual product references to resolve ambiguous follow-ups and avoid repeating stale categories as if they were new. This is continuity context, not a routing rule. ${JSON.stringify(
        surfacedProductFacts,
      )}`,
    })
  }

  if (safetyMode === "restricted") {
    items.push({
      role: "system",
      content:
        "Safety mode is restricted for this turn because the user foregrounded scalp symptoms. Do not lead with product recommendations and do not ask for product selection. Still load relevant category guidance with safety_mode restricted when the user names a category or product area, and use it only for safety-compatible category facts. Give a safety-first, useful answer: mild, low-irritation care direction; avoid harsh scalp treatments; mention escalation signs; ask at most one material clarifying question.",
    })
  }

  items.push(
    ...recentMessages,
    {
      role: "user",
      content: message,
    },
    {
      role: "system",
      content: `Session memory for this Compare Lab run: ${JSON.stringify(userContext.sessionMemory)}`,
    },
  )

  return items
}

function normalizeRoutineThreadContext(
  context: AgentV2RoutineThreadContextInput | null,
): AgentV2RoutineThreadContext | null {
  if (!context) return null

  return {
    ...context,
    visible_steps: normalizeRoutineThreadSteps(context),
  }
}

function normalizeRoutineThreadSteps(
  context: AgentV2RoutineThreadContextInput,
): AgentV2RoutineThreadContext["visible_steps"] {
  return (context.visible_steps ?? []).flatMap((step, index) => {
    const stepId = typeof step.step_id === "string" ? step.step_id.trim() : ""
    const labelDe = typeof step.label_de === "string" ? step.label_de.trim() : ""
    if (!stepId || !labelDe) return []

    const order =
      typeof step.order === "number" && Number.isInteger(step.order) && step.order > 0
        ? step.order
        : index + 1
    const routineLayer =
      typeof step.routine_layer === "string" && ROUTINE_THREAD_LAYER_VALUES.has(step.routine_layer)
        ? step.routine_layer
        : context.current_layer

    return [
      {
        step_id: stepId,
        label_de: labelDe,
        category: typeof step.category === "string" ? step.category : null,
        order,
        routine_layer: routineLayer,
      },
    ]
  })
}

function compactUserContextForModel(userContext: AgentV2RuntimeUserContext) {
  return {
    profile: userContext.hairProfile,
    derived_signals: userContext.derivedSignals ?? [],
    routine_inventory: userContext.routineInventory,
    relevant_memory: (userContext.relevantMemory ?? []).slice(0, 6).map((entry) => ({
      kind: entry.kind ?? "unknown",
      content: String(entry.content ?? "").slice(0, 500),
    })),
    missing_profile: userContext.missingProfile ?? [],
  }
}

function compactSurfacedProductFactsForModel(
  projections: readonly Partial<AgentV2SelectProductsProjection>[],
): {
  last_product_category: string | null
  selected_products: Array<{ product_id: string; name: string; category: string | null }>
} {
  const selectedProducts: Array<{ product_id: string; name: string; category: string | null }> = []
  let lastProductCategory: string | null = null

  for (const projection of projections) {
    const category = typeof projection.category === "string" ? projection.category : null
    if (category) lastProductCategory = category

    const products = Array.isArray(projection.products) ? projection.products : []
    for (const product of products.slice(0, 3)) {
      if (!product || typeof product !== "object") continue
      const record = product as Record<string, unknown>
      const productId = typeof record.product_id === "string" ? record.product_id : null
      const name = typeof record.name === "string" ? record.name : null
      if (!productId || !name) continue
      selectedProducts.push({ product_id: productId, name, category })
    }
  }

  return {
    last_product_category: lastProductCategory,
    selected_products: selectedProducts.slice(-9),
  }
}

function buildFunctionCallOutput(callId: string, output: unknown): Record<string, unknown> {
  return {
    type: "function_call_output",
    call_id: callId,
    output: stringifyToolOutput(output),
  }
}

function buildTerminalValidationOutput(
  callId: string,
  errors: AgentV2ValidationError[],
): Record<string, unknown> {
  return buildFunctionCallOutput(callId, {
    error: "terminal_answer_validation_failed",
    validation_errors: errors.map((error) => ({
      validator_id: error.validator_id,
      message: error.message,
    })),
  })
}

function buildRepairInstruction(
  errors: AgentV2ValidationError[],
  repairState: AgentV2RepairState,
): Record<string, unknown> {
  const requiredTools = repairState.requiredTools.join(" -> ")
  const repairPolicy =
    repairState.requiredTools.length > 0
      ? `Call only these missing required tools in order: ${requiredTools}. After they return, call submit_final_answer exactly once. Do not call unrelated tools.`
      : "Call submit_final_answer exactly once using only already returned tool outputs. Do not call executable tools."

  return {
    role: "system",
    content: `Repair the AgentV2 terminal answer. Validation failed with: ${JSON.stringify(
      errors.map((error) => ({
        validator_id: error.validator_id,
        message: error.message,
      })),
    )}. ${repairPolicy} Keep all product/routine claims grounded in returned tool outputs. Match payload fields to answer_mode exactly.\n\n${buildTerminalPayloadFieldGuidance()}`,
  }
}

function buildRepairNextToolInstruction(repairState: AgentV2RepairState): Record<string, unknown> {
  const expectedTool = repairState.requiredTools[repairState.nextToolIndex]
  return {
    role: "system",
    content: `Continue the bounded repair. Call only ${expectedTool} next. Do not call submit_final_answer until all required repair tools have returned.`,
  }
}

function buildRepairSubmitInstruction(): Record<string, unknown> {
  return {
    role: "system",
    content:
      "The required repair tools have now returned output. Submit one corrected submit_final_answer now. Do not call another executable tool.",
  }
}

function buildTerminalPayloadFieldGuidance(): string {
  return [
    "AgentV2 terminal payload fields by answer_mode. Choose exactly one answer_mode and make payload match that mode.",
    "Every submit_final_answer must include request_interpretation with primary_intent, product_request_kind, routine_intent, care_category, requested_product_count, count_policy, evidence_quote, and confidence.",
    "When you call select_products, its product_request_kind, requested_product_count, count_policy, category, and evidence_quote must match terminal request_interpretation. Tool category maps to request_interpretation.care_category.",
    "When you call build_or_fix_routine, its routine_intent, requested_layer, requested_category, and evidence_quote must match terminal request_interpretation and routine_context.",
    "request_interpretation.evidence_quote should be a short raw phrase from the latest user message or active session context. Prefer exact wording; if the user uses a short referential follow-up, quote the closest active phrase that justifies your semantic decision.",
    "Do not wrap evidence_quote in decorative quotation marks.",
    "payload.user_facing_answer_de is the complete final German answer shown to the user.",
    "Do not treat recommendations, visible_steps, usage_notes_de, or blocking_constraints as hidden content that the app will render later.",
    "If a product, routine step, usage note, or blocking constraint is user-visible in payload fields, include it in user_facing_answer_de.",
    "product_recommendation payload: user_facing_answer_de, recommendations, comparison_notes_de, usage_notes_de, next_step_offer_de.",
    "routine payload: user_facing_answer_de, routine_layer, visible_steps, next_layer_options, next_step_offer_de.",
    "general_advice payload: user_facing_answer_de, category_or_topic, key_points_de, next_step_offer_de.",
    "clarification payload: user_facing_answer_de, question_de, missing_keys.",
    "constraint_blocked payload: user_facing_answer_de, blocking_constraints, safe_alternative_de.",
    "safety_boundary payload: user_facing_answer_de, boundary_reason_de, next_step_de.",
    "Before submitting non-trivial category, product, routine, or general advice, load the relevant guidance package. Terminal tool_grounding.used_guidance_package_ids must include required base packages and category packages.",
    "For named-product detail or product-specific claim checks, including heat protection, color safety, chelating, ingredient-free status, exact cadence, or product protocol, call select_products before submitting any terminal answer. Use product_request_kind product_detail. If the tool cannot confirm the product or claim, answer as clarification or constraint_blocked after the tool call; do not infer from the product name.",
    "For product_detail turns, terminal request_interpretation must match select_products on product_request_kind, requested_product_count, count_policy, care_category/category, and evidence_quote, even if the answer is clarification or constraint_blocked.",
    "For a concrete product ask inside an active routine, including a short acceptance of the previous offer such as matching products for that routine step, use answer_mode product_recommendation, set request_interpretation.product_request_kind to specific_products, call select_products first, keep routine_context.active=true, include routine_context step/category when known, and use payload.next_step_offer_de to return to the routine. Do not also call build_or_fix_routine unless the latest user message asks to change the routine.",
    "For pure summary, recap, overview, or explanation follow-ups inside an active routine thread, answer from routineThreadContext as general_advice, keep routine_context.active=true, set routine_intent none, and do not call build_or_fix_routine.",
    "For first-turn routine build, simplify, improve, change, add, remove, rebalance, or lightweight-routine asks, call build_or_fix_routine before the terminal answer. Keep pure placement/order/usage questions and non-mutating category comparisons explanation-only with routine_intent none and no routine payload.",
    "For product recommendations, default to three products. If the user explicitly asks for one or two products, return exactly that many when available. If the user asks for more than three, cap at three.",
    "For category education without an explicit product ask, use general_advice and do not include recommendations.",
    "Use the recent conversation and surfaced product facts to resolve ambiguous follow-ups. If the latest user message is short, first check whether it answers your previous question or next-step offer.",
    "Prefer natural German product wording such as Empfehlungen, passt gut zu dir, passende Option, naechster Schritt, or Zusatzpflege. Avoid English-ish labels such as Picks or Fit in the final German answer.",
  ].join("\n")
}

type RoutineRebuildBlockReason =
  | "routine_rebuild_not_requested"
  | "routine_summary_rebuild_not_requested"
type RoutineRebuildBlockResult =
  | { blocked: false; reason: null }
  | { blocked: true; reason: RoutineRebuildBlockReason }

function shouldBlockUnrequestedRoutineRebuild(params: {
  name: AgentV2ToolName
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
  repairState: AgentV2RepairState | null
}): RoutineRebuildBlockResult {
  if (params.name !== "build_or_fix_routine") return { blocked: false, reason: null }
  if (params.routineThreadContext?.active !== true) return { blocked: false, reason: null }
  if (hasRoutineMutationSignal(params.message)) return { blocked: false, reason: null }
  if (hasRoutineSummaryFollowupSignal(params.message)) {
    return { blocked: true, reason: "routine_summary_rebuild_not_requested" }
  }
  if (params.repairState) return { blocked: false, reason: null }
  if (hasProductFollowupSignal(params.message)) {
    return { blocked: true, reason: "routine_rebuild_not_requested" }
  }
  return { blocked: false, reason: null }
}

function hasProductFollowupSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return /\b(produkt|produkte|produktempfehl|empfehl|option|optionen)\b/.test(normalized)
}

function hasRoutineMutationSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return (
    /\b(aender\w*|änder\w*|veraender\w*|veränder\w*|anpass\w*|vereinfach\w*|ergaenz\w*|ergänz\w*|fuege\w*|füge\w*|hinzufueg\w*|hinzufüg\w*|entfern\w*|weglass\w*|ersetz\w*|ersetze\w*|tausch\w*|umbau\w*|rebuild\w*|rebalanc\w*|ausbalancier\w*|balancier\w*)\b/.test(
      normalized,
    ) ||
    /\b(einbau\w*|integrier\w*|reinnehm\w*)\b/.test(normalized) ||
    /\b(bau|baue|bauen|baust|baut)\b.*\bein\b/.test(normalized) ||
    /\b(nimm|nehm\w*)\b.*\brein\b/.test(normalized) ||
    /\b(mach\w*|mach|mache|macht|machen|gestalte\w*|halt\w*)\b.{0,80}\broutine\b.{0,80}\b(leichter|leicht|einfacher|simpler)\b/.test(
      normalized,
    ) ||
    /\broutine\b.{0,80}\b(leichter|leicht|einfacher|simpler)\b/.test(normalized) ||
    /\bkeine\s+schwere\s+routine\b/.test(normalized) ||
    /\b(schritt|produkt|routine)\b.{0,80}\bweg\b/.test(normalized) ||
    /\bweg\b.{0,80}\b(schritt|produkt|routine)\b/.test(normalized)
  )
}

function hasRoutineSummaryFollowupSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return (
    /\b(zusammenfass\w*|zusammenfassung|recap|rekap|ueberblick|überblick)\b/.test(normalized) ||
    /\bfass\w*\b.{0,60}\bzusammen\b/.test(normalized) ||
    /\b(noch\s*mal|nochmal|wieder)\b.{0,60}\bzusammen\b/.test(normalized)
  )
}

function buildAnswerQualityGuidance(): string {
  return [
    "AgentV2 answer quality guidance.",
    "Use 2-3 materially relevant profile facts when they affect the answer, such as hair texture, thickness, wash rhythm, drying method, heat/styling behavior, scalp, current routine, goals, or concerns.",
    "When you give frequency or usage cadence and it is based on profile context, name the anchor plainly, for example: Bei deinem Waschrhythmus alle 2-3 Tage.",
    "Do not invent a user preference. Do not say the user wants an easy/minimal/simple routine unless the latest message, recent context, memory, or profile explicitly says that.",
    "If convenience is only a product property, phrase it as product-level convenience, such as unkompliziert in der Anwendung, not as a stored user preference.",
    "Use a calm answer shape: direct answer first, one short profile-linked why, then compact steps or options only when useful.",
    "Avoid stacking many bold subheaders. Use bold mostly for product names, step labels, or one or two anchors that improve scanning.",
  ].join("\n")
}

function buildMissingTerminalRepairInstruction(assistantText: string): Record<string, unknown> {
  return {
    role: "system",
    content: `The previous model response contained plain assistant text instead of the required submit_final_answer tool call. Do not expose that raw text directly. Convert or improve it into one valid AgentV2 terminal answer now by calling submit_final_answer exactly once. Previous assistant text: ${JSON.stringify(
      assistantText.slice(0, 2000),
    )}`,
  }
}

function stringifyToolOutput(output: unknown): string {
  try {
    return JSON.stringify(output)
  } catch {
    return JSON.stringify({ error: "tool_output_not_serializable" })
  }
}

function parseResponseOutput(output: unknown[]): {
  functionCalls: Array<{ call_id: string; name: string; arguments: string }>
  nonFunctionItems: unknown[]
} {
  const functionCalls: Array<{ call_id: string; name: string; arguments: string }> = []
  const nonFunctionItems: unknown[] = []

  for (const item of output) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "function_call" &&
      "name" in item &&
      "arguments" in item
    ) {
      functionCalls.push({
        call_id: "call_id" in item && typeof item.call_id === "string" ? item.call_id : "",
        name: typeof item.name === "string" ? item.name : "",
        arguments: typeof item.arguments === "string" ? item.arguments : "",
      })
    } else {
      nonFunctionItems.push(item)
    }
  }

  return { functionCalls, nonFunctionItems }
}

function extractAssistantText(items: unknown[]): string {
  const parts: string[] = []

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    if (typeof record.text === "string") {
      parts.push(record.text)
    }

    if (Array.isArray(record.content)) {
      for (const contentItem of record.content) {
        if (!contentItem || typeof contentItem !== "object" || Array.isArray(contentItem)) continue
        const contentRecord = contentItem as Record<string, unknown>
        if (typeof contentRecord.text === "string") {
          parts.push(contentRecord.text)
        }
      }
    }
  }

  return parts.join("\n").trim()
}

function parseToolArguments(call: {
  arguments: string
}): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const value = JSON.parse(call.arguments)
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ok: true, value }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

function validateExecutableToolArguments(
  name: AgentV2ToolName,
  value: Record<string, unknown>,
  options: { safetyMode: AgentV2SafetyMode },
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (name === "select_products") {
    const parsed = SelectProductsToolInputSchema.safeParse(value)
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false }
  }

  if (name === "build_or_fix_routine") {
    const parsed = BuildOrFixRoutineToolInputSchema.safeParse(value)
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false }
  }

  if (name === "load_advisor_guidance") {
    const parsed = LoadAgentV2AdvisorGuidanceInputSchema.safeParse(value)
    return parsed.success
      ? { ok: true, value: { ...parsed.data, safety_mode: options.safetyMode } }
      : { ok: false }
  }

  return { ok: true, value }
}

function isExecutableToolName(name: string): name is AgentV2ToolName {
  return (
    name === "load_advisor_guidance" ||
    name === "select_products" ||
    name === "build_or_fix_routine"
  )
}

function buildRepairState(errors: AgentV2ValidationError[]): AgentV2RepairState {
  const validatorIds = new Set(errors.map((error) => error.validator_id))
  const requiredTools: AgentV2ToolName[] = []
  const safetyProductFirst = validatorIds.has("safety_no_product_first")

  if (safetyProductFirst) {
    return {
      kind: "terminal_only",
      requiredTools: [],
      nextToolIndex: 0,
    }
  }

  const answerModeMismatch =
    validatorIds.has("request_interpretation_answer_mode") ||
    validatorIds.has("category_advice_no_unasked_products")

  if (validatorIds.has("required_guidance_loaded") && !answerModeMismatch) {
    requiredTools.push("load_advisor_guidance")
  }
  if (validatorIds.has("product_tool_required") && !safetyProductFirst) {
    requiredTools.push("select_products")
  }
  if (validatorIds.has("routine_tool_required")) {
    requiredTools.push("build_or_fix_routine")
  }

  if (requiredTools.length > 0) {
    return {
      kind: "missing_guidance_or_tools",
      requiredTools,
      nextToolIndex: 0,
    }
  }

  return {
    kind: "terminal_only",
    requiredTools: [],
    nextToolIndex: 0,
  }
}

function getRepairExecutableTool(repairState: AgentV2RepairState | null): AgentV2ToolName | null {
  if (!repairState) return null
  return repairState.requiredTools[repairState.nextToolIndex] ?? null
}

function collectGuidanceTrace(
  output: unknown,
  trace: AgentV2Trace,
  knownHardRuleIds: Set<string>,
): void {
  if (!output || typeof output !== "object") return
  const maybeOutput = output as {
    loaded_package_ids?: string[]
    packages?: Array<{
      package_id?: string
      hard_rules?: Array<{ rule_id?: string }>
      soft_rubrics?: Array<{ rubric_id?: string }>
      required_grounding?: Array<{ grounding_id?: string }>
    }>
    hard_rules?: Array<{ rule_id?: string }>
    soft_rubrics?: Array<{ rubric_id?: string }>
    required_grounding?: Array<{ grounding_id?: string }>
  }

  const packageIds = [
    ...(maybeOutput.loaded_package_ids ?? []),
    ...(maybeOutput.packages
      ?.map((pkg) => pkg.package_id)
      .filter((id): id is string => Boolean(id)) ?? []),
  ]
  trace.loaded_guidance_package_ids = [
    ...new Set([...trace.loaded_guidance_package_ids, ...packageIds]),
  ]

  for (const rule of maybeOutput.hard_rules ?? []) {
    if (rule.rule_id) knownHardRuleIds.add(rule.rule_id)
  }
  for (const rubric of maybeOutput.soft_rubrics ?? []) {
    if (rubric.rubric_id) knownHardRuleIds.add(rubric.rubric_id)
  }
  for (const grounding of maybeOutput.required_grounding ?? []) {
    if (grounding.grounding_id) knownHardRuleIds.add(grounding.grounding_id)
  }
  for (const pkg of maybeOutput.packages ?? []) {
    for (const rule of pkg.hard_rules ?? []) {
      if (rule.rule_id) knownHardRuleIds.add(rule.rule_id)
    }
    for (const rubric of pkg.soft_rubrics ?? []) {
      if (rubric.rubric_id) knownHardRuleIds.add(rubric.rubric_id)
    }
    for (const grounding of pkg.required_grounding ?? []) {
      if (grounding.grounding_id) knownHardRuleIds.add(grounding.grounding_id)
    }
  }
}

function summarizeToolOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "empty"
  if ("valid_product_ids" in output && Array.isArray(output.valid_product_ids)) {
    return `products:${output.valid_product_ids.length}`
  }
  if ("visible_steps" in output && Array.isArray(output.visible_steps)) {
    return `routine_steps:${output.visible_steps.length}`
  }
  if ("markdown_brief" in output) {
    return "guidance"
  }
  return "tool_output"
}

function completeWithAnswer(
  answer: AgentV2TerminalAnswer,
  trace: AgentV2Trace,
): AgentV2ResponsesTurnResult {
  trace.answer_mode = answer.answer_mode
  trace.request_interpretation = answer.request_interpretation
  trace.request_interpretation_summary = summarizeRequestInterpretation(
    answer.request_interpretation,
  )
  trace.final_product_ids = answer.tool_grounding.product_ids
  trace.routine_layer = answer.routine_context.routine_layer
  trace.session_memory_writes = answer.session_memory_writes
  return {
    final_answer: answer,
    trace,
    accepted_session_memory_writes: answer.session_memory_writes,
  }
}

function completeWithKnownFallback(
  answer: AgentV2TerminalAnswer,
  trace: AgentV2Trace,
  validationContext: AgentV2FinalAnswerValidationContext,
): AgentV2ResponsesTurnResult {
  const currentValidationContext = {
    ...validationContext,
    loadedGuidancePackageIds: trace.loaded_guidance_package_ids,
  }
  if (isDeterministicRuntimeFallbackAnswer(answer, currentValidationContext)) {
    const validation = validateAgentV2RuntimeFallbackAnswer(answer, currentValidationContext)
    trace.validation_errors = validation.errors
    trace.validation_warnings = validation.warnings
    trace.dropped_session_memory_writes = validation.dropped_session_memory_writes
    return completeWithAnswer(validation.sanitized_answer ?? answer, trace)
  }

  trace.validation_errors = []
  return completeWithAnswer(answer, trace)
}

function buildClarificationFallback(params: {
  message: string
  safetyMode: AgentV2SafetyMode
  routineThreadContext: AgentV2RoutineThreadContext | null
}): AgentV2TerminalAnswer {
  return buildFallbackAnswer({
    reason: params.safetyMode === "restricted" ? "restricted_safety" : "generic",
    message: params.message,
    safetyMode: params.safetyMode,
    routineThreadContext: params.routineThreadContext,
  })
}

function selectFallbackReason(
  validationErrors: AgentV2ValidationError[],
  safetyMode: AgentV2SafetyMode,
  routineThreadContext: AgentV2RoutineThreadContext | null,
): AgentV2FallbackReason {
  const validatorIds = new Set(validationErrors.map((error) => error.validator_id))
  if (safetyMode === "restricted" || validatorIds.has("safety_no_product_first")) {
    return "restricted_safety"
  }
  if (
    routineThreadContext?.active &&
    (validatorIds.has("known_routine_step_ids") || validatorIds.has("routine_tool_required"))
  ) {
    return "routine_ambiguity"
  }
  if (validatorIds.has("product_tool_required") || validatorIds.has("known_product_ids")) {
    return "empty_product_result"
  }
  if (validatorIds.has("visible_payload_not_rendered")) return "composition_failed"
  return "generic"
}

function buildKnownIntentFallbackAnswer(params: {
  reason: AgentV2FallbackReason
  message: string
  safetyMode: AgentV2SafetyMode
  routineThreadContext: AgentV2RoutineThreadContext | null
  trace: AgentV2Trace
}): AgentV2TerminalAnswer | null {
  if (params.safetyMode !== "normal") return null
  if (params.reason !== "generic" && params.reason !== "composition_failed") return null

  const placementCategory = detectRoutinePlacementFallbackCategory(params.trace, params.message)
  if (
    placementCategory &&
    hasLoadedGeneralAdviceFallbackGuidance(
      placementCategory,
      params.trace.loaded_guidance_package_ids,
    )
  ) {
    return buildRoutinePlacementFallback({
      message: params.message,
      routineThreadContext: params.routineThreadContext,
      category: placementCategory,
      usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
      usedRoutineTool: params.trace.tool_calls.some((call) => call.name === "build_or_fix_routine"),
    })
  }

  const latestRoutineCall = [...params.trace.tool_calls]
    .reverse()
    .find((call) => call.name === "build_or_fix_routine")

  if (
    latestRoutineCall &&
    isLightweightMaskOilDecisionFallbackEligible(
      params.message,
      params.routineThreadContext,
      params.trace,
      latestRoutineCall.arguments ?? {},
    )
  ) {
    return buildLightweightMaskOilDecisionFallback({
      message: params.message,
      routineThreadContext: params.routineThreadContext,
      routineArgs: latestRoutineCall.arguments ?? {},
      loadedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
    })
  }

  if (
    latestRoutineCall &&
    isRoutineKnownIntentFallbackEligible(latestRoutineCall.arguments ?? {})
  ) {
    const fallbackCategory = readFallbackCareCategory(
      latestRoutineCall.arguments?.requested_category,
    )
    if (
      !hasLoadedGeneralAdviceFallbackGuidance(
        fallbackCategory,
        params.trace.loaded_guidance_package_ids,
      )
    ) {
      return null
    }

    return buildRoutineKnownIntentFallback({
      message: params.message,
      routineThreadContext: params.routineThreadContext,
      routineArgs: latestRoutineCall.arguments ?? {},
      loadedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
    })
  }

  return null
}

function isLightweightMaskOilDecisionFallbackEligible(
  message: string,
  routineThreadContext: AgentV2RoutineThreadContext | null,
  trace: AgentV2Trace,
  routineArgs: Record<string, unknown>,
): boolean {
  if (!mentionsMaskAndOil(message)) return false
  if (!hasLightweightAddOnSignal(message, routineThreadContext)) return false

  const loadedGuidance = new Set(trace.loaded_guidance_package_ids)
  const loadedMaskAndOilGuidance =
    loadedGuidance.has("base.general_advice.v1") &&
    loadedGuidance.has("category.mask.v1") &&
    loadedGuidance.has("category.oil.v1")
  if (!loadedMaskAndOilGuidance) return false

  const requestedCategory = readFallbackCareCategory(routineArgs.requested_category)
  const routineIntent = routineArgs.routine_intent
  const mutationKind = routineArgs.mutation_kind
  const objective = routineArgs.objective
  const routineCallMatches =
    (objective === "build_routine" || objective === "fix_routine") &&
    (routineIntent === "modify" || routineIntent === "explain") &&
    requestedCategory !== "oil" &&
    (mutationKind === "simplify" || mutationKind === "add_step" || mutationKind === "none")

  return routineCallMatches
}

function mentionsMaskAndOil(message: string): boolean {
  const productBoundary = "(?:^|[^\\p{L}\\p{N}_])"
  const productEnd = "(?=$|[^\\p{L}\\p{N}_])"
  const maskPattern = new RegExp(`${productBoundary}(?:haar)?maske${productEnd}`, "iu")
  const oilPattern = new RegExp(`${productBoundary}(?:haar)?(?:oel|oil|öl)${productEnd}`, "iu")

  return maskPattern.test(message) && oilPattern.test(message)
}

function hasLightweightAddOnSignal(
  message: string,
  routineThreadContext: AgentV2RoutineThreadContext | null,
): boolean {
  const haystack = [
    message,
    routineThreadContext?.last_user_goal ?? "",
    routineThreadContext?.summary_de ?? "",
  ].join("\n")
  return /\b(?:leicht\w*|zusatz|add[- ]?on|minimal|schlank)\b|nicht\s+(?:zu\s+)?schwer|keine\s+schwere\s+routine|nicht\s+beschwer\w*/i.test(
    haystack,
  )
}

function buildLoadedMaskOilFallbackGuidancePackageIds(
  loadedGuidancePackageIds: string[],
): string[] {
  const relevantIds = new Set([
    "base.advisor_rules.v1",
    "base.answer_contract.v1",
    "base.tone_and_format.v1",
    "base.general_advice.v1",
    "category.mask.v1",
    "category.oil.v1",
  ])
  return loadedGuidancePackageIds.filter((id) => relevantIds.has(id))
}

function buildLightweightMaskOilDecisionFallback(params: {
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
  routineArgs: Record<string, unknown>
  loadedGuidancePackageIds: string[]
}): AgentV2TerminalAnswer {
  const requestedLayer =
    params.routineArgs.requested_layer === "basics" ||
    params.routineArgs.requested_layer === "goals" ||
    params.routineArgs.requested_layer === "problems" ||
    params.routineArgs.requested_layer === "deep_dive"
      ? params.routineArgs.requested_layer
      : null
  const evidenceQuote =
    typeof params.routineArgs.evidence_quote === "string" &&
    params.routineArgs.evidence_quote.trim().length > 0
      ? params.routineArgs.evidence_quote
      : params.message.slice(0, 240) || "Maske oder Oel"
  const routineActive = params.routineThreadContext?.active === true
  const usedGuidancePackageIds = buildLoadedMaskOilFallbackGuidancePackageIds(
    params.loadedGuidancePackageIds,
  )

  return {
    answer_mode: "general_advice",
    interpreted_intent:
      "Lightweight mask versus oil decision fallback after terminal repair failed.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: evidenceQuote,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: {
      ...buildEmptyExtractedConstraints(),
      product_categories: ["mask", "oil"],
      raw_constraints: [params.message],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: usedGuidancePackageIds,
      used_product_tool: false,
      used_routine_tool: true,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: routineActive,
      routine_layer: requestedLayer ?? params.routineThreadContext?.current_layer ?? null,
      step_id: null,
      category: "mask",
      return_path: routineActive ? ["routine"] : [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Wenn du es leicht halten willst, waere die Maske der sinnvollere Haupt-Zusatz: gelegentlich fuer trockene oder frizzige Laengen, nicht als neuer schwerer Dauer-Schritt. Shampoo fuer Kopfhaut/Ansatz und Conditioner fuer Laengen und Spitzen bleiben die Basis. Oel wuerde ich nur optional als winziges Finish in die Spitzen nehmen, wenn sie danach noch strohig wirken.",
      category_or_topic: "mask",
      key_points_de: [
        "Maske als gelegentlicher Haupt-Zusatz fuer trockene oder frizzige Laengen.",
        "Oel nur optional und winzig als Finish in die Spitzen.",
        "Shampoo und Conditioner bleiben die Basis.",
      ],
      next_step_offer_de: null,
    },
  }
}

function detectRoutinePlacementFallbackCategory(
  trace: AgentV2Trace,
  message: string,
): "deep_cleansing_shampoo" | "dry_shampoo" | null {
  const latestRoutineCall = [...trace.tool_calls]
    .reverse()
    .find((call) => call.name === "build_or_fix_routine")
  const latestRoutineCategory = readPlacementCareCategory(
    latestRoutineCall?.arguments?.requested_category,
  )
  const latestRoutineIntent = latestRoutineCall?.arguments?.routine_intent

  if (
    latestRoutineCategory &&
    (latestRoutineIntent === "explain" ||
      latestRoutineIntent === "summarize" ||
      isPureRoutinePlacementQuestion(message))
  ) {
    return latestRoutineCategory
  }

  const latestGuidanceCall = [...trace.tool_calls]
    .reverse()
    .find((call) => call.name === "load_advisor_guidance")
  const guidanceCategories = Array.isArray(latestGuidanceCall?.arguments?.categories)
    ? latestGuidanceCall.arguments.categories
    : []
  const latestGuidanceCategory =
    guidanceCategories.find((category) => readPlacementCareCategory(category) !== null) ?? null

  if (latestGuidanceCategory && isPureRoutinePlacementQuestion(message)) {
    return readPlacementCareCategory(latestGuidanceCategory)
  }

  return null
}

function readPlacementCareCategory(
  value: unknown,
): "deep_cleansing_shampoo" | "dry_shampoo" | null {
  if (value === "deep_cleansing_shampoo" || value === "dry_shampoo") return value
  return null
}

function isPureRoutinePlacementQuestion(message: string): boolean {
  return /\b(wo|wann|reihenfolge|platzieren|einordnen|anwenden|benutzen|kommt|hin|vor|nach|zwischen)\b/i.test(
    message,
  )
}

function isRoutineKnownIntentFallbackEligible(routineArgs: Record<string, unknown>): boolean {
  const objective = routineArgs.objective
  const routineIntent = routineArgs.routine_intent
  const mutationKind = routineArgs.mutation_kind

  if (objective !== "build_routine" && objective !== "fix_routine") return false
  if (routineIntent === "create") return objective === "build_routine"
  if (routineIntent !== "modify") return false

  return (
    mutationKind === "add_step" ||
    mutationKind === "change_frequency" ||
    mutationKind === "simplify"
  )
}

function buildRoutineKnownIntentFallback(params: {
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
  routineArgs: Record<string, unknown>
  loadedGuidancePackageIds: string[]
}): AgentV2TerminalAnswer {
  const requestedCategory = readFallbackCareCategory(params.routineArgs.requested_category)
  const requestedLayer =
    params.routineArgs.requested_layer === "basics" ||
    params.routineArgs.requested_layer === "goals" ||
    params.routineArgs.requested_layer === "problems" ||
    params.routineArgs.requested_layer === "deep_dive"
      ? params.routineArgs.requested_layer
      : null
  const evidenceQuote =
    typeof params.routineArgs.evidence_quote === "string" &&
    params.routineArgs.evidence_quote.trim().length > 0
      ? params.routineArgs.evidence_quote
      : params.message.slice(0, 240) || "Routine anpassen"

  const resetCopy =
    "Ich wuerde den Reset nicht als taeglichen Schritt einbauen. Deine Basis bleibt Shampoo fuer Kopfhaut/Ansatz und Conditioner fuer Laengen und Spitzen. Ein Tiefenreinigungsshampoo passt nur gelegentlich, wenn sich Build-up oder Rueckstaende zeigen; danach die Laengen wieder mit Conditioner pflegen."
  const genericRoutineCopy =
    "Ich wuerde die Routine nicht groesser machen als noetig: erst Shampoo fuer die Kopfhaut, Conditioner fuer Laengen und Spitzen, und nur einen passenden Zusatz, wenn dein Ziel damit klar besser abgedeckt wird."
  const userFacingAnswer =
    requestedCategory === "deep_cleansing_shampoo" ? resetCopy : genericRoutineCopy
  const routineActive = params.routineThreadContext?.active === true

  return {
    answer_mode: "general_advice",
    interpreted_intent: "Known routine mutation fallback after terminal repair failed.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: requestedCategory,
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: evidenceQuote,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: buildEmptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: buildFallbackGuidancePackageIds(
        "general_advice",
        requestedCategory,
        params.loadedGuidancePackageIds,
      ),
      used_product_tool: false,
      used_routine_tool: true,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: routineActive,
      routine_layer: requestedLayer ?? params.routineThreadContext?.current_layer ?? null,
      step_id: null,
      category: requestedCategory === "unknown" ? null : requestedCategory,
      return_path: routineActive ? ["routine"] : [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: userFacingAnswer,
      category_or_topic: requestedCategory === "unknown" ? "routine" : requestedCategory,
      key_points_de:
        requestedCategory === "deep_cleansing_shampoo"
          ? [
              "Reset nicht als taeglichen Schritt einbauen.",
              "Shampoo und Conditioner bleiben die Basis.",
              "Tiefenreinigung nur gelegentlich bei Build-up oder Rueckstaenden.",
            ]
          : [
              "Routine nicht groesser machen als noetig.",
              "Shampoo und Conditioner bleiben die Basis.",
              "Zusatz nur bei klarem Ziel ergaenzen.",
            ],
      next_step_offer_de: null,
    },
  }
}

function buildRoutinePlacementFallback(params: {
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
  category: "deep_cleansing_shampoo" | "dry_shampoo"
  usedGuidancePackageIds: string[]
  usedRoutineTool: boolean
}): AgentV2TerminalAnswer {
  const routineActive = params.routineThreadContext?.active === true
  const isDryShampoo = params.category === "dry_shampoo"
  const userFacingAnswer = isDryShampoo
    ? "Trockenshampoo passt zwischen den Haarwaeschen, wenn der Ansatz schneller fettig wirkt. Gib es direkt an den Ansatz, lass es kurz wirken und buerste oder massiere es dann aus. Es ist keine Reinigung wie Shampoo und ersetzt keine Waesche; bei feinem Haar lieber sparsam starten, damit es nicht stumpf oder beschwert wirkt."
    : "Tiefenreinigung passt gelegentlich an einem Waschtag statt deinem normalen Shampoo, wenn sich Build-up, Styling-Rueckstaende oder ein belegtes Haargefuehl zeigen. Danach Conditioner oder Laengenpflege einplanen, weil die Laengen sonst rauer wirken koennen. Das ist eine Anwendungserklaerung, kein neuer Routine-Schritt."

  return {
    answer_mode: "general_advice",
    interpreted_intent: "Routine placement fallback after terminal repair failed.",
    request_interpretation: {
      primary_intent: "routine_explanation",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: params.category,
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: params.message.slice(0, 240) || "Routine-Platzierung",
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: buildEmptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: buildFallbackGuidancePackageIds(
        "general_advice",
        params.category,
        params.usedGuidancePackageIds,
      ),
      used_product_tool: false,
      used_routine_tool: params.usedRoutineTool,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: routineActive,
      routine_layer: params.routineThreadContext?.current_layer ?? null,
      step_id: null,
      category: params.category,
      return_path: routineActive ? ["routine"] : [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: userFacingAnswer,
      category_or_topic: params.category,
      key_points_de: isDryShampoo
        ? [
            "Zwischen nassen Haarwaeschen verwenden.",
            "Direkt am Ansatz einsetzen.",
            "Kein Ersatz fuer Shampoo; bei feinem Haar sparsam dosieren.",
          ]
        : [
            "Gelegentlich am Waschtag statt normalem Shampoo verwenden.",
            "Nur bei Build-up, Rueckstaenden oder belegtem Haargefuehl einsetzen.",
            "Danach Conditioner oder Laengenpflege verwenden.",
          ],
      next_step_offer_de: null,
    },
  }
}

function buildFallbackGuidancePackageIds(
  answerMode: "general_advice",
  category: AgentV2CareCategory,
  loadedGuidancePackageIds: string[],
): string[] {
  void answerMode
  void category
  return [...new Set(loadedGuidancePackageIds)]
}

function hasLoadedGeneralAdviceFallbackGuidance(
  category: AgentV2CareCategory,
  loadedGuidancePackageIds: readonly string[],
): boolean {
  const loaded = new Set(loadedGuidancePackageIds)
  if (!loaded.has("base.general_advice.v1")) return false

  const categoryPackageId = getFallbackCategoryGuidancePackageId(category)
  return !categoryPackageId || loaded.has(categoryPackageId)
}

function getFallbackCategoryGuidancePackageId(category: AgentV2CareCategory): string | null {
  const categoryPackageIds: Partial<Record<AgentV2CareCategory, string>> = {
    shampoo: "category.shampoo.v1",
    conditioner: "category.conditioner.v1",
    mask: "category.mask.v1",
    leave_in: "category.leave_in.v1",
    oil: "category.oil.v1",
    bondbuilder: "category.bondbuilder.v1",
    deep_cleansing_shampoo: "category.deep_cleansing_shampoo.v1",
    dry_shampoo: "category.dry_shampoo.v1",
    peeling: "category.peeling.v1",
  }

  return categoryPackageIds[category] ?? null
}

function readFallbackCareCategory(value: unknown): AgentV2CareCategory {
  if (
    value === "shampoo" ||
    value === "conditioner" ||
    value === "mask" ||
    value === "leave_in" ||
    value === "oil" ||
    value === "bondbuilder" ||
    value === "deep_cleansing_shampoo" ||
    value === "dry_shampoo" ||
    value === "peeling"
  ) {
    return value
  }
  return "unknown"
}

function buildFallbackAnswer(params: {
  reason: AgentV2FallbackReason
  message: string
  safetyMode: AgentV2SafetyMode
  routineThreadContext: AgentV2RoutineThreadContext | null
}): AgentV2TerminalAnswer {
  if (params.reason === "restricted_safety") {
    return buildRestrictedSafetyFallback(params.message)
  }
  if (params.reason === "empty_product_result") {
    return buildEmptyProductResultFallback(params.message)
  }

  const routineActive = params.routineThreadContext?.active === true
  return {
    answer_mode: "clarification",
    interpreted_intent: "AgentV2 fallback clarification.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "unclear",
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: buildEmptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: routineActive,
      routine_layer: routineActive ? (params.routineThreadContext?.current_layer ?? null) : null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: getFallbackUserFacingAnswer(params.reason),
      question_de:
        params.reason === "routine_ambiguity"
          ? "Meinst du mit dem Zusatz den Leave-in-Schritt oder einen anderen Routine-Schritt?"
          : "Was genau moechtest du zu deiner Haarpflege wissen?",
      missing_keys: [],
    },
  }
}

function getFallbackUserFacingAnswer(reason: AgentV2FallbackReason): string {
  if (reason === "composition_failed") {
    return "Ich konnte die Antwort gerade nicht sauber zusammensetzen. Versuch es bitte noch einmal mit derselben Frage."
  }
  if (reason === "routine_ambiguity") {
    return "Meinst du mit dem Zusatz den Leave-in-Schritt oder einen anderen Routine-Schritt?"
  }
  return "Ich bin mir gerade nicht sicher, was du genau moechtest. Formulier es bitte einmal konkreter."
}

function buildRestrictedSafetyFallback(message: string): AgentV2TerminalAnswer {
  return {
    answer_mode: "safety_boundary",
    interpreted_intent: "Restricted scalp safety fallback.",
    request_interpretation: {
      primary_intent: "safety_boundary",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: message.slice(0, 240) || "unclear",
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: buildEmptyExtractedConstraints(),
    missing_information: [],
    safety_flags: ["restricted_scalp_symptoms"],
    tool_grounding: {
      used_guidance_package_ids: ["base.safety_boundaries.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Bei juckender oder gereizter Kopfhaut würde ich nicht direkt mit einem konkreten Produkt starten. Bis es ruhiger ist: mild reinigen, keine Kopfhaut-Peelings und nichts stark Duftendes direkt auf die Kopfhaut. Wenn es anhält, brennt, nässt, schmerzt oder stärker wird, bitte abklären lassen.",
      boundary_reason_de:
        "Die Beschreibung klingt nach einem Kopfhautthema, bei dem Sicherheit vor Produktempfehlung geht.",
      next_step_de: "Bleib vorerst mild und lass es abklaeren, wenn es nicht rasch ruhiger wird.",
    },
  }
}

function buildEmptyProductResultFallback(message: string): AgentV2TerminalAnswer {
  return {
    answer_mode: "general_advice",
    interpreted_intent: "AgentV2 could not ground a safe product recommendation.",
    request_interpretation: {
      primary_intent: "general_advice",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: message.slice(0, 240) || "unclear",
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: buildEmptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Ich finde gerade keinen sicheren Produkttreffer in dieser Kategorie. Ich kann dir aber erklären, welche Produktart hier passen würde.",
      category_or_topic: "product_result",
      key_points_de: ["Kein sicherer Produkttreffer aus den verfuegbaren Daten."],
      next_step_offer_de: null,
    },
  }
}

function buildSafetyBoundaryAnswer(message: string): AgentV2TerminalAnswer {
  return {
    answer_mode: "safety_boundary",
    interpreted_intent: "Severe scalp or hair-loss safety wording.",
    request_interpretation: {
      primary_intent: "safety_boundary",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: message.slice(0, 240) || "safety concern",
      confidence: 1,
    },
    confidence: 1,
    extracted_constraints: {
      ...buildEmptyExtractedConstraints(),
      raw_constraints: [message],
    },
    missing_information: [],
    safety_flags: ["hard_short_circuit"],
    tool_grounding: {
      used_guidance_package_ids: ["base.safety_boundaries.v1"],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: ["safety.no_diagnosis", "safety.no_treatment_claims"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de:
        "Das klingt nicht mehr nach einer rein kosmetischen Haarpflege-Frage. Bitte lass das zeitnah aerztlich abklaeren; ich wuerde hier keine Produkt- oder Routineempfehlung in den Vordergrund stellen.",
      boundary_reason_de:
        "Die Beschreibung klingt nach einem moeglich medizinischen Kopfhaut- oder Haarausfallthema.",
      next_step_de: "Bitte lass das zeitnah aerztlich abklaeren.",
    },
  }
}

function buildEmptyExtractedConstraints(): AgentV2TerminalAnswer["extracted_constraints"] {
  return {
    hair_concerns: [],
    goals: [],
    product_categories: [],
    budget_eur: null,
    avoid_ingredients: [],
    allergies: [],
    preferences: [],
    routine_layer: null,
    raw_constraints: [],
  }
}

function summarizeRequestInterpretation(interpretation: AgentV2RequestInterpretation): string {
  const count =
    interpretation.count_policy === "none"
      ? "no count"
      : `${interpretation.requested_product_count ?? "default"} ${interpretation.count_policy}`
  return [
    `Intent: ${interpretation.primary_intent}`,
    interpretation.product_request_kind,
    interpretation.routine_intent,
    interpretation.care_category,
    count,
    `confidence ${interpretation.confidence.toFixed(2)}`,
  ].join(" · ")
}

function buildRecentEvidenceText(
  recentMessages: Array<{ role: string; content: string }>,
  routineThreadContext: AgentV2RoutineThreadContext | null,
): string {
  const visibleStepEvidence =
    routineThreadContext?.visible_steps.flatMap((step) => [
      step.step_id,
      step.label_de,
      step.category,
      step.routine_layer,
    ]) ?? []

  return [
    ...recentMessages.slice(-6).map((message) => message.content),
    routineThreadContext?.summary_de ?? "",
    routineThreadContext?.last_user_goal ?? "",
    ...(routineThreadContext?.last_routine_categories ?? []),
    ...visibleStepEvidence,
  ].join("\n")
}
