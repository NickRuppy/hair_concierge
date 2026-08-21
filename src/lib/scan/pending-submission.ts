import type { SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "@/lib/product-identity/normalize"
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
  // match the canonical GTIN form alongside it (mirrors the catalog lookup).
  const canonicalValue = canonicalizeGtin(normalizedValue)
  const queryValues = [...new Set([normalizedValue, canonicalValue].filter(Boolean))] as string[]

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
