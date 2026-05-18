import {
  AgentV2TerminalAnswerSchema,
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
import { validateAgentV2FinalAnswer } from "@/lib/agent-v2/validation/final-answer-validator"

type AgentV2ToolName = "load_advisor_guidance" | "select_products" | "build_or_fix_routine"
type AgentV2RepairKind =
  | "terminal_only"
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
  requiredTool: AgentV2ToolName | null
  requiredToolCalled: boolean
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

type AgentV2RoutineThreadContextInput =
  | AgentV2RoutineThreadContext
  | (Omit<AgentV2RoutineThreadContext, "visible_steps"> & {
      visible_steps?: AgentV2RoutineThreadContext["visible_steps"]
    })

export interface AgentV2ResponsesTurnResult {
  final_answer: AgentV2TerminalAnswer
  trace: AgentV2Trace
  accepted_session_memory_writes: AgentV2SessionMemoryWrite[]
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
  )

  for (let step = 0; step < policy.max_model_steps; step += 1) {
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

    if (response.id) trace.response_ids.push(response.id)
    const output = response.output ?? []
    inputItems.push(...output)
    const parsedStep = parseResponseOutput(output)
    trace.model_steps.push({
      response_id: response.id ?? null,
      function_calls: parsedStep.functionCalls,
      non_function_items: parsedStep.nonFunctionItems,
    })

    if (parsedStep.functionCalls.length === 0) {
      const assistantText = extractAssistantText(parsedStep.nonFunctionItems)
      if (assistantText && !repairUsed && policy.max_repair_turns > 0) {
        repairUsed = true
        repairState = {
          kind: "terminal_only",
          requiredTool: null,
          requiredToolCalled: true,
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
      return completeWithAnswer(buildClarificationFallback(), trace)
    }

    const terminalCalls = parsedStep.functionCalls.filter(
      (call) => call.name === "submit_final_answer",
    )
    if (terminalCalls.length > 1) {
      trace.failure_stage = "multiple_terminal_answers"
      return completeWithAnswer(buildClarificationFallback(), trace)
    }

    if (terminalCalls.length === 1) {
      if (parsedStep.functionCalls.length > 1) {
        trace.failure_stage = "terminal_with_other_tool_calls"
        return completeWithAnswer(buildClarificationFallback(), trace)
      }

      const terminal = parseToolArguments(terminalCalls[0])
      if (!terminal.ok) {
        trace.blocked_tool_calls.push({ name: "submit_final_answer", reason: "invalid_json" })
        trace.failure_stage = "invalid_json"
        return completeWithAnswer(buildClarificationFallback(), trace)
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
        currentRoutineLayer:
          params.currentRoutineLayer ?? routineThreadContext?.current_layer ?? null,
        routineThreadContext,
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
        return completeWithAnswer(
          buildFallbackAnswer({
            reason: selectFallbackReason(validation.errors, safetyMode, routineThreadContext),
            message: params.message,
            safetyMode,
            routineThreadContext,
          }),
          trace,
        )
      }

      const repairKind = classifyRepairKind(validation.errors)
      trace.bounded_repair_kind = repairKind
      if (repairKind === "unrepairable") {
        trace.failure_stage = "repair_failed"
        return completeWithAnswer(
          buildFallbackAnswer({
            reason: selectFallbackReason(validation.errors, safetyMode, routineThreadContext),
            message: params.message,
            safetyMode,
            routineThreadContext,
          }),
          trace,
        )
      }

      repairUsed = true
      repairState = buildRepairState(repairKind)
      trace.repair_attempts.push({ reason: repairKind, validation_errors: validation.errors })
      inputItems.push(buildTerminalValidationOutput(terminalCalls[0].call_id, validation.errors))
      inputItems.push(buildRepairInstruction(validation.errors, repairKind))
      continue
    }

    const repairExecutableTool = getRepairExecutableTool(repairState)
    if (repairState) {
      if (!repairExecutableTool || repairState.requiredToolCalled) {
        trace.failure_stage = missingTerminalRepairUsed
          ? "missing_terminal_failed"
          : "repair_failed"
        return completeWithAnswer(buildClarificationFallback(), trace)
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
        return completeWithAnswer(buildClarificationFallback(), trace)
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

      const validatedArguments = validateExecutableToolArguments(call.name, parsedArguments.value)
      if (!validatedArguments.ok) {
        trace.blocked_tool_calls.push({ name: call.name, reason: "invalid_schema" })
        inputItems.push(buildFunctionCallOutput(call.call_id, { error: "invalid_schema" }))
        continue
      }

      if (executableToolCalls >= policy.max_executable_tool_calls) {
        trace.failure_stage = "max_executable_tool_calls"
        return completeWithAnswer(buildClarificationFallback(), trace)
      }

      executableToolCalls += 1
      const output = await params.tools[call.name](validatedArguments.value)
      inputItems.push(buildFunctionCallOutput(call.call_id, output))
      trace.tool_calls.push({
        call_id: call.call_id,
        name: call.name,
        arguments: validatedArguments.value,
        output_summary: summarizeToolOutput(output),
      })

      if (call.name === "load_advisor_guidance") {
        collectGuidanceTrace(output, trace, knownHardRuleIds)
      } else if (call.name === "select_products") {
        selectedProductProjections.push(output as AgentV2SelectProductsProjection)
      } else if (call.name === "build_or_fix_routine") {
        routineProjections.push(output as AgentV2RoutineProjection)
      }

      if (repairState?.requiredTool === call.name) {
        repairState.requiredToolCalled = true
      }
    }

    if (repairState?.requiredToolCalled) {
      inputItems.push(buildRepairSubmitInstruction())
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
      content: `Loaded Compare Lab user context. Treat this as the authoritative saved profile/routine context for this turn; do not ask for fields already present here. ${JSON.stringify(
        compactUserContextForModel(userContext),
      )}`,
    },
  ]

  if (routineThreadContext?.active) {
    items.push({
      role: "system",
      content: `Active AgentV2 routine thread context, including visible_steps from the currently visible routine. Preserve routine continuity unless the user explicitly leaves the routine topic. Explanatory follow-ups may use general_advice, but keep routine_context.active=true. Use visible_steps to resolve follow-ups like "dieser Schritt", "der erste Zusatz", or "das Produkt dafür". Do not invent a step ID; if unclear, ask a clarification. ${JSON.stringify(
        routineThreadContext,
      )}`,
    })
  }

  if (safetyMode === "restricted") {
    items.push({
      role: "system",
      content:
        "Safety mode is restricted for this turn because the user foregrounded scalp symptoms. Do not lead with product recommendations and do not ask for product selection. Give a safety-first, useful answer: mild, low-irritation care direction; avoid harsh scalp treatments; mention escalation signs; ask at most one material clarifying question.",
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
    visible_steps: context.visible_steps ?? [],
  }
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
  repairKind: AgentV2RepairKind,
): Record<string, unknown> {
  const repairPolicy =
    repairKind === "missing_select_products"
      ? "First call select_products with typed semantic fields that match request_interpretation, then submit_final_answer. Do not call any other executable tool."
      : repairKind === "missing_build_or_fix_routine"
        ? "First call build_or_fix_routine with typed semantic fields that match request_interpretation, then submit_final_answer. Do not call any other executable tool."
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

function buildRepairSubmitInstruction(): Record<string, unknown> {
  return {
    role: "system",
    content:
      "The required repair tool has now returned output. Submit one corrected submit_final_answer now. Do not call another executable tool.",
  }
}

function buildTerminalPayloadFieldGuidance(): string {
  return [
    "AgentV2 terminal payload fields by answer_mode. Choose exactly one answer_mode and make payload match that mode.",
    "Every submit_final_answer must include request_interpretation with primary_intent, product_request_kind, routine_intent, category, requested_product_count, count_policy, evidence_quote, and confidence.",
    "When you call select_products, its product_request_kind, requested_product_count, count_policy, category, and evidence_quote must match terminal request_interpretation.",
    "When you call build_or_fix_routine, its routine_intent, requested_layer, requested_category, and evidence_quote must match terminal request_interpretation and routine_context.",
    "request_interpretation.evidence_quote must be a short exact quote from the latest user message or active session context.",
    "Do not wrap evidence_quote in decorative quotation marks; use the raw user/context substring.",
    "payload.user_facing_answer_de is the complete final German answer shown to the user.",
    "Do not treat recommendations, visible_steps, usage_notes_de, or blocking_constraints as hidden content that the app will render later.",
    "If a product, routine step, usage note, or blocking constraint is user-visible in payload fields, include it in user_facing_answer_de.",
    "product_recommendation payload: user_facing_answer_de, recommendations, comparison_notes_de, usage_notes_de, next_step_offer_de.",
    "routine payload: user_facing_answer_de, routine_layer, visible_steps, next_layer_options, next_step_offer_de.",
    "routine_product_deep_dive payload: user_facing_answer_de, step_id, category, recommendations, return_to_routine_offer_de.",
    "general_advice payload: user_facing_answer_de, category_or_topic, key_points_de, next_step_offer_de.",
    "clarification payload: user_facing_answer_de, question_de, missing_keys.",
    "constraint_blocked payload: user_facing_answer_de, blocking_constraints, safe_alternative_de.",
    "safety_boundary payload: user_facing_answer_de, boundary_reason_de, next_step_de.",
    "For a concrete product ask inside an active routine, use routine_product_deep_dive, call select_products first, include up to three recommendations, and include return_to_routine_offer_de.",
    "For product recommendations, default to three products. If the user explicitly asks for one or two products, return exactly that many when available. If the user asks for more than three, cap at three.",
    "For category education without an explicit product ask, use general_advice and do not include recommendations.",
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
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false }
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

function classifyRepairKind(errors: AgentV2ValidationError[]): AgentV2RepairKind {
  const validatorIds = new Set(errors.map((error) => error.validator_id))
  if (validatorIds.has("safety_no_product_first")) return "terminal_only"
  if (validatorIds.has("product_tool_required")) return "missing_select_products"
  if (validatorIds.has("routine_tool_required")) return "missing_build_or_fix_routine"
  if (validatorIds.has("terminal_schema")) return "terminal_only"
  if (validatorIds.has("visible_payload_not_rendered")) return "terminal_only"
  if (validatorIds.has("known_product_ids")) return "terminal_only"
  if (validatorIds.has("known_routine_step_ids")) return "terminal_only"
  if (validatorIds.has("requested_product_count")) return "terminal_only"
  if (validatorIds.has("request_interpretation_tool_args_match")) return "terminal_only"
  if (validatorIds.has("request_interpretation_answer_mode")) return "terminal_only"
  if (validatorIds.has("request_interpretation_confidence")) return "terminal_only"
  if (validatorIds.has("request_interpretation_evidence")) return "terminal_only"
  return "terminal_only"
}

function buildRepairState(kind: AgentV2RepairKind): AgentV2RepairState {
  if (kind === "missing_select_products") {
    return { kind, requiredTool: "select_products", requiredToolCalled: false }
  }
  if (kind === "missing_build_or_fix_routine") {
    return { kind, requiredTool: "build_or_fix_routine", requiredToolCalled: false }
  }
  return { kind, requiredTool: null, requiredToolCalled: true }
}

function getRepairExecutableTool(repairState: AgentV2RepairState | null): AgentV2ToolName | null {
  if (!repairState || repairState.requiredToolCalled) return null
  return repairState.requiredTool
}

function collectGuidanceTrace(
  output: unknown,
  trace: AgentV2Trace,
  knownHardRuleIds: Set<string>,
): void {
  if (!output || typeof output !== "object") return
  const maybeOutput = output as {
    loaded_package_ids?: string[]
    packages?: Array<{ package_id?: string; hard_rules?: Array<{ rule_id?: string }> }>
    hard_rules?: Array<{ rule_id?: string }>
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
  for (const pkg of maybeOutput.packages ?? []) {
    for (const rule of pkg.hard_rules ?? []) {
      if (rule.rule_id) knownHardRuleIds.add(rule.rule_id)
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

function buildClarificationFallback(): AgentV2TerminalAnswer {
  return buildFallbackAnswer({
    reason: "generic",
    message: "",
    safetyMode: "normal",
    routineThreadContext: null,
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

  const routineActive =
    params.reason === "routine_ambiguity" && params.routineThreadContext?.active === true
  return {
    answer_mode: "clarification",
    interpreted_intent: "AgentV2 fallback clarification.",
    request_interpretation: {
      primary_intent: "clarification",
      product_request_kind: "none",
      routine_intent: "none",
      category: "unknown",
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
      category: "none",
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
      category: "unknown",
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
      category: "none",
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
    interpretation.category,
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
