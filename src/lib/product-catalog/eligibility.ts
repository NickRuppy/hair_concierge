export type ProductEligibilityMode =
  | "general_recommendation"
  | "owned_assessment"
  | "intake_dedupe"
  | "internal_admin"

export type ProductEligibilityContext = {
  isUserOwned?: boolean
  ownedProductIds?: ReadonlySet<string> | readonly string[] | null
  hasVerifiedSpecs?: boolean
}

export type ProductCandidateScope = {
  includedProductIds: ReadonlySet<string>
}

type ProductEligibilityProduct = {
  id?: string | null
  is_active?: boolean | null
  isActive?: boolean | null
  lifecycle_status?: string | null
  lifecycleStatus?: string | null
  is_chaarlie_recommended?: boolean | null
  isChaarlieRecommended?: boolean | null
}

export const GENERAL_RECOMMENDATION_PRODUCT_SQL_FILTER = {
  is_active: true,
  lifecycle_status: "active",
  is_chaarlie_recommended: true,
} as const

export const INTAKE_DEDUPE_PRODUCT_SQL_FILTER = {
  is_active: true,
} as const

function isActiveLifecycleProduct(product: ProductEligibilityProduct): boolean {
  return productIsActive(product) && productLifecycleStatus(product) === "active"
}

export function productIsActive(product: ProductEligibilityProduct): boolean {
  return product.is_active ?? product.isActive ?? false
}

export function productLifecycleStatus(product: ProductEligibilityProduct): string | null {
  return product.lifecycle_status ?? product.lifecycleStatus ?? null
}

export function productIsChaarlieRecommended(product: ProductEligibilityProduct): boolean | null {
  return product.is_chaarlie_recommended ?? product.isChaarlieRecommended ?? null
}

export function buildProductCandidateScope(
  includeProductIds?: readonly string[] | null,
): ProductCandidateScope {
  return {
    includedProductIds: new Set(includeProductIds ?? []),
  }
}

export function isIncludedProductCandidate(
  product: ProductEligibilityProduct,
  scope: ProductCandidateScope,
): boolean {
  return Boolean(product.id && scope.includedProductIds.has(product.id))
}

export function isProductEligibleForCandidateScope(
  product: ProductEligibilityProduct,
  scope: ProductCandidateScope,
  context: Pick<ProductEligibilityContext, "hasVerifiedSpecs"> = {},
): boolean {
  if (isProductEligibleForMode(product, "general_recommendation")) return true

  if (!isIncludedProductCandidate(product, scope)) return false

  return isProductEligibleForMode(product, "owned_assessment", {
    ownedProductIds: scope.includedProductIds,
    hasVerifiedSpecs: context.hasVerifiedSpecs,
  })
}

function ownsProduct(
  product: ProductEligibilityProduct,
  context: ProductEligibilityContext | undefined,
): boolean {
  if (context?.isUserOwned === true) return true
  if (!product.id || !context?.ownedProductIds) return false
  const ownedProductIds = context.ownedProductIds
  const ownedProductIdSet = ownedProductIds as ReadonlySet<string>
  if (typeof ownedProductIdSet.has === "function") {
    return ownedProductIdSet.has(product.id)
  }

  return (ownedProductIds as readonly string[]).includes(product.id)
}

export function isProductEligibleForMode(
  product: ProductEligibilityProduct,
  mode: ProductEligibilityMode,
  context?: ProductEligibilityContext,
): boolean {
  switch (mode) {
    case "general_recommendation":
      return isActiveLifecycleProduct(product) && productIsChaarlieRecommended(product) === true
    case "owned_assessment":
      return (
        isActiveLifecycleProduct(product) &&
        ownsProduct(product, context) &&
        context?.hasVerifiedSpecs === true
      )
    case "intake_dedupe":
      return productIsActive(product)
    case "internal_admin":
      return true
  }
}
