import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { canonicalizeGtin } from "../../src/lib/product-identity/normalize"
import type { Phase1aLedger, Phase1aRow } from "./build-phase1a-ledger"

const OUTPUT_PATH = "data/scanner-catalog-coverage/2026-08-26/phase1b-new-ledger.json"
const PILOT_OUTPUT_PATH = "data/scanner-catalog-coverage/2026-08-26/phase1-pilot-manifest.json"

export const PHASE_1B_TARGETS = {
  shampoo: 7,
  conditioner: 8,
  mask: 6,
  leave_in: 8,
  oil: 6,
  dry_shampoo: 7,
  heat_protectant: 5,
  deep_cleansing_shampoo: 3,
  scalp_care: 2,
  bondbuilder: 2,
} as const

type Phase1bCategory = keyof typeof PHASE_1B_TARGETS
type CandidateSource = "retailer-core" | "retailer-specialist"
type Candidate = Record<string, unknown>
type NewPilotProduct = {
  candidate_id: string
  category_key: Phase1bCategory
  brand: string
  product_line: string | null
  name: string
  package_size: string
  gtin: string
  canonical_gtin14: string
  source_urls: string[]
  reconciliation_status: "new_candidate_confirmed"
  popularity_signal: string
}
type NewPilotResearch = {
  schema_version: string
  research_id: string
  ownership_checked_at: string
  ownership_scope: string
  research_only: true
  products: NewPilotProduct[]
}

export type Phase1bRow = {
  candidate_id: string
  category_key: Phase1bCategory
  inclusion_rank: number
  wave: "pilot" | "new_product"
  identity: {
    canonical_brand: string
    product_line: string | null
    clean_name: string
    normalized_identity: string
  }
  package: { size: string; gtin: string | null; canonical_gtin14: string | null }
  sources: { pdp_urls: string[]; retailers: string[]; source_priority: CandidateSource }
  popularity: {
    priority_rank: number
    visibility_signal: string
    priority_rationale: string | null
  }
  reconciliation: {
    status: "new_candidate_confirmed"
    category_fit: "accepted_for_category_contract"
    confidence: string | null
    gtin_ownership_state: string
    source_payload: Candidate
  }
  catalog_readiness: {
    research_only: true
    catalog_intake_ready: false
    scan_result_ready: false
    blockers: string[]
  }
}

export type Phase1bLedger = {
  schema_version: "scanner-phase1b-new-ledger-v1"
  generated_at: string
  source: {
    core_content_fingerprint: string
    specialist_content_fingerprint: string
    pilot_research_id: string
    research_only: true
    note: string
  }
  targets: typeof PHASE_1B_TARGETS
  reconciliation: {
    selected_products: number
    by_category: Record<
      Phase1bCategory,
      { target: number; selected: number; pilot: number; new_product: number }
    >
  }
  rows: Phase1bRow[]
  content_fingerprint: string
}

export type Phase1PilotManifest = {
  schema_version: "scanner-phase1-pilot-manifest-v1"
  generated_at: string
  source: {
    phase1a_content_fingerprint: string
    phase1b_content_fingerprint: string
    research_only: true
    note: string
  }
  totals: {
    existing_products: 20
    new_products: 5
    total_products: 25
    existing_canonical_gtins: 22
    new_canonical_gtins: 5
    unique_canonical_gtins: 27
  }
  existing: Array<{
    product_id: string
    category_key: string
    identity: Phase1aRow["identity"]
    packages: NonNullable<Phase1aRow["pilot_gtin_evidence"]>["packages"]
  }>
  new: Array<{
    candidate_id: string
    category_key: Phase1bCategory
    identity: Phase1bRow["identity"]
    package: Phase1bRow["package"]
    source_urls: string[]
  }>
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

function normalizeIdentity(brand: string, productLine: string | null, name: string): string {
  return [brand, productLine ?? "", name]
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter((item): item is string => item !== null)
    : []
}

function sourcePdpUrls(candidate: Candidate): string[] {
  const direct = asString(candidate.source_pdp_url)
  const nested = Array.isArray(candidate.sources)
    ? candidate.sources.flatMap((item) => asString((item as Record<string, unknown>).url) ?? [])
    : []
  return [...new Set([...(direct ? [direct] : []), ...nested])].filter(isExactRetailerPdp).sort()
}

function retailerNames(candidate: Candidate): string[] {
  const direct = arrayOfStrings(candidate.retailers)
  const nested = Array.isArray(candidate.sources)
    ? candidate.sources.flatMap(
        (item) => asString((item as Record<string, unknown>).retailer) ?? [],
      )
    : []
  return [...new Set([...direct, ...nested])].map((item) => item.toLowerCase()).sort()
}

export function isExactRetailerPdp(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    if (host.endsWith("dm.de")) return /^\/p\/d\/\d+\//.test(path) || /-p\d+\.html$/.test(path)
    if (host.endsWith("rossmann.de")) return /\/p\/\d+$/.test(path)
    if (host.endsWith("mueller.de")) return /^\/p\//.test(path)
    return true
  } catch {
    return false
  }
}

