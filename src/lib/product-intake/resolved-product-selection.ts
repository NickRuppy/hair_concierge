import type {
  ProductLookupClarification,
  ProductLookupClarificationCandidate,
  ProductLookupSelectionContext,
} from "@/lib/types"
import { getProductDisplayName } from "@/lib/product-display-name"

export type ResolvedProductSelection = {
  source: "product_lookup_clarification"
  clarificationId: string
  sourceAssistantMessageId: string
  originalUserMessage: string | null
  selectedProduct: {
    id: string
    name: string
    category: string | null
  }
  lookupIdentity: {
    category: string | null
    brandText: string | null
    productNameText: string | null
    evidenceQuote: string | null
  }
}

export type ResolvedProductSelectionProductRow = {
  id: string
  name?: string | null
  category?: string | null
  category_key?: string | null
}

export type ResolvedProductSelectionSourceCard = {
  source?: "product_lookup_clarification"
  clarificationId: string
  sourceAssistantMessageId: string
  selectedProductId?: string | null
}

export type ResolvedProductSelectionStableKeyInput = ResolvedProductSelectionSourceCard & {
  conversationId: string
  selectedProductId?: string | null
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function buildResolvedProductSelection(params: {
  clarification: ProductLookupClarification
  selectedCandidate: ProductLookupClarificationCandidate
  selectedProduct: ResolvedProductSelectionProductRow
  sourceAssistantMessageId: string
}): ResolvedProductSelection {
  const selectedProductName =
    readString(params.selectedProduct.name) ?? params.selectedCandidate.name
  const selectedProductDisplayName = getProductDisplayName(selectedProductName)
  const selectedProductCategory =
    readString(params.selectedProduct.category_key) ??
    readString(params.selectedProduct.category) ??
    readString(params.selectedCandidate.category)
  const brandText = readString(params.clarification.query.brand_text)
  const productNameText = readString(params.clarification.query.product_name_text)
  const evidenceQuote =
    brandText || productNameText
      ? [brandText, productNameText].filter(Boolean).join(" ")
      : selectedProductDisplayName
  const originalUserMessage =
    readString(params.clarification.original_user_message) ??
    `Ich meine ${selectedProductDisplayName}. Kannst du dieses Produkt bewerten?`

  return {
    source: "product_lookup_clarification",
    clarificationId: params.clarification.id,
    sourceAssistantMessageId: params.sourceAssistantMessageId,
    originalUserMessage,
    selectedProduct: {
      id: params.selectedProduct.id,
      name: selectedProductName,
      category: selectedProductCategory,
    },
    lookupIdentity: {
      category: selectedProductCategory,
      brandText,
      productNameText,
      evidenceQuote,
    },
  }
}

export function toProductLookupSelectionContext(
  selection: ResolvedProductSelection,
): ProductLookupSelectionContext {
  return {
    source: "product_lookup_clarification",
    clarification_id: selection.clarificationId,
    source_assistant_message_id: selection.sourceAssistantMessageId,
    selected_product_id: selection.selectedProduct.id,
    selected_product_name: getResolvedProductSelectionDisplayName(selection),
  }
}

export function getResolvedProductSelectionDisplayName(
  selection: ResolvedProductSelection,
): string {
  return getProductDisplayName(selection.selectedProduct.name)
}

export function productLookupSelectionResolvesSourceCard(
  context: ProductLookupSelectionContext | null | undefined,
  sourceCard: ResolvedProductSelectionSourceCard,
): boolean {
  return (
    context?.source === "product_lookup_clarification" &&
    context.clarification_id === sourceCard.clarificationId &&
    context.source_assistant_message_id === sourceCard.sourceAssistantMessageId &&
    (!sourceCard.selectedProductId || context.selected_product_id === sourceCard.selectedProductId)
  )
}

export function getResolvedProductSelectionStableKeyParts(
  input: ResolvedProductSelectionStableKeyInput,
): readonly [string, string, string, string, string] {
  return [
    "product_lookup_selection",
    input.conversationId,
    input.sourceAssistantMessageId,
    input.clarificationId,
    input.selectedProductId ?? "unknown_product",
  ]
}
