import { z } from "zod"

import {
  AgentV2AnswerModeSchema,
  AgentV2ClarificationPayloadSchema,
  AgentV2CountPolicySchema,
  AgentV2ConstraintBlockedPayloadSchema,
  AgentV2ExtractedConstraintsSchema,
  AgentV2GeneralAdvicePayloadSchema,
  AgentV2MissingInformationSchema,
  AgentV2PendingRoutineActionSchema,
  AgentV2ProductRecommendationPayloadSchema,
  AgentV2ProductRequestKindSchema,
  AgentV2RequestInterpretationSchema,
  AgentV2RoutineIntentSchema,
  AgentV2RoutineLayerSchema,
  AgentV2RoutineContextSchema,
  AgentV2RoutinePayloadSchema,
  AgentV2SafetyBoundaryPayloadSchema,
  AgentV2SessionMemoryWriteSchema,
  AgentV2ToolGroundingSchema,
} from "@/lib/agent-v2/contracts"
import {
  AgentV2GuidanceCategorySchema,
  LoadAgentV2AdvisorGuidanceInputSchema,
} from "@/lib/agent-v2/tools/guidance-tool"

export interface AgentV2ResponsesToolDefinition {
  type: "function"
  name: string
  description: string
  strict: true
  parameters: Record<string, unknown>
}

export function buildAgentV2ResponsesTools(params: {
  safetyMode: "normal" | "restricted" | "hard_short_circuit"
}): AgentV2ResponsesToolDefinition[] {
  if (params.safetyMode === "hard_short_circuit") {
    throw new Error("Hard short circuit bypasses the AgentV2 tool loop")
  }

  const tools: AgentV2ResponsesToolDefinition[] = [
    {
      type: "function",
      name: "load_advisor_guidance",
      description:
        "Load compact AgentV2 advisor guidance packages for the current answer mode, categories, routine layer, and safety mode. Use this before category-specific claims, product recommendations, routine answers, and non-trivial general advice so the final answer is grounded in AgentV2 guidance rather than model memory. For named-product detail checks and product-specific claim checks, use answer_mode_hint product_recommendation even if the final answer may clarify because catalog data is missing; examples include 'Ist Produkt X farbsicher?' and 'Kann ich Produkt X als Hitzeschutz benutzen?'. For hard-water, metal/mineral, chelating, clarifying, detox, reset, buildup, or coated/waxy shampoo questions, load deep_cleansing_shampoo instead of normal shampoo. For K18, OLAPLEX, Epres, acidic bonding, bond repair, or exact bond-repair protocol questions, load bondbuilder even when the product behaves like a leave-in or mask.",
      strict: true,
      parameters: toStrictJsonSchema(LoadAgentV2AdvisorGuidanceInputSchema),
    },
    {
      type: "function",
      name: "build_or_fix_routine",
      description:
        "Build or adjust a saved/current staged routine using the existing deterministic routine planner. Call this for requests to change, simplify, lighten, extend, add to, remove from, or rebalance routine state, including 'was soll ich aendern', 'Routine einfacher machen', 'keine schwere Routine', and 'fuege ... ein'. When the user asks to add or integrate a referenced product, treat it as a category-level routine step for now: pass requested_category and mutation_kind add_step, and mention the referenced product only in prose when grounded by conversation context. Routine payload step IDs must come only from routine tool output or active routine context; never invent product-named step IDs. Do not call this for general placement, order, or usage questions such as 'where does this fit in my routine?' unless the user asks to add, remove, replace, or change routine state; answer those as routine_explanation with routine_intent none.",
      strict: true,
      parameters: toStrictJsonSchema(BuildOrFixRoutineToolInputSchema),
    },
    {
      type: "function",
      name: "submit_final_answer",
      description: "Terminal tool. Submit the typed AgentV2 final answer. This ends the turn.",
      strict: true,
      parameters: toStrictJsonSchema(AgentV2TerminalAnswerToolParametersSchema),
    },
  ]

  if (params.safetyMode === "normal") {
    tools.splice(1, 0, {
      type: "function",
      name: "select_products",
      description:
        "Select grounded products from the catalog for an explicit product ask, comparison, or named-product detail/claim check. For product_detail turns such as 'Can I use Product X as heat protectant?', 'Is Product X color-safe?', or 'Is Product X chelating?', this tool is required before any terminal answer, including clarification or unsupported-claim answers. Load product_recommendation guidance first and use product_request_kind product_detail. For product asks inside active routine threads, use product_request_kind specific_products and preserve routine context in the final answer. For hard-water, metal/mineral, chelating, clarifying, detox, reset, buildup, or coated/waxy shampoo asks, use category deep_cleansing_shampoo instead of shampoo. For K18, OLAPLEX, Epres, acidic bonding, bond repair, or exact bond-repair protocol asks, use category bondbuilder instead of leave_in or mask.",
      strict: true,
      parameters: toStrictJsonSchema(SelectProductsToolInputSchema),
    })
  }

  return tools
}

