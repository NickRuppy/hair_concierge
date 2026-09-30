import { canonicalizeGtin } from "../../product-identity/normalize"
import {
  AUDIT_USER_AGENT,
  classifyKnownRetailerContent,
  normalizeBodyText,
} from "../../product-metadata/buyability"
import type { PriceAuditCandidate, RetailerObservation } from "../contracts"

/**
 * Generic PDP adapter for retailers whose product pages carry schema.org
 * Product JSON-LD (Rossmann, Müller, Douglas, …). It fetches the STORED
 * affiliate link only — it never searches for replacement pages (link
 * replacements stay a reviewed proposal per HAI-124).
 *
 * Identity ladder: JSON-LD GTIN matching a stored canonical GTIN wins;
 * without a GTIN, the page only counts as the stored PDP when the final URL
 * still is the stored URL and the observed name passes the brand/name guard.
 * Bot walls and redirects to other pages never produce a write.
 */

export type JsonLdFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; url: string; text(): Promise<string> }>

const FETCH_TIMEOUT_MS = 15_000
const BOT_WALL_PATH_MARKERS = ["/wartung", "/maintenance", "/captcha", "/blocked"]

export async function observeViaJsonLd(
  candidate: PriceAuditCandidate,
  deps: { fetch?: JsonLdFetch } = {},
): Promise<RetailerObservation> {
  const storedUrl = candidate.affiliateLink?.trim()
  if (!storedUrl) return { kind: "failed", reason: "adapter_unavailable" }

  let response: Awaited<ReturnType<JsonLdFetch>>
  try {
    response = await (deps.fetch ?? defaultFetch)(storedUrl, {
      headers: {
        "User-Agent": AUDIT_USER_AGENT,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      kind: "failed",
      reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "http_error",
    }
  }

  if (!response.ok) {
    return { kind: "failed", reason: response.status === 403 ? "bot_wall" : "http_error" }
  }

  const finalUrl = response.url || storedUrl
  if (isBotWallOrForeignRedirect(storedUrl, finalUrl)) {
    return botWallOrRedirect(storedUrl, finalUrl)
  }

  const html = await response.text()
  const product = extractJsonLdProduct(html)
  if (!product) {
    return {
      kind: "mismatch",
      reason: "no_price_found",
      evidenceUrl: finalUrl,
      observedName: null,
      observedPriceEur: null,
    }
  }

  const observedName = product.name
  if (product.ambiguousOffer) {
    // Several differing offers (sizes/sellers) without a GTIN-tied variant: the
    // extracted price could belong to a non-default size (HAI-124 size rule).
    return {
      kind: "mismatch",
      reason: "ambiguous_offer",
      evidenceUrl: finalUrl,
      observedName,
      observedPriceEur: null,
    }
  }
  const observedPriceEur = product.priceEur
  if (observedPriceEur === null) {
    return {
      kind: "mismatch",
      reason: "no_price_found",
      evidenceUrl: finalUrl,
      observedName,
      observedPriceEur: null,
    }
  }

  const identity = establishIdentity(candidate, product, storedUrl, finalUrl)
  if (identity.kind === "mismatch") {
    return { ...identity, evidenceUrl: finalUrl, observedPriceEur, observedName }
  }

  const buyability = resolveBuyability(product.availability, finalUrl, candidate.brand, html)
  if (buyability === null) {
    return {
      kind: "mismatch",
      reason: "availability_unknown",
      evidenceUrl: finalUrl,
      observedName,
      observedPriceEur,
    }
  }

  return {
    kind: "confirmed",
    identity: identity.identity,
    priceEur: observedPriceEur,
    buyable: buyability.buyable,
    buyableSource: buyability.source,
    evidenceUrl: finalUrl,
    observedName,
  }
}

const defaultFetch: JsonLdFetch = (url, init) => fetch(url, init)

function isBotWallOrForeignRedirect(storedUrl: string, finalUrl: string): boolean {
  if (normalizedUrl(storedUrl) === normalizedUrl(finalUrl)) return false
  try {
    const finalPath = new URL(finalUrl).pathname.toLowerCase()
    if (BOT_WALL_PATH_MARKERS.some((marker) => finalPath.includes(marker))) return true
  } catch {
    return true
  }
  return hostOf(storedUrl) !== hostOf(finalUrl)
}

function botWallOrRedirect(storedUrl: string, finalUrl: string): RetailerObservation {
  try {
    const finalPath = new URL(finalUrl).pathname.toLowerCase()
    if (BOT_WALL_PATH_MARKERS.some((marker) => finalPath.includes(marker))) {
      return { kind: "failed", reason: "bot_wall" }
    }
  } catch {
    return { kind: "failed", reason: "http_error" }
  }
  return {
    kind: "mismatch",
    reason: "redirected",
    evidenceUrl: finalUrl,
    observedName: null,
    observedPriceEur: null,
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

function normalizedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`
  } catch {
    return url
  }
}

type JsonLdProduct = {
  name: string | null
  gtins: string[]
  priceEur: number | null
  availability: string | null
  ambiguousOffer: boolean
}

export function extractJsonLdProduct(html: string): JsonLdProduct | null {
  const scripts = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const match of scripts) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch {
      continue
    }
    for (const node of flattenJsonLdNodes(parsed)) {
      if (!isRecord(node)) continue
      const type = node["@type"]
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"))
      if (!isProduct) continue
      return {
        name: stringOrNull(node.name),
        gtins: collectGtins(node),
        ...extractOffer(node.offers),
      }
    }
  }
  return null
}

function flattenJsonLdNodes(parsed: unknown): unknown[] {
  const roots = Array.isArray(parsed) ? parsed : [parsed]
  const nodes: unknown[] = []
  for (const root of roots) {
    nodes.push(root)
    if (isRecord(root) && Array.isArray(root["@graph"])) nodes.push(...root["@graph"])
  }
  return nodes
}

function collectGtins(node: Record<string, unknown>): string[] {
  const raw = [node.gtin14, node.gtin13, node.gtin12, node.gtin8, node.gtin, node.mpn]
  const canonical: string[] = []
  for (const value of raw) {
    if (typeof value !== "string") continue
    // Same recovery rule as the dm search boundary: all-digit values shorter
    // than 12 get a dropped leading zero back before canonicalization.
    const padded = /^\d+$/.test(value) && value.length < 12 ? value.padStart(12, "0") : value
    const gtin = canonicalizeGtin(padded)
    if (gtin && !canonical.includes(gtin)) canonical.push(gtin)
  }
  return canonical
}

function extractOffer(offers: unknown): {
  priceEur: number | null
  availability: string | null
  ambiguousOffer: boolean
} {
  const list = Array.isArray(offers) ? offers : [offers]
  const priced: Array<{ priceEur: number; availability: string | null }> = []
  for (const offer of list) {
    if (!isRecord(offer)) continue
    const type = offer["@type"]
    if (type === "AggregateOffer" || (Array.isArray(type) && type.includes("AggregateOffer"))) {
      // Aggregate low/high prices only count when they collapse to one value.
      const low = parsePrice(offer.lowPrice)
      const high = parsePrice(offer.highPrice)
      if (low !== null && low === high) {
        priced.push({ priceEur: low, availability: stringOrNull(offer.availability) })
      } else {
        return { priceEur: null, availability: null, ambiguousOffer: true }
      }
      continue
    }
    const currency = stringOrNull(offer.priceCurrency)
    if (currency && currency.toUpperCase() !== "EUR") continue
    const price =
      parsePrice(offer.price) ??
      (isRecord(offer.priceSpecification) ? parsePrice(offer.priceSpecification.price) : null)
    if (price !== null) {
      priced.push({ priceEur: price, availability: stringOrNull(offer.availability) })
    }
  }
  if (priced.length === 0) return { priceEur: null, availability: null, ambiguousOffer: false }
  const distinct = new Set(priced.map((offer) => offer.priceEur))
  if (distinct.size > 1) return { priceEur: null, availability: null, ambiguousOffer: true }
  return { ...priced[0], ambiguousOffer: false }
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^\d.]/g, "")
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function establishIdentity(
  candidate: PriceAuditCandidate,
  product: JsonLdProduct,
  storedUrl: string,
  finalUrl: string,
):
  | { kind: "confirmed"; identity: "gtin_match" | "exact_stored_pdp" }
  | { kind: "mismatch"; reason: "gtin_mismatch" | "name_mismatch" } {
  if (product.gtins.length > 0) {
    const matches = product.gtins.some((gtin) => candidate.canonicalGtin14s.includes(gtin))
    return matches
      ? { kind: "confirmed", identity: "gtin_match" }
      : { kind: "mismatch", reason: "gtin_mismatch" }
  }
  const samePage = normalizedUrl(storedUrl) === normalizedUrl(finalUrl)
  if (samePage && nameMatchesCandidate(candidate, product.name)) {
    return { kind: "confirmed", identity: "exact_stored_pdp" }
  }
  return { kind: "mismatch", reason: "name_mismatch" }
}

/**
 * Without a page GTIN the observed name must share the brand (when stored) and
 * at least half of the significant stored-name tokens; renamed or swapped
 * products fall to review instead of being silently re-priced.
 */
function nameMatchesCandidate(
  candidate: PriceAuditCandidate,
  observedName: string | null,
): boolean {
  if (!observedName) return false
  const observed = tokenize(observedName)
  if (candidate.brand) {
    const brandTokens = [...tokenize(candidate.brand)]
    if (!brandTokens.every((token) => observed.has(token))) return false
  }
  const nameTokens = [...tokenize(candidate.name)].filter((token) => token.length >= 3)
  if (nameTokens.length === 0) return false
  const hits = nameTokens.filter((token) => observed.has(token)).length
  return hits / nameTokens.length >= 0.5
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
}

function resolveBuyability(
  availability: string | null,
  finalUrl: string,
  brand: string | null,
  html: string,
): { buyable: boolean; source: "structured" | "text" } | null {
  if (availability) {
    const value = availability.toLowerCase()
    if (
      value.includes("instock") ||
      value.includes("limitedavailability") ||
      value.includes("onlineonly")
    ) {
      return { buyable: true, source: "structured" }
    }
    // Store-only pages count as unavailable per HAI-124 (online-buyable rule).
    if (
      value.includes("outofstock") ||
      value.includes("soldout") ||
      value.includes("discontinued") ||
      value.includes("instoreonly")
    ) {
      return { buyable: false, source: "structured" }
    }
    // PreOrder and unknown vocabularies fall through to the text classifier.
  }
  const host = hostOf(finalUrl)
  if (!host) return null
  const classified = classifyKnownRetailerContent(host, brand, normalizeBodyText(html))
  if (classified === "available") return { buyable: true, source: "text" }
  if (classified === "unavailable") return { buyable: false, source: "text" }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
