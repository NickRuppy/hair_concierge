import { createHash } from "node:crypto"

import { z } from "zod"

import { deriveShampooProtocolRoles } from "@/lib/product-intake/shampoo-protocol-roles"
import {
  buildStage5ProtocolApplyBatch,
  type BuiltStage5ProtocolApplyBatch,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { canonicalJson } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"
import {
  applicationGuidanceProtocolSchema,
  type ApplicationGuidanceProtocolV1,
} from "@/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "@/lib/routines/personal-plan/application/contracts-v2"

const EXPECTED_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const SHA256 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
    text: z.string().trim().min(1),
    source_type: z.enum(["manufacturer", "retailer", "professional_authority"]),
    checked_at: z.string().date(),
  })
  .strict()

const expectedDispositionSchema = z
  .object({
    disposition: z.literal("awaiting_exact_analysis"),
    reason_code: z.enum([
      "insufficient_executable_directions",
      "insufficient_finished_product_evidence",
    ]),
    reason: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    source_batch: z.string().regex(/^S5-[0-9]{2}-[a-z0-9-]+$/),
    source_fingerprint: z.string().regex(SHA256),
    reviewed_by: z.literal("nick"),
  })
  .strict()

const amendmentItemBaseSchema = z
  .object({
    product_id: z.string().uuid(),
    product_name: z.string().min(1),
    expected_disposition: expectedDispositionSchema,
    sources: z.array(sourceSchema).min(1),
    cadence: z.record(z.string(), z.unknown()).nullable(),
    guidance_payload: applicationGuidanceProtocolSchema,
  })
  .strict()

const amendmentItemSchema = z.discriminatedUnion("category_key", [
  amendmentItemBaseSchema.extend({
    category_key: z.literal("shampoo"),
    role: z.enum(["shampoo_everyday", "shampoo_dandruff"]),
    expected_category_facts: z
      .object({ shampoo_buckets: z.array(z.string().min(1)).min(1) })
      .strict(),
  }),
  amendmentItemBaseSchema.extend({
    category_key: z.literal("conditioner"),
    role: z.literal("conditioner_rinse_out"),
    expected_category_facts: z.object({}).strict(),
  }),
])

export const stage5ProtocolAmendmentManifestSchema = z
  .object({
    schema_version: z.literal("personal-plan-stage5-protocol-amendments-v1"),
    batch_id: z.string().regex(/^S5-[0-9]{2}-[a-z0-9-]+$/),
    category_key: z.enum(["shampoo", "conditioner"]),
    snapshot_date: z.string().date(),
    baseline: z
      .object({
        path: z.literal(
          "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json",
        ),
        sha256: z.string().regex(SHA256),
      })
      .strict(),
    review: z
      .object({ state: z.literal("approved_by_nick"), reviewed_by: z.literal("nick") })
      .strict(),
    items: z.array(amendmentItemSchema).min(1),
  })
  .strict()

export type Stage5ProtocolAmendmentManifest = z.infer<typeof stage5ProtocolAmendmentManifestSchema>

type V2Insert = {
  product_id: string
  product_name: string
  source_role: string
  application_family: ProductApplicationPointerV2["applicationFamily"]
  guidance_payload: ApplicationGuidanceProtocolV1
  guidance_payload_v2: ProductApplicationPointerV2
}

export type Stage5DispositionResolutionBatch = {
  schema_version: "personal-plan-stage5-product-disposition-resolutions-v1"
  batch_id: string
  items: Array<{
    product_id: string
    product_name: string
    category_key: "shampoo" | "conditioner"
    role: "shampoo_everyday" | "shampoo_dandruff" | "conditioner_rinse_out"
    application_family: ProductApplicationPointerV2["applicationFamily"]
    expected_source_url: string
    expected_guidance_payload: ApplicationGuidanceProtocolV1
    expected_guidance_payload_v2: ProductApplicationPointerV2
    expected_disposition: z.infer<typeof expectedDispositionSchema>
    content_fingerprint: string
  }>
}

