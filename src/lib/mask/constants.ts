import type { ProductBalanceTarget } from "@/lib/product-specs/constants"

export const MASK_WEIGHTS = ["light", "medium", "rich"] as const
export type MaskWeight = (typeof MASK_WEIGHTS)[number]

export const MASK_CONCENTRATIONS = ["low", "medium", "high"] as const
export type MaskConcentration = (typeof MASK_CONCENTRATIONS)[number]

export interface ProductMaskSpecs {
  product_id: string
  weight: MaskWeight
  concentration: MaskConcentration
  balance_direction: ProductBalanceTarget | null
  created_at?: string
  updated_at?: string
}

export function isMaskCategory(category: string | null | undefined): boolean {
  if (!category) return false
  return category.trim().toLowerCase() === "maske"
}
