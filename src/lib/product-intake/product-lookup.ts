import { cleanProductDisplayName, normalizeCategoryKey } from "@/lib/product-identity"
import { tokenizeProductName } from "@/lib/product-identity/normalize"
import {
  buildBrandResolutionCatalog,
  resolveBrandFromText,
  type BrandResolutionCatalogInput,
  type ProductIdentityBrand,
  type ProductIdentityProductLine,
} from "@/lib/product-identity/brand-resolution"
import {
  matchProductIntake,
  productNameVariants,
  type ProductIntakeCatalog,
  type ProductIntakeCatalogProduct,
  type ProductIntakeMatchCandidate,
} from "@/lib/product-intake/product-matching"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import {
  isProductEligibleForMode,
  productIsChaarlieRecommended,
  type ProductEligibilityContext,
} from "@/lib/product-catalog/eligibility"
import type { ProductIntakeCategoryKey, ProductIntakeOffer } from "@/lib/types"

export type ProductLookupCatalog = ProductIntakeCatalog

export type ProductLookupStatus =
  | "found_exact"
  | "ambiguous"
  | "needs_variant_selection"
  | "category_mismatch"
  | "not_found"
  | "insufficient_identity"
  | "unsupported_category"

export type ProductLookupInput = {
  category?: string | null
  brand_id?: string | null
  brand_text?: string | null
  product_line_id?: string | null
  product_name_text?: string | null
}

export type ProductLookupResult = {
  status: ProductLookupStatus
  category: ProductIntakeCategoryKey | string | null
  product: ProductLookupProduct | null
  candidates: ProductIntakeMatchCandidate[]
  missing_fields: string[]
  intake_offer: ProductIntakeOffer | null
}

export type ProductLookupProduct = {
  id: string
  name: string
  brand_id: string | null
  product_line_id: string | null
  image_url: string | null
  category_key: string | null
  is_chaarlie_recommended: boolean | null
}

export type LookupProductCandidateParams = {
  input: ProductLookupInput
  catalog: ProductLookupCatalog
  brandCatalog?: BrandResolutionCatalogInput | null
  offerId: string
  eligibilityMode?: "user_visible" | "intake_dedupe"
  eligibilityContext?: ProductEligibilityContext
}

const SUPPORTED_CATEGORY_SET = new Set<string>(SUPPORTED_PRODUCT_CATEGORY_KEYS)
const LOW_VALUE_PRODUCT_TOKENS = new Set([
  "shampoo",
  "shampo",
  "shampoing",
  "conditioner",
  "spulung",
  "spuelung",
  "maske",
  "mask",
  "kur",
  "haarkur",
  "leave",
  "in",
  "no",
  "nr",
  "haarol",
  "haaroel",
  "ol",
  "oel",
  "oil",
  "trockenshampoo",
  "dry",
  "deep",
  "cleansing",
  "tiefenreinigungsshampoo",
  "bondbuilder",
  "pflege",
  "produkt",
  "product",
])

const CATEGORY_HINTS: Array<[ProductIntakeCategoryKey, string[]]> = [
  ["deep_cleansing_shampoo", ["tiefenreinigungsshampoo", "deep cleansing shampoo"]],
  ["dry_shampoo", ["trockenshampoo", "dry shampoo"]],
  ["leave_in", ["leave in", "leave-in", "leave"]],
  ["conditioner", ["conditioner", "spulung", "spuelung"]],
  ["mask", ["maske", "mask", "haarkur", "kur"]],
  ["bondbuilder", ["bondbuilder"]],
  ["shampoo", ["shampoo", "shampo", "shampoing"]],
  ["oil", ["haarol", "haaroel", "ol", "oel", "oil"]],
]

type TextLookupCandidate = {
  product: ProductIntakeCatalogProduct
  overlap: number
  exactLike: boolean
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed || null
}

function brandId(brand: ProductIdentityBrand | null): string | null {
  return brand?.id ?? brand?.key ?? null
}

function brandName(brand: ProductIdentityBrand | null): string | null {
  return brand?.canonicalName ?? brand?.canonical_name ?? brand?.name ?? brand?.key ?? null
}

function lineId(line: ProductIdentityProductLine | null): string | null {
  return line?.id ?? line?.key ?? null
}

function lineName(line: ProductIdentityProductLine | null): string | null {
  return line?.canonicalName ?? line?.canonical_name ?? line?.name ?? line?.key ?? null
}

