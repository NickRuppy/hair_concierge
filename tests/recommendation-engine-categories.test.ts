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
  buildResetAssessment,
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
import type { HairProfile } from "../src/lib/types"
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
    weight: "light",
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

test("mask target weight is light for fine hair even with medium density", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      density: "medium",
      protein_moisture_balance: "stretches_stays",
      cuticle_condition: "slightly_rough",
      concerns: ["dryness"],
    },
    [],
  )
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    buildRecommendationRequestContext({
      requestedCategory: "mask",
      message: "Meine Haare sind fein und trocken. Gibt es eine leichte Maske?",
    }),
  )

  assert.equal(categories.mask.targetProfile?.weight, "light")
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

test("explicit low-need leave-in requests build a request-scoped target", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Welches Leave-in passt zu meinem Haar?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.action, "add")
  assert.equal(categories.leaveIn.targetProfile?.thickness, "normal")
  assert.equal(categories.leaveIn.targetProfile?.weight, "medium")
  assert.equal(categories.leaveIn.targetProfile?.conditionerRelationship, "booster_only")
  assert.ok(categories.leaveIn.planReasonCodes.includes("explicit_leave_in_request"))
})

test("straight natural texture with perm and definition goal routes leave-in to curl definition", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState({
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "straight",
    chemical_treatment: ["permed"],
    goals: ["curl_definition"],
  })
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  assert.equal(careNeeds.definitionSupportNeed, "moderate")
  assert.equal(decision.relevant, true)
  assert.equal(decision.targetProfile?.needBucket, "curl_definition")
  assert.equal(decision.targetProfile?.stylingPrepNeed, "definition")
  assert.ok(decision.targetProfile?.careBenefits.includes("curl_definition"))
})

test("chemical straightening does not unlock curl-definition leave-in routing", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState({
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "straight",
    chemical_treatment: ["chemically_straightened"],
    goals: ["curl_definition"],
  })
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  assert.equal(careNeeds.definitionSupportNeed, "none")
  assert.notEqual(decision.targetProfile?.needBucket, "curl_definition")
  assert.notEqual(decision.targetProfile?.stylingPrepNeed, "definition")
})

test("perm maintenance can route leave-in to gentle support without curl definition", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState({
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "straight",
    chemical_treatment: ["permed"],
    goals: [],
  })
  const decision = buildLeaveInCategoryDecision(normalized, damage, careNeeds, plan)

  assert.equal(careNeeds.definitionSupportNeed, "none")
  assert.equal(decision.relevant, true)
  assert.equal(decision.targetProfile?.needBucket, "detangle_smooth")
  assert.notEqual(decision.targetProfile?.needBucket, "curl_definition")
  assert.notEqual(decision.targetProfile?.stylingPrepNeed, "definition")
  assert.ok(decision.targetProfile?.careBenefits.includes("detangle_smooth"))
  assert.ok(!decision.targetProfile?.careBenefits.includes("curl_definition"))
})

