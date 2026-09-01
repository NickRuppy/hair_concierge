import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import { ROLE_SENSITIVE_CANDIDATE_CATEGORIES } from "@/lib/personal-plan/product-previews"
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
import type { PlanCategoryDecision, PlanProductRole } from "@/lib/personal-plan/types"
import { normalizeIdentifierValue } from "@/lib/product-identity/normalize"
import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import {
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
} from "@/lib/scan/catalog-eligibility"
import { lookupCatalogProductByIdentifier, validateEanInput } from "@/lib/scan/identifier-lookup"
import { findOpenScanSubmission } from "@/lib/scan/pending-submission"
import { recordScanResolveEvent } from "@/lib/scan/resolve-event-log"
import {
  presentScanVerdictPayload,
  toScanProductHeader,
  type ScanCatalogPresentationRow,
} from "@/lib/scan/product-presentation"
import { loadScanEvaluationContext } from "@/lib/scan/profile-context"
import { buildScanVerdict, type ScanRoleFacts } from "@/lib/scan/resolve-verdict"
import { loadScanSavedState } from "@/lib/scan/saved-state"
import type { ScanResolveResult, ScanVerdictPayload } from "@/lib/scan/types"
import { SCAN_PENDING_SUBMISSION_HEADLINE } from "@/lib/scan/verdict-labels"
import { captureScanException } from "@/lib/observability/scan"
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
  recordScanResolveEvent: typeof recordScanResolveEvent
  lookupCatalogProductByIdentifier: typeof lookupCatalogProductByIdentifier
  isProductSearchQuarantined: typeof isProductSearchQuarantined
  loadQuarantinedProductIdsAmong: typeof loadQuarantinedProductIdsAmong
  loadScanEvaluationContext: typeof loadScanEvaluationContext
  loadScanProductFacts: typeof loadScanProductFacts
  loadRecommendationCandidates: typeof loadStage3RecommendationCandidates
  loadScanSavedState: typeof loadScanSavedState
  buildScanVerdict: typeof buildScanVerdict
  loadActiveProductById: (client: SupabaseClient, productId: string) => Promise<ActiveProductLookup>
  loadPresentationRows: (
    client: SupabaseClient,
    productIds: string[],
  ) => Promise<ScanCatalogPresentationRow[]>
  captureScanException?: typeof captureScanException
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
        // Attempt log (fail-open, barcode attempts only — the productId branch below
        // comes from the search sheet and involves no barcode): outcome mirrors what
        // the user is shown; matchedProductId also survives quarantined outcomes so
        // the operator sees which product the barcode pointed at.
        const logAttempt = (
          outcome: Parameters<typeof recordScanResolveEvent>[1]["outcome"],
          matchedProductId: string | null,
        ) =>
          deps.recordScanResolveEvent(client, {
            userId,
            identifierType: identifier.type,
            rawValue: identifier.value,
            outcome,
            matchedProductId,
          })

        const validation = deps.validateEanInput(identifier.value)
        if (!validation.ok) {
          await logAttempt("invalid", null)
          return fail("invalid_identifier", 400)
        }
        const normalizedValue = normalizeIdentifierValue(validation.value)

        const hit = await deps.lookupCatalogProductByIdentifier(client, {
          type: identifier.type,
          value: identifier.value,
        })

        // Ruling R7: a disposition-quarantined product (identity_ambiguous, retired, or
        // awaiting exact analysis — personal_plan_product_search_dispositions) is not
        // resolvable via scan either. The research/review pipeline is the right place to
        // untangle it; treat it as though the identifier lookup missed.
        const quarantined =
          hit !== null && (await deps.isProductSearchQuarantined(client, hit.productId))

        if (!hit || quarantined) {
          // The catalog is the authority: an open research submission only decides what
          // this scan shows once the EAN is genuinely not (usably) in the catalog. A
          // cataloged product must still reach its verdict while a submission is open.
          const pending = await deps.findOpenScanSubmission(client, userId, normalizedValue)
          if (pending) {
            await logAttempt("pending_submission", hit?.productId ?? null)
            return ok({
              kind: "pending_submission",
              submissionId: pending.submissionId,
              headline: SCAN_PENDING_SUBMISSION_HEADLINE,
              status: pending.status,
            })
          }
          await logAttempt(quarantined ? "quarantined" : "miss", hit?.productId ?? null)
          return ok(unknownProduct(identifier.type, normalizedValue))
        }

        await logAttempt("hit", hit.productId)
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

      const shampooTarget =
        category === "shampoo" && decision.target?.category === "shampoo" ? decision.target : null
      const conditionerTarget =
        category === "conditioner" && decision.target?.category === "conditioner"
          ? decision.target
          : null

      const loadFactsForRole = async (role: PlanProductRole): Promise<ScanRoleFacts> => {
        const selectionContext: CategorySelectionContext = {
          hairThickness: context.snapshot.profile.hair.thickness,
          role,
          shampooTarget,
          conditionerTarget,
        }
        const [productFacts, recommendationCandidates] = await Promise.all([
          deps.loadScanProductFacts(client, category, productId, selectionContext),
          isDecisionWithoutTarget(decision)
            ? Promise.resolve<Stage3CategoryProductFacts[]>([])
            : deps.loadRecommendationCandidates(client, {
                category,
                hairThickness: selectionContext.hairThickness,
                role,
                shampooTarget,
                conditionerTarget,
                completeCatalog: true,
              }),
        ])
        return { productFacts, recommendationCandidates }
      }

      /**
       * `buildScanVerdict` evaluates EVERY role of the decision, but a category's derived
       * facts are identical for all of its roles except Shampoo, where `selectShampooSpec`
       * picks the spec row by the role's expected bucket/scalp route. So mirror
       * `product-previews.ts`: one shared load for every other category, one load per role
       * for a role-sensitive one — otherwise e.g. the dandruff role would be graded against
       * facts loaded for the everyday role.
       */
      const primaryRole = decision.roles[0] ?? CATEGORY_ROLE_POLICIES[category].allowedRoles[0]
      const roleSensitive = ROLE_SENSITIVE_CANDIDATE_CATEGORIES.has(category)
      const rolesToLoad = roleSensitive
        ? [...new Set<PlanProductRole>([primaryRole, ...decision.roles])]
        : [primaryRole]
      const loadedFacts = new Map<PlanProductRole, ScanRoleFacts>(
        await Promise.all(
          rolesToLoad.map(async (role) => [role, await loadFactsForRole(role)] as const),
        ),
      )
      const primaryFacts = loadedFacts.get(primaryRole) as ScanRoleFacts

      const verdict = deps.buildScanVerdict({
        category,
        decision,
        productFacts: primaryFacts.productFacts,
        recommendationCandidates: primaryFacts.recommendationCandidates,
        perRoleFacts: roleSensitive ? Object.fromEntries(loadedFacts) : undefined,
        coverage: context.snapshot.coverage,
        hairThickness: context.snapshot.profile.hair.thickness,
        // No Stage3ProductDraft exists for scan — mirrors product-previews.ts's no-draft
        // default for heat-carrier coverage instead of computing a real one.
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
        refinedVersionId: context.refinedVersionId,
        refinedInputHash: context.refinedInputHash,
      })

      // One catalog read covers the sheet's product header and the alternatives' brand +
      // purchase link — neither exists on the authority facts the verdict is built from.
      const alternativeIds =
        verdict.kind === "in_catalog"
          ? verdict.alternatives.map((alternative) => alternative.productId)
          : []
      const [savedState, presentationRows] = await Promise.all([
        deps.loadScanSavedState(client, userId, productId),
        deps.loadPresentationRows(client, [productId, ...alternativeIds]),
      ])

      const scannedRow = presentationRows.find((row) => row.id === productId)
      if (!scannedRow) throw new Error("scan_resolve_presentation_row_missing")

      // Ruling R7 applies to what we RECOMMEND too, not just to what we resolve. The
      // Stage-3 candidate loader has no disposition filter, so a quarantined product could
      // be offered as an alternative on a surface that refuses to resolve or save it. Done
      // on the final (≤3) list rather than on the candidate pool: same outcome, one small
      // keyed query instead of filtering the whole catalog.
      const eligibleVerdict = await withEligibleAlternatives(verdict, (ids) =>
        deps.loadQuarantinedProductIdsAmong(client, ids),
      )

      return ok({
        ...presentScanVerdictPayload(eligibleVerdict, presentationRows),
        product: toScanProductHeader(scannedRow),
        snapshotSource: context.snapshotSource,
        savedState,
      })
    } catch (error) {
      console.error("[scan] resolve failed", error)
      ;(deps.captureScanException ?? captureScanException)(error, {
        route: "resolve",
        status: 503,
        reason: "resolve_failed",
        userId,
      })
      return fail("temporarily_unavailable", 503)
    }
  }
}

