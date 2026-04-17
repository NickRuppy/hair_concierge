import assert from "node:assert/strict"
import test from "node:test"

import { buildCareNeedAssessment } from "../src/lib/recommendation-engine/assessments/care-needs"
import { buildDamageAssessment } from "../src/lib/recommendation-engine/assessments/damage"
import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { normalizeRecommendationInput } from "../src/lib/recommendation-engine/normalize"
import {
  ADAPTER_ROUTINE_ITEMS,
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

test("persistence adapter maps supported routine categories and reports unsupported ones", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )

  assert.equal(adapted.input.routineInventory.length, 4)
  assert.deepEqual(adapted.unsupportedRoutineCategories, ["styling_gel"])
  assert.equal(adapted.input.profile.cuticle_condition, "rough")
  assert.equal(adapted.input.profile.uses_heat_protection, false)
  assert.equal(
    adapted.input.routineInventory.find((item) => item.category === "peeling")?.product_name,
    "Scalp Serum",
  )
  assert.equal(
    adapted.input.routineInventory.find((item) => item.category === "peeling")?.frequency_range,
    "1_2x",
  )
})

test("normalization produces a full inventory map keyed by V1 inventory categories", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )
  const normalized = normalizeRecommendationInput(adapted.input)

  assert.equal(normalized.routineInventory.conditioner?.present, true)
  assert.equal(normalized.routineInventory.conditioner?.productName, "Repair Conditioner")
  assert.equal(normalized.routineInventory.mask?.frequencyBand, "1_2x")
  assert.equal(normalized.routineInventory.heat_protectant?.frequencyBand, "5_6x")
  assert.equal(normalized.routineInventory.peeling?.productName, "Scalp Serum")
  assert.equal(normalized.routineInventory.shampoo, null)
  assert.equal(normalized.routineInventory.deep_cleansing_shampoo, null)
})

test("low-damage fixture yields low repair need with protective factors", () => {
  const adapted = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [])
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)

  assert.equal(damage.overallLevel, "none")
  assert.equal(damage.structuralLevel, "none")
  assert.equal(damage.heatLevel, "none")
  assert.equal(damage.mechanicalLevel, "none")
  assert.equal(damage.repairPriority, "low")
  assert.equal(damage.balanceDirection, "balanced")
  assert.equal(damage.bondBuilderPriority, "none")
  assert.equal(damage.confidence, "high")
  assert.ok(damage.activeProtectiveFactors.includes("cuticle_smooth"))
  assert.ok(damage.activeProtectiveFactors.includes("balanced_pull_test"))
  assert.ok(damage.activeProtectiveFactors.includes("night_protection_present"))
})

test("unknown night protection is not treated like explicit lack of protection", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      night_protection: null,
    } as never,
    [],
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)

  assert.ok(!damage.activeDamageDrivers.includes("missing_night_protection"))
  assert.ok(!damage.activeProtectiveFactors.includes("night_protection_present"))
})

test("low-damage fixture keeps care needs conservative", () => {
  const adapted = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [])
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)

  assert.equal(careNeeds.hydrationNeed, "none")
  assert.equal(careNeeds.smoothingNeed, "none")
  assert.equal(careNeeds.detanglingNeed, "none")
  assert.equal(careNeeds.definitionSupportNeed, "none")
  assert.equal(careNeeds.thermalProtectionNeed, "none")
  assert.equal(careNeeds.volumeDirection, "neutral")
})

test("severe-damage fixture yields severe structural load and bond builder recommendation", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)

  assert.equal(damage.overallLevel, "severe")
  assert.equal(damage.structuralLevel, "severe")
  assert.equal(damage.heatLevel, "high")
  assert.equal(damage.mechanicalLevel, "high")
  assert.equal(damage.repairPriority, "high")
  assert.equal(damage.balanceDirection, "moisture")
  assert.equal(damage.bondBuilderPriority, "recommend")
  assert.equal(damage.confidence, "high")
  assert.ok(damage.activeDamageDrivers.includes("bleached_hair"))
  assert.ok(damage.activeDamageDrivers.includes("missing_heat_protection"))
  assert.ok(damage.activeDamageDrivers.includes("towel_rubbing"))
})

test("severe-damage fixture drives high care needs and heat protection urgency", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)

  assert.equal(careNeeds.hydrationNeed, "severe")
  assert.equal(careNeeds.smoothingNeed, "high")
  assert.equal(careNeeds.detanglingNeed, "high")
  assert.equal(careNeeds.definitionSupportNeed, "low")
  assert.equal(careNeeds.thermalProtectionNeed, "severe")
  assert.equal(careNeeds.volumeDirection, "neutral")
})
