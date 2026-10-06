/**
 * Product-id-keyed commerce presentation, shared between the Routine product
 * detail drawer (`product-detail-service.ts`) and the Stage 1 product
 * preview payload (`product-previews.ts`). Both start from the same catalog
 * row shape and must render identical availability/price/link copy for the
 * same product — this is their single source so the two surfaces never
 * drift into different wording.
 */

export type CatalogCommerceFacts = {
  priceEur: number | null
  /** A missing/empty currency fails closed: no price label is shown. */
  currency: string | null
  affiliateLink: string | null
  purchaseLinkStatus: "available" | "unavailable" | null
  updatedAt: string | null
}

export type CatalogCommercePresentation = {
  // Null when availability is simply unknown — the surface stays quiet instead
  // of announcing an unconfirmed status.
  availabilityLabel: string | null
  freshnessLabel: string
  affiliateDisclosure: string | null
  priceLabel: string | null
  productUrl: string | null
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function priceLabel(facts: CatalogCommerceFacts): string | null {
  if (typeof facts.priceEur !== "number" || !Number.isFinite(facts.priceEur)) return null
  // Fail closed: an unset currency means we don't know how to label the
  // price, so no price is shown, rather than assuming EUR.
  const currency = facts.currency === "EUR" ? "EUR" : facts.currency?.trim()
  if (!currency) return null
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(facts.priceEur)
  } catch {
    return null
  }
}

function freshnessLabel(updatedAt: string | null): string {
  if (!updatedAt) return "Zeitpunkt der Produktdaten nicht verfügbar."
  const date = new Date(updatedAt)
  if (!Number.isFinite(date.getTime())) return "Zeitpunkt der Produktdaten nicht verfügbar."
  return `Produktdaten zuletzt aktualisiert am ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date)}.`
}

export function presentCatalogCommerce(
  facts: CatalogCommerceFacts | null,
): CatalogCommercePresentation {
  if (!facts) {
    return {
      availabilityLabel: null,
      freshnessLabel: "Zu diesem Produkt liegen derzeit keine aktuellen Shopdaten vor.",
      affiliateDisclosure: null,
      priceLabel: null,
      productUrl: null,
    }
  }
  const productUrl =
    facts.purchaseLinkStatus === "available" ? safeHttpUrl(facts.affiliateLink) : null
  const availabilityLabel =
    facts.purchaseLinkStatus === "unavailable"
      ? "Derzeit nicht verfügbar"
      : facts.purchaseLinkStatus === "available" && productUrl
        ? "Aktuell verfügbar"
        : facts.purchaseLinkStatus === "available"
          ? "Derzeit kein verifizierter Produktlink"
          : null
  return {
    availabilityLabel,
    freshnessLabel: freshnessLabel(facts.updatedAt),
    affiliateDisclosure: productUrl
      ? "Affiliate-Hinweis: Bei einem Kauf über diesen Link erhalten wir möglicherweise eine Provision."
      : null,
    priceLabel: priceLabel(facts),
    productUrl,
  }
}
