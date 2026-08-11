import { isProductEligibleForMode } from "@/lib/product-catalog/eligibility"
import type { UserProduct } from "@/lib/personal-plan/persistence"

import type {
  PersonalPlanCategory,
  Stage3CatalogCandidate,
  Stage3CatalogSearchResult,
} from "./contracts"

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const MAX_SEARCH_CANDIDATES = 8

export type CatalogProductRecord = {
  id: string
  category: PersonalPlanCategory
  brandName: string | null
  displayName: string
  imageUrl?: string | null
  active: boolean
  lifecycleStatus: string | null
  recommended: boolean | null
  sortOrder: number | null
  assessmentStatus?: "ready" | "pending_analysis"
  assessmentReasonCodes?: Array<"missing_required_spec" | "missing_application_protocol">
}

export type OwnedProductCatalogSource = {
  /** This boundary must return only the requested canonical category's catalog rows. */
  listActiveProducts(category: PersonalPlanCategory): Promise<readonly CatalogProductRecord[]>
}

export type OwnerProductInventory = {
  findOwnedExact(input: {
    userId: string
    category: PersonalPlanCategory
    catalogProductId: string
  }): Promise<UserProduct | null>
  /** Atomically inserts or returns the live exact owner/category/catalog row. */
  insertOwned(input: UserProduct): Promise<{ product: UserProduct; created: boolean }>
  listOwned(input: {
    userId: string
    category: PersonalPlanCategory
  }): Promise<readonly UserProduct[]>
}

export class ProductInventoryContractError extends Error {
  constructor(
    public readonly code: "invalid_query" | "ownership_confirmation_required",
    message = code,
  ) {
    super(message)
    this.name = "ProductInventoryContractError"
  }
}

export function normalizeOwnedProductSearchQuery(query: string): string {
  const normalized = query.trim()
  if (normalized.length < MIN_QUERY_LENGTH || normalized.length > MAX_QUERY_LENGTH) {
    throw new ProductInventoryContractError("invalid_query")
  }
  return normalized
}

export async function searchOwnedProductCatalog(input: {
  catalog: OwnedProductCatalogSource
  category: PersonalPlanCategory
  query: string
  requestToken: number
}): Promise<Stage3CatalogSearchResult & { requestToken: number }> {
  const query = normalizeOwnedProductSearchQuery(input.query)
  const candidates = (await input.catalog.listActiveProducts(input.category))
    .filter(
      (product) =>
        product.category === input.category &&
        product.active &&
        product.lifecycleStatus === "active" &&
        matchesQuery(product, query),
    )
    .sort(compareCatalogProducts)
    .slice(0, MAX_SEARCH_CANDIDATES)
    .map((product) => asCatalogCandidate(product, query))

  return {
    requestToken: input.requestToken,
    query,
    category: input.category,
    candidates,
    totalCapped: candidates.length === MAX_SEARCH_CANDIDATES,
  }
}

/**
 * Planned recommendations deliberately use a different selector from owned
 * catalog search: a product can be searchable because someone owns it without
 * being eligible for Chaarlie to recommend it.
 */
export function selectRecommendationCandidates(input: {
  category: PersonalPlanCategory
  products: readonly CatalogProductRecord[]
}): Stage3CatalogCandidate[] {
  return input.products
    .filter(
      (product) =>
        product.category === input.category &&
        isProductEligibleForMode(
          {
            id: product.id,
            is_active: product.active,
            lifecycle_status: product.lifecycleStatus,
            is_chaarlie_recommended: product.recommended,
          },
          "general_recommendation",
        ),
    )
    .sort(compareCatalogProducts)
    .map((product) => asCatalogCandidate(product, product.displayName))
}

export async function createOwnedProduct(input: {
  inventory: OwnerProductInventory
  userId: string
  catalogProduct: CatalogProductRecord
  confirmedOwnership: boolean
  now?: () => string
  createId?: () => string
}): Promise<{ product: UserProduct; created: boolean }> {
  if (!input.confirmedOwnership) {
    throw new ProductInventoryContractError("ownership_confirmation_required")
  }

  const existing = await input.inventory.findOwnedExact({
    userId: input.userId,
    category: input.catalogProduct.category,
    catalogProductId: input.catalogProduct.id,
  })
  if (existing) return { product: existing, created: false }

  const timestamp = (input.now ?? (() => new Date().toISOString()))()
  const product: UserProduct = {
    id: (input.createId ?? defaultId)(),
    userId: input.userId,
    category: input.catalogProduct.category,
    catalogProductId: input.catalogProduct.id,
    brandText: input.catalogProduct.brandName,
    productNameText: input.catalogProduct.displayName,
    identityStatus: "matched",
    ownershipStatus: "owned",
    intakeSource: "catalog_search",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return input.inventory.insertOwned(product)
}

export function createInMemoryOwnerProductInventory(
  options: {
    now?: () => string
    createId?: () => string
  } = {},
): OwnerProductInventory {
  const products = new Map<string, UserProduct>()
  let sequence = 0
  const createId = options.createId ?? (() => `user-product-${++sequence}`)

  return {
    async findOwnedExact(input) {
      return (
        [...products.values()].find(
          (product) =>
            product.userId === input.userId &&
            product.category === input.category &&
            product.catalogProductId === input.catalogProductId &&
            product.ownershipStatus === "owned",
        ) ?? null
      )
    },
    async insertOwned(input) {
      const existing = await this.findOwnedExact({
        userId: input.userId,
        category: input.category,
        catalogProductId: input.catalogProductId ?? "",
      })
      if (existing) return { product: existing, created: false }
      const product = {
        ...input,
        id: input.id || createId(),
        updatedAt: options.now?.() ?? input.updatedAt,
      }
      products.set(product.id, product)
      return { product, created: true }
    },
    async listOwned(input) {
      return [...products.values()].filter(
        (product) =>
          product.userId === input.userId &&
          product.category === input.category &&
          product.ownershipStatus === "owned",
      )
    },
  }
}

function matchesQuery(product: CatalogProductRecord, query: string): boolean {
  return `${product.brandName ?? ""} ${product.displayName}`
    .toLocaleLowerCase()
    .includes(query.toLocaleLowerCase())
}

function compareCatalogProducts(left: CatalogProductRecord, right: CatalogProductRecord): number {
  return (
    (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
    left.displayName.localeCompare(right.displayName, "de") ||
    left.id.localeCompare(right.id)
  )
}

function asCatalogCandidate(product: CatalogProductRecord, query: string): Stage3CatalogCandidate {
  const label = `${product.brandName ?? ""} ${product.displayName}`.trim().toLocaleLowerCase()
  return {
    candidateId: product.id,
    productId: product.id,
    displayName: product.displayName,
    category: product.category,
    brandName: product.brandName,
    imageUrl: product.imageUrl ?? null,
    confidence: label === query.toLocaleLowerCase() ? "exact" : "likely",
    ...(product.assessmentStatus
      ? {
          assessmentStatus: product.assessmentStatus,
          assessmentReasonCodes: product.assessmentReasonCodes ?? [],
        }
      : {}),
  }
}

function defaultId(): string {
  return crypto.randomUUID()
}
