import { buildClarificationQuestions } from "@/lib/rag/clarification"
import type {
  ClassificationResult,
  HairProfile,
  IntentType,
  ProductCategory,
  RecommendationEngineTrace,
} from "@/lib/types"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import { buildRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  type RecommendationEngineRuntime,
} from "@/lib/recommendation-engine/runtime"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import type { CategoryDecision, EngineCategoryId } from "@/lib/recommendation-engine/types"

const SHAMPOO_CLARIFICATION_QUESTIONS = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  scalp_type:
    "Wie wuerdest du deine Kopfhaut beschreiben - eher fettig, trocken oder ausgeglichen?",
  scalp_condition:
    "Hast du aktuell Kopfhautbeschwerden - keine, Schuppen, trockene Schuppen oder gereizte Kopfhaut?",
} as const

const CONDITIONER_CLARIFICATION_QUESTIONS = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  protein_moisture_balance:
    "Hast du mal den Zugtest gemacht? Einzelnes Haar ziehen - bricht es direkt, dehnt es sich, oder federt es zurueck?",
} as const

const LEAVE_IN_CLARIFICATION_QUESTIONS = {
  hair_texture: "Ist dein Haar eher glatt, wellig, lockig oder kraus?",
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  density: "Hast du eher wenig, mittel viele oder viele Haare?",
  care_signal:
    "Was soll deine Pflege gerade vor allem leisten - eher Frizz baendigen, Feuchtigkeit geben, reparieren, Definition geben oder Schutz vor Hitze?",
  styling_signal:
    "Was machst du nach dem Waschen meistens - lufttrocknen, ohne Hitze stylen oder mit Foehn/Hitzetools arbeiten?",
} as const

const OIL_CLARIFICATION_QUESTIONS = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  oil_purpose:
    "Wofuer moechtest du das Oel vor allem nutzen - fuer Hair Oiling vor dem Waschen, als Styling-Finish gegen Frizz/mehr Glanz oder als leichtes Trocken-Oel?",
} as const

export function toEngineRequestedCategory(
  productCategory: ProductCategory,
  shouldPlanRoutine = false,
): EngineCategoryId | null {
  if (shouldPlanRoutine || productCategory === "routine") {
    return "routine"
  }

  switch (productCategory) {
    case "shampoo":
    case "conditioner":
    case "leave_in":
    case "mask":
    case "oil":
    case "bondbuilder":
    case "deep_cleansing_shampoo":
    case "dry_shampoo":
    case "peeling":
      return productCategory
    default:
      return null
  }
}

export function buildRecommendationEngineRuntimeForChat(params: {
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  productCategory: ProductCategory
  shouldPlanRoutine?: boolean
  message: string
}): RecommendationEngineRuntime {
  const { hairProfile, routineItems, productCategory, shouldPlanRoutine = false, message } = params

  const requestContext = buildRecommendationRequestContext({
    requestedCategory: toEngineRequestedCategory(productCategory, shouldPlanRoutine),
    message,
  })

  return buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems, requestContext)
}

export function getRuntimeCategoryDecision(
  runtime: RecommendationEngineRuntime,
  productCategory: ProductCategory,
): CategoryDecision | null {
  switch (productCategory) {
    case "shampoo":
      return runtime.categories.shampoo
    case "conditioner":
      return runtime.categories.conditioner
    case "leave_in":
      return runtime.categories.leaveIn
    case "mask":
      return runtime.categories.mask
    case "oil":
      return runtime.categories.oil
    case "bondbuilder":
      return runtime.categories.bondbuilder
    case "deep_cleansing_shampoo":
      return runtime.categories.deepCleansingShampoo
    case "dry_shampoo":
      return runtime.categories.dryShampoo
    case "peeling":
      return runtime.categories.peeling
    default:
      return null
  }
}

export function buildRecommendationEngineTrace(params: {
  runtime: RecommendationEngineRuntime
}): RecommendationEngineTrace {
  const { runtime } = params

  return {
    request_context: runtime.requestContext,
    damage: runtime.damage,
    care_needs: runtime.careNeeds,
    intervention_plan: runtime.plan,
    unsupported_routine_categories: runtime.unsupportedRoutineCategories,
  }
}

export function summarizeEngineCategoryDecision(
  decision: CategoryDecision | null,
): Record<string, unknown> | null {
  if (!decision) return null

  const summary: Record<string, unknown> = {
    category: decision.category,
    relevant: decision.relevant,
    action: decision.action,
    plan_reason_codes: decision.planReasonCodes,
    notes: decision.notes,
    current_inventory: decision.currentInventory
      ? {
          product_name: decision.currentInventory.productName,
          frequency_band: decision.currentInventory.frequencyBand,
        }
      : null,
  }

  if (decision.category === "oil") {
    summary.clarification_needed = decision.clarificationNeeded
    summary.no_recommendation_reason = decision.noRecommendationReason
  }

  summary.target_profile = decision.targetProfile

  return summary
}

export function getShampooMissingProfileFields(
  profile: HairProfile | null,
): Array<"thickness" | "scalp_type" | "scalp_condition"> {
  const missing: Array<"thickness" | "scalp_type" | "scalp_condition"> = []

  if (!profile?.thickness) {
    missing.push("thickness")
  }

  if (!profile?.scalp_condition) {
    missing.push("scalp_condition")
  }

  if ((!profile?.scalp_condition || profile.scalp_condition === "none") && !profile?.scalp_type) {
    missing.push("scalp_type")
  }

  return missing
}

