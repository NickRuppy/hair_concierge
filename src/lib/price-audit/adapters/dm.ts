import { canonicalizeGtin } from "../../product-identity/normalize"
import type { PriceAuditCandidate, RetailerObservation } from "../contracts"

/**
 * dm adapter. Price, purchasability and sellout come from the official dm MCP
 * `searchProducts` (`getProductDetails` is documented "NOT FOR: prices,
 * availability"). The query is brand + name — dm's search treats a raw GTIN
 * query as fuzzy text and returns unrelated products (probed 2026-09-30) — and
 * the row is then matched by canonical GTIN, which also separates sizes
 * (400 ml vs 1 l carry different GTINs, keeping the HAI-124 default-size
 * rule). Identity needs two ties before anything may auto-write:
 *
 * 1. a search row's canonical GTIN is one of the product's stored GTINs, and
 * 2. the stored dm affiliate link resolves to the same product — its embedded
 *    DAN (`/p/d/<dan>/…`) or GTIN (`…-p<gtin>.html`) matches that row.
 *
 * Without the second tie the observation is a `stored_link_mismatch` review
 * proposal (link replacement stays review-only per HAI-124). The MCP `appLink`
 * carries `wt_mc=dm-mcp` tracking and is never written anywhere.
 */

export type DmSearch = (query: string) => Promise<Array<Record<string, string>>>

export async function observeViaDm(
  candidate: PriceAuditCandidate,
  deps: { search: DmSearch },
): Promise<RetailerObservation> {
  const gtins = candidate.canonicalGtin14s
    .map((gtin) => canonicalizeGtin(gtin))
    .filter((gtin): gtin is string => gtin !== null)
  if (gtins.length === 0) {
    // dm identity is GTIN-based; without one the row cannot be auto-confirmed.
    return {
      kind: "mismatch",
      reason: "gtin_mismatch",
      evidenceUrl: candidate.affiliateLink,
      observedName: null,
      observedPriceEur: null,
    }
  }

  const query = [candidate.brand, candidate.name]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
  if (!query) {
    return {
      kind: "mismatch",
      reason: "not_found",
      evidenceUrl: candidate.affiliateLink,
      observedName: null,
      observedPriceEur: null,
    }
  }

  let rows: Array<Record<string, string>>
  try {
    rows = await deps.search(query)
  } catch {
    return { kind: "failed", reason: "adapter_unavailable" }
  }

  const match = rows.find((row) => {
    const canonical = canonicalDmGtin(row.gtin)
    return canonical !== null && gtins.includes(canonical)
  })
  if (!match) {
    return {
      kind: "mismatch",
      reason: rows.length === 0 ? "not_found" : "gtin_mismatch",
      evidenceUrl: candidate.affiliateLink,
      observedName: rows[0]?.title ?? null,
      observedPriceEur: null,
    }
  }

  const observedName = match.title ?? null
  const observedPriceEur = parseDmPrice(match.price)

  const linkTie = storedLinkMatches(candidate.affiliateLink, match)
  if (!linkTie) {
    return {
      kind: "mismatch",
      reason: "stored_link_mismatch",
      evidenceUrl: candidate.affiliateLink,
      observedName,
      observedPriceEur,
    }
  }

  if (observedPriceEur === null) {
    return {
      kind: "mismatch",
      reason: "no_price_found",
      evidenceUrl: candidate.affiliateLink,
      observedName,
      observedPriceEur: null,
    }
  }

  const buyable = dmBuyable(match)
  if (buyable === null) {
    return {
      kind: "mismatch",
      reason: "availability_unknown",
      evidenceUrl: candidate.affiliateLink,
      observedName,
      observedPriceEur,
    }
  }

  return {
    kind: "confirmed",
    identity: "gtin_match",
    priceEur: observedPriceEur,
    buyable,
    buyableSource: "structured",
    evidenceUrl: candidate.affiliateLink ?? "",
    observedName,
  }
}

/**
 * dm's search sometimes drops a leading zero; recover it exactly like the scan
 * search boundary (`search-retailer/route.ts`) before canonicalizing.
 */
function canonicalDmGtin(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null
  const padded = /^\d+$/.test(raw) && raw.length < 12 ? raw.padStart(12, "0") : raw
  return canonicalizeGtin(padded)
}

export function storedLinkMatches(
  affiliateLink: string | null,
  row: Record<string, string>,
): boolean {
  if (!affiliateLink) return false
  const danMatch = affiliateLink.match(/\/p\/d\/(\d{6,8})(?:\/|$|\?)/)
  if (danMatch && typeof row.dan === "string") {
    return danMatch[1] === row.dan
  }
  const gtinMatch = affiliateLink.match(/-p(\d{8,14})\.html/)
  if (gtinMatch) {
    const linkGtin = canonicalDmGtin(gtinMatch[1])
    const rowGtin = canonicalDmGtin(row.gtin)
    return linkGtin !== null && linkGtin === rowGtin
  }
  return false
}

function parseDmPrice(price: string | undefined): number | null {
  if (typeof price !== "string") return null
  const normalized = price.replace(/[^\d,.]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function dmBuyable(row: Record<string, string>): boolean | null {
  if (row.sellout === "true") return false
  if (row.purchasable === "true") return true
  if (row.purchasable === "false") return false
  return null
}