/**
 * Drops disposition-quarantined products from an `in_catalog` verdict's alternatives.
 * Leaving the list empty is fine — the sheet only renders the section when it has entries.
 */
async function withEligibleAlternatives(
  verdict: ScanVerdictPayload,
  loadQuarantined: (productIds: string[]) => Promise<Set<string>>,
): Promise<ScanVerdictPayload> {
  if (verdict.kind !== "in_catalog" || verdict.alternatives.length === 0) return verdict
  const quarantined = await loadQuarantined(
    verdict.alternatives.map((alternative) => alternative.productId),
  )
  if (quarantined.size === 0) return verdict
  return {
    ...verdict,
    alternatives: verdict.alternatives.filter(
      (alternative) => !quarantined.has(alternative.productId),
    ),
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

async function loadPresentationRows(
  client: SupabaseClient,
  productIds: string[],
): Promise<ScanCatalogPresentationRow[]> {
  if (productIds.length === 0) return []
  const { data, error } = await client
    .from("products")
    .select(
      "id, name, brand, category_key, image_url, price_eur, currency, affiliate_link, purchase_link_status, price_checked_at",
    )
    .in("id", [...new Set(productIds)])
  if (error) throw new Error("scan_resolve_presentation_lookup_failed")
  return ((data ?? []) as PresentationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category_key as PersonalPlanCategory,
    imageUrl: row.image_url,
    priceEur: row.price_eur,
    currency: row.currency,
    affiliateLink: row.affiliate_link,
    purchaseLinkStatus:
      row.purchase_link_status === "available" || row.purchase_link_status === "unavailable"
        ? row.purchase_link_status
        : null,
    priceCheckedAt: row.price_checked_at,
  }))
}

type PresentationRow = {
  id: string
  name: string
  brand: string | null
  category_key: string
  image_url: string | null
  price_eur: number | null
  currency: string | null
  affiliate_link: string | null
  purchase_link_status: string | null
  price_checked_at: string | null
}

export const POST = createScanResolveRouteHandler({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  validateEanInput,
  findOpenScanSubmission,
  recordScanResolveEvent,
  lookupCatalogProductByIdentifier,
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
  loadScanEvaluationContext,
  loadScanProductFacts,
  loadRecommendationCandidates: loadStage3RecommendationCandidates,
  loadScanSavedState,
  buildScanVerdict,
  loadActiveProductById,
  loadPresentationRows,
})
