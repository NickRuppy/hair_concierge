import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  loadScanProductFacts,
  loadStage3RecommendationCandidates,
  type CategorySelectionContext,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import type { Stage3CategoryProductFacts } from "@/lib/personal-plan/products/authority/contracts"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import type { PlanCategoryDecision } from "@/lib/personal-plan/types"
import { normalizeIdentifierValue } from "@/lib/product-identity/normalize"
import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import { isProductSearchQuarantined } from "@/lib/scan/catalog-eligibility"
import { lookupCatalogProductByIdentifier, validateEanInput } from "@/lib/scan/identifier-lookup"
import { findOpenScanSubmission } from "@/lib/scan/pending-submission"
import { loadScanEvaluationContext } from "@/lib/scan/profile-context"
import { buildScanVerdict } from "@/lib/scan/resolve-verdict"
import { loadScanSavedState } from "@/lib/scan/saved-state"
import type { ScanResolveResult } from "@/lib/scan/types"
import { SCAN_PENDING_SUBMISSION_HEADLINE } from "@/lib/scan/verdict-labels"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * v1 API surface only ever needs "ean" (ruling R9): the scanner emits ean_13/ean_8 and
 * manual entry is ean-only too. `lookupCatalogProductByIdentifier`'s DB-side matching stays
 * `ean|gtin|barcode` (identifier-lookup.ts, unchanged) — this route just never accepts the
 * other two from a client.
 */
const identifierBodySchema = z
  .object({
    type: z.literal("ean"),
    value: z.string().trim().min(1).max(64),
  })
  .strict()

const resolveBodySchema = z
  .object({
    identifier: identifierBodySchema.optional(),
    productId: z.string().uuid().optional(),
  })
  .strict()
  .refine((body) => Boolean(body.identifier) !== Boolean(body.productId), {
    message: "exactly_one_of_identifier_or_product_id",
  })

type ActiveProductLookup = { id: string; category: PersonalPlanCategory } | null

export type ScanResolveRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  validateEanInput: typeof validateEanInput
  findOpenScanSubmission: typeof findOpenScanSubmission
  lookupCatalogProductByIdentifier: typeof lookupCatalogProductByIdentifier
  isProductSearchQuarantined: typeof isProductSearchQuarantined
  loadScanEvaluationContext: typeof loadScanEvaluationContext
  loadScanProductFacts: typeof loadScanProductFacts
  loadRecommendationCandidates: typeof loadStage3RecommendationCandidates
  loadScanSavedState: typeof loadScanSavedState
  buildScanVerdict: typeof buildScanVerdict
  loadActiveProductById: (client: SupabaseClient, productId: string) => Promise<ActiveProductLookup>
}

/**
 * A category with no target to compare against — genuinely not needed, or not decided
 * yet. Duplicated (not imported) from `resolve-verdict.ts`'s private `isNotNeeded`: that
 * predicate isn't exported (Task 1's settled interface), and this route only needs it to
 * skip an unnecessary full-catalog `recommendationCandidates` load — `buildScanVerdict`
 * itself re-derives the real branch internally regardless of what this route decides here.
 */
