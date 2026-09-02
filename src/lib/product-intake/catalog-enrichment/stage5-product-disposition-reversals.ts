import { createHash } from "node:crypto"

import { z } from "zod"

export const PRODUCT_DISPOSITION_REVERSAL_SCHEMA_VERSION =
  "personal-plan-product-disposition-reversal-v1" as const
export const PRODUCT_DISPOSITION_REVERSAL_PROJECT_ID = "pqdkhefxsxkyeqelqegq" as const
export const PRODUCT_DISPOSITION_REVERSAL_REVIEWER = "nick" as const
export const PRODUCT_DISPOSITION_REVERSAL_SOURCE_BATCH =
  "S5-21-product-search-dispositions" as const
export const PRODUCT_DISPOSITION_REVERSAL_MIGRATION = "20260831182124" as const
export const PRODUCT_DISPOSITION_REVERSAL_E18_OIL_MIGRATION = "20260901162000" as const
export const PRODUCT_DISPOSITION_REVERSAL_OGX_MIGRATION = "20260902090000" as const
export const PRODUCT_DISPOSITION_REVERSAL_SOURCE_FINGERPRINT =
  "dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6" as const

// Review state alone never authorizes a reversal. Each approved batch must also
// match the exact canonical SHA-256 pinned here after Nick's cohort decision.
export const PRODUCT_DISPOSITION_REVERSAL_APPROVED_MANIFEST_FINGERPRINTS = {
  "S5R-01-oil-reentry": "f13d497a33ec651920b6610efdd0404783fd707f7d505299c5ba5fbd4080be69",
  "S5R-03-e18-oil-reentry": "9bdbcad847edc3140d045f059efb3f762951a1d32c68040915c0f93e7d58e7a3",
  "S5R-04-ogx-identity-resolution":
    "9ccb3e1511725bb61428e7d57d47fd0945c89848aefa956612a61d40292b9733",
} as const

export const PRODUCT_DISPOSITION_REVERSAL_MIGRATIONS = {
  [PRODUCT_DISPOSITION_REVERSAL_MIGRATION]: PRODUCT_DISPOSITION_REVERSAL_MIGRATION,
  [PRODUCT_DISPOSITION_REVERSAL_E18_OIL_MIGRATION]: PRODUCT_DISPOSITION_REVERSAL_E18_OIL_MIGRATION,
  [PRODUCT_DISPOSITION_REVERSAL_OGX_MIGRATION]: PRODUCT_DISPOSITION_REVERSAL_OGX_MIGRATION,
} as const

export const PRODUCT_DISPOSITION_REVERSAL_BATCH_MIGRATIONS = {
  "S5R-01-oil-reentry": PRODUCT_DISPOSITION_REVERSAL_MIGRATION,
  "S5R-03-e18-oil-reentry": PRODUCT_DISPOSITION_REVERSAL_E18_OIL_MIGRATION,
  "S5R-04-ogx-identity-resolution": PRODUCT_DISPOSITION_REVERSAL_OGX_MIGRATION,
} as const

export const PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS = {
  "S5R-01-oil-reentry": [
    "29e36443-93ff-4b62-9cf0-55ad9f89f530",
    "3eb198a5-9aab-4f28-9df1-c4869c6a12db",
    "517dca50-5d55-4038-ba1d-f9b745708327",
    "9bfe0a67-72ad-4951-bb99-9f2f5d5c724a",
    "a11855eb-64e5-438f-8880-1d3573efa9fa",
    "acf9d5cd-76e4-49c7-9c04-0af1f20506ad",
    "ca4ae209-79d2-4f4d-8e44-46e586cec62d",
  ],
  "S5R-03-e18-oil-reentry": [
    "19aea9c4-4b90-4ec4-8cb6-90cb270010f7",
    "1dce2c18-6a45-4017-a748-e3a7f1cba36f",
    "2ffeae68-c625-4df5-be02-0c1b620aa0fc",
    "38886b62-2c45-4b34-9a24-7d831e97946e",
    "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b",
    "4a95e1de-54e9-4fcd-b227-72a5824d13c1",
  ],
  "S5R-04-ogx-identity-resolution": ["1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf"],
} as const

