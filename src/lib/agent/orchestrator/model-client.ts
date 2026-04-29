import type OpenAI from "openai"

import { DEFAULT_CHAT_COMPLETION_MODEL } from "@/lib/openai/chat"
import { getObservedOpenAI } from "@/lib/openai/client"
import type { AgentToolName } from "@/lib/agent/orchestrator/tool-definitions"
import {
  AGENT_ROUTE_CLASSIFIER_PROMPT,
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

export function createOpenAIToolModelClient(params: { model?: string } = {}): AgentModelClient {
  return {
    async classifyRoute({ systemPrompt = AGENT_ROUTE_CLASSIFIER_PROMPT, message, userContext }) {
      const response = await getObservedOpenAI({
        generationName: "bounded-agent-route-classification",
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
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
      const response = await getObservedOpenAI({
        generationName: "bounded-agent-final-render",
      }).chat.completions.create({
        model: params.model ?? DEFAULT_CHAT_COMPLETION_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
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
