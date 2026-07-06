import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import type { AgentV2ProductLookupValidationResult } from "@/lib/agent-v2/validation/final-answer-validator"
import type { ResolvedProductSelection } from "@/lib/product-intake/resolved-product-selection"
import type { ProductIntakeOffer } from "@/lib/types"

export interface AgentV2TrustedSelectedProductContext {
  source: "product_lookup_clarification"
  original_user_message: string
  selected_product: {
    id: string
    name: string
    category: string | null
  }
  lookup_identity: {
    category: string | null
    brand_text: string | null
    product_name_text: string | null
    evidence_quote: string | null
  }
}

export interface AgentV2ActiveResolvedProductContext {
  source: AgentV2ActiveResolvedProductContextSource
  product_id: string
  name: string
  category: string | null
  original_user_message: string
}

export type AgentV2ActiveResolvedProductContextSource =
  | "lookup_exact"
  | "product_lookup_selection"
  | "product_intake_submission"
  | "routine_inventory"

export type AgentV2ActiveProductContextSource =
  | "lookup_exact"
  | "product_lookup_selection"
  | "product_intake_submission"
  | "routine_inventory"

export interface AgentV2ActiveProductContext {
  status: "resolved" | "pending_review"
  product_id: string | null
  submission_id: string | null
  category: string | null
  brand_text: string | null
  product_name_text: string | null
  display_name: string
  original_user_message: string
  source: AgentV2ActiveProductContextSource
  updated_at: string
}

export type AgentV2StoredProductProjection = Pick<
  Partial<AgentV2SelectProductsProjection>,
  "tool_name" | "category" | "valid_product_ids" | "products"
>

export function buildTrustedSelectedProductContext(
  selection: ResolvedProductSelection,
): AgentV2TrustedSelectedProductContext {
  const originalUserMessage =
    selection.originalUserMessage?.trim() ||
    `Ich meine ${selection.selectedProduct.name}. Kannst du dieses Produkt bewerten?`

  return {
    source: "product_lookup_clarification",
    original_user_message: originalUserMessage,
    selected_product: {
      id: selection.selectedProduct.id,
      name: selection.selectedProduct.name,
      category: selection.selectedProduct.category,
    },
    lookup_identity: {
      category: selection.lookupIdentity.category,
      brand_text: selection.lookupIdentity.brandText,
      product_name_text: selection.lookupIdentity.productNameText,
      evidence_quote: selection.lookupIdentity.evidenceQuote,
    },
  }
}

export function buildTrustedSelectedProductLookupResult(
  context: AgentV2TrustedSelectedProductContext,
): AgentV2ProductLookupValidationResult {
  return {
    status: "found_exact",
    category: context.lookup_identity.category ?? context.selected_product.category,
    input_identity: {
      category: context.lookup_identity.category ?? context.selected_product.category,
      brand_text: context.lookup_identity.brand_text,
      product_name_text: context.lookup_identity.product_name_text ?? context.selected_product.name,
      evidence_quote: context.lookup_identity.evidence_quote ?? context.original_user_message,
    },
    product: {
      id: context.selected_product.id,
      name: context.selected_product.name,
    },
  }
}

