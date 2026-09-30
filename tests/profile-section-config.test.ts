import assert from "node:assert/strict"
import test from "node:test"

import { deriveDesiredVolumeFromGoals } from "../src/lib/hair-profile/derived"
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

test("profile routine section distinguishes unanswered brush type from explicit none", () => {
  const brushTypeField = PROFILE_FIELD_CONFIG.find((field) => field.key === "brush_type")

  assert.ok(brushTypeField)
  assert.equal(brushTypeField.getValue(makeProfile({ brush_type: null })), null)
  assert.equal(brushTypeField.getValue(makeProfile({ brush_type: [] })), "Keine regelmäßige Bürste")
  assert.deepEqual(brushTypeField.getValue(makeProfile({ brush_type: ["paddle", "round"] })), [
    "Paddle-Bürste",
    "Rundbürste",
  ])
})

test("goals edit derives persisted desired volume from selected goals", () => {
  assert.equal(deriveDesiredVolumeFromGoals(["volume"], null), "more")
  assert.equal(deriveDesiredVolumeFromGoals(["less_volume"], null), "less")
  assert.equal(deriveDesiredVolumeFromGoals(["shine"], null), null)
  assert.equal(deriveDesiredVolumeFromGoals([], null), null)
})

// ---------------------------------------------------------------------------
// Clean-switch task 8: goals, problems and scalp complaints show the quiz's wording
// ---------------------------------------------------------------------------

function field(key: string) {
  const config = PROFILE_FIELD_CONFIG.find((entry) => entry.key === key)
  assert.ok(config, key)
  return config
}

const WAVY_DIAGNOSTICS = {
  texture: "wavy",
  goals: ["volume_balance", "moisture", "shape_definition"],
  currentConcerns: ["lost_shape", "dry_lengths"],
  currentConcernsOtherText: "stumpf nach dem Föhnen",
  scalpOiliness: "oily",
  scalpConcerns: ["irritated", "oily_dandruff"],
  source: { kind: "legacy_quiz", version: 1, leadId: "lead", raw: null },
}

test("goals show the quiz's wording for her hair texture, in the quiz's order", () => {
  const profile = makeProfile({
    hair_texture: "wavy",
    goals: ["volume", "moisture", "curl_definition"],
    desired_volume: "more",
    diagnostics: WAVY_DIAGNOSTICS,
  })
  assert.deepEqual(field("goals").getValue(profile), [
    "Feuchtigkeit ohne Beschweren",
    "Mehr Wellen-Definition",
    "Ausgewogenes Volumen",
  ])
})

test("goals of a row without facts convert through the one legacy rule", () => {
  const profile = makeProfile({
    hair_texture: "curly",
    goals: ["healthier_hair", "color_protection", "less_volume"],
    desired_volume: "less",
  })
  assert.deepEqual(field("goals").getValue(profile), [
    "Mehr Glanz",
    "Weniger Haarbruch und Spliss",
    "Ausgewogenes Volumen",
  ])
  assert.equal(field("goals").getValue(makeProfile()), null)
})

test("problems show the quiz's full wording plus her own note", () => {
  const profile = makeProfile({ hair_texture: "wavy", diagnostics: WAVY_DIAGNOSTICS })
  assert.deepEqual(field("concerns").getValue(profile), [
    "Trockene oder strohige Längen",
    "Meine Wellen verlieren schnell ihre Form",
    "Etwas anderes: stumpf nach dem Föhnen",
  ])
})

test("problems of a row without facts convert through table M", () => {
  const profile = makeProfile({
    hair_texture: "straight",
    concerns: ["dryness", "thinning", "dandruff"],
    scalp_type: "oily",
  })
  assert.deepEqual(field("concerns").getValue(profile), [
    "Trockene oder strohige Längen",
    "Haarausfall oder dünner werdendes Haar",
  ])
  assert.equal(
    field("concerns").getValue(makeProfile({ hair_texture: "wavy", scalp_type: "oily" })),
    "Nichts davon",
  )
})

test("scalp complaints show every picked complaint with the quiz's wording", () => {
  const profile = makeProfile({ hair_texture: "wavy", diagnostics: WAVY_DIAGNOSTICS })
  assert.deepEqual(field("scalp_condition").getValue(profile), [
    "Fettige Schuppen",
    "Gereizte oder empfindliche Kopfhaut",
  ])
  const none = makeProfile({
    diagnostics: { ...WAVY_DIAGNOSTICS, scalpConcerns: [] },
    scalp_type: "oily",
  })
  assert.equal(field("scalp_condition").getValue(none), "Keine Beschwerden")
  assert.equal(field("scalp_condition").getValue(makeProfile()), null)
})

test("a stored Welleneisen shows the combined tool label", () => {
  assert.deepEqual(
    field("styling_tools").getValue(makeProfile({ styling_tools: ["wave_iron", "flat_iron"] })),
    ["Lockenstab / Welleneisen", "Glätteisen"],
  )
})