export const PRODUCT_DISPOSITION_REVERSAL_PRODUCTS = {
  "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf": {
    disposition: "identity_ambiguous",
    reason_code: "identity_ambiguous",
  },
  "19aea9c4-4b90-4ec4-8cb6-90cb270010f7": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_executable_directions",
  },
  "1dce2c18-6a45-4017-a748-e3a7f1cba36f": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_finished_product_evidence",
  },
  "29e36443-93ff-4b62-9cf0-55ad9f89f530": {
    disposition: "retired_from_personal_plan",
    reason_code: "non_hair_product",
  },
  "2ffeae68-c625-4df5-be02-0c1b620aa0fc": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_finished_product_evidence",
  },
  "38886b62-2c45-4b34-9a24-7d831e97946e": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_executable_directions",
  },
  "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_executable_directions",
  },
  "3eb198a5-9aab-4f28-9df1-c4869c6a12db": {
    disposition: "retired_from_personal_plan",
    reason_code: "non_hair_product",
  },
  "4a95e1de-54e9-4fcd-b227-72a5824d13c1": {
    disposition: "awaiting_exact_analysis",
    reason_code: "insufficient_finished_product_evidence",
  },
  "517dca50-5d55-4038-ba1d-f9b745708327": {
    disposition: "retired_from_personal_plan",
    reason_code: "non_hair_product",
  },
  "9bfe0a67-72ad-4951-bb99-9f2f5d5c724a": {
    disposition: "retired_from_personal_plan",
    reason_code: "non_hair_product",
  },
  "a11855eb-64e5-438f-8880-1d3573efa9fa": {
    disposition: "retired_from_personal_plan",
    reason_code: "wrong_category",
  },
  "acf9d5cd-76e4-49c7-9c04-0af1f20506ad": {
    disposition: "retired_from_personal_plan",
    reason_code: "non_hair_product",
  },
  "ca4ae209-79d2-4f4d-8e44-46e586cec62d": {
    disposition: "retired_from_personal_plan",
    reason_code: "wrong_category",
  },
} as const

type ProductDispositionReversalBatchId = keyof typeof PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS

function productIdsForBatch(batchId: string) {
  return PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS[batchId as ProductDispositionReversalBatchId]
}

function requiredMigrationForBatch(batchId: ProductDispositionReversalBatchId) {
  return PRODUCT_DISPOSITION_REVERSAL_BATCH_MIGRATIONS[batchId]
}

const sha256 = /^[a-f0-9]{64}$/

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z
      .string()
      .url()
      .refine((url) => url.startsWith("https://"), "source URL must use HTTPS"),
    checked_at: z.string().date(),
  })
  .strict()

const priorDispositionSourceSchema = sourceSchema.extend({
  text: z.string().min(1),
  source_type: z.string().min(1),
})

const itemSchema = z
  .object({
    product_id: z.string().uuid(),
    expected_product: z
      .object({
        name: z.string().min(1),
        category_key: z.literal("oil"),
        origin: z.literal("curated"),
        is_active: z.literal(true),
        lifecycle_status: z.literal("active"),
      })
      .strict(),
    expected_disposition: z
      .object({
        disposition: z.enum([
          "retired_from_personal_plan",
          "awaiting_exact_analysis",
          "identity_ambiguous",
        ]),
        reason_code: z.enum([
          "wrong_category",
          "non_hair_product",
          "insufficient_executable_directions",
          "insufficient_finished_product_evidence",
          "identity_ambiguous",
        ]),
        reason: z.string().min(1),
        sources: z.array(priorDispositionSourceSchema).min(1),
        source_batch: z.literal(PRODUCT_DISPOSITION_REVERSAL_SOURCE_BATCH),
        source_fingerprint: z.string().regex(sha256),
        reviewed_by: z.literal(PRODUCT_DISPOSITION_REVERSAL_REVIEWER),
      })
      .strict(),
    reversal_reason: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
  })
  .strict()

