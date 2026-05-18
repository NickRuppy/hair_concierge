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

export const LoadAgentV2AdvisorGuidanceInputSchema = z.object({
  answer_mode_hint: AgentV2AnswerModeSchema.nullable(),
  categories: z.array(AgentV2GuidanceCategorySchema),
  routine_layer: AgentV2RoutineLayerSchema.nullable(),
  safety_mode: AgentV2SafetyModeSchema,
})

export type LoadAgentV2AdvisorGuidanceInput = z.infer<typeof LoadAgentV2AdvisorGuidanceInputSchema>

export async function loadAgentV2AdvisorGuidance(input: unknown) {
  const parsed = LoadAgentV2AdvisorGuidanceInputSchema.parse(input)
  const packageIds = selectGuidancePackageIds(parsed)

  return loadAgentV2GuidancePackages(packageIds)
}

export function selectGuidancePackageIds(
  input: LoadAgentV2AdvisorGuidanceInput,
): AgentV2GuidancePackageId[] {
  const ids: AgentV2GuidancePackageId[] = [
    "base.advisor_rules.v1",
    "base.answer_contract.v1",
    "base.tone_and_format.v1",
  ]

  if (input.safety_mode !== "normal") {
    ids.push("base.safety_boundaries.v1")
  }

  if (
    input.answer_mode_hint === "product_recommendation" ||
    input.answer_mode_hint === "routine_product_deep_dive" ||
    input.answer_mode_hint === "constraint_blocked"
  ) {
    ids.push("base.product_recommendation.v1")
  }

  if (
    input.answer_mode_hint === "routine" ||
    input.answer_mode_hint === "routine_product_deep_dive" ||
    input.routine_layer !== null
  ) {
    ids.push("base.routine_building.v1")
  }

  if (input.answer_mode_hint === "general_advice") {
    ids.push("base.general_advice.v1")
  }

  for (const category of input.categories) {
    ids.push(`category.${category}.v1` as AgentV2GuidancePackageId)
  }

  return [...new Set(ids)]
}
