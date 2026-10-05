import type {
  ProductBondApplicationMode,
  ProductBondProductFormat,
  ProductBondRepairAxis,
  ProductBondRepairIntensity,
  ProductBondTreatmentMode,
  ProductBondUsageProtocol,
} from "@/lib/product-specs/constants"
import type { BondbuilderResearchProfile } from "@/lib/bondbuilder-research/contracts"

export const BONDBUILDER_DB_CATEGORIES = ["Bondbuilder", "Bond Builder"] as const

export interface ProductBondbuilderSpecs {
  product_id: string
  bond_repair_intensity: ProductBondRepairIntensity | null
  application_mode: ProductBondApplicationMode | null
  bond_repair_axis: ProductBondRepairAxis | null
  treatment_mode: ProductBondTreatmentMode | null
  product_format: ProductBondProductFormat | null
  usage_protocol: ProductBondUsageProtocol | null
  technology_family?: BondbuilderResearchProfile["assessment"]["technology_family"]
  claim_trust_level?: BondbuilderResearchProfile["assessment"]["claim_trust_level"]
  trust_basis?: BondbuilderResearchProfile["assessment"]["trust_basis"]
  research_profile?: BondbuilderResearchProfile | null
  created_at?: string
  updated_at?: string
}

export function isBondbuilderCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "bondbuilder" || normalized === "bond builder"
}
