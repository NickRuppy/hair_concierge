import type { ProductUsageMatchStatus } from "@/lib/types"
import type { ProductFrequency } from "@/lib/vocabulary"

export const SHAMPOO_CATEGORY = "shampoo"
export const UNSELECTED_SHAMPOO_PRODUCT_NAME = "__system_no_shampoo_selected__"
export const DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY: ProductFrequency = "less_than_monthly"
export const USER_PRODUCT_USAGE_ROUTINE_SELECT =
  "category, product_name, frequency_range, product_id, product_submission_id, match_status"

export interface ProductUsageFrequencyLike {
  category: string
  product_name: string | null
  frequency_range: string | null
  product_id?: string | null
  product_submission_id?: string | null
  match_status?: ProductUsageMatchStatus | null
}

const PRODUCT_USAGE_MATCH_STATUSES = new Set<ProductUsageMatchStatus>([
  "text_only",
  "matched",
  "pending_review",
  "needs_more_info",
])

export function isUnselectedShampooFallbackItem(item: ProductUsageFrequencyLike): boolean {
  return (
    item.category === SHAMPOO_CATEGORY &&
    item.product_name === UNSELECTED_SHAMPOO_PRODUCT_NAME &&
    item.frequency_range === DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY
  )
}

export function getVisibleProductUsageItems<T extends ProductUsageFrequencyLike>(items: T[]): T[] {
  return items.filter((item) => !isUnselectedShampooFallbackItem(item))
}

export function coerceProductUsageFrequencyRows(rows: unknown): ProductUsageFrequencyLike[] {
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return []

    const record = row as Record<string, unknown>
    if (typeof record.category !== "string") return []
    if (
      record.product_name !== undefined &&
      record.product_name !== null &&
      typeof record.product_name !== "string"
    ) {
      return []
    }
    if (
      record.frequency_range !== undefined &&
      record.frequency_range !== null &&
      typeof record.frequency_range !== "string"
    ) {
      return []
    }

    const matchStatus =
      typeof record.match_status === "string" &&
      PRODUCT_USAGE_MATCH_STATUSES.has(record.match_status as ProductUsageMatchStatus)
        ? (record.match_status as ProductUsageMatchStatus)
        : null

    return [
      {
        category: record.category,
        product_name: record.product_name ?? null,
        frequency_range: record.frequency_range ?? null,
        product_id: typeof record.product_id === "string" ? record.product_id : null,
        product_submission_id:
          typeof record.product_submission_id === "string" ? record.product_submission_id : null,
        match_status: matchStatus,
      },
    ]
  })
}
