import type { HairProfile, IntentType, ProductCategory } from "@/lib/types"
import type { CategoryDecisions } from "@/lib/rag/contracts"
import {
  buildShampooDecision,
  buildShampooClarificationQuestions,
  buildShampooRetrievalFilter,
} from "./shampoo-wrapper"
import {
  buildConditionerDecision,
  buildConditionerClarificationQuestions,
} from "./conditioner-wrapper"
import { buildLeaveInDecision, buildLeaveInClarificationQuestions } from "./leave-in-wrapper"
import {
  buildOilDecision,
  buildOilClarificationQuestions,
  buildOilRetrievalFilter,
} from "./oil-wrapper"
import { buildClarificationQuestions } from "@/lib/rag/clarification"

/**
 * Build the initial category decisions from the hair profile.
 * Returns all applicable decisions; the orchestrator picks the one matching the routed category.
 */
export function buildInitialDecisions(
  productCategory: ProductCategory,
  hairProfile: HairProfile | null,
  message: string,
): CategoryDecisions {
  const decisions: CategoryDecisions = {}

  if (productCategory === "shampoo") {
    decisions.shampoo = buildShampooDecision(hairProfile)
  }
  if (productCategory === "conditioner") {
    decisions.conditioner = buildConditionerDecision(hairProfile)
  }
  if (productCategory === "leave_in") {
    decisions.leaveIn = buildLeaveInDecision(hairProfile)
  }
  if (productCategory === "oil") {
    decisions.oil = buildOilDecision(hairProfile, message)
  }

  return decisions
}

/**
 * Build clarification questions for the given category decision.
 * Falls back to generic slot-based clarification if no category-specific handler applies.
 */
export function buildCategoryClarificationQuestions(
  productCategory: ProductCategory,
  decisions: CategoryDecisions,
  shouldPlanRoutine: boolean,
  routineClarificationQuestions: string[] | undefined,
  classification: { normalized_filters: Record<string, string | string[] | null> },
  hairProfile: HairProfile | null,
): string[] {
  if (shouldPlanRoutine && routineClarificationQuestions) {
    return routineClarificationQuestions
  }

  if (productCategory === "shampoo" && decisions.shampoo && !decisions.shampoo.eligible) {
    return buildShampooClarificationQuestions(decisions.shampoo)
  }
  if (
    productCategory === "conditioner" &&
    decisions.conditioner &&
    !decisions.conditioner.eligible
  ) {
    return buildConditionerClarificationQuestions(decisions.conditioner)
  }
  if (productCategory === "leave_in" && decisions.leaveIn && !decisions.leaveIn.eligible) {
    return buildLeaveInClarificationQuestions(decisions.leaveIn)
  }
  if (productCategory === "oil" && decisions.oil && !decisions.oil.eligible) {
    return buildOilClarificationQuestions(decisions.oil)
  }

  return buildClarificationQuestions(
    classification.normalized_filters,
    productCategory,
    hairProfile,
  )
}

/**
 * Build the metadata filter for retrieval based on category decisions.
 * Returns undefined if no category-specific filter applies.
 */
export function buildCategoryRetrievalFilter(
  intent: IntentType,
  productCategory: ProductCategory,
  decisions: CategoryDecisions,
  hairProfile: HairProfile | null,
): Record<string, string> | undefined {
  const shampooFilter = buildShampooRetrievalFilter(intent, productCategory, decisions.shampoo)
  if (shampooFilter) return shampooFilter

  const oilFilter = buildOilRetrievalFilter(intent, productCategory, decisions.oil)
  if (oilFilter) return oilFilter

  // Conditioner concern code filter
  const conditionerConcern =
    productCategory === "conditioner" ? decisions.conditioner?.matched_concern_code : null

  if (intent === "product_recommendation") {
    if (hairProfile?.thickness) {
      const filter: Record<string, string> = { thickness: hairProfile.thickness }
      if (conditionerConcern) {
        filter.concern = conditionerConcern
      }
      return filter
    }
  }

  return undefined
}

/**
 * Get the primary category decision for trace/synthesis purposes.
 */
export function getPrimaryCategoryDecision(decisions: CategoryDecisions) {
  return decisions.shampoo ?? decisions.conditioner ?? decisions.leaveIn ?? decisions.oil
}
