import type { ScalpCondition, ScalpType } from "@/lib/vocabulary"
import type { HairThickness } from "@/lib/vocabulary"

export const SHAMPOO_DB_CATEGORIES = ["Shampoo", "Shampoo Profi"] as const
export const SHAMPOO_SOURCE_MANAGED_MESSAGE =
  "Shampoo-Produkte werden aktuell nur ueber Quelldaten und Ingest gepflegt."

export const SHAMPOO_BUCKETS = [
  "schuppen",
  "irritationen",
  "normal",
  "dehydriert-fettig",
  "trocken",
] as const

export type ShampooBucket = (typeof SHAMPOO_BUCKETS)[number]
export interface ShampooBucketPair {
  thickness: HairThickness
  shampoo_bucket: ShampooBucket
}

export const SHAMPOO_BUCKET_LABELS: Record<ShampooBucket, string> = {
  schuppen: "Schuppen",
  irritationen: "Irritationen",
  normal: "Normal",
  "dehydriert-fettig": "Dehydriert / Fettig",
  trocken: "Trocken",
}

export function isShampooCategory(category?: string | null): boolean {
  return SHAMPOO_DB_CATEGORIES.includes(
    (category ?? "").trim() as (typeof SHAMPOO_DB_CATEGORIES)[number],
  )
}

export function deriveShampooBucket(
  scalpType?: ScalpType | null,
  scalpCondition?: ScalpCondition | null,
): ShampooBucket | null {
  if (scalpCondition) {
    if (scalpCondition === "dandruff") return "schuppen"
    if (scalpCondition === "irritated") return "irritationen"
    if (scalpCondition === "dry_flakes") return "trocken"
  }

  if (scalpType === "balanced") return "normal"
  if (scalpType === "oily") return "dehydriert-fettig"
  if (scalpType === "dry") return "trocken"

  return null
}

/** Derives a scalp-type-based bucket (ignoring scalp condition) for rotation pairing. */
export function deriveScalpTypeBucket(scalpType?: ScalpType | null): ShampooBucket | null {
  if (scalpType === "balanced") return "normal"
  if (scalpType === "oily") return "dehydriert-fettig"
  if (scalpType === "dry") return "trocken"
  return "normal" // safe default for dandruff rotation
}
