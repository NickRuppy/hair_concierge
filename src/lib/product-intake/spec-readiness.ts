import type { SupportedProductCategoryKey } from "@/lib/product-identity"

export const PRODUCT_INTAKE_REQUIRED_SPEC_TABLES_BY_CATEGORY = {
  shampoo: ["product_shampoo_specs", "product_application_protocols"],
  conditioner: [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
    "product_application_protocols",
  ],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
    "product_application_protocols",
  ],
  mask: ["product_mask_specs", "product_application_protocols"],
  oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
  dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs", "product_application_protocols"],
  bondbuilder: ["product_bondbuilder_specs", "product_application_protocols"],
  heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
  scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
} as const satisfies Record<SupportedProductCategoryKey, readonly string[]>

export type SpecReadinessClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        limit: (count: number) => PromiseLike<{ data: unknown[] | null; error: unknown | null }>
      }
    }
  }
}

function normalizeCategoryKey(value: unknown): SupportedProductCategoryKey | null {
  if (typeof value !== "string") return null
  return Object.prototype.hasOwnProperty.call(
    PRODUCT_INTAKE_REQUIRED_SPEC_TABLES_BY_CATEGORY,
    value,
  )
    ? (value as SupportedProductCategoryKey)
    : null
}

export async function hasVerifiedProductSpecs(params: {
  client: SpecReadinessClient
  productId: string
  categoryKey: unknown
}): Promise<boolean> {
  const categoryKey = normalizeCategoryKey(params.categoryKey)
  if (!categoryKey) return false

  const requiredTables = PRODUCT_INTAKE_REQUIRED_SPEC_TABLES_BY_CATEGORY[categoryKey]
  const results = await Promise.all(
    requiredTables.map((table) =>
      params.client.from(table).select("product_id").eq("product_id", params.productId).limit(1),
    ),
  )

  return results.every(
    (result) => !result.error && Array.isArray(result.data) && result.data.length > 0,
  )
}

export async function loadVerifiedSpecProductIds(params: {
  client: SpecReadinessClient
  products: readonly {
    id?: string | null
    category_key?: string | null
    categoryKey?: string | null
    category?: string | null
  }[]
}): Promise<Set<string>> {
  const verifiedProductIds = new Set<string>()

  await Promise.all(
    params.products.map(async (product) => {
      const productId = product.id
      if (!productId) return
      const hasSpecs = await hasVerifiedProductSpecs({
        client: params.client,
        productId,
        categoryKey: product.category_key ?? product.categoryKey ?? product.category,
      })
      if (hasSpecs) verifiedProductIds.add(productId)
    }),
  )

  return verifiedProductIds
}
