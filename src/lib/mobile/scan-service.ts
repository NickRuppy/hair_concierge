import type { SupabaseClient } from "@supabase/supabase-js"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import { ROLE_SENSITIVE_CANDIDATE_CATEGORIES } from "@/lib/personal-plan/product-previews"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  loadScanProductFacts,
  loadStage3RecommendationCandidatesByRole,
  type CategorySelectionContext,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import type { PlanCategoryDecision, PlanProductRole } from "@/lib/personal-plan/types"
import {
  isProductSearchQuarantined,
  loadQuarantinedProductIds,
  loadQuarantinedProductIdsAmong,
} from "@/lib/scan/catalog-eligibility"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"
import { lookupCatalogProductByIdentifier } from "@/lib/scan/identifier-lookup"
import {
  resolveRetailerEnrichment,
  type RetailerLookupResult,
} from "@/lib/scan/enrichment/resolve-enrichment"
import { buildScanVerdict, isNotNeeded, type ScanRoleFacts } from "@/lib/scan/resolve-verdict"
import type { ScanVerdictPayload } from "@/lib/scan/types"
import type { ScanEvaluationContext } from "@/lib/scan/profile-context"

import {
  mobileMismatchSummary,
  mobileRowsFromScanDimensions,
  mobileAssessmentRows,
  mobileVerdictTitle,
} from "./result-presentation"
import {
  MOBILE_SCAN_CONTRACT_VERSION,
  mobileScanResolveResultSchema,
  mobileScanSearchResponseSchema,
  type MobileScanProduct,
  type MobileScanResolveResult,
  type MobileScanSearchResponse,
} from "./scan-contracts"
import { buildRetailerImageProxyUrl } from "./retailer-image"

type ProductRow = {
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
  sort_order?: number | null
  brand_identity?: { canonical_name: string | null } | { canonical_name: string | null }[] | null
  product_line?: { canonical_name: string | null } | { canonical_name: string | null }[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function identityParts(row: ProductRow) {
  return {
    brand: firstRelation(row.brand_identity)?.canonical_name ?? row.brand,
    productLine: firstRelation(row.product_line)?.canonical_name ?? null,
    name: row.name,
  }
}

type IdentifierLookup =
  | { kind: "miss" }
  | { kind: "candidate"; productId: string; category: PersonalPlanCategory }
  | { kind: "unavailable" }

export type MobileScanResolveInput = {
  productId?: string
  identifier?: { type: "ean"; value: string }
  /** Internal request context; not accepted from the native JSON body. */
  retailerImageOrigin?: string
}

const defaultDependencies = {
  lookupIdentifier: lookupMobileIdentifier,
  isQuarantined: isProductSearchQuarantined,
  loadProductById,
  resolveRetailerEnrichment,
}
export type MobileScanResolveDependencies = typeof defaultDependencies

/**
 * Native-only domain service. Its caller authenticates and derives the owner/context; this
 * module performs no entitlement, saved-state, routine, or mutation work.
 */
export async function resolveMobileScan(
  client: SupabaseClient,
  context: ScanEvaluationContext | null,
  input: MobileScanResolveInput,
  dependencies: Partial<MobileScanResolveDependencies> = {},
): Promise<MobileScanResolveResult> {
  const deps = { ...defaultDependencies, ...dependencies }
  if (!context)
    return parse({ contractVersion: MOBILE_SCAN_CONTRACT_VERSION, kind: "profile_required" })
  const matched = await findProduct(client, input, deps)
  if (matched.kind !== "hit") {
    const lookup =
      matched.kind === "identifier_miss" && input.identifier
        ? await lookupRetailer(input.identifier.value, deps.resolveRetailerEnrichment)
        : null
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      kind: "submission_required",
      productId: null,
      missingFacts: ["unknown_product"],
      ...(lookup?.enrichment
        ? { identified: toRetailerIdentified(lookup.enrichment, input.retailerImageOrigin) }
        : {}),
    })
  }
  const productRow = matched.product
  const product = toMobileProduct(productRow)
  const category = productRow.category_key as PersonalPlanCategory
  const decision = context.snapshot.decisions.find((entry) => entry.category === category)
  if (!decision)
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      kind: "retryable_error",
      code: "profile_decision_missing",
    })

  if (decision.target && decision.target.category !== category)
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      kind: "retryable_error",
      code: "profile_target_invalid",
    })

  const loaded = await loadVerdict(client, category, productRow.id, decision, context)
  const verdict = loaded.verdict
  const revision = context.refinedVersionId
  if (verdict.kind === "not_needed") {
    if (verdict.mode === "deferred")
      return parse({
        contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
        kind: "profile_decision_deferred",
        contextRevision: revision,
        product,
        headline: "Noch nicht einschätzbar",
        subtitle:
          "Aus deinen bisherigen Angaben ergibt sich für dieses Produkt noch kein persönliches Ziel.",
        reason: "personal_target_unavailable",
      })
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      kind: "not_needed",
      contextRevision: revision,
      product,
      headline: verdict.headline,
      subtitle: verdict.subtitle,
      reasons: verdict.reasons,
      rows: mobileRowsFromScanDimensions(verdict.dimensions, null),
      coveredBy: verdict.coveredBy,
    })
  }
  if (verdict.verdict === "unknown") {
    const failure = mobileAuthorityFailure(verdict)
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      productId: productRow.id,
      ...failure,
      ...(failure.kind === "authority_unavailable" &&
      failure.reason === "personal_target_unavailable"
        ? {
            product,
            headline: "Noch nicht einschätzbar",
            subtitle:
              "Aus deinen bisherigen Angaben ergibt sich für dieses Produkt noch kein persönliches Ziel.",
          }
        : {}),
    })
  }
  const alternatives = await Promise.all(
    verdict.alternatives.map(async (alternative) => {
      const alternativeRow = await loadProductById(client, alternative.productId)
      if (!alternativeRow) return null
      const rows = mobileAssessmentRows(
        category,
        verdict.evaluatedRole!,
        alternative.productId,
        verdict.mobileDimensions ?? [],
        alternative.criteria ?? [],
        verdict.fitNarrative?.fit ?? null,
      )
      return {
        product: toMobileProduct(alternativeRow),
        verdict: alternative.verdict,
        verdictLabel: alternative.verdictLabel,
        verdictTitle: mobileVerdictTitle(alternative.verdict, rows),
        mismatchSummary: mobileMismatchSummary(rows),
        rows,
        categoryFit: verdict.fitNarrative?.fit ?? null,
      }
    }),
  )
  const rows = mobileAssessmentRows(
    category,
    verdict.evaluatedRole!,
    productRow.id,
    verdict.mobileDimensions ?? [],
    verdict.criteria,
    verdict.fitNarrative?.fit ?? null,
  )
  return parse({
    contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
    kind: "assessment",
    contextRevision: revision,
    product,
    verdict: verdict.verdict,
    verdictLabel: verdict.verdictLabel,
    verdictTitle: mobileVerdictTitle(verdict.verdict, rows),
    subtitle: verdict.subtitle,
    mismatchSummary: mobileMismatchSummary(rows),
    rows,
    categoryFit: verdict.fitNarrative?.fit ?? null,
    alternatives: alternatives.filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null,
    ),
  })
}

