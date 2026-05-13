import type OpenAI from "openai"

import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import type { UserContextProjection } from "@/lib/agent/tools/get-user-context"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
import type { AgenticAnswerContext } from "@/lib/agent/orchestrator/agentic-answer-context"
import type { AgenticConsultationBrief } from "@/lib/agent/orchestrator/agentic-consultation-brief"
import type { AdvisorGuidanceProjection } from "@/lib/agent/tools/load-advisor-guidance"
import type { ConversationState, ConversationStateTransition } from "@/lib/types"

export type ChatAgentEngine = "classic" | "tool_loop"

export const AGENTIC_PRODUCT_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const

export type AgenticProductCategory = (typeof AGENTIC_PRODUCT_CATEGORIES)[number]

export type AgenticToolName =
  | "load_advisor_guidance"
  | "select_products"
  | "build_or_fix_routine"
  | "submit_final_answer"

export type AgenticAnswerCompositionMode = "inline_context" | "composer_context"

export interface AgenticTerminalAnswer {
  answer: string
  product_ids: string[]
  state_patch: {
    active_topic: "routine" | AgenticProductCategory | null
    routine_layer: "basics" | "goals" | "problems" | "deep_dive" | null
    last_product_category: AgenticProductCategory | null
    last_assistant_action: string
    topic_relation: "same_topic" | "category_switch" | "refinement" | "recap" | "unclear"
    reason: string
  }
}

export type AgenticToolLoopFailureStage =
  | "missing_terminal_answer"
  | "multiple_terminal_answers"
  | "terminal_with_other_tool_calls"
  | "max_executable_tool_calls"
  | "max_model_steps"
  | "repair_failed"
  | null

export interface AgenticModelToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export type AgenticToolLoopModelStep =
  | {
      type: "tool_calls"
      calls: AgenticModelToolCall[]
    }
  | {
      type: "message"
      content: string
    }

export interface AgenticToolLoopModelClient {
  runStep(params: {
    systemPrompt: string
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  }): Promise<AgenticToolLoopModelStep>
  composeFinalAnswer?(params: {
    systemPrompt: string
    message: string
    recentMessages: Array<{ role: "user" | "assistant"; content: string }>
    userContext: UserContextProjection
    conversationState: ConversationState | null | undefined
    selectedProducts: SelectedProductsProjection | null
    routinePlan: BuildOrFixRoutineProjection | null
    advisorGuidance: AdvisorGuidanceProjection | null
    answerContext: AgenticAnswerContext
    draftAnswer: string
  }): Promise<string>
}

export interface AgenticExecutedToolCall {
  id: string
  name: Exclude<AgenticToolName, "submit_final_answer">
  input: Record<string, unknown>
  output: unknown
}

export interface AgenticBlockedToolCall {
  id: string
  name: string
  reason:
    | "tool_not_allowed"
    | "invalid_json"
    | "invalid_category"
    | "duplicate_category"
    | "conceptual_category_curiosity"
    | "redundant_advisor_guidance_after_product"
    | "prior_recommendation_explanation_requires_product_facts"
    | "max_executable_tool_calls"
    | "multiple_terminal_answers"
    | "terminal_with_other_tool_calls"
}

export interface AgenticToolLoopTrace {
  engine_variant: ChatAgentEngine
  answer_composition_mode: AgenticAnswerCompositionMode | "baseline"
  answer_context: AgenticAnswerContext | null
  advisor_guidance: AdvisorGuidanceProjection | null
  consultation_brief: AgenticConsultationBrief | null
  model_steps: AgenticToolLoopModelStep[]
  tool_calls: AgenticExecutedToolCall[]
  blocked_tool_calls: AgenticBlockedToolCall[]
  guardrails: string[]
  repair_attempts: Array<{
    reason: Exclude<AgenticToolLoopFailureStage, null>
    instruction_label: "terminal_protocol_repair"
  }>
  failure_stage: AgenticToolLoopFailureStage
  visible_failure: boolean
}

export interface AgenticToolTurnResult {
  final_answer: string
  selected_products: SelectedProductsProjection | null
  routine_plan: BuildOrFixRoutineProjection | null
  advisor_guidance: AdvisorGuidanceProjection | null
  surfaced_product_ids: string[]
  tool_calls: AgenticExecutedToolCall[]
  state_transition: ConversationStateTransition
  trace: AgenticToolLoopTrace
}

export interface AgenticToolTurnParams {
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  modelClient: AgenticToolLoopModelClient
  tools: Record<
    "select_products" | "build_or_fix_routine",
    (input: Record<string, unknown>) => Promise<unknown>
  > & {
    load_advisor_guidance?: (input: Record<string, unknown>) => Promise<unknown>
  }
  userContext: UserContextProjection
  conversationState?: ConversationState | null
  consultationBrief?: AgenticConsultationBrief | null
  answerCompositionMode?: AgenticAnswerCompositionMode
  maxModelSteps?: number
  maxExecutableToolCalls?: number
}
