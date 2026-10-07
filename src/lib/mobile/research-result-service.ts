import type { SupabaseClient } from "@supabase/supabase-js"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { MobileError } from "./errors"
import { loadMobileProfile } from "./profile-service"
import { resolveMobileScan } from "./scan-service"

type Submission = {
  id: string
  source: string
  status: string
  scanned_identifier_value: string | null
  approved_product_id: string | null
  mobile_result_requested_at: string | null
}

const defaultDependencies = {
  loadProfile: loadMobileProfile,
  resolve: resolveMobileScan,
  async loadSubmission(client: SupabaseClient, userId: string, submissionId: string) {
    const { data, error } = await client
      .from("product_submissions")
      .select(
        "id,source,status,scanned_identifier_value,approved_product_id,mobile_result_requested_at",
      )
      .eq("id", submissionId)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw new MobileError("temporarily_unavailable", 503)
    return (data ?? null) as Submission | null
  },
}
export type MobileResearchResultDependencies = typeof defaultDependencies

/**
 * The same fail-closed decision guards message eligibility and opening its
 * destination. It never returns a verdict snapshot from an approval event.
 */
export async function resolveMobileResearchResult(
  client: SupabaseClient,
  userId: string,
  submissionId: string,
  dependencies: Partial<MobileResearchResultDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies }
  const submission = await deps.loadSubmission(client, userId, submissionId)
  if (!submission) return { kind: "not_found" as const }
  const barcode = submission.scanned_identifier_value
  if (
    submission.source !== "scan" ||
    !submission.mobile_result_requested_at ||
    !barcode ||
    !validateEanInput(barcode).ok ||
    !submission.approved_product_id ||
    !["approved", "matched_existing"].includes(submission.status)
  )
    return { kind: "not_ready" as const }
  const profile = await deps.loadProfile(client, userId)
  if (profile.status !== "ready") return { kind: "not_ready" as const }
  const result = await deps.resolve(client, profile.context, {
    identifier: { type: "ean", value: barcode },
  })
  if (
    (result.kind !== "assessment" && result.kind !== "not_needed") ||
    result.product.id !== submission.approved_product_id
  )
    return { kind: "not_ready" as const }
  return { kind: "ready" as const, result }
}
