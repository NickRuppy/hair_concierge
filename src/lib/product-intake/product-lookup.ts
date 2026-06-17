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
  type ProductIntakeCatalog,
  type ProductIntakeCatalogProduct,
  type ProductIntakeMatchCandidate,
} from "@/lib/product-intake/product-matching"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import type { ProductIntakeCategoryKey, ProductIntakeOffer } from "@/lib/types"

export type ProductLookupCatalog = ProductIntakeCatalog

export type ProductLookupStatus =
  | "found_exact"
  | "ambiguous"
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
  category_key: string | null
  is_chaarlie_recommended: boolean | null
}

export type LookupProductCandidateParams = {
  input: ProductLookupInput
  catalog: ProductLookupCatalog
  brandCatalog?: BrandResolutionCatalogInput | null
  offerId?: string
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

function productCleanName(product: ProductIntakeCatalogProduct): string {
  return product.cleanName ?? product.name
}

function productChaarlieRecommended(product: ProductIntakeCatalogProduct): boolean | null {
  return product.isChaarlieRecommended ?? product.is_chaarlie_recommended ?? null
}

function toLookupProduct(product: ProductIntakeCatalogProduct): ProductLookupProduct {
  return {
    id: product.id,
    name: product.name,
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

function meaningfulTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(
    tokenizeProductName(left).filter((token) => !LOW_VALUE_PRODUCT_TOKENS.has(token)),
  )
  if (leftTokens.size === 0) return 0

  return tokenizeProductName(right).filter(
    (token) => !LOW_VALUE_PRODUCT_TOKENS.has(token) && leftTokens.has(token),
  ).length
}

function meaningfulProductTokens(value: string): string[] {
  return tokenizeProductName(value).filter(
    (token) => token.length > 1 && !LOW_VALUE_PRODUCT_TOKENS.has(token),
  )
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
      meaningfulTokenOverlap(params.productNameText, productCleanName(candidate.product)) > 0,
  )
}

export function lookupProductCandidate(params: LookupProductCandidateParams): ProductLookupResult {
  const rawCategory = trimToNull(params.input.category)
  const normalizedCategory = normalizeCategoryKey(rawCategory)
  if (!normalizedCategory) {
    return emptyResult({
      status: "insufficient_identity",
      category: null,
      missingFields: ["category"],
    })
  }

  if (!SUPPORTED_CATEGORY_SET.has(normalizedCategory)) {
    return emptyResult({
      status: "unsupported_category",
      category: normalizedCategory,
    })
  }

  const category = normalizedCategory as ProductIntakeCategoryKey
  const productNameText = trimToNull(params.input.product_name_text)
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

  if (!resolvedBrandId && !brandText) {
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

  if (!hasPreciseProductIdentity(cleanProductName)) {
    return emptyResult({
      status: "insufficient_identity",
      category,
      missingFields: ["productNameText"],
    })
  }

  if (!resolvedBrandId) {
    return {
      status: "not_found",
      category,
      product: null,
      candidates: [],
      missing_fields: [],
      intake_offer: buildIntakeOffer({
        offerId: params.offerId ?? crypto.randomUUID(),
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
    params.catalog,
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

  if (candidates.length > 0) {
    return {
      status: "ambiguous",
      category,
      product: null,
      candidates,
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
      offerId: params.offerId ?? crypto.randomUUID(),
      category,
      brandText,
      productNameText,
    }),
  }
}
