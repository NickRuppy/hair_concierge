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
import type { MaskCategoryDecision } from "../src/lib/recommendation-engine/types"
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

function createMaskDecision(
  targetProfile: Partial<NonNullable<MaskCategoryDecision["targetProfile"]>>,
): MaskCategoryDecision {
  const { intensityRequest = null, ...targetProfileRest } = targetProfile

  return {
    category: "mask",
    relevant: true,
    action: "add",
    planReasonCodes: ["test_mask_need"],
    currentInventory: null,
    targetProfile: {
      balance: "balanced",
      repairLevel: "medium",
      weight: "medium",
      needStrength: 2,
      role: "fixed",
      thickness: null,
      density: null,
      ...targetProfileRest,
      intensityRequest,
    },
    notes: [],
  }
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
    thickness: "fine",
    activeDamageDrivers: damage.activeDamageDrivers,
  })

  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.action, "add")
  assert.deepEqual(categories.mask.targetProfile, {
    balance: "moisture",
    repairLevel: "high",
    weight: "medium",
    needStrength: 3,
    role: "fixed",
    intensityRequest: null,
    thickness: "fine",
    density: "medium",
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

test("explicit low-need mask requests stay relevant as optional Zusatzpflege", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "mask",
    message: "Welche Maske passt zu mir?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.action, "add")
  assert.equal(categories.mask.targetProfile?.role, "optional")
  assert.equal(categories.mask.targetProfile?.needStrength, 0)
  assert.equal(categories.mask.targetProfile?.intensityRequest, null)
  assert.ok(categories.mask.planReasonCodes.includes("explicit_mask_request"))
})

test("non-explicit medium mask need stays relevant as fixed Zusatzpflege", () => {
  const mediumDamageProfile = {
    ...LOW_DAMAGE_PROFILE,
    concerns: ["split_ends" as const],
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(mediumDamageProfile, [])
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(damage.repairPriority, "medium")
  assert.equal(damage.overallLevel, "moderate")
  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.action, "add")
  assert.equal(categories.mask.targetProfile?.role, "fixed")
  assert.equal(categories.mask.targetProfile?.needStrength, 2)
  assert.ok(categories.mask.planReasonCodes.includes("derived_medium_mask_need"))
})

test("explicit mask requests keep real mask need fixed", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(SEVERE_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "mask",
    message: "Welche intensive Maske passt zu mir?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.targetProfile?.role, "fixed")
  assert.equal(categories.mask.targetProfile?.needStrength, 3)
  assert.ok(categories.mask.planReasonCodes.includes("explicit_mask_request"))
})

test("explicit intensive low-need mask requests uplift concentration target one step", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "mask",
    message: "Welche intensive Maske passt zu mir?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(requestContext.maskIntensityRequest, "intensive")
  assert.equal(categories.mask.relevant, true)
  assert.equal(categories.mask.targetProfile?.role, "optional")
  assert.equal(categories.mask.targetProfile?.repairLevel, "medium")
  assert.equal(categories.mask.targetProfile?.intensityRequest, "intensive")
  assert.ok(categories.mask.notes.includes("mask_explicit_intensive_request_uplift"))
})

test("conditioner stays baseline core care for low-need profiles with existing conditioner", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [
    {
      category: "conditioner",
      product_name: "Current Conditioner",
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

  assert.equal(categories.conditioner.relevant, true)
  assert.equal(categories.conditioner.action, "keep")
  assert.ok(categories.conditioner.planReasonCodes.includes("baseline_core_care"))
  assert.equal(categories.conditioner.targetProfile?.balance, "balanced")
  assert.equal(categories.conditioner.targetProfile?.repairLevel, "low")
  assert.equal(categories.conditioner.targetProfile?.weight, "medium")
  assert.equal(categories.conditioner.targetProfile?.thickness, "normal")
})

test("conditioner fit stays unknown until balance_direction is backfilled", () => {
  const { normalized, damage, plan } = buildEngineState()
  const decision = buildConditionerCategoryDecision(normalized, damage, plan)

  const missingBalanceFit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
    suitable_thicknesses: ["fine"],
  })
  assert.equal(missingBalanceFit.status, "unknown")
  assert.deepEqual(missingBalanceFit.missingFields, ["balance_direction"])

  const exactFit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
    balance_direction: "moisture",
    suitable_thicknesses: ["fine"],
  })
  assert.equal(exactFit.status, "ideal")
})

