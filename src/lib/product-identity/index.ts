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
  conditioner: "Conditioner (Drogerie)",
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

function normalizeGermanText(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .replace(/ẞ/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return ""

  return normalizeGermanText(value)
    .toLowerCase()
    .replace(/n[º°]/g, "no")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normalizeIdentifier(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, "_")
}

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
  const tokenPattern = /[\p{Letter}\p{Number}]+/gu

  for (const match of value.matchAll(tokenPattern)) {
    const rawToken = match[0]
    const normalized = normalizeText(rawToken)
    if (!normalized) continue

    spans.push({
      normalized,
      start: match.index ?? 0,
      end: (match.index ?? 0) + rawToken.length,
    })
  }

  return spans
}

function prefixMatch(source: string, prefix: string): { end: number; tokenCount: number } | null {
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

  return {
    end: sourceTokens[prefixTokens.length - 1].end,
    tokenCount: prefixTokens.length,
  }
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

export type ProductIdentityProductLine = {
  key: string
  name: string
  aliases?: readonly string[]
}

export type ProductIdentityBrand = {
  key: string
  name: string
  aliases?: readonly string[]
  productLines?: readonly ProductIdentityProductLine[]
}

export type BrandAliasConflict = {
  normalizedAlias: string
  targets: Array<{
    brandKey: string
    label: string
  }>
}

export type BrandResolution = {
  match: "brand_line" | "brand" | "none"
  brand: ProductIdentityBrand | null
  productLine: ProductIdentityProductLine | null
  matchedText: string | null
}

function uniqueLabels(name: string, aliases: readonly string[] | undefined): string[] {
  const labels = [name, ...(aliases ?? [])]
  const seen = new Set<string>()
  const unique: string[] = []

  for (const label of labels) {
    const normalized = normalizeText(label)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    unique.push(label)
  }

  return unique
}

export function detectBrandAliasConflicts(
  brands: readonly ProductIdentityBrand[],
): BrandAliasConflict[] {
  const targetsByAlias = new Map<string, Map<string, { brandKey: string; label: string }>>()

  for (const brand of brands) {
    for (const label of uniqueLabels(brand.name, brand.aliases)) {
      const normalizedAlias = normalizeText(label)
      const targets = targetsByAlias.get(normalizedAlias) ?? new Map()

      if (!targets.has(brand.key)) {
        targets.set(brand.key, { brandKey: brand.key, label })
      }

      targetsByAlias.set(normalizedAlias, targets)
    }
  }

  return Array.from(targetsByAlias.entries())
    .filter(([, targets]) => targets.size > 1)
    .map(([normalizedAlias, targets]) => ({
      normalizedAlias,
      targets: Array.from(targets.values()),
    }))
}

function trimLeadingSeparators(value: string): { text: string; offset: number } {
  const match = value.match(/^[\s\p{Punctuation}\p{Symbol}]+/u)
  const offset = match?.[0].length ?? 0
  return { text: value.slice(offset), offset }
}

function bestPrefixMatch<T>(
  source: string,
  candidates: readonly T[],
  labelsFor: (candidate: T) => string[],
): { candidate: T; end: number; tokenCount: number } | null {
  let bestMatch: { candidate: T; end: number; tokenCount: number } | null = null

  for (const candidate of candidates) {
    for (const label of labelsFor(candidate)) {
      const match = prefixMatch(source, label)
      if (!match) continue

      if (!bestMatch || match.tokenCount > bestMatch.tokenCount || match.end > bestMatch.end) {
        bestMatch = { candidate, ...match }
      }
    }
  }

  return bestMatch
}

export function resolveBrandFromText(
  rawText: string,
  brands: readonly ProductIdentityBrand[],
): BrandResolution {
  const brandMatch = bestPrefixMatch(rawText, brands, (brand) =>
    uniqueLabels(brand.name, brand.aliases),
  )

  if (!brandMatch) {
    return { match: "none", brand: null, productLine: null, matchedText: null }
  }

  const remainder = trimLeadingSeparators(rawText.slice(brandMatch.end))
  const productLines = brandMatch.candidate.productLines ?? []
  const lineMatch = bestPrefixMatch(remainder.text, productLines, (line) =>
    uniqueLabels(line.name, line.aliases),
  )

  if (lineMatch) {
    const lineEnd = brandMatch.end + remainder.offset + lineMatch.end

    return {
      match: "brand_line",
      brand: brandMatch.candidate,
      productLine: lineMatch.candidate,
      matchedText: rawText.slice(0, lineEnd).trim(),
    }
  }

  return {
    match: "brand",
    brand: brandMatch.candidate,
    productLine: null,
    matchedText: rawText.slice(0, brandMatch.end).trim(),
  }
}
