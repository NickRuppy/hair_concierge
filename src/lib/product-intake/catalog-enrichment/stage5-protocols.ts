import { createHash } from "node:crypto"

import type { ApplicationGuidanceProtocolV1 } from "@/lib/routines/personal-plan/application/contracts"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

type ProtocolResearchManifest = {
  schema_version: "personal-plan-stage5-protocol-research-v1"
  batch_id: string
  category_key: string
  products: Array<{
    product_id: string | null
    product_name: string
    role: string
    research_status:
      | "verified"
      | "retired"
      | "blocked_missing_direction"
      | "blocked_identity_or_commercial"
    sources: Array<{
      label: string
      url: string
      text: string
      source_type: string
      checked_at: string
    }>
    cadence: Record<string, unknown> | null
    guidance_payload: unknown | null
    blockers: string[]
  }>
}

export type Stage5ProtocolApplyItem = {
  product_id: string
  product_name: string
  category_key: string
  role: string
  cadence: Record<string, unknown> | null
  guidance_payload: ApplicationGuidanceProtocolV1
  source_label: string
  source_url: string
  source_text: string
}

export type Stage5ProtocolApplyBatch = {
  schema_version: "personal-plan-stage5-protocol-apply-v1"
  batch_id: string
  protocols: Stage5ProtocolApplyItem[]
}

export type BuiltStage5ProtocolApplyBatch = {
  batch: Stage5ProtocolApplyBatch
  canonicalJson: string
  fingerprint: string
}

export type Stage5ProtocolPreflightRead = {
  listProducts: (productIds: string[]) => Promise<
    Array<{
      id: string
      category_key: string | null
      origin?: string | null
      is_active: boolean
      lifecycle_status: string
    }>
  >
  listProtocols: (productIds: string[]) => Promise<
    Array<{
      product_id: string
      category: string
      role: string
      cadence: unknown
      source_url: string | null
      guidance_payload: unknown
    }>
  >
}

/** Read-only catalog shape deliberately kept separate from the apply client. */
export type Stage5CuratedCohortProduct = {
  product_id: string
  category_key: string
  origin: string | null
  is_active: boolean
  lifecycle_status: string
  is_chaarlie_recommended: boolean
  brand: string | null
  name: string
  affiliate_link: string | null
  category_repair: {
    expected_current_category: null
    target_category: "deep_cleansing_shampoo"
  } | null
  /** Supplied by the read-only caller from canonical category facts. */
  required_roles: string[]
  authority_fact_blockers: string[]
}

type Stage5LiveCatalogRow = Omit<
  Stage5CuratedCohortProduct,
  "required_roles" | "authority_fact_blockers" | "category_repair"
> & {
  category_repair?: Stage5CuratedCohortProduct["category_repair"]
  shampoo_specs?: Array<{ shampoo_bucket: string | null }>
  leave_in_specs?: {
    plan_roles: string[] | null
    care_direction: string | null
    repair_support_level: string | null
    functional_benefits: string[] | null
  } | null
  oil_specs?: {
    weight: string | null
    role_support: string[] | null
    provides_heat_protection: boolean | null
  } | null
  mask_specs?: {
    repair_support_level: string | null
    functional_benefits: string[] | null
  } | null
  scalp_care_specs?: { primary_role: string | null } | null
  deep_cleansing_specs?: { reset_focus: string | null } | null
}

/**
 * Convert only explicit canonical category facts into research roles. Unknown
 * facts remain research blockers while the rest of the cohort stays observable.
 */
