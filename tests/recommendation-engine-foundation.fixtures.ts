import type { HairProfile } from "../src/lib/types"
import type { PersistenceRoutineItemRow } from "../src/lib/recommendation-engine/adapters/from-persistence"

function buildProfile(overrides: Partial<HairProfile>): HairProfile {
  return {
    id: "hp_1",
    user_id: "user_1",
    hair_texture: null,
    thickness: null,
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: null,
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export const LOW_DAMAGE_PROFILE = buildProfile({
  hair_texture: "straight",
  thickness: "normal",
  density: "medium",
  concerns: [],
  goals: ["shine"],
  cuticle_condition: "smooth",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: [],
  wash_frequency: "every_2_3_days",
  heat_styling: "never",
  styling_tools: [],
  towel_technique: "tupfen",
  drying_method: "air_dry",
  brush_type: "wide_tooth_comb",
  night_protection: ["silk_satin_pillow"],
  uses_heat_protection: false,
})

export const SEVERE_DAMAGE_PROFILE = buildProfile({
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  concerns: ["hair_damage", "split_ends"],
  goals: ["strengthen", "less_frizz"],
  cuticle_condition: "rough",
  protein_moisture_balance: "snaps",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["bleached"],
  wash_frequency: "every_2_3_days",
  heat_styling: "daily",
  styling_tools: ["flat_iron", "blow_dryer"],
  towel_material: "frottee",
  towel_technique: "rubbeln",
  drying_method: "blow_dry",
  brush_type: "paddle",
  night_protection: [],
  uses_heat_protection: false,
})

export const ADAPTER_ROUTINE_ITEMS: PersistenceRoutineItemRow[] = [
  {
    category: "conditioner",
    product_name: "Repair Conditioner",
    frequency_range: "3_4x",
  },
  {
    category: "mask",
    product_name: "Bond Mask",
    frequency_range: "1_2x",
  },
  {
    category: "heat_protectant",
    product_name: "Heat Shield Spray",
    frequency_range: "5_6x",
  },
  {
    category: "serum",
    product_name: "Scalp Serum",
    frequency_range: "1_2x",
  },
  {
    category: "scrub",
    product_name: "Scalp Scrub",
    frequency_range: "rarely",
  },
  {
    category: "styling_gel",
    product_name: "Curl Gel",
    frequency_range: "3_4x",
  },
]
