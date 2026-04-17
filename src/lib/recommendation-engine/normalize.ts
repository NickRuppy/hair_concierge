import { INVENTORY_CATEGORIES } from "@/lib/recommendation-engine/contracts"
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

  for (const item of items) {
    const category = item.category as InventoryCategory
    const normalizedItem: NormalizedRoutineInventoryItem = {
      category,
      present: true,
      productName: item.product_name?.trim() || null,
      frequencyBand: item.frequency_range ?? null,
    }

    inventory[category] = normalizedItem
  }

  return inventory
}

export function normalizeRecommendationInput(input: RawRecommendationInput): NormalizedProfile {
  const profile = input.profile

  return {
    hairTexture: profile.hair_texture,
    thickness: profile.thickness,
    density: profile.density,
    concerns: profile.concerns ?? [],
    goals: profile.goals ?? [],
    washFrequency: profile.wash_frequency,
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
    brushType: profile.brush_type,
    nightProtection: profile.night_protection ?? null,
    usesHeatProtection: profile.uses_heat_protection ?? false,
    routineInventory: normalizeRoutineInventory(input.routineInventory),
  }
}
