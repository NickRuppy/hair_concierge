export const CONDITIONER_WEIGHTS = ["light", "medium", "rich"] as const
export type ConditionerWeight = (typeof CONDITIONER_WEIGHTS)[number]

export const CONDITIONER_REPAIR_LEVELS = ["low", "medium", "high"] as const
export type ConditionerRepairLevel = (typeof CONDITIONER_REPAIR_LEVELS)[number]

export const CONDITIONER_WEIGHT_LABELS = {
  light: "Leicht",
  medium: "Mittel",
  rich: "Reichhaltig",
} as const satisfies Record<ConditionerWeight, string>

export const CONDITIONER_REPAIR_LEVEL_LABELS = {
  low: "Leicht",
  medium: "Mittel",
  high: "Intensiv",
} as const satisfies Record<ConditionerRepairLevel, string>

export const CONDITIONER_DB_CATEGORIES = [
  "Conditioner",
  "Conditioner Profi",
  "Conditioner (Drogerie)",
] as const

export interface ProductConditionerSpecs {
  product_id: string
  weight: ConditionerWeight
  repair_level: ConditionerRepairLevel
  created_at?: string
  updated_at?: string
}

export function isConditionerCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized.startsWith("conditioner")
}
