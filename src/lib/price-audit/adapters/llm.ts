import { HOST_DENYLIST, isUsableUrl } from "../../affiliate-research/url-gate"
import type { PriceAuditCandidate, RetailerObservation } from "../contracts"

/**
 * GPT fallback lane (Nick, 2026-09-30): when no deterministic adapter could
 * confirm a product — bot-walled shop, no adapter for the host, GTIN or
 * stored-link mismatch — the same run escalates to the Codex CLI (already
 * installed on the Hetzner worker for product intake) and asks it to research
 * the current price the way a human would.
 *
 * The result carries identity `llm_research`, which the decision module
 * restricts to writing `price_eur` + `price_checked_at` only. A claim that
 * the stored link is dead goes to review; `purchase_link_status` is never
 * written from an LLM answer. Evidence URLs are validated against the
 * affiliate url-gate (deny aggregators; allow known retailers and
 * brand-direct shops) before the answer counts as confirmed.
 */

export type RunLlmResearch = (prompt: string) => Promise<string>

export function llmResearchPrompt(candidate: PriceAuditCandidate): string {
  return [
    "You are a price researcher for a German hair-care catalog. Research the CURRENT retail price of this exact product:",
    `- Brand: ${candidate.brand ?? "unknown"}`,
    `- Name: ${candidate.name}`,
    candidate.canonicalGtin14s.length > 0
      ? `- GTIN/EAN: ${candidate.canonicalGtin14s.join(", ")}`
      : null,
    `- Stored shop link: ${candidate.affiliateLink ?? "none"}`,
    candidate.priceEur !== null ? `- Last known price: ${candidate.priceEur} EUR` : null,
    "",
    "Rules:",
    "- Price must be the current regular price in EUR for the default consumer size, from a product-detail page of a German retailer or the brand's own shop. Never a discount-code price, never a search page, marketplace listing, or price-comparison/aggregator site (idealo, geizhals, billiger, ebay, kleinanzeigen are forbidden).",
    "- Prefer the shop of the stored link. Also state whether that stored link's page currently offers the product as online-buyable.",
    "- If you cannot establish the exact product with confidence, say so instead of guessing.",
    "",
    'Answer with ONLY one JSON object, no other text: {"found": boolean, "price_eur": number|null, "buyable_at_stored_link": boolean|null, "evidence_url": string|null, "observed_name": string|null, "notes": string}',
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

export async function observeViaLlm(
  candidate: PriceAuditCandidate,
  deps: { runResearch: RunLlmResearch },
): Promise<RetailerObservation> {
  let output: string
  try {
    output = await deps.runResearch(llmResearchPrompt(candidate))
  } catch {
    return { kind: "failed", reason: "adapter_unavailable" }
  }

  const parsed = extractJsonAnswer(output)
  if (!parsed) return { kind: "failed", reason: "adapter_unavailable" }

  const observedName = stringOrNull(parsed.observed_name)
  const evidenceUrl = stringOrNull(parsed.evidence_url)

  if (parsed.found !== true) {
    return {
      kind: "mismatch",
      reason: "not_found",
      evidenceUrl,
      observedName,
      observedPriceEur: null,
    }
  }

  const priceEur = typeof parsed.price_eur === "number" ? parsed.price_eur : null
  if (priceEur === null || !Number.isFinite(priceEur)) {
    return {
      kind: "mismatch",
      reason: "no_price_found",
      evidenceUrl,
      observedName,
      observedPriceEur: null,
    }
  }

  if (
    !evidenceUrl ||
    !isAcceptableEvidenceUrl(evidenceUrl, candidate.brand, storedLinkHost(candidate.affiliateLink))
  ) {
    // No verifiable, gate-passing source — the number alone is not evidence.
    return {
      kind: "mismatch",
      reason: "no_price_found",
      evidenceUrl,
      observedName,
      observedPriceEur: priceEur,
    }
  }

  // The availability claim must be a real boolean or null; any other shape
  // means the answer did not follow the contract and goes to review.
  const buyableClaim = parsed.buyable_at_stored_link
  if (
    buyableClaim !== true &&
    buyableClaim !== false &&
    buyableClaim !== null &&
    buyableClaim !== undefined
  ) {
    return {
      kind: "mismatch",
      reason: "availability_unknown",
      evidenceUrl,
      observedName,
      observedPriceEur: priceEur,
    }
  }

  return {
    kind: "confirmed",
    identity: "llm_research",
    priceEur,
    // `false` routes to review in `decide`; an unknown claim never blocks the
    // price write because the LLM lane cannot touch the status anyway.
    buyable: buyableClaim !== false,
    buyableSource: "text",
    evidenceUrl,
    observedName,
  }
}

/**
 * The CLI prints reasoning/log lines around the answer. Scan for balanced
 * JSON objects (string- and escape-aware, so `"{brace}"` inside a value is
 * fine), parse each, and keep the LAST one that carries the answer schema's
 * `found` boolean — log objects without it never win over the final answer.
 */
export function extractJsonAnswer(output: string): Record<string, unknown> | null {
  // The answer is the LAST schema object in the transcript, so walk the `{`
  // positions backward from the end and return the first parse that carries
  // the boolean `found`. A size cap and an attempt cap keep hostile input
  // (e.g. hundreds of thousands of stray braces) cheap: late attempts scan
  // only short suffixes, and the caps bound everything else.
  const text = output.length > MAX_SCAN_CHARS ? output.slice(-MAX_SCAN_CHARS) : output
  let attempts = 0
  for (
    let start = text.lastIndexOf("{");
    start !== -1 && attempts < MAX_PARSE_ATTEMPTS;
    start = start === 0 ? -1 : text.lastIndexOf("{", start - 1)
  ) {
    attempts++
    const end = matchingBrace(text, start)
    if (end === -1) continue
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1))
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).found === "boolean"
      ) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Not JSON at this start — keep walking backward.
    }
  }
  return null
}

