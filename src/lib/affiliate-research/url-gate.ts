export const HOST_ALLOWLIST = new Set<string>([
  "dm.de",
  "www.dm.de",
  "rossmann.de",
  "www.rossmann.de",
  "mueller.de",
  "www.mueller.de",
  "amazon.de",
  "www.amazon.de",
  "douglas.de",
  "www.douglas.de",
  "flaconi.de",
  "www.flaconi.de",
  "notino.de",
  "www.notino.de",
  "otto.de",
  "www.otto.de",
  "hagel-shop.de",
  "www.hagel-shop.de",
  "shop-apotheke.com",
  "www.shop-apotheke.com",
  "epres-hair.de",
  "www.epres-hair.de",
  "neqi-hair.com",
  "www.neqi-hair.com",
  "k18hair.com",
  "www.k18hair.com",
  "urban-alchemy.com",
  "www.urban-alchemy.com",
  "wella.com",
  "www.wella.com",
])

export const HOST_DENYLIST = new Set<string>([
  "idealo.de",
  "www.idealo.de",
  "geizhals.de",
  "www.geizhals.de",
  "billiger.de",
  "www.billiger.de",
  "preisvergleich.de",
  "www.preisvergleich.de",
  "ebay.de",
  "www.ebay.de",
  "ebay.com",
  "www.ebay.com",
  "kleinanzeigen.de",
  "www.kleinanzeigen.de",
  "aliexpress.com",
  "www.aliexpress.com",
  "amazon.com",
  "www.amazon.com",
])

const MIN_BRAND_SLUG_LEN = 4

export function isUsableUrl(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function hostOf(url: string): string {
  return new URL(url).hostname.toLowerCase()
}

export function isAllowedHost(host: string): boolean {
  return HOST_ALLOWLIST.has(host.toLowerCase())
}

export function isDeniedHost(host: string): boolean {
  return HOST_DENYLIST.has(host.toLowerCase())
}

const UMLAUT_MAP: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" }

export function normalizeBrandSlug(brand: string | null | undefined): string {
  if (!brand) return ""
  const lowered = brand.toLowerCase()
  const expanded = lowered.replace(/[äöüß]/g, (ch) => UMLAUT_MAP[ch] ?? ch)
  return expanded.replace(/[^a-z0-9]/g, "")
}

export function passesBrandDirect(host: string, brand: string | null | undefined): boolean {
  const slug = normalizeBrandSlug(brand)
  if (slug.length < MIN_BRAND_SLUG_LEN) return false
  return host.toLowerCase().includes(slug)
}

export type UrlGateInput = {
  chosen_url: string | null | undefined
  brand: string | null | undefined
}

export type UrlGateResult = { pass: true } | { pass: false; reason: string }

export function urlGate(row: UrlGateInput): UrlGateResult {
  if (!isUsableUrl(row.chosen_url)) {
    return { pass: false, reason: "url failed to parse or is not http(s)" }
  }
  const host = hostOf(row.chosen_url as string)
  if (isDeniedHost(host)) {
    return { pass: false, reason: `host ${host} is denylisted (aggregator or wrong marketplace)` }
  }
  if (isAllowedHost(host)) {
    return { pass: true }
  }
  if (passesBrandDirect(host, row.brand)) {
    return { pass: true }
  }
  return {
    pass: false,
    reason: `host ${host} is not on allowlist and does not match brand-direct rule`,
  }
}