export const personalPlanProductDispositionReversalManifestSchema = z
  .object({
    schema_version: z.literal(PRODUCT_DISPOSITION_REVERSAL_SCHEMA_VERSION),
    batch_id: z.string().regex(/^S5R-[0-9]{2}-[a-z0-9-]+$/),
    review: z.discriminatedUnion("state", [
      z.object({ state: z.literal("prepared_for_review"), reviewed_by: z.null() }).strict(),
      z
        .object({
          state: z.literal("approved_by_nick"),
          reviewed_by: z.literal(PRODUCT_DISPOSITION_REVERSAL_REVIEWER),
        })
        .strict(),
    ]),
    items: z.array(itemSchema).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const expectedProductIds = productIdsForBatch(manifest.batch_id)
    if (!expectedProductIds) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batch_id"],
        message: "Unknown product disposition reversal batch",
      })
      return
    }
    if (manifest.items.length !== expectedProductIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: `Reversal manifest must contain exactly ${expectedProductIds.length} products`,
      })
    }
    const seen = new Set<string>()
    for (const [index, item] of manifest.items.entries()) {
      const expectedDisposition =
        PRODUCT_DISPOSITION_REVERSAL_PRODUCTS[
          item.product_id as keyof typeof PRODUCT_DISPOSITION_REVERSAL_PRODUCTS
        ]
      if (
        !expectedDisposition ||
        !(expectedProductIds as readonly string[]).includes(item.product_id)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "product_id"],
          message: "Product is outside the exact oil reversal cohort",
        })
      }
      if (seen.has(item.product_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "product_id"],
          message: "Product may occur only once",
        })
      }
      seen.add(item.product_id)
      if (
        expectedDisposition &&
        item.expected_disposition.disposition !== expectedDisposition.disposition
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "expected_disposition", "disposition"],
          message: "Prior disposition does not match the exact approved cohort",
        })
      }
      if (
        expectedDisposition &&
        item.expected_disposition.reason_code !== expectedDisposition.reason_code
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "expected_disposition", "reason_code"],
          message: "Prior reason code does not match the exact approved cohort",
        })
      }
      if (
        item.expected_disposition.source_fingerprint !==
        PRODUCT_DISPOSITION_REVERSAL_SOURCE_FINGERPRINT
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "expected_disposition", "source_fingerprint"],
          message: "Prior source fingerprint does not match the exact approved cohort",
        })
      }
    }
    for (const productId of expectedProductIds) {
      if (!seen.has(productId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: `Exact oil reversal cohort is missing ${productId}`,
        })
      }
    }
  })

export type PersonalPlanProductDispositionReversalManifest = z.infer<
  typeof personalPlanProductDispositionReversalManifestSchema
>

