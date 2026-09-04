import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import { checkRateLimit } from "@/lib/rate-limit"
import { loadQuarantinedProductIds } from "@/lib/scan/catalog-eligibility"
import { captureScanException } from "@/lib/observability/scan"
import { createScanRoute, scanOk } from "@/lib/scan/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * `inventory-search.ts`'s `searchOwnedProductCatalog` is locked to one category (its
 * `OwnedProductCatalogSource.listActiveProducts` boundary has no production Supabase
 * implementation to call into either) — scan search spans all 10 categories at once, so
 * per the brief this drops to a direct query instead, mirroring that module's matching
 * (substring over "brand name", case-insensitive) and ranking (exact label match first,
 * then name) rather than importing it.
 */
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const MAX_RESULTS = 8
// Catalog sits around 256 active products today, well under this cap, so an in-Node
// filter over one page is fine. A full page means the catalog outgrew the cap and results
// are computed over a partial catalog — reported as `truncated` (mirroring
// inventory-search.ts's `totalCapped`) rather than silently swallowed.
export const CANDIDATE_LOAD_LIMIT = 1000

export type ScanSearchResponse = {
  results: ScanSearchResult[]
  /** The candidate page came back full, so matching ran over a partial catalog. */
  truncated: boolean
}

export type ScanSearchResult = {
  id: string
  name: string
  brand: string | null
  category: PersonalPlanCategory
  categoryLabel: string
  imageUrl: string | null
}

type CandidateRow = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  sort_order: number | null
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
      .select("id, name, brand, category_key, image_url, sort_order")
      .eq("is_active", true)
      .eq("lifecycle_status", "active")
      .in("category_key", PERSONAL_PLAN_PRODUCT_CATEGORIES)
      .limit(CANDIDATE_LOAD_LIMIT),
    loadQuarantinedProductIds(client),
  ])
  if (error) throw new Error("scan_search_catalog_unavailable")

  const rows = (data ?? []) as CandidateRow[]
  const normalizedQuery = query.toLocaleLowerCase()
  // Ruling R7: a disposition-quarantined product (personal_plan_product_search_dispositions)
  // never surfaces via scan search — same predicate personal_plan_create_or_reuse_user_product
  // enforces server-side (see catalog-eligibility.ts).
  const matches = rows.filter(
    (row) =>
      !quarantinedIds.has(row.id) &&
      `${row.brand ?? ""} ${row.name}`.toLocaleLowerCase().includes(normalizedQuery),
  )

  matches.sort((left, right) => {
    const leftExact = isExactMatch(left, normalizedQuery)
    const rightExact = isExactMatch(right, normalizedQuery)
    if (leftExact !== rightExact) return leftExact ? -1 : 1
    return (
      (left.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (right.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name, "de") ||
      left.id.localeCompare(right.id)
    )
  })

  return {
    results: matches.slice(0, MAX_RESULTS).map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category_key as PersonalPlanCategory,
      categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
      imageUrl: row.image_url,
    })),
    truncated: rows.length === CANDIDATE_LOAD_LIMIT,
  }
}

function isExactMatch(row: CandidateRow, normalizedQuery: string): boolean {
  return `${row.brand ?? ""} ${row.name}`.trim().toLocaleLowerCase() === normalizedQuery
}

export const GET = createScanSearchRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  search: searchScanCatalog,
})