function categoryOf(candidate: Candidate): Phase1bCategory | null {
  return asString(candidate.category) as Phase1bCategory | null
}
function statusOf(candidate: Candidate): string | null {
  return (
    asString((candidate.reconciliation as Candidate | undefined)?.status) ??
    asString(candidate.reconciliation_status)
  )
}
function categoryFitOf(candidate: Candidate): string | null {
  return (
    asString((candidate.reconciliation_review as Candidate | undefined)?.category_fit_triage) ??
    "accepted_for_category_contract"
  )
}
function ownershipOf(candidate: Candidate): Candidate {
  return (
    ((candidate.reconciliation as Candidate | undefined)?.gtin_ownership as
      | Candidate
      | undefined) ??
    ((candidate.reconciliation_review as Candidate | undefined)?.gtin_ownership as
      | Candidate
      | undefined) ??
    {}
  )
}
function canonicalGtinOf(candidate: Candidate): string | null {
  const direct = asString(candidate.canonical_gtin14)
  const ownership = asString(ownershipOf(candidate).canonical_gtin14)
  const raw = asString(candidate.gtin) ?? asString(ownershipOf(candidate).gtin)
  const supplied = direct ?? ownership ?? raw
  if (!supplied) return null
  const canonical = canonicalizeGtin(supplied)
  if (!canonical) throw new Error(`phase1b_invalid_gtin:${String(candidate.candidate_id)}`)
  return canonical
}
function rawGtinOf(candidate: Candidate): string | null {
  return (
    asString(candidate.gtin) ??
    asString((candidate.gtin_evidence as Candidate | undefined)?.value_seen) ??
    asString(ownershipOf(candidate).gtin)
  )
}
function confidenceOf(candidate: Candidate): string | null {
  return (
    asString((candidate.reconciliation as Candidate | undefined)?.match_confidence) ??
    asString((candidate.reconciliation_review as Candidate | undefined)?.confidence)
  )
}
function priorityRankOf(candidate: Candidate): number {
  return typeof candidate.priority_rank === "number"
    ? candidate.priority_rank
    : Number.MAX_SAFE_INTEGER
}

function isEligible(candidate: Candidate): boolean {
  const urls = sourcePdpUrls(candidate)
  return (
    statusOf(candidate) === "new_candidate_confirmed" &&
    categoryFitOf(candidate) === "accepted_for_category_contract" &&
    urls.length > 0
  )
}

function candidateComparator(
  left: { candidate: Candidate; source: CandidateSource },
  right: { candidate: Candidate; source: CandidateSource },
): number {
  const sourceRank = (source: CandidateSource) => (source === "retailer-specialist" ? 0 : 1)
  const a = sourceRank(left.source) - sourceRank(right.source)
  if (a !== 0) return a
  const b = priorityRankOf(left.candidate) - priorityRankOf(right.candidate)
  if (b !== 0) return b
  const c =
    Number(canonicalGtinOf(right.candidate) !== null) -
    Number(canonicalGtinOf(left.candidate) !== null)
  if (c !== 0) return c
  const d = retailerNames(right.candidate).length - retailerNames(left.candidate).length
  if (d !== 0) return d
  return String(left.candidate.candidate_id).localeCompare(String(right.candidate.candidate_id))
}

