import { isUsableUrl, passesBrandDirect } from "../affiliate-research/url-gate"

/**
 * Retailer-page buyability classification, shared by the one-shot metadata
 * audit (`scripts/audit-product-metadata.ts`) and the recurring price-audit
 * lane. `available`/`unavailable` follow the HAI-124 binary semantics:
 * `available` means online-buyable at the stored link at audit time; `null`
 * means the page gave no readable signal and must not be written anywhere.
 */

export type BuyabilityStatus = "available" | "unavailable" | null

export const AUDIT_USER_AGENT =
  "ChaarlieProductMetadataAudit/1.0 (+read-only purchase link review; contact: product metadata audit)"

export function normalizeBodyText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ")
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

export const UNAVAILABLE_PHRASES = [
  "ausverkauft",
  "online momentan nicht verfügbar",
  "online nicht verfügbar",
  "nicht online verfügbar",
  "nicht verfügbar",
  "nicht lieferbar",
  "out of stock",
  "sold out",
]

export function classifyKnownRetailerContent(
  host: string,
  brand: string | null,
  text: string,
): BuyabilityStatus {
  if (host === "rossmann.de" || host.endsWith(".rossmann.de")) {
    if (includesAny(text, UNAVAILABLE_PHRASES)) return "unavailable"
    if (includesAny(text, ["in den warenkorb", "zum warenkorb"])) return "available"
    return null
  }

  if (host === "mueller.de" || host.endsWith(".mueller.de")) {
    if (includesAny(text, UNAVAILABLE_PHRASES)) return "unavailable"
    if (text.includes("lieferbar") && text.includes("in den warenkorb")) return "available"
    return null
  }

  if (host === "dm.de" || host.endsWith(".dm.de")) {
    if (includesAny(text, UNAVAILABLE_PHRASES)) return "unavailable"
    if (includesAny(text, ["lieferbar", "online verfügbar", "in den warenkorb"])) return "available"
    return null
  }

  const usesGenericBeautyRule =
    host === "douglas.de" ||
    host.endsWith(".douglas.de") ||
    host === "notino.de" ||
    host.endsWith(".notino.de") ||
    host === "flaconi.de" ||
    host.endsWith(".flaconi.de") ||
    host === "hagel-shop.de" ||
    host.endsWith(".hagel-shop.de") ||
    host === "epres-hair.de" ||
    host.endsWith(".epres-hair.de") ||
    passesBrandDirect(host, brand)

  if (!usesGenericBeautyRule) return null

  if (includesAny(text, UNAVAILABLE_PHRASES)) return "unavailable"

  if (
    includesAny(text, [
      "in den warenkorb",
      "zum warenkorb",
      "in den einkaufswagen",
      "auf lager",
      "vorrätig",
      "lieferbar",
      "in stock",
      "add to cart",
      "add to bag",
    ])
  ) {
    return "available"
  }

  return null
}

export async function checkStoredLinkBuyability(row: {
  affiliate_link: string | null
  brand: string | null
}): Promise<BuyabilityStatus> {
  if (typeof row.affiliate_link !== "string" || !isUsableUrl(row.affiliate_link)) {
    return "unavailable"
  }

  const url = row.affiliate_link.trim()
  const host = new URL(url).hostname.toLowerCase()

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": AUDIT_USER_AGENT,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) return null

    const text = normalizeBodyText(await response.text())
    return classifyKnownRetailerContent(host, row.brand, text)
  } catch {
    return null
  }
}
