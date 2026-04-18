import { isBondbuilderCategory } from "@/lib/bondbuilder/constants"
import { isConditionerCategory } from "@/lib/conditioner/constants"
import { isDeepCleansingShampooCategory } from "@/lib/deep-cleansing-shampoo/constants"
import { isDryShampooCategory } from "@/lib/dry-shampoo/constants"
import { isLeaveInCategory } from "@/lib/leave-in/constants"
import { OIL_SUBTYPE_LABELS } from "@/lib/oil/constants"
import { isMaskCategory } from "@/lib/mask/constants"
import { isPeelingCategory } from "@/lib/peeling/constants"
import { isShampooCategory } from "@/lib/shampoo/constants"

export const PRODUCT_CONCERN_CODES = [
  "dandruff",
  "oily_scalp",
  "dryness",
  "frizz",
  "hair_damage",
  "split_ends",
  "breakage",
  "tangling",
  "protein",
  "feuchtigkeit",
  "performance",
  "repair",
  "moisture_anti_frizz",
  "healthy_scalp",
  "normal",
  "trocken",
  "dehydriert-fettig",
  "schuppen",
] as const

export type ProductConcernCode = (typeof PRODUCT_CONCERN_CODES)[number]

export const PRODUCT_CONCERN_LABELS: Record<ProductConcernCode, string> = {
  dandruff: "Schuppen",
  oily_scalp: "Fettige Kopfhaut",
  dryness: "Trockenheit",
  frizz: "Frizz",
  hair_damage: "Haarschaeden",
  split_ends: "Spliss",
  breakage: "Haarbruch",
  tangling: "Verknotungen",
  protein: "Protein",
  feuchtigkeit: "Feuchtigkeit",
  performance: "Performance",
  repair: "Reparatur",
  moisture_anti_frizz: "Feuchtigkeit & Anti-Frizz",
  healthy_scalp: "Gesunde Kopfhaut",
  normal: "Normale Kopfhaut",
  trocken: "Trockene Kopfhaut",
  "dehydriert-fettig": "Dehydriert-fettige Kopfhaut",
  schuppen: "Schuppen",
}

const CONDITIONER_CONCERNS = [
  "dryness",
  "frizz",
  "hair_damage",
  "split_ends",
  "breakage",
  "tangling",
  "protein",
  "feuchtigkeit",
] as const satisfies readonly ProductConcernCode[]

const MASK_CONCERNS = [
  "dryness",
  "frizz",
  "hair_damage",
  "split_ends",
  "breakage",
  "tangling",
  "protein",
  "feuchtigkeit",
  "performance",
] as const satisfies readonly ProductConcernCode[]

const LEAVE_IN_CONCERNS = [
  "dryness",
  "frizz",
  "hair_damage",
  "split_ends",
  "breakage",
  "tangling",
  "repair",
  "moisture_anti_frizz",
] as const satisfies readonly ProductConcernCode[]

const BONDBUILDER_CONCERNS = [
  "hair_damage",
  "split_ends",
  "breakage",
  "repair",
] as const satisfies readonly ProductConcernCode[]

const SHAMPOO_BUCKET_CODES = [
  "normal",
  "trocken",
  "dehydriert-fettig",
  "schuppen",
] as const satisfies readonly ProductConcernCode[]

const SHAMPOO_CONCERNS = [
  "dryness",
  ...SHAMPOO_BUCKET_CODES,
] as const satisfies readonly ProductConcernCode[]

const DEEP_CLEANSING_CONCERNS = [
  "healthy_scalp",
  "oily_scalp",
] as const satisfies readonly ProductConcernCode[]
const DRY_SHAMPOO_CONCERNS = ["oily_scalp"] as const satisfies readonly ProductConcernCode[]
const PEELING_CONCERNS = [
  "healthy_scalp",
  "dandruff",
  "oily_scalp",
] as const satisfies readonly ProductConcernCode[]

const EXTENDED_CATALOG_CONCERN_LABELS: Record<string, string> = {
  ...PRODUCT_CONCERN_LABELS,
  irritationen: "Kopfhautirritationen",
  nix: "Allgemeine Pflege",
  "natuerliches-oel": OIL_SUBTYPE_LABELS["natuerliches-oel"],
  "styling-oel": OIL_SUBTYPE_LABELS["styling-oel"],
  "trocken-oel": OIL_SUBTYPE_LABELS["trocken-oel"],
  stylingoel: OIL_SUBTYPE_LABELS["styling-oel"],
  trockenoel: OIL_SUBTYPE_LABELS["trocken-oel"],
}

export function isProductConcernCode(value: string): value is ProductConcernCode {
  return PRODUCT_CONCERN_CODES.includes(value as ProductConcernCode)
}

export function getAllowedProductConcernCodes(
  category: string | null | undefined,
): ProductConcernCode[] {
  if (isConditionerCategory(category)) return [...CONDITIONER_CONCERNS]
  if (isMaskCategory(category)) return [...MASK_CONCERNS]
  if (isLeaveInCategory(category)) return [...LEAVE_IN_CONCERNS]
  if (isBondbuilderCategory(category)) return [...BONDBUILDER_CONCERNS]
  if (isShampooCategory(category)) return [...SHAMPOO_CONCERNS]
  if (isDeepCleansingShampooCategory(category)) return [...DEEP_CLEANSING_CONCERNS]
  if (isDryShampooCategory(category)) return [...DRY_SHAMPOO_CONCERNS]
  if (isPeelingCategory(category)) return [...PEELING_CONCERNS]
  return []
}

export function getAllowedProductConcernOptions(category: string | null | undefined) {
  return getAllowedProductConcernCodes(category).map((value) => ({
    value,
    label: PRODUCT_CONCERN_LABELS[value],
  }))
}

const PROFILE_SIGNAL_TO_PRODUCT_CONCERN: Partial<Record<string, ProductConcernCode>> = {
  dandruff: "dandruff",
  oily_scalp: "oily_scalp",
  dryness: "dryness",
  frizz: "frizz",
  hair_damage: "hair_damage",
  split_ends: "split_ends",
  breakage: "breakage",
  tangling: "tangling",
}

export function getProductConcernCodesForProfileSignals(
  category: string | null | undefined,
  concerns: readonly string[],
): ProductConcernCode[] {
  const allowed = new Set(getAllowedProductConcernCodes(category))
  const exactCodes = concerns
    .map((concern) => PROFILE_SIGNAL_TO_PRODUCT_CONCERN[concern])
    .filter((value): value is ProductConcernCode => value !== undefined)
    .filter((value) => allowed.has(value))

  return [...new Set(exactCodes)]
}

export function isProductConcernAllowedForCategory(
  category: string | null | undefined,
  concern: string,
): concern is ProductConcernCode {
  return getAllowedProductConcernCodes(category).includes(concern as ProductConcernCode)
}

export function getCatalogConcernLabel(concern: string): string {
  return EXTENDED_CATALOG_CONCERN_LABELS[concern] ?? concern
}