export async function searchMobileScanCatalog(
  client: SupabaseClient,
  query: string,
): Promise<MobileScanSearchResponse> {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized.length < 2)
    return mobileScanSearchResponseSchema.parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      results: [],
      truncated: false,
    })
  const [{ data, error }, quarantined] = await Promise.all([
    client
      .from("products")
      .select(
        "id,name,brand,category_key,image_url,sort_order,brand_identity:brands(canonical_name),product_line:product_lines(canonical_name)",
      )
      .eq("is_active", true)
      .eq("lifecycle_status", "active")
      .in("category_key", PERSONAL_PLAN_PRODUCT_CATEGORIES)
      .limit(1000),
    loadQuarantinedProductIds(client),
  ])
  if (error) throw new Error("mobile_scan_search_unavailable")
  const rows = (data ?? []) as ProductRow[]
  const results = rows
    .filter(
      (row) =>
        !quarantined.has(row.id) &&
        composeProductIdentityTitle(identityParts(row)).toLocaleLowerCase().includes(normalized),
    )
    .sort(
      (a, b) =>
        (composeProductIdentityTitle(identityParts(a)).toLocaleLowerCase() === normalized
          ? -1
          : 0) -
          (composeProductIdentityTitle(identityParts(b)).toLocaleLowerCase() === normalized
            ? -1
            : 0) ||
        (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, "de") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      displayName: composeProductIdentityTitle(identityParts(row)),
      brand: identityParts(row).brand,
      category: row.category_key,
      categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
      imageUrl: safeUrl(row.image_url),
    }))
  return mobileScanSearchResponseSchema.parse({
    contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
    results,
    truncated: rows.length === 1000,
  })
}

