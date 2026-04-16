import type { MatchedProduct } from "@/lib/rag/product-matcher"

export interface SelectionResult {
  products: MatchedProduct[]
}
