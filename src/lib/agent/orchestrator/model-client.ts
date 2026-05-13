import type OpenAI from "openai"

import { DEFAULT_CHAT_COMPLETION_MODEL } from "@/lib/openai/chat"
import { getObservedOpenAI } from "@/lib/openai/client"
import {
  buildLangfusePromptConfig,
  getManagedTextPromptTemplate,
  LANGFUSE_PROMPTS,
  type PromptDefinition,
} from "@/lib/langfuse/prompts"
import type {
  AgenticToolLoopModelClient,
  AgenticToolLoopModelStep,
} from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import type { AgentToolName } from "@/lib/agent/orchestrator/tool-definitions"
import type { LangfusePromptReference } from "@/lib/types"
import {
  AGENT_ROUTE_CLASSIFIER_PROMPT,
  AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  AGENTIC_TOOL_LOOP_PROMPT,
  AGENT_FINAL_RENDER_PROMPT,
} from "@/lib/agent/orchestrator/prompt"
import {
  ACTIVE_PROFILE_SIGNAL_FIELDS,
  ACTIVE_SIGNAL_SELECTION_EFFECTS,
  isAgentConcern,
  isAgentUserJob,
  isActiveProfileSignalField,
  isActiveSignalSelectionEffect,
  type AgentActiveProfileSignal,
  type AgentConcern,
  type AgentRouteClassification,
  type AgentRuntimePacket,
  type AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import {
  GUIDANCE_IDS,
  SELECTABLE_PRODUCT_CATEGORIES,
  type GuidanceId,
  type SelectableProductCategory,
} from "@/lib/agent/contracts"

export type AgentToolCallHistory = {
  id: string
  name: AgentToolName
  input: Record<string, unknown>
  output: unknown
}

export interface AgentModelClient {
  classifyRoute(params: {
    systemPrompt?: string
    message: string
    userContext: unknown
  }): Promise<AgentRouteClassification>
  renderFinalAnswer(params: {
    systemPrompt?: string
    message: string
    packet: AgentRuntimePacket
  }): Promise<string>
}

export type { AgenticToolLoopModelClient, AgenticToolLoopModelStep }

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function clampConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5
}

function parseRouteClassification(raw: string): AgentRouteClassification {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const rawUserJob = nullableString(parsed.user_job)
  const rawCategory = nullableString(parsed.product_category)
  const rawRoutineId = nullableString(parsed.requested_routine_id)
  const activeProfileSignals = Array.isArray(parsed.active_profile_signals)
    ? parsed.active_profile_signals.flatMap((rawSignal): AgentActiveProfileSignal[] => {
        if (!rawSignal || typeof rawSignal !== "object") return []
        const signal = rawSignal as Record<string, unknown>
        const field = nullableString(signal.field)
        const value = nullableString(signal.value)
        const source = nullableString(signal.source)
        const selectionEffect = nullableString(signal.selection_effect)
        const evidence = nullableString(signal.evidence) ?? ""

        if (
          !field ||
          !isActiveProfileSignalField(field) ||
          !value ||
          source !== "message" ||
          !selectionEffect ||
          !isActiveSignalSelectionEffect(selectionEffect)
        ) {
          return []
        }

        return [
          {
            field,
            value,
            source: "message",
            selection_effect: selectionEffect,
            evidence,
          },
        ]
      })
    : []

  return {
    user_job:
      rawUserJob && isAgentUserJob(rawUserJob)
        ? rawUserJob
        : ("unsupported_or_unclear" as AgentUserJob),
    product_category: rawCategory ? (rawCategory as SelectableProductCategory) : null,
    requested_overlay_ids: stringArray(parsed.requested_overlay_ids) as GuidanceId[],
    requested_topic_ids: stringArray(parsed.requested_topic_ids) as GuidanceId[],
    requested_routine_id: rawRoutineId ? (rawRoutineId as GuidanceId) : null,
    concerns: stringArray(parsed.concerns).filter(isAgentConcern) as AgentConcern[],
    active_profile_signals: activeProfileSignals,
    confidence: clampConfidence(parsed.confidence),
    evidence: stringArray(parsed.evidence).slice(0, 4),
    ambiguity: nullableString(parsed.ambiguity),
  }
}

const ROUTE_CLASSIFICATION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "agent_route_classification",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "user_job",
        "product_category",
        "requested_overlay_ids",
        "requested_topic_ids",
        "requested_routine_id",
        "concerns",
        "active_profile_signals",
        "confidence",
        "evidence",
        "ambiguity",
      ],
      properties: {
        user_job: {
          type: "string",
          enum: [
            "product_pick",
            "compare_or_decide",
            "routine_structure",
            "troubleshoot",
            "usage",
            "unsupported_or_unclear",
          ],
        },
        product_category: {
          anyOf: [{ type: "string", enum: SELECTABLE_PRODUCT_CATEGORIES }, { type: "null" }],
        },
        requested_overlay_ids: {
          type: "array",
          items: { type: "string", enum: GUIDANCE_IDS },
        },
        requested_topic_ids: {
          type: "array",
          items: { type: "string", enum: GUIDANCE_IDS },
        },
        requested_routine_id: {
          anyOf: [{ type: "string", enum: GUIDANCE_IDS }, { type: "null" }],
        },
        concerns: {
          type: "array",
          items: {
            type: "string",
            enum: ["oily_roots", "dry_lengths", "dandruff_or_flakes", "irritation", "frizz"],
          },
        },
        active_profile_signals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["field", "value", "source", "selection_effect", "evidence"],
            properties: {
              field: { type: "string", enum: ACTIVE_PROFILE_SIGNAL_FIELDS },
              value: { type: "string" },
              source: { type: "string", enum: ["message"] },
              selection_effect: { type: "string", enum: ACTIVE_SIGNAL_SELECTION_EFFECTS },
              evidence: { type: "string" },
            },
          },
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        evidence: { type: "array", items: { type: "string" } },
        ambiguity: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    },
  },
} satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming["response_format"]

