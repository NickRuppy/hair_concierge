import { buildBondbuilderCategoryDecision } from "@/lib/recommendation-engine/categories/bondbuilder"
import { buildConditionerCategoryDecision } from "@/lib/recommendation-engine/categories/conditioner"
import { buildDeepCleansingShampooCategoryDecision } from "@/lib/recommendation-engine/categories/deep-cleansing-shampoo"
import { buildDryShampooCategoryDecision } from "@/lib/recommendation-engine/categories/dry-shampoo"
import { buildLeaveInCategoryDecision } from "@/lib/recommendation-engine/categories/leave-in"
import { buildMaskCategoryDecision } from "@/lib/recommendation-engine/categories/mask"
import { buildOilCategoryDecision } from "@/lib/recommendation-engine/categories/oil"
import { buildPeelingCategoryDecision } from "@/lib/recommendation-engine/categories/peeling"
import { buildShampooCategoryDecision } from "@/lib/recommendation-engine/categories/shampoo"
import type {
  CategoryRecommendationSet,
  CareNeedAssessment,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
} from "@/lib/recommendation-engine/types"

export function buildCategoryRecommendationSet(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
  plan: InterventionPlan,
  requestContext: RecommendationRequestContext,
): CategoryRecommendationSet {
  return {
    shampoo: buildShampooCategoryDecision(profile, plan),
    conditioner: buildConditionerCategoryDecision(profile, damage, plan),
    mask: buildMaskCategoryDecision(profile, damage, plan),
    leaveIn: buildLeaveInCategoryDecision(profile, damage, careNeeds, plan),
    oil: buildOilCategoryDecision(profile, requestContext),
    bondbuilder: buildBondbuilderCategoryDecision(profile, damage, plan),
    deepCleansingShampoo: buildDeepCleansingShampooCategoryDecision(profile, damage, plan),
    dryShampoo: buildDryShampooCategoryDecision(profile, plan),
    peeling: buildPeelingCategoryDecision(profile, damage, plan),
  }
}

export * from "@/lib/recommendation-engine/categories/bondbuilder"
export * from "@/lib/recommendation-engine/categories/shampoo"
export * from "@/lib/recommendation-engine/categories/conditioner"
export * from "@/lib/recommendation-engine/categories/mask"
export * from "@/lib/recommendation-engine/categories/leave-in"
export * from "@/lib/recommendation-engine/categories/oil"
export * from "@/lib/recommendation-engine/categories/deep-cleansing-shampoo"
export * from "@/lib/recommendation-engine/categories/dry-shampoo"
export * from "@/lib/recommendation-engine/categories/peeling"
