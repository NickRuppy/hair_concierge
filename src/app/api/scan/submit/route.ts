import { z } from "zod"
import { after } from "next/server"

import {
  productIntakeCategorySchema,
  type ScanProductIntakeSubmissionInput,
} from "@/lib/product-intake/schemas"
import type { ProductIntakeMatchResult } from "@/lib/product-intake/product-matching"
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
import { findOpenScanSubmissionByName } from "@/lib/scan/pending-submission"
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

/**
 * Name-based research intake (plan Rev. 6 §4, Task 5): `identifier` is optional now. When
 * it is absent, `brandText` and `productNameText` are both required (the search sheet's
 * terminal recovery collects exactly those two fields plus a category). The EAN path stays
 * byte-identical: an `identifier` still makes `brandText`/`productNameText` optional
 * prefill-only fields, unchanged from before.
 */
const submitBodySchema = z
  .object({
    identifier: submitIdentifierSchema.optional(),
    category: productIntakeCategorySchema,
    brandText: z.string().trim().min(1).max(200).optional(),
    productNameText: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.identifier) return
    if (!value.brandText) {
      ctx.addIssue({ code: "custom", path: ["brandText"], message: "Marke ist erforderlich." })
    }
    if (!value.productNameText) {
      ctx.addIssue({
        code: "custom",
        path: ["productNameText"],
        message: "Produktname ist erforderlich.",
      })
    }
  })

/**
 * The coalesce `match` for a name-lane conflict reload (mirrors the EAN lane's get-or-
 * create — see `isOpenScanSubmissionByNameConflict` below): the reloaded row's real match
 * decision was already made by the submission that WON the race, so this is a placeholder
 * the response never actually reads (`toResponse` only inspects `kind`/`submission`).
 */
const NAME_ONLY_COALESCE_MATCH: ProductIntakeMatchResult = {
  status: "pending_review",
  matchedProduct: null,
  productId: null,
  candidates: [],
  confidence: "none",
  reason: "insufficient_identity",
  reasonCodes: [],
  missingFields: [],
}

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
  /**
   * Task 5's name-lane coalesce: reloads the open submission a lost race against
   * `idx_product_submissions_one_open_scan_name` left behind. Only ever called for an
   * identifier-less body — `submitScanProductIntake` itself only coalesces the EAN lane's
   * own index (its `scannedIdentifier &&` guard), so a name-only insert conflict reaches
   * this route as a thrown error instead.
   */
  findOpenScanSubmissionByName: typeof findOpenScanSubmissionByName
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
      const hasIdentifier = ctx.body.identifier !== undefined

      // Same gate as `POST /api/scan/resolve`: the zod schema only proves the string is
      // non-empty, so without this a hand-rolled request could open a research submission
      // for a value that is not an EAN at all — and the submission is the row a reviewer
      // later attaches to the catalog. 400 `invalid_identifier` mirrors resolve exactly.
      // Identifier-less bodies (Task 5's name-based intake) skip this validation entirely —
      // there is no identifier to validate.
      let identifierValue: string | null = null
      if (hasIdentifier) {
        const validation = deps.validateEanInput(ctx.body.identifier!.value)
        if (!validation.ok) return scanFail("invalid_identifier", 400)
        identifierValue = validation.value
      }

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
        // OMITTED (never an explicit `null`) for an identifier-less body: the shared
        // `scanProductIntakeSubmissionSchema.scannedIdentifier` is `.optional()`, not
        // nullable (plan Rev. 6 final-review F2).
        ...(hasIdentifier
          ? { scannedIdentifier: { type: "ean" as const, value: identifierValue! } }
          : {}),
        replace_existing_confirmed: false,
      }

      const admin = deps.createAdminClient()

      // The dm lookup is identifier-keyed: an identifier-less (name-based) body skips it
      // entirely — no lookup call, no event log row (plan Rev. 6 §4, Task 5).
      let lookup: RetailerLookupResult | null = null
      if (hasIdentifier) {
        const lookupStarted = performance.now()
        try {
          lookup = await deps.resolveRetailerEnrichment(identifierValue!, { route: "submit" })
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
      }

      const repository = deps.createRepository(admin)
      let result: ScanProductIntakeSubmissionResult
      try {
        result = await deps.submit({
          userId: ctx.userId,
          input,
          enrichment: lookup?.enrichment ?? null,
          repository,
          // Batch-shaped helper (one query for many ids), deliberately called with a single
          // id: a submit has at most one catalog match to gate.
          isMatchScanEligible: async (id) =>
            (await deps.filterScanEligibleProductIds(admin, [id])).has(id),
        })
      } catch (error) {
        // Task 5's name-lane coalesce: `submitScanProductIntake` only reloads a lost race
        // for the EAN lane's own index (its `scannedIdentifier &&` guard skips this
        // identifier-less input), so a conflict on the new
        // idx_product_submissions_one_open_scan_name reaches this catch as a thrown
        // error. Mirror the EAN lane's get-or-create: answer with the submission that won
        // the race instead of a 503.
        if (!hasIdentifier && isOpenScanSubmissionByNameConflict(error)) {
          const existing = await deps.findOpenScanSubmissionByName(
            admin,
            ctx.userId,
            ctx.body.category,
            ctx.body.brandText!,
            ctx.body.productNameText!,
          )
          if (!existing) throw error
          result = {
            kind: "pending_review",
            category: ctx.body.category,
            submission: {
              id: existing.submissionId,
              status: "pending_review",
              category: ctx.body.category,
            },
            match: NAME_ONLY_COALESCE_MATCH,
          }
        } else {
          throw error
        }
      }
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

/**
 * A `product_submissions` insert rejected by the name lane's unique index. Matches on
 * SQLSTATE first; the message fallback covers clients that surface the constraint name but
 * drop the code — mirrors `isOpenScanSubmissionConflict` in
 * `src/lib/product-intake/submissions.ts` (the EAN lane's own check), which this route
 * deliberately does not import: that function is gated on `scannedIdentifier &&`, so it can
 * never match this (always identifier-less) call site anyway.
 */
function isOpenScanSubmissionByNameConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if ((error as { code?: unknown }).code === "23505") return true
  const message = (error as { message?: unknown }).message
  return (
    typeof message === "string" &&
    /idx_product_submissions_one_open_scan_name|duplicate/i.test(message)
  )
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
  findOpenScanSubmissionByName,
})
