import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { BaselineProduct, LiveBaseline } from "./live-baseline-export"
import type { ReadinessBaseline, ReadinessProductAudit } from "./readiness-export"

const DIRECTORY = "data/scanner-catalog-coverage/2026-08-26"
const OUTPUT_PATH = `${DIRECTORY}/existing-catalog-coverage-ledger.json`

export const EXISTING_CATALOG_CATEGORY_TOTALS = {
  bondbuilder: 3,
  conditioner: 49,
  deep_cleansing_shampoo: 5,
  dry_shampoo: 10,
  heat_protectant: 7,
  leave_in: 46,
  mask: 36,
  oil: 41,
  scalp_care: 8,
  shampoo: 54,
} as const

const PARTITION_TOTALS = {
  already_scan_result_ready: 26,
  safe_e1: 20,
  safe_e2: 22,
  ready_for_gtin_research: 150,
  authority_repair: 41,
} as const

const RESEARCH_LANES = [
  { lane: "A", categories: ["shampoo", "deep_cleansing_shampoo", "dry_shampoo"] },
  { lane: "B", categories: ["conditioner"] },
  { lane: "C", categories: ["leave_in", "bondbuilder"] },
  { lane: "D", categories: ["mask", "oil"] },
] as const

type Partition = keyof typeof PARTITION_TOTALS
type Lane = (typeof RESEARCH_LANES)[number]["lane"]
type BackfillItem = {
  product_id: string
  expected_product: { category_key: string }
  identifiers: unknown[]
}
type BackfillManifest = { batch: "E1" | "E2"; batch_id: string; items: BackfillItem[] }

export type ExistingCoverageRow = {
  product_id: string
  category_key: string
  identity: {
    canonical_brand: string
    clean_name: string
    product_line: string | null
  }
  partition: Partition
  linked_in_baseline: boolean
  current_identifiers: BaselineProduct["identifiers"]
  strict_readiness: {
    status: ReadinessProductAudit["status"]
    blockers: ReadinessProductAudit["blockers"]
    verdicts: ReadinessProductAudit["verdicts"]
  }
  gtin_status:
    | "already_verified_in_catalog"
    | "verified_for_safe_e1"
    | "verified_for_safe_e2"
    | "research_pending"
    | "authority_repair_required"
}

export type ExistingCoverageLedger = {
  schema_version: "scanner-existing-catalog-coverage-ledger-v1"
  generated_at: string
  source: {
    live_baseline_content_fingerprint: string
    readiness_baseline_content_fingerprint: string
    e1_manifest_content_fingerprint: string
    e2_manifest_content_fingerprint: string
    note: string
  }
  reconciliation: {
    active_supported_products: 259
    linked_baseline_products: 38
    by_partition: typeof PARTITION_TOTALS
    by_category: typeof EXISTING_CATALOG_CATEGORY_TOTALS
  }
  rows: ExistingCoverageRow[]
  content_fingerprint: string
}

export type ResearchLane = {
  schema_version: "scanner-existing-catalog-research-lane-v1"
  generated_at: string
  lane: Lane
  categories: readonly string[]
  source: {
    existing_catalog_coverage_ledger_content_fingerprint: string
    readiness_baseline_content_fingerprint: string
    note: string
  }
  reconciliation: { assigned_products: number; by_category: Record<string, number> }
  rows: ExistingCoverageRow[]
  content_fingerprint: string
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    )
  return value
}

export function fingerprint(content: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(content)))
    .digest("hex")
}

function exactMap<T extends { product_id: string }>(items: T[], label: string): Map<string, T> {
  const result = new Map(items.map((item) => [item.product_id, item]))
  if (result.size !== items.length) throw new Error(`existing_coverage_duplicate_${label}`)
  return result
}

function assertExactKeys(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string,
) {
  if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected)))
    throw new Error(`existing_coverage_${label}_drift:${JSON.stringify(actual)}`)
}

function manifestFingerprint(manifest: BackfillManifest): string {
  return fingerprint(manifest)
}

function assertManifest(manifest: BackfillManifest, batch: "E1" | "E2") {
  if (manifest.batch !== batch) throw new Error(`existing_coverage_expected_${batch}_manifest`)
  const expectedCount = PARTITION_TOTALS[batch === "E1" ? "safe_e1" : "safe_e2"]
  if (!Array.isArray(manifest.items) || manifest.items.length !== expectedCount)
    throw new Error(`existing_coverage_${batch}_item_count_drift`)
  exactMap(manifest.items, `${batch.toLowerCase()}_manifest`)
}

function categoryCounts(rows: Array<{ category_key: string }>): Record<string, number> {
  return Object.fromEntries(
    [
      ...rows.reduce(
        (acc, row) => acc.set(row.category_key, (acc.get(row.category_key) ?? 0) + 1),
        new Map(),
      ),
    ].sort(([left], [right]) => left.localeCompare(right)),
  )
}

