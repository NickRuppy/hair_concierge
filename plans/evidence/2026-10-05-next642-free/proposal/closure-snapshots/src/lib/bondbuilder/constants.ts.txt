import type {
  ProductBondApplicationMode,
  ProductBondProductFormat,
  ProductBondRepairAxis,
  ProductBondRepairIntensity,
  ProductBondTreatmentMode,
  ProductBondUsageProtocol,
} from "@/lib/product-specs/constants"

export const BONDBUILDER_DB_CATEGORIES = ["Bondbuilder", "Bond Builder"] as const

export interface ProductBondbuilderSpecs {
  product_id: string
  bond_repair_intensity: ProductBondRepairIntensity
  application_mode: ProductBondApplicationMode
  bond_repair_axis: ProductBondRepairAxis
  treatment_mode: ProductBondTreatmentMode
  product_format: ProductBondProductFormat
  usage_protocol: ProductBondUsageProtocol
  created_at?: string
  updated_at?: string
}

export function isBondbuilderCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "bondbuilder" || normalized === "bond builder"
}
