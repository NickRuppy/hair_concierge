import type { ProductBalanceTarget } from "@/lib/product-specs/constants"

export const MASK_FORMATS = ["gel", "lotion", "cream", "butter"] as const
export type MaskFormat = (typeof MASK_FORMATS)[number]

export const MASK_WEIGHTS = ["light", "medium", "rich"] as const
export type MaskWeight = (typeof MASK_WEIGHTS)[number]

export const MASK_CONCENTRATIONS = ["low", "medium", "high"] as const
export type MaskConcentration = (typeof MASK_CONCENTRATIONS)[number]

export const MASK_BENEFITS = [
  "moisture",
  "protein",
  "repair",
  "anti_frizz",
  "shine",
  "detangling",
  "elasticity",
  "color_protect",
] as const
export type MaskBenefit = (typeof MASK_BENEFITS)[number]

export const MASK_INGREDIENT_FLAGS = [
  "oils",
  "butters",
  "proteins",
  "humectants",
  "silicones",
  "acids",
] as const
export type MaskIngredientFlag = (typeof MASK_INGREDIENT_FLAGS)[number]

export interface ProductMaskSpecs {
  product_id: string
  format: MaskFormat | null
  weight: MaskWeight
  concentration: MaskConcentration
  balance_direction: ProductBalanceTarget | null
  benefits: MaskBenefit[]
  ingredient_flags: MaskIngredientFlag[]
  leave_on_minutes: number
  created_at?: string
  updated_at?: string
}

export function isMaskCategory(category: string | null | undefined): boolean {
  if (!category) return false
  return category.trim().toLowerCase() === "maske"
}
