import type {
  ProductCareBalanceContext,
  ProductResponsePolicy,
  SelectProductsDecision,
  SelectedProductsMissingInfo,
  SelectProductsToolResult,
  SupportedProductClaim,
  UnsupportedRequestedSignal,
} from "@/lib/agent/tools/select-products"
import type { SelectableProductCategory } from "@/lib/agent/contracts"

export interface AgentV2SelectProductsProjection {
  tool_name: "select_products"
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  product_response_policy: ProductResponsePolicy
  policy_reason: string
  valid_product_ids: string[]
  products: Array<{
    product_id: string
    rank: number
    name: string
    brand: string | null
    product_line_name?: string | null
    price_eur: number | null
    currency: string | null
    fit_reason: string
    caveat: string | null
    supported_claims: SupportedProductClaim[]
    unsupported_requested_signals: UnsupportedRequestedSignal[]
  }>
  missing_required_data: SelectedProductsMissingInfo[]
  constraint_blockers: UnsupportedRequestedSignal[]
  comparison_facts: Record<string, string[]> | null
  care_balance_context?: ProductCareBalanceContext | null
  allowed_claim_sources: string[]
  trace: {
    profile_basis: string[]
    category_guidance: string
  }
}

export function projectSelectProductsForAgentV2(
  result: SelectProductsToolResult,
  options: { includeCareBalanceContext?: boolean } = {},
): AgentV2SelectProductsProjection {
  const projection = result.projection
  const productSignals = projection.products.flatMap(
    (product) => product.unsupported_requested_signals,
  )

  return {
    tool_name: "select_products",
    category: projection.category,
    decision: projection.decision,
    product_response_policy: projection.product_response_policy,
    policy_reason: projection.policy_reason,
    valid_product_ids: projection.products.map((product) => product.product_id),
    products: projection.products.map((product) => ({
      product_id: product.product_id,
      rank: product.rank,
      name: product.name,
      brand: product.brand,
      product_line_name: product.product_line_name ?? null,
      price_eur: product.price_eur,
      currency: product.currency,
      fit_reason: product.fit_reason,
      caveat: product.caveat,
      supported_claims: product.supported_claims,
      unsupported_requested_signals: product.unsupported_requested_signals,
    })),
    missing_required_data: projection.missing_info,
    constraint_blockers: [...projection.unsupported_requested_signals, ...productSignals],
    comparison_facts: projection.comparison_facts,
    ...(options.includeCareBalanceContext
      ? { care_balance_context: projection.care_balance_context ?? null }
      : {}),
    allowed_claim_sources: [
      "selected_products.supported_claims",
      "selected_products.comparison_facts",
      "selected_products.profile_basis",
      "selected_products.category_guidance",
      "selected_products.caveat",
      ...(options.includeCareBalanceContext ? ["selected_products.care_balance_context"] : []),
    ],
    trace: {
      profile_basis: projection.profile_basis,
      category_guidance: projection.category_guidance,
    },
  }
}
