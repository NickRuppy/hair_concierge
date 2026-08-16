import { createHash } from "node:crypto"

import { z } from "zod"

import { personalPlanCategorySchema } from "@/lib/personal-plan/products/contracts"

import type { PersonalPlanCategory } from "./contracts"

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const repairEvidenceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceType: z.enum(["manufacturer", "retailer", "professional_authority", "internal_verified"]),
  checkedAt: isoDateSchema,
  note: z.string().trim().min(1),
})

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    jsonValueSchema.array(),
    z.record(z.string(), jsonValueSchema),
  ]),
)

const repairEntrySchema = z.object({
  productId: z.string().uuid(),
  categoryKey: personalPlanCategorySchema,
  expectedOldFingerprint: sha256Schema,
  intendedAuthority: z.record(z.string(), jsonValueSchema),
  evidence: repairEvidenceSchema.array().min(1),
  expectedNewFingerprint: sha256Schema,
})

export const catalogAuthorityRepairManifestSchema = z.object({
  schemaVersion: z.literal(1),
  slice: z.enum(["shampoo_conditioner", "leave_in_oil", "remaining_categories_protocols"]),
  entries: repairEntrySchema.array().min(1),
  review: z.object({
    state: z.enum(["draft", "approved"]),
    reviewedBy: z.string().trim().min(1).nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewedContentFingerprint: sha256Schema.nullable(),
  }),
})

export type CatalogAuthorityRepairManifest = z.infer<typeof catalogAuthorityRepairManifestSchema>

export type CatalogAuthorityCurrentState = {
  productId: string
  categoryKey: PersonalPlanCategory
  authority: Record<string, unknown>
}

const REPAIR_SLICE_CATEGORIES = {
  shampoo_conditioner: new Set<PersonalPlanCategory>(["shampoo", "conditioner"]),
  leave_in_oil: new Set<PersonalPlanCategory>(["leave_in", "oil"]),
  remaining_categories_protocols: new Set<PersonalPlanCategory>([
    "heat_protectant",
    "mask",
    "scalp_care",
    "dry_shampoo",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ]),
} satisfies Record<CatalogAuthorityRepairManifest["slice"], Set<PersonalPlanCategory>>

export function catalogAuthorityValueFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")
}

export function catalogAuthorityRepairReviewFingerprint(
  manifest: CatalogAuthorityRepairManifest,
): string {
  return catalogAuthorityValueFingerprint({
    schemaVersion: manifest.schemaVersion,
    slice: manifest.slice,
    entries: manifest.entries,
  })
}

export function assertCatalogAuthorityRepairReady(
  input: unknown,
  currentStates: readonly CatalogAuthorityCurrentState[],
): CatalogAuthorityRepairManifest {
  const manifest = catalogAuthorityRepairManifestSchema.parse(input)
  if (
    manifest.review.state !== "approved" ||
    !manifest.review.reviewedBy ||
    !manifest.review.reviewedAt ||
    !manifest.review.reviewedContentFingerprint
  ) {
    throw new Error("catalog_authority_repair_not_approved")
  }

  const productIds = manifest.entries.map((entry) => entry.productId)
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("catalog_authority_repair_duplicate_product")
  }

  const currentByProduct = new Map<string, CatalogAuthorityCurrentState>()
  for (const current of currentStates) {
    if (currentByProduct.has(current.productId)) {
      throw new Error("catalog_authority_repair_duplicate_current_state")
    }
    currentByProduct.set(current.productId, current)
  }

  for (const entry of manifest.entries) {
    if (!REPAIR_SLICE_CATEGORIES[manifest.slice].has(entry.categoryKey)) {
      throw new Error(`catalog_authority_repair_slice_category_conflict:${entry.productId}`)
    }
    const expectedNewFingerprint = catalogAuthorityValueFingerprint(entry.intendedAuthority)
    if (entry.expectedNewFingerprint !== expectedNewFingerprint) {
      throw new Error(`catalog_authority_repair_new_fingerprint_mismatch:${entry.productId}`)
    }
    const current = currentByProduct.get(entry.productId)
    if (!current) {
      throw new Error(`catalog_authority_repair_current_state_missing:${entry.productId}`)
    }
    if (current.categoryKey !== entry.categoryKey) {
      throw new Error(`catalog_authority_repair_category_conflict:${entry.productId}`)
    }
    if (catalogAuthorityValueFingerprint(current.authority) !== entry.expectedOldFingerprint) {
      throw new Error(`catalog_authority_repair_stale_current_state:${entry.productId}`)
    }
    if (entry.expectedOldFingerprint === entry.expectedNewFingerprint) {
      throw new Error(`catalog_authority_repair_no_change:${entry.productId}`)
    }
  }

  if (
    manifest.review.reviewedContentFingerprint !== catalogAuthorityRepairReviewFingerprint(manifest)
  ) {
    throw new Error("catalog_authority_repair_review_stale")
  }
  return manifest
}

// Deterministic canonical JSON: code-unit key ordering (never locale-sensitive)
// and hard rejection of values JSON.stringify would silently coerce.
function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("catalog_authority_fingerprint_undefined_value")
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("catalog_authority_fingerprint_non_finite_number")
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new Error("catalog_authority_fingerprint_unsupported_value")
  }
  return serialized
}
