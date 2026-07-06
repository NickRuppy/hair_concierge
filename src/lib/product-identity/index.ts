export * from "./brand-resolution"
export * from "./normalize"

import { normalizeIdentifier, normalizeIdentityText } from "./normalize"

export const SUPPORTED_PRODUCT_CATEGORY_KEYS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "bondbuilder",
] as const

export const KNOWN_UNSUPPORTED_PRODUCT_CATEGORY_KEYS = [
  "heat_protectant",
  "serum",
  "scrub",
  "peeling",
  "styling_gel",
  "styling_mousse",
  "styling_cream",
  "hairspray",
] as const

export const KNOWN_PRODUCT_CATEGORY_KEYS = [
  ...SUPPORTED_PRODUCT_CATEGORY_KEYS,
  ...KNOWN_UNSUPPORTED_PRODUCT_CATEGORY_KEYS,
] as const

export type SupportedProductCategoryKey = (typeof SUPPORTED_PRODUCT_CATEGORY_KEYS)[number]
export type KnownUnsupportedProductCategoryKey =
  (typeof KNOWN_UNSUPPORTED_PRODUCT_CATEGORY_KEYS)[number]
export type KnownProductCategoryKey = (typeof KNOWN_PRODUCT_CATEGORY_KEYS)[number]

export const PRODUCT_CATEGORY_DISPLAY_LABELS: Record<SupportedProductCategoryKey, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  mask: "Maske",
  oil: "Öle",
  dry_shampoo: "Trockenshampoo",
  deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
  bondbuilder: "Bondbuilder",
}

const CATEGORY_ALIASES: Array<[KnownProductCategoryKey, string]> = [
  ["shampoo", "Shampoo"],
  ["shampoo", "Shampoo Profi"],
  ["conditioner", "Conditioner (Drogerie)"],
  ["conditioner", "Conditioner Profi"],
  ["conditioner", "Conditioner"],
  ["leave_in", "Leave-in"],
  ["leave_in", "Leave in"],
  ["mask", "Maske"],
  ["mask", "Mask"],
  ["oil", "Öle"],
  ["oil", "Öl"],
  ["oil", "Oele"],
  ["oil", "Ole"],
  ["oil", "Oil"],
  ["dry_shampoo", "Trockenshampoo"],
  ["dry_shampoo", "Dry Shampoo"],
  ["deep_cleansing_shampoo", "Tiefenreinigungsshampoo"],
  ["deep_cleansing_shampoo", "Deep Cleansing Shampoo"],
  ["bondbuilder", "Bondbuilder"],
  ["heat_protectant", "Hitzeschutz"],
  ["heat_protectant", "Heat Protectant"],
  ["serum", "Serum"],
  ["scrub", "Scrub"],
  ["peeling", "Peeling"],
  ["styling_gel", "Styling-Gel"],
  ["styling_gel", "Styling Gel"],
  ["styling_mousse", "Styling-Mousse"],
  ["styling_mousse", "Styling Mousse"],
  ["styling_cream", "Styling-Creme"],
  ["styling_cream", "Styling Cream"],
  ["hairspray", "Haarspray"],
  ["hairspray", "Hairspray"],
]

const CATEGORY_ALIAS_BY_IDENTIFIER = new Map<string, KnownProductCategoryKey>()

for (const key of KNOWN_PRODUCT_CATEGORY_KEYS) {
  CATEGORY_ALIAS_BY_IDENTIFIER.set(normalizeIdentifier(key), key)
}

for (const [key, alias] of CATEGORY_ALIASES) {
  CATEGORY_ALIAS_BY_IDENTIFIER.set(normalizeIdentifier(alias), key)
}

export function normalizeCategoryKey(
  value: string | null | undefined,
): KnownProductCategoryKey | null {
  if (!value) return null
  const normalized = normalizeIdentifier(value)
  return CATEGORY_ALIAS_BY_IDENTIFIER.get(normalized) ?? null
}

type TokenSpan = {
  normalized: string
  start: number
  end: number
}

function tokenSpans(value: string): TokenSpan[] {
  const spans: TokenSpan[] = []
  const tokenPattern =
    /[\p{Letter}\p{Number}]+(?:[\u2018\u2019'`´](?=[\p{Letter}\p{Number}])[\p{Letter}\p{Number}]+)*/gu

  for (const match of value.matchAll(tokenPattern)) {
    const rawToken = match[0]
    const normalized = normalizeIdentityText(rawToken)
    if (!normalized) continue

    spans.push({
      normalized,
      start: match.index ?? 0,
      end: (match.index ?? 0) + rawToken.length,
    })
  }

  return spans
}

function prefixMatch(source: string, prefix: string): { end: number } | null {
  const sourceTokens = tokenSpans(source)
  const prefixTokens = tokenSpans(prefix)

  if (prefixTokens.length === 0 || sourceTokens.length < prefixTokens.length) {
    return null
  }

  for (let index = 0; index < prefixTokens.length; index += 1) {
    if (sourceTokens[index].normalized !== prefixTokens[index].normalized) {
      return null
    }
  }

  return { end: sourceTokens[prefixTokens.length - 1].end }
}

function stripTokenPrefix(source: string, prefix: string | null | undefined): string {
  if (!prefix) return source.trim()

  const match = prefixMatch(source, prefix)
  if (!match) return source.trim()

  const stripped = source
    .slice(match.end)
    .replace(/^[\s\p{Punctuation}\p{Symbol}]+/u, "")
    .trim()

  return stripped || source.trim()
}

export function cleanProductDisplayName(
  value: string,
  options: { brand?: string | null; productLine?: string | null } = {},
): string {
  const withoutBrand = stripTokenPrefix(value, options.brand)
  return stripTokenPrefix(withoutBrand, options.productLine)
}
