import { createHash } from "node:crypto"
import { z } from "zod"

import { productApplicationPointerV2Schema } from "@/lib/routines/personal-plan/application/contracts-v2"
import {
  canonicalJson,
  stage5V2ArtifactFingerprint,
  stage5V2SourceFingerprint,
  type Stage5V2ApplicationPreflightRead,
} from "./stage5-v2-application"

/**
 * Stage-5 V2 pointer DELTA lane.
 *
 * The full-registry apply (`apply_personal_plan_stage5_v2_artifact_v1`) is
 * retired: its artifact generations were reset by migration three times
 * (273/289/309 ledger rows against a 310-item artifact), and since 2026-09-03
 * the catalog outgrew the registry outright — intake writes V2 pointers at write
 * time, so "the artifact covers every live curated protocol row" is structurally
 * false and the full apply can no longer run.
 *
 * This lane replaces it with the small operation that is actually needed: write
 * a SHORT, separately reviewed list of product pointers, one item at a time,
 * idempotent per item. A delta can never invent content — every item must be
 * byte-identical (canonical JSON) to the matching item in the reviewed
 * application-pointer artifact, which stays frozen.
 */

export const STAGE5_V2_POINTER_DELTA_SCHEMA_VERSION =
  "personal-plan-stage5-v2-pointer-delta-v1" as const
export const STAGE5_V2_POINTER_DELTA_RPC = "apply_personal_plan_stage5_v2_pointer_delta_v1" as const
export const STAGE5_V2_POINTER_DELTA_MIGRATION = "20260914170000" as const
export const STAGE5_V2_POINTER_DELTA_REVIEWER = "nick" as const
export const STAGE5_V2_POINTER_DELTA_MAX_ITEMS = 20
export const STAGE5_V2_POINTER_DELTA_BATCH_ID_PATTERN = /^S5V2D-[0-9]{2}-[a-z0-9-]+$/

export const STAGE5_V2_ARTIFACT_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"
export const STAGE5_V2_POINTER_DELTA_DIR =
  "data/catalog-enrichment/personal-plan-stage5-v2/pointer-deltas"
export const STAGE5_V2_POINTER_DELTA_DEFAULT_FILE =
  `${STAGE5_V2_POINTER_DELTA_DIR}/S5V2D-01-leave-in-calibration-redken.json` as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/

const pointerDeltaItemSchema = z
  .object({
    key: z.string().min(1),
    product_id: z.string().uuid(),
    source_role: z.string().min(1),
    source_fingerprint: z.string().regex(SHA256_PATTERN),
    guidance_payload_v2: productApplicationPointerV2Schema,
  })
  .strict()

export const stage5V2PointerDeltaSchema = z
  .object({
    schema_version: z.literal(STAGE5_V2_POINTER_DELTA_SCHEMA_VERSION),
    batch_id: z.string().regex(STAGE5_V2_POINTER_DELTA_BATCH_ID_PATTERN),
    source_artifact: z
      .object({ path: z.string().min(1), sha256: z.string().regex(SHA256_PATTERN) })
      .strict(),
    observed_counts: z.object({ items: z.number().int().positive() }).strict(),
    items: z.array(pointerDeltaItemSchema).min(1).max(STAGE5_V2_POINTER_DELTA_MAX_ITEMS),
  })
  .strict()

export type Stage5V2PointerDelta = z.infer<typeof stage5V2PointerDeltaSchema>
export type Stage5V2PointerDeltaItem = z.infer<typeof pointerDeltaItemSchema>

/** Ledger `product_key`. Namespaced so it can never collide with the `v2:` full-apply keys. */
export function stage5V2PointerDeltaLedgerKey(item: {
  product_id: string
  source_role: string
}): string {
  return `v2-delta:${item.product_id}:${item.source_role}`
}

/** The reviewed bytes a delta item is allowed to carry, and nothing else. */
function reviewedItemBytes(item: {
  product_id: string
  source_role: string
  source_fingerprint: string
  guidance_payload_v2: unknown
}): string {
  return canonicalJson({
    product_id: item.product_id,
    source_role: item.source_role,
    source_fingerprint: item.source_fingerprint,
    guidance_payload_v2: item.guidance_payload_v2,
  })
}

export type Stage5V2PointerDeltaPackage = {
  delta: Stage5V2PointerDelta
  canonical_json: string
  fingerprint: string
  ledger_keys: string[]
}

/**
 * Validates a delta and pins it to the reviewed artifact.
 *
 * The cross-check is the whole point of the lane: the delta is not a place to
 * author a pointer, only to re-emit one that already passed Stage-5 review. Both
 * the artifact file bytes and each item's own bytes are compared, so a delta
 * cannot drift from the reviewed artifact in either direction.
 */
