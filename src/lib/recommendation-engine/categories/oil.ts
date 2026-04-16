import { mapOilPurposeToSubtype } from "@/lib/oil/purpose"
import type {
  OilCategoryDecision,
  RecommendationRequestContext,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"

export function buildOilCategoryDecision(
  profile: NormalizedProfile,
  requestContext: RecommendationRequestContext,
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

  const matcherSubtype = mapOilPurposeToSubtype(purpose)
  const adjunctScalpSupport =
    purpose === "pre_wash_oiling" &&
    (profile.scalpCondition === "dandruff" ||
      profile.scalpCondition === "dry_flakes" ||
      profile.scalpCondition === "irritated" ||
      profile.scalpType === "dry" ||
      profile.scalpType === "oily")

  return {
    category: "oil",
    relevant: true,
    action: null,
    planReasonCodes: [],
    currentInventory: profile.routineInventory.oil,
    targetProfile: {
      purpose,
      matcherSubtype,
      adjunctScalpSupport,
      purposeSource: "request",
    },
    clarificationNeeded: false,
    noRecommendationReason: requestContext.oilNoRecommendationReason,
    notes: [],
  }
}
