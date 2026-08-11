import { createHash } from "node:crypto"

import type { ApplicationGuidanceProtocolV1 } from "@/lib/routines/personal-plan/application/contracts"

type ProtocolResearchManifest = {
  schema_version: "personal-plan-stage5-protocol-research-v1"
  batch_id: string
  category_key: string
  products: Array<{
    product_id: string | null
    product_name: string
    role: string
    research_status: "verified" | "blocked_missing_direction" | "blocked_identity_or_commercial"
    sources: Array<{ label: string; url: string; source_type: string; checked_at: string }>
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
      category_key: string
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
      return {
        product_id: product.product_id,
        product_name: product.product_name,
        category_key: manifest.category_key,
        role: product.role,
        cadence: product.cadence,
        guidance_payload: product.guidance_payload,
        source_label: primarySource.label,
        source_url: primarySource.url,
        source_text: product.guidance_payload.steps
          .map(({ copyTemplateDe }) => copyTemplateDe)
          .join(" "),
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
