export const SELECTABLE_PRODUCT_CATEGORIES = [
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

export type SelectableProductCategory = (typeof SELECTABLE_PRODUCT_CATEGORIES)[number]

export const GUIDANCE_IDS = [
  "playbook:recommend_products",
  "playbook:build_or_fix_routine",
  "playbook:troubleshoot_hair_issue",
  "playbook:compare_or_decide",
  "playbook:usage_and_application",
  "overlay:fine_hair",
  "overlay:oily_scalp",
  "overlay:dry_lengths",
  "overlay:minimal_routine",
  "overlay:curly_hair",
  "overlay:coily_hair",
  "overlay:heat_styling",
  "overlay:mechanical_stress",
  "overlay:buildup_risk",
  "overlay:damage_repair",
  "overlay:sensitive_scalp",
  "overlay:dandruff_scalp",
  "routine:curl_definition",
  "routine:straight_low_definition",
  "topic:bond_builder",
  "topic:cwc_owc",
  "topic:deep_cleansing",
  "topic:general_haircare",
  "topic:hair_oiling",
] as const

export type GuidanceId = (typeof GUIDANCE_IDS)[number]

export type GuidanceKind = "playbook" | "overlay" | "routine" | "topic"

export interface GuidanceItem {
  id: GuidanceId
  kind: GuidanceKind
  title: string
  content: string
}

export interface GuidanceLoadResult {
  items: GuidanceItem[]
}

export function isGuidanceId(value: string): value is GuidanceId {
  return (GUIDANCE_IDS as readonly string[]).includes(value)
}

export function isSelectableProductCategory(value: string): value is SelectableProductCategory {
  return (SELECTABLE_PRODUCT_CATEGORIES as readonly string[]).includes(value)
}
