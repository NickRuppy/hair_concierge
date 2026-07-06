import { INVENTORY_CATEGORIES } from "@/lib/recommendation-engine/contracts"
import { normalizeRoutineUsageIdentityCamel } from "@/lib/product-usage/routine-identity"
import { normalizeBrushTypeValues } from "@/lib/profile/brush-type"
import { getVisibleProductUsageItems } from "@/lib/product-usage/shampoo-fallback"
import { normalizeNightProtectionValues, normalizeProductFrequency } from "@/lib/vocabulary"
import type {
  InventoryCategory,
  NormalizedProfile,
  NormalizedRoutineInventoryItem,
  RawRecommendationInput,
  RoutineInventory,
} from "@/lib/recommendation-engine/types"

function createEmptyRoutineInventory(): RoutineInventory {
  return Object.fromEntries(
    INVENTORY_CATEGORIES.map((category) => [category, null]),
  ) as RoutineInventory
}

function normalizeRoutineInventory(
  items: RawRecommendationInput["routineInventory"],
): RoutineInventory {
  const inventory = createEmptyRoutineInventory()

  for (const item of getVisibleProductUsageItems(items)) {
    const category = item.category as InventoryCategory
    const identity = normalizeRoutineUsageIdentityCamel(item)
    const normalizedItem: NormalizedRoutineInventoryItem = {
      category,
      present: true,
      productName: item.product_name?.trim() || null,
      frequencyBand: normalizeProductFrequency(item.frequency_range),
      productId: identity.productId,
      productSubmissionId: identity.productSubmissionId,
      matchStatus: identity.matchStatus,
    }

    inventory[category] = normalizedItem
  }

  return inventory
}

export function normalizeRecommendationInput(input: RawRecommendationInput): NormalizedProfile {
  const profile = input.profile

  return {
    hairTexture: profile.hair_texture,
    hairLength: profile.hair_length,
    thickness: profile.thickness,
    density: profile.density,
    concerns: profile.concerns ?? [],
    goals: profile.goals ?? [],
    shampooFrequency: profile.shampoo_frequency,
    heatStyling: profile.heat_styling,
    stylingTools: profile.styling_tools ?? null,
    cuticleCondition: profile.cuticle_condition,
    proteinMoistureBalance: profile.protein_moisture_balance,
    scalpType: profile.scalp_type,
    scalpCondition: profile.scalp_condition,
    chemicalTreatment: profile.chemical_treatment ?? [],
    towelMaterial: profile.towel_material,
    towelTechnique: profile.towel_technique,
    dryingMethod: profile.drying_method,
    brushType: normalizeBrushTypeValues(profile.brush_type),
    nightProtection: normalizeNightProtectionValues(profile.night_protection),
    usesHeatProtection: profile.uses_heat_protection ?? false,
    routineInventory: normalizeRoutineInventory(input.routineInventory),
  }
}