export function buildStage5V2PointerDelta(input: {
  delta: unknown
  artifactText: string
}): Stage5V2PointerDeltaPackage {
  const delta = stage5V2PointerDeltaSchema.parse(input.delta)

  if (delta.observed_counts.items !== delta.items.length) {
    throw new Error("stage5_v2_pointer_delta_observed_item_count_mismatch")
  }
  const keys = delta.items.map((item) => item.key)
  if (new Set(keys).size !== keys.length) {
    throw new Error("stage5_v2_pointer_delta_duplicate_item_key")
  }
  const ledger_keys = delta.items.map(stage5V2PointerDeltaLedgerKey)
  if (new Set(ledger_keys).size !== ledger_keys.length) {
    throw new Error("stage5_v2_pointer_delta_duplicate_product_role")
  }

  if (delta.source_artifact.path !== STAGE5_V2_ARTIFACT_PATH) {
    throw new Error("stage5_v2_pointer_delta_unexpected_source_artifact_path")
  }
  if (stage5V2ArtifactFingerprint(input.artifactText) !== delta.source_artifact.sha256) {
    throw new Error("stage5_v2_pointer_delta_source_artifact_fingerprint_mismatch")
  }

  const artifact = JSON.parse(input.artifactText) as {
    items: Array<{
      key: string
      product_id: string
      source_role: string
      source_fingerprint: string
      guidance_payload_v2: unknown
    }>
  }
  const artifactByKey = new Map(artifact.items.map((item) => [item.key, item]))
  for (const item of delta.items) {
    const reviewed = artifactByKey.get(item.key)
    if (!reviewed) {
      throw new Error(`stage5_v2_pointer_delta_item_not_in_artifact:${item.key}`)
    }
    if (reviewedItemBytes(item) !== reviewedItemBytes(reviewed)) {
      throw new Error(`stage5_v2_pointer_delta_item_diverges_from_artifact:${item.key}`)
    }
    if (item.guidance_payload_v2.scope.productId !== item.product_id) {
      throw new Error(`stage5_v2_pointer_delta_pointer_scope_mismatch:${item.key}`)
    }
    if (item.guidance_payload_v2.sourceRole !== item.source_role) {
      throw new Error(`stage5_v2_pointer_delta_pointer_source_role_mismatch:${item.key}`)
    }
  }

  const canonical_json = canonicalJson(delta)
  return {
    delta,
    canonical_json,
    fingerprint: createHash("sha256").update(canonical_json, "utf8").digest("hex"),
    ledger_keys,
  }
}

export type Stage5V2PointerDeltaItemStatus =
  | "will_write"
  | "already_applied"
  | "conflict"
  | "blocked"

export type Stage5V2PointerDeltaPreflight = {
  ok: boolean
  batch_id: string
  fingerprint: string
  blockers: string[]
  items: Array<{ key: string; status: Stage5V2PointerDeltaItemStatus; blocker: string | null }>
  observed: { items: number; will_write: number; already_applied: number }
}

function protocolFamily(protocol: {
  application_family?: string | null
  guidance_payload?: unknown
  guidance_payload_v2?: unknown
}): string | null {
  if (protocol.application_family) return protocol.application_family
  const v2 = protocol.guidance_payload_v2 as { applicationFamily?: unknown } | null
  if (typeof v2?.applicationFamily === "string") return v2.applicationFamily
  const v1 = protocol.guidance_payload as { applicationFamily?: unknown } | null
  return typeof v1?.applicationFamily === "string" ? v1.applicationFamily : null
}

/**
 * Delta-scoped preflight. Unlike the retired full-artifact preflight this makes
 * no claim about rows outside the delta — there is no reverse-coverage check,
 * because the artifact no longer covers the catalog. Coverage is audited
 * separately by `findStage5V2PointerCoverageGaps`.
 */
