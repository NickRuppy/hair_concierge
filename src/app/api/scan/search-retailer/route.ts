import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "@/lib/personal-plan/products/contracts"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { checkRateLimit, SCAN_RETAILER_SEARCH_RATE_LIMIT } from "@/lib/rate-limit"
import {
  toScanSearchResult,
  type CatalogSearchCandidate,
  type ScanSearchResult,
} from "@/lib/scan/catalog-search"
import { loadQuarantinedProductIdsAmong } from "@/lib/scan/catalog-eligibility"
import {
  createDmMcpClient,
  DmMcpError,
  type DmProductDetailsRow,
} from "@/lib/scan/enrichment/dm-mcp-client"
import { isRetailerSearchEnabled, retailerEnrichmentTimeoutMs } from "@/lib/scan/enrichment/flag"
import { suggestCategoryFromRetailerName } from "@/lib/scan/enrichment/suggest-category"
import { scanRetailerBrandLabel } from "@/lib/scan/verdict-labels"
import { captureScanException, reportRetailerSearchOutcome } from "@/lib/observability/scan"
import { createScanRoute, scanOk } from "@/lib/scan/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * `GET /api/scan/search-retailer`: name-search across dm's live catalog (task 3, plan
 * Rev. 6 §8). Unlike `/api/scan/search` (a text match over our own catalog table), the
 * only source of rows here is dm's `searchProducts` — a hit is then partitioned into
 * `catalog` (its GTIN resolves to one of our eligible catalog products) or `retailer`
 * (a hair-relevant dm-only row) by GTIN lookup against `product_identifiers`. There is no
 * separate identity-title catalog query, so a dm outage legitimately empties both arrays
 * rather than degrading to a partial catalog-only response.
 */
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const RETAILER_CAP = 8

// Mirrors identifier-lookup.ts's (non-exported) `BARCODE_IDENTIFIER_TYPES` — the three
// barcode-shaped identifier types the catalog stores; scan treats them interchangeably.
const BARCODE_IDENTIFIER_TYPES = ["ean", "gtin", "barcode"] as const

export type ScanRetailerResult = {
  gtin: string
  name: string
  brand: string | null
  categoryLabel: string | null
}

export type ScanRetailerSearchResponse = {
  catalog: ScanSearchResult[]
  retailer: ScanRetailerResult[]
  retailerOutcome: "ok" | "disabled" | "unavailable"
}

export type { ScanSearchResult }

const querySchema = z
  .object({ q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) })
  .strict()

const DISABLED_RESPONSE: ScanRetailerSearchResponse = {
  catalog: [],
  retailer: [],
  retailerOutcome: "disabled",
}

const EMPTY_OK_RESPONSE: ScanRetailerSearchResponse = {
  catalog: [],
  retailer: [],
  retailerOutcome: "ok",
}

export type ScanRetailerSearchRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  isRetailerSearchEnabled: typeof isRetailerSearchEnabled
  retailerEnrichmentTimeoutMs: typeof retailerEnrichmentTimeoutMs
  searchDmProducts: (query: string, deadlineMs: number) => Promise<DmProductDetailsRow[]>
  partitionDmSearchRows: typeof partitionDmSearchRows
  reportRetailerSearchOutcome?: typeof reportRetailerSearchOutcome
  captureScanException?: typeof captureScanException
  /** Injection seam for deterministic duration telemetry in tests. */
  now?: () => number
}

export function createScanRetailerSearchRouteHandler(deps: ScanRetailerSearchRouteDeps) {
  return createScanRoute<string>({
    route: "search-retailer",
    deps,
    // F2: the lane now auto-fires per typing pause — its own bucket, not the shared one.
    rateLimit: SCAN_RETAILER_SEARCH_RATE_LIMIT,
    // A too-short/too-long/missing query is a normal typing state, not a client error —
    // mirrors `/api/scan/search`'s parse, which always succeeds and defers bounds
    // checking to the handler.
    parse: async (request) => ({
      ok: true,
      body: new URL(request.url).searchParams.get("q") ?? "",
    }),
    failureReason: "search_retailer_failed",
    handler: async (ctx) => {
      if (!deps.isRetailerSearchEnabled()) return scanOk(DISABLED_RESPONSE)

      const parsedQuery = querySchema.safeParse({ q: ctx.body })
      if (!parsedQuery.success) return scanOk(EMPTY_OK_RESPONSE)

      const clock = deps.now ?? (() => performance.now())
      const startedAt = clock()
      const deadlineMs = deps.retailerEnrichmentTimeoutMs()
      const report = deps.reportRetailerSearchOutcome ?? reportRetailerSearchOutcome

      let dmRows: DmProductDetailsRow[]
      try {
        dmRows = await deps.searchDmProducts(parsedQuery.data.q, deadlineMs)
      } catch (error) {
        const durationMs = Math.max(0, Math.round(clock() - startedAt))
        report({
          outcome: error instanceof DmMcpError ? error.reason : "unexpected",
          durationMs,
          catalogCount: 0,
          retailerCount: 0,
        })
        return scanOk({ catalog: [], retailer: [], retailerOutcome: "unavailable" })
      }
      const durationMs = Math.max(0, Math.round(clock() - startedAt))

      const client = deps.createAdminClient()
      const { catalog, retailer } = await deps.partitionDmSearchRows(client, dmRows)

      report({
        outcome: "ok",
        durationMs,
        catalogCount: catalog.length,
        retailerCount: retailer.length,
      })
      return scanOk({ catalog, retailer, retailerOutcome: "ok" })
    },
  })
}

