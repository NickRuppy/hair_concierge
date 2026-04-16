import type { HairProfile } from "@/lib/types"
import {
  adaptRecommendationInputFromPersistence,
  type PersistenceRoutineItemRow,
} from "@/lib/recommendation-engine/adapters/from-persistence"
import { buildCareNeedAssessment } from "@/lib/recommendation-engine/assessments/care-needs"
import { buildDamageAssessment } from "@/lib/recommendation-engine/assessments/damage"
import { buildCategoryRecommendationSet } from "@/lib/recommendation-engine/categories"
import { normalizeRecommendationInput } from "@/lib/recommendation-engine/normalize"
import { buildInterventionPlan } from "@/lib/recommendation-engine/planner/intervention"
import { emptyRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"
import type {
  CategoryRecommendationSet,
  CareNeedAssessment,
  DamageAssessment,
  InterventionPlan,
  NormalizedProfile,
  RecommendationRequestContext,
  RawRecommendationInput,
} from "@/lib/recommendation-engine/types"

export interface RecommendationEngineRuntime {
  rawInput: RawRecommendationInput
  requestContext: RecommendationRequestContext
  normalized: NormalizedProfile
  damage: DamageAssessment
  careNeeds: CareNeedAssessment
  plan: InterventionPlan
  categories: CategoryRecommendationSet
  unsupportedRoutineCategories: string[]
}

export function buildRecommendationEngineRuntimeFromPersistence(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
): RecommendationEngineRuntime {
  const adapted = adaptRecommendationInputFromPersistence(profile, routineItems)
  const normalized = normalizeRecommendationInput(adapted.input)
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const plan = buildInterventionPlan(normalized, damage, careNeeds)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
  )

  return {
    rawInput: adapted.input,
    requestContext,
    normalized,
    damage,
    careNeeds,
    plan,
    categories,
    unsupportedRoutineCategories: adapted.unsupportedRoutineCategories,
  }
}