export async function preflightStage5V2PointerDelta(input: {
  built: Stage5V2PointerDeltaPackage
  read: Stage5V2ApplicationPreflightRead
}): Promise<Stage5V2PointerDeltaPreflight> {
  const { built, read } = input
  const productIds = [...new Set(built.delta.items.map((item) => item.product_id))].sort()
  const [products, protocols] = await Promise.all([
    read.listProducts(productIds),
    read.listProtocols(productIds),
  ])
  const productById = new Map(products.map((product) => [product.id, product]))
  const protocolByKey = new Map<string, (typeof protocols)[number]>(
    protocols.flatMap((protocol) => {
      const family = protocolFamily(protocol)
      return family
        ? ([
            [`${protocol.product_id}:${protocol.category}:${protocol.role}:${family}`, protocol],
          ] as const)
        : []
    }),
  )

  const items: Stage5V2PointerDeltaPreflight["items"] = []
  const blockers: string[] = []
  const block = (key: string, blocker: string) => {
    blockers.push(blocker)
    items.push({ key, status: "blocked", blocker })
  }

  for (const item of built.delta.items) {
    const pointer = item.guidance_payload_v2
    const product = productById.get(item.product_id)
    if (
      !product ||
      product.category_key !== pointer.scope.category ||
      product.origin !== "curated" ||
      !product.is_active ||
      product.lifecycle_status !== "active"
    ) {
      block(item.key, `product_state_diverged:${item.key}`)
      continue
    }
    const protocol = protocolByKey.get(
      `${item.product_id}:${pointer.scope.category}:${item.source_role}:${pointer.applicationFamily}`,
    )
    if (
      !protocol ||
      protocol.guidance_payload === null ||
      protocol.guidance_payload === undefined
    ) {
      block(item.key, `source_protocol_missing:${item.key}`)
      continue
    }
    if (
      stage5V2SourceFingerprint(item.source_role, protocol.guidance_payload) !==
      item.source_fingerprint
    ) {
      block(item.key, `source_protocol_diverged:${item.key}`)
      continue
    }
    const live = protocol.guidance_payload_v2
    if (live === null || live === undefined) {
      items.push({ key: item.key, status: "will_write", blocker: null })
      continue
    }
    if (canonicalJson(live) === canonicalJson(pointer)) {
      items.push({ key: item.key, status: "already_applied", blocker: null })
      continue
    }
    const blocker = `v2_authority_conflict:${item.key}`
    blockers.push(blocker)
    items.push({ key: item.key, status: "conflict", blocker })
  }

  return {
    ok: blockers.length === 0,
    batch_id: built.delta.batch_id,
    fingerprint: built.fingerprint,
    blockers,
    items,
    observed: {
      items: built.delta.items.length,
      will_write: items.filter((entry) => entry.status === "will_write").length,
      already_applied: items.filter((entry) => entry.status === "already_applied").length,
    },
  }
}

const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/
const EXPECTED_PROJECT_ID = "pqdkhefxsxkyeqelqegq"

export type Stage5V2PointerDeltaApplyArgs =
  | { apply: false }
  | { apply: true; reviewedHead: string; expectedFingerprint: string }

/** Same flag contract as `parseStage5V2ApplicationApplyArgs`; dry-run is the default. */
export function parseStage5V2PointerDeltaApplyArgs(
  args: readonly string[],
): Stage5V2PointerDeltaApplyArgs {
  const supported = new Set(["--apply", `--confirm-project=${EXPECTED_PROJECT_ID}`])
  const valued = ["--reviewed-head=", "--expected-fingerprint=", "--file="]
  for (const argument of args) {
    if (!supported.has(argument) && !valued.some((prefix) => argument.startsWith(prefix))) {
      throw new Error(`unknown_argument:${argument}`)
    }
  }
  if (!args.includes("--apply")) return { apply: false }
  if (!args.includes(`--confirm-project=${EXPECTED_PROJECT_ID}`)) {
    throw new Error(`confirm-project=${EXPECTED_PROJECT_ID} is required`)
  }
  const reviewedHead = args
    .find((argument) => argument.startsWith("--reviewed-head="))
    ?.slice("--reviewed-head=".length)
  const expectedFingerprint = args
    .find((argument) => argument.startsWith("--expected-fingerprint="))
    ?.slice("--expected-fingerprint=".length)
  if (!reviewedHead || !GIT_SHA_PATTERN.test(reviewedHead)) {
    throw new Error("valid_reviewed_head_is_required")
  }
  if (!expectedFingerprint || !SHA256_PATTERN.test(expectedFingerprint)) {
    throw new Error("valid_expected_fingerprint_is_required")
  }
  return { apply: true, reviewedHead, expectedFingerprint }
}

export type Stage5V2PointerCoverageRow = {
  product_id: string
  category: string
  role: string
  application_family?: string | null
  guidance_payload: unknown
  guidance_payload_v2: unknown
  product_name?: string | null
  brand?: string | null
}

/**
 * The real runtime invariant, and the only one the catalog still supports: every
 * live curated protocol row that has V1 guidance must also carry a V2 pointer,
 * because `product-protocol-adapter.ts` reads `guidance_payload_v2` alone. This
 * replaces the retired artifact's reverse-coverage claim, which asserted the
 * opposite direction (every live row must appear in one frozen file).
 */
export function findStage5V2PointerCoverageGaps(
  rows: readonly Stage5V2PointerCoverageRow[],
): Stage5V2PointerCoverageRow[] {
  return rows
    .filter(
      (row) =>
        row.guidance_payload !== null &&
        row.guidance_payload !== undefined &&
        (row.guidance_payload_v2 === null || row.guidance_payload_v2 === undefined),
    )
    .sort((left, right) =>
      `${left.product_id}:${left.role}`.localeCompare(`${right.product_id}:${right.role}`),
    )
}
