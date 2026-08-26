import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { canonicalizeGtin } from "../../src/lib/product-identity/normalize"

const DIRECTORY = "data/scanner-catalog-coverage/2026-08-26"
const LANES = ["A", "B", "C", "D"] as const
const LANE_CATEGORIES = {
  A: ["shampoo", "deep_cleansing_shampoo", "dry_shampoo"],
  B: ["conditioner"],
  C: ["leave_in", "bondbuilder"],
  D: ["mask", "oil"],
} as const
type Lane = (typeof LANES)[number]
type Json = Record<string, unknown>

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as Json)
        .sort()
        .map((key) => [key, stable((value as Json)[key])]),
    )
  return value
}
export function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex")
}
function object(value: unknown, label: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`research_batches_${label}_object_required`)
  return value as Json
}
function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`research_batches_${label}_string_required`)
  return value
}
function number(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new Error(`research_batches_${label}_nonnegative_integer_required`)
  return value as number
}
function url(value: unknown, label: string): string {
  const result = string(value, label)
  try {
    const parsed = new URL(result)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error()
  } catch {
    throw new Error(`research_batches_${label}_direct_http_url_required`)
  }
  return result
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`research_batches_${label}_array_required`)
  return value
}

export type VerifiedPackage = {
  raw_gtin: string
  canonical_gtin14: string
  size: string
  market_scope: string
  source_url: string
  source_urls: string[]
  source_checked_at: string
  exact_match_note: string
}
export type ResearchRow = {
  product_id: string
  expected_identity: { canonical_brand: string; clean_name: string; category_key: string }
  status: "verified" | "blocked"
  blocker: string | null
  evidence_checked_at: string
  evidence_attempted?: string[]
  packages: VerifiedPackage[]
}
export type LaneArtifact = {
  lane: Lane
  assignment_content_fingerprint: string
  content_fingerprint: string
  reconciliation: {
    assigned_products: number
    verified_products: number
    blocked_products: number
    verified_gtins: number
    by_category: Record<
      string,
      {
        assigned_products: number
        verified_products: number
        blocked_products: number
        verified_gtins: number
      }
    >
  }
  products: ResearchRow[]
}

