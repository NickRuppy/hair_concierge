import type { MatchedProduct } from "@/lib/rag/product-matcher"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import {
  OIL_NO_RECOMMENDATION_LABELS,
  OIL_SUBTYPE_LABELS,
  OIL_USE_MODE_LABELS,
  type OilNoRecommendationReason,
} from "@/lib/oil/constants"
import {
  hasOilAdjunctScalpSupport,
  inferOilNoRecommendationReason,
  inferOilPurposeFromMessage,
  mapOilPurposeToSubtype,
} from "@/lib/oil/purpose"
import type {
  HairProfile,
  IntentType,
  OilDecision,
  OilProfileField,
  OilRecommendationMetadata,
  ProductCategory,
} from "@/lib/types"

const OIL_CLARIFICATION_QUESTIONS: Record<OilProfileField, string> = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  oil_purpose:
    "Wofuer moechtest du das Oel vor allem nutzen - fuer Hair Oiling vor dem Waschen, als Styling-Finish gegen Frizz/mehr Glanz oder als leichtes Trocken-Oel?",
}

const OIL_FIELD_ORDER: OilProfileField[] = ["thickness", "oil_purpose"]

const THICKNESS_REASON_LABELS = {
  fine: "feinem",
  normal: "mittelstarkem",
  coarse: "dickem",
} as const

function getMissingProfileFields(profile: HairProfile | null, message: string): OilProfileField[] {
  const missing: OilProfileField[] = []

  if (!profile?.thickness) missing.push("thickness")
  if (!inferOilPurposeFromMessage(message)) missing.push("oil_purpose")

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

function buildUsageHint(decision: OilDecision): string {
  if (decision.use_mode === "pre_wash_oiling") {
    if (decision.adjunct_scalp_support) {
      return "Vor dem Waschen sparsam auf trockene Kopfhaut und Laengen geben, 30-45 Minuten einwirken lassen und anschliessend mit Shampoo auswaschen. Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primaere Hebel."
    }

    return "Vor dem Waschen sparsam auf trockene Kopfhaut und/oder Laengen geben, 30-45 Minuten einwirken lassen und anschliessend mit Shampoo auswaschen."
  }

  if (decision.use_mode === "light_finish") {
    return "Sehr sparsam in trockene Laengen und Spitzen geben, damit das Haar leicht bleibt und nicht fettig wirkt."
  }

  return "Sparsam als Finish in trockene oder fast trockene Laengen und Spitzen geben, um Frizz zu baendigen und Glanz zu geben."
}

export function buildOilDecision(
  profile: HairProfile | null,
  message: string,
  candidateCount = 0,
): OilDecision {
  const missingProfileFields = getMissingProfileFields(profile, message)
  const purpose = inferOilPurposeFromMessage(message)
  const matchedSubtype = mapOilPurposeToSubtype(purpose)
  const useMode = purpose
  const noRecommendationReason = inferOilNoRecommendationReason(purpose, message)
  const eligible = missingProfileFields.length === 0
  const adjunctScalpSupport = hasOilAdjunctScalpSupport(profile, purpose, message)

  return {
    category: "oil",
    eligible,
    missing_profile_fields: missingProfileFields,
    matched_profile: {
      thickness: profile?.thickness ?? null,
    },
    matched_subtype: matchedSubtype,
    use_mode: useMode,
    adjunct_scalp_support: adjunctScalpSupport,
    candidate_count: candidateCount,
    no_catalog_match: eligible && !noRecommendationReason && candidateCount === 0,
    no_recommendation: eligible && noRecommendationReason !== null,
    no_recommendation_reason: noRecommendationReason,
  }
}

export function buildOilClarificationQuestions(decision: OilDecision): string[] {
  return OIL_FIELD_ORDER.filter((field) => decision.missing_profile_fields.includes(field)).map(
    (field) => OIL_CLARIFICATION_QUESTIONS[field],
  )
}

export function buildOilRetrievalFilter(
  intent: IntentType,
  productCategory: ProductCategory,
  decision?: OilDecision,
): Record<string, string> | undefined {
  if (!decision || productCategory !== "oil" || !PRODUCT_INTENTS.includes(intent)) {
    return undefined
  }

  if (
    !decision.matched_profile.thickness ||
    !decision.matched_subtype ||
    decision.no_recommendation
  ) {
    return undefined
  }

  return {
    thickness: decision.matched_profile.thickness,
    concern: decision.matched_subtype,
  }
}

export function annotateOilRecommendations(
  candidates: MatchedProduct[],
  decision: OilDecision,
): MatchedProduct[] {
  return candidates.map((product) => {
    const topReasons = [
      decision.matched_profile.thickness
        ? `Passt gut zu ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness]} Haar.`
        : "Passt zur eingeordneten Haardicke.",
      decision.matched_subtype
        ? `Das Oel ist fuer ${OIL_SUBTYPE_LABELS[decision.matched_subtype].toLowerCase()} eingeordnet.`
        : "Passt zum aktuellen Oel-Typ.",
      decision.use_mode
        ? `Die Anwendung passt zu ${OIL_USE_MODE_LABELS[decision.use_mode].toLowerCase()}.`
        : "Die Anwendung passt gut zum aktuellen Oel-Einsatz.",
    ]

    const tradeoffs = decision.adjunct_scalp_support
      ? [
          "Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primaere Hebel.",
        ]
      : []

    const recommendationMeta: OilRecommendationMetadata = {
      category: "oil",
      score: Math.round(toBaseScore(product) * 10) / 10,
      top_reasons: topReasons,
      tradeoffs,
      usage_hint: buildUsageHint(decision),
      matched_profile: decision.matched_profile,
      matched_subtype: decision.matched_subtype,
      use_mode: decision.use_mode,
      adjunct_scalp_support: decision.adjunct_scalp_support,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
    }
  })
}

export function getOilNoRecommendationMessage(
  reason: OilNoRecommendationReason | null,
): string | null {
  if (!reason) return null
  return OIL_NO_RECOMMENDATION_LABELS[reason]
}
