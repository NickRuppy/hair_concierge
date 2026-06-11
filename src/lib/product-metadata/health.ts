import { isUsableUrl, urlGate } from "../affiliate-research/url-gate"

export type ProductMetadataAuditInput = {
  id: string
  name: string | null
  brand: string | null
  category: string | null
  affiliate_link: string | null
  image_url: string | null
  price_eur: number | string | null
  purchase_link_status: "available" | "unavailable" | null
  is_active: boolean | null
}

export type ExpectedPriceCheck = {
  id: string
  expected_price_eur: number
  max_delta_eur: number
  source_url: string
}

export type ProductMetadataFinding =
  | { type: "suspicious_name_marker"; marker: string }
  | { type: "missing_affiliate_link" }
  | { type: "denylisted_host"; host: string; reason: string }
  | { type: "unapproved_host"; host: string; reason: string }
  | { type: "missing_price" }
  | {
      type: "stale_price"
      price_eur: number
      expected_price_eur: number
      max_delta_eur: number
      delta_eur: number
      source_url: string
    }
  | { type: "missing_image" }
  | { type: "unavailable" }

const SUSPICIOUS_NAME_MARKERS = ["*", "†", "‡", "#"] as const

export function hasSuspiciousNameMarker(name: string | null | undefined): boolean {
  if (!name) return false
  return SUSPICIOUS_NAME_MARKERS.some((marker) => name.includes(marker))
}

function firstSuspiciousNameMarker(name: string | null | undefined): string {
  if (!name) return ""
  return SUSPICIOUS_NAME_MARKERS.find((marker) => name.includes(marker)) ?? ""
}

export function numericPrice(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function hasStalePrice(
  price: number | string | null | undefined,
  expected: ExpectedPriceCheck | undefined,
): boolean {
  if (!expected) return false
  const currentPrice = numericPrice(price)
  if (currentPrice == null) return false
  return Math.abs(currentPrice - expected.expected_price_eur) > expected.max_delta_eur
}

function hostnameOf(url: string | null): string {
  if (!url || !isUsableUrl(url)) return ""
  return new URL(url).hostname.toLowerCase()
}

export function auditProductMetadata(
  row: ProductMetadataAuditInput,
  expected?: ExpectedPriceCheck,
): ProductMetadataFinding[] {
  const findings: ProductMetadataFinding[] = []

  if (hasSuspiciousNameMarker(row.name)) {
    findings.push({
      type: "suspicious_name_marker",
      marker: firstSuspiciousNameMarker(row.name),
    })
  }

  if (!isUsableUrl(row.affiliate_link)) {
    findings.push({ type: "missing_affiliate_link" })
  } else {
    const gate = urlGate({ chosen_url: row.affiliate_link, brand: row.brand })
    if (!gate.pass) {
      const host = hostnameOf(row.affiliate_link)
      findings.push(
        gate.reason.includes("denylisted")
          ? { type: "denylisted_host", host, reason: gate.reason }
          : { type: "unapproved_host", host, reason: gate.reason },
      )
    }
  }

  const parsedPrice = numericPrice(row.price_eur)
  if (parsedPrice == null) {
    findings.push({ type: "missing_price" })
  } else if (expected && hasStalePrice(parsedPrice, expected)) {
    findings.push({
      type: "stale_price",
      price_eur: parsedPrice,
      expected_price_eur: expected.expected_price_eur,
      max_delta_eur: expected.max_delta_eur,
      delta_eur: Math.abs(parsedPrice - expected.expected_price_eur),
      source_url: expected.source_url,
    })
  }

  if (!row.image_url?.trim()) {
    findings.push({ type: "missing_image" })
  }

  if (row.purchase_link_status === "unavailable") {
    findings.push({ type: "unavailable" })
  }

  return findings
}