function productCategoryKey(product: ProductIntakeCatalogProduct): string | null {
  return product.categoryKey ?? product.category_key ?? null
}

function productBrandId(product: ProductIntakeCatalogProduct): string | null {
  return product.brandId ?? product.brand_id ?? null
}

function productCleanName(product: ProductIntakeCatalogProduct): string {
  return product.cleanName ?? product.clean_name ?? product.name
}

function productChaarlieRecommended(product: ProductIntakeCatalogProduct): boolean | null {
  return productIsChaarlieRecommended(product)
}

function lookupCatalogForEligibilityMode(
  catalog: ProductLookupCatalog,
  mode: NonNullable<LookupProductCandidateParams["eligibilityMode"]>,
  context?: ProductEligibilityContext,
): ProductLookupCatalog {
  if (mode === "user_visible") {
    return {
      ...catalog,
      products: catalog.products.filter(
        (product) =>
          isProductEligibleForMode(product, "general_recommendation") ||
          isProductEligibleForMode(product, "owned_assessment", context),
      ),
    }
  }

  return {
    ...catalog,
    products: catalog.products.filter((product) =>
      isProductEligibleForMode(product, "intake_dedupe"),
    ),
  }
}

function toLookupProduct(product: ProductIntakeCatalogProduct): ProductLookupProduct {
  return {
    id: product.id,
    name: product.name,
    brand_id: productBrandId(product),
    product_line_id: product.productLineId ?? product.product_line_id ?? null,
    image_url: product.imageUrl ?? product.image_url ?? null,
    category_key: productCategoryKey(product),
    is_chaarlie_recommended: productChaarlieRecommended(product),
  }
}

function emptyResult(params: {
  status: ProductLookupStatus
  category: ProductLookupResult["category"]
  missingFields?: string[]
}): ProductLookupResult {
  return {
    status: params.status,
    category: params.category,
    product: null,
    candidates: [],
    missing_fields: params.missingFields ?? [],
    intake_offer: null,
  }
}

function buildIntakeOffer(params: {
  offerId: string
  category: ProductIntakeCategoryKey
  brandText: string | null
  productNameText: string | null
}): ProductIntakeOffer {
  return {
    id: params.offerId,
    source: "chat",
    reason: "product_lookup_not_found",
    category: params.category,
    extracted_identity: {
      ...(params.brandText ? { brand_text: params.brandText } : {}),
      ...(params.productNameText ? { product_name_text: params.productNameText } : {}),
    },
  }
}

function normalizeLookupToken(token: string): string {
  return token === "nr" ? "no" : token
}

function meaningfulTokenSet(value: string): Set<string> {
  return new Set(meaningfulProductTokens(value))
}

function meaningfulTokenOverlap(left: string, right: string): number {
  const leftTokens = meaningfulTokenSet(left)
  if (leftTokens.size === 0) return 0

  return meaningfulProductTokens(right).filter((token) => leftTokens.has(token)).length
}

function maxMeaningfulTokenOverlap(left: string, variants: string[]): number {
  return Math.max(0, ...variants.map((variant) => meaningfulTokenOverlap(left, variant)))
}

function meaningfulProductTokens(value: string): string[] {
  return tokenizeProductName(value)
    .map(normalizeLookupToken)
    .filter(
      (token) => (token.length > 1 || /^\d+$/.test(token)) && !LOW_VALUE_PRODUCT_TOKENS.has(token),
    )
}

function isStrongExactLike(inputTokens: string[], productTokens: Set<string>): boolean {
  const inputTokenSet = new Set(inputTokens)
  if (inputTokenSet.size === 0 || inputTokenSet.size !== productTokens.size) return false

  return Array.from(inputTokenSet).every((token) => productTokens.has(token))
}

function hasPreciseProductIdentity(value: string): boolean {
  return meaningfulProductTokens(value).length > 0
}

function meaningfulCandidates(params: {
  candidates: ProductIntakeMatchCandidate[]
  productNameText: string
}): ProductIntakeMatchCandidate[] {
  return params.candidates.filter(
    (candidate) =>
      candidate.confidence === "exact" ||
      maxMeaningfulTokenOverlap(params.productNameText, productNameVariants(candidate.product)) > 0,
  )
}

function candidateCategory(candidate: ProductIntakeMatchCandidate): string | null {
  return productCategoryKey(candidate.product)
}

