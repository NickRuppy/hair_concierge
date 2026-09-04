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
import { checkRateLimit } from "@/lib/rate-limit"
import {
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
} from "@/lib/scan/catalog-eligibility"
import { lookupCatalogProductByIdentifier, validateEanInput } from "@/lib/scan/identifier-lookup"
import { findOpenScanSubmission } from "@/lib/scan/pending-submission"
import {
  completeScanResolveAttempt,
  createScanResolveAttemptId,
  recordScanResolveAttempt,
  type ScanResolveFailureStage,
  type ScanResolveLookupOutcome,
} from "@/lib/scan/resolve-event-log"
import {
  presentScanVerdictPayload,
  toScanProductHeader,
  type ScanCatalogPresentationRow,
} from "@/lib/scan/product-presentation"
import { loadScanEvaluationContext } from "@/lib/scan/profile-context"
import { buildScanVerdict, type ScanRoleFacts } from "@/lib/scan/resolve-verdict"
import { createScanRoute, parseJsonBody, scanFail, scanOk } from "@/lib/scan/route"
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

type ResolveInput = z.infer<typeof resolveBodySchema>

type ActiveProductLookup = { id: string; category: PersonalPlanCategory } | null

export type ScanResolveRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  validateEanInput: typeof validateEanInput
  findOpenScanSubmission: typeof findOpenScanSubmission
  createScanResolveAttemptId: typeof createScanResolveAttemptId
  recordScanResolveAttempt: typeof recordScanResolveAttempt
  completeScanResolveAttempt: typeof completeScanResolveAttempt
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

/**
 * Mutable attempt-telemetry bookkeeping for one request, created fresh per parse() call
 * and threaded through the wrapper's ctx.body so both the handler (normal completion) and
 * `onError` (the catch-all's completeAttempt("temporarily_unavailable", ...) call) see the
 * same state. Task 4 owns the telemetry semantics themselves — this is scaffolding-removal
 * only, carrying the same fields the old inline `let`s held.
 */
type ResolveAttemptTracker = {
  attemptId: string | null
  lookupOutcome: ScanResolveLookupOutcome | null
  matchedProductId: string | null
  failureStage: ScanResolveFailureStage
}

type ResolveRouteBody = { input: ResolveInput; attempt: ResolveAttemptTracker }

type ResolveTerminalOutcome =
  | "invalid_identifier"
  | "unknown_product"
  | "pending_submission"
  | "resolved"
  | "verdict_unknown"
  | "profile_ineligible"
  | "temporarily_unavailable"

/**
 * Shared by the handler's normal-completion calls and the wrapper's `onError` hook (the
 * catch-all's own completion, for a throw mid-handler) — same guard, same shape, one place.
 */
async function completeResolveAttempt(
  deps: ScanResolveRouteDeps,
  client: SupabaseClient,
  attempt: ResolveAttemptTracker,
  terminalOutcome: ResolveTerminalOutcome,
  stage: ScanResolveFailureStage | null,
) {
  if (!attempt.attemptId) return
  await deps.completeScanResolveAttempt(client, {
    attemptId: attempt.attemptId,
    lookupOutcome: attempt.lookupOutcome,
    terminalOutcome,
    matchedProductId: attempt.matchedProductId,
    failureStage: stage,
  })
}

