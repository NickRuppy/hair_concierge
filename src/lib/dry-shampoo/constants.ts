import type { ProductScalpTypeFocus } from "@/lib/product-specs/constants"

export const DRY_SHAMPOO_DB_CATEGORIES = [
  "Trockenshampoo",
  "Dry Shampoo",
  "dry_shampoo",
  "dry shampoo",
] as const

export type DryShampooScalpTypeFocus = Exclude<ProductScalpTypeFocus, "dry">
export type DryShampooPrimaryEffect = "classic_refresh" | "sensitive_refresh" | "volume_texture"
export type DryShampooHairColorFit = "universal" | "blonde_light" | "brown" | "dark"
export type DryShampooScalpSensitivityFit = "normal_only" | "sensitive_ok"
export type DryShampooFormat = "aerosol_spray" | "foam_or_liquid"

export interface ProductDryShampooSpecs {
  product_id: string
  scalp_type_focus?: DryShampooScalpTypeFocus | null
  primary_effect?: DryShampooPrimaryEffect | null
  hair_color_fit?: DryShampooHairColorFit | null
  scalp_sensitivity_fit?: DryShampooScalpSensitivityFit | null
  format?: DryShampooFormat | null
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
