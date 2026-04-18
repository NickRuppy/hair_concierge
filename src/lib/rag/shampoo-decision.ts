import { SCALP_CONDITION_LABELS, SCALP_TYPE_LABELS } from "@/lib/vocabulary"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import {
  deriveShampooBucket,
  deriveScalpTypeBucket,
  SHAMPOO_BUCKET_LABELS,
} from "@/lib/shampoo/constants"
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
  scalp_type:
    "Wie wuerdest du deine Kopfhaut beschreiben - eher fettig, trocken oder ausgeglichen?",
  scalp_condition:
    "Hast du aktuell Kopfhautbeschwerden - keine, Schuppen, trockene Schuppen oder gereizte Kopfhaut?",
}

const SHAMPOO_FIELD_ORDER: ShampooProfileField[] = ["thickness", "scalp_type", "scalp_condition"]
const THICKNESS_REASON_LABELS = {
  fine: "feinem",
  normal: "mittelstarkem",
  coarse: "dickem",
} as const

export function isShampooScalpTypeRequired(profile: HairProfile | null): boolean {
  return !profile?.scalp_condition && !profile?.scalp_type
}

export function getRequiredShampooProfileFields(
  profile: HairProfile | null,
): ShampooProfileField[] {
  const required: ShampooProfileField[] = ["thickness"]

  if (!profile?.scalp_condition && !profile?.scalp_type) {
    required.push("scalp_type", "scalp_condition")
  } else if (profile?.scalp_condition) {
    required.push("scalp_condition")
  } else {
    required.push("scalp_type")
  }

  return required
}

export function getMissingShampooProfileFields(profile: HairProfile | null): ShampooProfileField[] {
  return getRequiredShampooProfileFields(profile).filter((field) => !profile?.[field])
}

export function isShampooProfileEligible(profile: HairProfile | null): boolean {
  return getMissingShampooProfileFields(profile).length === 0
}

export function getShampooProfileCompleteness(profile: HairProfile | null): {
  filledCount: number
  totalCount: number
  score: number
} {
  const requiredFields = getRequiredShampooProfileFields(profile)
  const filledCount = requiredFields.filter((field) => Boolean(profile?.[field])).length

  return {
    filledCount,
    totalCount: requiredFields.length,
    score: requiredFields.length === 0 ? 0 : filledCount / requiredFields.length,
  }
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
  candidateCount = 0,
): ShampooDecision {
  const missingProfileFields = getMissingShampooProfileFields(profile)
  const matchedBucket = deriveShampooBucket(profile?.scalp_type, profile?.scalp_condition)
  const matchedConcernCode = matchedBucket
  const matchedProfile = {
    thickness: profile?.thickness ?? null,
    scalp_type: profile?.scalp_type ?? null,
    scalp_condition: profile?.scalp_condition ?? null,
  }
  const eligible = isShampooProfileEligible(profile)

  // Dandruff users get a secondary scalp-type-based bucket for rotation
  const secondaryBucket =
    profile?.scalp_condition === "dandruff" ? deriveScalpTypeBucket(profile?.scalp_type) : null

  return {
    category: "shampoo",
    eligible,
    missing_profile_fields: missingProfileFields,
    matched_profile: matchedProfile,
    matched_bucket: matchedBucket,
    secondary_bucket: secondaryBucket,
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
  return SHAMPOO_FIELD_ORDER.filter((field) => decision.missing_profile_fields.includes(field)).map(
    (field) => SHAMPOO_CLARIFICATION_QUESTIONS[field],
  )
}

export function buildShampooRetrievalFilter(
  intent: IntentType,
  productCategory: ProductCategory,
  decision?: ShampooDecision,
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
  decision: ShampooDecision,
): MatchedProduct[] {
  return candidates.map((product) => {
    const thicknessReason = decision.matched_profile.thickness
      ? `Passt gut zu ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness]} Haar.`
      : "Passt zur eingeordneten Haardicke."
    const bucketReason = decision.matched_bucket
      ? `Der aktuelle Shampoo-Bucket ist ${SHAMPOO_BUCKET_LABELS[decision.matched_bucket]}.`
      : "Passt zum aktuellen Shampoo-Fokus."
    const scalpPriorityReason = decision.matched_profile.scalp_condition
      ? `Solange ${SCALP_CONDITION_LABELS[decision.matched_profile.scalp_condition] ?? decision.matched_profile.scalp_condition} aktiv ist, priorisieren wir diesen Shampoo-Fokus vor dem normalen Kopfhauttyp.`
      : decision.matched_profile.scalp_type
        ? `Ohne akute Kopfhautbeschwerden richtet sich die Auswahl nach deinem Kopfhauttyp: ${SCALP_TYPE_LABELS[decision.matched_profile.scalp_type] ?? decision.matched_profile.scalp_type}.`
        : "Ohne akute Kopfhautbeschwerden richtet sich die Auswahl nach deinem Kopfhauttyp."

    const recommendationMeta: ShampooRecommendationMetadata = {
      category: "shampoo",
      score: Math.round(toBaseScore(product) * 10) / 10,
      top_reasons: [thicknessReason, bucketReason, scalpPriorityReason],
      tradeoffs: [],
      usage_hint: "",
      matched_profile: decision.matched_profile,
      matched_bucket: decision.matched_bucket,
      matched_concern_code: decision.matched_concern_code,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
    }
  })
}