test("explicit leave-in heat requests build a high heat target even when routine plan is quiet", () => {
  const heatProfile = {
    ...LOW_DAMAGE_PROFILE,
    heat_styling: "never" as const,
    styling_tools: ["blow_dryer", "flat_iron"] as HairProfile["styling_tools"],
    drying_method: "air_dry" as const,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(heatProfile, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Welches Leave-in mit Hitzeschutz passt, wenn ich föhne oder glätte?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.targetProfile?.heatProtectionNeed, "high")
  assert.equal(categories.leaveIn.targetProfile?.stylingContext, "heat_style")
  assert.equal(categories.leaveIn.targetProfile?.stylingPrepNeed, "heat_style")
  assert.ok(categories.leaveIn.targetProfile?.careBenefits.includes("heat_protect"))
})

test("explicit leave-in heat-protection wording builds a heat target without styling-tool signals", () => {
  const quietProfile = {
    ...LOW_DAMAGE_PROFILE,
    heat_styling: "never" as const,
    styling_tools: [] as HairProfile["styling_tools"],
    drying_method: "air_dry" as const,
    uses_heat_protection: false,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(quietProfile, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Welches Leave-in passt mit Hitzeschutz?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.targetProfile?.heatProtectionNeed, "high")
  assert.equal(categories.leaveIn.targetProfile?.stylingContext, "heat_style")
  assert.equal(categories.leaveIn.targetProfile?.stylingPrepNeed, "heat_style")
  assert.ok(categories.leaveIn.targetProfile?.careBenefits.includes("heat_protect"))
})

test("separate heat protectant wording keeps blow-dry leave-in heat protection as a bonus", () => {
  const blowDryProfile = {
    ...LOW_DAMAGE_PROFILE,
    heat_styling: "daily" as const,
    styling_tools: ["blow_dryer"] as HairProfile["styling_tools"],
    drying_method: "air_dry" as const,
    uses_heat_protection: false,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(blowDryProfile, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message: "Ich föhne nur und habe schon einen separaten Hitzeschutz. Welches Leave-in passt?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(requestContext.leaveInSeparateHeatProtectantMentioned, true)
  assert.equal(requestContext.leaveInHeatProtectionRequest, null)
  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.targetProfile?.heatProtectionNeed, "moderate")
  assert.equal(categories.leaveIn.targetProfile?.stylingPrepNeed, "none")
  assert.equal(categories.leaveIn.targetProfile?.hasSeparateHeatProtectant, true)
})

test("explicit fine weighed-down leave-in requests target light booster products", () => {
  const fineProfile = {
    ...LOW_DAMAGE_PROFILE,
    hair_texture: "wavy" as const,
    thickness: "fine" as const,
    density: "medium" as const,
    concerns: ["dryness", "frizz"] as HairProfile["concerns"],
    goals: ["less_frizz", "moisture"] as HairProfile["goals"],
    protein_moisture_balance: "stretches_stays" as const,
    styling_tools: ["blow_dryer"] as HairProfile["styling_tools"],
    uses_heat_protection: true,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(fineProfile, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "leave_in",
    message:
      "Mein feines Haar braucht Pflege, wird aber schnell beschwert. Welches Leave-in passt?",
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  assert.equal(categories.leaveIn.relevant, true)
  assert.equal(categories.leaveIn.targetProfile?.weight, "light")
  assert.equal(categories.leaveIn.targetProfile?.conditionerRelationship, "booster_only")
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
      frequency_range: "weekly_3_4x",
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
    weight: "light",
    concentration: "high",
  })
  assert.equal(missingBalanceFit.status, "unknown")
  assert.deepEqual(missingBalanceFit.missingFields, ["balance_direction"])

  const exactFit = evaluateMaskFit(decision, {
    weight: "light",
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

test("leave-in target treats thermal rollers as moderate heat exposure", () => {
  const thermalRollerProfile = {
    ...SEVERE_DAMAGE_PROFILE,
    hair_texture: "straight" as const,
    thickness: "normal" as const,
    density: "medium" as const,
    drying_method: "air_dry" as const,
    heat_styling: "never" as const,
    styling_tools: ["thermal_rollers" as const],
    uses_heat_protection: false,
  }
  const { normalized, damage, careNeeds, plan } = buildEngineState(thermalRollerProfile, [])
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
    scalpCaution: false,
    densityWeightCaution: false,
    overloadRisk: false,
    purposeFit: "exact",
  })
})

test("oil decision does not treat lightweight finish wording as overload", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein schwereloses Trocken-Oel, das nicht fettig wirkt.",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.noRecommendationReason, null)
  assert.equal(decision.targetProfile?.purpose, "light_finish")
})

test("oil decision treats non-greasy fine-hair wording as light finish", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Welches Haaroel passt zu meinem feinen Haar, ohne fettig auszusehen?",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, false)
  assert.equal(decision.noRecommendationReason, null)
  assert.equal(decision.targetProfile?.purpose, "light_finish")
})

test("oil decision asks for clarification when no explicit purpose is available", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const decision = buildOilCategoryDecision(normalized, {
    requestedCategory: "oil",
    resetTriggerTerms: [],
    resetTriggerSources: [],
    resetFocusRequest: null,
    colorSafeRequest: false,
    scalpTreatmentIntent: false,
    maskIntensityRequest: null,
    leaveInHeatProtectionRequest: null,
    leaveInSeparateHeatProtectantMentioned: false,
    leaveInWeightRequest: null,
    leaveInConditionerRelationshipRequest: null,
    leaveInRequestedFormats: [],
    oilPurpose: null,
    oilNoRecommendationReason: null,
  })

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, true)
  assert.equal(decision.targetProfile, null)
})

test("reset assessment promotes explicit coated hard-water reset request to strong broad-spectrum", () => {
  const { normalized } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      hair_texture: "curly",
      chemical_treatment: ["colored"],
      shampoo_frequency: "weekly_1x",
    },
    [
      { category: "leave_in", product_name: "Curl Cream", frequency_range: "weekly_5_6x" },
      { category: "mask", product_name: "Rich Mask", frequency_range: "weekly_3_4x" },
      { category: "dry_shampoo", product_name: "Dry Shampoo", frequency_range: "weekly_3_4x" },
    ],
  )
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "deep_cleansing_shampoo",
    message:
      "Ich brauche Tiefenreinigung, meine Haare sind wachsig und belegt nach hartem Wasser. Bitte farbschonend.",
  })
  const reset = buildResetAssessment(normalized, requestContext)

  assert.equal(reset.level, "strong")
  assert.equal(reset.resetFocus, "broad_spectrum_detox")
  assert.equal(reset.richOptionalCareRisk, true)
  assert.ok(reset.triggerSources.includes("explicit_request"))
  assert.ok(reset.triggerSources.includes("symptom"))
  assert.ok(reset.triggerSources.includes("environment"))
  assert.ok(reset.cautionFlags.includes("color_or_bleach_caution"))
})