async function loadVerdict(
  client: SupabaseClient,
  category: PersonalPlanCategory,
  productId: string,
  decision: PlanCategoryDecision,
  context: ScanEvaluationContext,
): Promise<{ verdict: ScanVerdictPayload; productFactsMissing: boolean }> {
  const primaryRole = decision.roles[0] ?? CATEGORY_ROLE_POLICIES[category].allowedRoles[0]
  const roles = ROLE_SENSITIVE_CANDIDATE_CATEGORIES.has(category)
    ? [...new Set<PlanProductRole>([primaryRole, ...decision.roles])]
    : [primaryRole]
  const shampooTarget =
    category === "shampoo" && decision.target?.category === "shampoo" ? decision.target : null
  const conditionerTarget =
    category === "conditioner" && decision.target?.category === "conditioner"
      ? decision.target
      : null
  const selection = (role: PlanProductRole): CategorySelectionContext => ({
    hairThickness: context.snapshot.profile.hair.thickness,
    role,
    shampooTarget,
    conditionerTarget,
  })
  const [factsRows, candidates] = await Promise.all([
    Promise.all(
      roles.map(
        async (role) =>
          [role, await loadScanProductFacts(client, category, productId, selection(role))] as const,
      ),
    ),
    isNotNeeded(decision)
      ? Promise.resolve(Object.fromEntries(roles.map((role) => [role, []])))
      : loadStage3RecommendationCandidatesByRole(client, {
          category,
          hairThickness: context.snapshot.profile.hair.thickness,
          shampooTarget,
          conditionerTarget,
          roles,
        }),
  ])
  const candidateIds = Object.values(candidates).flatMap((entries) =>
    entries.map((entry) => entry.productId),
  )
  const quarantined = await loadQuarantinedProductIdsAmong(client, candidateIds)
  const facts = new Map<PlanProductRole, ScanRoleFacts>(
    factsRows.map(([role, productFacts]) => [
      role,
      {
        productFacts,
        recommendationCandidates: (candidates[role] ?? []).filter(
          (candidate) => !quarantined.has(candidate.productId),
        ),
      },
    ]),
  )
  const primary = facts.get(primaryRole)!
  return {
    productFactsMissing: !primary.productFacts,
    verdict: buildScanVerdict({
      category,
      decision,
      productFacts: primary.productFacts,
      recommendationCandidates: primary.recommendationCandidates,
      perRoleFacts: roles.length > 1 ? Object.fromEntries(facts) : undefined,
      coverage: context.snapshot.coverage,
      hairThickness: context.snapshot.profile.hair.thickness,
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      refinedVersionId: context.refinedVersionId,
      refinedInputHash: context.refinedInputHash,
      alternativeSelection: "native",
    }),
  }
}

async function findProduct(
  client: SupabaseClient,
  input: MobileScanResolveInput,
  deps: MobileScanResolveDependencies,
): Promise<
  { kind: "hit"; product: ProductRow } | { kind: "identifier_miss" } | { kind: "unavailable" }
> {
  if (input.productId) {
    if (await deps.isQuarantined(client, input.productId)) return { kind: "unavailable" }
    const product = await deps.loadProductById(client, input.productId)
    return product ? { kind: "hit", product } : { kind: "unavailable" }
  }
  if (!input.identifier) return { kind: "unavailable" }
  const match = await deps.lookupIdentifier(client, input.identifier)
  if (match.kind === "miss") return { kind: "identifier_miss" }
  if (match.kind === "unavailable") return { kind: "unavailable" }
  if (await deps.isQuarantined(client, match.productId)) return { kind: "unavailable" }
  const product = await deps.loadProductById(client, match.productId)
  return product ? { kind: "hit", product } : { kind: "unavailable" }
}

/**
 * Unlike the shared resolver, this retains inactive/colliding identifier evidence as
 * unavailable. dm is only appropriate when no identifier exists in our catalog at all.
 */
async function lookupMobileIdentifier(
  client: SupabaseClient,
  identifier: { type: "ean"; value: string },
): Promise<IdentifierLookup> {
  // This shared matcher is the production authority for active/colliding catalog
  // identifiers. In particular, it can select one active product among raw rows
  // which also reference an inactive product.
  const resolved = await lookupCatalogProductByIdentifier(client, identifier)
  if (resolved)
    return {
      kind: "candidate",
      productId: resolved.productId,
      category: resolved.category,
    }

  // The shared matcher intentionally folds inactive, colliding, and dangling rows
  // into null. Here we need only distinguish that evidence from a genuine no-row miss
  // before deciding whether dm may be called.
  const canonicalGtin14 = canonicalizeGtin(identifier.value)
  if (!canonicalGtin14) return { kind: "unavailable" }
  const { data: identifierRows, error: identifierError } = await client
    .from("product_identifiers")
    .select("product_id")
    .eq("canonical_gtin14", canonicalGtin14)
    .in("identifier_type", ["ean", "gtin", "barcode"])
  if (identifierError) throw new Error("mobile_scan_identifier_lookup_unavailable")
  const productIds = [
    ...new Set(
      ((identifierRows ?? []) as Array<{ product_id: string }>).map((row) => row.product_id),
    ),
  ]
  if (productIds.length === 0) return { kind: "miss" }
  return { kind: "unavailable" }
}

