const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120

export class ProductInventoryContractError extends Error {
  constructor(
    public readonly code: "invalid_query",
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