test("conditioner fit treats thickness exclusion as a mismatch", () => {
  const { normalized, damage, plan } = buildEngineState()
  const decision = buildConditionerCategoryDecision(normalized, damage, plan)

  const fit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
    balance_direction: "moisture",
    suitable_thicknesses: ["normal", "coarse"],
  })

  assert.equal(fit.status, "mismatch")
  assert.ok(fit.reasonCodes.includes("conditioner_thickness_mismatch"))
})

test("conditioner fit keeps balanced product supportive for directional need", () => {
  const { normalized, damage, plan } = buildEngineState()
  const decision = buildConditionerCategoryDecision(normalized, damage, plan)

  const fit = evaluateConditionerFit(decision, {
    weight: "medium",
    repair_level: "high",
    balance_direction: "balanced",
    suitable_thicknesses: ["fine"],
  })

  assert.equal(fit.status, "supportive")
  assert.ok(fit.reasonCodes.includes("conditioner_balance_close_match"))
})

test("mask fit uses concentration as a temporary repair proxy but still needs balance backfill", () => {
  const { normalized, damage, plan } = buildEngineState(
    SEVERE_DAMAGE_PROFILE,
    ADAPTER_ROUTINE_ITEMS,
  )
  const decision = buildMaskCategoryDecision(
    normalized,
    damage,
    plan,
    emptyRecommendationRequestContext(),
  )

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

test("mask fit keeps high concentration for medium need as a caveated support path", () => {
  const decision = createMaskDecision({
    balance: "protein",
    repairLevel: "medium",
    weight: "medium",
    needStrength: 2,
  })

  const fit = evaluateMaskFit(decision, {
    weight: "medium",
    concentration: "high",
    balance_direction: "protein",
  })

  assert.equal(fit.status, "supportive")
  assert.ok(fit.reasonCodes.includes("mask_high_intensity_use_sparingly_caveat"))
})

test("mask fit rejects high concentration for low optional need", () => {
  const decision = createMaskDecision({
    balance: "balanced",
    repairLevel: "low",
    weight: "medium",
    needStrength: 0,
    role: "optional",
  })

  const fit = evaluateMaskFit(decision, {
    weight: "medium",
    concentration: "high",
    balance_direction: "balanced",
  })

  assert.equal(fit.status, "mismatch")
  assert.ok(fit.reasonCodes.includes("mask_optional_overcare_caveat"))
})

test("mask fit hard-gates opposite balance but allows balanced bridge products", () => {
  const directionalDecision = createMaskDecision({
    balance: "protein",
    repairLevel: "medium",
    weight: "medium",
  })

  const oppositeFit = evaluateMaskFit(directionalDecision, {
    weight: "medium",
    concentration: "medium",
    balance_direction: "moisture",
  })
  assert.equal(oppositeFit.status, "mismatch")
  assert.ok(oppositeFit.reasonCodes.includes("mask_wrong_balance_stiff_dull_risk"))

  const bridgeFit = evaluateMaskFit(directionalDecision, {
    weight: "medium",
    concentration: "medium",
    balance_direction: "balanced",
  })
  assert.equal(bridgeFit.status, "supportive")
  assert.ok(bridgeFit.reasonCodes.includes("mask_balanced_bridge_supportive"))
})

test("mask fit treats rich-on-fine as riskier than light-on-coarse", () => {
  const fineDecision = createMaskDecision({
    balance: "balanced",
    repairLevel: "medium",
    weight: "light",
    needStrength: 1,
    role: "optional",
  })
  const richFineFit = evaluateMaskFit(fineDecision, {
    weight: "rich",
    concentration: "medium",
    balance_direction: "balanced",
  })

  assert.equal(richFineFit.status, "mismatch")
  assert.ok(richFineFit.reasonCodes.includes("mask_rich_weight_can_weigh_down_caveat"))

  const coarseDecision = createMaskDecision({
    balance: "balanced",
    repairLevel: "medium",
    weight: "rich",
    needStrength: 2,
  })
  const lightCoarseFit = evaluateMaskFit(coarseDecision, {
    weight: "light",
    concentration: "medium",
    balance_direction: "balanced",
  })

  assert.equal(lightCoarseFit.status, "supportive")
  assert.ok(lightCoarseFit.reasonCodes.includes("mask_light_weight_may_be_underpowered_caveat"))
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
    suitable_thicknesses: ["fine"],
  })

  assert.equal(fit.status, "supportive")
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
    suitable_thicknesses: ["fine"],
  })

  assert.equal(fit.status, "mismatch")
  assert.ok(fit.reasonCodes.includes("leave_in_benefits_mismatch"))
})