test("explicit deep-cleansing request builds reset target without relying on baseline planner step", () => {
  const { normalized, damage, careNeeds } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "deep_cleansing_shampoo",
    message: "Welches Tiefenreinigungsshampoo passt als Reset gegen Produktreste?",
  })
  const reset = buildResetAssessment(normalized, requestContext)
  const plan = buildInterventionPlan(normalized, damage, careNeeds, reset)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
    reset,
  )

  assert.equal(categories.deepCleansingShampoo.relevant, true)
  assert.equal(categories.deepCleansingShampoo.action, "add")
  assert.equal(categories.deepCleansingShampoo.targetProfile?.resetNeedLevel, "strong")
  assert.equal(categories.deepCleansingShampoo.targetProfile?.resetFocus, "product_sebum_buildup")
  assert.ok(
    categories.deepCleansingShampoo.planReasonCodes.includes("explicit_deep_cleansing_request"),
  )
})

test("deep-cleansing request with scalp treatment intent stays guidance-only", () => {
  const { normalized, damage, careNeeds } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_condition: "dandruff",
    },
    [],
  )
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "deep_cleansing_shampoo",
    message: "Welches Tiefenreinigungsshampoo hilft gegen Schuppen und Juckreiz?",
  })
  const reset = buildResetAssessment(normalized, requestContext)
  const plan = buildInterventionPlan(normalized, damage, careNeeds, reset)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
    reset,
  )

  assert.equal(categories.deepCleansingShampoo.relevant, true)
  assert.equal(categories.deepCleansingShampoo.action, "behavior_change_only")
  assert.equal(categories.deepCleansingShampoo.targetProfile, null)
  assert.ok(categories.deepCleansingShampoo.notes.includes("scalp_treatment_needed"))
})

test("oil decision redirects scalp treatment oil requests without product target", () => {
  const { normalized } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_condition: "dandruff",
    },
    [],
  )
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein Oel gegen Schuppen und juckende Kopfhaut.",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, false)
  assert.equal(decision.noRecommendationReason, "scalp_treatment_needed")
  assert.equal(decision.targetProfile, null)
  assert.ok(decision.planReasonCodes.includes("oil_scalp_treatment_redirect"))
})

test("oil decision redirects growth and loss oil requests even without explicit oiling purpose", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])

  for (const message of [
    "Welches Oel hilft gegen Haarausfall?",
    "Welches Oel ist gut fuer Haarwachstum?",
    "Welches Oel gegen Schuppen passt?",
  ]) {
    const requestContext = buildRecommendationRequestContext({
      requestedCategory: "oil",
      message,
    })
    const decision = buildOilCategoryDecision(normalized, requestContext)

    assert.equal(decision.relevant, true)
    assert.equal(decision.clarificationNeeded, false)
    assert.equal(decision.noRecommendationReason, "scalp_treatment_needed")
    assert.equal(decision.targetProfile, null)
  }
})

