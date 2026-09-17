import "server-only"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { reportRetailerLookupWarning } from "@/lib/observability/scan"
import { createDmMcpClient, DmMcpError, type DmMcpClient } from "./dm-mcp-client"
import { isRetailerEnrichmentEnabled, retailerEnrichmentTimeoutMs } from "./flag"
import { suggestCategoryFromRetailerName } from "./suggest-category"
import type { RetailerEnrichment, RetailerLookupOutcome, RetailerLookupResult } from "./types"
export type { RetailerLookupOutcome, RetailerLookupResult } from "./types"

export type ResolveRetailerEnrichmentDeps = {
  client: DmMcpClient
  flag: () => boolean
  now: () => string
  monotonicNow: () => number
  deadlineMs: number
  reportUnexpected: (details: {
    route: "resolve" | "submit"
    reason: RetailerLookupOutcome
  }) => void
  route: "resolve" | "submit"
}
export async function resolveRetailerEnrichment(
  scannedValue: string,
  deps: Partial<ResolveRetailerEnrichmentDeps> & { route: "resolve" | "submit" },
): Promise<RetailerLookupResult> {
  const clock = deps.monotonicNow ?? (() => performance.now())
  const deadlineMs = deps.deadlineMs ?? retailerEnrichmentTimeoutMs()
  let started: number | null = null
  const finish = (
    outcome: RetailerLookupOutcome,
    enrichment: RetailerEnrichment | null = null,
  ): RetailerLookupResult => {
    if (
      outcome === "unexpected" ||
      outcome === "transport" ||
      outcome === "malformed" ||
      outcome === "gtin_mismatch" ||
      outcome === "session_expired"
    ) {
      try {
        const report = deps.reportUnexpected ?? reportRetailerLookupWarning
        report({
          route: deps.route,
          reason: outcome,
        })
      } catch {
        /* telemetry must fail open too */
      }
    }
    return {
      enrichment,
      outcome,
      durationMs: started === null ? null : Math.max(0, Math.round(clock() - started)),
      deadlineMs: started === null ? null : deadlineMs,
    }
  }
  try {
    if (!(deps.flag ?? isRetailerEnrichmentEnabled)()) return finish("disabled")
    const gtin = canonicalizeGtin(scannedValue)
    if (!gtin) return finish("invalid_gtin")
    const client = deps.client ?? createDmMcpClient({ deadlineMs })
    started = clock()
    const rows = await client.getProductDetails([gtin])
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || (row.found !== "true" && row.found !== "false"))
    )
      return finish("malformed")
    const found = rows.filter((row) => row.found === "true")
    if (found.length === 0) return finish("not_found")
    const matches = found.filter(
      (row) => typeof row.gtin === "string" && canonicalizeGtin(row.gtin) === gtin,
    )
    if (matches.length === 0) return finish("gtin_mismatch")
    if (matches.length !== 1) return finish("malformed")
    const row = matches[0]
    if (!row.productName?.trim() || !/^\d{7}$/.test(row.dan)) return finish("malformed")
    return finish("hit", {
      source: "dm",
      fetchedAt: (deps.now ?? (() => new Date().toISOString()))(),
      gtin,
      dan: row.dan,
      productName: row.productName,
      brand: nullable(row.brand),
      imageUrl: validateDmImageUrl(row.image),
      productUrl: nullable(row.productUrl),
      ingredientsText: nullable(row.nonFoodIngredients),
      description: nullable(row.description),
      keyBenefits: nullable(row.keyBenefits),
      suggestedCategory: suggestCategoryFromRetailerName(row.productName),
    })
  } catch (error) {
    return finish(error instanceof DmMcpError ? error.reason : "unexpected")
  }
}

function nullable(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** Must stay aligned with the exact Next image remotePattern; never render the raw URL directly. */
export function validateDmImageUrl(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      url.hostname !== "products.dm-static.com" ||
      !url.pathname.startsWith("/images/") ||
      url.username ||
      url.password ||
      url.port
    )
      return null
    return value
  } catch {
    return null
  }
}
