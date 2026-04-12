import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { CategoryDecisions } from "@/lib/rag/contracts"

export interface SelectionResult {
  products: MatchedProduct[]
  /** Updated decisions after matching (candidate counts, no_catalog_match). */
  updatedDecisions: Partial<CategoryDecisions>
}
