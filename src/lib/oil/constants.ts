import type { HairThickness } from "@/lib/vocabulary"

export const OIL_DB_CATEGORIES = ["Öle"] as const

export const OIL_SUBTYPES = ["natuerliches-oel", "styling-oel", "trocken-oel"] as const

export type OilSubtype = (typeof OIL_SUBTYPES)[number]

export const OIL_SUBTYPE_LABELS: Record<OilSubtype, string> = {
  "natuerliches-oel": "Natuerliches Oel",
  "styling-oel": "Styling-Oel",
  "trocken-oel": "Trocken-Oel",
}

export const OIL_SUBTYPE_OPTIONS = OIL_SUBTYPES.map((value) => ({
  value,
  label: OIL_SUBTYPE_LABELS[value],
}))

export const OIL_PURPOSES = ["pre_wash_oiling", "styling_finish", "light_finish"] as const

export type OilPurpose = (typeof OIL_PURPOSES)[number]

export const OIL_PURPOSE_LABELS: Record<OilPurpose, string> = {
  pre_wash_oiling: "Hair Oiling vor dem Waschen",
  styling_finish: "Styling-Finish",
  light_finish: "Leichtes Finish",
}

export const OIL_USE_MODES = OIL_PURPOSES
export type OilUseMode = OilPurpose
export const OIL_USE_MODE_LABELS = OIL_PURPOSE_LABELS

export const OIL_NO_RECOMMENDATION_REASONS = [
  "better_non_oil_category",
  "therapy_oil_missing",
] as const

export type OilNoRecommendationReason = (typeof OIL_NO_RECOMMENDATION_REASONS)[number]

export const OIL_NO_RECOMMENDATION_LABELS: Record<OilNoRecommendationReason, string> = {
  better_non_oil_category: "Ein anderes Produkt passt hier besser als ein Oel.",
  therapy_oil_missing: "Das passende Therapie-/Kopfhautoel ist aktuell nicht in der Datenbank.",
}

export function isOilCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "öle" || normalized === "oele"
}

export function buildOilEligibilityPairs(
  thicknesses: HairThickness[],
  subtypes: OilSubtype[],
): Array<{ thickness: HairThickness; oil_subtype: OilSubtype }> {
  return thicknesses.flatMap((thickness) =>
    subtypes.map((oil_subtype) => ({
      thickness,
      oil_subtype,
    })),
  )
}
