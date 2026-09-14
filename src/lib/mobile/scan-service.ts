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
import { lookupCatalogProductByIdentifier } from "@/lib/scan/identifier-lookup"
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
}

export type MobileScanResolveInput = {
  productId?: string
  identifier?: { type: "ean"; value: string }
}

/**
 * Native-only domain service. Its caller authenticates and derives the owner/context; this
 * module performs no entitlement, saved-state, routine, or mutation work.
 */
export async function resolveMobileScan(
  client: SupabaseClient,
  context: ScanEvaluationContext | null,
  input: MobileScanResolveInput,
): Promise<MobileScanResolveResult> {
  if (!context)
    return parse({ contractVersion: MOBILE_SCAN_CONTRACT_VERSION, kind: "profile_required" })
  const matched = await findProduct(client, input)
  if (!matched)
    return parse({
      contractVersion: MOBILE_SCAN_CONTRACT_VERSION,
      kind: "submission_required",
      productId: null,
      missingFacts: ["unknown_product"],
    })
  const product = toMobileProduct(matched)
  const category = matched.category_key as PersonalPlanCategory
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

  const loaded = await loadVerdict(client, category, matched.id, decision, context)
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
      productId: matched.id,
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
    matched.id,
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
      .select("id,name,brand,category_key,image_url,sort_order")
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
        `${row.brand ?? ""} ${row.name}`.toLocaleLowerCase().includes(normalized),
    )
    .sort(
      (a, b) =>
        (`${a.brand ?? ""} ${a.name}`.trim().toLocaleLowerCase() === normalized ? -1 : 0) -
          (`${b.brand ?? ""} ${b.name}`.trim().toLocaleLowerCase() === normalized ? -1 : 0) ||
        (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, "de") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
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
): Promise<ProductRow | null> {
  if (input.productId) {
    if (await isProductSearchQuarantined(client, input.productId)) return null
    return loadProductById(client, input.productId)
  }
  if (!input.identifier) return null
  const match = await lookupCatalogProductByIdentifier(client, input.identifier)
  if (!match || (await isProductSearchQuarantined(client, match.productId))) return null
  return loadProductById(client, match.productId)
}

async function loadProductById(client: SupabaseClient, id: string): Promise<ProductRow | null> {
  const { data, error } = await client
    .from("products")
    .select(
      "id,name,brand,category_key,image_url,price_eur,currency,affiliate_link,purchase_link_status,price_checked_at",
    )
    .eq("id", id)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .maybeSingle()
  if (error) throw new Error("mobile_scan_product_lookup_unavailable")
  return data as ProductRow | null
}

function toMobileProduct(row: ProductRow): MobileScanProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
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