export function deriveStage5RequiredRoles(row: Stage5LiveCatalogRow): {
  roles: string[]
  blockers: string[]
} {
  const unique = (roles: Array<string | null | undefined>) =>
    [...new Set(roles.filter(Boolean))] as string[]
  switch (row.category_key) {
    case "shampoo": {
      const buckets = unique(row.shampoo_specs?.map(({ shampoo_bucket }) => shampoo_bucket) ?? [])
      if (!buckets.length)
        return {
          roles: [],
          blockers: [`canonical_fact_missing:${row.product_id}:shampoo.bucket`],
        }
      return {
        roles: unique(
          buckets.map((bucket) =>
            bucket === "schuppen" ? "shampoo_dandruff" : "shampoo_everyday",
          ),
        ),
        blockers: [],
      }
    }
    case "conditioner":
      return { roles: ["conditioner_rinse_out"], blockers: [] }
    case "leave_in": {
      const specs = row.leave_in_specs
      const planRoles = specs?.plan_roles
      const missing =
        !specs?.care_direction ||
        !specs.repair_support_level ||
        !specs.functional_benefits?.length ||
        !planRoles?.length
      if (missing) {
        return {
          roles: [],
          blockers: [`canonical_fact_missing:${row.product_id}:leave_in.v3`],
        }
      }
      return {
        roles: unique(
          planRoles.map((role) => (role === "pre_heat_application" ? "pre_heat_protection" : role)),
        ),
        blockers: [],
      }
    }
    case "heat_protectant":
      return { roles: ["pre_heat_protection"], blockers: [] }
    case "oil": {
      const roles = unique(row.oil_specs?.role_support ?? [])
      const missing = !row.oil_specs?.weight || roles.length === 0
      return {
        roles,
        blockers: missing ? [`canonical_fact_missing:${row.product_id}:oil.v2`] : [],
      }
    }
    case "mask":
      if (!row.mask_specs?.repair_support_level || !row.mask_specs.functional_benefits?.length) {
        return {
          roles: ["intensive_conditioning_mask"],
          blockers: [`canonical_fact_missing:${row.product_id}:mask.v3`],
        }
      }
      return {
        roles: ["intensive_conditioning_mask"],
        blockers: [],
      }
    case "scalp_care": {
      const role = row.scalp_care_specs?.primary_role
      return role
        ? { roles: [role], blockers: [] }
        : {
            roles: [],
            blockers: [`canonical_fact_missing:${row.product_id}:scalp_care.primary_role`],
          }
    }
    case "dry_shampoo":
      return { roles: ["root_refresh_bridge"], blockers: [] }
    case "bondbuilder":
      return { roles: ["specialized_bond_treatment"], blockers: [] }
    case "deep_cleansing_shampoo": {
      const focus = row.deep_cleansing_specs?.reset_focus
      if (focus === "product_sebum_buildup") return { roles: ["residue_reset"], blockers: [] }
      if (focus === "metal_mineral_hard_water") return { roles: ["mineral_reset"], blockers: [] }
      if (focus === "broad_spectrum_detox")
        return { roles: ["residue_reset", "mineral_reset"], blockers: [] }
      return {
        roles: [],
        blockers: [`canonical_fact_missing:${row.product_id}:deep_cleansing_shampoo.reset_focus`],
      }
    }
    default:
      return {
        roles: [],
        blockers: [`canonical_fact_missing:${row.product_id}:${row.category_key}`],
      }
  }
}

export function deriveStage5CuratedCohortProduct(
  row: Stage5LiveCatalogRow,
): Stage5CuratedCohortProduct {
  const derived = deriveStage5RequiredRoles(row)
  return {
    ...row,
    category_repair: row.category_repair ?? null,
    required_roles: derived.roles,
    authority_fact_blockers: derived.blockers,
  }
}

type FrozenCohort = {
  schema_version: "personal-plan-stage5-cohort-v1"
  selection: Record<string, unknown>
  categories: Record<
    string,
    {
      active_recommended_count: number
      exact_protocol_product_count: number
      products: Array<{
        product_id: string
        brand: string
        name: string
        has_exact_protocol: boolean
      }>
    }
  >
}

type FrozenCohortV2 = {
  schema_version: "personal-plan-stage5-curated-cohort-v2"
  selection: Record<string, unknown>
  products: Array<{
    product_id: string
    target_category: string
  }>
}

export type Stage5ExactResearchWorklistItem = {
  product_id: string
  category_key: string
  role: string
  brand: string | null
  name: string
  affiliate_link: string | null
  reason: "missing_exact_protocol" | "blocked_exact_protocol"
  category_repair: Stage5CuratedCohortProduct["category_repair"]
}

