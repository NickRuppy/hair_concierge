import assert from "node:assert/strict"
import test from "node:test"

import { buildCareNeedAssessment } from "../src/lib/recommendation-engine/assessments/care-needs"
import { buildDamageAssessment } from "../src/lib/recommendation-engine/assessments/damage"
import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { normalizeRecommendationInput } from "../src/lib/recommendation-engine/normalize"
import { buildInterventionPlan } from "../src/lib/recommendation-engine/planner/intervention"
import {
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

test("planner adds baseline shampoo and conditioner when missing", () => {
  const adapted = adaptRecommendationInputFromPersistence(LOW_DAMAGE_PROFILE, [])
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "shampoo" &&
        step.action === "add" &&
        step.reasonCodes.includes("missing_shampoo_inventory"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "conditioner" &&
        step.action === "add" &&
        step.reasonCodes.includes("missing_conditioner_inventory"),
    ),
  )
})

test("planner emits behavior-first and missing-protection actions for severe heat misuse", () => {
  const adapted = adaptRecommendationInputFromPersistence(SEVERE_DAMAGE_PROFILE, [])
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "behavior" &&
        step.action === "behavior_change_only" &&
        step.reasonCodes.includes("frequent_heat_without_protection"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "heat_protectant" &&
        step.action === "add" &&
        step.reasonCodes.includes("missing_heat_protectant_inventory"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "leave_in" &&
        step.action === "add" &&
        step.reasonCodes.includes("after_wash_support_needed"),
    ),
  )
})

test("planner defers bondbuilder when structural case is consider-level rather than recommend-level", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    {
      ...SEVERE_DAMAGE_PROFILE,
      cuticle_condition: "slightly_rough",
      chemical_treatment: ["colored"],
      protein_moisture_balance: "stretches_bounces",
      heat_styling: "once_weekly",
      uses_heat_protection: true,
    },
    [],
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.equal(damage.bondBuilderPriority, "consider")
  assert.ok(
    plan.deferredSteps.some(
      (step) =>
        step.category === "bondbuilder" &&
        step.action === "add" &&
        step.reasonCodes.includes("bond_builder_consider"),
    ),
  )
})

test("planner activates reset-family categories for oily buildup-prone routines", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      goals: ["healthy_scalp"],
      wash_frequency: "once_weekly",
    },
    [
      {
        category: "oil",
        product_name: "Pre Wash Oil",
        frequency_range: "1_2x",
      },
      {
        category: "leave_in",
        product_name: "Smoothing Leave In",
        frequency_range: "3_4x",
      },
    ],
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "deep_cleansing_shampoo" &&
        step.action === "add" &&
        step.reasonCodes.includes("buildup_reset_need_present"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "dry_shampoo" &&
        step.action === "add" &&
        step.reasonCodes.includes("between_wash_bridge_needed"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "peeling" &&
        step.action === "add" &&
        step.reasonCodes.includes("buildup_reset_need_present"),
    ),
  )
})

test("planner de-escalates support categories when dryness and overuse risk are high", () => {
  const adapted = adaptRecommendationInputFromPersistence(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "dry",
      scalp_condition: "dry_flakes",
      concerns: ["dryness"],
    },
    [
      {
        category: "bondbuilder",
        product_name: "Repair Booster",
        frequency_range: "3_4x",
      },
      {
        category: "deep_cleansing_shampoo",
        product_name: "Reset Wash",
        frequency_range: "3_4x",
      },
      {
        category: "dry_shampoo",
        product_name: "Bridge Spray",
        frequency_range: "daily",
      },
      {
        category: "peeling",
        product_name: "Scalp Scrub",
        frequency_range: "3_4x",
      },
    ],
  )
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "bondbuilder" &&
        step.action === "decrease_frequency" &&
        step.reasonCodes.includes("bond_builder_low_relevance_currently"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "deep_cleansing_shampoo" &&
        step.action === "decrease_frequency" &&
        step.reasonCodes.includes("deep_reset_overuse_risk"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "dry_shampoo" &&
        step.action === "decrease_frequency" &&
        step.reasonCodes.includes("dry_shampoo_overuse_risk"),
    ),
  )
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "peeling" &&
        step.action === "decrease_frequency" &&
        step.reasonCodes.includes("peeling_overuse_risk"),
    ),
  )
})

test("planner can increase bondbuilder usage when the structural case is recommend-level and usage is sparse", () => {
  const adapted = adaptRecommendationInputFromPersistence(SEVERE_DAMAGE_PROFILE, [
    {
      category: "bondbuilder",
      product_name: "Bond Builder",
      frequency_range: "rarely",
    },
  ])
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  assert.equal(damage.bondBuilderPriority, "recommend")
  assert.ok(
    plan.steps.some(
      (step) =>
        step.category === "bondbuilder" &&
        step.action === "increase_frequency" &&
        step.reasonCodes.includes("bondbuilder_inventory_too_sparse"),
    ),
  )
})