function rowFor(
  baseline: BaselineProduct,
  readiness: ReadinessProductAudit,
  partition: Partition,
): ExistingCoverageRow {
  const { canonical_brand, clean_name, product_line } = baseline.identity
  if (!canonical_brand || !clean_name)
    throw new Error(`existing_coverage_missing_canonical_identity:${baseline.product_id}`)
  const gtinStatus: ExistingCoverageRow["gtin_status"] =
    partition === "already_scan_result_ready"
      ? "already_verified_in_catalog"
      : partition === "safe_e1"
        ? "verified_for_safe_e1"
        : partition === "safe_e2"
          ? "verified_for_safe_e2"
          : partition === "ready_for_gtin_research"
            ? "research_pending"
            : "authority_repair_required"
  return {
    product_id: baseline.product_id,
    category_key: baseline.identity.category_key,
    identity: { canonical_brand, clean_name, product_line },
    partition,
    linked_in_baseline: readiness.has_barcode,
    current_identifiers: [...baseline.identifiers].sort((left, right) =>
      `${left.identifier_type}\u0000${left.identifier_value}`.localeCompare(
        `${right.identifier_type}\u0000${right.identifier_value}`,
      ),
    ),
    strict_readiness: {
      status: readiness.status,
      blockers: [...readiness.blockers].sort(),
      verdicts: [...readiness.verdicts],
    },
    gtin_status: gtinStatus,
  }
}

export function buildExistingCoverageLedger(input: {
  baseline: LiveBaseline
  readiness: ReadinessBaseline
  e1: BackfillManifest
  e2: BackfillManifest
  generatedAt: string
}): ExistingCoverageLedger {
  assertManifest(input.e1, "E1")
  assertManifest(input.e2, "E2")
  const baselineById = exactMap(input.baseline.products, "baseline_product")
  const readinessById = exactMap(input.readiness.products, "readiness_product")
  if (baselineById.size !== 259 || readinessById.size !== 259)
    throw new Error(
      `existing_coverage_active_supported_count_drift:${baselineById.size}:${readinessById.size}`,
    )
  for (const productId of baselineById.keys()) {
    if (!readinessById.has(productId))
      throw new Error(`existing_coverage_missing_readiness:${productId}`)
  }
  for (const productId of readinessById.keys()) {
    if (!baselineById.has(productId))
      throw new Error(`existing_coverage_orphan_readiness:${productId}`)
  }
  const e1ById = exactMap(input.e1.items, "e1")
  const e2ById = exactMap(input.e2.items, "e2")
  for (const productId of e1ById.keys()) {
    if (e2ById.has(productId)) throw new Error(`existing_coverage_e1_e2_overlap:${productId}`)
  }

  const partitions = new Map<string, Partition>()
  for (const [productId, product] of baselineById) {
    const audit = readinessById.get(productId)!
    const e1 = e1ById.get(productId)
    const e2 = e2ById.get(productId)
    if (e1 || e2) {
      const item = e1 ?? e2!
      if (item.expected_product.category_key !== product.identity.category_key)
        throw new Error(`existing_coverage_manifest_category_drift:${productId}`)
      if (audit.status !== "ready_for_ean_research" || audit.has_barcode || audit.blockers.length)
        throw new Error(`existing_coverage_manifest_not_strict_ready:${productId}`)
      partitions.set(productId, e1 ? "safe_e1" : "safe_e2")
    } else if (audit.status === "scan_result_ready") {
      if (!audit.has_barcode || audit.blockers.length)
        throw new Error(`existing_coverage_invalid_scan_ready:${productId}`)
      partitions.set(productId, "already_scan_result_ready")
    } else if (audit.status === "ready_for_ean_research") {
      if (audit.has_barcode || audit.blockers.length)
        throw new Error(`existing_coverage_invalid_research_ready:${productId}`)
      partitions.set(productId, "ready_for_gtin_research")
    } else if (audit.status === "blocked") {
      if (!audit.blockers.length)
        throw new Error(`existing_coverage_unexplained_block:${productId}`)
      partitions.set(productId, "authority_repair")
    } else {
      throw new Error(`existing_coverage_unknown_readiness_status:${productId}`)
    }
  }
  const rows = [...baselineById.values()]
    .map((product) =>
      rowFor(product, readinessById.get(product.product_id)!, partitions.get(product.product_id)!),
    )
    .sort((left, right) => left.product_id.localeCompare(right.product_id))
  const byPartition = Object.fromEntries(
    Object.keys(PARTITION_TOTALS).map((partition) => [
      partition,
      rows.filter((row) => row.partition === partition).length,
    ]),
  ) as typeof PARTITION_TOTALS
  assertExactKeys(byPartition, PARTITION_TOTALS, "partition")
  assertExactKeys(categoryCounts(rows), EXISTING_CATALOG_CATEGORY_TOTALS, "category")
  const linkedBaselineProducts = rows.filter((row) => row.linked_in_baseline).length
  if (linkedBaselineProducts !== 38)
    throw new Error(`existing_coverage_linked_baseline_drift:${linkedBaselineProducts}`)
  const balea = rows.find((row) => row.product_id === "f184aef4-d8f9-4956-bcd6-ba1bf1ebeace")
  if (!balea || balea.partition !== "authority_repair")
    throw new Error("existing_coverage_balea_med_must_be_authority_repair")
  const content = {
    schema_version: "scanner-existing-catalog-coverage-ledger-v1" as const,
    source: {
      live_baseline_content_fingerprint: input.baseline.content_fingerprint,
      readiness_baseline_content_fingerprint: input.readiness.content_fingerprint,
      e1_manifest_content_fingerprint: manifestFingerprint(input.e1),
      e2_manifest_content_fingerprint: manifestFingerprint(input.e2),
      note: "A complete, mutually exclusive partition of every active scanner-supported catalog product. Safe E1/E2 rows remain prepared data until the separately authorized guarded executor applies them.",
    },
    reconciliation: {
      active_supported_products: 259 as const,
      linked_baseline_products: 38 as const,
      by_partition: PARTITION_TOTALS,
      by_category: EXISTING_CATALOG_CATEGORY_TOTALS,
    },
    rows,
  }
  return { generated_at: input.generatedAt, ...content, content_fingerprint: fingerprint(content) }
}