export const SelectProductsToolInputSchema = z.strictObject({
  category: AgentV2GuidanceCategorySchema.describe(
    "Product category. Use deep_cleansing_shampoo for hard-water, metal/mineral, chelating, clarifying, detox, reset, buildup, or coated/waxy shampoo asks even when the product name contains Shampoo.",
  ),
  reason: z.string(),
  user_request: z.string().nullable(),
  constraints: z.array(z.string()),
  product_request_kind: AgentV2ProductRequestKindSchema,
  requested_product_count: z.number().int().min(0).max(6).nullable(),
  count_policy: AgentV2CountPolicySchema,
  evidence_quote: z.string().min(1),
})

export type SelectProductsToolInput = z.infer<typeof SelectProductsToolInputSchema>

export const BuildOrFixRoutineToolInputSchema = z.strictObject({
  objective: z.enum(["build_routine", "fix_routine"]).nullable(),
  requested_layer: AgentV2RoutineLayerSchema,
  requested_category: AgentV2GuidanceCategorySchema.nullable(),
  reason: z.string(),
  routine_intent: AgentV2RoutineIntentSchema,
  mutation_kind: z
    .enum(["none", "add_step", "remove_step", "replace_product", "change_frequency", "simplify"])
    .nullable(),
  evidence_quote: z.string().min(1),
})

export type BuildOrFixRoutineToolInput = z.infer<typeof BuildOrFixRoutineToolInputSchema>

const AgentV2TerminalAnswerToolParametersSchema = z.strictObject({
  answer_mode: AgentV2AnswerModeSchema,
  interpreted_intent: z.string(),
  request_interpretation: AgentV2RequestInterpretationSchema,
  confidence: z.number().min(0).max(1),
  extracted_constraints: AgentV2ExtractedConstraintsSchema,
  missing_information: z.array(AgentV2MissingInformationSchema),
  safety_flags: z.array(z.string()),
  tool_grounding: AgentV2ToolGroundingSchema,
  routine_context: AgentV2RoutineContextSchema,
  pending_routine_action: AgentV2PendingRoutineActionSchema.nullable(),
  session_memory_writes: z.array(AgentV2SessionMemoryWriteSchema),
  payload: z.union([
    AgentV2ProductRecommendationPayloadSchema,
    AgentV2RoutinePayloadSchema,
    AgentV2GeneralAdvicePayloadSchema,
    AgentV2ClarificationPayloadSchema,
    AgentV2ConstraintBlockedPayloadSchema,
    AgentV2SafetyBoundaryPayloadSchema,
  ]),
})

function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    unrepresentable: "any",
  }) as Record<string, unknown>
  return normalizeStrictJsonSchema(jsonSchema)
}

function normalizeStrictJsonSchema(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return normalizeJsonSchemaNode(value) as Record<string, unknown>
}

function normalizeJsonSchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJsonSchemaNode)
  if (!value || typeof value !== "object") return value

  const node = { ...(value as Record<string, unknown>) }
  delete node.$schema

  if (Array.isArray(node.oneOf)) {
    node.anyOf = node.oneOf
    delete node.oneOf
  }

  if (Array.isArray(node.anyOf)) {
    const nullable = collapseNullableAnyOf(node.anyOf)
    if (nullable) {
      delete node.anyOf
      Object.assign(node, nullable)
    }
  }

  for (const [key, child] of Object.entries(node)) {
    node[key] = normalizeJsonSchemaNode(child)
  }

  return node
}

function collapseNullableAnyOf(anyOf: unknown[]): Record<string, unknown> | null {
  if (anyOf.length !== 2) return null
  const normalized = anyOf.map((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? ({ ...(entry as Record<string, unknown>) } as Record<string, unknown>)
      : null,
  )
  const nullIndex = normalized.findIndex((entry) => entry?.type === "null")
  const valueIndex = nullIndex === 0 ? 1 : nullIndex === 1 ? 0 : -1
  const valueSchema = valueIndex >= 0 ? normalized[valueIndex] : null
  if (!valueSchema || typeof valueSchema.type !== "string") return null

  const nullableSchema: Record<string, unknown> = {
    ...valueSchema,
    type: [valueSchema.type, "null"],
  }
  if (Array.isArray(nullableSchema.enum)) {
    nullableSchema.enum = [...nullableSchema.enum, null]
  }
  return nullableSchema
}
