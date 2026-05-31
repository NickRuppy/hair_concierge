import { startObservation } from "@langfuse/tracing"

type AgentV2TraceLike = {
  model_steps: readonly unknown[]
  tool_calls: readonly { name?: unknown; latency_ms?: unknown }[]
  blocked_tool_calls: readonly unknown[]
  repair_attempts: readonly unknown[]
  loaded_guidance_package_ids: readonly string[]
  response_ids: readonly string[]
  validation_errors: readonly unknown[]
  validation_warnings: readonly unknown[]
  answer_mode: string | null
  safety_mode: string
  failure_stage: string | null
  routine_thread_context_active: boolean
  final_product_ids: readonly string[]
  langfuse?: { enabled?: boolean; trace_id?: string | null; trace_url?: string | null }
}

export function isAgentV2LangfuseObservationEnabled(): boolean {
  return process.env.AGENT_V2_LANGFUSE_OBSERVATION !== "disabled"
}

export function buildAgentV2GenerationMetadata(params: {
  conversationId: string
  requestId: string
  safetyMode: string
  engine: "agent_v2"
  endpoint: "responses"
  migrationMode: "agent_v2_care_balance"
}): Record<string, string | number | boolean | null> {
  return {
    conversation_id: params.conversationId,
    request_id: params.requestId,
    engine: params.engine,
    endpoint: params.endpoint,
    safety_mode: params.safetyMode,
    migration_mode: params.migrationMode,
  }
}

export function summarizeAgentV2TraceForLangfuse(trace: AgentV2TraceLike) {
  return {
    engine: "agent_v2",
    model_step_count: trace.model_steps.length,
    tool_call_count: trace.tool_calls.length,
    blocked_tool_call_count: trace.blocked_tool_calls.length,
    repair_count: trace.repair_attempts.length,
    loaded_guidance_ids: trace.loaded_guidance_package_ids,
    response_ids: trace.response_ids,
    validation_error_count: trace.validation_errors.length,
    validation_warning_count: trace.validation_warnings.length,
    answer_mode: trace.answer_mode,
    safety_mode: trace.safety_mode,
    failure_stage: trace.failure_stage,
    routine_thread_context_active: trace.routine_thread_context_active,
    final_product_ids: trace.final_product_ids,
    langfuse_enabled: trace.langfuse?.enabled ?? false,
  }
}

export function summarizeAgentV2ToolInput(name: string, input: Record<string, unknown>) {
  return {
    name,
    category: typeof input.category === "string" ? input.category : null,
    requested_category:
      typeof input.requested_category === "string" ? input.requested_category : null,
    product_request_kind:
      typeof input.product_request_kind === "string" ? input.product_request_kind : null,
    requested_product_count:
      typeof input.requested_product_count === "number" ? input.requested_product_count : null,
    has_effective_care_context: Boolean(input.effective_care_context),
  }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : []
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function summarizeAgentV2ToolOutput(name: string, output: unknown) {
  const object = readObject(output)
  const projection = readObject(object?.projection) ?? object
  const products = Array.isArray(projection?.products) ? projection.products : null
  const visibleSteps = Array.isArray(projection?.visible_steps)
    ? projection.visible_steps
    : Array.isArray(projection?.steps)
      ? projection.steps
      : null
  const loadedGuidanceIds = [
    ...readStringArray(object?.loaded_package_ids),
    ...readStringArray(projection?.loaded_guidance_ids),
  ]

  return {
    name,
    valid_product_ids: readStringArray(projection?.valid_product_ids),
    product_count: products ? products.length : null,
    routine_step_count: visibleSteps ? visibleSteps.length : null,
    loaded_guidance_ids: loadedGuidanceIds,
  }
}

export async function observeAgentV2ToolCall<T>(params: {
  name: string
  input: Record<string, unknown>
  run: () => Promise<T>
}): Promise<T> {
  const observation = startObservation(
    `agent-v2-tool:${params.name}`,
    {
      input: summarizeAgentV2ToolInput(params.name, params.input),
      metadata: { engine: "agent_v2" },
    },
    { asType: "tool" },
  )

  try {
    const output = await params.run()
    observation.update({
      output: summarizeAgentV2ToolOutput(params.name, output),
    })
    return output
  } catch (error) {
    observation.update({
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : "agent_v2_tool_error",
    })
    throw error
  } finally {
    observation.end()
  }
}