export function buildResearchLanes(
  ledger: ExistingCoverageLedger,
  generatedAt: string,
): ResearchLane[] {
  const researchRows = ledger.rows.filter((row) => row.partition === "ready_for_gtin_research")
  if (researchRows.length !== PARTITION_TOTALS.ready_for_gtin_research)
    throw new Error(`existing_coverage_research_count_drift:${researchRows.length}`)
  const lanes = RESEARCH_LANES.map(({ lane, categories }) => {
    const rows = researchRows
      .filter((row) => categories.includes(row.category_key as never))
      .sort((left, right) =>
        `${left.category_key}\u0000${left.identity.canonical_brand}\u0000${left.identity.clean_name}\u0000${left.product_id}`.localeCompare(
          `${right.category_key}\u0000${right.identity.canonical_brand}\u0000${right.identity.clean_name}\u0000${right.product_id}`,
        ),
      )
    const content = {
      schema_version: "scanner-existing-catalog-research-lane-v1" as const,
      lane,
      categories,
      source: {
        existing_catalog_coverage_ledger_content_fingerprint: ledger.content_fingerprint,
        readiness_baseline_content_fingerprint:
          ledger.source.readiness_baseline_content_fingerprint,
        note: "Research lane only. Each GTIN still requires fresh exact-product evidence, GS1 checksum validation, global ownership checks, and guarded application approval.",
      },
      reconciliation: { assigned_products: rows.length, by_category: categoryCounts(rows) },
      rows,
    }
    return { generated_at: generatedAt, ...content, content_fingerprint: fingerprint(content) }
  })
  const assigned = lanes.flatMap((lane) => lane.rows)
  if (new Set(assigned.map((row) => row.product_id)).size !== researchRows.length)
    throw new Error("existing_coverage_lane_overlap_or_gap")
  const laneCategories = new Set<string>(lanes.flatMap((lane) => lane.categories))
  if (assigned.some((row) => !laneCategories.has(row.category_key)))
    throw new Error("existing_coverage_lane_category_mismatch")
  return lanes
}

function main() {
  const inputPath = (name: string) => join(process.cwd(), DIRECTORY, name)
  const paths = {
    baseline: inputPath("live-baseline.json"),
    readiness: inputPath("readiness-baseline.json"),
    e1: inputPath("phase1-existing-identifier-backfill-e1-v1.json"),
    e2: inputPath("phase1-existing-identifier-backfill-e2-v1.json"),
  }
  if (Object.values(paths).some((path) => !existsSync(path)))
    throw new Error("existing_coverage_inputs_missing")
  const ledger = buildExistingCoverageLedger({
    baseline: JSON.parse(readFileSync(paths.baseline, "utf8")) as LiveBaseline,
    readiness: JSON.parse(readFileSync(paths.readiness, "utf8")) as ReadinessBaseline,
    e1: JSON.parse(readFileSync(paths.e1, "utf8")) as BackfillManifest,
    e2: JSON.parse(readFileSync(paths.e2, "utf8")) as BackfillManifest,
    generatedAt: new Date().toISOString(),
  })
  const lanes = buildResearchLanes(ledger, ledger.generated_at)
  writeFileSync(join(process.cwd(), OUTPUT_PATH), `${JSON.stringify(ledger, null, 2)}\n`)
  for (const lane of lanes)
    writeFileSync(
      join(
        process.cwd(),
        DIRECTORY,
        `existing-catalog-research-lane-${lane.lane.toLowerCase()}.json`,
      ),
      `${JSON.stringify(lane, null, 2)}\n`,
    )
  process.stdout.write(
    `${JSON.stringify({ path: OUTPUT_PATH, by_partition: ledger.reconciliation.by_partition, content_fingerprint: ledger.content_fingerprint, lanes: Object.fromEntries(lanes.map((lane) => [lane.lane, { assigned_products: lane.reconciliation.assigned_products, content_fingerprint: lane.content_fingerprint }])) })}\n`,
  )
}

if ((process.argv[1] ?? "").endsWith("build-existing-coverage-ledger.ts")) main()
