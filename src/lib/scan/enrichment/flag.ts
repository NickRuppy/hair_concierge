import "server-only"

export function isRetailerEnrichmentEnabled(): boolean {
  return process.env.SCAN_RETAILER_ENRICHMENT_ENABLED === "true"
}

export function retailerEnrichmentTimeoutMs(
  value = process.env.SCAN_RETAILER_ENRICHMENT_TIMEOUT_MS,
): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : 1500
}
