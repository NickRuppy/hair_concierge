import type { MatchedProduct } from "@/lib/rag/product-matcher"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import {
  OIL_NO_RECOMMENDATION_LABELS,
  OIL_SUBTYPE_LABELS,
  OIL_USE_MODE_LABELS,
  type OilNoRecommendationReason,
  type OilSubtype,
  type OilUseMode,
} from "@/lib/oil/constants"
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

const NATURAL_OIL_INTENT_TERMS = [
  "hair oiling",
  "hairoiling",
  "scalp oiling",
  "scalp-oiling",
  "kopfhaut",
  "applikator",
  "applicator",
  "massage",
  "massieren",
  "vor dem waschen",
  "pre wash",
  "pre-wash",
  "einwirken",
]

const NATURAL_OIL_EXPLICIT_TERMS = [
  "naturöl",
  "natueroel",
  "natural oil",
  "basisöl",
  "basisoel",
  "pures öl",
  "pures oel",
]

const THERAPY_OIL_BRAND_TERMS = [
  "neqi rosemary",
  "keralz",
  "no. 17",
  "her homie",
]

const THERAPY_OIL_INGREDIENT_TERMS = [
  "rosemary oil",
  "rosmarinöl",
  "rosmarinoel",
  "tea tree oil",
  "teebaumöl",
  "teebaumoel",
  "peppermint oil",
  "pfefferminzöl",
  "pfefferminzoel",
]

const DRY_OIL_EXPLICIT_TERMS = [
  "trockenöl",
  "trockenoel",
  "trocken-oel",
  "dry oil",
  "dry-oil",
]

const DRY_OIL_CONTEXT_TERMS = [
  "leicht",
  "lightweight",
  "weightless",
  "schwerelos",
  "nicht beschweren",
  "nicht fettig",
  "ohne zu fetten",
  "schnell einziehen",
  "refresh",
  "auffrischen",
]

const STYLING_OIL_EXPLICIT_TERMS = [
  "stylingöl",
  "stylingoel",
  "styling-oel",
  "styling oil",
]

const STYLING_OIL_CONTEXT_TERMS = [
  "finish",
  "glanz",
  "shine",
  "frizz",
  "flyaways",
  "smooth",
  "smoothing",
  "glätten",
  "glaenzen",
  "gloss",
  "spitzen versiegeln",
  "spitzen",
]

const NON_OIL_CATEGORY_TERMS = [
  "hitzeschutz",
  "leave-in",
  "leave in",
  "conditioner",
  "spuelung",
  "spülung",
  "maske",
  "haarkur",
]

const THICKNESS_REASON_LABELS = {
  fine: "feinem",
  normal: "mittelstarkem",
  coarse: "dickem",
} as const

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)))
}

function inferOilSubtype(message: string): OilSubtype | null {
  const text = normalizeText(message)

  if (includesAny(text, NATURAL_OIL_INTENT_TERMS)) {
    return "natuerliches-oel"
  }

  if (includesAny(text, NATURAL_OIL_EXPLICIT_TERMS)) {
    return "natuerliches-oel"
  }

  if (includesAny(text, STYLING_OIL_EXPLICIT_TERMS)) {
    return "styling-oel"
  }

  if (includesAny(text, DRY_OIL_EXPLICIT_TERMS)) {
    return "trocken-oel"
  }

  if (
    includesAny(text, THERAPY_OIL_BRAND_TERMS) ||
    includesAny(text, THERAPY_OIL_INGREDIENT_TERMS)
  ) {
    return "natuerliches-oel"
  }

  if (includesAny(text, STYLING_OIL_CONTEXT_TERMS)) {
    return "styling-oel"
  }

  if (includesAny(text, DRY_OIL_CONTEXT_TERMS)) {
    return "trocken-oel"
  }

  return null
}

function inferUseMode(
  subtype: OilSubtype | null,
): OilUseMode | null {
  if (!subtype) return null

  if (subtype === "natuerliches-oel") {
    return "pre_wash_oiling"
  }

  if (subtype === "trocken-oel") {
    return "light_finish"
  }

  return "styling_finish"
}

function inferNoRecommendationReason(
  subtype: OilSubtype | null,
  message: string,
): OilNoRecommendationReason | null {
  const text = normalizeText(message)

  if (
    subtype === "natuerliches-oel" &&
    (
      includesAny(text, THERAPY_OIL_BRAND_TERMS) ||
      includesAny(text, THERAPY_OIL_INGREDIENT_TERMS)
    )
  ) {
    return "therapy_oil_missing"
  }

  if (
    subtype !== "natuerliches-oel" &&
    includesAny(text, NON_OIL_CATEGORY_TERMS) &&
    !includesAny(text, NATURAL_OIL_INTENT_TERMS)
  ) {
    return "better_non_oil_category"
  }

  return null
}

function hasScalpSignals(profile: HairProfile | null, message: string): boolean {
  const text = normalizeText(message)
  return (
    text.includes("kopfhaut") ||
    text.includes("scalp") ||
    text.includes("juck") ||
    text.includes("schuppen") ||
    profile?.scalp_condition === "dandruff" ||
    profile?.scalp_condition === "dry_flakes" ||
    profile?.scalp_condition === "irritated" ||
    profile?.scalp_type === "dry" ||
    profile?.scalp_type === "oily"
  )
}

function getMissingProfileFields(
  profile: HairProfile | null,
  message: string,
): OilProfileField[] {
  const missing: OilProfileField[] = []

  if (!profile?.thickness) missing.push("thickness")
  if (!inferOilSubtype(message)) missing.push("oil_purpose")

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
  const matchedSubtype = inferOilSubtype(message)
  const useMode = inferUseMode(matchedSubtype)
  const noRecommendationReason = inferNoRecommendationReason(matchedSubtype, message)
  const eligible = missingProfileFields.length === 0
  const adjunctScalpSupport =
    matchedSubtype === "natuerliches-oel" &&
    hasScalpSignals(profile, message)

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
  return OIL_FIELD_ORDER
    .filter((field) => decision.missing_profile_fields.includes(field))
    .map((field) => OIL_CLARIFICATION_QUESTIONS[field])
}

export function buildOilRetrievalFilter(
  intent: IntentType,
  productCategory: ProductCategory,
  decision?: OilDecision,
): Record<string, string> | undefined {
  if (!decision || productCategory !== "oil" || !PRODUCT_INTENTS.includes(intent)) {
    return undefined
  }

  if (!decision.matched_profile.thickness || !decision.matched_subtype || decision.no_recommendation) {
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
      ? ["Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primaere Hebel."]
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

export function getOilNoRecommendationMessage(reason: OilNoRecommendationReason | null): string | null {
  if (!reason) return null
  return OIL_NO_RECOMMENDATION_LABELS[reason]
}
