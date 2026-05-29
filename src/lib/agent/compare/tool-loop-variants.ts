import type { AgenticConsultationBrief } from "@/lib/agent/orchestrator/agentic-consultation-brief"
import type { AgenticAnswerCompositionMode } from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import type { AgentCompareToolLoopVariant } from "./types"

export const DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT =
  "guidance_tool" satisfies AgentCompareToolLoopVariant

export const AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS: Array<{
  value: AgentCompareToolLoopVariant
  label: string
}> = [
  { value: "guidance_tool", label: "Produkt-Evaluation (Legacy)" },
  { value: "inline_context", label: "Beratungsbrief (Legacy)" },
  { value: "composer_context", label: "Composer-Kontext (Legacy)" },
  { value: "baseline", label: "Baseline ohne Zusatzkontext" },
]

export function resolveAgentCompareToolLoopVariant(
  variant: AgentCompareToolLoopVariant | undefined,
): AgentCompareToolLoopVariant {
  return variant ?? DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT
}

export function resolveAgentCompareAnswerCompositionMode(
  variant: AgentCompareToolLoopVariant,
): AgenticAnswerCompositionMode | undefined {
  if (variant === "inline_context" || variant === "guidance_tool") return "inline_context"
  if (variant === "composer_context") return "composer_context"
  return undefined
}

export function shouldEnableAdvisorGuidanceTool(variant: AgentCompareToolLoopVariant): boolean {
  return variant === "guidance_tool"
}

export function resolveAgentCompareConsultationBriefOverride(
  variant: AgentCompareToolLoopVariant,
): AgenticConsultationBrief | null | undefined {
  return variant === "baseline" ? null : undefined
}
