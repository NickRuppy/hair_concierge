import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { BaselineProduct, LiveBaseline } from "./live-baseline-export"
import type { ReadinessBaseline, ReadinessCandidate } from "./readiness-export"

const OUTPUT_PATH = "data/scanner-catalog-coverage/2026-08-26/phase1a-existing-ledger.json"

export const PHASE_1A_TARGETS = {
  shampoo: 32,
  conditioner: 18,
  mask: 12,
  leave_in: 13,
  oil: 10,
  dry_shampoo: 9,
  heat_protectant: 0,
  deep_cleansing_shampoo: 5,
  scalp_care: 0,
  bondbuilder: 3,
} as const

type Phase1aCategory = keyof typeof PHASE_1A_TARGETS
type PilotPackage = { size: string; gtin: string; canonical_gtin14: string; sources: string[] }
type PilotResearchProduct = {
  product_id: string
  category_key: Phase1aCategory
  brand: string
  name: string
  packages: PilotPackage[]
}
type PilotResearch = {
  schema_version: string
  research_id: string
  ownership_checked_at: string
  ownership_scope: string
  research_only: boolean
  products: PilotResearchProduct[]
}

export type Phase1aRow = {
  product_id: string
  category_key: Phase1aCategory
  inclusion_rank: number
  wave: "pilot" | "backfill"
  gtin_research_status: "evidence_backed_pilot" | "not_started"
  identity: BaselineProduct["identity"]
  priority_signals: {
    current_retailer_route: "dm" | "rossmann" | "mueller" | null
    affiliate_route: string | null
    purchase_link_status: string | null
    price_eur: number | string | null
    image_url_present: boolean
    is_chaarlie_recommended: boolean
  }
  catalog_readiness: {
    strict_status: "ready_for_ean_research"
    strict_blockers: string[]
    strict_verdicts: ReadinessCandidate["verdicts"]
    static_blockers: string[]
    has_category_facts: boolean
    has_protocol: boolean
    has_barcode: boolean
    has_disposition: boolean
  }
  category_primary_facts: BaselineProduct["category_primary_facts"]
  protocols: BaselineProduct["protocols"]
  pilot_gtin_evidence: {
    packages: PilotPackage[]
    ownership_check: { checked_at: string; scope: string; research_only: boolean }
  } | null
}

export type Phase1aLedger = {
  schema_version: "scanner-phase1a-existing-ledger-v1"
  generated_at: string
  source: {
    live_baseline_content_fingerprint: string
    readiness_baseline_content_fingerprint: string
    pilot_research_id: string
    research_only: true
    note: string
  }
  targets: typeof PHASE_1A_TARGETS
  reconciliation: {
    selected_products: number
    by_category: Record<
      Phase1aCategory,
      { target: number; selected: number; pilot: number; backfill: number }
    >
  }
  rows: Phase1aRow[]
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

export function fingerprint(
  content: Omit<Phase1aLedger, "generated_at" | "content_fingerprint">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(content)))
    .digest("hex")
}

function retailerRoute(url: string | null): "dm" | "rossmann" | "mueller" | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "dm.de" || host.endsWith(".dm.de")) return "dm"
    if (host === "rossmann.de" || host.endsWith(".rossmann.de")) return "rossmann"
    if (host === "mueller.de" || host.endsWith(".mueller.de")) return "mueller"
  } catch {
    /* sanitized routes are expected, but an invalid route cannot receive retailer priority */
  }
  return null
}

function staticBlockers(product: BaselineProduct): string[] {
  const blockers: string[] = []
  if (product.readiness.has_barcode) blockers.push("already_has_barcode")
  if (product.disposition) blockers.push(`disposition:${product.disposition.disposition}`)
  if (!product.readiness.has_category_facts) blockers.push("missing_category_facts")
  if (!product.readiness.has_protocol) blockers.push("missing_required_protocol")
  return blockers
}