function toRow(
  entry: { candidate: Candidate; source: CandidateSource },
  category: Phase1bCategory,
  inclusionRank: number,
  pilotIds: Set<string>,
): Phase1bRow {
  const candidate = entry.candidate
  const canonicalBrand = asString(candidate.canonical_brand)
  const cleanName = asString(candidate.clean_name)
  const productLine = asString(candidate.product_line)
  const candidateId = asString(candidate.candidate_id)
  if (!candidateId || !canonicalBrand || !cleanName)
    throw new Error(`phase1b_identity_incomplete:${candidateId ?? "unknown"}`)
  const canonicalGtin14 = canonicalGtinOf(candidate)
  return {
    candidate_id: candidateId,
    category_key: category,
    inclusion_rank: inclusionRank,
    wave: pilotIds.has(candidateId) ? "pilot" : "new_product",
    identity: {
      canonical_brand: canonicalBrand,
      product_line: productLine,
      clean_name: cleanName,
      normalized_identity: normalizeIdentity(canonicalBrand, productLine, cleanName),
    },
    package: {
      size: asString(candidate.package_size) ?? "not_provided",
      gtin: rawGtinOf(candidate),
      canonical_gtin14: canonicalGtin14,
    },
    sources: {
      pdp_urls: sourcePdpUrls(candidate),
      retailers: retailerNames(candidate),
      source_priority: entry.source,
    },
    popularity: {
      priority_rank: priorityRankOf(candidate),
      visibility_signal:
        asString(candidate.visibility_signal) ??
        asString((candidate.sources as Candidate[] | undefined)?.[0]?.visibility_signal) ??
        "not_provided",
      priority_rationale: asString(candidate.priority_rationale),
    },
    reconciliation: {
      status: "new_candidate_confirmed",
      category_fit: "accepted_for_category_contract",
      confidence: confidenceOf(candidate),
      gtin_ownership_state: asString(ownershipOf(candidate).status) ?? "not_provided",
      source_payload: candidate,
    },
    catalog_readiness: {
      research_only: true,
      catalog_intake_ready: false,
      scan_result_ready: false,
      blockers: [
        "full_product_intake_evidence_required",
        "ingredient_classification_required",
        "human_review_required",
        "catalog_publish_not_authorized",
      ],
    },
  }
}

function assertUnique(rows: Phase1bRow[]) {
  const seen = new Map<string, string>()
  for (const row of rows) {
    for (const [kind, value] of [
      ["candidate_id", row.candidate_id],
      ["normalized_identity", row.identity.normalized_identity],
      ["canonical_gtin14", row.package.canonical_gtin14],
    ] as const) {
      if (!value) continue
      const key = `${kind}:${value}`
      if (seen.has(key))
        throw new Error(`phase1b_duplicate_${kind}:${value}:${seen.get(key)}:${row.candidate_id}`)
      seen.set(key, row.candidate_id)
    }
    for (const sourcePdpUrl of row.sources.pdp_urls) {
      const key = `source_pdp_url:${sourcePdpUrl}`
      if (seen.has(key))
        throw new Error(
          `phase1b_duplicate_source_pdp_url:${sourcePdpUrl}:${seen.get(key)}:${row.candidate_id}`,
        )
      seen.set(key, row.candidate_id)
    }
  }
}

function rowUniqueKeys(row: Phase1bRow): string[] {
  return [
    `candidate_id:${row.candidate_id}`,
    `normalized_identity:${row.identity.normalized_identity}`,
    ...row.sources.pdp_urls.map((url) => `source_pdp_url:${url}`),
    ...(row.package.canonical_gtin14 ? [`canonical_gtin14:${row.package.canonical_gtin14}`] : []),
  ]
}

function canSelect(row: Phase1bRow, selectedKeys: Set<string>): boolean {
  return rowUniqueKeys(row).every((key) => !selectedKeys.has(key))
}

function retain(row: Phase1bRow, selectedKeys: Set<string>) {
  for (const key of rowUniqueKeys(row)) selectedKeys.add(key)
}

