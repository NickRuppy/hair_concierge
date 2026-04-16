import { z } from "zod"

export const ENGINE_CATEGORY_IDS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
  "routine",
] as const

export const INVENTORY_CATEGORIES = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const

export const DAMAGE_LEVELS = ["none", "low", "moderate", "high", "severe"] as const
export const REPAIR_PRIORITIES = ["low", "medium", "high"] as const
export const BALANCE_DIRECTIONS = ["protein", "moisture", "balanced"] as const
export const BOND_BUILDER_PRIORITIES = ["none", "consider", "recommend"] as const
export const CATEGORY_FIT_STATUSES = [
  "ideal",
  "supportive",
  "mismatch",
  "unknown",
  "not_applicable",
] as const
export const CANONICAL_BALANCE_TARGETS = ["protein", "moisture", "balanced"] as const
export const CANONICAL_REPAIR_LEVELS = ["low", "medium", "high"] as const
export const CANONICAL_WEIGHTS = ["light", "medium", "rich"] as const
export const CANONICAL_SCALP_ROUTES = [
  "oily",
  "balanced",
  "dry",
  "dandruff",
  "dry_flakes",
  "irritated",
] as const
export const CANONICAL_CLEANSING_INTENSITIES = ["gentle", "regular", "clarifying"] as const
export const SCALP_TYPE_FOCUSES = ["oily", "balanced", "dry"] as const
export const BOND_REPAIR_INTENSITIES = ["maintenance", "intensive"] as const
export const BOND_APPLICATION_MODES = ["pre_shampoo", "post_wash_leave_in"] as const
export const PEELING_TYPES = ["acid_serum", "physical_scrub"] as const
export const LEAVE_IN_CARE_TARGETS = [
  "heat_protect",
  "curl_definition",
  "repair",
  "detangle_smooth",
] as const
export const RECOMMENDATION_ACTIONS = [
  "add",
  "replace",
  "increase_frequency",
  "decrease_frequency",
  "keep",
  "remove",
  "behavior_change_only",
] as const
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const

export const engineCategoryIdSchema = z.enum(ENGINE_CATEGORY_IDS)
export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES)
export const damageLevelSchema = z.enum(DAMAGE_LEVELS)
export const repairPrioritySchema = z.enum(REPAIR_PRIORITIES)
export const balanceDirectionSchema = z.enum(BALANCE_DIRECTIONS)
export const bondBuilderPrioritySchema = z.enum(BOND_BUILDER_PRIORITIES)
export const categoryFitStatusSchema = z.enum(CATEGORY_FIT_STATUSES)
export const canonicalBalanceTargetSchema = z.enum(CANONICAL_BALANCE_TARGETS)
export const canonicalRepairLevelSchema = z.enum(CANONICAL_REPAIR_LEVELS)
export const canonicalWeightSchema = z.enum(CANONICAL_WEIGHTS)
export const canonicalScalpRouteSchema = z.enum(CANONICAL_SCALP_ROUTES)
export const canonicalCleansingIntensitySchema = z.enum(CANONICAL_CLEANSING_INTENSITIES)
export const scalpTypeFocusSchema = z.enum(SCALP_TYPE_FOCUSES)
export const bondRepairIntensitySchema = z.enum(BOND_REPAIR_INTENSITIES)
export const bondApplicationModeSchema = z.enum(BOND_APPLICATION_MODES)
export const peelingTypeSchema = z.enum(PEELING_TYPES)
export const leaveInCareTargetSchema = z.enum(LEAVE_IN_CARE_TARGETS)
export const recommendationActionSchema = z.enum(RECOMMENDATION_ACTIONS)
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS)
