import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { productIntakeCategorySchema } from "@/lib/product-intake/schemas"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import { OPEN_SUBMISSION_STATUSES, submitScanProductIntake } from "@/lib/product-intake/submissions"
import { gtinQueryVariants } from "@/lib/product-identity/normalize"
import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { MobileError } from "./errors"
import { saveMobileHistory } from "./history-service"
import { loadMobileProfile } from "./profile-service"
import { resolveMobileScan } from "./scan-service"
import { resolveRetailerEnrichment } from "@/lib/scan/enrichment/resolve-enrichment"

export const mobileScanSubmitSchema = z
  .object({
    identifier: z
      .object({ type: z.literal("ean"), value: z.string().trim().min(1).max(64) })
      .strict(),
    category: productIntakeCategorySchema,
    retailerMatchDecision: z.enum(["accepted", "rejected"]).optional(),
  })
  .strict()

const defaultDependencies = {
  loadProfile: loadMobileProfile,
  createRepository: createSupabaseProductIntakeRepository,
  submit: submitScanProductIntake,
  eligible: filterScanEligibleProductIds,
  resolve: resolveMobileScan,
  resolveRetailerEnrichment,
  save: saveMobileHistory,
  async findOpen(client: SupabaseClient, userId: string, barcode: string): Promise<string | null> {
    const { data, error } = await client
      .from("product_submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "scan")
      .in("scanned_identifier_value", gtinQueryVariants(barcode))
      .in("status", OPEN_SUBMISSION_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new MobileError("temporarily_unavailable", 503)
    return data?.id ?? null
  },
  /**
   * This marker outlives the optional, user-clearable History row. The guarded
   * database function makes concurrent mobile submits idempotent and verifies
   * that the request belongs to this account's barcode scan.
   */
  async markMobileResultRequested(client: SupabaseClient, userId: string, submissionId: string) {
    const { data, error } = await client.rpc("mobile_research_request_result", {
      p_user_id: userId,
      p_submission_id: submissionId,
    })
    if (error || data !== true) throw new MobileError("temporarily_unavailable", 503)
  },
}
export type MobileScanSubmitDependencies = typeof defaultDependencies

export async function submitMobileScan(
  client: SupabaseClient,
  userId: string,
  input: z.infer<typeof mobileScanSubmitSchema>,
  dependencies: Partial<MobileScanSubmitDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies }
  const validation = validateEanInput(input.identifier.value)
  if (!validation.ok) throw new MobileError("invalid_identifier", 400)
  const profile = await deps.loadProfile(client, userId)
  if (profile.status !== "ready") throw new MobileError("profile_required", 409)
  const existing = await deps.findOpen(client, userId, validation.value)
  if (existing) {
    await deps.markMobileResultRequested(client, userId, existing)
    return {
      contractVersion: 1 as const,
      kind: "pending_submission" as const,
      submissionId: existing,
      headline: "In Prüfung",
      historySaved: await deps.save(client, userId, validation.value, null, existing),
    }
  }
  // Supplemental retailer evidence never blocks a category-confirmed submission.
  let enrichment = null
  if (input.retailerMatchDecision !== "rejected") {
    try {
      enrichment = (await deps.resolveRetailerEnrichment(validation.value, { route: "submit" }))
        .enrichment
    } catch {
      enrichment = null
    }
  }
  const result = await deps.submit({
    userId,
    repository: deps.createRepository(client),
    enrichment,
    retailerMatchDecision: input.retailerMatchDecision,
    input: {
      intake_method: "manual",
      category: input.category,
      frequency_range: null,
      // One mobile spelling also makes concurrent EAN8 / padded-EAN13 submits
      // collide in the existing raw-value unique index. History retains exact EAN.
      scannedIdentifier: { type: "ean", value: validation.value.padStart(13, "0") },
      replace_existing_confirmed: false,
    },
    isMatchScanEligible: async (productId) => {
      if (!(await deps.eligible(client, [productId])).has(productId)) return false
      const current = await deps.resolve(client, profile.context, { productId })
      // Active catalog rows with missing research facts still need a real request.
      if (current.kind === "submission_required") return false
      if (
        current.kind === "retryable_error" ||
        current.kind === "profile_required" ||
        (current.kind === "authority_unavailable" && current.reason === "temporarily_unavailable")
      )
        throw new MobileError("temporarily_unavailable", 503)
      return true
    },
  })
  if (result.kind === "already_in_catalog")
    return {
      contractVersion: 1 as const,
      kind: "already_in_catalog" as const,
      productId: result.productId,
      historySaved: await deps.save(client, userId, validation.value, result.productId),
    }
  await deps.markMobileResultRequested(client, userId, result.submission.id)
  return {
    contractVersion: 1 as const,
    kind: "pending_submission" as const,
    submissionId: result.submission.id,
    headline: "In Prüfung",
    historySaved: await deps.save(client, userId, validation.value, null, result.submission.id),
  }
}