export function validateLaneArtifact(raw: unknown, assignment: Json, lane: Lane): LaneArtifact {
  const artifact = object(raw, `lane_${lane}`)
  if (artifact.schema_version !== "scanner-existing-catalog-gtin-research-v1")
    throw new Error(`research_batches_lane_${lane}_schema_drift`)
  if (artifact.lane !== lane) throw new Error(`research_batches_lane_${lane}_name_drift`)
  if (artifact.assignment_content_fingerprint !== assignment.content_fingerprint)
    throw new Error(`research_batches_lane_${lane}_assignment_fingerprint_drift`)
  const {
    generated_at: _generatedAt,
    content_fingerprint: suppliedFingerprint,
    ...fingerprintContent
  } = artifact
  if (
    string(suppliedFingerprint, `lane_${lane}_content_fingerprint`) !==
    fingerprint(fingerprintContent)
  )
    throw new Error(`research_batches_lane_${lane}_content_fingerprint_drift`)
  const expectedRows = array(assignment.rows, `assignment_${lane}_rows`).map((value) =>
    object(value, `assignment_${lane}_row`),
  )
  const expected = new Map(
    expectedRows.map((row) => [string(row.product_id, `assignment_${lane}_product_id`), row]),
  )
  const rows = array(artifact.products, `lane_${lane}_products`).map((value) =>
    object(value, `lane_${lane}_product`),
  )
  if (rows.length !== expected.size)
    throw new Error(`research_batches_lane_${lane}_assigned_count_drift`)
  const seen = new Set<string>()
  let verified = 0
  let gtins = 0
  const parsed = rows.map((row): ResearchRow => {
    const productId = string(row.product_id, `lane_${lane}_product_id`)
    if (seen.has(productId) || !expected.has(productId))
      throw new Error(`research_batches_lane_${lane}_unknown_or_duplicate_product:${productId}`)
    seen.add(productId)
    const expectedRow = expected.get(productId)!
    const identity = object(row.expected_identity, `lane_${lane}_identity`)
    const expectedIdentity = object(expectedRow.identity, `assignment_${lane}_identity`)
    for (const field of ["canonical_brand", "clean_name"] as const)
      if (identity[field] !== expectedIdentity[field])
        throw new Error(`research_batches_lane_${lane}_identity_drift:${productId}`)
    const category = string(identity.category_key, `lane_${lane}_category`)
    if (category !== expectedRow.category_key || !LANE_CATEGORIES[lane].includes(category as never))
      throw new Error(`research_batches_lane_${lane}_category_drift:${productId}`)
    const status = string(row.status, `lane_${lane}_status`)
    const packages = array(row.packages, `lane_${lane}_packages`)
    const blocker = row.blocker === null ? null : string(row.blocker, `lane_${lane}_blocker`)
    const evidenceCheckedAt = string(row.evidence_checked_at, `lane_${lane}_evidence_checked_at`)
    if (status === "verified") {
      if (blocker !== null || packages.length === 0)
        throw new Error(`research_batches_lane_${lane}_verified_shape:${productId}`)
      verified++
    } else if (status === "blocked") {
      const attempted = array(row.evidence_attempted, `lane_${lane}_blocked_evidence`)
      if (!blocker || packages.length || !attempted.length)
        throw new Error(`research_batches_lane_${lane}_blocked_shape:${productId}`)
      attempted.forEach((item) => url(item, `lane_${lane}_blocked_source`))
    } else throw new Error(`research_batches_lane_${lane}_status_drift:${productId}`)
    const packageByCanonical = new Map<string, string>()
    const parsedPackages = packages.map((value): VerifiedPackage => {
      const pkg = object(value, `lane_${lane}_package`)
      const rawGtin = string(pkg.raw_gtin, `lane_${lane}_raw_gtin`)
      const canonical = string(pkg.canonical_gtin14, `lane_${lane}_canonical_gtin14`)
      if (canonicalizeGtin(rawGtin) !== canonical)
        throw new Error(`research_batches_lane_${lane}_invalid_gtin:${rawGtin}`)
      const sourceUrl = url(pkg.source_url, `lane_${lane}_source_url`)
      const sourceUrls = array(pkg.source_urls, `lane_${lane}_source_urls`).map((item) =>
        url(item, `lane_${lane}_source_urls`),
      )
      if (!sourceUrls.includes(sourceUrl))
        throw new Error(`research_batches_lane_${lane}_source_url_not_listed`)
      const parsedPackage = {
        raw_gtin: rawGtin,
        canonical_gtin14: canonical,
        size: string(pkg.size, `lane_${lane}_size`),
        market_scope: string(pkg.market_scope, `lane_${lane}_market_scope`),
        source_url: sourceUrl,
        source_urls: sourceUrls,
        source_checked_at: string(pkg.source_checked_at, `lane_${lane}_source_checked_at`),
        exact_match_note: string(pkg.exact_match_note, `lane_${lane}_note`),
      }
      const previous = packageByCanonical.get(canonical)
      const serialized = JSON.stringify(stable(parsedPackage))
      if (previous && previous !== serialized)
        throw new Error(`research_batches_lane_${lane}_duplicate_package_gtin:${canonical}`)
      if (!previous) {
        packageByCanonical.set(canonical, serialized)
        gtins++
      }
      return parsedPackage
    })
    return {
      product_id: productId,
      expected_identity: {
        canonical_brand: string(identity.canonical_brand, `lane_${lane}_brand`),
        clean_name: string(identity.clean_name, `lane_${lane}_name`),
        category_key: category,
      },
      status: status as ResearchRow["status"],
      blocker,
      evidence_checked_at: evidenceCheckedAt,
      evidence_attempted: row.evidence_attempted as string[] | undefined,
      packages: parsedPackages,
    }
  })
  const r = object(artifact.reconciliation, `lane_${lane}_reconciliation`)
  const expectedRecon = {
    assigned_products: parsed.length,
    verified_products: verified,
    blocked_products: parsed.length - verified,
    verified_gtins: gtins,
  }
  for (const [key, value] of Object.entries(expectedRecon))
    if (number(r[key], `lane_${lane}_${key}`) !== value)
      throw new Error(`research_batches_lane_${lane}_reconciliation_drift:${key}`)
  const expectedByCategory = Object.fromEntries(
    LANE_CATEGORIES[lane].map((category) => {
      const matching = parsed.filter((row) => row.expected_identity.category_key === category)
      return [
        category,
        {
          assigned_products: matching.length,
          verified_products: matching.filter((row) => row.status === "verified").length,
          blocked_products: matching.filter((row) => row.status === "blocked").length,
          verified_gtins: matching.reduce(
            (sum, row) => sum + new Set(row.packages.map((pkg) => pkg.canonical_gtin14)).size,
            0,
          ),
        },
      ]
    }),
  )
  if (
    JSON.stringify(stable(object(r.by_category, `lane_${lane}_by_category`))) !==
    JSON.stringify(stable(expectedByCategory))
  )
    throw new Error(`research_batches_lane_${lane}_by_category_drift`)
  return {
    lane,
    assignment_content_fingerprint: string(
      artifact.assignment_content_fingerprint,
      `lane_${lane}_fingerprint`,
    ),
    content_fingerprint: string(artifact.content_fingerprint, `lane_${lane}_content_fingerprint`),
    reconciliation: {
      ...expectedRecon,
      by_category: expectedByCategory,
    },
    products: parsed,
  }
}