export function createScanResolveRouteHandler(deps: ScanResolveRouteDeps) {
  const parseBody = parseJsonBody(resolveBodySchema)

  return createScanRoute<ResolveRouteBody>({
    route: "resolve",
    deps,
    parse: async (request) => {
      const parsed = await parseBody(request)
      if (!parsed.ok) return parsed
      return {
        ok: true,
        body: {
          input: parsed.body,
          attempt: {
            attemptId: null,
            lookupOutcome: null,
            matchedProductId: null,
            failureStage: "identifier_lookup",
          },
        },
      }
    },
    failureReason: "resolve_failed",
    onError: async (_error, ctx) => {
      const { attempt } = ctx.body
      const client = deps.createAdminClient()
      await completeResolveAttempt(
        deps,
        client,
        attempt,
        "temporarily_unavailable",
        attempt.failureStage,
      )
    },
    handler: async (ctx) => {
      const { input, attempt } = ctx.body
      const userId = ctx.userId
      const client = deps.createAdminClient()

      const unknownProduct = (type: "ean", value: string): ScanResolveResult => ({
        kind: "unknown_product",
        identifier: { type, value },
        categories: PERSONAL_PLAN_PRODUCT_CATEGORIES.map((key) => ({
          key,
          label: CATEGORY_COPY[key].label,
        })),
      })

      const completeAttempt = (
        terminalOutcome: ResolveTerminalOutcome,
        stage: ScanResolveFailureStage | null,
      ) => completeResolveAttempt(deps, client, attempt, terminalOutcome, stage)

      let productId: string
      let category: PersonalPlanCategory

      if (input.identifier) {
        const identifier = input.identifier
        // Barcode attempts are started before validation; productId resolution below
        // originates in the search sheet and intentionally has no barcode telemetry.
        attempt.attemptId = deps.createScanResolveAttemptId()
        await deps.recordScanResolveAttempt(client, {
          attemptId: attempt.attemptId,
          userId,
          identifierType: identifier.type,
          rawValue: identifier.value,
        })

        const validation = deps.validateEanInput(identifier.value)
        if (!validation.ok) {
          attempt.lookupOutcome = "invalid"
          await completeAttempt("invalid_identifier", "identifier_lookup")
          return scanFail("invalid_identifier", 400)
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
        attempt.failureStage = "quarantine_lookup"
        const quarantined =
          hit !== null && (await deps.isProductSearchQuarantined(client, hit.productId))
        attempt.matchedProductId = hit?.productId ?? null
        attempt.lookupOutcome = quarantined ? "quarantined" : hit ? "hit" : "miss"

        if (!hit || quarantined) {
          // The catalog is the authority: an open research submission only decides what
          // this scan shows once the EAN is genuinely not (usably) in the catalog. A
          // cataloged product must still reach its verdict while a submission is open.
          attempt.failureStage = "submission_lookup"
          const pending = await deps.findOpenScanSubmission(client, userId, normalizedValue)
          if (pending) {
            await completeAttempt("pending_submission", null)
            return scanOk({
              kind: "pending_submission",
              submissionId: pending.submissionId,
              headline: SCAN_PENDING_SUBMISSION_HEADLINE,
              status: pending.status,
            } satisfies ScanResolveResult)
          }
          await completeAttempt("unknown_product", null)
          return scanOk(unknownProduct(identifier.type, normalizedValue))
        }

        productId = hit.productId
        category = hit.category
      } else {
        // Schema refine() guarantees productId is set on this branch.
        const active = await deps.loadActiveProductById(client, input.productId as string)
        if (!active) return scanFail("product_not_found", 404)
        if (await deps.isProductSearchQuarantined(client, active.id)) {
          return scanFail("product_not_found", 404)
        }
        productId = active.id
        category = active.category
      }

      attempt.failureStage = "profile_context"
      const context = await deps.loadScanEvaluationContext(client, userId)
      if (!context) {
        await completeAttempt("profile_ineligible", null)
        return scanFail("profile_missing", 409)
      }

      attempt.failureStage = "decision"
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
        attempt.failureStage = "product_facts"
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

      attempt.failureStage = "verdict"
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
      attempt.failureStage = "post_verdict_load"
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
      attempt.failureStage = "alternative_filter"
      const eligibleVerdict = await withEligibleAlternatives(verdict, (ids) =>
        deps.loadQuarantinedProductIdsAmong(client, ids),
      )

      attempt.failureStage = "response_build"
      const result = {
        ...presentScanVerdictPayload(eligibleVerdict, presentationRows),
        product: toScanProductHeader(scannedRow),
        snapshotSource: context.snapshotSource,
        savedState,
      }
      await completeAttempt(
        eligibleVerdict.kind === "in_catalog" && eligibleVerdict.verdict === "unknown"
          ? "verdict_unknown"
          : "resolved",
        null,
      )
      return scanOk(result)
    },
  })
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
  createScanResolveAttemptId,
  recordScanResolveAttempt,
  completeScanResolveAttempt,
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
