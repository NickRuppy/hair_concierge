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
    hair_length: null,
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

test("profile quiz section includes editable hair length after density", () => {
  const quizFields = PROFILE_FIELD_CONFIG.filter((field) => field.sectionKey === "quiz")
  const densityIndex = quizFields.findIndex((field) => field.key === "density")
  const hairLengthField = quizFields[densityIndex + 1]

  assert.notEqual(densityIndex, -1)
  assert.equal(hairLengthField?.key, "hair_length")
  assert.equal(hairLengthField.label, "Haarlänge")
  assert.deepEqual(hairLengthField.editTarget, { kind: "quiz" })
  assert.equal(hairLengthField.getValue(makeProfile({ hair_length: "long" })), "Lang")
})

test("profile routine section shows length tip accessory night protection label", () => {
  const nightProtectionField = PROFILE_FIELD_CONFIG.find(
    (field) => field.key === "night_protection",
  )

  assert.ok(nightProtectionField)
  assert.deepEqual(
    nightProtectionField.getValue(makeProfile({ night_protection: ["length_tip_accessory"] })),
    ["Längen-/Spitzenschutz (z. B. HairHOMIE)"],
  )
})
