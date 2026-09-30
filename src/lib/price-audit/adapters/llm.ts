import { HOST_DENYLIST, isUsableUrl, passesBrandDirect } from "../../affiliate-research/url-gate"
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

  if (!evidenceUrl || !isAcceptableEvidenceUrl(evidenceUrl, candidate.brand)) {
    // No verifiable, gate-passing source — the number alone is not evidence.
    return {
      kind: "mismatch",
      reason: "no_price_found",
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
    buyable: parsed.buyable_at_stored_link !== false,
    buyableSource: "text",
    evidenceUrl,
    observedName,
  }
}

/**
 * The CLI prints reasoning/log lines around the answer; take the last
 * parseable JSON object. The contract asks for one flat object, so matching
 * brace-free spans is sufficient and immune to noise like `{ not json }`.
 */
export function extractJsonAnswer(output: string): Record<string, unknown> | null {
  const matches = output.match(/\{[^{}]*\}/g)
  if (!matches) return null
  for (let index = matches.length - 1; index >= 0; index--) {
    try {
      const parsed: unknown = JSON.parse(matches[index])
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      continue
    }
  }
  return null
}

export function isAcceptableEvidenceUrl(url: string, brand: string | null): boolean {
  if (!isUsableUrl(url)) return false
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  if (HOST_DENYLIST.has(host) || HOST_DENYLIST.has(host.replace(/^www\./, ""))) return false
  // Known retailers, plus the brand's own shop for long-tail products.
  return isKnownRetailerHost(host) || passesBrandDirect(host, brand)
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
