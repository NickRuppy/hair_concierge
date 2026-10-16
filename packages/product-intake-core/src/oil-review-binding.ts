import { createHash } from "node:crypto"

export type OilIntakeReviewSnapshot = {
  /**
   * v1 remains the immutable v0.8 receipt shape. v2 is the lean v0.10
   * current-intake receipt; both deliberately bind the same source identity
   * and projection preimage.
   */
  version: "oil-intake-review-v1" | "oil-intake-review-v2"
  submissionId: string
  jobId: string
  artifactId: string
  admissionContextSha256: string
  resolvedIdentityArtifactId: string
  envelopeSha256: string
  method: Record<string, unknown>
  rawSha256: string
  normalizedSha256: string
  rawPropertyScope: Record<string, unknown>
  normalizedFinal: Record<string, unknown>
  specOperations: unknown[]
}

/** Canonicalization belongs to new review receipts only, never provenance bytes. */
export function stableOilReviewJson(value: unknown): string {
  function stable(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(stable)
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, stable(child)]),
      )
    return item
  }
  return JSON.stringify(stable(value))
}
export function oilReviewFingerprint(value: unknown): string {
  return createHash("sha256").update(stableOilReviewJson(value)).digest("hex")
}
export const intakeSnapshotFingerprint = oilReviewFingerprint
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function oilReviewRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected oil review object")
  return value as Record<string, unknown>
}
const PRODUCT_FIELDS = [
  "canonical_brand",
  "product_line",
  "clean_name",
  "category_key",
  "suitable_thicknesses",
  "affiliate_link",
  "price_eur",
  "currency",
  "purchase_link_status",
  "net_content_value",
  "net_content_unit",
  "market_segment",
]
/** Exact bounded property scope shared by export, import and publication preflight. */
export function extractOilPropertyScope(final: unknown): Record<string, unknown> {
  const value = oilReviewRecord(final)
  const product = oilReviewRecord(value.product)
  const scope = structuredClone({
    product: Object.fromEntries(
      PRODUCT_FIELDS.filter((key) => Object.hasOwn(product, key)).map((key) => [key, product[key]]),
    ),
    ...Object.fromEntries(
      ["identifiers", "category_specs", "field_rationales", "sources"]
        .filter((key) => Object.hasOwn(value, key))
        .map((key) => [key, value[key]]),
    ),
  }) as Record<string, unknown>
  if (scope.field_rationales && typeof scope.field_rationales === "object") {
    scope.field_rationales = Object.fromEntries(
      Object.entries(scope.field_rationales).filter(
        ([key]) =>
          ![
            "product.image_url",
            "product.canonical_image_sha256",
            "product.thumbnail_image_url",
            "product.price_checked_at",
            "product.purchase_link_checked_at",
          ].includes(key),
      ),
    )
  }
  return scope
}
export function assertOilReviewSnapshot(value: unknown): asserts value is OilIntakeReviewSnapshot {
  const snapshot = oilReviewRecord(value)
  const allowed = new Set([
    "version",
    "submissionId",
    "jobId",
    "artifactId",
    "admissionContextSha256",
    "resolvedIdentityArtifactId",
    "envelopeSha256",
    "method",
    "rawSha256",
    "normalizedSha256",
    "rawPropertyScope",
    "normalizedFinal",
    "specOperations",
  ])
  if (Object.keys(snapshot).some((key) => !allowed.has(key)))
    throw new Error("Unexpected oil snapshot field")
  if (snapshot.version !== "oil-intake-review-v1" && snapshot.version !== "oil-intake-review-v2")
    throw new Error("Unsupported oil intake snapshot")
  for (const key of ["submissionId", "jobId", "artifactId", "resolvedIdentityArtifactId"])
    if (typeof snapshot[key] !== "string" || !UUID_PATTERN.test(snapshot[key] as string))
      throw new Error(`Invalid oil snapshot ${key}`)
  for (const key of ["envelopeSha256", "rawSha256", "normalizedSha256", "admissionContextSha256"])
    if (typeof snapshot[key] !== "string" || !/^[a-f0-9]{64}$/.test(snapshot[key] as string))
      throw new Error(`Invalid oil snapshot ${key}`)
  oilReviewRecord(snapshot.method)
  oilReviewRecord(snapshot.rawPropertyScope)
  oilReviewRecord(snapshot.normalizedFinal)
  if (!Array.isArray(snapshot.specOperations)) throw new Error("Missing oil spec operations")
  if (Buffer.byteLength(stableOilReviewJson(snapshot)) > 128 * 1024)
    throw new Error("Oil review snapshot exceeds 128 KiB")
}