test("oil decision keeps therapy oil requests guidance-only until therapy oils are catalogued", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Kannst du mir Neqi Rosemary Oil fuer die Kopfhaut empfehlen?",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, false)
  assert.equal(decision.noRecommendationReason, "therapy_oil_missing")
  assert.equal(decision.targetProfile, null)
  assert.ok(decision.planReasonCodes.includes("oil_therapy_missing"))
})

test("oil decision redirects when the stated need is better served by a non-oil category", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein Oel oder Leave-in mit Hitzeschutz gegen Frizz.",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.clarificationNeeded, false)
  assert.equal(decision.noRecommendationReason, "better_non_oil_category")
  assert.equal(decision.targetProfile, null)
  assert.ok(decision.planReasonCodes.includes("oil_better_non_oil_category"))
})

test("oil decision preserves explicit product intent while marking overload risk", () => {
  const { normalized } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      thickness: "fine",
      density: "low",
      scalp_type: "oily",
    },
    [
      { category: "oil", product_name: "Current Oil", frequency_range: "weekly_3_4x" },
      { category: "leave_in", product_name: "Rich Leave-in", frequency_range: "weekly_3_4x" },
      { category: "mask", product_name: "Rich Mask", frequency_range: "weekly_1x" },
    ],
  )
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Mein Haar ist strähnig und beschwert, welches Styling-Oel passt trotzdem?",
  })

  const decision = buildOilCategoryDecision(normalized, requestContext)

  assert.equal(decision.relevant, true)
  assert.equal(decision.action, "decrease_frequency")
  assert.equal(decision.noRecommendationReason, "overload_risk")
  assert.equal(decision.targetProfile?.purpose, "styling_finish")
  assert.equal(decision.targetProfile?.matcherSubtype, "styling-oel")
  assert.equal(decision.targetProfile?.overloadRisk, true)
  assert.equal(decision.targetProfile?.densityWeightCaution, true)
  assert.ok(decision.planReasonCodes.includes("oil_overload_suppress_products"))
})

test("oil decision does not suppress unrelated substring collisions", () => {
  const { normalized } = buildEngineState(LOW_DAMAGE_PROFILE, [])

  for (const message of [
    "Kann ich in der Wachstumsphase ein Oel als Finish nutzen?",
    "Welches Styling-Oel passt, wenn die Haare vom Schlafen platt sind?",
    "Ein Styling-Oel ist schwer zu finden, welches passt?",
  ]) {
    const requestContext = buildRecommendationRequestContext({
      requestedCategory: "oil",
      message,
    })
    const decision = buildOilCategoryDecision(normalized, requestContext)

    assert.equal(decision.noRecommendationReason, null)
    assert.notEqual(decision.targetProfile, null)
  }
})

test("category set activates support/reset categories for oily buildup-heavy routines", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      goals: ["healthy_scalp"],
      shampoo_frequency: "weekly_1x",
    },
    [
      {
        category: "oil",
        product_name: "Pre Wash Oil",
        frequency_range: "weekly_1x",
      },
      {
        category: "leave_in",
        product_name: "Smoothing Leave In",
        frequency_range: "weekly_3_4x",
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
    resetNeedLevel: "likely",
    resetFocus: "product_sebum_buildup",
    targetIntensity: "medium",
    cautionFlags: [],
  })

  assert.equal(categories.dryShampoo.relevant, false)
  assert.equal(categories.dryShampoo.action, null)
  assert.deepEqual(categories.dryShampoo.targetProfile, null)
  assert.ok(categories.dryShampoo.notes.includes("dry_shampoo_oily_scalp_alone_not_enough"))

  assert.equal(categories.peeling.relevant, true)
  assert.equal(categories.peeling.action, "add")
  assert.deepEqual(categories.peeling.targetProfile, {
    scalpTypeFocus: "oily",
    peelingType: "physical_scrub",
  })
})

