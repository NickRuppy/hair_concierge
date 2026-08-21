import { NextResponse } from "next/server"
import { z } from "zod"

import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import { suggestScanBrands } from "@/lib/scan/brand-suggestions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * Brand typeahead for the unknown-product intake (mirrors `/api/scan/search`'s shape:
 * GET + `?q=`, auth, shared scan rate limit, deps-injected handler). Suggestions come
 * from the catalog's `brands` table via `suggestScanBrands`.
 */
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120

export type ScanBrandsRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  suggest: typeof suggestScanBrands
}

const querySchema = z
  .object({ q: z.string().trim().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH) })
  .strict()

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function createScanBrandsRouteHandler(deps: ScanBrandsRouteDeps) {
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
      // A too-short query is a normal typing state, not a client error.
      return NextResponse.json({ brands: [] }, { headers: { "Cache-Control": "no-store" } })
    }

    try {
      const client = deps.createAdminClient()
      const brands = await deps.suggest(client, parsed.data.q)
      return NextResponse.json({ brands }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      console.error("[scan] brand suggestions failed", error)
      return fail("temporarily_unavailable", 503)
    }
  }
}

export const GET = createScanBrandsRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  suggest: suggestScanBrands,
})