export type ScanRetailerSearchPartition = {
  catalog: ScanSearchResult[]
  retailer: ScanRetailerResult[]
}

type CandidateRelation = { canonical_name: string | null }

type CandidateRow = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  sort_order: number | null
  brand_identity: CandidateRelation | CandidateRelation[] | null
  product_line: CandidateRelation | CandidateRelation[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

/**
 * Amended contract: `ScanRetailerResult.gtin` must be the resolve-compatible EAN
 * representation, not the internal canonical GTIN-14 — the search sheet feeds it
 * verbatim into `/api/scan/resolve`, whose `validateEanInput` accepts only 8- or
 * 13-digit values. Mirrors the variant expansion in `normalize.ts`'s
 * `gtinQueryVariants` (the 8/13 legs only — resolve never accepts a bare 12-digit UPC):
 * six leading zeros → the 8-digit EAN-8 body; at least one leading zero → the 13-digit
 * EAN-13 form (a 12-digit UPC-A canonicalizes with two leading zeros, so this leg also
 * covers it, zero-extended). A true GTIN-14 (non-zero indicator digit) has no EAN
 * form — returns null so the caller drops that row entirely (fail closed).
 */
function canonicalGtinToResolvableEan(canonicalGtin: string): string | null {
  if (canonicalGtin.slice(0, 6) === "000000") return canonicalGtin.slice(6)
  if (canonicalGtin.slice(0, 1) === "0") return canonicalGtin.slice(1)
  return null
}

type IdentifierRow = { product_id: string; canonical_gtin14: string }

/**
 * Partitions dm `searchProducts` rows into eligible catalog matches and hair-relevant
 * dm-only rows, per plan §4/§8's GTIN boundary policy, partition eligibility contract and
 * hair-relevant filter. Exported for direct unit testing against a stub Supabase client,
 * matching `searchScanCatalog`'s convention in `/api/scan/search`.
 */
export async function partitionDmSearchRows(
  client: SupabaseClient,
  dmRows: DmProductDetailsRow[],
): Promise<ScanRetailerSearchPartition> {
  // GTIN boundary policy: all-digit values shorter than 12 are left-padded to 12 before
  // the unchanged global `canonicalizeGtin` runs (recovers a leading zero dm's search
  // response sometimes drops); rows that still fail (bad checksum, missing gtin) are
  // dropped. Duplicate canonical GTINs keep the first (best-ranked, i.e. dm's own order).
  const seenGtins = new Set<string>()
  const canonicalRows: Array<{ canonicalGtin: string; row: DmProductDetailsRow }> = []
  for (const row of dmRows) {
    const raw = row.gtin
    if (typeof raw !== "string") continue
    const padded = /^\d+$/.test(raw) && raw.length < 12 ? raw.padStart(12, "0") : raw
    const canonicalGtin = canonicalizeGtin(padded)
    if (!canonicalGtin || seenGtins.has(canonicalGtin)) continue
    seenGtins.add(canonicalGtin)
    canonicalRows.push({ canonicalGtin, row })
  }
  if (canonicalRows.length === 0) return { catalog: [], retailer: [] }

  const canonicalGtins = canonicalRows.map((entry) => entry.canonicalGtin)

  // Partition eligibility (mirrors the fail-closed reading in identifier-lookup.ts): a
  // dm GTIN maps to `catalog` only when its `product_identifiers` row resolves to exactly
  // one product. An ambiguous (>1) or dangling (0) mapping is never checked for
  // quarantine/eligibility — it simply falls through to the dm-only path below.
  const { data: identifierData, error: identifierError } = await client
    .from("product_identifiers")
    .select("product_id, canonical_gtin14")
    .in("canonical_gtin14", canonicalGtins)
    .in("identifier_type", BARCODE_IDENTIFIER_TYPES)
  if (identifierError) throw new Error("scan_search_retailer_identifier_lookup_failed")

  const productIdsByGtin = new Map<string, Set<string>>()
  for (const row of (identifierData ?? []) as IdentifierRow[]) {
    const set = productIdsByGtin.get(row.canonical_gtin14) ?? new Set<string>()
    set.add(row.product_id)
    productIdsByGtin.set(row.canonical_gtin14, set)
  }

  const singleCandidateIds = new Set<string>()
  for (const set of productIdsByGtin.values()) {
    if (set.size === 1) singleCandidateIds.add([...set][0])
  }
  const candidateIds = [...singleCandidateIds]

  const [quarantinedIds, eligibleCandidates] = await Promise.all([
    loadQuarantinedProductIdsAmong(client, candidateIds),
    loadEligibleCatalogCandidates(client, candidateIds),
  ])

  const catalog: ScanSearchResult[] = []
  const retailer: ScanRetailerResult[] = []

  for (const { canonicalGtin, row } of canonicalRows) {
    const productIds = productIdsByGtin.get(canonicalGtin)
    const singleProductId = productIds && productIds.size === 1 ? [...productIds][0] : null

    // Ruling R7 exception: a quarantined product's GTIN is dropped entirely, never
    // surfaced as either a catalog match or a dm-only row.
    if (singleProductId && quarantinedIds.has(singleProductId)) continue

    const eligibleCandidate = singleProductId ? eligibleCandidates.get(singleProductId) : undefined
    if (eligibleCandidate) {
      catalog.push(toScanSearchResult(eligibleCandidate))
      continue
    }

    // dm-only: keep only hair-relevant rows (household/food/non-hair cosmetics dropped).
    const title = row.title ?? ""
    const dmCategory = row.category ?? ""
    const suggestedCategory = suggestCategoryFromRetailerName(title)
    if (!/haar/i.test(dmCategory) && suggestedCategory === null) continue

    // The outward `gtin` must be resolve-compatible: `/api/scan/resolve`'s
    // `validateEanInput` only accepts 8/13-digit EAN values, never the internal
    // canonical GTIN-14. A true GTIN-14 (non-zero indicator digit) has no EAN
    // representation at all — fail closed and drop the row rather than surface a value
    // the next tap could never resolve.
    const resolvableGtin = canonicalGtinToResolvableEan(canonicalGtin)
    if (!resolvableGtin) continue

    retailer.push({
      gtin: resolvableGtin,
      name: title,
      brand: row.brand ? scanRetailerBrandLabel(row.brand) : null,
      categoryLabel: suggestedCategory ? CATEGORY_COPY[suggestedCategory].label : null,
    })
  }

  return { catalog, retailer: retailer.slice(0, RETAILER_CAP) }
}

async function loadEligibleCatalogCandidates(
  client: SupabaseClient,
  productIds: string[],
): Promise<Map<string, CatalogSearchCandidate>> {
  if (productIds.length === 0) return new Map()
  // Same predicates `searchScanCatalog` applies: is_active, lifecycle_status='active',
  // category in PERSONAL_PLAN_PRODUCT_CATEGORIES; quarantine is checked separately above.
  const { data, error } = await client
    .from("products")
    .select(
      "id, name, brand, category_key, image_url, sort_order, brand_identity:brands(canonical_name), product_line:product_lines(canonical_name)",
    )
    .in("id", productIds)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .in("category_key", PERSONAL_PLAN_PRODUCT_CATEGORIES)
  if (error) throw new Error("scan_search_retailer_catalog_lookup_failed")

  const map = new Map<string, CatalogSearchCandidate>()
  for (const row of (data ?? []) as CandidateRow[]) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      brand: row.brand,
      category_key: row.category_key,
      image_url: row.image_url,
      sort_order: row.sort_order,
      brand_identity: firstRelation(row.brand_identity),
      product_line: firstRelation(row.product_line),
    })
  }
  return map
}

export const GET = createScanRetailerSearchRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  isRetailerSearchEnabled,
  retailerEnrichmentTimeoutMs,
  searchDmProducts: (query, deadlineMs) => createDmMcpClient({ deadlineMs }).searchProducts(query),
  partitionDmSearchRows,
  reportRetailerSearchOutcome,
})