function compareCandidates(left: BaselineProduct, right: BaselineProduct): number {
  const leftRoute = retailerRoute(left.commercial.affiliate_link)
  const rightRoute = retailerRoute(right.commercial.affiliate_link)
  const routeRank = (route: ReturnType<typeof retailerRoute>) => (route === null ? 1 : 0)
  const first = routeRank(leftRoute) - routeRank(rightRoute)
  if (first !== 0) return first
  const availableRank = (value: string | null) => (value === "available" ? 0 : 1)
  const second =
    availableRank(left.commercial.purchase_link_status) -
    availableRank(right.commercial.purchase_link_status)
  if (second !== 0) return second
  const third =
    Number(right.recommendation.is_chaarlie_recommended) -
    Number(left.recommendation.is_chaarlie_recommended)
  if (third !== 0) return third
  return `${left.identity.canonical_brand ?? ""}\u0000${left.identity.clean_name ?? ""}\u0000${left.product_id}`.localeCompare(
    `${right.identity.canonical_brand ?? ""}\u0000${right.identity.clean_name ?? ""}\u0000${right.product_id}`,
  )
}

function toRow(
  product: BaselineProduct,
  readiness: ReadinessCandidate,
  category: Phase1aCategory,
  inclusionRank: number,
  pilot: PilotResearchProduct | undefined,
  research: PilotResearch,
): Phase1aRow {
  const route = retailerRoute(product.commercial.affiliate_link)
  return {
    product_id: product.product_id,
    category_key: category,
    inclusion_rank: inclusionRank,
    wave: pilot ? "pilot" : "backfill",
    gtin_research_status: pilot ? "evidence_backed_pilot" : "not_started",
    identity: product.identity,
    priority_signals: {
      current_retailer_route: route,
      affiliate_route: product.commercial.affiliate_link,
      purchase_link_status: product.commercial.purchase_link_status,
      price_eur: product.commercial.price_eur,
      image_url_present: product.image.image_url_present,
      is_chaarlie_recommended: product.recommendation.is_chaarlie_recommended,
    },
    catalog_readiness: {
      strict_status: "ready_for_ean_research",
      strict_blockers: readiness.blockers,
      strict_verdicts: readiness.verdicts,
      static_blockers: staticBlockers(product),
      has_category_facts: product.readiness.has_category_facts,
      has_protocol: product.readiness.has_protocol,
      has_barcode: product.readiness.has_barcode,
      has_disposition: product.disposition !== null,
    },
    category_primary_facts: product.category_primary_facts,
    protocols: product.protocols,
    pilot_gtin_evidence: pilot
      ? {
          packages: pilot.packages,
          ownership_check: {
            checked_at: research.ownership_checked_at,
            scope: research.ownership_scope,
            research_only: research.research_only,
          },
        }
      : null,
  }
}

