import type { AgentV2ModelPolicy } from "@/lib/agent-v2/model-policy"
import type {
  AgentV2RoutineThreadContext,
  AgentV2SafetyMode,
  AgentV2SessionMemoryWrite,
  AgentV2Trace,
} from "@/lib/agent-v2/contracts"

export function createAgentV2Trace(params: {
  safetyMode: AgentV2SafetyMode
  policy: AgentV2ModelPolicy
  injectedSessionMemory: AgentV2SessionMemoryWrite[]
  routineThreadContext?: AgentV2RoutineThreadContext | null
  langfuseEnabled?: boolean
}): AgentV2Trace {
  return {
    engine: "agent_v2",
    model: params.policy.model,
    endpoint: "responses",
    reasoning_effort: params.policy.reasoning_effort,
    safety_mode: params.safetyMode,
    answer_mode: null,
    response_ids: [],
    model_steps: [],
    tool_calls: [],
    blocked_tool_calls: [],
    loaded_guidance_package_ids: [],
    validation_errors: [],
    validation_warnings: [],
    request_interpretation: null,
    request_interpretation_summary: null,
    bounded_repair_kind: null,
    repair_attempts: [],
    routine_thread_context_active: params.routineThreadContext?.active ?? false,
    routine_thread_context: params.routineThreadContext ?? null,
    final_product_ids: [],
    routine_layer: null,
    session_memory_writes: [],
    dropped_session_memory_writes: [],
    injected_session_memory: params.injectedSessionMemory,
    langfuse: {
      enabled: params.langfuseEnabled ?? false,
      trace_id: null,
      trace_url: null,
    },
    failure_stage: null,
  }
}
