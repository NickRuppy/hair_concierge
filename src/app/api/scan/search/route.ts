import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import { loadQuarantinedProductIds } from "@/lib/scan/catalog-eligibility"
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
// filter over one page is fine. If the catalog ever approaches 1000 rows this silently
// truncates instead of erroring — worth adding a `totalCapped`-style truncation signal
// (mirroring inventory-search.ts's `totalCapped`) before that happens.
const CANDIDATE_LOAD_LIMIT = 1000

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
  search: (client: SupabaseClient, query: string) => Promise<ScanSearchResult[]>
}

const querySchema = z
  .object({ q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) })
  .strict()

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function createScanSearchRouteHandler(deps: ScanSearchRouteDeps) {
  return async function GET(request: Request) {
    const userId = await deps.getUserId()
    if (!userId) return fail("unauthorized", 401)

    const limited = await deps.checkRateLimit(userId, SCAN_RATE_LIMIT)
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      return fail(
        unavailable ? "temporarily_unavailable" : "rate_limited",
        unavailable ? 503 : 429,
        unavailable ? undefined : { "Retry-After": "60" },
      )
    }

    const parsed = querySchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" })
    if (!parsed.success) {
      // A too-short query is a normal typing state, not a client error — empty results,
      // German copy for that state lives client-side per the brief.
      return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } })
    }

    try {
      const client = deps.createAdminClient()
      const results = await deps.search(client, parsed.data.q)
      return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      console.error("[scan] search failed", error)
      return fail("temporarily_unavailable", 503)
    }
  }
}

export async function searchScanCatalog(
  client: SupabaseClient,
  query: string,
): Promise<ScanSearchResult[]> {
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

  const normalizedQuery = query.toLocaleLowerCase()
  // Ruling R7: a disposition-quarantined product (personal_plan_product_search_dispositions)
  // never surfaces via scan search — same predicate personal_plan_create_or_reuse_user_product
  // enforces server-side (see catalog-eligibility.ts).
  const matches = ((data ?? []) as CandidateRow[]).filter(
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

  return matches.slice(0, MAX_RESULTS).map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category_key as PersonalPlanCategory,
    categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
    imageUrl: row.image_url,
  }))
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