export function buildPhase1aLedger(input: {
  baseline: LiveBaseline
  readiness: ReadinessBaseline
  pilotResearch: PilotResearch
  generatedAt: string
}): Phase1aLedger {
  const seedByProduct = new Map(input.pilotResearch.products.map((item) => [item.product_id, item]))
  if (seedByProduct.size !== 20)
    throw new Error(`phase1a_pilot_expected_20_products:${seedByProduct.size}`)
  const baselineByProduct = new Map(input.baseline.products.map((item) => [item.product_id, item]))
  const readinessByProduct = new Map(
    input.readiness.candidates.map((item) => [item.product_id, item]),
  )
  for (const seed of input.pilotResearch.products) {
    const current = baselineByProduct.get(seed.product_id)
    if (!current) throw new Error(`phase1a_pilot_missing_from_baseline:${seed.product_id}`)
    if (current.identity.category_key !== seed.category_key)
      throw new Error(`phase1a_pilot_category_drift:${seed.product_id}`)
    const blockers = staticBlockers(current)
    if (blockers.length)
      throw new Error(`phase1a_pilot_blocked:${seed.product_id}:${blockers.join(",")}`)
    if (readinessByProduct.get(seed.product_id)?.status !== "ready_for_ean_research")
      throw new Error(`phase1a_pilot_not_strict_ready:${seed.product_id}`)
  }
  const rows: Phase1aRow[] = []
  for (const category of Object.keys(PHASE_1A_TARGETS) as Phase1aCategory[]) {
    const target = PHASE_1A_TARGETS[category]
    const pilot = input.pilotResearch.products
      .filter((item) => item.category_key === category)
      .sort((a, b) => a.product_id.localeCompare(b.product_id))
    if (pilot.length > target) throw new Error(`phase1a_pilot_exceeds_target:${category}`)
    const pilotIds = new Set(pilot.map((item) => item.product_id))
    const eligible = input.baseline.products
      .filter(
        (item) =>
          item.identity.category_key === category &&
          staticBlockers(item).length === 0 &&
          readinessByProduct.get(item.product_id)?.status === "ready_for_ean_research" &&
          !pilotIds.has(item.product_id),
      )
      .sort(compareCandidates)
    const needed = target - pilot.length
    if (eligible.length < needed)
      throw new Error(`phase1a_insufficient_eligible:${category}:${eligible.length}:${needed}`)
    const chosen = [
      ...pilot.map((item) => baselineByProduct.get(item.product_id)!),
      ...eligible.slice(0, needed),
    ]
    chosen.forEach((product, index) => {
      const readiness = readinessByProduct.get(product.product_id)
      if (!readiness || readiness.status !== "ready_for_ean_research")
        throw new Error(`phase1a_selected_not_strict_ready:${product.product_id}`)
      rows.push(
        toRow(
          product,
          readiness,
          category,
          index + 1,
          seedByProduct.get(product.product_id),
          input.pilotResearch,
        ),
      )
    })
  }
  rows.sort((a, b) =>
    `${a.category_key}\u0000${String(a.inclusion_rank).padStart(3, "0")}\u0000${a.product_id}`.localeCompare(
      `${b.category_key}\u0000${String(b.inclusion_rank).padStart(3, "0")}\u0000${b.product_id}`,
    ),
  )
  const reconciliation = {
    selected_products: rows.length,
    by_category: Object.fromEntries(
      (Object.keys(PHASE_1A_TARGETS) as Phase1aCategory[]).map((category) => {
        const selected = rows.filter((row) => row.category_key === category)
        return [
          category,
          {
            target: PHASE_1A_TARGETS[category],
            selected: selected.length,
            pilot: selected.filter((row) => row.wave === "pilot").length,
            backfill: selected.filter((row) => row.wave === "backfill").length,
          },
        ]
      }),
    ) as Phase1aLedger["reconciliation"]["by_category"],
  }
  if (reconciliation.selected_products !== 102)
    throw new Error(`phase1a_expected_102_rows:${reconciliation.selected_products}`)
  const content = {
    schema_version: "scanner-phase1a-existing-ledger-v1" as const,
    source: {
      live_baseline_content_fingerprint: input.baseline.content_fingerprint,
      readiness_baseline_content_fingerprint: input.readiness.content_fingerprint,
      pilot_research_id: input.pilotResearch.research_id,
      research_only: true as const,
      note: "Selection is constrained to the stricter live readiness oracle. Every row remains research-only and is not scanner-ready until GTIN ownership and final intake publication checks pass.",
    },
    targets: PHASE_1A_TARGETS,
    reconciliation,
    rows,
  }
  return { generated_at: input.generatedAt, ...content, content_fingerprint: fingerprint(content) }
}

function main() {
  const baselinePath = join(
    process.cwd(),
    "data/scanner-catalog-coverage/2026-08-26/live-baseline.json",
  )
  const readinessPath = join(
    process.cwd(),
    "data/scanner-catalog-coverage/2026-08-26/readiness-baseline.json",
  )
  const pilotPath = join(
    process.cwd(),
    "data/scanner-catalog-coverage/2026-08-26/existing-pilot-research.json",
  )
  if (!existsSync(baselinePath) || !existsSync(readinessPath) || !existsSync(pilotPath))
    throw new Error("phase1a_inputs_missing")
  const ledger = buildPhase1aLedger({
    baseline: JSON.parse(readFileSync(baselinePath, "utf8")) as LiveBaseline,
    readiness: JSON.parse(readFileSync(readinessPath, "utf8")) as ReadinessBaseline,
    pilotResearch: JSON.parse(readFileSync(pilotPath, "utf8")) as PilotResearch,
    generatedAt: new Date().toISOString(),
  })
  const output = join(process.cwd(), OUTPUT_PATH)
  writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`)
  process.stdout.write(
    `${JSON.stringify({ path: OUTPUT_PATH, selected_products: ledger.reconciliation.selected_products, by_category: ledger.reconciliation.by_category, content_fingerprint: ledger.content_fingerprint })}\n`,
  )
}

if ((process.argv[1] ?? "").endsWith("build-phase1a-ledger.ts")) main()