export function buildPhase1bLedger(input: {
  core: { content_fingerprint: string; candidates: Candidate[] }
  specialist: { content_fingerprint: string; candidates: Candidate[] }
  pilotResearch: NewPilotResearch
  generatedAt: string
}): Phase1bLedger {
  const pilotIds = new Set(input.pilotResearch.products.map((product) => product.candidate_id))
  if (pilotIds.size !== 5) throw new Error(`phase1b_pilot_expected_5_products:${pilotIds.size}`)
  const all = [
    ...input.core.candidates.map((candidate) => ({ candidate, source: "retailer-core" as const })),
    ...input.specialist.candidates.map((candidate) => ({
      candidate,
      source: "retailer-specialist" as const,
    })),
  ]
  const byId = new Map(all.map((entry) => [String(entry.candidate.candidate_id), entry]))
  for (const seed of input.pilotResearch.products) {
    const candidate = byId.get(seed.candidate_id)
    if (
      !candidate ||
      !isEligible(candidate.candidate) ||
      categoryOf(candidate.candidate) !== seed.category_key
    )
      throw new Error(`phase1b_pilot_not_eligible:${seed.candidate_id}`)
    if (canonicalGtinOf(candidate.candidate) !== seed.canonical_gtin14)
      throw new Error(`phase1b_pilot_gtin_drift:${seed.candidate_id}`)
  }
  const entriesByCategory = new Map(
    (Object.keys(PHASE_1B_TARGETS) as Phase1bCategory[]).map((category) => [
      category,
      {
        pilot: all
          .filter(
            (entry) =>
              categoryOf(entry.candidate) === category &&
              pilotIds.has(String(entry.candidate.candidate_id)),
          )
          .sort(candidateComparator),
        eligible: all
          .filter(
            (entry) =>
              categoryOf(entry.candidate) === category &&
              isEligible(entry.candidate) &&
              !pilotIds.has(String(entry.candidate.candidate_id)),
          )
          .sort(candidateComparator),
      },
    ]),
  )
  const selectedRows = new Map<Phase1bCategory, Phase1bRow[]>()
  const selectedKeys = new Set<string>()
  for (const category of Object.keys(PHASE_1B_TARGETS) as Phase1bCategory[]) {
    const pilot = entriesByCategory.get(category)!.pilot
    if (pilot.length > PHASE_1B_TARGETS[category])
      throw new Error(`phase1b_pilot_exceeds_target:${category}`)
    const retained = pilot.map((entry, index) => toRow(entry, category, index + 1, pilotIds))
    for (const row of retained) {
      if (!canSelect(row, selectedKeys))
        throw new Error(`phase1b_pilot_conflict:${row.candidate_id}`)
      retain(row, selectedKeys)
    }
    selectedRows.set(category, retained)
  }
  const categoryOrder = (Object.keys(PHASE_1B_TARGETS) as Phase1bCategory[]).sort((left, right) => {
    const leftSurplus =
      entriesByCategory.get(left)!.eligible.length +
      entriesByCategory.get(left)!.pilot.length -
      PHASE_1B_TARGETS[left]
    const rightSurplus =
      entriesByCategory.get(right)!.eligible.length +
      entriesByCategory.get(right)!.pilot.length -
      PHASE_1B_TARGETS[right]
    return leftSurplus - rightSurplus || left.localeCompare(right)
  })
  for (const category of categoryOrder) {
    const target = PHASE_1B_TARGETS[category]
    const chosen = selectedRows.get(category)!
    for (const entry of entriesByCategory.get(category)!.eligible) {
      if (chosen.length === target) break
      const row = toRow(entry, category, chosen.length + 1, pilotIds)
      if (!canSelect(row, selectedKeys)) continue
      chosen.push(row)
      retain(row, selectedKeys)
    }
    if (chosen.length !== target)
      throw new Error(`phase1b_target_shortage:${category}:${chosen.length}:${target}`)
  }
  const rows = [...selectedRows.values()].flat()
  rows.sort((a, b) =>
    `${a.category_key}\u0000${String(a.inclusion_rank).padStart(3, "0")}\u0000${a.candidate_id}`.localeCompare(
      `${b.category_key}\u0000${String(b.inclusion_rank).padStart(3, "0")}\u0000${b.candidate_id}`,
    ),
  )
  assertUnique(rows)
  if (rows.length !== 54) throw new Error(`phase1b_expected_54_rows:${rows.length}`)
  const reconciliation = {
    selected_products: rows.length,
    by_category: Object.fromEntries(
      (Object.keys(PHASE_1B_TARGETS) as Phase1bCategory[]).map((category) => {
        const selected = rows.filter((row) => row.category_key === category)
        return [
          category,
          {
            target: PHASE_1B_TARGETS[category],
            selected: selected.length,
            pilot: selected.filter((row) => row.wave === "pilot").length,
            new_product: selected.filter((row) => row.wave === "new_product").length,
          },
        ]
      }),
    ) as Phase1bLedger["reconciliation"]["by_category"],
  }
  const content = {
    schema_version: "scanner-phase1b-new-ledger-v1" as const,
    source: {
      core_content_fingerprint: input.core.content_fingerprint,
      specialist_content_fingerprint: input.specialist.content_fingerprint,
      pilot_research_id: input.pilotResearch.research_id,
      research_only: true as const,
      note: "All selected rows are externally evidenced, reconciled new candidates only. They remain research-only and require full Product Intake evidence, ingredient classification, human review, and authorized publication before any scanner result may use them.",
    },
    targets: PHASE_1B_TARGETS,
    reconciliation,
    rows,
  }
  return { generated_at: input.generatedAt, ...content, content_fingerprint: fingerprint(content) }
}