function isSameCategoryCandidate(
  candidate: ProductIntakeMatchCandidate,
  category: ProductIntakeCategoryKey,
): boolean {
  return candidateCategory(candidate) === category
}

function isStrongCategoryMismatchCandidate(params: {
  candidate: ProductIntakeMatchCandidate
  category: ProductIntakeCategoryKey
  productNameText: string
}): boolean {
  if (isSameCategoryCandidate(params.candidate, params.category)) return false
  if (!params.candidate.reasonCodes.includes("text_category_mismatch_review")) return false

  const inputTokens = meaningfulProductTokens(params.productNameText)
  if (inputTokens.length === 0) return false

  const candidateTokens = new Set(
    productNameVariants(params.candidate.product).flatMap((variant) =>
      meaningfulProductTokens(variant),
    ),
  )
  return inputTokens.every((token) => candidateTokens.has(token))
}

function sortLookupCandidates(
  candidates: ProductIntakeMatchCandidate[],
  category: ProductIntakeCategoryKey,
  productNameText: string,
): ProductIntakeMatchCandidate[] {
  return [...candidates].sort((left, right) => {
    const sameCategoryDelta =
      Number(isSameCategoryCandidate(right, category)) -
      Number(isSameCategoryCandidate(left, category))
    if (sameCategoryDelta !== 0) return sameCategoryDelta

    const overlapDelta =
      maxMeaningfulTokenOverlap(productNameText, productNameVariants(right.product)) -
      maxMeaningfulTokenOverlap(productNameText, productNameVariants(left.product))
    if (overlapDelta !== 0) return overlapDelta

    return productCleanName(left.product).localeCompare(productCleanName(right.product), "de")
  })
}

function productCategoryHintFromText(value: string | null): ProductIntakeCategoryKey | null {
  if (!value) return null

  const normalized = ` ${tokenizeProductName(value).join(" ")} `
  for (const [category, aliases] of CATEGORY_HINTS) {
    if (
      aliases.some((alias) => {
        const normalizedAlias = tokenizeProductName(alias).join(" ")
        return normalizedAlias ? normalized.includes(` ${normalizedAlias} `) : false
      })
    ) {
      return category
    }
  }

  return null
}

function toTextLookupCandidate(
  product: ProductIntakeCatalogProduct,
  confidence: ProductIntakeMatchCandidate["confidence"] = "review",
): ProductIntakeMatchCandidate {
  const reason = confidence === "exact" ? "brand_name_category_exact" : "fuzzy_candidates_review"
  return {
    product,
    productId: product.id,
    confidence,
    reason,
    reasonCodes: [reason],
  }
}

function textLookupCandidates(params: {
  catalog: ProductLookupCatalog
  brandId: string
  lineId: string | null
  productNameText: string
}): TextLookupCandidate[] {
  const inputTokens = meaningfulProductTokens(params.productNameText)
  if (inputTokens.length === 0) return []

  return params.catalog.products
    .filter((product) => productBrandId(product) === params.brandId)
    .filter((product) =>
      !params.lineId
        ? true
        : product.productLineId === params.lineId || product.product_line_id === params.lineId,
    )
    .map((product) => {
      const variantMatches = productNameVariants(product).map((variant) => {
        const productTokens = meaningfulTokenSet(variant)
        return {
          overlap: inputTokens.filter((token) => productTokens.has(token)).length,
          exactLike: isStrongExactLike(inputTokens, productTokens),
        }
      })
      const overlap = Math.max(0, ...variantMatches.map((match) => match.overlap))
      return {
        product,
        overlap,
        exactLike: overlap > 0 && variantMatches.some((match) => match.exactLike),
      }
    })
    .filter((candidate) => candidate.overlap > 0)
}

function sortTextLookupCandidates(candidates: TextLookupCandidate[]): TextLookupCandidate[] {
  return [...candidates].sort((left, right) => {
    const exactDelta = Number(right.exactLike) - Number(left.exactLike)
    if (exactDelta !== 0) return exactDelta

    const overlapDelta = right.overlap - left.overlap
    if (overlapDelta !== 0) return overlapDelta

    return productCleanName(left.product).localeCompare(productCleanName(right.product), "de")
  })
}

