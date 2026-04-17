import assert from "node:assert/strict"
import test from "node:test"

import { hydrateHairProfileForConsumers } from "../src/lib/hair-profile/derived"
import type { HairProfile } from "../src/lib/types"

function makeProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "hp_test",
    user_id: "user_test",
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
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

test("hydrates derived routine categories and products_used from user_product_usage rows", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile(), [
    {
      category: "conditioner",
      product_name: "Soft Conditioner",
      frequency_range: "1_2x",
    },
    {
      category: "leave_in",
      product_name: "Curl Cream",
      frequency_range: "rarely",
    },
  ])

  assert.deepEqual(hydrated?.current_routine_products, ["conditioner", "leave_in"])
  assert.match(hydrated?.products_used ?? "", /Conditioner: Soft Conditioner/)
  assert.match(hydrated?.products_used ?? "", /Leave-in: Curl Cream/)
})

test("hydrates wash frequency from shampoo routine items without a persisted mirror", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile({ wash_frequency: null }), [
    {
      category: "shampoo",
      product_name: "Daily Shampoo",
      frequency_range: "3_4x",
    },
  ])

  assert.equal(hydrated?.wash_frequency, "every_2_3_days")
  assert.deepEqual(hydrated?.current_routine_products, ["shampoo"])
})