async function lookupRetailer(
  barcode: string,
  resolve: MobileScanResolveDependencies["resolveRetailerEnrichment"],
): Promise<RetailerLookupResult | null> {
  try {
    return await resolve(barcode, { route: "resolve" })
  } catch {
    return null
  }
}

function toRetailerIdentified(
  enrichment: NonNullable<RetailerLookupResult["enrichment"]>,
  requestUrl: string | undefined,
) {
  return {
    displayName: composeProductIdentityTitle({
      brand: enrichment.brand,
      name: enrichment.productName,
    }),
    productName: enrichment.productName,
    brand: enrichment.brand,
    suggestedCategory: enrichment.suggestedCategory,
    imageUrl: buildRetailerImageProxyUrl(enrichment.imageUrl, requestUrl),
  }
}

async function loadProductById(client: SupabaseClient, id: string): Promise<ProductRow | null> {
  const { data, error } = await client
    .from("products")
    .select(
      "id,name,brand,category_key,image_url,price_eur,currency,affiliate_link,purchase_link_status,price_checked_at,brand_identity:brands(canonical_name),product_line:product_lines(canonical_name)",
    )
    .eq("id", id)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .maybeSingle()
  if (error) throw new Error("mobile_scan_product_lookup_unavailable")
  return data as ProductRow | null
}

function toMobileProduct(row: ProductRow): MobileScanProduct {
  const identity = identityParts(row)
  return {
    id: row.id,
    name: row.name,
    displayName: composeProductIdentityTitle(identity),
    brand: identity.brand,
    category: row.category_key,
    categoryLabel: CATEGORY_COPY[row.category_key as PersonalPlanCategory].label,
    imageUrl: safeUrl(row.image_url),
    priceEur: row.price_eur,
    currency: row.currency && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null,
    purchaseUrl: row.purchase_link_status === "available" ? safeUrl(row.affiliate_link) : null,
  }
}
function safeUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}
const PERSONAL_TARGET_REASONS = new Set([
  "personal_role_target_unavailable",
  "shampoo_target_unavailable",
  "conditioner_target_unavailable",
  "leave_in_target_unavailable",
  "mask_target_unavailable",
  "oil_target_unavailable",
  "oil_role_target_unavailable",
  "bondbuilder_target_unavailable",
  "heat_protectant_target_unavailable",
  "scalp_care_target_unavailable",
  "dry_shampoo_target_unavailable",
  "deep_cleansing_target_unavailable",
])

/** Only machine-readable missing PRODUCT facts authorize the later research flow. */
export function mobileAuthorityFailure(
  verdict: Extract<ScanVerdictPayload, { kind: "in_catalog" }>,
):
  | { kind: "submission_required"; missingFacts: string[] }
  | {
      kind: "authority_unavailable"
      reason: "personal_target_unavailable" | "temporarily_unavailable"
      missingFacts: string[]
    } {
  const authority = verdict.mobileAuthority
  const personalFacts = new Set(["shampoo_bucket_target", "shampoo_spec_target"])
  if (
    authority?.status === "unknown" &&
    authority.missingFacts.length > 0 &&
    !authority.missingFacts.some((fact) => personalFacts.has(fact))
  )
    return { kind: "submission_required", missingFacts: authority.missingFacts }
  return {
    kind: "authority_unavailable",
    reason:
      (authority?.status === "unsupported" &&
        PERSONAL_TARGET_REASONS.has(authority.unsupportedReason ?? "")) ||
      authority?.missingFacts.some((fact) => personalFacts.has(fact))
        ? "personal_target_unavailable"
        : "temporarily_unavailable",
    missingFacts: [
      authority?.unsupportedReason ??
        (authority?.missingFacts.some((fact) => personalFacts.has(fact))
          ? "personal_target_unavailable"
          : "authority_temporarily_unavailable"),
    ],
  }
}

function parse(value: MobileScanResolveResult): MobileScanResolveResult {
  return mobileScanResolveResultSchema.parse(value)
}
