import { z } from "zod"
import { after } from "next/server"

import {
  productIntakeCategorySchema,
  type ScanProductIntakeSubmissionInput,
} from "@/lib/product-intake/schemas"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import {
  submitScanProductIntake,
  type ProductIntakeRepository,
} from "@/lib/product-intake/submissions"
import type { ScanProductIntakeSubmissionResult } from "@/lib/product-intake/types"
import { checkRateLimit } from "@/lib/rate-limit"
import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
import { resolveRetailerEnrichment } from "@/lib/scan/enrichment/resolve-enrichment"
import { retailerEnrichmentTimeoutMs } from "@/lib/scan/enrichment/flag"
import type { RetailerLookupResult } from "@/lib/scan/enrichment/types"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { recordScanSubmitDmLookupEvent } from "@/lib/scan/submit-dm-event-log"
import { SCAN_PENDING_SUBMISSION_HEADLINE } from "@/lib/scan/verdict-labels"
import { captureScanException, reportRetailerLookupWarning } from "@/lib/observability/scan"
import { createScanRoute, parseJsonBody, scanFail, scanOk } from "@/lib/scan/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * v1 API surface only ever needs "ean" (ruling R9): the scanner emits ean_13/ean_8 and
 * manual entry is ean-only too. `scanProductIntakeIdentifierSchema` (product-intake/schemas.ts)
 * stays `ean|gtin|barcode` — that's the shared DB-side matching contract, unaffected — this
 * route just never accepts the other two from a client.
 */
const submitIdentifierSchema = z
  .object({ type: z.literal("ean"), value: z.string().trim().min(1) })
  .strict()

const submitBodySchema = z
  .object({
    identifier: submitIdentifierSchema,
    category: productIntakeCategorySchema,
    brandText: z.string().trim().min(1).max(200).optional(),
    productNameText: z.string().trim().min(1).max(240).optional(),
  })
  .strict()

export type ScanSubmitRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  validateEanInput: typeof validateEanInput
  createAdminClient: typeof createAdminClient
  createRepository: (admin: ReturnType<typeof createAdminClient>) => ProductIntakeRepository
  filterScanEligibleProductIds: typeof filterScanEligibleProductIds
  resolveRetailerEnrichment: typeof resolveRetailerEnrichment
  recordScanSubmitDmLookupEvent: typeof recordScanSubmitDmLookupEvent
  submit: typeof submitScanProductIntake
  captureScanException?: typeof captureScanException
  after?: (task: () => Promise<void> | void) => void
}

export function createScanSubmitRouteHandler(deps: ScanSubmitRouteDeps) {
  const runAfter = deps.after ?? after
  return createScanRoute<z.infer<typeof submitBodySchema>>({
    route: "submit",
    deps,
    parse: parseJsonBody(submitBodySchema),
    failureReason: "submit_failed",
    handler: async (ctx) => {
      // Same gate as `POST /api/scan/resolve`: the zod schema only proves the string is
      // non-empty, so without this a hand-rolled request could open a research submission
      // for a value that is not an EAN at all — and the submission is the row a reviewer
      // later attaches to the catalog. 400 `invalid_identifier` mirrors resolve exactly.
      const validation = deps.validateEanInput(ctx.body.identifier.value)
      if (!validation.ok) return scanFail("invalid_identifier", 400)

      const input: ScanProductIntakeSubmissionInput = {
        intake_method: "manual",
        category: ctx.body.category,
        // No invented data (ruling R8): scan's UI never asks for a use-frequency, and
        // submitScanProductIntake never reads/writes user_product_usage, so this stays a
        // genuine null all the way to product_submissions.frequency_range (migration
        // 20260820110000 relaxes that column's constraint for source='scan' only).
        frequency_range: null,
        brand_text: ctx.body.brandText,
        product_name_text: ctx.body.productNameText,
        scannedIdentifier: { type: "ean", value: validation.value },
        replace_existing_confirmed: false,
      }

      const lookupStarted = performance.now()
      let lookup: RetailerLookupResult
      try {
        lookup = await deps.resolveRetailerEnrichment(validation.value, { route: "submit" })
      } catch {
        // Lookup failure cannot block the user's category-confirmed submission.
        reportRetailerLookupWarning({ route: "submit", reason: "unexpected" })
        lookup = {
          enrichment: null,
          outcome: "unexpected",
          durationMs: Math.max(0, Math.round(performance.now() - lookupStarted)),
          deadlineMs: retailerEnrichmentTimeoutMs(),
        }
      }

      const admin = deps.createAdminClient()
      const lookupEvent = {
        outcome: lookup.outcome,
        durationMs: lookup.durationMs,
        deadlineMs: lookup.deadlineMs,
        createdAt: new Date().toISOString(),
      }
      const recordLookup = () =>
        deps.recordScanSubmitDmLookupEvent(
          admin,
          lookupEvent,
          deps.captureScanException ?? captureScanException,
        )
      try {
        // The lookup is part of the submission response, but diagnostic storage is not.
        runAfter(recordLookup)
      } catch {
        // No request-scoped waitUntil: still attempt the fail-open writer without delaying submit.
        console.warn("[scan] submit dm telemetry scheduling failed")
        void Promise.resolve()
          .then(recordLookup)
          .catch(() => console.warn("[scan] submit dm telemetry fallback failed"))
      }
      const repository = deps.createRepository(admin)
      const result = await deps.submit({
        userId: ctx.userId,
        input,
        enrichment: lookup.enrichment,
        repository,
        // Batch-shaped helper (one query for many ids), deliberately called with a single
        // id: a submit has at most one catalog match to gate.
        isMatchScanEligible: async (id) =>
          (await deps.filterScanEligibleProductIds(admin, [id])).has(id),
      })
      return scanOk(toResponse(result), {
        status: result.kind === "already_in_catalog" ? 200 : 202,
      })
    },
  })
}

function toResponse(result: ScanProductIntakeSubmissionResult) {
  if (result.kind === "already_in_catalog") {
    return { kind: "already_in_catalog" as const, productId: result.productId }
  }
  return {
    kind: "pending_submission" as const,
    submissionId: result.submission.id,
    headline: SCAN_PENDING_SUBMISSION_HEADLINE,
  }
}

export const POST = createScanSubmitRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  validateEanInput,
  createAdminClient,
  createRepository: createSupabaseProductIntakeRepository,
  filterScanEligibleProductIds,
  resolveRetailerEnrichment,
  recordScanSubmitDmLookupEvent,
  submit: submitScanProductIntake,
})