export type BuiltPersonalPlanProductDispositionReversalManifest = {
  manifest: PersonalPlanProductDispositionReversalManifest
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

export function buildPersonalPlanProductDispositionReversalManifest(
  input: unknown,
): BuiltPersonalPlanProductDispositionReversalManifest {
  const parsed = personalPlanProductDispositionReversalManifestSchema.parse(input)
  const manifest = personalPlanProductDispositionReversalManifestSchema.parse({
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

type ProductRow = {
  id: string
  name: string
  category_key: string | null
  origin: string | null
  is_active: boolean
  lifecycle_status: string
  suitable_thicknesses: string[] | null
}
type DispositionRow = {
  product_id: string
  disposition: string
  reason_code: string
  reason: string
  sources: unknown
  source_batch: string
  source_fingerprint: string
  reviewed_by: string
}
type BatchReceiptRow = {
  batch_id: string
  manifest_fingerprint: string
  reviewed_head: string
  reviewed_by: string
  item_count: number
}
type ItemReceiptRow = {
  batch_id: string
  product_id: string
  prior_disposition: string
  prior_reason_code: string
  prior_reason: string
  prior_sources: unknown
  prior_source_batch: string
  prior_source_fingerprint: string
  reversal_reason: string
  reversal_sources: unknown
}
type OilEligibilityRow = {
  product_id: string
  thickness: string | null
  oil_subtype: string | null
}
type OilSpecsRow = { product_id: string; weight: string | null; role_support: string[] | null }
type ProtocolRow = {
  product_id: string
  category: string
  role: string
  source_url: string | null
  source_text: string | null
  guidance_payload: unknown
  guidance_payload_v2: unknown
}

export type PersonalPlanProductDispositionReversalRead = {
  migrationState(version: string): Promise<"absent" | "applied">
  listProducts(ids: string[]): Promise<ProductRow[]>
  listDispositions(ids: string[]): Promise<DispositionRow[]>
  listBatchReceipts(batchId: string): Promise<BatchReceiptRow[]>
  listItemReceipts(batchId: string): Promise<ItemReceiptRow[]>
  listOilEligibility(ids: string[]): Promise<OilEligibilityRow[]>
  listOilSpecs(ids: string[]): Promise<OilSpecsRow[]>
  listProtocols(ids: string[]): Promise<ProtocolRow[]>
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function path(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value
  for (const key of keys) {
    current = object(current)?.[key]
  }
  return current
}

function protocolIsPublicationReady(protocol: ProtocolRow, productId: string, role: string) {
  if (
    protocol.product_id !== productId ||
    protocol.category !== "oil" ||
    protocol.role !== role ||
    !protocol.source_url ||
    !protocol.source_text?.trim()
  ) {
    return false
  }
  const v1 = object(protocol.guidance_payload)
  const evidence = v1?.evidence
  const v1Ready =
    path(v1, "scope", "kind") === "product" &&
    path(v1, "scope", "productId") === productId &&
    path(v1, "scope", "category") === "oil" &&
    Array.isArray(evidence) &&
    evidence.some((entry) => object(entry)?.sourceUrl === protocol.source_url)
  const v2 = object(protocol.guidance_payload_v2)
  const v2Ready =
    v2?.schemaVersion === 2 &&
    v2.contractKind === "product_pointer" &&
    path(v2, "scope", "kind") === "product" &&
    path(v2, "scope", "productId") === productId &&
    path(v2, "scope", "category") === "oil" &&
    v2.runtimeBlockerCode === null
  return v1Ready && v2Ready
}

export async function preflightPersonalPlanProductDispositionReversalManifest(
  built: BuiltPersonalPlanProductDispositionReversalManifest,
  read: PersonalPlanProductDispositionReversalRead,
) {
  const ids = built.manifest.items.map(({ product_id }) => product_id)
  const requiredMigration = requiredMigrationForBatch(
    built.manifest.batch_id as ProductDispositionReversalBatchId,
  )
  const expectedItemCount =
    PRODUCT_DISPOSITION_REVERSAL_BATCH_PRODUCTS[
      built.manifest.batch_id as ProductDispositionReversalBatchId
    ].length
  const migrationApplied = (await read.migrationState(requiredMigration)) === "applied"
  const [products, dispositions, batchReceipts, itemReceipts, oilEligibility, oilSpecs, protocols] =
    await Promise.all([
      read.listProducts(ids),
      read.listDispositions(ids),
      migrationApplied ? read.listBatchReceipts(built.manifest.batch_id) : Promise.resolve([]),
      migrationApplied ? read.listItemReceipts(built.manifest.batch_id) : Promise.resolve([]),
      read.listOilEligibility(ids),
      read.listOilSpecs(ids),
      read.listProtocols(ids),
    ])
  const blockers: string[] = []
  const productById = new Map(products.map((row) => [row.id, row]))
  const dispositionById = new Map(dispositions.map((row) => [row.product_id, row]))
  const itemReceiptById = new Map(itemReceipts.map((row) => [row.product_id, row]))
  const replay = batchReceipts.length === 1

  if (!migrationApplied) {
    blockers.push(`required_migration_not_applied:${requiredMigration}`)
  }

  if (batchReceipts.length > 1) blockers.push("reversal_batch_receipt_conflict")
  if (batchReceipts.length === 0 && itemReceipts.length > 0) {
    blockers.push("reversal_item_receipt_without_batch")
  }
  if (replay) {
    const batch = batchReceipts[0]!
    if (
      batch.batch_id !== built.manifest.batch_id ||
      batch.manifest_fingerprint !== built.fingerprint ||
      !/^[a-f0-9]{40}$/.test(batch.reviewed_head) ||
      batch.reviewed_by !== PRODUCT_DISPOSITION_REVERSAL_REVIEWER ||
      batch.item_count !== expectedItemCount ||
      itemReceipts.length !== expectedItemCount
    ) {
      blockers.push("reversal_batch_receipt_conflict")
    }
  }

  for (const item of built.manifest.items) {
    const product = productById.get(item.product_id)
    const productIdentity = product
      ? {
          id: product.id,
          name: product.name,
          category_key: product.category_key,
          origin: product.origin,
          is_active: product.is_active,
          lifecycle_status: product.lifecycle_status,
        }
      : null
    if (
      !productIdentity ||
      !sameJson(productIdentity, { id: item.product_id, ...item.expected_product })
    ) {
      blockers.push(`product_drift:${item.product_id}`)
    }
    const disposition = dispositionById.get(item.product_id)
    const receipt = itemReceiptById.get(item.product_id)
    if (!replay) {
      if (!disposition) blockers.push(`disposition_missing:${item.product_id}`)
      else if (
        !sameJson(disposition, { product_id: item.product_id, ...item.expected_disposition })
      ) {
        blockers.push(`disposition_drift:${item.product_id}`)
      }
      if (receipt) blockers.push(`unexpected_reversal_receipt:${item.product_id}`)
    } else {
      if (disposition) blockers.push(`replayed_disposition_still_present:${item.product_id}`)
      if (
        !receipt ||
        !sameJson(receipt, {
          batch_id: built.manifest.batch_id,
          product_id: item.product_id,
          prior_disposition: item.expected_disposition.disposition,
          prior_reason_code: item.expected_disposition.reason_code,
          prior_reason: item.expected_disposition.reason,
          prior_sources: item.expected_disposition.sources,
          prior_source_batch: item.expected_disposition.source_batch,
          prior_source_fingerprint: item.expected_disposition.source_fingerprint,
          reversal_reason: item.reversal_reason,
          reversal_sources: item.sources,
        })
      ) {
        blockers.push(`reversal_item_receipt_conflict:${item.product_id}`)
      }
    }

    if (!replay) {
      if (!product?.suitable_thicknesses?.length) {
        blockers.push(`publication_gate_missing_suitable_thicknesses:${item.product_id}`)
      }
      if (
        !oilEligibility.some(
          (row) => row.product_id === item.product_id && row.thickness && row.oil_subtype,
        )
      ) {
        blockers.push(`publication_gate_missing_oil_eligibility:${item.product_id}`)
      }
      const specs = oilSpecs.find((row) => row.product_id === item.product_id)
      if (!specs?.weight || !specs.role_support?.length) {
        blockers.push(`publication_gate_missing_oil_specs:${item.product_id}`)
      } else {
        for (const role of [...new Set(specs.role_support)]) {
          if (
            !protocols.some((protocol) =>
              protocolIsPublicationReady(protocol, item.product_id, role),
            )
          ) {
            blockers.push(`publication_gate_missing_exact_protocol:${item.product_id}:${role}`)
          }
        }
      }
    }
  }

  return {
    ok: blockers.length === 0,
    writes: false as const,
    replay,
    reviewedHead: batchReceipts[0]?.reviewed_head ?? null,
    batchId: built.manifest.batch_id,
    fingerprint: built.fingerprint,
    itemCount: built.manifest.items.length,
    blockers: [...new Set(blockers)].sort(),
  }
}

export type PersonalPlanProductDispositionReversalArgs = {
  apply: boolean
  confirm: boolean
  confirmProject?: string
  expectedFingerprint?: string
  reviewedHead?: string
  reviewer?: string
}

export type PersonalPlanProductDispositionReversalWrite = {
  apply(input: {
    p_manifest_json: string
    p_expected_manifest_fingerprint: string
    p_reviewed_head: string
    p_reviewed_by: typeof PRODUCT_DISPOSITION_REVERSAL_REVIEWER
    p_execution_enabled: true
  }): Promise<unknown>
}

export function assertPersonalPlanProductDispositionReversalApprovedFingerprint(
  built: BuiltPersonalPlanProductDispositionReversalManifest,
  pinnedFingerprint:
    | string
    | null
    | undefined = PRODUCT_DISPOSITION_REVERSAL_APPROVED_MANIFEST_FINGERPRINTS[
    built.manifest
      .batch_id as keyof typeof PRODUCT_DISPOSITION_REVERSAL_APPROVED_MANIFEST_FINGERPRINTS
  ],
) {
  if (!pinnedFingerprint) {
    throw new Error(
      `product_disposition_reversal_apply_requires_pinned_approved_manifest_fingerprint:${built.manifest.batch_id}`,
    )
  }
  if (built.fingerprint !== pinnedFingerprint) {
    throw new Error(
      "product_disposition_reversal_apply_requires_matching_pinned_approved_manifest_fingerprint",
    )
  }
}

export async function applyPersonalPlanProductDispositionReversal(input: {
  built: BuiltPersonalPlanProductDispositionReversalManifest
  args: PersonalPlanProductDispositionReversalArgs
  preflight: { ok: boolean; blockers: string[]; replay?: boolean; reviewedHead?: string | null }
  gitState: { head: string; clean: boolean }
  actualProjectId: string
  executionEnabled: string | undefined
  write: PersonalPlanProductDispositionReversalWrite
}) {
  if (!input.args.apply) {
    return {
      mode: "dry-run" as const,
      applied: false,
      writes: false,
      replay: input.preflight.replay ?? false,
    }
  }
  if (input.built.manifest.review.state !== "approved_by_nick") {
    throw new Error("product_disposition_reversal_apply_requires_approved_by_nick_manifest")
  }
  if (!input.args.confirm) {
    throw new Error("product_disposition_reversal_apply_requires_--confirm")
  }
  if (input.args.confirmProject !== PRODUCT_DISPOSITION_REVERSAL_PROJECT_ID) {
    throw new Error(
      `product_disposition_reversal_apply_requires_--confirm-project=${PRODUCT_DISPOSITION_REVERSAL_PROJECT_ID}`,
    )
  }
  if (input.actualProjectId !== PRODUCT_DISPOSITION_REVERSAL_PROJECT_ID) {
    throw new Error("product disposition reversal Supabase target is not the confirmed project")
  }
  if (input.args.expectedFingerprint !== input.built.fingerprint) {
    throw new Error("product_disposition_reversal_apply_requires_matching_--expected-fingerprint")
  }
  if (input.args.reviewer !== PRODUCT_DISPOSITION_REVERSAL_REVIEWER) {
    throw new Error(
      `product_disposition_reversal_apply_requires_--reviewer=${PRODUCT_DISPOSITION_REVERSAL_REVIEWER}`,
    )
  }
  if (!input.args.reviewedHead || !/^[a-f0-9]{40}$/.test(input.args.reviewedHead)) {
    throw new Error("product_disposition_reversal_apply_requires_--reviewed-head")
  }
  if (
    input.preflight.replay &&
    input.preflight.reviewedHead !== null &&
    input.preflight.reviewedHead !== undefined &&
    input.preflight.reviewedHead !== input.args.reviewedHead
  ) {
    throw new Error("product disposition reversal replay requires its original reviewed head")
  }
  if (!input.preflight.ok) {
    throw new Error(
      `product_disposition_reversal_preflight_blocked:${input.preflight.blockers.join(",")}`,
    )
  }
  if (input.executionEnabled !== "true") {
    throw new Error("product disposition reversal kill switch is disabled")
  }
  if (!input.gitState.clean) {
    throw new Error("product_disposition_reversal_apply_requires_clean_worktree")
  }
  if (input.gitState.head !== input.args.reviewedHead) {
    throw new Error("product disposition reversal reviewed head is not current head")
  }
  assertPersonalPlanProductDispositionReversalApprovedFingerprint(input.built)

  const result = await input.write.apply({
    p_manifest_json: input.built.canonicalJson,
    p_expected_manifest_fingerprint: input.built.fingerprint,
    p_reviewed_head: input.args.reviewedHead,
    p_reviewed_by: PRODUCT_DISPOSITION_REVERSAL_REVIEWER,
    p_execution_enabled: true,
  })
  return {
    mode: "apply" as const,
    applied: true,
    writes: true,
    replay: input.preflight.replay ?? false,
    result,
  }
}
