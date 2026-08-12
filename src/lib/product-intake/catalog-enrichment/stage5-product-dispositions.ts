import { createHash } from "node:crypto"

import { z } from "zod"

const DISPOSITIONS = [
  "awaiting_exact_analysis",
  "retired_from_personal_plan",
  "identity_ambiguous",
] as const

const REASON_CODES = [
  "insufficient_executable_directions",
  "insufficient_finished_product_evidence",
  "wrong_category",
  "identity_ambiguous",
  "duplicate_identity",
  "non_hair_product",
] as const

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
    text: z.string().min(1),
    source_type: z.enum(["manufacturer", "retailer", "professional_authority"]),
    checked_at: z.string().date(),
  })
  .strict()

const dispositionItemSchema = z
  .object({
    product_id: z.string().uuid(),
    product_name: z.string().min(1),
    expected_current_category: z.string().nullable(),
    target_category: z.string().min(1),
    disposition: z.enum(DISPOSITIONS),
    reason_code: z.enum(REASON_CODES),
    reason: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
  })
  .strict()

export const personalPlanProductDispositionManifestSchema = z
  .object({
    schema_version: z.literal("personal-plan-stage5-product-dispositions-v1"),
    batch_id: z.string().regex(/^S5-[0-9]{2}-[a-z0-9-]+$/),
    frozen_cohort_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    review: z.discriminatedUnion("state", [
      z.object({ state: z.literal("prepared_for_review"), reviewed_by: z.null() }).strict(),
      z.object({ state: z.literal("approved_by_nick"), reviewed_by: z.literal("nick") }).strict(),
    ]),
    items: z.array(dispositionItemSchema).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>()
    for (const [index, item] of manifest.items.entries()) {
      if (ids.has(item.product_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "product_id"],
          message: "A product may occur only once",
        })
      }
      ids.add(item.product_id)
      if (item.expected_current_category !== item.target_category) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "target_category"],
          message: "Disposition cannot repair or recategorize products",
        })
      }
      if (item.disposition === "identity_ambiguous" && item.reason_code !== "identity_ambiguous") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "reason_code"],
          message: "Identity-ambiguous disposition requires identity_ambiguous reason",
        })
      }
      if (
        item.disposition === "retired_from_personal_plan" &&
        !["wrong_category", "duplicate_identity", "non_hair_product"].includes(item.reason_code)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "reason_code"],
          message:
            "Retired disposition requires wrong_category, duplicate_identity, or non_hair_product reason",
        })
      }
    }
  })

export type PersonalPlanProductDispositionManifest = z.infer<
  typeof personalPlanProductDispositionManifestSchema
>

export type BuiltPersonalPlanProductDispositionManifest = {
  manifest: PersonalPlanProductDispositionManifest
  canonicalJson: string
  fingerprint: string
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]),
  )
}

export function buildPersonalPlanProductDispositionManifest(
  input: unknown,
): BuiltPersonalPlanProductDispositionManifest {
  const parsed = personalPlanProductDispositionManifestSchema.parse(input)
  const manifest = personalPlanProductDispositionManifestSchema.parse({
    ...parsed,
    items: [...parsed.items].sort((left, right) => left.product_id.localeCompare(right.product_id)),
  })
  const canonicalJson = JSON.stringify(stable(manifest))
  return {
    manifest,
    canonicalJson,
    fingerprint: createHash("sha256").update(canonicalJson).digest("hex"),
  }
}

export type PersonalPlanProductDispositionRead = {
  listProducts(ids: string[]): Promise<
    Array<{
      id: string
      category_key: string | null
      origin: string | null
      is_active: boolean
      lifecycle_status: string
      is_chaarlie_recommended: boolean | null
    }>
  >
  listDispositions(ids: string[]): Promise<
    Array<{
      product_id: string
      disposition: string
      reason_code: string
      source_batch: string
      source_fingerprint: string
      reason: string
      sources: unknown
    }>
  >
}

export async function preflightPersonalPlanProductDispositionManifest(
  built: BuiltPersonalPlanProductDispositionManifest,
  read: PersonalPlanProductDispositionRead,
) {
  const ids = built.manifest.items.map(({ product_id }) => product_id)
  const [products, existingDispositions] = await Promise.all([
    read.listProducts(ids),
    read.listDispositions(ids),
  ])
  const productById = new Map(products.map((product) => [product.id, product]))
  const dispositionById = new Map(
    existingDispositions.map((disposition) => [disposition.product_id, disposition]),
  )
  const blockers: string[] = []

  for (const item of built.manifest.items) {
    const product = productById.get(item.product_id)
    if (!product) {
      blockers.push(`product_missing:${item.product_id}`)
      continue
    }
    if (product.origin !== "curated") blockers.push(`origin_not_curated:${item.product_id}`)
    if (!product.is_active || product.lifecycle_status !== "active") {
      blockers.push(`product_not_active:${item.product_id}`)
    }
    if (product.category_key !== item.expected_current_category) {
      blockers.push(`current_category_conflict:${item.product_id}`)
    }
    const existing = dispositionById.get(item.product_id)
    if (
      existing &&
      (existing.disposition !== item.disposition ||
        existing.reason_code !== item.reason_code ||
        existing.source_batch !== built.manifest.batch_id ||
        existing.source_fingerprint !== built.fingerprint ||
        existing.reason !== item.reason ||
        JSON.stringify(stable(existing.sources)) !== JSON.stringify(stable(item.sources)))
    ) {
      blockers.push(`disposition_conflict:${item.product_id}`)
    }
  }

  return {
    ok: blockers.length === 0,
    writes: false as const,
    batchId: built.manifest.batch_id,
    fingerprint: built.fingerprint,
    itemCount: built.manifest.items.length,
    blockers: [...new Set(blockers)].sort(),
  }
}