export type Stage5ExactResearchWorklistBatch = {
  batch_id: string
  category_key: string
  items: Stage5ExactResearchWorklistItem[]
}

type Stage5Coverage = Record<string, { verified: number; blocked: number; missing: number }>

export type PersonalPlanSearchDisposition = {
  product_id: string
  disposition: string
  reason_code: string
}

function requiredExactProtocolKey(productId: string, role: string) {
  return `${productId}:${role}`
}

function hasCanonicalExactProtocol(protocol: {
  product_id: string
  category: string
  role: string
  source_url: string | null
  guidance_payload: unknown
}) {
  if (!protocol.source_url) return false
  const guidance = applicationGuidanceProtocolSchema.safeParse(protocol.guidance_payload)
  return (
    guidance.success &&
    guidance.data.evidence.some(({ sourceUrl }) => sourceUrl === protocol.source_url)
  )
}

/**
 * Produces a deterministic, non-writing research queue. An affiliate URL is only
 * a starting point for identity research; it never satisfies exact-source evidence.
 */
export function buildStage5ExactResearchWorklist(
  products: Stage5CuratedCohortProduct[],
  protocols: Array<{
    product_id: string
    category: string
    role: string
    source_url: string | null
    guidance_payload: unknown
  }>,
): Stage5ExactResearchWorklistItem[] {
  const verified = new Set(
    protocols
      .filter(hasCanonicalExactProtocol)
      .map(({ product_id, role }) => requiredExactProtocolKey(product_id, role)),
  )
  return products
    .flatMap((product) =>
      product.required_roles
        .filter((role) => !verified.has(requiredExactProtocolKey(product.product_id, role)))
        .map((role) => ({
          product_id: product.product_id,
          category_key: product.category_key,
          role,
          brand: product.brand,
          name: product.name,
          affiliate_link: product.affiliate_link,
          reason: "missing_exact_protocol" as const,
          category_repair: product.category_repair,
        })),
    )
    .sort(
      (left, right) =>
        left.category_key.localeCompare(right.category_key) ||
        left.product_id.localeCompare(right.product_id) ||
        left.role.localeCompare(right.role),
    )
}

/** Keeps research waves reviewable without altering manifest or apply batches. */
export function groupStage5ExactResearchWorklist(
  worklist: Stage5ExactResearchWorklistItem[],
  maximumItemsPerBatch = 25,
): Stage5ExactResearchWorklistBatch[] {
  if (!Number.isInteger(maximumItemsPerBatch) || maximumItemsPerBatch < 1) {
    throw new Error("stage5_research_batch_size_invalid")
  }
  const byCategory = new Map<string, Stage5ExactResearchWorklistItem[]>()
  for (const item of worklist) {
    const items = byCategory.get(item.category_key) ?? []
    items.push(item)
    byCategory.set(item.category_key, items)
  }
  return [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([category_key, items]) =>
      Array.from({ length: Math.ceil(items.length / maximumItemsPerBatch) }, (_, index) => ({
        batch_id: `S5-research-${category_key}-${String(index + 1).padStart(2, "0")}`,
        category_key,
        items: items.slice(index * maximumItemsPerBatch, (index + 1) * maximumItemsPerBatch),
      })),
    )
}

