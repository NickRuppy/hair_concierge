import "server-only"

export function isRetailerEnrichmentEnabled(): boolean {
  return process.env.SCAN_RETAILER_ENRICHMENT_ENABLED === "true"
}

/**
 * Gate for `GET /api/scan/search-retailer` (T3): the retailer name-search lane is its own
 * flag, but it is meaningless without the base dm enrichment flag also being on — both
 * must be true.
 */
export function isRetailerSearchEnabled(): boolean {
  return process.env.SCAN_RETAILER_SEARCH_ENABLED === "true" && isRetailerEnrichmentEnabled()
}

export function retailerEnrichmentTimeoutMs(
  value = process.env.SCAN_RETAILER_ENRICHMENT_TIMEOUT_MS,
): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : 1500
}