async function resolveManagedAgentPrompt(params: {
  systemPrompt: string
  prompt: PromptDefinition
}): Promise<{
  systemPrompt: string
  langfuseConfig: Parameters<typeof getObservedOpenAI>[0]
  ref: LangfusePromptReference | null
}> {
  if (params.systemPrompt !== params.prompt.fallback) {
    return {
      systemPrompt: params.systemPrompt,
      langfuseConfig: undefined,
      ref: null,
    }
  }

  const managedPrompt = await getManagedTextPromptTemplate(params.prompt)

  return {
    systemPrompt: managedPrompt.template,
    langfuseConfig: {
      generationMetadata: {
        prompt_label: managedPrompt.ref.label,
        prompt_is_fallback: String(managedPrompt.ref.is_fallback),
      },
      langfusePrompt: buildLangfusePromptConfig(managedPrompt.ref),
    },
    ref: managedPrompt.ref,
  }
}

type ManagedAgentPromptObserver = (event: {
  prompt: PromptDefinition
  ref: LangfusePromptReference
}) => void

function createManagedAgentPromptResolver(
  params: {
    onManagedPrompt?: ManagedAgentPromptObserver
  } = {},
) {
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof resolveManagedAgentPrompt>>>>()

  return async (input: {
    systemPrompt: string
    prompt: PromptDefinition
  }): ReturnType<typeof resolveManagedAgentPrompt> => {
    if (input.systemPrompt !== input.prompt.fallback) {
      return resolveManagedAgentPrompt(input)
    }

    let resolved = cache.get(input.prompt.name)
    if (!resolved) {
      resolved = resolveManagedAgentPrompt(input)
      cache.set(input.prompt.name, resolved)
    }

    const managedPrompt = await resolved
    if (managedPrompt.ref) {
      params.onManagedPrompt?.({ prompt: input.prompt, ref: managedPrompt.ref })
    }

    return managedPrompt
  }
}

export function createOpenAIToolModelClient(
  params: { model?: string; onManagedPrompt?: ManagedAgentPromptObserver } = {},
): AgentModelClient {
  const resolvePrompt = createManagedAgentPromptResolver({
    onManagedPrompt: params.onManagedPrompt,
  })

  return {
    async classifyRoute({ systemPrompt = AGENT_ROUTE_CLASSIFIER_PROMPT, message, userContext }) {
      const managedPrompt = await resolvePrompt({
        systemPrompt,
        prompt: LANGFUSE_PROMPTS.agentRouteClassifier,
      })
      const response = await getObservedOpenAI({
        generationName: "bounded-agent-route-classification",
        ...managedPrompt.langfuseConfig,
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: managedPrompt.systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              message,
              user_context: userContext,
            }),
          },
        ],
        response_format: ROUTE_CLASSIFICATION_RESPONSE_FORMAT,
      })

      const raw = response.choices[0]?.message?.content?.trim() ?? ""

      return parseRouteClassification(raw)
    },
    async renderFinalAnswer({ systemPrompt = AGENT_FINAL_RENDER_PROMPT, message, packet }) {
      const managedPrompt = await resolvePrompt({
        systemPrompt,
        prompt: LANGFUSE_PROMPTS.agentFinalRender,
      })
      const response = await getObservedOpenAI({
        generationName: "bounded-agent-final-render",
        ...managedPrompt.langfuseConfig,
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: managedPrompt.systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              message,
              packet,
            }),
          },
        ],
      })

      return typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : ""
    },
  }
}

function parseToolCallInput(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function createOpenAIAgenticToolLoopModelClient(
  params: { model?: string; onManagedPrompt?: ManagedAgentPromptObserver } = {},
): AgenticToolLoopModelClient {
  const resolvePrompt = createManagedAgentPromptResolver({
    onManagedPrompt: params.onManagedPrompt,
  })

  return {
    async runStep({ systemPrompt, messages, tools }) {
      const managedPrompt = await resolvePrompt({
        systemPrompt,
        prompt: LANGFUSE_PROMPTS.agenticToolLoop,
      })
      const response = await getObservedOpenAI({
        generationName: "agentic-tool-loop-step",
        ...managedPrompt.langfuseConfig,
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [{ role: "system", content: managedPrompt.systemPrompt }, ...messages],
        tools,
      })

      const message = response.choices[0]?.message
      const toolCalls = message?.tool_calls ?? []

      if (toolCalls.length > 0) {
        return {
          type: "tool_calls",
          calls: toolCalls
            .filter(
              (
                call,
              ): call is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
                type: "function"
              } => call.type === "function",
            )
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              input: parseToolCallInput(call.function.arguments),
            })),
        }
      }

      return {
        type: "message",
        content: typeof message?.content === "string" ? message.content : "",
      }
    },
    async composeFinalAnswer({ systemPrompt = AGENTIC_CONTEXTUAL_COMPOSER_PROMPT, ...input }) {
      const managedPrompt = await resolvePrompt({
        systemPrompt,
        prompt: LANGFUSE_PROMPTS.agenticContextualComposer,
      })
      const response = await getObservedOpenAI({
        generationName: "agentic-tool-loop-contextual-composer",
        ...managedPrompt.langfuseConfig,
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: managedPrompt.systemPrompt },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      })

      return typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : ""
    },
  }
}