export async function auditStage5CuratedCohort(
  frozen: FrozenCohort | FrozenCohortV2,
  liveProducts: Stage5CuratedCohortProduct[],
  protocols: Array<{
    product_id: string
    category: string
    role: string
    cadence: unknown
    source_url: string | null
    guidance_payload: unknown
  }>,
  dispositions: PersonalPlanSearchDisposition[] = [],
) {
  const blockers: string[] = []
  const disposedProductIds = new Set(dispositions.map(({ product_id }) => product_id))
  const frozenById =
    frozen.schema_version === "personal-plan-stage5-curated-cohort-v2"
      ? new Map(
          frozen.products.map(
            (product) => [product.product_id, { category: product.target_category }] as const,
          ),
        )
      : new Map(
          Object.entries(frozen.categories).flatMap(([category, cohort]) =>
            cohort.products.map(
              (product) => [product.product_id, { ...product, category }] as const,
            ),
          ),
        )
  const currentById = new Map(liveProducts.map((product) => [product.product_id, product]))
  for (const [id, expected] of frozenById) {
    const actual = currentById.get(id)
    if (!actual) {
      blockers.push(`cohort_missing:${id}`)
      continue
    }
    if (actual.origin !== "curated")
      blockers.push(`product_origin_mismatch:${id}:${actual.origin ?? "null"}:curated`)
    if (!actual.is_active) blockers.push(`product_inactive:${id}`)
    if (actual.lifecycle_status !== "active")
      blockers.push(`product_lifecycle_mismatch:${id}:${actual.lifecycle_status}:active`)
    if (actual.category_key !== expected.category)
      blockers.push(`product_category_mismatch:${id}:${actual.category_key}:${expected.category}`)
  }
  for (const product of liveProducts) {
    if (!frozenById.has(product.product_id))
      blockers.push(`cohort_unexpected:${product.product_id}`)
  }

  const searchableProducts = liveProducts.filter(
    (product) => !disposedProductIds.has(product.product_id),
  )
  const worklist = buildStage5ExactResearchWorklist(searchableProducts, protocols)
  const factWorklist = searchableProducts.flatMap((product) =>
    (product.authority_fact_blockers ?? []).map((reason) => ({
      product_id: product.product_id,
      category_key: product.category_key,
      brand: product.brand,
      name: product.name,
      affiliate_link: product.affiliate_link,
      category_repair: product.category_repair,
      status: "requires_research" as const,
      reason,
    })),
  )
  blockers.push(...factWorklist.map(({ reason }) => reason))
  const coverage: Stage5Coverage = {}
  for (const product of searchableProducts) {
    const bucket = (coverage[product.category_key] ??= { verified: 0, blocked: 0, missing: 0 })
    for (const role of product.required_roles) {
      const protocol = protocols.find(
        (row) =>
          row.product_id === product.product_id &&
          row.category === product.category_key &&
          row.role === role,
      )
      if (!protocol) {
        bucket.missing += 1
        blockers.push(`exact_protocol_missing:${product.product_id}:${role}`)
      } else if (!hasCanonicalExactProtocol(protocol)) {
        bucket.blocked += 1
        blockers.push(`exact_protocol_blocked:${product.product_id}:${role}`)
      } else {
        bucket.verified += 1
      }
    }
  }
  return {
    mode: "audit" as const,
    writes: false,
    ok: blockers.length === 0,
    frozenProductCount: frozenById.size,
    liveProductCount: liveProducts.length,
    disposedProductCount: disposedProductIds.size,
    disposedProductIds: [...disposedProductIds].sort(),
    blockers: [...new Set(blockers)].sort(),
    coverage,
    worklist,
    researchBatches: groupStage5ExactResearchWorklist(worklist),
    enrichmentWorklist: {
      schema_version: "personal-plan-stage5-exact-enrichment-worklist-v1" as const,
      category_fact_patches: factWorklist,
      protocol_patches: worklist,
    },
  }
}

export type Stage5ProtocolApplyArgs = {
  batchId: string
  reviewedHead: string | null
  expectedFingerprint: string | null
  apply: boolean
  confirm: boolean
}

export function parseStage5ProtocolApplyArgs(argv: string[]): Stage5ProtocolApplyArgs {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? (argv[index + 1] ?? null) : null
  }
  const batchId = valueAfter("--batch")
  if (!batchId || !/^S5-[0-9]{2}-[a-z0-9-]+$/.test(batchId)) {
    throw new Error("Stage 5 protocol command requires --batch S5-XX-name")
  }
  const reviewedHead = valueAfter("--reviewed-head")
  const expectedFingerprint = valueAfter("--expected-fingerprint")
  const apply = argv.includes("--apply")
  const confirm = argv.includes("--confirm")
  if (reviewedHead && !/^[a-f0-9]{40}$/.test(reviewedHead)) {
    throw new Error("Stage 5 reviewed head must be a 40-character commit SHA")
  }
  if (expectedFingerprint && !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new Error("Stage 5 expected fingerprint must be lowercase sha256")
  }
  if (apply && (!confirm || !reviewedHead || !expectedFingerprint)) {
    throw new Error("Stage 5 apply requires --confirm, --reviewed-head, and --expected-fingerprint")
  }
  return { batchId, reviewedHead, expectedFingerprint, apply, confirm }
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  )
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