function referenceOwnership(input: { baseline: Json; e1: Json; e2: Json }) {
  const result = new Map<string, string>()
  const add = (raw: unknown, productId: string) => {
    const canonical = canonicalizeGtin(typeof raw === "string" ? raw : "")
    if (!canonical) return
    const existing = result.get(canonical)
    if (existing && existing !== productId)
      throw new Error(`research_batches_reference_ownership_conflict:${canonical}`)
    result.set(canonical, productId)
  }
  for (const value of array(input.baseline.products, "baseline_products")) {
    const product = object(value, "baseline_product")
    const productId = string(product.product_id, "baseline_product_id")
    for (const value of array(product.identifiers, "baseline_identifiers"))
      add(object(value, "baseline_identifier").identifier_value, productId)
  }
  for (const manifest of [input.e1, input.e2])
    for (const value of array(manifest.items, "safe_manifest_items")) {
      const item = object(value, "safe_manifest_item")
      const productId = string(item.product_id, "safe_manifest_product_id")
      for (const value of array(item.identifiers, "safe_manifest_identifiers")) {
        const identifier = object(value, "safe_manifest_identifier")
        add(identifier.raw_gtin ?? identifier.value, productId)
      }
    }
  return result
}

function openSubmissionGtins(baseline: Json): Set<string> {
  const envelope = object(
    baseline.open_submission_identity_candidates,
    "baseline_open_submission_candidates",
  )
  return new Set(
    array(envelope.resolved_identity_candidates, "baseline_open_submission_rows")
      .map((value) => object(value, "baseline_open_submission_row"))
      .flatMap((row) =>
        Array.isArray(row.canonical_gtin14s) ? row.canonical_gtin14s : [row.canonical_gtin14],
      )
      .map((value) => canonicalizeGtin(typeof value === "string" ? value : ""))
      .filter((value): value is string => value !== null),
  )
}

