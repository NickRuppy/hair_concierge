import type OpenAI from "openai"
import { GUIDANCE_IDS, SELECTABLE_PRODUCT_CATEGORIES } from "@/lib/agent/contracts"
import {
  ACTIVE_PROFILE_SIGNAL_FIELDS,
  ACTIVE_SIGNAL_SELECTION_EFFECTS,
} from "@/lib/agent/orchestrator/route-packet"

export const AGENT_TOOL_NAMES = [
  "get_user_context",
  "load_guidance",
  "select_products",
  "build_or_fix_routine",
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

export function buildAgentToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "get_user_context",
        description:
          "Load the structured user profile, routine inventory, relevant memory, and suggested overlays.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "load_guidance",
        description:
          "Load named playbooks, overlays, routines, and topics with their short markdown guidance.",
        parameters: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: {
                type: "string",
                enum: GUIDANCE_IDS,
              },
              minItems: 1,
              uniqueItems: true,
            },
          },
          required: ["ids"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "select_products",
        description:
          "Return the authoritative product decision for a single category, including whether to recommend products, ask for blocking info, decline the category, or report no catalog match.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: SELECTABLE_PRODUCT_CATEGORIES,
            },
            userJob: {
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
            concerns: {
              type: "array",
              items: {
                type: "string",
                enum: ["oily_roots", "dry_lengths", "dandruff_or_flakes", "irritation", "frizz"],
              },
            },
            requestedGoal: {
              type: "string",
              enum: ["shine"],
              description:
                "Optional explicit cosmetic goal derived from the user request; currently only shine/gloss intent is supported.",
            },
            activeProfileSignals: {
              type: "array",
              description:
                "Optional active profile-like signals from the current user message; runtime-owned in bounded agent mode.",
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
          },
          required: ["category"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "build_or_fix_routine",
        description:
          "Return the authoritative routine structure for building or simplifying a routine.",
        parameters: {
          type: "object",
          properties: {
            objective: {
              type: "string",
              enum: ["build_routine", "fix_routine"],
            },
          },
          additionalProperties: false,
        },
      },
    },
  ]
}