export function buildPilotManifest(input: {
  phase1a: Phase1aLedger
  phase1b: Phase1bLedger
  generatedAt: string
}): Phase1PilotManifest {
  const existingRows = input.phase1a.rows.filter((row) => row.wave === "pilot")
  const newRows = input.phase1b.rows.filter((row) => row.wave === "pilot")
  if (existingRows.length !== 20 || newRows.length !== 5)
    throw new Error(`phase1_pilot_product_count:${existingRows.length}:${newRows.length}`)
  const existing = existingRows
    .map((row) => ({
      product_id: row.product_id,
      category_key: row.category_key,
      identity: row.identity,
      packages: row.pilot_gtin_evidence?.packages ?? [],
    }))
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
  const newest = newRows
    .map((row) => ({
      candidate_id: row.candidate_id,
      category_key: row.category_key,
      identity: row.identity,
      package: row.package,
      source_urls: row.sources.pdp_urls,
    }))
    .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id))
  const existingGtins = existing.flatMap((row) => row.packages.map((item) => item.canonical_gtin14))
  const newGtins = newest.map((row) => row.package.canonical_gtin14)
  if (
    existingGtins.length !== 22 ||
    newGtins.some((gtin) => gtin === null) ||
    newGtins.length !== 5
  )
    throw new Error("phase1_pilot_gtin_evidence_incomplete")
  const combined = [...existingGtins, ...(newGtins as string[])]
  if (new Set(combined).size !== 27)
    throw new Error(`phase1_pilot_gtin_overlap:${combined.length}:${new Set(combined).size}`)
  const content = {
    schema_version: "scanner-phase1-pilot-manifest-v1" as const,
    source: {
      phase1a_content_fingerprint: input.phase1a.content_fingerprint,
      phase1b_content_fingerprint: input.phase1b.content_fingerprint,
      research_only: true as const,
      note: "This is an exact research-only pilot manifest. No product is catalog-intake-ready or scan-result-ready until full Product Intake evidence, classification, human review, an approved publish batch, and post-publish verification complete.",
    },
    totals: {
      existing_products: 20 as const,
      new_products: 5 as const,
      total_products: 25 as const,
      existing_canonical_gtins: 22 as const,
      new_canonical_gtins: 5 as const,
      unique_canonical_gtins: 27 as const,
    },
    existing,
    new: newest,
  }
  return { generated_at: input.generatedAt, ...content, content_fingerprint: fingerprint(content) }
}

function main() {
  const root = process.cwd()
  const file = (name: string) =>
    JSON.parse(readFileSync(join(root, "data/scanner-catalog-coverage/2026-08-26", name), "utf8"))
  const required = [
    "retailer-core-candidates.json",
    "retailer-specialist-candidates.json",
    "new-pilot-research.json",
    "phase1a-existing-ledger.json",
  ]
  if (
    required.some(
      (name) => !existsSync(join(root, "data/scanner-catalog-coverage/2026-08-26", name)),
    )
  )
    throw new Error("phase1b_inputs_missing")
  const generatedAt = new Date().toISOString()
  const ledger = buildPhase1bLedger({
    core: file("retailer-core-candidates.json"),
    specialist: file("retailer-specialist-candidates.json"),
    pilotResearch: file("new-pilot-research.json"),
    generatedAt,
  })
  const manifest = buildPilotManifest({
    phase1a: file("phase1a-existing-ledger.json"),
    phase1b: ledger,
    generatedAt,
  })
  writeFileSync(join(root, OUTPUT_PATH), `${JSON.stringify(ledger, null, 2)}\n`)
  writeFileSync(join(root, PILOT_OUTPUT_PATH), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(
    `${JSON.stringify({ ledger_path: OUTPUT_PATH, selected_products: ledger.rows.length, ledger_content_fingerprint: ledger.content_fingerprint, pilot_manifest_path: PILOT_OUTPUT_PATH, pilot_content_fingerprint: manifest.content_fingerprint })}\n`,
  )
}

if ((process.argv[1] ?? "").endsWith("build-phase1b-ledger.ts")) main()