export function buildExistingResearchBatches(input: {
  assignments: Record<Lane, Json>
  artifacts: Record<Lane, unknown>
  baseline: Json
  e1: Json
  e2: Json
  generatedAt: string
}) {
  const lanes = LANES.map((lane) =>
    validateLaneArtifact(input.artifacts[lane], input.assignments[lane], lane),
  )
  const allRows = lanes.flatMap((lane) => lane.products)
  if (allRows.length !== 150 || new Set(allRows.map((row) => row.product_id)).size !== 150)
    throw new Error("research_batches_full_assignment_drift")
  const knownOwnership = referenceOwnership(input)
  const pendingSubmissionGtins = openSubmissionGtins(input.baseline)
  const ownership = new Map<string, string>()
  for (const row of allRows)
    for (const pkg of row.packages) {
      const previous = ownership.get(pkg.canonical_gtin14)
      if (previous && previous !== row.product_id)
        throw new Error(`research_batches_duplicate_research_gtin:${pkg.canonical_gtin14}`)
      const known = knownOwnership.get(pkg.canonical_gtin14)
      if (known && known !== row.product_id)
        throw new Error(`research_batches_reference_ownership_conflict:${pkg.canonical_gtin14}`)
      if (pendingSubmissionGtins.has(pkg.canonical_gtin14))
        throw new Error(`research_batches_open_submission_overlap:${pkg.canonical_gtin14}`)
      ownership.set(pkg.canonical_gtin14, row.product_id)
    }
  const verified = allRows.filter((row) => row.status === "verified")
  const content = {
    schema_version: "scanner-existing-catalog-gtin-research-summary-v1",
    source: {
      lane_content_fingerprints: Object.fromEntries(
        lanes.map((lane) => [lane.lane, lane.content_fingerprint]),
      ),
      assignment_content_fingerprints: Object.fromEntries(
        lanes.map((lane) => [lane.lane, lane.assignment_content_fingerprint]),
      ),
    },
    reconciliation: {
      assigned_products: 150,
      verified_products: verified.length,
      blocked_products: 150 - verified.length,
      verified_gtins: [...ownership].length,
      by_lane: Object.fromEntries(lanes.map((lane) => [lane.lane, lane.reconciliation])),
    },
    products: allRows.sort((a, b) => a.product_id.localeCompare(b.product_id)),
  }
  const summary = {
    generated_at: input.generatedAt,
    ...content,
    content_fingerprint: fingerprint(content),
  }
  const candidates = verified
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
    .reduce<ResearchRow[][]>((acc, row, index) => {
      const bucket = Math.floor(index / 20)
      ;(acc[bucket] ??= []).push(row)
      return acc
    }, [])
    .map((rows, index) => {
      const content = {
        schema_version: "scanner-existing-identifier-research-candidates-v1",
        batch: `E${index + 3}`,
        research_only: true,
        source_summary_content_fingerprint: summary.content_fingerprint,
        items: rows.map((row) => ({
          product_id: row.product_id,
          expected_product: {
            brand: row.expected_identity.canonical_brand,
            name: row.expected_identity.clean_name,
            category_key: row.expected_identity.category_key,
          },
          identifiers: row.packages,
        })),
      }
      return {
        generated_at: input.generatedAt,
        ...content,
        content_fingerprint: fingerprint(content),
      }
    })
  return { summary, candidates }
}

function main() {
  const read = (file: string) =>
    JSON.parse(readFileSync(join(process.cwd(), DIRECTORY, file), "utf8"))
  const assignments = Object.fromEntries(
    LANES.map((lane) => [lane, read(`existing-catalog-research-lane-${lane.toLowerCase()}.json`)]),
  ) as Record<Lane, Json>
  const artifacts = Object.fromEntries(
    LANES.map((lane) => {
      const file = `existing-catalog-gtin-research-lane-${lane.toLowerCase()}-v1.json`
      if (!existsSync(join(process.cwd(), DIRECTORY, file)))
        throw new Error(`research_batches_missing_${lane}`)
      return [lane, read(file)]
    }),
  ) as Record<Lane, unknown>
  const result = buildExistingResearchBatches({
    assignments,
    artifacts,
    baseline: read("live-baseline.json"),
    e1: read("phase1-existing-identifier-backfill-e1-v1.json"),
    e2: read("phase1-existing-identifier-backfill-e2-v1.json"),
    generatedAt: new Date().toISOString(),
  })
  writeFileSync(
    join(process.cwd(), DIRECTORY, "existing-catalog-gtin-research-summary.json"),
    JSON.stringify(result.summary, null, 2) + "\n",
  )
  for (const candidate of result.candidates)
    writeFileSync(
      join(
        process.cwd(),
        DIRECTORY,
        `phase1-existing-identifier-backfill-e${candidate.batch.slice(1)}-candidates-v1.json`,
      ),
      JSON.stringify(candidate, null, 2) + "\n",
    )
  process.stdout.write(
    JSON.stringify({
      summary: result.summary.content_fingerprint,
      candidates: result.candidates.map((candidate) => candidate.content_fingerprint),
    }) + "\n",
  )
}
if ((process.argv[1] ?? "").endsWith("build-existing-research-batches.ts")) main()
