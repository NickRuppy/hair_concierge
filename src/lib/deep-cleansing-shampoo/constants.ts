import type { ProductScalpTypeFocus } from "@/lib/product-specs/constants"
import type {
  ColorTreatedSuitability,
  ResetFocus,
  ResetIntensity,
} from "@/lib/recommendation-engine/types"

export const DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES = [
  "Tiefenreinigungsshampoo",
  "Deep Cleansing Shampoo",
  "deep_cleansing_shampoo",
  "deep cleansing shampoo",
] as const

export const DEEP_CLEANSING_RESET_INTENSITIES = [
  "gentle",
  "medium",
  "strong",
] as const satisfies readonly ResetIntensity[]

export const DEEP_CLEANSING_RESET_INTENSITY_LABELS = {
  gentle: "Sanft",
  medium: "Mittel",
  strong: "Stark",
} as const satisfies Record<ResetIntensity, string>

export const DEEP_CLEANSING_RESET_FOCUSES = [
  "product_sebum_buildup",
  "metal_mineral_hard_water",
  "broad_spectrum_detox",
] as const satisfies readonly ResetFocus[]

export const DEEP_CLEANSING_RESET_FOCUS_LABELS = {
  product_sebum_buildup: "Produkt-, Styling- und Sebum-Aufbau",
  metal_mineral_hard_water: "Kalk-, Chlor-, Mineral- oder Metall-Kontext",
  broad_spectrum_detox: "Breiter Styling-, Produkt- und Mineral-Reset",
} as const satisfies Record<ResetFocus, string>

export const DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES = [
  "suitable",
  "unsuitable_or_unknown",
] as const satisfies readonly ColorTreatedSuitability[]

export const DEEP_CLEANSING_COLOR_TREATED_SUITABILITY_LABELS = {
  suitable: "Als geeignet fuer coloriertes Haar gepflegt",
  unsuitable_or_unknown: "Nicht belegt oder ungeeignet fuer coloriertes Haar",
} as const satisfies Record<ColorTreatedSuitability, string>

export interface ProductDeepCleansingShampooSpecs {
  product_id: string
  scalp_type_focus: ProductScalpTypeFocus
  reset_intensity: ResetIntensity
  reset_focus: ResetFocus
  color_treated_suitability: ColorTreatedSuitability
  created_at?: string
  updated_at?: string
}

export function isDeepCleansingShampooCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return (
    normalized === "tiefenreinigungsshampoo" ||
    normalized === "deep cleansing shampoo" ||
    normalized === "deep_cleansing_shampoo"
  )
}