function isDecisionWithoutTarget(decision: PlanCategoryDecision): boolean {
  if (decision.needTier === "not_needed") return true
  return (
    decision.target === null && decision.needTier !== "basis" && decision.needTier !== "optional"
  )
}

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function createScanResolveRouteHandler(deps: ScanResolveRouteDeps) {
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
    const parsed = resolveBodySchema.safeParse(body)
    if (!parsed.success) return fail("invalid_request", 400)

    const client = deps.createAdminClient()
    const ok = (result: ScanResolveResult) =>
      NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })

    const unknownProduct = (type: "ean", value: string): ScanResolveResult => ({
      kind: "unknown_product",
      identifier: { type, value },
      categories: PERSONAL_PLAN_PRODUCT_CATEGORIES.map((key) => ({
        key,
        label: CATEGORY_COPY[key].label,
      })),
    })

    try {
      let productId: string
      let category: PersonalPlanCategory

      if (parsed.data.identifier) {
        const identifier = parsed.data.identifier
        const validation = deps.validateEanInput(identifier.value)
        if (!validation.ok) return fail("invalid_identifier", 400)
        const normalizedValue = normalizeIdentifierValue(validation.value)

        const pending = await deps.findOpenScanSubmission(client, userId, normalizedValue)
        if (pending) {
          return ok({
            kind: "pending_submission",
            submissionId: pending.submissionId,
            headline: SCAN_PENDING_SUBMISSION_HEADLINE,
            status: pending.status,
          })
        }

        const hit = await deps.lookupCatalogProductByIdentifier(client, {
          type: identifier.type,
          value: identifier.value,
        })
        if (!hit) return ok(unknownProduct(identifier.type, normalizedValue))

        // Ruling R7: a disposition-quarantined product (identity_ambiguous, retired, or
        // awaiting exact analysis — personal_plan_product_search_dispositions) is not
        // resolvable via scan either. The research/review pipeline is the right place to
        // untangle it; treat it as though the identifier lookup missed.
        if (await deps.isProductSearchQuarantined(client, hit.productId)) {
          return ok(unknownProduct(identifier.type, normalizedValue))
        }

        productId = hit.productId
        category = hit.category
      } else {
        // Schema refine() guarantees productId is set on this branch.
        const active = await deps.loadActiveProductById(client, parsed.data.productId as string)
        if (!active) return fail("product_not_found", 404)
        if (await deps.isProductSearchQuarantined(client, active.id)) {
          return fail("product_not_found", 404)
        }
        productId = active.id
        category = active.category
      }

      const context = await deps.loadScanEvaluationContext(client, userId)
      if (!context) return fail("profile_missing", 409)

      const decision = context.snapshot.decisions.find((entry) => entry.category === category)
      if (!decision) throw new Error("scan_resolve_decision_missing")

      const role = decision.roles[0] ?? CATEGORY_ROLE_POLICIES[category].allowedRoles[0]
      const selectionContext: CategorySelectionContext = {
        hairThickness: context.snapshot.profile.hair.thickness,
        role,
        shampooTarget:
          category === "shampoo" && decision.target?.category === "shampoo"
            ? decision.target
            : null,
        conditionerTarget:
          category === "conditioner" && decision.target?.category === "conditioner"
            ? decision.target
            : null,
      }

      const [productFacts, recommendationCandidates] = await Promise.all([
        deps.loadScanProductFacts(client, category, productId, selectionContext),
        isDecisionWithoutTarget(decision)
          ? Promise.resolve<Stage3CategoryProductFacts[]>([])
          : deps.loadRecommendationCandidates(client, {
              category,
              hairThickness: selectionContext.hairThickness,
              role,
              shampooTarget: selectionContext.shampooTarget,
              conditionerTarget: selectionContext.conditionerTarget,
              completeCatalog: true,
            }),
      ])

      const verdict = deps.buildScanVerdict({
        category,
        decision,
        productFacts,
        recommendationCandidates,
        coverage: context.snapshot.coverage,
        hairThickness: context.snapshot.profile.hair.thickness,
        // No Stage3ProductDraft exists for scan — mirrors product-previews.ts's no-draft
        // default for heat-carrier coverage instead of computing a real one.
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
        refinedVersionId: context.refinedVersionId,
        refinedInputHash: context.refinedInputHash,
      })

      const savedState = await deps.loadScanSavedState(client, userId, productId)

      return ok({ ...verdict, snapshotSource: context.snapshotSource, savedState })
    } catch (error) {
      console.error("[scan] resolve failed", error)
      return fail("temporarily_unavailable", 503)
    }
  }
}

async function loadActiveProductById(
  client: SupabaseClient,
  productId: string,
): Promise<ActiveProductLookup> {
  const { data, error } = await client
    .from("products")
    .select("id, category_key")
    .eq("id", productId)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .maybeSingle()
  if (error) throw new Error("scan_resolve_product_lookup_failed")
  const row = data as { id: string; category_key: string } | null
  return row ? { id: row.id, category: row.category_key as PersonalPlanCategory } : null
}

export const POST = createScanResolveRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  validateEanInput,
  findOpenScanSubmission,
  lookupCatalogProductByIdentifier,
  isProductSearchQuarantined,
  loadScanEvaluationContext,
  loadScanProductFacts,
  loadRecommendationCandidates: loadStage3RecommendationCandidates,
  loadScanSavedState,
  buildScanVerdict,
  loadActiveProductById,
})