export type BuiltStage5ProtocolAmendment = {
  manifest: Stage5ProtocolAmendmentManifest
  protocolApplyBatch: BuiltStage5ProtocolApplyBatch
  v2Inserts: V2Insert[]
  resolutionBatch: Stage5DispositionResolutionBatch & {
    canonicalJson: string
    fingerprint: string
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function stable(value: unknown) {
  return canonicalJson(value)
}

export function buildStage5ProtocolAmendmentManifest(
  input: unknown,
  baselineText: string,
): BuiltStage5ProtocolAmendment {
  const manifest = stage5ProtocolAmendmentManifestSchema.parse(input)
  if (manifest.baseline.sha256 !== sha256(baselineText)) {
    throw new Error("stage5_protocol_amendment_baseline_fingerprint_mismatch")
  }

  const baseline = JSON.parse(baselineText) as { items?: Array<{ key?: string }> }
  const baselineKeys = new Set((baseline.items ?? []).map(({ key }) => key))
  const identities = new Set<string>()
  const v2Inserts = manifest.items.map((item) => {
    const identity = `${item.product_id}:${item.role}`
    if (identities.has(identity))
      throw new Error(`duplicate_protocol_amendment_identity:${identity}`)
    identities.add(identity)
    if (item.category_key !== manifest.category_key) {
      throw new Error(`protocol_amendment_category_mismatch:${item.product_id}`)
    }
    if (
      item.category_key === "shampoo" &&
      !deriveShampooProtocolRoles(item.expected_category_facts.shampoo_buckets).includes(item.role)
    ) {
      throw new Error(`protocol_role_not_supported:${item.product_id}:${item.role}`)
    }
    const payload = applicationGuidanceProtocolSchema.parse(item.guidance_payload)
    if (
      payload.scope.kind !== "product" ||
      payload.scope.productId !== item.product_id ||
      payload.scope.category !== item.category_key
    ) {
      throw new Error(`protocol_amendment_scope_mismatch:${identity}`)
    }
    const evidenceUrls = new Set(payload.evidence.map(({ sourceUrl }) => sourceUrl))
    if (item.sources.some(({ url }) => !evidenceUrls.has(url))) {
      throw new Error(`protocol_amendment_evidence_mismatch:${identity}`)
    }
    const pointer = productApplicationPointerV2Schema.parse(
      buildProductApplicationPointerV2({ sourceRole: item.role, guidancePayload: payload }),
    )
    const artifactKey = `${item.product_id}:${item.role}:${pointer.applicationFamily}`
    if (baselineKeys.has(artifactKey)) {
      throw new Error(`protocol_amendment_conflicts_with_baseline:${artifactKey}`)
    }
    return {
      product_id: item.product_id,
      product_name: item.product_name,
      source_role: item.role,
      application_family: pointer.applicationFamily,
      guidance_payload: payload,
      guidance_payload_v2: pointer,
    }
  })

  const protocolApplyBatch = buildStage5ProtocolApplyBatch({
    schema_version: "personal-plan-stage5-protocol-research-v1",
    batch_id: manifest.batch_id,
    category_key: manifest.category_key,
    products: manifest.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      role: item.role,
      research_status: "verified" as const,
      sources: item.sources,
      cadence: item.cadence,
      guidance_payload: item.guidance_payload,
      blockers: [],
    })),
  })

  const resolutionItems = manifest.items.map((item, index) => {
    const insert = v2Inserts[index]!
    const withoutFingerprint = {
      product_id: item.product_id,
      product_name: item.product_name,
      category_key: item.category_key,
      role: item.role,
      application_family: insert.guidance_payload_v2.applicationFamily,
      expected_source_url: item.sources[0]!.url,
      expected_guidance_payload: insert.guidance_payload,
      expected_guidance_payload_v2: insert.guidance_payload_v2,
      expected_disposition: item.expected_disposition,
    }
    return { ...withoutFingerprint, content_fingerprint: sha256(stable(withoutFingerprint)) }
  })
  const resolutionDocument: Stage5DispositionResolutionBatch = {
    schema_version: "personal-plan-stage5-product-disposition-resolutions-v1",
    batch_id: manifest.batch_id,
    items: resolutionItems,
  }
  const resolutionCanonicalJson = stable(resolutionDocument)

  return {
    manifest,
    protocolApplyBatch,
    v2Inserts,
    resolutionBatch: {
      ...resolutionDocument,
      canonicalJson: resolutionCanonicalJson,
      fingerprint: sha256(resolutionCanonicalJson),
    },
  }
}

