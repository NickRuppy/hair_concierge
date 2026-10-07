import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildBrandResolutionCatalog,
  resolveBrandFromText,
  type BrandResolutionCatalogInput,
  type ProductIdentityBrandAlias,
  type ProductIdentityBrand,
  type ProductIdentityProductLine,
} from "@/lib/product-identity/brand-resolution"
import { canonicalizeGtin, normalizeIdentityText } from "@/lib/product-identity/normalize"
import type {
  JsonRecord,
  ProductIntakeSubmissionDetail,
  ProductIntakeReviewDecisionRow,
} from "@chaarlie/product-intake-core"

type ScannedIdentifierPacketValue = { type: string; value: string } | null
type SupabaseQueryResult<T> = { data: T | null; error: { message?: string } | null }

export type BrandResolutionPromptContext = {
  submitted_brand_text: string | null
  submitted_product_name_text: string | null
  scanned_identifier: ScannedIdentifierPacketValue
  lookup_text: string
  resolved_brand: JsonRecord | null
  nearby_brand_options: JsonRecord[]
  catalog_summary: JsonRecord
  rules: string[]
}

export async function loadBrandResolutionContext(
  supabase: SupabaseClient,
  detail: ProductIntakeSubmissionDetail | null,
  scannedIdentifier: ScannedIdentifierPacketValue,
): Promise<BrandResolutionPromptContext & { catalog: BrandResolutionCatalogInput }> {
  const catalogInput = await loadBrandResolutionCatalogForWorker(supabase)
  return {
    ...buildBrandResolutionPromptContext(detail, catalogInput, scannedIdentifier),
    catalog: catalogInput,
  }
}

export async function loadBrandResolutionCatalogForWorker(
  supabase: SupabaseClient,
): Promise<BrandResolutionCatalogInput> {
  const [brandsResult, productLinesResult, brandAliasesResult] = await Promise.all([
    supabase.from("brands").select("id, canonical_name, normalized_name"),
    supabase.from("product_lines").select("id, brand_id, canonical_name, normalized_name"),
    supabase.from("brand_aliases").select("brand_id, product_line_id, alias, normalized_alias"),
  ])

  return {
    brands: requireSupabaseData<ProductIdentityBrand[]>(
      brandsResult as unknown as SupabaseQueryResult<ProductIdentityBrand[]>,
      "load brands for product-intake Codex worker",
    ),
    productLines: requireSupabaseData<ProductIdentityProductLine[]>(
      productLinesResult as unknown as SupabaseQueryResult<ProductIdentityProductLine[]>,
      "load product lines for product-intake Codex worker",
    ),
    brandAliases: requireSupabaseData<ProductIdentityBrandAlias[]>(
      brandAliasesResult as unknown as SupabaseQueryResult<ProductIdentityBrandAlias[]>,
      "load brand aliases for product-intake Codex worker",
    ),
  }
}

