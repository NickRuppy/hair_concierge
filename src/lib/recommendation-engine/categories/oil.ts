import { mapOilPurposeToSubtype } from "@/lib/oil/purpose"
import type {
  OilCategoryDecision,
  RecommendationRequestContext,
  NormalizedProfile,
  ResetAssessment,
} from "@/lib/recommendation-engine/types"

function hasOilScalpCaution(profile: NormalizedProfile): boolean {
  return (
    profile.scalpType === "oily" ||
    profile.scalpCondition === "dandruff" ||
    profile.scalpCondition === "dry_flakes" ||
    profile.scalpCondition === "irritated"
  )
}

function hasDensityWeightCaution(profile: NormalizedProfile): boolean {
  return profile.thickness === "fine" || profile.density === "low"
}

function hasRoutineOverloadRisk(profile: NormalizedProfile): boolean {
  const residueProneCount = [
    profile.routineInventory.oil,
    profile.routineInventory.leave_in,
    profile.routineInventory.mask,
    profile.routineInventory.dry_shampoo,
  ].filter(Boolean).length

  return (
    profile.scalpType === "oily" &&
    hasDensityWeightCaution(profile) &&
    (residueProneCount >= 2 || profile.routineInventory.oil !== null)
  )
}

function buildOilNoRecommendationDecision(
  profile: NormalizedProfile,
  reason: NonNullable<RecommendationRequestContext["oilNoRecommendationReason"]>,
): OilCategoryDecision {
  if (reason === "overload_risk") {
    return {
      category: "oil",
      relevant: true,
      action: profile.routineInventory.oil ? "decrease_frequency" : "behavior_change_only",
      planReasonCodes: ["oil_overload_suppress_products"],
      currentInventory: profile.routineInventory.oil,
      targetProfile: null,
      clarificationNeeded: false,
      noRecommendationReason: reason,
      notes: ["oil_overload_suppress_products"],
    }
  }

  const reasonCodeByReason: Record<
    Exclude<
      NonNullable<RecommendationRequestContext["oilNoRecommendationReason"]>,
      "overload_risk"
    >,
    string
  > = {
    scalp_treatment_needed: "oil_scalp_treatment_redirect",
    therapy_oil_missing: "oil_therapy_missing",
    better_non_oil_category: "oil_better_non_oil_category",
  }
  const reasonCode = reasonCodeByReason[reason]

  return {
    category: "oil",
    relevant: true,
    action: "behavior_change_only",
    planReasonCodes: [reasonCode],
    currentInventory: profile.routineInventory.oil,
    targetProfile: null,
    clarificationNeeded: false,
    noRecommendationReason: reason,
    notes: [reasonCode],
  }
}

export function buildOilCategoryDecision(
  profile: NormalizedProfile,
  requestContext: RecommendationRequestContext,
  reset?: ResetAssessment,
): OilCategoryDecision {
  const oilRequested =
    requestContext.requestedCategory === "oil" || requestContext.oilPurpose !== null

  if (!oilRequested) {
    return {
      category: "oil",
      relevant: false,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.oil,
      targetProfile: null,
      clarificationNeeded: false,
      noRecommendationReason: null,
      notes: [],
    }
  }

  const purpose = requestContext.oilPurpose
  const noRecommendationReason = requestContext.oilNoRecommendationReason

  if (noRecommendationReason) {
    return buildOilNoRecommendationDecision(profile, noRecommendationReason)
  }

  if (reset?.richOptionalCareRisk && reset.level === "strong") {
    return buildOilNoRecommendationDecision(profile, "overload_risk")
  }

  if (!purpose) {
    return {
      category: "oil",
      relevant: true,
      action: null,
      planReasonCodes: [],
      currentInventory: profile.routineInventory.oil,
      targetProfile: null,
      clarificationNeeded: true,
      noRecommendationReason: null,
      notes: ["oil_purpose_missing_request_context"],
    }
  }

  if (hasRoutineOverloadRisk(profile)) {
    return buildOilNoRecommendationDecision(profile, "overload_risk")
  }

  const matcherSubtype = mapOilPurposeToSubtype(purpose)
  const adjunctScalpSupport =
    purpose === "pre_wash_oiling" &&
    (profile.scalpCondition === "dandruff" ||
      profile.scalpCondition === "dry_flakes" ||
      profile.scalpCondition === "irritated" ||
      profile.scalpType === "dry" ||
      profile.scalpType === "oily")
  const scalpCaution = purpose === "pre_wash_oiling" && hasOilScalpCaution(profile)

  return {
    category: "oil",
    relevant: true,
    action: profile.routineInventory.oil ? "keep" : "add",
    planReasonCodes: [
      "oil_purpose_available",
      ...(scalpCaution ? ["oil_scalp_caution"] : []),
      ...(hasDensityWeightCaution(profile) ? ["oil_density_weight_caution"] : []),
    ],
    currentInventory: profile.routineInventory.oil,
    targetProfile: {
      purpose,
      matcherSubtype,
      adjunctScalpSupport,
      purposeSource: "request",
      scalpCaution,
      densityWeightCaution: hasDensityWeightCaution(profile),
      overloadRisk: false,
      purposeFit: "exact",
    },
    clarificationNeeded: false,
    noRecommendationReason,
    notes: [],
  }
}