export function getShampooProfileCompleteness(profile: HairProfile | null): {
  filledCount: number
  totalCount: number
  score: number
} {
  const missingFields = getShampooMissingProfileFields(profile)
  const totalCount = 2 + (profile?.scalp_condition && profile.scalp_condition !== "none" ? 0 : 1)
  const filledCount = totalCount - missingFields.length

  return {
    filledCount,
    totalCount,
    score: filledCount / totalCount,
  }
}

export function getLeaveInMissingProfileFields(params: {
  runtime: RecommendationEngineRuntime
  hairProfile: HairProfile | null
}): Array<"hair_texture" | "thickness" | "density" | "care_signal" | "styling_signal"> {
  const { runtime, hairProfile } = params
  const missing: Array<
    "hair_texture" | "thickness" | "density" | "care_signal" | "styling_signal"
  > = []
  const decision = runtime.categories.leaveIn

  if (!hairProfile?.hair_texture) missing.push("hair_texture")
  if (!hairProfile?.thickness) missing.push("thickness")
  if (!hairProfile?.density) missing.push("density")
  if (!decision.targetProfile?.needBucket) missing.push("care_signal")
  if (!decision.targetProfile?.stylingContext) missing.push("styling_signal")

  return missing
}

export function getOilMissingProfileFields(params: {
  runtime: RecommendationEngineRuntime
  hairProfile: HairProfile | null
}): Array<"thickness" | "oil_purpose"> {
  const { runtime, hairProfile } = params
  const missing: Array<"thickness" | "oil_purpose"> = []

  if (!hairProfile?.thickness) missing.push("thickness")
  if (!runtime.requestContext.oilPurpose && !runtime.requestContext.storedRoutineOilPurpose) {
    missing.push("oil_purpose")
  }

  return missing
}

export function buildEngineClarificationQuestions(params: {
  productCategory: ProductCategory
  runtime: RecommendationEngineRuntime
  shouldPlanRoutine: boolean
  routineClarificationQuestions?: string[]
  classification: Pick<ClassificationResult, "normalized_filters">
  hairProfile: HairProfile | null
}): string[] {
  const {
    productCategory,
    runtime,
    shouldPlanRoutine,
    routineClarificationQuestions,
    classification,
    hairProfile,
  } = params

  if (shouldPlanRoutine && routineClarificationQuestions) {
    return routineClarificationQuestions
  }

  switch (productCategory) {
    case "shampoo":
      return getShampooMissingProfileFields(hairProfile).map(
        (field) => SHAMPOO_CLARIFICATION_QUESTIONS[field],
      )
    case "conditioner": {
      const questions: string[] = []
      if (!hairProfile?.thickness) {
        questions.push(CONDITIONER_CLARIFICATION_QUESTIONS.thickness)
      }
      if (!hairProfile?.protein_moisture_balance) {
        questions.push(CONDITIONER_CLARIFICATION_QUESTIONS.protein_moisture_balance)
      }
      return questions
    }
    case "leave_in":
      return getLeaveInMissingProfileFields({ runtime, hairProfile }).map(
        (field) => LEAVE_IN_CLARIFICATION_QUESTIONS[field],
      )
    case "oil":
      return getOilMissingProfileFields({ runtime, hairProfile }).map(
        (field) => OIL_CLARIFICATION_QUESTIONS[field],
      )
    default:
      return buildClarificationQuestions(
        classification.normalized_filters,
        productCategory,
        hairProfile,
      )
  }
}

export function buildEngineRetrievalFilter(params: {
  intent: IntentType
  productCategory: ProductCategory
  runtime: RecommendationEngineRuntime
  hairProfile: HairProfile | null
}): Record<string, string> | undefined {
  const { intent, productCategory, runtime, hairProfile } = params

  if (!PRODUCT_INTENTS.includes(intent)) {
    return undefined
  }

  switch (productCategory) {
    case "shampoo": {
      const decision = runtime.categories.shampoo
      if (!hairProfile?.thickness || !decision.targetProfile?.shampooBucket) {
        return undefined
      }
      return {
        thickness: hairProfile.thickness,
        concern: decision.targetProfile.shampooBucket,
      }
    }
    case "conditioner": {
      if (!hairProfile?.thickness) {
        return undefined
      }

      const concern =
        runtime.categories.conditioner.targetProfile?.balance === "moisture"
          ? "feuchtigkeit"
          : runtime.categories.conditioner.targetProfile?.balance === "protein"
            ? "protein"
            : null

      return concern
        ? { thickness: hairProfile.thickness, concern }
        : { thickness: hairProfile.thickness }
    }
    case "oil": {
      const decision = runtime.categories.oil
      if (
        !hairProfile?.thickness ||
        !decision.targetProfile?.matcherSubtype ||
        decision.clarificationNeeded ||
        decision.noRecommendationReason
      ) {
        return undefined
      }

      return {
        thickness: hairProfile.thickness,
        concern: decision.targetProfile.matcherSubtype,
      }
    }
    default:
      return undefined
  }
}

export function getShampooConcernForRetrieval(
  runtime: RecommendationEngineRuntime,
  productCategory: ProductCategory,
): string | null {
  if (productCategory !== "shampoo") {
    return null
  }

  return runtime.categories.shampoo.targetProfile?.shampooBucket ?? null
}
