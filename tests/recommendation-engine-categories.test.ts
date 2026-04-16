import assert from "node:assert/strict"
import test from "node:test"

import { buildCareNeedAssessment } from "../src/lib/recommendation-engine/assessments/care-needs"
import {
  buildBondbuilderCategoryDecision,
  buildCategoryRecommendationSet,
  buildConditionerCategoryDecision,
  buildLeaveInCategoryDecision,
  buildMaskCategoryDecision,
  buildOilCategoryDecision,
  buildPeelingCategoryDecision,
  buildRecommendationRequestContext,
  buildShampooCategoryDecision,
  buildInterventionPlan,
  emptyRecommendationRequestContext,
  evaluateBondbuilderFit,
  evaluateConditionerFit,
  evaluateLeaveInFit,
  evaluateMaskFit,
  evaluatePeelingFit,
} from "../src/lib/recommendation-engine"
import { buildDamageAssessment } from "../src/lib/recommendation-engine/assessments/damage"
import { adaptRecommendationInputFromPersistence } from "../src/lib/recommendation-engine/adapters/from-persistence"
import type { PersistenceRoutineItemRow } from "../src/lib/recommendation-engine/adapters/from-persistence"
import { normalizeRecommendationInput } from "../src/lib/recommendation-engine/normalize"
import {
  ADAPTER_ROUTINE_ITEMS,
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

function buildEngineState(
  profile = SEVERE_DAMAGE_PROFILE,
  routineItems: PersistenceRoutineItemRow[] = [],
) {
  const adapted = adaptRecommendationInputFromPersistence(profile, routineItems)
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)

  return { normalized, damage, careNeeds, plan }
}

test("category set turns severe shared signals into conditioner, mask, and leave-in targets", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState()
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(categories.shampoo.relevant, true)
  assert.equal(categories.shampoo.action, "add")
  assert.deepEqual(categories.shampoo.targetProfile, {
    scalpRoute: "balanced",
    shampooBucket: "normal",
    secondaryBucket: null,
    cleansingIntensity: "regular",
  })

  assert.equal(categories.conditioner.relevant, true)
  assert.equal(categories.conditioner.action, "add")
  assert.deepEqual(categories.conditioner.targetProfile, {
    balance: "moisture",
    repairLevel: "high",
    weight: "medium",
  })

  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.action, "add")
  assert.deepEqual(categories.mask.targetProfile, {
    balance: "moisture",
    repairLevel: "high",
    weight: "medium",
    needStrength: 3,
  })

  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.action, "add")
  assert.equal(categories.leaveIn.targetProfile?.needBucket, "heat_protect")
  assert.equal(categories.leaveIn.targetProfile?.stylingContext, "heat_style")
  assert.equal(categories.leaveIn.targetProfile?.conditionerRelationship, "replacement_capable")
  assert.deepEqual(categories.leaveIn.targetProfile?.careBenefits, [
    "heat_protect",
    "repair",
    "detangle_smooth",
  ])
  assert.equal(categories.oil.relevant, false)
})

test("conditioner fit stays unknown until balance_direction is backfilled", () => {
  const { normalized, damage, plan } = buildEngineState()
  const decision = buildConditionerCategoryDecision(normalized, damage, plan)

  const missingBalanceFit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
  })
  assert.equal(missingBalanceFit.status, "unknown")
  assert.deepEqual(missingBalanceFit.missingFields, ["balance_direction"])

  const exactFit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
    balance_direction: "moisture",
  })
  assert.equal(exactFit.status, "ideal")
})

test("mask fit uses concentration as a temporary repair proxy but still needs balance backfill", () => {
  const { normalized, damage, plan } = buildEngineState(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )
  const decision = buildMaskCategoryDecision(normalized, damage, plan)

  assert.equal(decision.action, "increase_frequency")

  const missingBalanceFit = evaluateMaskFit(decision, {
    weight: "medium",
    concentration: "high",
  })
  assert.equal(missingBalanceFit.status, "unknown")
  assert.deepEqual(missingBalanceFit.missingFields, ["balance_direction"])

  const exactFit = evaluateMaskFit(decision, {
    weight: "medium",
    concentration: "high",
    balance_direction: "moisture",
  })
  assert.equal(exactFit.status, "ideal")
})

test("leave-in fit derives canonical targets from the current leave-in schema", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState()
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  const fit = evaluateLeaveInFit(decision, {
    weight: "medium",
    roles: ["replacement_conditioner", "styling_prep"],
    provides_heat_protection: true,
    care_benefits: ["repair", "anti_frizz"],
    application_stage: ["towel_dry", "pre_heat"],
  })

  assert.equal(fit.status, "ideal")
})

test("leave-in fit mismatches when heat styling support is missing", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState()
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  const fit = evaluateLeaveInFit(decision, {
    weight: "medium",
    roles: ["replacement_conditioner"],
    provides_heat_protection: false,
    care_benefits: ["anti_frizz"],
    application_stage: ["towel_dry"],
  })

  assert.equal(fit.status, "mismatch")
  assert.ok(fit.reasonCodes.includes("leave_in_benefits_mismatch"))
})