function findConfidentExactTextCandidate(params: {
  candidates: TextLookupCandidate[]
  category: ProductIntakeCategoryKey
}): TextLookupCandidate | null {
  const exactCandidates = params.candidates.filter(
    (candidate) => candidate.exactLike && productCategoryKey(candidate.product) === params.category,
  )

  return exactCandidates.length === 1 ? exactCandidates[0] : null
}

function lookupWithoutCategory(params: {
  catalog: ProductLookupCatalog
  brandId: string
  lineId: string | null
  productNameText: string
}): ProductLookupResult {
  const candidates = sortTextLookupCandidates(
    textLookupCandidates({
      catalog: params.catalog,
      brandId: params.brandId,
      lineId: params.lineId,
      productNameText: params.productNameText,
    }),
  )
  const exactCandidates = candidates.filter((candidate) => candidate.exactLike)

  if (exactCandidates.length === 1) {
    const product = exactCandidates[0].product
    return {
      status: "found_exact",
      category: productCategoryKey(product),
      product: toLookupProduct(product),
      candidates: [toTextLookupCandidate(product, "exact")],
      missing_fields: [],
      intake_offer: null,
    }
  }

  if (candidates.length > 0) {
    return {
      status: "needs_variant_selection",
      category: null,
      product: null,
      candidates: candidates
        .slice(0, 3)
        .map((candidate) => toTextLookupCandidate(candidate.product)),
      missing_fields: [],
      intake_offer: null,
    }
  }

  return emptyResult({
    status: "insufficient_identity",
    category: null,
    missingFields: ["category"],
  })
}

function brandCategoryFallbackCandidates(params: {
  catalog: ProductLookupCatalog
  brandId: string | null
  category: ProductIntakeCategoryKey
}): ProductIntakeMatchCandidate[] {
  if (!params.brandId) return []

  return params.catalog.products
    .filter((product) => productBrandId(product) === params.brandId)
    .filter((product) => productCategoryKey(product) === params.category)
    .sort((left, right) => productCleanName(left).localeCompare(productCleanName(right), "de"))
    .slice(0, 3)
    .map((product) => ({
      product,
      productId: product.id,
      confidence: "review" as const,
      reason: "fuzzy_candidates_review" as const,
      reasonCodes: ["fuzzy_candidates_review" as const],
    }))
}

