import { normalizeIdentityText } from "./normalize"

export type ProductIdentityProductLine = {
  id?: string
  key?: string
  brandId?: string
  brand_id?: string
  canonicalName?: string
  canonical_name?: string
  normalizedName?: string
  normalized_name?: string
  name?: string
  aliases?: readonly string[]
}

export type ProductIdentityBrand = {
  id?: string
  key?: string
  canonicalName?: string
  canonical_name?: string
  normalizedName?: string
  normalized_name?: string
  name?: string
  aliases?: readonly string[]
  productLines?: readonly ProductIdentityProductLine[]
}

export type ProductIdentityBrandAlias = {
  brandId?: string
  brand_id?: string
  productLineId?: string | null
  product_line_id?: string | null
  alias: string
  normalizedAlias?: string
  normalized_alias?: string
}

export type BrandResolutionCatalogInput = {
  brands: readonly ProductIdentityBrand[]
  productLines?: readonly ProductIdentityProductLine[]
  brandAliases?: readonly ProductIdentityBrandAlias[]
}

export type BrandAliasConflict = {
  normalizedAlias: string
  targets: Array<{
    brandKey: string
    label: string
  }>
}

export type BrandResolutionReason =
  | "brand_alias_exact"
  | "brand_line_alias_exact"
  | "brand_alias_with_line_alias"
  | "canonical_brand_exact"
  | "canonical_brand_with_line_inference"
  | "unresolved"

export type BrandResolutionConfidence = "high" | "medium" | "none"

export type BrandResolution = {
  match: "brand_line" | "brand" | "none"
  brand: ProductIdentityBrand | null
  productLine: ProductIdentityProductLine | null
  matchedText: string | null
  confidence: BrandResolutionConfidence
  reason: BrandResolutionReason
  unresolvedRawText: string | null
}

type AliasTarget = {
  brand: ProductIdentityBrand
  productLine: ProductIdentityProductLine | null
  alias: string
  normalizedAlias: string
}

export type BrandResolutionCatalog = {
  brands: readonly ProductIdentityBrand[]
  aliases: readonly AliasTarget[]
  productLines: ReadonlyArray<{
    brandId: string
    line: ProductIdentityProductLine
  }>
  conflicts: BrandAliasConflict[]
}

type TokenSpan = {
  normalized: string
  start: number
  end: number
}

function brandId(brand: ProductIdentityBrand): string {
  return brand.id ?? brand.key ?? brand.canonical_name ?? brand.canonicalName ?? brand.name ?? ""
}

function lineId(line: ProductIdentityProductLine): string {
  return line.id ?? line.key ?? line.canonical_name ?? line.canonicalName ?? line.name ?? ""
}

function brandName(brand: ProductIdentityBrand): string {
  return brand.name ?? brand.canonical_name ?? brand.canonicalName ?? brand.key ?? brand.id ?? ""
}

function brandNormalizedName(brand: ProductIdentityBrand): string {
  return brand.normalized_name ?? brand.normalizedName ?? normalizeIdentityText(brandName(brand))
}

function lineName(line: ProductIdentityProductLine): string {
  return line.name ?? line.canonical_name ?? line.canonicalName ?? line.key ?? line.id ?? ""
}

function lineNormalizedName(line: ProductIdentityProductLine): string {
  return line.normalized_name ?? line.normalizedName ?? normalizeIdentityText(lineName(line))
}

function lineBrandId(line: ProductIdentityProductLine): string {
  return line.brand_id ?? line.brandId ?? ""
}

function aliasBrandId(alias: ProductIdentityBrandAlias): string {
  return alias.brand_id ?? alias.brandId ?? ""
}

function aliasLineId(alias: ProductIdentityBrandAlias): string | null {
  return alias.product_line_id ?? alias.productLineId ?? null
}

function normalizedAliasValue(alias: ProductIdentityBrandAlias): string {
  return normalizeIdentityText(alias.normalized_alias ?? alias.normalizedAlias ?? alias.alias)
}

function uniqueLabels(name: string, aliases: readonly string[] | undefined): string[] {
  const labels = [name, ...(aliases ?? [])]
  const seen = new Set<string>()
  const unique: string[] = []

  for (const label of labels) {
    const normalized = normalizeIdentityText(label)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    unique.push(label)
  }

  return unique
}

function uniqueAliases(aliases: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const alias of aliases ?? []) {
    const normalized = normalizeIdentityText(alias)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    unique.push(alias)
  }

  return unique
}

function tokenSignature(label: string): string {
  return tokenSpans(label)
    .map((span) => span.normalized)
    .join("\u0000")
}

function uniquePrefixLabels(...labels: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const label of labels) {
    if (!label) continue

    const signature = tokenSignature(label)
    if (!signature || seen.has(signature)) continue

    seen.add(signature)
    unique.push(label)
  }

  return unique
}