export function buildTrustedSelectedProductProjection(
  context: AgentV2TrustedSelectedProductContext,
): AgentV2SelectProductsProjection {
  return {
    tool_name: "select_products",
    category: context.selected_product.category as AgentV2SelectProductsProjection["category"],
    decision: "recommended",
    product_response_policy: "recommend_with_caveat",
    policy_reason:
      "User selected this verified catalog product from a clarification card; treat it as the resolved product identity, while avoiding unsupported product-specific claims.",
    valid_product_ids: [context.selected_product.id],
    products: [
      {
        product_id: context.selected_product.id,
        rank: 1,
        name: context.selected_product.name,
        brand: null,
        price_eur: null,
        currency: null,
        fit_reason:
          "Vom Nutzer aus der Produktklärung ausgewählt und als Katalogprodukt bestätigt.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
    missing_required_data: [],
    constraint_blockers: [],
    comparison_facts: null,
    allowed_claim_sources: ["selected_products.name", "product_lookup_selection"],
    trace: {
      profile_basis: [],
      category_guidance: "",
    },
  } satisfies AgentV2SelectProductsProjection
}

export function buildActiveResolvedProductContext(
  context: AgentV2TrustedSelectedProductContext | null | undefined,
): AgentV2ActiveResolvedProductContext | null {
  if (!context) return null
  return {
    source: "product_lookup_selection",
    product_id: context.selected_product.id,
    name: context.selected_product.name,
    category: context.selected_product.category,
    original_user_message: context.original_user_message,
  }
}

export function buildActiveProductContextFromTrustedSelection(
  context: AgentV2TrustedSelectedProductContext | null | undefined,
  nowIso = new Date().toISOString(),
): AgentV2ActiveProductContext | null {
  if (!context) return null
  return {
    status: "resolved",
    product_id: context.selected_product.id,
    submission_id: null,
    category: context.selected_product.category,
    brand_text: context.lookup_identity.brand_text,
    product_name_text: context.lookup_identity.product_name_text ?? context.selected_product.name,
    display_name: context.selected_product.name,
    original_user_message: context.original_user_message,
    source: "product_lookup_selection",
    updated_at: nowIso,
  }
}

export function buildActiveResolvedProductContextFromLookup(params: {
  result:
    | {
        status: string
        product?: {
          id: string
          name: string
          category_key?: string | null
        } | null
      }
    | null
    | undefined
  inputCategory: string | null
  originalUserMessage: string
  displayName: string | null
}): AgentV2ActiveResolvedProductContext | null {
  if (params.result?.status !== "found_exact" || !params.result.product) return null

  return {
    source: "product_lookup_selection",
    product_id: params.result.product.id,
    name: params.displayName?.trim() || params.result.product.name,
    category: params.result.product.category_key ?? params.inputCategory ?? null,
    original_user_message: params.originalUserMessage,
  }
}

export function buildActiveProductContextFromLookup(params: {
  result:
    | {
        status: string
        product?: {
          id: string
          name: string
          category_key?: string | null
        } | null
      }
    | null
    | undefined
  inputCategory: string | null
  inputBrandText?: string | null
  inputProductNameText?: string | null
  originalUserMessage: string
  displayName: string | null
  nowIso?: string
}): AgentV2ActiveProductContext | null {
  if (params.result?.status !== "found_exact" || !params.result.product) return null

  const displayName = params.displayName?.trim() || params.result.product.name
  return {
    status: "resolved",
    product_id: params.result.product.id,
    submission_id: null,
    category: params.result.product.category_key ?? params.inputCategory ?? null,
    brand_text: params.inputBrandText ?? null,
    product_name_text: params.inputProductNameText ?? displayName,
    display_name: displayName,
    original_user_message: params.originalUserMessage,
    source: "lookup_exact",
    updated_at: params.nowIso ?? new Date().toISOString(),
  }
}

export function buildActiveProductContextFromIntakeOffer(
  offer: ProductIntakeOffer | null | undefined,
  originalUserMessage: string,
  nowIso = new Date().toISOString(),
): AgentV2ActiveProductContext | null {
  if (!offer) return null
  const brandText = offer.extracted_identity?.brand_text?.trim() || null
  const productNameText = offer.extracted_identity?.product_name_text?.trim() || null
  const displayName = [brandText, productNameText].filter(Boolean).join(" ").trim()
  if (!displayName) return null

  return {
    status: "pending_review",
    product_id: null,
    submission_id: offer.submission_id ?? null,
    category: offer.category ?? null,
    brand_text: brandText,
    product_name_text: productNameText,
    display_name: displayName,
    original_user_message: originalUserMessage,
    source: "product_intake_submission",
    updated_at: nowIso,
  }
}

export function activeProductContextToResolvedProductContext(
  context: AgentV2ActiveProductContext | null | undefined,
): AgentV2ActiveResolvedProductContext | null {
  if (!context || context.status !== "resolved" || !context.product_id) return null
  return {
    source: context.source,
    product_id: context.product_id,
    name: context.display_name,
    category: context.category,
    original_user_message: context.original_user_message,
  }
}

export function activeProductContextToTrustedSelectedProductContext(
  context: AgentV2ActiveProductContext | null | undefined,
): AgentV2TrustedSelectedProductContext | null {
  if (!context || context.status !== "resolved" || !context.product_id) return null
  return {
    source: "product_lookup_clarification",
    original_user_message: context.original_user_message,
    selected_product: {
      id: context.product_id,
      name: context.display_name,
      category: context.category,
    },
    lookup_identity: {
      category: context.category,
      brand_text: context.brand_text,
      product_name_text: context.product_name_text ?? context.display_name,
      evidence_quote: context.display_name,
    },
  }
}

export function buildPrimaryResolvedProductContext(
  contexts: readonly AgentV2ActiveProductContext[],
): AgentV2ActiveResolvedProductContext | null {
  for (let index = contexts.length - 1; index >= 0; index -= 1) {
    if (contexts[index]?.status === "pending_review") continue
    const resolved = activeProductContextToResolvedProductContext(contexts[index])
    if (resolved) return resolved
  }
  return null
}

export function mergeActiveProductContexts(params: {
  previous: readonly AgentV2ActiveProductContext[]
  next: readonly AgentV2ActiveProductContext[]
  latestMessageNamesActionableProduct: boolean
}): AgentV2ActiveProductContext[] {
  if (params.next.length === 0) {
    return params.latestMessageNamesActionableProduct ? [] : [...params.previous].slice(-3)
  }

  const contextsByKey = new Map<string, AgentV2ActiveProductContext>()
  const upsert = (context: AgentV2ActiveProductContext) => {
    if (context.status === "resolved") {
      const pendingIdentityKey = activeProductContextPendingIdentityKey(context)
      if (pendingIdentityKey) {
        contextsByKey.delete(`pending:${pendingIdentityKey}`)
      }
    }
    contextsByKey.set(activeProductContextKey(context), context)
  }

  for (const context of params.previous) upsert(context)
  for (const context of params.next) upsert(context)

  return [...contextsByKey.values()]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(-3)
}

function activeProductContextKey(context: AgentV2ActiveProductContext): string {
  if (context.product_id) return `product:${context.product_id}`
  if (context.status === "pending_review") {
    const pendingIdentityKey = activeProductContextPendingIdentityKey(context)
    if (pendingIdentityKey) return `pending:${pendingIdentityKey}`
  }
  if (context.submission_id) return `submission:${context.submission_id}`
  return `pending:${context.category ?? ""}:${context.brand_text ?? ""}:${
    context.product_name_text ?? context.display_name
  }`.toLocaleLowerCase("de-DE")
}

function activeProductContextPendingIdentityKey(
  context: AgentV2ActiveProductContext,
): string | null {
  const productName = (context.product_name_text ?? context.display_name).trim()
  if (!productName) return null

  return [context.category?.trim() ?? "", context.brand_text?.trim() ?? "", productName]
    .join(":")
    .toLocaleLowerCase("de-DE")
}

export function buildNextActiveResolvedProductContext(params: {
  previous: AgentV2ActiveResolvedProductContext | null
  trustedSelectedProductContext?: AgentV2TrustedSelectedProductContext | null
  deterministicResolvedProductContext: AgentV2ActiveResolvedProductContext | null
  latestMessageNamesActionableProduct: boolean
}): AgentV2ActiveResolvedProductContext | null {
  const selectedContext = buildActiveResolvedProductContext(params.trustedSelectedProductContext)
  if (selectedContext) return selectedContext
  if (params.deterministicResolvedProductContext) return params.deterministicResolvedProductContext
  if (params.latestMessageNamesActionableProduct) return null
  return params.previous
}

export function buildStoredProjectionForTrustedSelectedProduct(
  context: AgentV2TrustedSelectedProductContext | null | undefined,
): AgentV2StoredProductProjection | null {
  if (!context) return null
  return {
    tool_name: "select_products",
    category: context.selected_product.category as AgentV2StoredProductProjection["category"],
    valid_product_ids: [context.selected_product.id],
    products: [
      {
        product_id: context.selected_product.id,
        rank: 1,
        name: context.selected_product.name,
        brand: null,
        price_eur: null,
        currency: null,
        fit_reason: "Vom Nutzer aus der Produktklärung ausgewählt.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
  }
}