export function buildStage5ProtocolApplyBatch(
  manifest: ProtocolResearchManifest,
): BuiltStage5ProtocolApplyBatch {
  const protocols = manifest.products
    .filter(
      (
        product,
      ): product is typeof product & {
        product_id: string
        guidance_payload: ApplicationGuidanceProtocolV1
      } =>
        product.research_status === "verified" &&
        Boolean(product.product_id && product.guidance_payload),
    )
    .map((product) => {
      const primarySource = product.sources[0]
      if (!primarySource) throw new Error(`stage5_protocol_source_missing:${product.product_id}`)
      const sourceText = primarySource.text.trim()
      if (!sourceText) throw new Error(`stage5_protocol_source_text_missing:${product.product_id}`)
      return {
        product_id: product.product_id,
        product_name: product.product_name,
        category_key: manifest.category_key,
        role: product.role,
        cadence: product.cadence,
        guidance_payload: product.guidance_payload,
        source_label: primarySource.label,
        source_url: primarySource.url,
        source_text: sourceText,
      }
    })
    .sort(
      (left, right) =>
        left.product_id.localeCompare(right.product_id) || left.role.localeCompare(right.role),
    )

  if (protocols.length === 0) throw new Error(`stage5_protocol_batch_empty:${manifest.batch_id}`)
  const batch: Stage5ProtocolApplyBatch = {
    schema_version: "personal-plan-stage5-protocol-apply-v1",
    batch_id: manifest.batch_id,
    protocols,
  }
  const serialized = canonicalJson(batch)
  return {
    batch,
    canonicalJson: serialized,
    fingerprint: createHash("sha256").update(serialized).digest("hex"),
  }
}

export async function preflightStage5ProtocolApplyBatch(
  built: BuiltStage5ProtocolApplyBatch,
  read: Stage5ProtocolPreflightRead,
) {
  const productIds = [...new Set(built.batch.protocols.map(({ product_id }) => product_id))]
  const [products, existingProtocols] = await Promise.all([
    read.listProducts(productIds),
    read.listProtocols(productIds),
  ])
  const productsById = new Map(products.map((product) => [product.id, product]))
  const blockers: string[] = []

  for (const protocol of built.batch.protocols) {
    const product = productsById.get(protocol.product_id)
    if (!product) {
      blockers.push(`product_missing:${protocol.product_id}`)
      continue
    }
    if (!product.is_active || product.lifecycle_status !== "active") {
      blockers.push(`product_inactive:${protocol.product_id}`)
    }
    if (product.origin !== undefined && product.origin !== "curated") {
      blockers.push(
        `product_origin_mismatch:${protocol.product_id}:${product.origin ?? "null"}:curated`,
      )
    }
    if (product.category_key !== protocol.category_key) {
      blockers.push(
        `product_category_mismatch:${protocol.product_id}:${product.category_key}:${protocol.category_key}`,
      )
    }
    const existing = existingProtocols.find(
      (row) =>
        row.product_id === protocol.product_id &&
        row.category === protocol.category_key &&
        row.role === protocol.role,
    )
    if (
      existing &&
      existing.guidance_payload !== null &&
      (canonicalJson(existing.guidance_payload) !== canonicalJson(protocol.guidance_payload) ||
        canonicalJson(existing.cadence) !== canonicalJson(protocol.cadence) ||
        existing.source_url !== protocol.source_url)
    ) {
      blockers.push(`protocol_conflict:${protocol.product_id}:${protocol.role}`)
    }
  }

  return {
    ok: blockers.length === 0,
    batchId: built.batch.batch_id,
    fingerprint: built.fingerprint,
    protocolCount: built.batch.protocols.length,
    blockers,
  }
}
