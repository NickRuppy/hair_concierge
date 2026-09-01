import { SHAMPOO_BUCKETS, type ShampooBucket } from "@/lib/shampoo/constants"

export type ShampooProtocolRole = "shampoo_everyday" | "shampoo_dandruff"

export function isCanonicalShampooBucket(bucket: unknown): bucket is ShampooBucket {
  return SHAMPOO_BUCKETS.includes(bucket as ShampooBucket)
}

/**
 * Derive executable Shampoo roles only from reviewed scalp-route buckets.
 * A treatment-only `schuppen` product does not implicitly support the regular
 * cleansing role; a dual-use product must carry at least one non-`schuppen`
 * bucket as independent authority.
 */
export function deriveShampooProtocolRoles(
  buckets: readonly (string | null | undefined)[],
): ShampooProtocolRole[] {
  const roles = buckets.flatMap((bucket): ShampooProtocolRole[] => {
    if (!isCanonicalShampooBucket(bucket)) return []
    return [bucket === "schuppen" ? "shampoo_dandruff" : "shampoo_everyday"]
  })
  return [...new Set(roles)]
}
