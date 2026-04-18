import assert from "node:assert/strict"
import test from "node:test"

import {
  getShampooMissingProfileFields,
  getShampooProfileCompleteness,
} from "../src/lib/recommendation-engine/chat"
import type { HairProfile } from "../src/lib/types"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "straight",
    thickness: "fine",
    density: null,
    concerns: [],
    products_used: null,
    wash_frequency: null,
    heat_styling: null,
    styling_tools: [],
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: "oily",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: [],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

test("nullable scalp condition is treated as complete when scalp type is present", () => {
  const profile = createProfile({
    thickness: "fine",
    scalp_type: "oily",
    scalp_condition: null,
  })

  assert.deepEqual(getShampooMissingProfileFields(profile), [])
  assert.deepEqual(getShampooProfileCompleteness(profile), {
    filledCount: 2,
    totalCount: 2,
    score: 1,
  })
})

test("shampoo completeness still asks both scalp answers when neither route is known", () => {
  const profile = createProfile({
    thickness: "fine",
    scalp_type: null,
    scalp_condition: null,
  })

  assert.deepEqual(getShampooMissingProfileFields(profile), ["scalp_type", "scalp_condition"])
  assert.deepEqual(getShampooProfileCompleteness(profile), {
    filledCount: 1,
    totalCount: 3,
    score: 1 / 3,
  })
})
