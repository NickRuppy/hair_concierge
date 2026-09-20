import type { SupabaseClient } from "@supabase/supabase-js"

import { gtinQueryVariants } from "@/lib/product-identity/normalize"
import { OPEN_SUBMISSION_STATUSES } from "@/lib/product-intake/submissions"

export type ScanOpenSubmissionStatus = (typeof OPEN_SUBMISSION_STATUSES)[number]

export type ScanPendingSubmission = {
  submissionId: string
  status: ScanOpenSubmissionStatus
} | null

type OpenSubmissionRow = { id: string; status: ScanOpenSubmissionStatus }

/**
 * The `scanned_identifier_value` column this queries is created in Task 3 — written now
 * against that contract; tests stub the client, so no live schema is required here.
 */
export async function findOpenScanSubmission(
  client: SupabaseClient,
  userId: string,
  normalizedValue: string,
): Promise<ScanPendingSubmission> {
  // Stored submissions hold whatever spelling the scanner sent at submission time;
  // match every GTIN spelling of the same number (mirrors the catalog lookup).
  const queryValues = gtinQueryVariants(normalizedValue)

  const { data, error } = await client
    .from("product_submissions")
    .select("id, status")
    .eq("user_id", userId)
    .in("scanned_identifier_value", queryValues)
    .in("status", OPEN_SUBMISSION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("scan_pending_submission_lookup_failed")
  if (!data) return null

  const row = data as OpenSubmissionRow
  return { submissionId: row.id, status: row.status }
}

/**
 * The name-lane sibling of `findOpenScanSubmission` (Task 5): reloads the open name-only
 * scan submission `idx_product_submissions_one_open_scan_name` (migration
 * 20260920160000) permits for this user + category + brand/name identity, if there is
 * one. The scan submit route uses it to answer a lost insert race the same way the EAN
 * lane already does -- get-or-create instead of a 503.
 *
 * Matched in JS rather than via `.ilike()`: brand/product-name text can contain `%`/`_`,
 * which `ILIKE` would treat as wildcards. A user's own open name-only submissions in one
 * category is always a tiny result set, so filtering client-side after a narrow indexed
 * fetch mirrors the index's `lower(brand_text) = lower(product_name_text)` semantics
 * exactly, without that risk.
 */
export async function findOpenScanSubmissionByName(
  client: SupabaseClient,
  userId: string,
  category: string,
  brandText: string,
  productNameText: string,
): Promise<ScanPendingSubmission> {
  const { data, error } = await client
    .from("product_submissions")
    .select("id, status, brand_text, product_name_text")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("source", "scan")
    .is("scanned_identifier_value", null)
    .in("status", OPEN_SUBMISSION_STATUSES)
    .order("created_at", { ascending: false })
  if (error) throw new Error("scan_pending_submission_name_lookup_failed")

  const normalizedBrand = brandText.trim().toLowerCase()
  const normalizedName = productNameText.trim().toLowerCase()
  const rows = (data ?? []) as Array<
    OpenSubmissionRow & { brand_text: string | null; product_name_text: string | null }
  >
  const match = rows.find(
    (row) =>
      typeof row.brand_text === "string" &&
      typeof row.product_name_text === "string" &&
      row.brand_text.trim().toLowerCase() === normalizedBrand &&
      row.product_name_text.trim().toLowerCase() === normalizedName,
  )
  if (!match) return null
  return { submissionId: match.id, status: match.status }
}