function brandPrefixLabels(brand: ProductIdentityBrand): string[] {
  return uniquePrefixLabels(brandName(brand), brandNormalizedName(brand))
}

function linePrefixLabels(line: ProductIdentityProductLine): string[] {
  return uniquePrefixLabels(lineName(line), lineNormalizedName(line), ...(line.aliases ?? []))
}

function aliasPrefixLabels(alias: AliasTarget): string[] {
  return uniquePrefixLabels(alias.alias, alias.normalizedAlias)
}

export function detectBrandAliasConflicts(
  brands: readonly ProductIdentityBrand[],
): BrandAliasConflict[] {
  const targetsByAlias = new Map<string, Map<string, { brandKey: string; label: string }>>()

  for (const brand of brands) {
    for (const label of uniqueLabels(brandName(brand), brand.aliases)) {
      const normalizedAlias = normalizeIdentityText(label)
      const targets = targetsByAlias.get(normalizedAlias) ?? new Map()
      const key = brandId(brand)

      if (!targets.has(key)) {
        targets.set(key, { brandKey: key, label })
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

function trimLeadingSeparators(value: string): { text: string; offset: number } {
  const match = value.match(/^[\s\p{Punctuation}\p{Symbol}]+/u)
  const offset = match?.[0].length ?? 0
  return { text: value.slice(offset), offset }
}

function bestPrefixMatch<T>(
  source: string,
  candidates: readonly T[],
  labelsFor: (candidate: T) => string[],
): { candidate: T; end: number; tokenCount: number; label: string } | null {
  let bestMatch: { candidate: T; end: number; tokenCount: number; label: string } | null = null

  for (const candidate of candidates) {
    for (const label of labelsFor(candidate)) {
      const match = prefixMatch(source, label)
      if (!match) continue

      if (!bestMatch || match.tokenCount > bestMatch.tokenCount || match.end > bestMatch.end) {
        bestMatch = { candidate, label, ...match }
      }
    }
  }

  return bestMatch
}

function aliasConflictKey(target: AliasTarget): string {
  const line = target.productLine ? `:${lineId(target.productLine)}` : ""
  return `${brandId(target.brand)}${line}`
}

function addConflictTarget(
  targetsByAlias: Map<string, Map<string, { brandKey: string; label: string }>>,
  normalizedAlias: string,
  targetKey: string,
  target: { brandKey: string; label: string },
): void {
  if (!normalizedAlias) return

  const targets = targetsByAlias.get(normalizedAlias) ?? new Map()
  targets.set(targetKey, target)
  targetsByAlias.set(normalizedAlias, targets)
}

function toCatalog(
  input: readonly ProductIdentityBrand[] | BrandResolutionCatalogInput | BrandResolutionCatalog,
): BrandResolutionCatalog {
  if (!Array.isArray(input) && "aliases" in input && "conflicts" in input) {
    return input
  }

  if (Array.isArray(input)) {
    return buildBrandResolutionCatalog({ brands: input })
  }

  return buildBrandResolutionCatalog(input as BrandResolutionCatalogInput)
}

export function buildBrandResolutionCatalog(
  input: BrandResolutionCatalogInput,
): BrandResolutionCatalog {
  const brandsById = new Map(input.brands.map((brand) => [brandId(brand), brand]))
  const linesById = new Map<string, ProductIdentityProductLine>()
  const productLinesByBrandId = new Map<string, ProductIdentityProductLine[]>()

  for (const brand of input.brands) {
    for (const line of brand.productLines ?? []) {
      const id = lineId(line)
      linesById.set(id, line)
      const list = productLinesByBrandId.get(brandId(brand)) ?? []
      list.push(line)
      productLinesByBrandId.set(brandId(brand), list)
    }
  }

  for (const line of input.productLines ?? []) {
    const id = lineId(line)
    const ownerId = lineBrandId(line)
    linesById.set(id, line)
    const list = productLinesByBrandId.get(ownerId) ?? []
    list.push(line)
    productLinesByBrandId.set(ownerId, list)
  }

  const aliases: AliasTarget[] = []
  const productLines: Array<{ brandId: string; line: ProductIdentityProductLine }> = []

  for (const brand of input.brands) {
    for (const label of uniqueAliases(brand.aliases)) {
      aliases.push({
        brand,
        productLine: null,
        alias: label,
        normalizedAlias: normalizeIdentityText(label),
      })
    }

    for (const line of productLinesByBrandId.get(brandId(brand)) ?? []) {
      productLines.push({ brandId: brandId(brand), line })
    }
  }

  for (const alias of input.brandAliases ?? []) {
    const brand = brandsById.get(aliasBrandId(alias))
    if (!brand) continue

    const productLineId = aliasLineId(alias)
    const productLine = productLineId ? (linesById.get(productLineId) ?? null) : null
    if (productLineId && !productLine) continue

    aliases.push({
      brand,
      productLine,
      alias: alias.alias,
      normalizedAlias: normalizedAliasValue(alias),
    })
  }

  const targetKeysByAlias = new Map<string, Map<string, { brandKey: string; label: string }>>()

  for (const brand of input.brands) {
    addConflictTarget(targetKeysByAlias, brandNormalizedName(brand), brandId(brand), {
      brandKey: brandId(brand),
      label: brandName(brand),
    })
  }

  for (const alias of aliases) {
    addConflictTarget(targetKeysByAlias, alias.normalizedAlias, aliasConflictKey(alias), {
      brandKey: brandId(alias.brand),
      label: alias.alias,
    })
  }

  const conflicts = Array.from(targetKeysByAlias.entries())
    .filter(([, targets]) => targets.size > 1)
    .map(([normalizedAlias, targets]) => ({
      normalizedAlias,
      targets: Array.from(targets.values()),
    }))

  const conflictAliases = new Set(conflicts.map((conflict) => conflict.normalizedAlias))

  return {
    brands: input.brands,
    aliases: aliases.filter((alias) => !conflictAliases.has(alias.normalizedAlias)),
    productLines,
    conflicts,
  }
}

function none(rawText: string): BrandResolution {
  return {
    match: "none",
    brand: null,
    productLine: null,
    matchedText: null,
    confidence: "none",
    reason: "unresolved",
    unresolvedRawText: rawText,
  }
}

export function resolveBrandFromText(
  rawText: string,
  catalogInput:
    | readonly ProductIdentityBrand[]
    | BrandResolutionCatalogInput
    | BrandResolutionCatalog,
): BrandResolution {
  const catalog = toCatalog(catalogInput)
  const aliasMatch = bestPrefixMatch(rawText, catalog.aliases, aliasPrefixLabels)

  if (aliasMatch) {
    const alias = aliasMatch.candidate

    if (alias.productLine) {
      return {
        match: "brand_line",
        brand: alias.brand,
        productLine: alias.productLine,
        matchedText: rawText.slice(0, aliasMatch.end).trim(),
        confidence: "high",
        reason: "brand_line_alias_exact",
        unresolvedRawText: null,
      }
    }

    const remainder = trimLeadingSeparators(rawText.slice(aliasMatch.end))
    const productLines = catalog.productLines
      .filter((candidate) => candidate.brandId === brandId(alias.brand))
      .map((candidate) => candidate.line)

    const lineMatch = bestPrefixMatch(remainder.text, productLines, linePrefixLabels)

    if (lineMatch) {
      const lineEnd = aliasMatch.end + remainder.offset + lineMatch.end

      return {
        match: "brand_line",
        brand: alias.brand,
        productLine: lineMatch.candidate,
        matchedText: rawText.slice(0, lineEnd).trim(),
        confidence: "high",
        reason: "brand_alias_with_line_alias",
        unresolvedRawText: null,
      }
    }

    return {
      match: "brand",
      brand: alias.brand,
      productLine: null,
      matchedText: rawText.slice(0, aliasMatch.end).trim(),
      confidence: "high",
      reason: "brand_alias_exact",
      unresolvedRawText: null,
    }
  }

  const brandMatch = bestPrefixMatch(rawText, catalog.brands, brandPrefixLabels)

  if (!brandMatch) {
    return none(rawText)
  }

  const remainder = trimLeadingSeparators(rawText.slice(brandMatch.end))
  const productLines = catalog.productLines
    .filter((candidate) => candidate.brandId === brandId(brandMatch.candidate))
    .map((candidate) => candidate.line)

  const uniqueLineIds = new Set<string>()
  const uniqueLines = productLines.filter((line) => {
    const id = lineId(line)
    if (uniqueLineIds.has(id)) return false
    uniqueLineIds.add(id)
    return true
  })

  const lineMatch = bestPrefixMatch(remainder.text, uniqueLines, linePrefixLabels)

  if (lineMatch) {
    const lineEnd = brandMatch.end + remainder.offset + lineMatch.end

    return {
      match: "brand_line",
      brand: brandMatch.candidate,
      productLine: lineMatch.candidate,
      matchedText: rawText.slice(0, lineEnd).trim(),
      confidence: "high",
      reason: "canonical_brand_with_line_inference",
      unresolvedRawText: null,
    }
  }

  return {
    match: "brand",
    brand: brandMatch.candidate,
    productLine: null,
    matchedText: rawText.slice(0, brandMatch.end).trim(),
    confidence: "medium",
    reason: "canonical_brand_exact",
    unresolvedRawText: null,
  }
}
