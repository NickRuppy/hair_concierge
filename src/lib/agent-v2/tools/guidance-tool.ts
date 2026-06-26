import { z } from "zod"

import {
  AgentV2AnswerModeSchema,
  AgentV2RoutineLayerSchema,
  AgentV2SafetyModeSchema,
} from "@/lib/agent-v2/contracts"
import { loadAgentV2GuidancePackages } from "@/lib/agent-v2/guidance/compiler"
import type { AgentV2GuidancePackageId } from "@/lib/agent-v2/guidance/package-index"

export const AgentV2GuidanceCategorySchema = z.enum([
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
])

export type AgentV2GuidanceCategory = z.infer<typeof AgentV2GuidanceCategorySchema>

export const AgentV2GuidanceTopicSchema = z.enum(["night_protection"])

export type AgentV2GuidanceTopic = z.infer<typeof AgentV2GuidanceTopicSchema>

export const LoadAgentV2AdvisorGuidanceInputSchema = z.object({
  answer_mode_hint: AgentV2AnswerModeSchema.nullable().describe(
    "Expected answer mode. Use product_recommendation for concrete product asks, named-product detail checks, and product-specific claim checks even when the final answer may ask for clarification because catalog data is missing.",
  ),
  categories: z
    .array(AgentV2GuidanceCategorySchema)
    .describe(
      "Guidance categories to load. Use deep_cleansing_shampoo, not shampoo, for hard-water, metal/mineral, chelating, clarifying, detox, reset, buildup, or coated/waxy shampoo questions even when the product name contains Shampoo. Use bondbuilder for named bond-repair products or brands such as K18, OLAPLEX, Epres, acidic bonding, or bond repair, even when the catalog item is leave-in-like or mask-like.",
    ),
  topics: z.preprocess(
    (value) => value ?? [],
    z
      .array(AgentV2GuidanceTopicSchema)
      .describe(
        "Non-product advisory topics to load. Use night_protection for sleep-friction, satin/silk pillowcase, bonnet, pineapple, loose night hairstyle, HairHOMIE, or length/tip accessory questions.",
      ),
  ),
  routine_layer: AgentV2RoutineLayerSchema.nullable(),
  safety_mode: AgentV2SafetyModeSchema,
})

export type LoadAgentV2AdvisorGuidanceInput = z.infer<typeof LoadAgentV2AdvisorGuidanceInputSchema>
type SelectGuidancePackageIdsInput = LoadAgentV2AdvisorGuidanceInput

export async function loadAgentV2AdvisorGuidance(input: unknown) {
  const parsed = LoadAgentV2AdvisorGuidanceInputSchema.parse(input)
  const packageIds = selectGuidancePackageIds(parsed)

  return loadAgentV2GuidancePackages(packageIds)
}

export function selectGuidancePackageIds(
  input: SelectGuidancePackageIdsInput,
): AgentV2GuidancePackageId[] {
  const ids: AgentV2GuidancePackageId[] = [
    "base.advisor_rules.v1",
    "base.answer_contract.v1",
    "base.tone_and_format.v1",
  ]

  if (input.safety_mode !== "normal" || input.answer_mode_hint === "safety_boundary") {
    ids.push("base.safety_boundaries.v1")
  }

  if (
    input.answer_mode_hint === "product_recommendation" ||
    input.answer_mode_hint === "constraint_blocked"
  ) {
    ids.push("base.product_recommendation.v1")
  }

  if (input.answer_mode_hint === "routine" || input.routine_layer !== null) {
    ids.push("base.routine_building.v1")
  }

  if (
    input.answer_mode_hint === "general_advice" ||
    input.answer_mode_hint === "product_recommendation" ||
    input.answer_mode_hint === "routine"
  ) {
    ids.push("base.general_advice.v1")
    ids.push("base.goal_concern_levers.v1")
  }

  for (const category of input.categories) {
    ids.push(`category.${category}.v1` as AgentV2GuidancePackageId)
  }

  for (const topic of input.topics ?? []) {
    ids.push(`topic.${topic}.v1` as AgentV2GuidancePackageId)
  }

  return [...new Set(ids)]
}