export function lookupProductCandidate(params: LookupProductCandidateParams): ProductLookupResult {
  const rawCategory = trimToNull(params.input.category)
  const productNameText = trimToNull(params.input.product_name_text)
  const normalizedCategory =
    normalizeCategoryKey(rawCategory) ?? productCategoryHintFromText(productNameText)

  if (rawCategory && !SUPPORTED_CATEGORY_SET.has(normalizedCategory ?? rawCategory)) {
    return emptyResult({
      status: "unsupported_category",
      category: normalizedCategory ?? rawCategory,
    })
  }

  if (normalizedCategory && !SUPPORTED_CATEGORY_SET.has(normalizedCategory)) {
    return emptyResult({
      status: "unsupported_category",
      category: normalizedCategory,
    })
  }

  const category = normalizedCategory as ProductIntakeCategoryKey | null
  const providedBrandId = trimToNull(params.input.brand_id)
  const providedLineId = trimToNull(params.input.product_line_id)
  const brandText = trimToNull(params.input.brand_text)

  if (!productNameText) {
    return emptyResult({
      status: "insufficient_identity",
      category,
      missingFields: ["productNameText"],
    })
  }

  const resolved =
    !providedBrandId && brandText && params.brandCatalog
      ? resolveBrandFromText(brandText, buildBrandResolutionCatalog(params.brandCatalog))
      : null
  const resolvedBrandId = providedBrandId ?? brandId(resolved?.brand ?? null)
  const resolvedLineId = providedLineId ?? lineId(resolved?.productLine ?? null)

  if (
    !resolvedBrandId &&
    !brandText &&
    (!category || !hasPreciseProductIdentity(productNameText))
  ) {
    return emptyResult({
      status: "insufficient_identity",
      category,
      missingFields: ["brandText"],
    })
  }

  const cleanProductName = cleanProductDisplayName(productNameText, {
    brand: brandName(resolved?.brand ?? null) ?? brandText,
    productLine: lineName(resolved?.productLine ?? null),
  })
  const precisionIdentity =
    !resolvedBrandId && brandText ? `${brandText} ${cleanProductName}` : cleanProductName
  const eligibleCatalog = lookupCatalogForEligibilityMode(
    params.catalog,
    params.eligibilityMode ?? "user_visible",
    params.eligibilityContext,
  )

  if (!hasPreciseProductIdentity(precisionIdentity)) {
    if (!category) {
      return emptyResult({
        status: "insufficient_identity",
        category: null,
        missingFields: ["productNameText"],
      })
    }

    const brandCategoryFallback = brandCategoryFallbackCandidates({
      catalog: eligibleCatalog,
      brandId: resolvedBrandId,
      category,
    })

    if (brandCategoryFallback.length === 1) {
      return {
        status: "needs_variant_selection",
        category,
        product: null,
        candidates: brandCategoryFallback,
        missing_fields: [],
        intake_offer: null,
      }
    }

    return emptyResult({
      status: "insufficient_identity",
      category,
      missingFields: ["productNameText"],
    })
  }

  if (!category) {
    if (!resolvedBrandId) {
      return emptyResult({
        status: "insufficient_identity",
        category: null,
        missingFields: ["category"],
      })
    }

    return lookupWithoutCategory({
      catalog: eligibleCatalog,
      brandId: resolvedBrandId,
      lineId: resolvedLineId,
      productNameText,
    })
  }

  if (!resolvedBrandId) {
    if (!brandText && hasPreciseProductIdentity(productNameText)) {
      return {
        status: "not_found",
        category,
        product: null,
        candidates: [],
        missing_fields: [],
        intake_offer: buildIntakeOffer({
          offerId: params.offerId,
          category,
          brandText: null,
          productNameText,
        }),
      }
    }

    return {
      status: "not_found",
      category,
      product: null,
      candidates: [],
      missing_fields: [],
      intake_offer: buildIntakeOffer({
        offerId: params.offerId,
        category,
        brandText,
        productNameText,
      }),
    }
  }

  const match = matchProductIntake(
    {
      selectedCategoryKey: category,
      brandId: resolvedBrandId,
      productLineId: resolvedLineId,
      cleanProductName,
      productName: productNameText,
    },
    eligibleCatalog,
  )

  if (match.status === "matched" && match.matchedProduct) {
    return {
      status: "found_exact",
      category,
      product: toLookupProduct(match.matchedProduct),
      candidates: match.candidates,
      missing_fields: [],
      intake_offer: null,
    }
  }

  const candidates = meaningfulCandidates({
    candidates: match.candidates,
    productNameText,
  })
  const textCandidates = textLookupCandidates({
    catalog: eligibleCatalog,
    brandId: resolvedBrandId,
    lineId: resolvedLineId,
    productNameText,
  })
  const confidentExactTextCandidate = findConfidentExactTextCandidate({
    candidates: textCandidates,
    category,
  })

  if (confidentExactTextCandidate) {
    return {
      status: "found_exact",
      category,
      product: toLookupProduct(confidentExactTextCandidate.product),
      candidates: [toTextLookupCandidate(confidentExactTextCandidate.product, "exact")],
      missing_fields: [],
      intake_offer: null,
    }
  }

  const sameCategoryCandidates = sortLookupCandidates(
    candidates.filter((candidate) => isSameCategoryCandidate(candidate, category)),
    category,
    productNameText,
  ).slice(0, 3)

  if (sameCategoryCandidates.length > 0) {
    return {
      status: "needs_variant_selection",
      category,
      product: null,
      candidates: sameCategoryCandidates,
      missing_fields: [],
      intake_offer: null,
    }
  }

  const categoryMismatchCandidates = sortLookupCandidates(
    candidates.filter((candidate) =>
      isStrongCategoryMismatchCandidate({ candidate, category, productNameText }),
    ),
    category,
    productNameText,
  ).slice(0, 3)

  if (categoryMismatchCandidates.length > 0) {
    return {
      status: "category_mismatch",
      category,
      product: null,
      candidates: categoryMismatchCandidates,
      missing_fields: [],
      intake_offer: null,
    }
  }

  if (match.status === "needs_more_info" || match.status === "rejected") {
    return emptyResult({
      status: "insufficient_identity",
      category,
      missingFields: match.missingFields,
    })
  }

  return {
    status: "not_found",
    category,
    product: null,
    candidates: [],
    missing_fields: [],
    intake_offer: buildIntakeOffer({
      offerId: params.offerId,
      category,
      brandText,
      productNameText,
    }),
  }
}
