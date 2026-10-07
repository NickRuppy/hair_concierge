import { canonicalizeGtin } from "@/lib/product-identity/normalize"

export type ScannedIdentifierPacketValue = { type: string; value: string } | null

export type RetailerEnrichmentPacket = {
  source: "dm"
  fetched_at: string
  gtin: string
  dan: string
  product_name: string
  brand: string | null
  ingredients_text: string | null
  product_url: string | null
  image_url_candidate: string | null
  suggested_category: string | null
}

export type RetailerEnrichmentPacketParseResult = {
  packet: RetailerEnrichmentPacket | null
  warning: "gtin_mismatch" | null
}

type RetailerEnrichmentWarningEmit = (
  message: "product_intake_retailer_enrichment_warning",
  fields: { source: "dm"; reason: "gtin_mismatch" },
) => void

const RETAILER_ENRICHMENT_WARNING_THROTTLE_MS = 60_000

/**
 * Gives the long-running worker a local, low-cardinality warning throttle.
 * The caller cannot pass GTIN, user, product, URL, or response data into this
 * reporter; those values never reach logs.
 */
export function createRetailerEnrichmentWarningReporter(options: {
  emit: RetailerEnrichmentWarningEmit
  now?: () => number
}): (warning: RetailerEnrichmentPacketParseResult["warning"]) => void {
  const now = options.now ?? Date.now
  let nextAllowedAt = 0

  return (warning) => {
    if (warning !== "gtin_mismatch") return
    const currentTime = now()
    if (currentTime < nextAllowedAt) return
    nextAllowedAt = currentTime + RETAILER_ENRICHMENT_WARNING_THROTTLE_MS
    try {
      options.emit("product_intake_retailer_enrichment_warning", {
        source: "dm",
        reason: "gtin_mismatch",
      })
    } catch {
      // Diagnostics must not stop a research job.
    }
  }
}

/**
 * Builds a research-only dm lead from immutable submission provenance. It
 * accepts only a row whose returned GTIN canonicalizes to the scanned GTIN;
 * mismatches stay visible in intake_history but cannot influence research.
 */
export function retailerEnrichmentPacketFromIntakeHistory(
  intakeHistory: unknown,
  scannedIdentifier: ScannedIdentifierPacketValue,
): RetailerEnrichmentPacket | null {
  return parseRetailerEnrichmentPacket(intakeHistory, scannedIdentifier).packet
}

export function parseRetailerEnrichmentPacket(
  intakeHistory: unknown,
  scannedIdentifier: ScannedIdentifierPacketValue,
): RetailerEnrichmentPacketParseResult {
  const scannedGtin = scannedIdentifier ? canonicalizeGtin(scannedIdentifier.value) : null
  if (!scannedGtin || !Array.isArray(intakeHistory)) return { packet: null, warning: null }

  for (const entry of [...intakeHistory].reverse()) {
    const record = objectValue(entry)
    if (record?.source !== "retailer_enrichment" || record.retailer !== "dm") continue
    const enrichment = objectValue(record.enrichment)
    if (!enrichment || enrichment.source !== "dm") continue

    const returnedGtin = stringValue(enrichment.gtin)
    const canonicalReturnedGtin = returnedGtin ? canonicalizeGtin(returnedGtin) : null
    if (canonicalReturnedGtin && canonicalReturnedGtin !== scannedGtin) {
      return { packet: null, warning: "gtin_mismatch" }
    }
    if (!returnedGtin || !canonicalReturnedGtin) continue

    const fetchedAt = stringValue(enrichment.fetchedAt)
    const dan = stringValue(enrichment.dan)
    const productName = stringValue(enrichment.productName)
    if (!fetchedAt || !dan || !productName) continue

    return {
      packet: {
        source: "dm",
        fetched_at: fetchedAt,
        gtin: returnedGtin,
        dan,
        product_name: productName,
        brand: stringValue(enrichment.brand),
        ingredients_text: stringValue(enrichment.ingredientsText),
        product_url: stringValue(enrichment.productUrl),
        // Deliberately not image_url: this is a raw retailer candidate, not a
        // final catalog asset.
        image_url_candidate: stringValue(enrichment.imageUrl),
        suggested_category: stringValue(enrichment.suggestedCategory),
      },
      warning: null,
    }
  }

  return { packet: null, warning: null }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
