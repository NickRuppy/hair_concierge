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

const DRY_OIL_EXPLICIT_TERMS = [
  "trockenöl",
  "trockenoel",
  "trocken-oel",
  "trockenes öl",
  "trockenes oel",
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
  "nicht fettig aussehen",
  "ohne fettig",
  "fettig auszusehen",
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
  "längen",
  "laengen",
  "spitzen versiegeln",
  "spitzen",
]

const NEGATED_SCALP_OIL_PATTERNS = [
  /\bnicht\s+(?:auf|an)\s+die\s+kopfhaut\b/,
  /\bnicht\s+(?:fuer|fur)\s+die\s+kopfhaut\b/,
  /\bnur\s+in\s+die\s+(?:spitzen|laengen|langen)\b/,
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

const LIGHTWEIGHT_POSITIVE_TERMS = [
  "nicht beschwer",
  "ohne zu beschwer",
  "nicht fettig",
  "nicht fettig aussehen",
  "ohne fettig",
  "fettig auszusehen",
  "ohne zu fetten",
  "schwerelos",
  "weightless",
  "lightweight",
]

const SCALP_TREATMENT_PATTERNS = [
  /\bschuppen\w*\b/,
  /\bdandruff\b/,
  /\bjuck(?:t|en|end\w*|reiz\w*)?\b/,
  /\bitch(?:y|ing)?\b/,
  /\birrit(?:ation|ated|iert\w*)\b/,
  /\broetung\w*\b/,
  /\brotung\w*\b/,
  /\bentzund\w*\b/,
  /\bhaarausfall\b/,
  /\bhair\s+loss\b/,
  /\b(?:haar)?wachstum\b/,
  /\bgrowth\b/,
]

const OVERLOAD_PATTERNS = [
  /\bfettig\w*\b/,
  /\bgreasy\b/,
  /\bstrahnig\w*\b/,
  /\bbeschwert\w*\b/,
  /\bcoated\b/,
  /\bbelegt\w*\b/,
  /\b(?:schwere?s?|heavy)\s+(?:haar|haare|hair)\w*\b/,
  /\b(?:haar|haare|hair)\w*\s+(?:fuehlt\s+sich\s+)?(?:schwer|heavy)\b/,
  /\blimp\b/,
  /\bdull\b/,
  /\bstumpf\w*\b/,
  /\bbuildup\b/,
  /\bbuild\s+up\b/,
  /\bablager\w*\b/,
]

const FLAT_OVERLOAD_PATTERNS = [
  /\bplatt(?:e|es|en|er)?\s+(?:haar|haare|hair)\w*\b/,
  /\b(?:haar|haare|hair)\w*\s+(?:ist|sind|wirken|wirkt|feels|look|looks)?\s*platt\b/,
  /\bflat\s+hair\b/,
  /\bhair\s+(?:is|looks|feels)?\s*flat\b/,
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

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function matchesOverloadComplaint(text: string): boolean {
  if (matchesAny(text, OVERLOAD_PATTERNS)) return true
  if (/\bschlaf\w*\b/.test(text) || /\bsleep\w*\b/.test(text)) return false
  return matchesAny(text, FLAT_OVERLOAD_PATTERNS)
}

export function inferOilPurposeFromMessage(message: string): OilPurpose | null {
  const text = normalizeText(message)
  const hasExplicitFinishIntent =
    includesAny(text, STYLING_OIL_EXPLICIT_TERMS) ||
    includesAny(text, STYLING_OIL_CONTEXT_TERMS) ||
    includesAny(text, DRY_OIL_EXPLICIT_TERMS) ||
    includesAny(text, DRY_OIL_CONTEXT_TERMS)
  const hasNegatedScalpIntent = matchesAny(text, NEGATED_SCALP_OIL_PATTERNS)

  if (hasExplicitFinishIntent && hasNegatedScalpIntent) {
    return includesAny(text, DRY_OIL_EXPLICIT_TERMS) || includesAny(text, DRY_OIL_CONTEXT_TERMS)
      ? "light_finish"
      : "styling_finish"
  }

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
    includesAny(text, THERAPY_OIL_BRAND_TERMS) ||
    includesAny(text, THERAPY_OIL_INGREDIENT_TERMS)
  ) {
    return "therapy_oil_missing"
  }

  if (matchesAny(text, SCALP_TREATMENT_PATTERNS)) {
    return "scalp_treatment_needed"
  }

  if (
    purpose !== null &&
    matchesOverloadComplaint(text) &&
    !includesAny(text, LIGHTWEIGHT_POSITIVE_TERMS)
  ) {
    return "overload_risk"
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
    matchesAny(text, [/\bjuck(?:t|en|end\w*|reiz\w*)?\b/, /\bschuppen\w*\b/]) ||
    profile?.scalp_condition === "dandruff" ||
    profile?.scalp_condition === "dry_flakes" ||
    profile?.scalp_condition === "irritated" ||
    profile?.scalp_type === "dry" ||
    profile?.scalp_type === "oily"
  )
}