export type Stage5DispositionResolutionRead = {
  listProducts(ids: string[]): Promise<
    Array<{
      id: string
      category_key: string | null
      origin: string | null
      is_active: boolean
      lifecycle_status: string
      shampoo_buckets: string[]
    }>
  >
  listProtocols(ids: string[]): Promise<
    Array<{
      product_id: string
      category: string
      role: string
      application_family: string
      source_url: string | null
      guidance_payload: unknown
      guidance_payload_v2: unknown
    }>
  >
  listDispositions(ids: string[]): Promise<Array<Record<string, unknown>>>
  listAppliedItems(batchId: string, ids: string[]): Promise<Array<Record<string, unknown>>>
}

export async function preflightStage5DispositionResolution(
  built: BuiltStage5ProtocolAmendment,
  read: Stage5DispositionResolutionRead,
) {
  const ids = built.manifest.items.map(({ product_id }) => product_id)
  const [products, protocols, dispositions, ledgers] = await Promise.all([
    read.listProducts(ids),
    read.listProtocols(ids),
    read.listDispositions(ids),
    read.listAppliedItems(built.manifest.batch_id, ids),
  ])
  const blockers: string[] = []
  let releaseCount = 0
  let alreadyResolvedCount = 0

  for (const [index, item] of built.manifest.items.entries()) {
    const product = products.find(({ id }) => id === item.product_id)
    if (
      !product ||
      product.category_key !== item.category_key ||
      product.origin !== "curated" ||
      !product.is_active ||
      product.lifecycle_status !== "active"
    ) {
      blockers.push(`product_state_diverged:${item.product_id}`)
      continue
    }
    if (item.category_key === "shampoo") {
      if (!deriveShampooProtocolRoles(product.shampoo_buckets).includes(item.role)) {
        blockers.push(`protocol_role_not_supported:${item.product_id}:${item.role}`)
        continue
      }
      if (
        stable([...product.shampoo_buckets].sort()) !==
        stable([...item.expected_category_facts.shampoo_buckets].sort())
      ) {
        blockers.push(`shampoo_facts_diverged:${item.product_id}`)
        continue
      }
    }
    const expected = built.v2Inserts[index]!
    const protocol = protocols.find(
      (candidate) =>
        candidate.product_id === item.product_id &&
        candidate.category === item.category_key &&
        candidate.role === item.role &&
        candidate.application_family === expected.application_family,
    )
    if (!protocol) {
      blockers.push(`protocol_missing:${item.product_id}:${item.role}`)
      continue
    }
    if (stable(protocol.guidance_payload) !== stable(expected.guidance_payload)) {
      blockers.push(`protocol_v1_diverged:${item.product_id}:${item.role}`)
      continue
    }
    if (stable(protocol.guidance_payload_v2) !== stable(expected.guidance_payload_v2)) {
      blockers.push(`protocol_v2_diverged:${item.product_id}:${item.role}`)
      continue
    }
    if (protocol.source_url !== item.sources[0]!.url) {
      blockers.push(`protocol_source_diverged:${item.product_id}:${item.role}`)
      continue
    }

    const resolution = built.resolutionBatch.items[index]!
    const ledger = ledgers.find(
      (candidate) =>
        candidate.batch_id === built.manifest.batch_id &&
        candidate.product_key === `disposition-resolution:${item.product_id}`,
    )
    const disposition = dispositions.find(({ product_id }) => product_id === item.product_id)
    if (disposition) {
      if (ledger) {
        blockers.push(`resolution_receipt_conflicts_with_disposition:${item.product_id}`)
        continue
      }
      const actual = Object.fromEntries(
        Object.keys(item.expected_disposition).map((key) => [key, disposition[key]]),
      )
      if (stable(actual) !== stable(item.expected_disposition)) {
        blockers.push(`disposition_conflict:${item.product_id}`)
      } else {
        releaseCount += 1
      }
      continue
    }

    if (
      !ledger ||
      ledger.batch_fingerprint !== built.resolutionBatch.fingerprint ||
      ledger.content_fingerprint !== resolution.content_fingerprint ||
      ledger.product_id !== item.product_id ||
      ledger.reviewed_by !== "nick"
    ) {
      blockers.push(`disposition_missing_without_receipt:${item.product_id}`)
    } else {
      alreadyResolvedCount += 1
    }
  }

  return {
    ok: blockers.length === 0,
    writes: false as const,
    batchId: built.manifest.batch_id,
    fingerprint: built.resolutionBatch.fingerprint,
    releaseCount,
    alreadyResolvedCount,
    blockers: [...new Set(blockers)].sort(),
  }
}

