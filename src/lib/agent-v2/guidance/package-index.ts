export const AGENT_V2_GUIDANCE_PACKAGE_IDS = [
  "base.advisor_rules.v1",
  "base.answer_contract.v1",
  "base.product_recommendation.v1",
  "base.routine_building.v1",
  "base.general_advice.v1",
  "base.safety_boundaries.v1",
  "base.tone_and_format.v1",
  "category.shampoo.v1",
  "category.conditioner.v1",
  "category.leave_in.v1",
  "category.mask.v1",
  "category.oil.v1",
  "category.bondbuilder.v1",
  "category.deep_cleansing_shampoo.v1",
  "category.dry_shampoo.v1",
  "category.peeling.v1",
] as const

export type AgentV2GuidancePackageId = (typeof AGENT_V2_GUIDANCE_PACKAGE_IDS)[number]

export interface AgentV2GuidancePackageEntry {
  id: AgentV2GuidancePackageId
  metadataPath: string
  markdownPath: string
}

export const AGENT_V2_CATEGORY_SOURCE_DIRS = {
  shampoo: "shampoo",
  conditioner: "conditioner",
  leave_in: "leave-in",
  mask: "mask",
  oil: "hair-oiling",
  bondbuilder: "bond-builder",
  deep_cleansing_shampoo: "deep-cleansing",
  dry_shampoo: "dry-shampoo",
  peeling: "peeling",
} as const

const PACKAGE_ENTRIES: Record<AgentV2GuidancePackageId, AgentV2GuidancePackageEntry> = {
  "base.advisor_rules.v1": baseEntry("advisor-rules"),
  "base.answer_contract.v1": baseEntry("answer-contract"),
  "base.product_recommendation.v1": baseEntry("product-recommendation"),
  "base.routine_building.v1": baseEntry("routine-building"),
  "base.general_advice.v1": baseEntry("general-advice"),
  "base.safety_boundaries.v1": baseEntry("safety-boundaries"),
  "base.tone_and_format.v1": baseEntry("tone-and-format"),
  "category.shampoo.v1": categoryEntry("shampoo"),
  "category.conditioner.v1": categoryEntry("conditioner"),
  "category.leave_in.v1": categoryEntry("leave-in"),
  "category.mask.v1": categoryEntry("mask"),
  "category.oil.v1": categoryEntry("oil"),
  "category.bondbuilder.v1": categoryEntry("bondbuilder"),
  "category.deep_cleansing_shampoo.v1": categoryEntry("deep-cleansing-shampoo"),
  "category.dry_shampoo.v1": categoryEntry("dry-shampoo"),
  "category.peeling.v1": categoryEntry("peeling"),
}

export function getAgentV2GuidancePackageEntry(id: string): AgentV2GuidancePackageEntry | null {
  if (!isAgentV2GuidancePackageId(id)) {
    return null
  }

  return PACKAGE_ENTRIES[id]
}

export function isAgentV2GuidancePackageId(id: string): id is AgentV2GuidancePackageId {
  return (AGENT_V2_GUIDANCE_PACKAGE_IDS as readonly string[]).includes(id)
}

function baseEntry(slug: string): AgentV2GuidancePackageEntry {
  const id = baseIdFromSlug(slug)
  return {
    id,
    metadataPath: `data/agent-v2/guidance/base/${slug}.json`,
    markdownPath: `data/agent-v2/guidance/base/${slug}.md`,
  }
}

function categoryEntry(slug: string): AgentV2GuidancePackageEntry {
  const id = categoryIdFromSlug(slug)
  return {
    id,
    metadataPath: `data/agent-v2/guidance/categories/${slug}.json`,
    markdownPath: `data/agent-v2/guidance/categories/${slug}.md`,
  }
}

function baseIdFromSlug(slug: string): AgentV2GuidancePackageId {
  return `base.${slug.replaceAll("-", "_")}.v1` as AgentV2GuidancePackageId
}

function categoryIdFromSlug(slug: string): AgentV2GuidancePackageId {
  return `category.${slug.replaceAll("-", "_")}.v1` as AgentV2GuidancePackageId
}