function requireSupabaseData<T>(result: SupabaseQueryResult<T>, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message ?? "unknown Supabase error"}`)
  }
  if (result.data === null) {
    throw new Error(`${label}: no data returned`)
  }
  return result.data
}

export function buildBrandResolutionPromptContext(
  detail: ProductIntakeSubmissionDetail | null,
  catalogInput: BrandResolutionCatalogInput,
  scannedIdentifier: ScannedIdentifierPacketValue,
): BrandResolutionPromptContext {
  const catalog = buildBrandResolutionCatalog(catalogInput)
  const submittedBrand = detail?.brand ?? null
  const submittedProductName = detail?.product_name ?? null
  const lookupText = [submittedBrand, submittedProductName].filter(Boolean).join(" ").trim()
  const resolution = lookupText ? resolveBrandFromText(lookupText, catalog) : null
  const resolvedBrand =
    resolution && resolution.match !== "none" && resolution.brand
      ? {
          match: resolution.match,
          confidence: resolution.confidence,
          reason: resolution.reason,
          matched_text: resolution.matchedText,
          canonical_brand_id: brandIdValue(resolution.brand),
          canonical_brand: brandLabel(resolution.brand),
          product_line_id: resolution.productLine
            ? productLineIdValue(resolution.productLine)
            : null,
          product_line: resolution.productLine ? productLineLabel(resolution.productLine) : null,
        }
      : null

  return {
    submitted_brand_text: submittedBrand,
    submitted_product_name_text: submittedProductName,
    scanned_identifier: scannedIdentifier,
    lookup_text: lookupText,
    resolved_brand: resolvedBrand,
    nearby_brand_options: resolvedBrand ? [] : nearbyBrandOptions(lookupText, catalogInput.brands),
    catalog_summary: {
      brand_count: catalogInput.brands.length,
      product_line_count: catalogInput.productLines?.length ?? 0,
      brand_alias_count: catalogInput.brandAliases?.length ?? 0,
      alias_conflict_count: catalog.conflicts.length,
    },
    rules: [
      "Use resolved_brand.canonical_brand exactly for final.product.canonical_brand when resolved_brand is present.",
      "Use resolved_brand.product_line exactly for final.product.product_line when resolved_brand.product_line is present.",
      "If resolved_brand is null and review_decisions includes an approved product.canonical_brand, use that reviewed DB-ready brand spelling exactly.",
      "If review_decisions includes approved product.product_line or product.clean_name, use those reviewed DB-ready product identity fields exactly.",
      "If resolved_brand is null, do not invent a canonical brand spelling. Add a blocker requesting canonical brand resolution or new-brand approval.",
      "The review cockpit must show DB-ready brand values, not prose explanations.",
    ],
  }
}

function enforceCanonicalBrandResolution(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
): void {
  const product = normalizeRecord(final?.product)
  const resolved = normalizeRecord(brandResolutionContext.resolved_brand)
  const canonicalBrand = stringValue(resolved?.canonical_brand)
  if (!product || !canonicalBrand) return

  product.canonical_brand = canonicalBrand
  const productLine = stringValue(resolved?.product_line)
  if (productLine) product.product_line = productLine
}

function applyApprovedCanonicalBrand(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): void {
  if (normalizeRecord(brandResolutionContext.resolved_brand)) return
  const product = normalizeRecord(final?.product)
  if (!product) return

  const approvedBrand = approvedCanonicalBrandFromReview(reviewDecisions)
  if (!approvedBrand) return

  product.canonical_brand = approvedBrand
}

function applyApprovedProductIdentity(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): void {
  const product = normalizeRecord(final?.product)
  if (!product) return

  const identity = approvedProductIdentityFromReview(reviewDecisions)
  if (!normalizeRecord(brandResolutionContext.resolved_brand) && identity.canonicalBrand) {
    product.canonical_brand = identity.canonicalBrand
  }
  if (identity.hasProductLine) {
    product.product_line = identity.productLine
  }
  if (identity.cleanName) {
    product.clean_name = identity.cleanName
  }
}

export function approvedCanonicalBrandFromReview(
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): string | null {
  for (const decision of reviewDecisions) {
    if (decision.field_path !== "product.canonical_brand") continue
    if (decision.decision !== "approved") continue

    const reviewerValue = normalizeRecord(decision.reviewer_value)
    const proposedValue = normalizeRecord(decision.proposed_value)
    const approvedBrand =
      stringValue(reviewerValue?.canonical_brand) ??
      stringValue(reviewerValue?.canonicalName) ??
      stringValue(proposedValue?.canonical_brand) ??
      stringValue(proposedValue?.canonicalName)
    if (approvedBrand) return approvedBrand
  }

  return null
}

function approvedProductIdentityFromReview(reviewDecisions: ProductIntakeReviewDecisionRow[]): {
  canonicalBrand: string | null
  hasProductLine: boolean
  productLine: string | null
  cleanName: string | null
} {
  const identity = {
    canonicalBrand: null as string | null,
    hasProductLine: false,
    productLine: null as string | null,
    cleanName: null as string | null,
  }

  for (const decision of reviewDecisions) {
    if (decision.decision !== "approved") continue
    const reviewerValue = normalizeRecord(decision.reviewer_value)
    const proposedValue = normalizeRecord(decision.proposed_value)

    if (decision.field_path === "product.canonical_brand") {
      identity.canonicalBrand =
        stringValue(reviewerValue?.canonical_brand) ??
        stringValue(reviewerValue?.canonicalName) ??
        stringValue(proposedValue?.canonical_brand) ??
        stringValue(proposedValue?.canonicalName) ??
        identity.canonicalBrand
    }

    if (decision.field_path === "product.product_line") {
      identity.hasProductLine = true
      identity.productLine =
        stringValue(reviewerValue?.product_line) ?? stringValue(proposedValue?.product_line)
    }

    if (decision.field_path === "product.clean_name") {
      identity.cleanName =
        stringValue(reviewerValue?.clean_name) ??
        stringValue(reviewerValue?.cleanName) ??
        stringValue(proposedValue?.clean_name) ??
        stringValue(proposedValue?.cleanName) ??
        identity.cleanName
    }
  }

  return identity
}

function canonicalBrandResolutionBlocker(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): string | null {
  const product = normalizeRecord(final?.product)
  if (!product) return null
  if (normalizeRecord(brandResolutionContext.resolved_brand)) return null
  if (approvedCanonicalBrandFromReview(reviewDecisions)) return null
  if (!brandResolutionContext.lookup_text) return null
  return `canonical brand table resolution missing for: ${brandResolutionContext.lookup_text}`
}

function nearbyBrandOptions(
  lookupText: string,
  brands: readonly ProductIdentityBrand[],
  aliases: readonly ProductIdentityBrandAlias[] = [],
): JsonRecord[] {
  const lookupTokens = new Set(
    normalizeIdentityText(lookupText)
      .split(" ")
      .filter((token) => token.length >= 3),
  )
  if (lookupTokens.size === 0) return []

  return brands
    .map((brand) => {
      const label = brandLabel(brand)
      const normalized = normalizeIdentityText(label)
      const exactAlias = aliases.some(
        (alias) =>
          (alias.brand_id ?? alias.brandId) === brandIdValue(brand) &&
          normalizeIdentityText(alias.normalized_alias ?? alias.normalizedAlias ?? alias.alias) ===
            normalizeIdentityText(lookupText),
      )
      const score = exactAlias
        ? 100
        : normalized.split(" ").filter((token) => lookupTokens.has(token)).length
      return { brand, label, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 20)
    .map((candidate) => ({
      canonical_brand_id: brandIdValue(candidate.brand),
      canonical_brand: candidate.label,
    }))
}

function brandIdValue(brand: ProductIdentityBrand): string | null {
  return brand.id ?? brand.key ?? brand.canonical_name ?? brand.canonicalName ?? brand.name ?? null
}

function productLineIdValue(line: ProductIdentityProductLine): string | null {
  return line.id ?? line.key ?? line.canonical_name ?? line.canonicalName ?? line.name ?? null
}

function brandLabel(brand: ProductIdentityBrand): string {
  return brand.canonical_name ?? brand.canonicalName ?? brand.name ?? brand.key ?? brand.id ?? ""
}

function productLineLabel(line: ProductIdentityProductLine): string {
  return line.canonical_name ?? line.canonicalName ?? line.name ?? line.key ?? line.id ?? ""
}

function normalizeRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

type IdentityArtifact = { kind: string; status?: string; payload: JsonRecord }

/** Model proposals must match the whole normalized label, never a fuzzy or prefix match. */
function resolveModelProposal(
  proposed: string,
  input: BrandResolutionCatalogInput,
): JsonRecord | null {
  const normalized = normalizeIdentityText(proposed)
  if (!normalized) return null
  const matches = new Map<
    string | null,
    { brand: ProductIdentityBrand; lines: ProductIdentityProductLine[] }
  >()
  for (const brand of input.brands) {
    const id = brandIdValue(brand)
    const labels = [
      brandLabel(brand),
      brand.normalized_name,
      brand.normalizedName,
      ...(brand.aliases ?? []),
    ]
    const aliases = (input.brandAliases ?? []).filter(
      (alias) =>
        (alias.brand_id ?? alias.brandId) === id &&
        normalizeIdentityText(alias.normalized_alias ?? alias.normalizedAlias ?? alias.alias) ===
          normalized,
    )
    if (
      !labels.some((label) => label && normalizeIdentityText(label) === normalized) &&
      aliases.length === 0
    )
      continue
    const lines = [...(input.productLines ?? []), ...(brand.productLines ?? [])]
    matches.set(id, {
      brand,
      lines: aliases.flatMap((alias) => {
        const lineId = alias.product_line_id ?? alias.productLineId
        const line = lineId
          ? lines.find((candidate) => productLineIdValue(candidate) === lineId)
          : null
        return line ? [line] : []
      }),
    })
  }
  if (matches.size !== 1) return null
  const match = [...matches.values()][0]!
  const lineIds = new Set(match.lines.map(productLineIdValue))
  const line = lineIds.size === 1 ? match.lines[0] : null
  return {
    canonical_brand: brandLabel(match.brand),
    canonical_brand_id: brandIdValue(match.brand),
    product_line: line ? productLineLabel(line) : null,
    product_line_id: line ? productLineIdValue(line) : null,
  }
}

export function applyIdentityStage(input: {
  final: JsonRecord | null | undefined
  context: BrandResolutionPromptContext
  reviewDecisions: ProductIntakeReviewDecisionRow[]
  artifacts: IdentityArtifact[]
  brandCatalog?: BrandResolutionCatalogInput
}): string | null {
  const { final, context, reviewDecisions, artifacts, brandCatalog } = input
  const product = normalizeRecord(final?.product)
  const proposed = stringValue(product?.canonical_brand)
  const reviewedBrand = approvedCanonicalBrandFromReview(reviewDecisions)
  const submitted = normalizeRecord(context.resolved_brand)
  const brandReviewRequiresAction = reviewDecisions.some(
    (decision) =>
      decision.field_path === "product.canonical_brand" && decision.decision !== "approved",
  )
  const modelResolution =
    !brandReviewRequiresAction && !submitted && !reviewedBrand && proposed && brandCatalog
      ? resolveModelProposal(proposed, brandCatalog)
      : null
  const effectiveContext = modelResolution
    ? { ...context, resolved_brand: modelResolution }
    : context
  applyApprovedCanonicalBrand(final, effectiveContext, reviewDecisions)
  enforceCanonicalBrandResolution(final, effectiveContext)
  applyApprovedProductIdentity(final, effectiveContext, reviewDecisions)
  const resolved = submitted ?? modelResolution
  const source = submitted
    ? "submitted_text"
    : reviewedBrand
      ? "review_decision"
      : proposed
        ? "model_proposal"
        : "none"
  const candidates =
    resolved || reviewedBrand
      ? []
      : proposed && brandCatalog
        ? nearbyBrandOptions(proposed, brandCatalog.brands, brandCatalog.brandAliases)
        : context.nearby_brand_options
  const identifiers = Array.isArray(final?.identifiers) ? final.identifiers : []
  const gtins = identifiers.flatMap((value) => {
    const identifier = normalizeRecord(value)
    if (!identifier || !["ean", "gtin", "barcode"].includes(String(identifier.type))) return []
    const gtin = typeof identifier.value === "string" ? canonicalizeGtin(identifier.value) : null
    return gtin ? [gtin] : []
  })
  for (let index = artifacts.length - 1; index >= 0; index--) {
    if (
      artifacts[index]!.kind === "identity_candidate" &&
      artifacts[index]!.payload.stage === "identity"
    )
      artifacts.splice(index, 1)
  }
  artifacts.push({
    kind: "identity_candidate",
    status: resolved || reviewedBrand ? "resolved" : "needs_review",
    payload: {
      stage: "identity",
      brand_resolution: {
        source,
        canonical_brand: stringValue(product?.canonical_brand),
        canonical_brand_id: resolved?.canonical_brand_id ?? null,
        product_line: stringValue(product?.product_line),
        proposed_brand: proposed,
        nearby_brand_options: candidates,
      },
      gtins: [...new Set(gtins)],
      net_content:
        typeof product?.net_content_value === "number" &&
        product.net_content_value > 0 &&
        ["ml", "g"].includes(String(product.net_content_unit))
          ? { value: product.net_content_value, unit: product.net_content_unit }
          : null,
    },
  })
  return canonicalBrandResolutionBlocker(
    final,
    {
      ...effectiveContext,
      lookup_text: context.lookup_text || (brandCatalog ? (proposed ?? "") : ""),
    },
    reviewDecisions,
  )
}