export type Stage5DispositionResolutionApplyArgs =
  | { apply: false; batchId: string }
  | { apply: true; batchId: string; reviewedHead: string; expectedFingerprint: string }

export function parseStage5DispositionResolutionApplyArgs(
  args: readonly string[],
): Stage5DispositionResolutionApplyArgs {
  const supported = new Set(["--apply", `--confirm-project=${EXPECTED_PROJECT_ID}`])
  const valued = ["--batch=", "--reviewed-head=", "--expected-fingerprint="]
  for (const argument of args) {
    if (!supported.has(argument) && !valued.some((prefix) => argument.startsWith(prefix))) {
      throw new Error(`unknown_argument:${argument}`)
    }
  }
  const batchId = args.find((argument) => argument.startsWith("--batch="))?.slice("--batch=".length)
  if (!batchId || !/^S5-[0-9]{2}-[a-z0-9-]+$/.test(batchId)) {
    throw new Error("valid_batch_id_is_required")
  }
  if (!args.includes("--apply")) return { apply: false, batchId }
  if (!args.includes(`--confirm-project=${EXPECTED_PROJECT_ID}`)) {
    throw new Error(`confirm-project=${EXPECTED_PROJECT_ID} is required`)
  }
  const reviewedHead = args
    .find((argument) => argument.startsWith("--reviewed-head="))
    ?.slice("--reviewed-head=".length)
  const expectedFingerprint = args
    .find((argument) => argument.startsWith("--expected-fingerprint="))
    ?.slice("--expected-fingerprint=".length)
  if (!reviewedHead || !GIT_SHA.test(reviewedHead))
    throw new Error("valid_reviewed_head_is_required")
  if (!expectedFingerprint || !SHA256.test(expectedFingerprint)) {
    throw new Error("valid_expected_fingerprint_is_required")
  }
  return { apply: true, batchId, reviewedHead, expectedFingerprint }
}

export function isStage5DispositionResolutionProductionWriteAuthorized(
  environment: Record<string, string | undefined>,
) {
  let projectId: string | null = null
  try {
    projectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? null
  } catch {
    projectId = null
  }
  return (
    environment.ALLOW_PERSONAL_PLAN_DISPOSITION_RESOLUTION_PRODUCTION_WRITE === "1" &&
    projectId === EXPECTED_PROJECT_ID
  )
}
