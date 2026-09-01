import { NextResponse } from "next/server"
import { z } from "zod"

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
import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { SCAN_PENDING_SUBMISSION_HEADLINE } from "@/lib/scan/verdict-labels"
import { captureScanException } from "@/lib/observability/scan"
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
  submit: typeof submitScanProductIntake
  captureScanException?: typeof captureScanException
}

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function createScanSubmitRouteHandler(deps: ScanSubmitRouteDeps) {
  return async function POST(request: Request) {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("invalid_request", 400)
    }
    const parsed = submitBodySchema.safeParse(body)
    if (!parsed.success) return fail("invalid_request", 400)

    // Same gate as `POST /api/scan/resolve`: the zod schema only proves the string is
    // non-empty, so without this a hand-rolled request could open a research submission
    // for a value that is not an EAN at all — and the submission is the row a reviewer
    // later attaches to the catalog. 400 `invalid_identifier` mirrors resolve exactly.
    const validation = deps.validateEanInput(parsed.data.identifier.value)
    if (!validation.ok) return fail("invalid_identifier", 400)

    const input: ScanProductIntakeSubmissionInput = {
      intake_method: "manual",
      category: parsed.data.category,
      // No invented data (ruling R8): scan's UI never asks for a use-frequency, and
      // submitScanProductIntake never reads/writes user_product_usage, so this stays a
      // genuine null all the way to product_submissions.frequency_range (migration
      // 20260820110000 relaxes that column's constraint for source='scan' only).
      frequency_range: null,
      brand_text: parsed.data.brandText,
      product_name_text: parsed.data.productNameText,
      scannedIdentifier: { type: "ean", value: validation.value },
      replace_existing_confirmed: false,
    }

    try {
      const admin = deps.createAdminClient()
      const repository = deps.createRepository(admin)
      const result = await deps.submit({ userId, input, repository })
      return NextResponse.json(toResponse(result), {
        status: result.kind === "already_in_catalog" ? 200 : 202,
        headers: { "Cache-Control": "no-store" },
      })
    } catch (error) {
      console.error("[scan] submit failed", error)
      ;(deps.captureScanException ?? captureScanException)(error, {
        route: "submit",
        status: 503,
        reason: "submit_failed",
        userId,
      })
      return fail("temporarily_unavailable", 503)
    }
  }
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
  submit: submitScanProductIntake,
})
