import type OpenAI from "openai"
import { GUIDANCE_IDS, SELECTABLE_PRODUCT_CATEGORIES } from "@/lib/agent/contracts"
import { AGENTIC_PRODUCT_CATEGORIES } from "@/lib/agent/orchestrator/agentic-tool-loop-types"
import {
  ACTIVE_PROFILE_SIGNAL_FIELDS,
  ACTIVE_SIGNAL_SELECTION_EFFECTS,
} from "@/lib/agent/orchestrator/route-packet"
import {
  ADVISOR_GUIDANCE_CATEGORIES,
  ADVISOR_GUIDANCE_INTENTS,
  ADVISOR_PROFILE_FOCUS,
} from "@/lib/agent/tools/load-advisor-guidance"

export const AGENT_TOOL_NAMES = [
  "get_user_context",
  "load_guidance",
  "select_products",
  "build_or_fix_routine",
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

const AGENT_USER_JOBS = [
  "product_pick",
  "compare_or_decide",
  "routine_structure",
  "troubleshoot",
  "usage",
  "unsupported_or_unclear",
] as const

const AGENT_CONCERNS = [
  "oily_roots",
  "dry_lengths",
  "dandruff_or_flakes",
  "irritation",
  "frizz",
] as const

const ROUTINE_LAYERS = ["basics", "goals", "problems", "deep_dive"] as const

const TOPIC_RELATIONS = ["same_topic", "category_switch", "refinement", "recap", "unclear"] as const

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

export function buildAgenticToolDefinitions(
  options: { includeAdvisorGuidance?: boolean } = {},
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    ...(options.includeAdvisorGuidance
      ? ([
          {
            type: "function",
            function: {
              name: "load_advisor_guidance",
              description:
                "Load normalized advisory guidance for conceptual, category-explanation, usage, comparison, problem-context, or routine-context answers. This tool never returns product names, product rankings, product claims, or authoritative routine steps.",
              strict: true,
              parameters: {
                type: "object",
                additionalProperties: false,
                required: ["intent", "category", "categories", "profileFocus"],
                properties: {
                  intent: {
                    type: ["string", "null"],
                    enum: [...ADVISOR_GUIDANCE_INTENTS, null],
                  },
                  category: {
                    type: ["string", "null"],
                    enum: [...ADVISOR_GUIDANCE_CATEGORIES, null],
                  },
                  categories: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ADVISOR_GUIDANCE_CATEGORIES,
                    },
                  },
                  profileFocus: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ADVISOR_PROFILE_FOCUS,
                    },
                  },
                },
              },
            },
          },
        ] satisfies OpenAI.Chat.Completions.ChatCompletionTool[])
      : []),
    {
      type: "function",
      function: {
        name: "select_products",
        description:
          "Return the authoritative product decision for one supported category when the user asks for a concrete product recommendation, product comparison, or product decision.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["category", "userJob", "concerns", "requestedGoal", "activeProfileSignals"],
          properties: {
            category: {
              type: "string",
              enum: AGENTIC_PRODUCT_CATEGORIES,
            },
            userJob: {
              type: ["string", "null"],
              enum: [...AGENT_USER_JOBS, null],
            },
            concerns: {
              type: "array",
              items: {
                type: "string",
                enum: AGENT_CONCERNS,
              },
            },
            requestedGoal: {
              type: ["string", "null"],
              enum: ["shine", null],
            },
            activeProfileSignals: {
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
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "build_or_fix_routine",
        description:
          "Return the authoritative routine structure for routine building, simplification, repair, or restructuring.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["objective", "layer", "requestedCategory"],
          properties: {
            objective: {
              type: ["string", "null"],
              enum: ["build_routine", "fix_routine", null],
            },
            layer: {
              type: ["string", "null"],
              enum: [...ROUTINE_LAYERS, null],
            },
            requestedCategory: {
              type: ["string", "null"],
              enum: [...AGENTIC_PRODUCT_CATEGORIES, null],
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "submit_final_answer",
        description:
          "Terminal tool. Submit the natural German answer plus a constrained short-term state patch. This ends the turn.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["answer", "product_ids", "state_patch"],
          properties: {
            answer: {
              type: "string",
            },
            product_ids: {
              type: "array",
              description:
                "Product IDs explicitly surfaced in the final answer, in display order. Use [] when no product cards should be surfaced.",
              items: {
                type: "string",
              },
            },
            state_patch: {
              type: "object",
              additionalProperties: false,
              required: [
                "active_topic",
                "routine_layer",
                "last_product_category",
                "last_assistant_action",
                "topic_relation",
                "reason",
              ],
              properties: {
                active_topic: {
                  type: ["string", "null"],
                  enum: ["routine", ...AGENTIC_PRODUCT_CATEGORIES, null],
                },
                routine_layer: {
                  type: ["string", "null"],
                  enum: [...ROUTINE_LAYERS, null],
                },
                last_product_category: {
                  type: ["string", "null"],
                  enum: [...AGENTIC_PRODUCT_CATEGORIES, null],
                },
                last_assistant_action: {
                  type: "string",
                },
                topic_relation: {
                  type: "string",
                  enum: TOPIC_RELATIONS,
                },
                reason: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  ]
}
