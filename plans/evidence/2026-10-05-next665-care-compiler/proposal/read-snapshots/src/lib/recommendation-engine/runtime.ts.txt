import type { HairProfile } from "@/lib/types"
import {
  adaptRecommendationInputFromPersistence,
  type PersistenceRoutineItemRow,
} from "@/lib/recommendation-engine/adapters/from-persistence"
import { buildCareNeedAssessment } from "@/lib/recommendation-engine/assessments/care-needs"
import { buildDamageAssessment } from "@/lib/recommendation-engine/assessments/damage"
import { buildResetAssessment } from "@/lib/recommendation-engine/assessments/reset"
import { buildCareBalanceSet } from "@/lib/recommendation-engine/care-balance"
import { buildCategoryRecommendationSet } from "@/lib/recommendation-engine/categories"
import { buildEffectiveCareContext } from "@/lib/recommendation-engine/effective-care-context"
import {
  buildInterventionPlan,
  projectInterventionPlanFromCareBalance,
} from "@/lib/recommendation-engine/planner/intervention"
import { emptyRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"
import { buildShampooCadenceAssessment } from "@/lib/recommendation-engine/shampoo-cadence"
import type {
  CategoryRecommendationSet,
  CareBalanceLegacyDifference,
  CareBalanceLegacyComparison,
  CareBalanceSet,
  CareNeedAssessment,
  DamageAssessment,
  EffectiveCareContext,
  EngineCategoryId,
  InterventionPlan,
  InterventionStep,
  NormalizedProfile,
  RecommendationRequestContext,
  RawRecommendationInput,
  ResetAssessment,
  ShampooCadenceAssessment,
} from "@/lib/recommendation-engine/types"

export interface RecommendationEngineRuntime {
  rawInput: RawRecommendationInput
  requestContext: RecommendationRequestContext
  effectiveContext: EffectiveCareContext
  normalized: NormalizedProfile
  damage: DamageAssessment
  careNeeds: CareNeedAssessment
  reset: ResetAssessment
  shampooCadenceAssessment?: ShampooCadenceAssessment
  careBalance: CareBalanceSet
  legacyPlanComparison?: CareBalanceLegacyComparison
  plan: InterventionPlan
  categories: CategoryRecommendationSet
  unsupportedRoutineCategories: string[]
}

function firstStepForCategory(
  steps: InterventionStep[],
  category: EngineCategoryId,
): InterventionStep | undefined {
  return steps.find((step) => step.category === category)
}

function firstLegacyStepForCategory(
  plan: InterventionPlan,
  category: EngineCategoryId,
): { placement: "active" | "deferred"; step: InterventionStep } | null {
  const activeStep = firstStepForCategory(plan.steps, category)
  if (activeStep) {
    return { placement: "active", step: activeStep }
  }

  const deferredStep = firstStepForCategory(plan.deferredSteps, category)
  if (deferredStep) {
    return { placement: "deferred", step: deferredStep }
  }

  return null
}

function buildCareBalanceLegacyComparison(
  careBalance: CareBalanceSet,
  legacyPlan: InterventionPlan,
): CareBalanceLegacyComparison {
  const projectedPlan = projectInterventionPlanFromCareBalance(careBalance)
  const categories = new Set<EngineCategoryId>()

  for (const row of careBalance.rows) {
    categories.add(row.category)
  }
  for (const step of legacyPlan.steps) {
    if (step.category !== "behavior") {
      categories.add(step.category)
    }
  }
  for (const step of legacyPlan.deferredSteps) {
    if (step.category !== "behavior") {
      categories.add(step.category)
    }
  }

  const differences: CareBalanceLegacyDifference[] = []
  for (const category of categories) {
    const careBalanceRow = careBalance.rows.find((row) => row.category === category)
    if (!careBalanceRow) continue

    const legacyMatch = firstLegacyStepForCategory(legacyPlan, category)
    const projectedStep = firstStepForCategory(projectedPlan.steps, category)
    const legacyAction = legacyMatch?.step.action ?? null
    const legacyPlacement = legacyMatch?.placement ?? null
    const projectedAction = projectedStep?.action ?? null

    if (legacyAction === projectedAction && legacyPlacement !== "deferred") continue

    differences.push({
      category,
      legacyAction,
      legacyPlacement,
      careBalanceAction: careBalanceRow.recommendation,
      legacyReasonCodes: legacyMatch?.step.reasonCodes ?? [],
      careBalanceReasonCodes: careBalanceRow.decisiveReasonCodes,
    })
  }

  return {
    projectedPlan,
    differences,
  }
}

export function buildRecommendationEngineRuntimeFromPersistence(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
): RecommendationEngineRuntime {
  const adapted = adaptRecommendationInputFromPersistence(profile, routineItems)
  const effectiveContext = buildEffectiveCareContext(adapted.input)
  return buildRecommendationEngineRuntimeFromEffectiveContext(
    effectiveContext,
    requestContext,
    adapted.unsupportedRoutineCategories,
    adapted.input,
  )
}

export function buildRecommendationEngineRuntimeFromEffectiveContext(
  effectiveContext: EffectiveCareContext,
  requestContext: RecommendationRequestContext = emptyRecommendationRequestContext(),
  unsupportedRoutineCategories: string[] = [],
  rawInput: RawRecommendationInput = buildRawInputFromEffectiveContext(effectiveContext),
): RecommendationEngineRuntime {
  const normalized = effectiveContext.normalized
  const damage = buildDamageAssessment(normalized)
  const careNeeds = buildCareNeedAssessment(normalized, damage)
  const reset = buildResetAssessment(normalized, requestContext)
  const shampooCadenceAssessment = buildShampooCadenceAssessment(normalized, reset)
  const careBalance = buildCareBalanceSet({
    context: effectiveContext,
    damage,
    careNeeds,
    reset,
    shampooCadenceAssessment,
  })
  const plan = buildInterventionPlan(normalized, damage, careNeeds, reset, requestContext)
  const legacyPlanComparison = buildCareBalanceLegacyComparison(careBalance, plan)
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    requestContext,
    reset,
  )

  return {
    rawInput,
    requestContext,
    effectiveContext,
    normalized,
    damage,
    careNeeds,
    reset,
    shampooCadenceAssessment,
    careBalance,
    legacyPlanComparison,
    plan,
    categories,
    unsupportedRoutineCategories,
  }
}