test("dry shampoo allows explicit bridge requests despite stored breakage or ordinary dry lengths", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "dry_shampoo",
    message:
      "Ich kann heute nicht waschen, mein Ansatz ist fettig und meine Laengen sind trocken. Welches Trockenshampoo?",
  })
  const { normalized, damage, careNeeds } = buildEngineState(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["breakage"],
    },
    [],
  )
  const reset = buildResetAssessment(normalized, requestContext)
  const plan = buildInterventionPlan(normalized, damage, careNeeds, reset, requestContext)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
    reset,
  )

  assert.equal(categories.dryShampoo.relevant, true)
  assert.ok(!categories.dryShampoo.notes.includes("dry_shampoo_dry_breakage_hard_no"))
})

test("dry shampoo blocks current-message breakage-dominant requests", () => {
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "dry_shampoo",
    message: "Meine Haare sind trocken, sproede und brechen ab. Welches Trockenshampoo hilft?",
  })
  const { normalized, damage, careNeeds } = buildEngineState(LOW_DAMAGE_PROFILE, [])
  const reset = buildResetAssessment(normalized, requestContext)
  const plan = buildInterventionPlan(normalized, damage, careNeeds, reset, requestContext)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
    reset,
  )

  assert.equal(categories.dryShampoo.relevant, false)
  assert.ok(categories.dryShampoo.notes.includes("dry_shampoo_dry_breakage_hard_no"))
})

test("bondbuilder fit uses intensity and does not rank by treatment mode", () => {
  const { normalized, damage, plan } = buildEngineState(SEVERE_DAMAGE_PROFILE, [
    {
      category: "bondbuilder",
      product_name: "Bond Builder",
      frequency_range: "less_than_monthly",
    },
  ])
  const decision = buildBondbuilderCategoryDecision(normalized, damage, plan)

  assert.equal(decision.relevant, true)
  assert.equal(decision.action, "increase_frequency")
  assert.deepEqual(decision.targetProfile, {
    bondRepairIntensity: "intensive",
    applicationMode: "post_wash_leave_in",
    chemicalCrosslinkLane: true,
    peptideChainLane: true,
    mixedOrSevereCombo: true,
    proteinBalanceSupportingOnly: false,
    role: "recommended",
  })

  const differentModeFit = evaluateBondbuilderFit(decision, {
    bond_repair_intensity: "intensive",
    application_mode: "pre_shampoo",
    treatment_mode: "rinse_out",
  })
  assert.equal(differentModeFit.status, "ideal")

  const weakerFit = evaluateBondbuilderFit(decision, {
    bond_repair_intensity: "maintenance",
    application_mode: "post_wash_leave_in",
  })
  assert.equal(weakerFit.status, "mismatch")
})

test("explicit low-need bondbuilder request stays optional instead of disappearing", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    buildRecommendationRequestContext({
      requestedCategory: "bondbuilder",
      message: "Welcher Bondbuilder passt am besten zu mir?",
    }),
  )

  assert.equal(categories.bondbuilder.relevant, true)
  assert.equal(categories.bondbuilder.action, null)
  assert.equal(categories.bondbuilder.targetProfile?.role, "optional")
  assert.equal(categories.bondbuilder.targetProfile?.bondRepairIntensity, "maintenance")
  assert.ok(
    categories.bondbuilder.planReasonCodes.includes("bondbuilder_explicit_optional_low_need"),
  )
})

test("permed hair alone does not hard-route to bondbuilder", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState({
    ...LOW_DAMAGE_PROFILE,
    chemical_treatment: ["permed"],
  })
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(damage.bondBuilderPriority, "none")
  assert.equal(categories.bondbuilder.relevant, false)
})

test("chemical straightening with roughness supports bondbuilder consideration", () => {
  const { normalized, damage, plan } = buildEngineState({
    ...LOW_DAMAGE_PROFILE,
    chemical_treatment: ["chemically_straightened"],
    cuticle_condition: "rough",
  })
  const decision = buildBondbuilderCategoryDecision(normalized, damage, plan)

  assert.equal(decision.relevant, true)
  assert.equal(decision.targetProfile?.chemicalCrosslinkLane, true)
  assert.ok(decision.planReasonCodes.includes("bondbuilder_chemical_crosslink_lane"))
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
        frequency_range: "weekly_3_4x",
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
      frequency_range: "weekly_3_4x",
    },
    {
      category: "conditioner",
      product_name: "Daily Conditioner",
      frequency_range: "weekly_3_4x",
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
