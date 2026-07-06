import {
  normalizeIdentifierValue,
  normalizeIdentityText,
  tokenizeProductName,
} from "../product-identity/normalize"
import type { ProductIntakeCategoryKey } from "../types"

export type ProductIdentifierType = "ean" | "gtin" | "barcode" | "retailer_sku" | "retailer_url"

const BARCODE_IDENTIFIER_TYPES = new Set(["ean", "gtin", "barcode"])

export type ProductIntakeCatalogProduct = {
  id: string
  name: string
  cleanName?: string | null
  brandId?: string | null
  brand_id?: string | null
  productLineId?: string | null
  product_line_id?: string | null
  categoryKey?: string | null
  category_key?: string | null
  isActive?: boolean | null
  is_active?: boolean | null
  lifecycleStatus?: string | null
  lifecycle_status?: string | null
  isChaarlieRecommended?: boolean | null
  is_chaarlie_recommended?: boolean | null
  knownTitles?: string[] | null
  known_titles?: string[] | null
}

export type ProductIntakeCatalogIdentifier = {
  productId?: string
  product_id?: string
  identifierType?: ProductIdentifierType | string
  identifier_type?: ProductIdentifierType | string
  identifierValue?: string
  identifier_value?: string
  normalizedIdentifierValue?: string
  normalized_identifier_value?: string
  source?: string | null
}

export type ProductIntakeCatalog = {
  products: readonly ProductIntakeCatalogProduct[]
  identifiers?: readonly ProductIntakeCatalogIdentifier[]
}

export type ProductIntakeIdentifierInput = {
  type?: ProductIdentifierType | string | null
  value: string
  source?: string | null
}

export type ProductIntakeMatchInput = {
  selectedCategoryKey?: ProductIntakeCategoryKey | string | null
  identifier?: ProductIntakeIdentifierInput | string | null
  brandId?: string | null
  brand_id?: string | null
  productLineId?: string | null
  product_line_id?: string | null
  cleanProductName?: string | null
  productName?: string | null
}

export type ProductIntakeMatchStatus = "matched" | "pending_review" | "needs_more_info" | "rejected"

export type ProductIntakeMatchReason =
  | "identifier_category_exact"
  | "identifier_requires_category_review"
  | "identifier_category_mismatch_review"
  | "identifier_ambiguous_review"
  | "identifier_source_mismatch_review"
  | "brand_line_name_category_exact"
  | "brand_name_category_exact"
  | "fuzzy_candidates_review"
  | "text_category_mismatch_review"
  | "category_required"
  | "insufficient_identity"
  | "invalid_identifier"

export type ProductIntakeMatchCandidate = {
  product: ProductIntakeCatalogProduct
  productId: string
  confidence: "exact" | "review"
  reason: ProductIntakeMatchReason
  reasonCodes: ProductIntakeMatchReason[]
}

export type ProductIntakeMatchResult = {
  status: ProductIntakeMatchStatus
  matchedProduct: ProductIntakeCatalogProduct | null
  productId: string | null
  candidates: ProductIntakeMatchCandidate[]
  confidence: "exact" | "review" | "none"
  reason: ProductIntakeMatchReason
  reasonCodes: ProductIntakeMatchReason[]
  missingFields: string[]
}

type IdentifierMatchEvidence = {
  product: ProductIntakeCatalogProduct
  autoLinkEligible: boolean
}

function productBrandId(product: ProductIntakeCatalogProduct): string | null {
  return product.brandId ?? product.brand_id ?? null
}

function productLineId(product: ProductIntakeCatalogProduct): string | null {
  return product.productLineId ?? product.product_line_id ?? null
}

function productCategoryKey(product: ProductIntakeCatalogProduct): string | null {
  return product.categoryKey ?? product.category_key ?? null
}

function productIsActive(product: ProductIntakeCatalogProduct): boolean {
  return product.isActive ?? product.is_active ?? false
}

function productCleanName(product: ProductIntakeCatalogProduct): string {
  return product.cleanName ?? product.name
}

function productKnownTitles(product: ProductIntakeCatalogProduct): string[] {
  return product.knownTitles ?? product.known_titles ?? []
}

