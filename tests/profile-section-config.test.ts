import assert from "node:assert/strict"
import test from "node:test"

import { PROFILE_FIELD_CONFIG } from "../src/lib/profile/section-config"
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
    shampoo_frequency: null,
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
    created_at: "2026-06-15T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
    ...overrides,
  }
}

test("profile shows no towel technique as an answered editable value", () => {
  const towelTechniqueField = PROFILE_FIELD_CONFIG.find((field) => field.key === "towel_technique")

  assert.ok(towelTechniqueField)
  assert.deepEqual(towelTechniqueField.editTarget, {
    kind: "onboarding",
    step: "towel_technique",
  })
  assert.equal(
    towelTechniqueField.getValue(
      makeProfile({
        towel_material: "no_towel",
        towel_technique: null,
      }),
    ),
    "Keine Trocknungstechnik",
  )
})
