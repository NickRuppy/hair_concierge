import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "@/lib/personal-plan/products/contracts"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  matchCatalogProducts,
  toScanSearchResult,
  type CatalogSearchCandidate,
  type ScanSearchResult,
} from "@/lib/scan/catalog-search"
import { loadQuarantinedProductIds } from "@/lib/scan/catalog-eligibility"
import { captureScanException } from "@/lib/observability/scan"
import { createScanRoute, scanOk } from "@/lib/scan/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * `inventory-search.ts`'s `searchOwnedProductCatalog` is locked to one category (its
 * `OwnedProductCatalogSource.listActiveProducts` boundary has no production Supabase
 * implementation to call into either) — scan search spans all 10 categories at once, so
 * per the brief this drops to a direct query instead, sharing `catalog-search.ts`'s
 * identity-title matching and ranking with the mobile scan search service.
 */
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const MAX_RESULTS = 8
// Catalog sits around 348 active products today, well under this cap, so an in-Node
// filter over one page is fine. A full page means the catalog outgrew the cap and results
// are computed over a partial catalog — reported as `truncated` (mirroring
// inventory-search.ts's `totalCapped`) rather than silently swallowed.
export const CANDIDATE_LOAD_LIMIT = 1000

export type ScanSearchResponse = {
  results: ScanSearchResult[]
  /** The candidate page came back full, so matching ran over a partial catalog. */
  truncated: boolean
}

export type { ScanSearchResult }

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

export type ScanSearchRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  search: (client: SupabaseClient, query: string) => Promise<ScanSearchResponse>
  captureScanException?: typeof captureScanException
}

const querySchema = z
  .object({ q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) })
  .strict()

export function createScanSearchRouteHandler(deps: ScanSearchRouteDeps) {
  return createScanRoute<string>({
    route: "search",
    deps,
    // A too-short (or missing) query is a normal typing state, not a client error — the
    // handler answers it with empty results rather than parse rejecting the request.
    parse: async (request) => ({
      ok: true,
      body: new URL(request.url).searchParams.get("q") ?? "",
    }),
    failureReason: "search_failed",
    handler: async (ctx) => {
      const parsed = querySchema.safeParse({ q: ctx.body })
      if (!parsed.success) return scanOk({ results: [], truncated: false })

      const client = deps.createAdminClient()
      return scanOk(await deps.search(client, parsed.data.q))
    },
  })
}

export async function searchScanCatalog(
  client: SupabaseClient,
  query: string,
): Promise<ScanSearchResponse> {
  const [{ data, error }, quarantinedIds] = await Promise.all([
    client
      .from("products")
      .select(
        "id, name, brand, category_key, image_url, sort_order, brand_identity:brands(canonical_name), product_line:product_lines(canonical_name)",
      )
      .eq("is_active", true)
      .eq("lifecycle_status", "active")
      .in("category_key", PERSONAL_PLAN_PRODUCT_CATEGORIES)
      .limit(CANDIDATE_LOAD_LIMIT),
    loadQuarantinedProductIds(client),
  ])
  if (error) throw new Error("scan_search_catalog_unavailable")

  const rows = (data ?? []) as CandidateRow[]
  // Ruling R7: a disposition-quarantined product (personal_plan_product_search_dispositions)
  // never surfaces via scan search — same predicate personal_plan_create_or_reuse_user_product
  // enforces server-side (see catalog-eligibility.ts).
  const candidates: CatalogSearchCandidate[] = rows
    .filter((row) => !quarantinedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category_key: row.category_key,
      image_url: row.image_url,
      sort_order: row.sort_order,
      brand_identity: firstRelation(row.brand_identity),
      product_line: firstRelation(row.product_line),
    }))

  const matches = matchCatalogProducts(candidates, query)

  return {
    results: matches.slice(0, MAX_RESULTS).map(toScanSearchResult),
    truncated: rows.length === CANDIDATE_LOAD_LIMIT,
  }
}

export const GET = createScanSearchRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  search: searchScanCatalog,
})
