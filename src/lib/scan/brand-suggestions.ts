import type { SupabaseClient } from "@supabase/supabase-js"

import { normalizeText } from "@/lib/product-identity/normalize"

const MIN_QUERY_LENGTH = 2
const MAX_SUGGESTIONS = 6
// Brand catalog sits around 50 rows today; one page covers it comfortably.
const CANDIDATE_LOAD_LIMIT = 200

type BrandRow = { id: string; canonical_name: string }

/**
 * Brand typeahead for the unknown-product intake: canonical brand names from the
 * catalog matching the query (case-/accent-insensitive), prefix matches ranked before
 * substring matches, capped at six. Filtering happens in Node over one small page —
 * mirrors `/api/scan/search`'s approach and keeps matching identical to the
 * product-identity normalization the catalog itself uses.
 */
export async function suggestScanBrands(client: SupabaseClient, query: string): Promise<string[]> {
  const normalizedQuery = normalizeText(query)
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return []

  const { data, error } = await client
    .from("brands")
    .select("id, canonical_name")
    .order("canonical_name")
    .limit(CANDIDATE_LOAD_LIMIT)
  if (error) throw new Error("scan_brand_suggestions_failed")

  const prefix: string[] = []
  const substring: string[] = []
  for (const row of (data ?? []) as BrandRow[]) {
    const normalizedName = normalizeText(row.canonical_name)
    if (normalizedName.startsWith(normalizedQuery)) prefix.push(row.canonical_name)
    else if (normalizedName.includes(normalizedQuery)) substring.push(row.canonical_name)
  }
  return [...prefix, ...substring].slice(0, MAX_SUGGESTIONS)
}
