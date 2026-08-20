import type { SupabaseClient } from "@supabase/supabase-js"

import type { ProductIntakeSubmissionRow } from "@/lib/product-intake/repository-types"

/**
 * The subset of `product_submissions.status` that means "still open, don't ask again" —
 * no shared named constant exists in `product-intake` today (checked repository-types.ts
 * and review-workflow.ts), so this is the scan feature's own copy of the status literals
 * the migrations already gate on (see 20260616120000/20260617120000).
 */
const SCAN_OPEN_SUBMISSION_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const satisfies readonly Extract<
  ProductIntakeSubmissionRow["status"],
  "pending_review" | "researching" | "ready_for_review" | "needs_more_info"
>[]

export type ScanOpenSubmissionStatus = (typeof SCAN_OPEN_SUBMISSION_STATUSES)[number]

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
  const { data, error } = await client
    .from("product_submissions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("scanned_identifier_value", normalizedValue)
    .in("status", SCAN_OPEN_SUBMISSION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("scan_pending_submission_lookup_failed")
  if (!data) return null

  const row = data as OpenSubmissionRow
  return { submissionId: row.id, status: row.status }
}
