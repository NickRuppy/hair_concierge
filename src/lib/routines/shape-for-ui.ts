import { PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_ORDER } from "@/lib/onboarding/product-options"
import { isUnselectedShampooFallbackItem } from "@/lib/product-usage/shampoo-fallback"
import type { CareBalanceRow } from "@/lib/recommendation-engine/types"
import type { HairProfile } from "@/lib/types"
import type {
  RoutineArtifactPendingSubmission,
  RoutineArtifactProduct,
  RoutineArtifactProductLine,
  RoutineArtifactUsageRow,
  RoutineCardKind,
  RoutineCardTone,
  RoutineUiCard,
  RoutineUiShape,
} from "@/lib/routines/types"

type NullableRelation<T> = T | T[] | null | undefined

export type ShapeRoutineForUiInput = {
  hairProfile: HairProfile | null
  usageRows: RoutineArtifactUsageRow[]
  careBalanceRows: CareBalanceRow[]
  pendingSubmissionsById: Map<string, RoutineArtifactPendingSubmission>
  activeDismissedCategories?: Set<string>
}

const PRODUCT_ORDER_INDEX = new Map(
  PRODUCT_CATEGORY_ORDER.map((category, index) => [category, index]),
)

function firstRelation<T>(relation: NullableRelation<T>): T | null {
  if (!relation) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function firstProduct(product: RoutineArtifactUsageRow["product"]): RoutineArtifactProduct | null {
  return firstRelation(product)
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function appendDistinct(parts: string[], value: string | null | undefined): void {
  const text = normalizeText(value)
  if (!text) return

  const normalized = text.toLocaleLowerCase("de")
  const alreadyCovered = parts.some((part) => {
    const normalizedPart = part.toLocaleLowerCase("de")
    return normalizedPart === normalized || normalizedPart.includes(normalized)
  })
  if (alreadyCovered) return

  // Drop earlier parts the new text already contains (e.g. a product name that
  // repeats brand + line: "Syoss" + "Syoss Intense Fullness Shampoo").
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (normalized.includes(parts[index].toLocaleLowerCase("de"))) {
      parts.splice(index, 1)
    }
  }

  parts.push(text)
}

function productDisplayName(row: RoutineArtifactUsageRow, product: RoutineArtifactProduct | null) {
  const parts: string[] = []
  if (product && row.match_status === "matched") {
    const brand = firstRelation(product.brand_identity)
    const line =
      firstRelation<RoutineArtifactProductLine>(product.product_line)?.canonical_name ??
      product.product_line_name
    appendDistinct(parts, brand?.canonical_name ?? product.brand)
    appendDistinct(parts, line)
    appendDistinct(parts, product.name)
    return parts.join(" ").trim() || null
  }

  appendDistinct(parts, row.brand_text)
  appendDistinct(parts, row.product_name)
  return parts.join(" ").trim() || null
}

function normalizeProductForDrawer(
  product: RoutineArtifactProduct | null,
): RoutineArtifactProduct | null {
  if (!product) return null

  const brand = firstRelation(product.brand_identity)
  const line = firstRelation<RoutineArtifactProductLine>(product.product_line)

  return {
    ...product,
    brand: brand?.canonical_name ?? product.brand,
    product_line_id: product.product_line_id ?? line?.id ?? null,
    product_line_name: product.product_line_name ?? line?.canonical_name ?? null,
  }
}

function toneFor(row: CareBalanceRow | null, isLegacyTextOnly: boolean): RoutineCardTone {
  if (row?.primaryStatus === "safety_caution") return "yellow"
  if (isLegacyTextOnly) return "neutral"
  if (!row) return "neutral"
  if (row.recommendation === "keep" || row.recommendation === "increase_frequency") return "green"
  return "neutral"
}

function needsProductSwap(product: RoutineArtifactProduct | null): boolean {
  if (!product) return false
  if (product.is_active === false) return true
  return product.lifecycle_status === "discontinued"
}

function kindForMatchedUsage(
  row: CareBalanceRow | null,
  product: RoutineArtifactProduct | null = null,
): RoutineCardKind {
  if (needsProductSwap(product)) return "verified_swap"
  if (!row) return "verified_matches"
  if (row.recommendation === "increase_frequency") return "verified_more_freq"
  if (row.recommendation === "decrease_frequency" || row.recommendation === "remove") {
    return "verified_unnecessary"
  }
  if (row.primaryStatus === "unnecessary" || row.primaryStatus === "overused") {
    return "verified_unnecessary"
  }
  return "verified_matches"
}

function isPendingUsage(row: RoutineArtifactUsageRow): boolean {
  return row.match_status === "pending_review" || row.match_status === "needs_more_info"
}

function isSuggestionRow(row: CareBalanceRow): boolean {
  return row.recommendation === "add" || row.primaryStatus === "missing_needed"
}

function sortCards(left: RoutineUiCard, right: RoutineUiCard): number {
  const leftIndex = PRODUCT_ORDER_INDEX.get(left.category) ?? Number.MAX_SAFE_INTEGER
  const rightIndex = PRODUCT_ORDER_INDEX.get(right.category) ?? Number.MAX_SAFE_INTEGER
  if (leftIndex !== rightIndex) return leftIndex - rightIndex
  return left.id.localeCompare(right.id)
}

function categoryLabel(category: string): string {
  return PRODUCT_CATEGORY_LABELS[category] ?? category
}

function buildUsageCard(
  row: RoutineArtifactUsageRow,
  careBalanceRow: CareBalanceRow | null,
  pendingSubmission: RoutineArtifactPendingSubmission | null,
): RoutineUiCard {
  const isLegacyTextOnly = row.match_status === "text_only"
  const normalizedProduct =
    row.match_status === "matched" ? normalizeProductForDrawer(firstProduct(row.product)) : null
  const kind: RoutineCardKind = isPendingUsage(row)
    ? "pending"
    : kindForMatchedUsage(careBalanceRow, normalizedProduct)

  return {
    id: row.id,
    kind,
    tone: kind === "pending" ? "neutral" : toneFor(careBalanceRow, isLegacyTextOnly),
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    productName: productDisplayName(row, normalizedProduct),
    currentFrequency: careBalanceRow?.currentFrequency ?? null,
    frequencyTarget: careBalanceRow?.frequencyTarget ?? null,
    careBalanceRow,
    usageRow: row,
    product: normalizedProduct,
    pendingSubmission,
    hasProductDrawer: Boolean(normalizedProduct && row.match_status === "matched"),
    isLegacyTextOnly,
    isTopProposal: false,
  }
}

function buildSuggestionCard(row: CareBalanceRow, isTopProposal: boolean): RoutineUiCard {
  if (!row.frequencyTarget) {
    throw new Error(
      `CareBalance target task is incomplete: ${row.category} is missing frequencyTarget`,
    )
  }

  return {
    id: `suggestion-${row.category}`,
    kind: "suggestion",
    tone: toneFor(row, false),
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    productName: null,
    currentFrequency: row.currentFrequency,
    frequencyTarget: row.frequencyTarget,
    careBalanceRow: row,
    usageRow: null,
    product: null,
    pendingSubmission: null,
    hasProductDrawer: false,
    isLegacyTextOnly: false,
    isTopProposal,
  }
}

function buildCareBalanceOnlyCard(row: CareBalanceRow): RoutineUiCard {
  return {
    id: `care-balance-${row.category}`,
    kind: kindForMatchedUsage(row),
    tone: toneFor(row, false),
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    productName: null,
    currentFrequency: row.currentFrequency,
    frequencyTarget: row.frequencyTarget,
    careBalanceRow: row,
    usageRow: null,
    product: null,
    pendingSubmission: null,
    hasProductDrawer: false,
    isLegacyTextOnly: false,
    isTopProposal: false,
  }
}

export function shapeRoutineForUi(input: ShapeRoutineForUiInput): RoutineUiShape {
  const careRowsByCategory = new Map<string, CareBalanceRow>(
    input.careBalanceRows.map((row) => [row.category, row]),
  )
  const syntheticNoShampooCategories = new Set<string>()
  const visibleUsageRows = input.usageRows.filter((row) => {
    const isSyntheticNoShampoo = isUnselectedShampooFallbackItem(row)
    if (isSyntheticNoShampoo) {
      syntheticNoShampooCategories.add(row.category)
    }
    return !isSyntheticNoShampoo
  })
  const visibleUsageCategories = new Set(visibleUsageRows.map((row) => row.category))

  const usageCards = visibleUsageRows.map((row) =>
    buildUsageCard(
      row,
      careRowsByCategory.get(row.category) ?? null,
      row.product_submission_id
        ? (input.pendingSubmissionsById.get(row.product_submission_id) ?? null)
        : null,
    ),
  )

  const suggestionCards = input.careBalanceRows
    .filter((row) => {
      if (!isSuggestionRow(row)) return false
      if (input.activeDismissedCategories?.has(row.category)) return false
      return !visibleUsageCategories.has(row.category)
    })
    .map((row) => buildSuggestionCard(row, syntheticNoShampooCategories.has(row.category)))
  const suggestionCategories = new Set(suggestionCards.map((card) => card.category))
  const careBalanceOnlyCards = input.careBalanceRows
    .filter((row) => {
      if (visibleUsageCategories.has(row.category)) return false
      if (suggestionCategories.has(row.category)) return false
      return row.present || row.primaryStatus === "safety_caution"
    })
    .map(buildCareBalanceOnlyCard)

  return {
    hairProfile: input.hairProfile,
    cards: [...usageCards, ...suggestionCards, ...careBalanceOnlyCards].sort(sortCards),
  }
}
