import {
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
} from "@/lib/vocabulary"
import { mapScalpToConcernCode } from "@/lib/rag/scalp-mapper"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import type {
  HairProfile,
  IntentType,
  ProductCategory,
  ShampooDecision,
  ShampooProfileField,
  ShampooRecommendationMetadata,
} from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"

const SHAMPOO_CLARIFICATION_QUESTIONS: Record<ShampooProfileField, string> = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  scalp_type: "Wie wuerdest du deine Kopfhaut beschreiben - eher fettig, trocken oder ausgeglichen?",
  scalp_condition: "Hast du aktuell Kopfhautbeschwerden - keine, Schuppen, trockene Schuppen oder gereizte Kopfhaut?",
}

const SHAMPOO_FIELD_ORDER: ShampooProfileField[] = ["thickness", "scalp_type", "scalp_condition"]
const THICKNESS_REASON_LABELS = {
  fine: "feinem",
  normal: "mittelstarkem",
  coarse: "dickem",
} as const

function getMissingProfileFields(profile: HairProfile | null): ShampooProfileField[] {
  const missing: ShampooProfileField[] = []

  if (!profile?.thickness) missing.push("thickness")
  if (!profile?.scalp_type) missing.push("scalp_type")
  if (!profile?.scalp_condition) missing.push("scalp_condition")

  return missing
}

function toBaseScore(product: MatchedProduct): number {
  if (typeof product.combined_score === "number" && Number.isFinite(product.combined_score)) {
    return product.combined_score * 100
  }
  if (typeof product.similarity === "number" && Number.isFinite(product.similarity)) {
    return product.similarity * 100
  }
  return 0
}

export function buildShampooDecision(
  profile: HairProfile | null,
  candidateCount = 0
): ShampooDecision {
  const missingProfileFields = getMissingProfileFields(profile)
  const matchedConcernCode = mapScalpToConcernCode(profile?.scalp_type, profile?.scalp_condition)
  const matchedProfile = {
    thickness: profile?.thickness ?? null,
    scalp_type: profile?.scalp_type ?? null,
    scalp_condition: profile?.scalp_condition ?? null,
  }
  const eligible = missingProfileFields.length === 0

  return {
    category: "shampoo",
    eligible,
    missing_profile_fields: missingProfileFields,
    matched_profile: matchedProfile,
    matched_concern_code: matchedConcernCode,
    retrieval_filter: {
      thickness: matchedProfile.thickness,
      concern: matchedConcernCode,
    },
    candidate_count: candidateCount,
    no_catalog_match: eligible && candidateCount === 0,
  }
}

export function buildShampooClarificationQuestions(decision: ShampooDecision): string[] {
  return SHAMPOO_FIELD_ORDER
    .filter((field) => decision.missing_profile_fields.includes(field))
    .map((field) => SHAMPOO_CLARIFICATION_QUESTIONS[field])
}

export function buildShampooRetrievalFilter(
  intent: IntentType,
  productCategory: ProductCategory,
  decision?: ShampooDecision
): Record<string, string> | undefined {
  if (!decision || productCategory !== "shampoo" || !PRODUCT_INTENTS.includes(intent)) {
    return undefined
  }

  const filter: Record<string, string> = {}

  if (decision.retrieval_filter.thickness) {
    filter.thickness = decision.retrieval_filter.thickness
  }
  if (decision.retrieval_filter.concern) {
    filter.concern = decision.retrieval_filter.concern
  }

  return Object.keys(filter).length > 0 ? filter : undefined
}

export function annotateShampooRecommendations(
  candidates: MatchedProduct[],
  decision: ShampooDecision
): MatchedProduct[] {
  return candidates.map((product) => {
    const thicknessReason = decision.matched_profile.thickness
      ? `Passt gut zu ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness]} Haar.`
      : "Passt zur eingeordneten Haardicke."
    const scalpTypeReason = decision.matched_profile.scalp_type
      ? `Ist fuer ${SCALP_TYPE_LABELS[decision.matched_profile.scalp_type] ?? decision.matched_profile.scalp_type} Kopfhaut eingeordnet.`
      : "Passt zum eingeordneten Kopfhauttyp."
    const scalpConditionReason =
      decision.matched_profile.scalp_condition === "none"
        ? "Ist fuer Kopfhaut ohne konkrete Beschwerden eingeordnet."
        : `Ist fuer ${SCALP_CONDITION_LABELS[decision.matched_profile.scalp_condition ?? ""] ?? decision.matched_profile.scalp_condition} eingeordnet.`

    const recommendationMeta: ShampooRecommendationMetadata = {
      category: "shampoo",
      score: Math.round(toBaseScore(product) * 10) / 10,
      top_reasons: [thicknessReason, scalpTypeReason, scalpConditionReason],
      tradeoffs: [],
      usage_hint: "",
      matched_profile: decision.matched_profile,
      matched_concern_code: decision.matched_concern_code,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
    }
  })
}
