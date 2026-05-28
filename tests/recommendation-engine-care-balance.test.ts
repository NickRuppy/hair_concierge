import assert from "node:assert/strict"
import test from "node:test"

import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { buildEffectiveCareContext } from "../src/lib/recommendation-engine/effective-care-context"
import type { CurrentTurnCareFact } from "../src/lib/recommendation-engine/types"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"

test("current-turn routine frequency overrides saved routine frequency and records conflict", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "oil",
      product_name: "Light Oil",
      frequency_range: "rarely",
    },
  ]).input
  const facts: CurrentTurnCareFact[] = [
    {
      kind: "routine_frequency",
      category: "oil",
      frequencyBand: "daily",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
      source: "current_turn",
    },
  ]

  const context = buildEffectiveCareContext(rawInput, facts)

  assert.equal(context.normalized.routineInventory.oil?.frequencyBand, "daily")
  assert.deepEqual(context.currentTurnFacts, facts)
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "routine.oil.frequency",
      savedValue: "rarely",
      currentTurnValue: "daily",
      source: "current_turn",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
    },
  ])
  assert.deepEqual(context.provenance, [
    {
      fieldPath: "routine.oil.frequency",
      source: "current_turn",
      factKind: "routine_frequency",
      evidenceQuote: "Ich benutze Öl aktuell täglich",
    },
  ])
})

test("current-turn routine presence can clear or create a routine item", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [
    {
      category: "mask",
      product_name: "Weekly Mask",
      frequency_range: "1_2x",
    },
  ]).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "routine_presence",
      category: "mask",
      present: false,
      evidenceQuote: "Ich nehme keine Maske mehr",
      source: "current_turn",
    },
    {
      kind: "routine_presence",
      category: "oil",
      present: true,
      evidenceQuote: "Ich benutze jetzt ein Öl",
      source: "current_turn",
    },
  ])

  assert.equal(context.normalized.routineInventory.mask, null)
  assert.deepEqual(context.normalized.routineInventory.oil, {
    category: "oil",
    present: true,
    productName: null,
    frequencyBand: null,
  })
  assert.deepEqual(
    context.conflicts.map((conflict) => conflict.fieldPath),
    ["routine.mask.present", "routine.oil.present"],
  )
})

test("current-turn profile augment de-dupes canonical array values", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["frizz"],
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_augment",
      field: "concerns",
      values: ["frizz", "tangling"],
      evidenceQuote: "Meine Haare sind frizzy und verknoten",
      source: "current_turn",
    },
  ])

  assert.deepEqual(context.normalized.concerns, ["frizz", "tangling"])
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.concerns",
      savedValue: ["frizz"],
      currentTurnValue: ["frizz", "tangling"],
      source: "current_turn",
      evidenceQuote: "Meine Haare sind frizzy und verknoten",
    },
  ])
})

test("current-turn profile override replaces a scalar normalized field", () => {
  const rawInput = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
    },
    [],
  ).input

  const context = buildEffectiveCareContext(rawInput, [
    {
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Eigentlich sind meine Haare fein",
      source: "current_turn",
    },
  ])

  assert.equal(context.normalized.thickness, "fine")
  assert.deepEqual(context.conflicts, [
    {
      fieldPath: "profile.thickness",
      savedValue: "normal",
      currentTurnValue: "fine",
      source: "current_turn",
      evidenceQuote: "Eigentlich sind meine Haare fein",
    },
  ])
})

test("context signals are retained without changing the effective profile", () => {
  const rawInput = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, []).input
  const facts: CurrentTurnCareFact[] = [
    {
      kind: "context_signal",
      key: "asked_for_simple_routine",
      value: true,
      evidenceQuote: "Ich will es simpel halten",
      source: "current_turn",
    },
  ]

  const context = buildEffectiveCareContext(rawInput, facts)

  assert.deepEqual(context.currentTurnFacts, facts)
  assert.deepEqual(context.conflicts, [])
  assert.deepEqual(context.provenance, [])
})
