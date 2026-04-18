import assert from "node:assert/strict"
import test from "node:test"

import { generateSuggestedPrompts } from "../src/lib/suggested-prompts"
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
    styling_tools: [],
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
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
    created_at: "2026-04-16T00:00:00.000Z",
    updated_at: "2026-04-16T00:00:00.000Z",
    ...overrides,
  }
}

test("returns the generic fallback set when there is no usable profile", () => {
  assert.deepEqual(
    generateSuggestedPrompts(null).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haar?",
      "Welches Shampoo passt zu meiner Kopfhaut?",
      "Welcher Conditioner passt gerade am besten zu meinem Haar?",
      "Was hilft gegen Frizz?",
    ],
  )
})

test("uses the synced-main winners for oily scalp and explicit volume goals", () => {
  const profile = makeProfile({
    thickness: "fine",
    scalp_type: "oily",
    protein_moisture_balance: "stretches_bounces",
    desired_volume: "more",
    goals: ["volume"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Welches Shampoo passt zu meinem schnell fettenden Ansatz?",
      "Welcher Conditioner passt gerade am besten zu meinem Haar?",
      "Wie bekomme ich mehr Volumen, ohne zu beschweren?",
    ],
  )
})

test("keeps an explicit volume chip even when texture and damage would otherwise imply frizz", () => {
  const profile = makeProfile({
    hair_texture: "wavy",
    thickness: "fine",
    cuticle_condition: "rough",
    desired_volume: "more",
    goals: ["volume"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Welches Shampoo passt zu meiner Kopfhaut?",
      "Brauche ich eher Maske oder Leave-in für meine Längen?",
      "Wie bekomme ich mehr Volumen, ohne zu beschweren?",
    ],
  )
})

test("prefers leave-in plus frizz when the profile points to styling support", () => {
  const profile = makeProfile({
    hair_texture: "wavy",
    thickness: "normal",
    scalp_type: "balanced",
    heat_styling: "several_weekly",
    concerns: ["frizz"],
    goals: ["less_frizz"],
    current_routine_products: ["conditioner"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Welches Shampoo passt zu meiner Kopfhaut?",
      "Welcher Leave-in passt zu meinem Styling-Alltag?",
      "Was hilft gegen Frizz bei meinem Haarprofil?",
    ],
  )
})

test("reintroduces conditioner for explicit moisture-balance signals", () => {
  const profile = makeProfile({
    scalp_condition: "dry_flakes",
    protein_moisture_balance: "snaps",
    cuticle_condition: "rough",
    concerns: ["dryness", "hair_damage"],
    chemical_treatment: ["bleached"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Was hilft bei trockenen Schuppen?",
      "Welcher Conditioner passt bei Feuchtigkeitsmangel?",
      "Was ist der nächste sinnvolle Schritt für mein Haarprofil?",
    ],
  )
})

test("falls back to mask versus leave-in when damage is present but conditioner inputs are missing", () => {
  const profile = makeProfile({
    scalp_type: "dry",
    cuticle_condition: "rough",
    concerns: ["dryness", "hair_damage"],
    chemical_treatment: ["colored"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Welches Shampoo passt zu meiner Kopfhaut?",
      "Brauche ich eher Maske oder Leave-in für meine Längen?",
      "Was ist der nächste sinnvolle Schritt für mein Haarprofil?",
    ],
  )
})

test("breakage counts as a damage signal even without legacy damage tags", () => {
  const profile = makeProfile({
    scalp_type: "balanced",
    concerns: ["breakage"],
  })

  assert.deepEqual(
    generateSuggestedPrompts(profile).map((prompt) => prompt.text),
    [
      "Welche Routine passt am besten zu meinem Haarprofil?",
      "Welches Shampoo passt zu meiner Kopfhaut?",
      "Brauche ich eher Maske oder Leave-in für meine Längen?",
      "Was ist der nächste sinnvolle Schritt für mein Haarprofil?",
    ],
  )
})
