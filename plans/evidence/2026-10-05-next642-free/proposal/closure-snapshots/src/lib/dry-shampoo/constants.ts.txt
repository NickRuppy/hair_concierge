import type {
  DryShampooFormat,
  DryShampooHairColorFit,
  DryShampooPrimaryEffect,
  DryShampooScalpSensitivityFit,
} from "@/lib/product-specs/constants"

export const DRY_SHAMPOO_DB_CATEGORIES = [
  "Trockenshampoo",
  "Dry Shampoo",
  "dry_shampoo",
  "dry shampoo",
] as const

export interface ProductDryShampooSpecs {
  product_id: string
  primary_effect: DryShampooPrimaryEffect
  hair_color_fit: DryShampooHairColorFit
  scalp_sensitivity_fit: DryShampooScalpSensitivityFit
  format: DryShampooFormat
  created_at?: string
  updated_at?: string
}

export function isDryShampooCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return (
    normalized === "trockenshampoo" || normalized === "dry shampoo" || normalized === "dry_shampoo"
  )
}