test("leave-in target splits blow-dry heat protection from high-heat styling prep", () => {
  const blowDryProfile = {
    ...SEVERE_DAMAGE_PROFILE,
    hair_texture: "straight" as const,
    thickness: "normal" as const,
    density: "medium" as const,
    drying_method: "blow_dry" as const,
    heat_styling: "never" as const,
    styling_tools: ["blow_dryer" as const],
    uses_heat_protection: false,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(blowDryProfile, [])
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)
  const target = decision.targetProfile

  assert.equal(target?.heatProtectionNeed, "moderate")
  assert.equal(target?.stylingPrepNeed, "none")
  assert.equal(target?.needBucket, "heat_protect")
})

test("leave-in fit treats missing moderate blow-dry heat protection as a caveated support path", () => {
  const blowDryProfile = {
    ...SEVERE_DAMAGE_PROFILE,
    hair_texture: "straight" as const,
    thickness: "normal" as const,
    density: "medium" as const,
    drying_method: "blow_dry" as const,
    heat_styling: "never" as const,
    styling_tools: ["blow_dryer" as const],
    uses_heat_protection: false,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(blowDryProfile, [])
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  const fit = evaluateLeaveInFit(decision, {
    weight: "medium",
    roles: ["extension_conditioner"],
    provides_heat_protection: false,
    heat_activation_required: false,
    care_benefits: ["moisture", "anti_frizz"],
    application_stage: ["towel_dry"],
    suitable_thicknesses: ["normal"],
  })

  assert.equal(fit.status, "supportive")
  assert.ok(fit.reasonCodes.includes("leave_in_moderate_heat_protection_gap"))
})

test("leave-in fit hard-gates thickness and opposite protein-moisture direction", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(SEVERE_DAMAGE_PROFILE, [])
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  const thicknessFit = evaluateLeaveInFit(decision, {
    product_id: "normal-only",
    format: "spray",
    weight: "medium",
    roles: ["replacement_conditioner", "styling_prep"],
    provides_heat_protection: true,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: ["repair", "anti_frizz"],
    ingredient_flags: [],
    application_stage: ["towel_dry", "pre_heat"],
    suitable_thicknesses: ["normal", "coarse"],
  })

  assert.equal(thicknessFit.status, "mismatch")
  assert.ok(thicknessFit.reasonCodes.includes("leave_in_thickness_mismatch"))

  const balanceFit = evaluateLeaveInFit(decision, {
    product_id: "moisture-only",
    format: "spray",
    weight: "medium",
    roles: ["replacement_conditioner", "styling_prep"],
    provides_heat_protection: true,
    heat_protection_max_c: null,
    heat_activation_required: false,
    care_benefits: ["protein"],
    ingredient_flags: [],
    application_stage: ["towel_dry", "pre_heat"],
    suitable_thicknesses: ["fine"],
  })

  assert.equal(balanceFit.status, "mismatch")
  assert.ok(balanceFit.reasonCodes.includes("leave_in_balance_mismatch"))
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
    maskIntensityRequest: null,
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

test("category set keeps only baseline conditioner active when shared layers are quiet", () => {
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

  assert.equal(categories.conditioner.relevant, true)
  assert.equal(categories.conditioner.action, "keep")
  assert.equal(categories.mask.relevant, false)
  assert.equal(categories.leaveIn.relevant, false)
  assert.equal(categories.oil.relevant, false)
  assert.equal(categories.bondbuilder.relevant, false)
  assert.equal(categories.deepCleansingShampoo.relevant, false)
  assert.equal(categories.dryShampoo.relevant, false)
  assert.equal(categories.peeling.relevant, false)
})