test("shampoo decision keeps treatment and rotation buckets explicit for dandruff routines", () => {
  const dandruffProfile = {
    ...LOW_DAMAGE_PROFILE,
    scalp_type: "oily" as const,
    scalp_condition: "dandruff" as const,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(dandruffProfile, [])
  const decision = buildShampooCategoryDecision(normalized, plan)

  assert.equal(careNeeds.thermalProtectionNeed, "none")
  assert.equal(decision.relevant, true)
  assert.deepEqual(decision.targetProfile, {
    scalpRoute: "dandruff",
    shampooBucket: "schuppen",
    secondaryBucket: "dehydriert-fettig",
    cleansingIntensity: "regular",
  })
})

test("oil decision resolves normalized request purpose before category logic runs", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein leichtes Oel als Finish, das nicht beschwert.",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, false)
  assert.equal(decision.noRecommendationReason, null)
  assert.deepEqual(decision.targetProfile, {
    purpose: "styling_finish",
    matcherSubtype: "styling-oel",
    adjunctScalpSupport: false,
    purposeSource: "request",
  })
})

test("oil decision asks for clarification when no explicit purpose is available", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const decision = buildOilCategoryDecision(normalized, {
    requestedCategory: "oil",
    oilPurpose: null,
    oilNoRecommendationReason: null,
  })

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, true)
  assert.equal(decision.targetProfile, null)
})

test("category set activates support/reset categories for oily buildup-heavy routines", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(
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

  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(categories.bondbuilder.relevant, false)
  assert.equal(categories.deepCleansingShampoo.relevant, true)
  assert.equal(categories.deepCleansingShampoo.action, "add")
  assert.deepEqual(categories.deepCleansingShampoo.targetProfile, {
    scalpTypeFocus: "oily",
    resetNeedLevel: "moderate",
  })

  assert.equal(categories.dryShampoo.relevant, true)
  assert.equal(categories.dryShampoo.action, "add")
  assert.deepEqual(categories.dryShampoo.targetProfile, {
    scalpTypeFocus: "oily",
  })

  assert.equal(categories.peeling.relevant, true)
  assert.equal(categories.peeling.action, "add")
  assert.deepEqual(categories.peeling.targetProfile, {
    scalpTypeFocus: "oily",
    peelingType: "physical_scrub",
  })
})

test("bondbuilder fit prefers exact intensity and treats weaker options as mismatch", () => {
  const { normalized, damage, plan } = buildEngineState(SEVERE_DAMAGE_PROFILE, [
    {
      category: "bondbuilder",
      product_name: "Bond Builder",
      frequency_range: "rarely",
    },
  ])
  const decision = buildBondbuilderCategoryDecision(normalized, damage, plan)

  assert.equal(decision.relevant, true)
  assert.equal(decision.action, "increase_frequency")
  assert.deepEqual(decision.targetProfile, {
    bondRepairIntensity: "intensive",
    applicationMode: "post_wash_leave_in",
  })

  const exactFit = evaluateBondbuilderFit(decision, {
    bond_repair_intensity: "intensive",
    application_mode: "post_wash_leave_in",
  })
  assert.equal(exactFit.status, "ideal")

  const weakerFit = evaluateBondbuilderFit(decision, {
    bond_repair_intensity: "maintenance",
    application_mode: "post_wash_leave_in",
  })
  assert.equal(weakerFit.status, "mismatch")
})

test("peeling fit rejects physical scrub when the target route is dryness-safe", () => {
  const { normalized, damage, plan } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "dry",
      scalp_condition: "dry_flakes",
      concerns: ["dryness"],
    },
    [
      {
        category: "peeling",
        product_name: "Scalp Scrub",
        frequency_range: "3_4x",
      },
    ],
  )
  const decision = buildPeelingCategoryDecision(normalized, damage, plan)

  assert.equal(decision.relevant, true)
  assert.equal(decision.action, "decrease_frequency")
  assert.deepEqual(decision.targetProfile, {
    scalpTypeFocus: "dry",
    peelingType: "acid_serum",
  })

  const mismatchFit = evaluatePeelingFit(decision, {
    scalp_type_focus: "dry",
    peeling_type: "physical_scrub",
  })
  assert.equal(mismatchFit.status, "mismatch")
})

test("category set stays quiet when shared layers do not surface those categories", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [
    {
      category: "shampoo",
      product_name: "Gentle Shampoo",
      frequency_range: "3_4x",
    },
    {
      category: "conditioner",
      product_name: "Daily Conditioner",
      frequency_range: "3_4x",
    },
  ])

  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(categories.conditioner.relevant, false)
  assert.equal(categories.mask.relevant, false)
  assert.equal(categories.leaveIn.relevant, false)
  assert.equal(categories.oil.relevant, false)
  assert.equal(categories.bondbuilder.relevant, false)
  assert.equal(categories.deepCleansingShampoo.relevant, false)
  assert.equal(categories.dryShampoo.relevant, false)
  assert.equal(categories.peeling.relevant, false)
})
