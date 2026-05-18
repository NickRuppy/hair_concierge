import {
  AgentV2ReasoningEffortSchema,
  AgentV2TextVerbositySchema,
  type AgentV2ReasoningEffort,
  type AgentV2TextVerbosity,
} from "@/lib/agent-v2/contracts"

export const DEFAULT_AGENT_V2_MODEL = "gpt-5.4-mini-2026-03-17"

export interface AgentV2ModelPolicy {
  endpoint: "responses"
  model: string
  reasoning_effort: AgentV2ReasoningEffort
  text_verbosity: AgentV2TextVerbosity
  store: false
  max_model_steps: number
  max_executable_tool_calls: number
  max_repair_turns: number
}

export function getAgentV2ModelPolicy(
  env: Record<string, string | undefined> = process.env,
): AgentV2ModelPolicy {
  return {
    endpoint: "responses",
    model: env.AGENT_V2_MODEL?.trim() || DEFAULT_AGENT_V2_MODEL,
    reasoning_effort: parseReasoningEffort(env.AGENT_V2_REASONING_EFFORT),
    text_verbosity: parseTextVerbosity(env.AGENT_V2_TEXT_VERBOSITY),
    store: false,
    max_model_steps: parsePositiveInteger(env.AGENT_V2_MAX_MODEL_STEPS, 6),
    max_executable_tool_calls: parsePositiveInteger(env.AGENT_V2_MAX_EXECUTABLE_TOOL_CALLS, 5),
    max_repair_turns: parseNonNegativeInteger(env.AGENT_V2_MAX_REPAIR_TURNS, 1),
  }
}

function parseReasoningEffort(value: string | undefined): AgentV2ReasoningEffort {
  const parsed = AgentV2ReasoningEffortSchema.safeParse(value)
  return parsed.success ? parsed.data : "low"
}

function parseTextVerbosity(value: string | undefined): AgentV2TextVerbosity {
  const parsed = AgentV2TextVerbositySchema.safeParse(value)
  return parsed.success ? parsed.data : "low"
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
