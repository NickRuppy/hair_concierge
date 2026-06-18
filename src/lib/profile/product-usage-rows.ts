import { PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_ORDER } from "@/lib/onboarding/product-options"
import { isUnselectedShampooFallbackItem } from "@/lib/product-usage/shampoo-fallback"
import type { ProductUsageMatchStatus } from "@/lib/types"
import {
  PRODUCT_FREQUENCY_LABELS,
  normalizeProductFrequency,
  type ProductFrequencyInput,
} from "@/lib/vocabulary"

type NullableRelation<T> = T | T[] | null

type JoinedBrandIdentity = {
  id: string
  canonical_name: string | null
}

type JoinedProductLine = {
  id: string
  canonical_name: string | null
}

type JoinedProductIdentity = {
  id: string
  name: string | null
  brand: string | null
  is_chaarlie_recommended?: boolean | null
  brand_identity?: NullableRelation<JoinedBrandIdentity>
  product_line?: NullableRelation<JoinedProductLine>
}

export type UserProductUsageRow = {
  id: string
  category: string
  brand_text: string | null
  product_name: string | null
  frequency_range: ProductFrequencyInput | string | null
  product_id: string | null
  product_submission_id: string | null
  match_status: ProductUsageMatchStatus | null
  product: JoinedProductIdentity | JoinedProductIdentity[] | null
}

export type ProductDetailRow = {
  key: string
  category: string
  categoryLabel: string
  productName: string | null
  frequencyLabel: string | null
  reviewStatusLabel: string | null
  needsUserDetails: boolean
  isComplete: boolean
}

export const USER_PRODUCT_USAGE_WITH_PRODUCT_SELECT = `
  id,
  category,
  brand_text,
  product_name,
  frequency_range,
  match_status,
  product_id,
  product_submission_id,
  product:products(
    id,
    name,
    brand,
    is_chaarlie_recommended,
    brand_identity:brands(id, canonical_name),
    product_line:product_lines(id, canonical_name)
  )
`

const PRODUCT_ORDER_INDEX = new Map(
  PRODUCT_CATEGORY_ORDER.map((category, index) => [category, index]),
)

const REVIEW_STATUS_LABELS: Partial<
  Record<NonNullable<UserProductUsageRow["match_status"]>, string>
> = {
  pending_review: "In Prüfung",
  needs_more_info: "Details benötigt",
}

function firstJoinedProduct(product: UserProductUsageRow["product"]): JoinedProductIdentity | null {
  return Array.isArray(product) ? (product[0] ?? null) : product
}

function firstRelation<T>(relation: NullableRelation<T> | undefined): T | null {
  if (!relation) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function appendDistinct(parts: string[], value: string | null | undefined): void {
  const text = normalizeText(value)
  if (!text) return

  const normalizedText = text.toLocaleLowerCase("de")
  const alreadyCovered = parts.some((part) => {
    const normalizedPart = part.toLocaleLowerCase("de")
    return normalizedPart === normalizedText || normalizedPart.includes(normalizedText)
  })

  if (!alreadyCovered) {
    parts.push(text)
  }
}

function joinedProductDisplayName(row: UserProductUsageRow): string | null {
  const product = row.match_status === "matched" ? firstJoinedProduct(row.product) : null
  if (!product) return null

  const brand = firstRelation(product.brand_identity)
  const line = firstRelation(product.product_line)
  const parts: string[] = []
  appendDistinct(parts, brand?.canonical_name ?? product.brand)
  appendDistinct(parts, line?.canonical_name)
  appendDistinct(parts, product.name)

  return parts.join(" ").trim() || null
}

function rawProductDisplayName(row: UserProductUsageRow): string | null {
  const parts: string[] = []
  appendDistinct(parts, row.brand_text)
  appendDistinct(parts, row.product_name)

  return parts.join(" ").trim() || null
}

function getReviewStatusLabel(matchStatus: UserProductUsageRow["match_status"]): string | null {
  return matchStatus ? (REVIEW_STATUS_LABELS[matchStatus] ?? null) : null
}

export function coerceUserProductUsageRows(rows: unknown): UserProductUsageRow[] {
  return Array.isArray(rows) ? (rows as UserProductUsageRow[]) : []
}

export function createProductRows(rows: UserProductUsageRow[]): ProductDetailRow[] {
  return rows
    .filter(
      (row) =>
        !isUnselectedShampooFallbackItem({
          category: row.category,
          product_name: row.product_name,
          frequency_range: row.frequency_range,
        }),
    )
    .sort((left, right) => {
      const leftIndex = PRODUCT_ORDER_INDEX.get(left.category) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = PRODUCT_ORDER_INDEX.get(right.category) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })
    .map((row) => {
      const productName = joinedProductDisplayName(row) ?? rawProductDisplayName(row)
      const frequency = normalizeProductFrequency(row.frequency_range)
      const frequencyLabel = frequency ? PRODUCT_FREQUENCY_LABELS[frequency] : null
      const isVerified = row.match_status === "matched" && Boolean(row.product_id)
      const needsUserDetails =
        row.match_status === "needs_more_info" || !productName || !frequencyLabel

      return {
        key: row.id,
        category: row.category,
        categoryLabel: PRODUCT_CATEGORY_LABELS[row.category] ?? row.category,
        productName,
        frequencyLabel,
        reviewStatusLabel: getReviewStatusLabel(row.match_status),
        needsUserDetails,
        isComplete: Boolean(isVerified && productName && frequencyLabel),
      }
    })
}

export function getProductCompletionLabel(rows: ProductDetailRow[], onboardingCompleted: boolean) {
  if (rows.length === 0) {
    return onboardingCompleted ? "Noch leer" : "Offen"
  }

  const completeCount = rows.filter((row) => row.isComplete).length
  return `${completeCount}/${rows.length} verifiziert`
}