function buildRawInputFromEffectiveContext(context: EffectiveCareContext): RawRecommendationInput {
  const profile = context.normalized

  return {
    profile: {
      hair_texture: profile.hairTexture,
      hair_length: profile.hairLength,
      thickness: profile.thickness,
      density: profile.density,
      concerns: [...profile.concerns],
      goals: [...profile.goals],
      shampoo_frequency: profile.shampooFrequency,
      heat_styling: profile.heatStyling,
      styling_tools: profile.stylingTools ? [...profile.stylingTools] : null,
      cuticle_condition: profile.cuticleCondition,
      protein_moisture_balance: profile.proteinMoistureBalance,
      scalp_type: profile.scalpType,
      scalp_condition: profile.scalpCondition,
      chemical_treatment: [...profile.chemicalTreatment],
      towel_material: profile.towelMaterial,
      towel_technique: profile.towelTechnique,
      drying_method: profile.dryingMethod,
      brush_type: profile.brushType,
      night_protection: profile.nightProtection ? [...profile.nightProtection] : null,
      uses_heat_protection: profile.usesHeatProtection,
    },
    routineInventory: Object.values(profile.routineInventory).flatMap((item) =>
      item?.present === true
        ? [
            {
              category: item.category,
              product_name: item.productName,
              frequency_range: item.frequencyBand,
              product_id: item.matchStatus === "matched" ? item.productId : null,
              product_submission_id:
                item.matchStatus === "pending_review" || item.matchStatus === "needs_more_info"
                  ? item.productSubmissionId
                  : null,
              match_status: item.matchStatus,
            },
          ]
        : [],
    ),
  }
}
