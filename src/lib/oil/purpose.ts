import type { HairProfile } from "@/lib/types"
import type { OilNoRecommendationReason, OilPurpose, OilSubtype } from "@/lib/oil/constants"

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

const THERAPY_OIL_BRAND_TERMS = ["neqi rosemary", "keralz", "no. 17", "her homie"]

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

const DRY_OIL_EXPLICIT_TERMS = ["trockenöl", "trockenoel", "trocken-oel", "dry oil", "dry-oil"]

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

const STYLING_OIL_EXPLICIT_TERMS = ["stylingöl", "stylingoel", "styling-oel", "styling oil"]

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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)))
}

export function inferOilPurposeFromMessage(message: string): OilPurpose | null {
  const text = normalizeText(message)

  if (includesAny(text, NATURAL_OIL_INTENT_TERMS)) {
    return "pre_wash_oiling"
  }

  if (includesAny(text, NATURAL_OIL_EXPLICIT_TERMS)) {
    return "pre_wash_oiling"
  }

  if (includesAny(text, STYLING_OIL_EXPLICIT_TERMS)) {
    return "styling_finish"
  }

  if (includesAny(text, DRY_OIL_EXPLICIT_TERMS)) {
    return "light_finish"
  }

  if (
    includesAny(text, THERAPY_OIL_BRAND_TERMS) ||
    includesAny(text, THERAPY_OIL_INGREDIENT_TERMS)
  ) {
    return "pre_wash_oiling"
  }

  if (includesAny(text, STYLING_OIL_CONTEXT_TERMS)) {
    return "styling_finish"
  }

  if (includesAny(text, DRY_OIL_CONTEXT_TERMS)) {
    return "light_finish"
  }

  return null
}

export function mapOilPurposeToSubtype(purpose: OilPurpose | null): OilSubtype | null {
  switch (purpose) {
    case "pre_wash_oiling":
      return "natuerliches-oel"
    case "styling_finish":
      return "styling-oel"
    case "light_finish":
      return "trocken-oel"
    default:
      return null
  }
}

export function inferOilNoRecommendationReason(
  purpose: OilPurpose | null,
  message: string,
): OilNoRecommendationReason | null {
  const text = normalizeText(message)

  if (
    purpose === "pre_wash_oiling" &&
    (includesAny(text, THERAPY_OIL_BRAND_TERMS) || includesAny(text, THERAPY_OIL_INGREDIENT_TERMS))
  ) {
    return "therapy_oil_missing"
  }

  if (
    purpose !== "pre_wash_oiling" &&
    includesAny(text, NON_OIL_CATEGORY_TERMS) &&
    !includesAny(text, NATURAL_OIL_INTENT_TERMS)
  ) {
    return "better_non_oil_category"
  }

  return null
}

export function hasOilAdjunctScalpSupport(
  profile: HairProfile | null,
  purpose: OilPurpose | null,
  message: string,
): boolean {
  if (purpose !== "pre_wash_oiling") return false

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