export function productNameVariants(product: ProductIntakeCatalogProduct): string[] {
  const seen = new Set<string>()
  return [productCleanName(product), product.name, ...productKnownTitles(product)]
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function identifierProductId(identifier: ProductIntakeCatalogIdentifier): string {
  return identifier.productId ?? identifier.product_id ?? ""
}

function identifierType(identifier: ProductIntakeCatalogIdentifier): string {
  return normalizeIdentifierType(identifier.identifierType ?? identifier.identifier_type ?? "")
}

function normalizeIdentifierType(type: string | null | undefined): string {
  return type?.trim().toLowerCase() ?? ""
}

function identifierTypesCompatible(inputType: string | null, catalogType: string): boolean {
  if (!inputType) return true
  if (BARCODE_IDENTIFIER_TYPES.has(inputType) && BARCODE_IDENTIFIER_TYPES.has(catalogType)) {
    return true
  }

  return inputType === catalogType
}

function identifierValueForType(value: string, type: string): string {
  if (BARCODE_IDENTIFIER_TYPES.has(type)) {
    const normalized = normalizeIdentifierValue(value)
    return normalized.replace(/[^\p{Letter}\p{Number}]+/gu, "")
  }

  return value.toLowerCase().replace(/\s+/g, "").trim()
}

function identifierValue(identifier: ProductIntakeCatalogIdentifier): string {
  const type = identifierType(identifier)
  const value =
    identifier.normalizedIdentifierValue ??
    identifier.normalized_identifier_value ??
    identifier.identifierValue ??
    identifier.identifier_value ??
    ""

  return identifierValueForType(value, type)
}

function normalizeIdentifierSource(source: string | null | undefined): string | null {
  const normalized = source?.trim().toLowerCase() ?? ""
  return normalized || null
}

function identifierAutoLinkEligible(params: {
  type: string | null
  inputSource: string | null
  catalogSource: string | null
}): boolean {
  if (params.type !== "retailer_sku") return true

  return Boolean(
    params.inputSource && params.catalogSource && params.inputSource === params.catalogSource,
  )
}

function inputBrandId(input: ProductIntakeMatchInput): string | null {
  return input.brandId ?? input.brand_id ?? null
}

function inputLineId(input: ProductIntakeMatchInput): string | null {
  return input.productLineId ?? input.product_line_id ?? null
}

function inputCleanName(input: ProductIntakeMatchInput): string {
  return input.cleanProductName ?? input.productName ?? ""
}

function normalizeIdentifierInput(
  identifier: ProductIntakeIdentifierInput | string | null | undefined,
): { type: string | null; rawValue: string; source: string | null } | null {
  if (!identifier) return null

  if (typeof identifier === "string") {
    const value = normalizeIdentifierValue(identifier)
    return value ? { type: null, rawValue: identifier, source: null } : null
  }

  const value = normalizeIdentifierValue(identifier.value)
  return value
    ? {
        type: normalizeIdentifierType(identifier.type) || null,
        rawValue: identifier.value,
        source: normalizeIdentifierSource(identifier.source),
      }
    : null
}

function exactCandidate(
  product: ProductIntakeCatalogProduct,
  reason: ProductIntakeMatchReason,
): ProductIntakeMatchCandidate {
  return { product, productId: product.id, confidence: "exact", reason, reasonCodes: [reason] }
}

function reviewCandidate(
  product: ProductIntakeCatalogProduct,
  reason: ProductIntakeMatchReason,
): ProductIntakeMatchCandidate {
  return { product, productId: product.id, confidence: "review", reason, reasonCodes: [reason] }
}

function reviewCandidatesByCategory(
  products: readonly ProductIntakeCatalogProduct[],
  categoryKey: string,
  sameCategoryReason: ProductIntakeMatchReason,
  crossCategoryReason: ProductIntakeMatchReason,
): ProductIntakeMatchCandidate[] {
  return products.map((product) =>
    reviewCandidate(
      product,
      sameCategory(product, categoryKey) ? sameCategoryReason : crossCategoryReason,
    ),
  )
}

function identifierReviewCandidate(
  evidence: IdentifierMatchEvidence,
  categoryKey: string | null,
  sameCategoryReason: ProductIntakeMatchReason,
): ProductIntakeMatchCandidate {
  if (!categoryKey) {
    return reviewCandidate(evidence.product, "identifier_requires_category_review")
  }

  if (!sameCategory(evidence.product, categoryKey)) {
    return reviewCandidate(evidence.product, "identifier_category_mismatch_review")
  }

  if (!evidence.autoLinkEligible) {
    return reviewCandidate(evidence.product, "identifier_source_mismatch_review")
  }

  return reviewCandidate(evidence.product, sameCategoryReason)
}

function result(
  status: ProductIntakeMatchStatus,
  reason: ProductIntakeMatchReason,
  candidates: ProductIntakeMatchCandidate[] = [],
  matchedProduct: ProductIntakeCatalogProduct | null = null,
  missingFields: string[] = [],
): ProductIntakeMatchResult {
  return {
    status,
    matchedProduct,
    productId: matchedProduct?.id ?? null,
    candidates,
    confidence: status === "matched" ? "exact" : candidates.length > 0 ? "review" : "none",
    reason,
    reasonCodes: [reason],
    missingFields,
  }
}

function activeProducts(catalog: ProductIntakeCatalog): ProductIntakeCatalogProduct[] {
  return catalog.products.filter(productIsActive)
}

function sameCategory(product: ProductIntakeCatalogProduct, categoryKey: string): boolean {
  return productCategoryKey(product) === categoryKey
}

function sameBrand(product: ProductIntakeCatalogProduct, brandId: string | null): boolean {
  return Boolean(brandId) && productBrandId(product) === brandId
}

function sameLine(product: ProductIntakeCatalogProduct, lineId: string | null): boolean {
  return Boolean(lineId) && productLineId(product) === lineId
}

function normalizedProductName(product: ProductIntakeCatalogProduct): string {
  return normalizeIdentityText(productCleanName(product))
}

function normalizedProductNameVariants(product: ProductIntakeCatalogProduct): string[] {
  return productNameVariants(product).map(normalizeIdentityText).filter(Boolean)
}

function productNameMatches(
  product: ProductIntakeCatalogProduct,
  normalizedInputName: string,
): boolean {
  return normalizedProductNameVariants(product).includes(normalizedInputName)
}

function categoryExactMatches(
  products: readonly ProductIntakeCatalogProduct[],
  categoryKey: string,
): ProductIntakeCatalogProduct[] {
  return products.filter((product) => sameCategory(product, categoryKey))
}

function allIdentifierMatches(
  inputIdentifier: { type: string | null; rawValue: string; source: string | null },
  catalog: ProductIntakeCatalog,
): IdentifierMatchEvidence[] {
  const productsById = new Map(activeProducts(catalog).map((product) => [product.id, product]))
  const evidenceByProductId = new Map<string, IdentifierMatchEvidence>()

  for (const identifier of catalog.identifiers ?? []) {
    const catalogType = identifierType(identifier)
    if (!identifierTypesCompatible(inputIdentifier.type, catalogType)) {
      continue
    }

    if (
      identifierValue(identifier) !== identifierValueForType(inputIdentifier.rawValue, catalogType)
    ) {
      continue
    }

    const productId = identifierProductId(identifier)
    const product = productsById.get(productId)
    if (!product) continue

    const existing = evidenceByProductId.get(productId)
    const autoLinkEligible = identifierAutoLinkEligible({
      type: inputIdentifier.type || catalogType,
      inputSource: inputIdentifier.source,
      catalogSource: normalizeIdentifierSource(identifier.source),
    })

    evidenceByProductId.set(productId, {
      product,
      autoLinkEligible: Boolean(existing?.autoLinkEligible || autoLinkEligible),
    })
  }

  return Array.from(evidenceByProductId.values())
}

function fuzzyTextCandidates(
  input: ProductIntakeMatchInput,
  catalog: ProductIntakeCatalog,
): ProductIntakeCatalogProduct[] {
  const brandId = inputBrandId(input)
  const lineId = inputLineId(input)
  const inputTokens = new Set(tokenizeProductName(inputCleanName(input)))
  if (!brandId || inputTokens.size === 0) return []

  return activeProducts(catalog)
    .filter((product) => sameBrand(product, brandId))
    .filter((product) => (!lineId ? true : sameLine(product, lineId)))
    .map((product) => {
      const overlap = Math.max(
        ...productNameVariants(product).map((variant) => {
          const productTokens = new Set(tokenizeProductName(variant))
          return Array.from(inputTokens).filter((token) => productTokens.has(token)).length
        }),
      )
      return { product, overlap }
    })
    .filter(({ overlap }) => overlap > 0)
    .sort(
      (left, right) =>
        right.overlap - left.overlap || left.product.name.localeCompare(right.product.name, "de"),
    )
    .slice(0, 5)
    .map(({ product }) => product)
}

export function matchProductIntake(
  input: ProductIntakeMatchInput,
  catalog: ProductIntakeCatalog,
): ProductIntakeMatchResult {
  const selectedCategoryKey = input.selectedCategoryKey ?? null
  const identifier = normalizeIdentifierInput(input.identifier)

  if (input.identifier && !identifier) {
    return result("rejected", "invalid_identifier")
  }

  if (identifier) {
    const identifierEvidence = allIdentifierMatches(identifier, catalog)
    const identifierMatches = identifierEvidence.map((evidence) => evidence.product)
    const candidates = identifierEvidence.map((evidence) =>
      identifierReviewCandidate(evidence, selectedCategoryKey, "identifier_ambiguous_review"),
    )

    if (!selectedCategoryKey) {
      return result("pending_review", "identifier_requires_category_review", candidates)
    }

    const sameCategoryEvidence = identifierEvidence.filter((evidence) =>
      sameCategory(evidence.product, selectedCategoryKey),
    )
    const sameCategoryMatches = sameCategoryEvidence.map((evidence) => evidence.product)

    if (
      sameCategoryEvidence.length === 1 &&
      sameCategoryEvidence[0].autoLinkEligible &&
      identifierMatches.length === 1
    ) {
      return result(
        "matched",
        "identifier_category_exact",
        [exactCandidate(sameCategoryMatches[0], "identifier_category_exact")],
        sameCategoryMatches[0],
      )
    }

    if (sameCategoryMatches.length > 1) {
      return result(
        "pending_review",
        "identifier_ambiguous_review",
        identifierEvidence.map((evidence) =>
          identifierReviewCandidate(evidence, selectedCategoryKey, "identifier_ambiguous_review"),
        ),
      )
    }

    if (identifierMatches.length > 0) {
      const reason = sameCategoryEvidence.some((evidence) => !evidence.autoLinkEligible)
        ? "identifier_source_mismatch_review"
        : "identifier_category_mismatch_review"

      return result("pending_review", reason, candidates)
    }
  }

  if (!selectedCategoryKey) {
    return result("needs_more_info", "category_required", [], null, ["category"])
  }

  const brandId = inputBrandId(input)
  const lineId = inputLineId(input)
  const normalizedInputName = normalizeIdentityText(inputCleanName(input))

  if (!brandId || !normalizedInputName) {
    const missingFields = [
      ...(brandId ? [] : ["brandText"]),
      ...(normalizedInputName ? [] : ["productNameText"]),
    ]
    return result("needs_more_info", "insufficient_identity", [], null, missingFields)
  }

  const products = activeProducts(catalog)
  const lineMatches = lineId
    ? products.filter(
        (product) =>
          sameBrand(product, brandId) &&
          sameLine(product, lineId) &&
          productNameMatches(product, normalizedInputName),
      )
    : []
  const sameCategoryLineMatches = categoryExactMatches(lineMatches, selectedCategoryKey)

  if (sameCategoryLineMatches.length === 1 && lineMatches.length === 1) {
    return result(
      "matched",
      "brand_line_name_category_exact",
      [exactCandidate(sameCategoryLineMatches[0], "brand_line_name_category_exact")],
      sameCategoryLineMatches[0],
    )
  }

  if (sameCategoryLineMatches.length > 1) {
    return result(
      "pending_review",
      "fuzzy_candidates_review",
      reviewCandidatesByCategory(
        lineMatches,
        selectedCategoryKey,
        "fuzzy_candidates_review",
        "text_category_mismatch_review",
      ),
    )
  }

  if (lineMatches.length > 0) {
    return result(
      "pending_review",
      "text_category_mismatch_review",
      reviewCandidatesByCategory(
        lineMatches,
        selectedCategoryKey,
        "fuzzy_candidates_review",
        "text_category_mismatch_review",
      ),
    )
  }

  const brandNameMatches = products.filter(
    (product) =>
      sameBrand(product, brandId) &&
      productNameMatches(product, normalizedInputName) &&
      (!lineId || !productLineId(product)),
  )
  const sameCategoryBrandNameMatches = categoryExactMatches(brandNameMatches, selectedCategoryKey)

  if (sameCategoryBrandNameMatches.length === 1 && brandNameMatches.length === 1) {
    return result(
      "matched",
      "brand_name_category_exact",
      [exactCandidate(sameCategoryBrandNameMatches[0], "brand_name_category_exact")],
      sameCategoryBrandNameMatches[0],
    )
  }

  if (sameCategoryBrandNameMatches.length > 1) {
    return result(
      "pending_review",
      "fuzzy_candidates_review",
      reviewCandidatesByCategory(
        brandNameMatches,
        selectedCategoryKey,
        "fuzzy_candidates_review",
        "text_category_mismatch_review",
      ),
    )
  }

  if (brandNameMatches.length > 0) {
    return result(
      "pending_review",
      "text_category_mismatch_review",
      reviewCandidatesByCategory(
        brandNameMatches,
        selectedCategoryKey,
        "fuzzy_candidates_review",
        "text_category_mismatch_review",
      ),
    )
  }

  const fuzzyCandidates = fuzzyTextCandidates(input, catalog)

  if (fuzzyCandidates.length > 0) {
    return result(
      "pending_review",
      "fuzzy_candidates_review",
      reviewCandidatesByCategory(
        fuzzyCandidates,
        selectedCategoryKey,
        "fuzzy_candidates_review",
        "text_category_mismatch_review",
      ),
    )
  }

  return result("pending_review", "fuzzy_candidates_review")
}