const MAX_SCAN_CHARS = 256 * 1024
const MAX_PARSE_ATTEMPTS = 100

function matchingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (escaped) {
      escaped = false
    } else if (inString) {
      if (char === "\\") escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
    } else if (char === "{") {
      depth++
    } else if (char === "}") {
      depth--
      if (depth === 0) return index
    }
  }
  return -1
}

export function isAcceptableEvidenceUrl(
  url: string,
  brand: string | null,
  storedHost: string | null = null,
): boolean {
  if (!isUsableUrl(url)) return false
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  const bare = host.replace(/^www\./, "")
  // Deny aggregators including their subdomains (olaplex.idealo.de is idealo).
  for (const denied of HOST_DENYLIST) {
    if (bare === denied || bare.endsWith(`.${denied}`)) return false
  }
  // Known retailers; the product's OWN stored shop host (DB-verified, covers
  // oddly-named brand shops like neqi-hair.com); or the brand's exact domain.
  if (isKnownRetailerHost(host)) return true
  if (storedHost && (bare === storedHost || bare.endsWith(`.${storedHost}`))) return true
  return isBrandOwnedHost(bare, brand)
}

export function storedLinkHost(affiliateLink: string | null): string | null {
  if (!affiliateLink) return null
  try {
    return new URL(affiliateLink).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/**
 * Brand-direct means the REGISTRABLE domain IS the brand — exactly, after
 * stripping separators. `olaplex.attacker.example`, `olaplex-scam.com` and
 * `olap.com` are not Olaplex; prefix or substring matching would let an
 * injected answer smuggle its own host past the gate. Shops whose domain is
 * not the plain brand name are covered by the stored-link-host alias above.
 * Crude two-label registrable extraction is enough for this catalog's shop
 * TLDs (.de/.com/.at/.nl).
 */
export function isBrandOwnedHost(bareHost: string, brand: string | null): boolean {
  if (!brand) return false
  const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (brandSlug.length < 4) return false
  const labels = bareHost.split(".")
  if (labels.length < 2) return false
  const registrableLabel = labels[labels.length - 2].replace(/[^a-z0-9]/g, "")
  return registrableLabel === brandSlug
}

const KNOWN_RETAILER_HOSTS = [
  "dm.de",
  "rossmann.de",
  "mueller.de",
  "douglas.de",
  "flaconi.de",
  "notino.de",
  "hagel-shop.de",
  "shop-apotheke.com",
  "amazon.de",
]

function isKnownRetailerHost(host: string): boolean {
  const bare = host.replace(/^www\./, "")
  return KNOWN_RETAILER_HOSTS.some((known) => bare === known || bare.endsWith(`.${known}`))
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
