import { existsSync, readFileSync } from "node:fs"

import {
  KNOWN_PRODUCT_CATEGORY_KEYS,
  normalizeCategoryKey,
  normalizeText,
  type KnownProductCategoryKey,
} from "../../src/lib/product-identity"
import { PRODUCT_FREQUENCIES } from "../../src/lib/vocabulary/frequencies"

const SNAPSHOT_PATH = "data/product-catalog-snapshot.json"
const NORMALIZATION_PATH = "data/product-catalog-normalization.json"

export const CANONICAL_CATEGORY_KEYS = [...KNOWN_PRODUCT_CATEGORY_KEYS] as const

export const SUPPORTED_IDENTIFIER_TYPES = [
  "gtin",
  "ean",
  "barcode",
  "retailer_sku",
  "retailer_url",
] as const

type ValidationOptions = {
  requireReviewed?: boolean
}

export type ValidationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
}

type NormalizationAlias = {
  alias?: unknown
  resolves_to?: unknown
  canonical_brand?: unknown
  product_line?: unknown
}

type NormalizationIdentifier = {
  type?: unknown
  value?: unknown
}

type NormalizationEntry = {
  product_id?: unknown
  current_brand?: unknown
  current_name?: unknown
  current_category?: unknown
  canonical_category_key?: unknown
  canonical_brand?: unknown
  product_line?: unknown
  clean_name?: unknown
  aliases?: unknown
  known_titles?: unknown
  identifiers?: unknown
  notes?: unknown
  review_status?: unknown
}

type NormalizationDocument = {
  products?: unknown
}

type SnapshotProduct = {
  id?: unknown
  brand?: unknown
  name?: unknown
  category?: unknown
}

type SnapshotUsageFact = {
  category?: unknown
  frequency?: unknown
  count?: unknown
}

export function normalizeAlias(value: string): string {
  return normalizeText(value)
}

export function validateNormalizationDocument(
  document: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const aliasesByNormalizedValue = new Map<
    string,
    { canonicalBrand: string; productLine: string | null; label: string }
  >()
  const identifiersByNormalizedValue = new Map<string, { productId: string; label: string }>()
  const productIds = new Set<string>()

  if (!isRecord(document)) {
    return { ok: false, errors: ["Normalization document must be a JSON object."], warnings }
  }

  const products = (document as NormalizationDocument).products
  if (!Array.isArray(products)) {
    return { ok: false, errors: ["Normalization document must include products array."], warnings }
  }

  products.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`products[${index}] must be an object.`)
      return
    }

    validateEntry(entry as NormalizationEntry, index, errors, warnings, options)
    collectProductId(entry as NormalizationEntry, index, productIds, errors)
    collectAliases(entry as NormalizationEntry, index, aliasesByNormalizedValue, errors)
    collectIdentifierConflicts(
      entry as NormalizationEntry,
      index,
      identifiersByNormalizedValue,
      errors,
    )
  })

  return { ok: errors.length === 0, errors, warnings }
}

export function validateSnapshotDocument(snapshot: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const productIds = new Set<string>()

  if (!isRecord(snapshot)) {
    return { ok: false, errors: ["Snapshot must be a JSON object."], warnings }
  }

  if (!Array.isArray(snapshot.products)) {
    errors.push("Snapshot must include products array.")
  } else {
    snapshot.products.forEach((product, index) => {
      if (!isRecord(product)) {
        errors.push(`snapshot.products[${index}] must be an object.`)
        return
      }

      const row = product as SnapshotProduct
      const id = stringValue(row.id)
      const category = stringValue(row.category)

      if (!id) {
        errors.push(`snapshot.products[${index}].id must not be blank.`)
      } else if (productIds.has(id)) {
        errors.push(`snapshot.products[${index}].id duplicates product id ${id}.`)
      } else {
        productIds.add(id)
      }

      if (blank(row.name)) errors.push(`snapshot.products[${index}].name must not be blank.`)
      if (blank(row.brand)) warnings.push(`snapshot.products[${index}].brand is blank.`)
      if (!category || normalizeCategoryKey(category) === null) {
        errors.push(`snapshot.products[${index}].category must map to a canonical category key.`)
      }
    })
  }

  if (!Array.isArray(snapshot.usage_facts)) {
    errors.push("Snapshot must include usage_facts array.")
  } else {
    snapshot.usage_facts.forEach((fact, index) => {
      if (!isRecord(fact)) {
        errors.push(`snapshot.usage_facts[${index}] must be an object.`)
        return
      }

      const row = fact as SnapshotUsageFact
      const frequency = row.frequency

      if ("user_id" in fact) {
        errors.push(`snapshot.usage_facts[${index}] must not include user_id.`)
      }
      if (typeof row.count !== "number" || row.count < 0) {
        errors.push(`snapshot.usage_facts[${index}].count must be a non-negative number.`)
      }
      if (
        frequency !== null &&
        frequency !== undefined &&
        !PRODUCT_FREQUENCIES.includes(String(frequency) as (typeof PRODUCT_FREQUENCIES)[number])
      ) {
        errors.push(`snapshot.usage_facts[${index}].frequency is not canonical.`)
      }
    })
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function validateNormalizationAgainstSnapshot(
  normalization: unknown,
  snapshot: unknown,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(normalization) || !Array.isArray(normalization.products)) {
    return { ok: false, errors: ["Normalization document must include products array."], warnings }
  }
  if (!isRecord(snapshot) || !Array.isArray(snapshot.products)) {
    return { ok: false, errors: ["Snapshot must include products array."], warnings }
  }

  const snapshotIds = new Set(
    snapshot.products.flatMap((product) =>
      isRecord(product) && stringValue(product.id) ? [stringValue(product.id) as string] : [],
    ),
  )
  const snapshotProductsById = new Map(
    snapshot.products.flatMap((product) =>
      isRecord(product) && stringValue(product.id)
        ? [[stringValue(product.id) as string, product]]
        : [],
    ),
  )
  const mappingIds = new Set(
    normalization.products.flatMap((product) =>
      isRecord(product) && stringValue(product.product_id)
        ? [stringValue(product.product_id) as string]
        : [],
    ),
  )

  for (const id of snapshotIds) {
    if (!mappingIds.has(id)) errors.push(`Missing normalization mapping for product ${id}.`)
  }
  for (const id of mappingIds) {
    if (!snapshotIds.has(id)) errors.push(`Normalization mapping references unknown product ${id}.`)
  }
  normalization.products.forEach((mapping, index) => {
    if (!isRecord(mapping)) return
    const id = stringValue(mapping.product_id)
    if (!id) return

    const snapshotProduct = snapshotProductsById.get(id)
    if (!isRecord(snapshotProduct)) return

    assertSnapshotFieldMatches(mapping, snapshotProduct, "current_brand", "brand", index, errors)
    assertSnapshotFieldMatches(mapping, snapshotProduct, "current_name", "name", index, errors)
    assertSnapshotFieldMatches(
      mapping,
      snapshotProduct,
      "current_category",
      "category",
      index,
      errors,
    )
  })

  return { ok: errors.length === 0, errors, warnings }
}

function validateEntry(
  entry: NormalizationEntry,
  index: number,
  errors: string[],
  warnings: string[],
  options: ValidationOptions,
) {
  const currentBrand = stringValue(entry.current_brand)
  const currentName = stringValue(entry.current_name)
  const currentCategory = stringValue(entry.current_category)
  const productId = stringValue(entry.product_id)
  const canonicalBrand = stringValue(entry.canonical_brand)
  const categoryKey = stringValue(entry.canonical_category_key)
  const productLine = nullableStringValue(entry.product_line)
  const cleanName = stringValue(entry.clean_name)
  const reviewStatus = stringValue(entry.review_status)

  if (!productId) errors.push(`products[${index}].product_id must not be blank.`)
  if (!currentBrand) warnings.push(`products[${index}].current_brand is blank.`)
  if (!currentName) errors.push(`products[${index}].current_name must not be blank.`)
  if (!currentCategory) {
    errors.push(`products[${index}].current_category must not be blank.`)
  } else if (normalizeCategoryKey(currentCategory) === null) {
    errors.push(`products[${index}].current_category must map to a canonical category key.`)
  }

  if (!canonicalBrand) errors.push(`products[${index}].canonical_brand must not be blank.`)
  if (!cleanName) errors.push(`products[${index}].clean_name must not be blank.`)

  if (!categoryKey) {
    errors.push(`products[${index}].canonical_category_key must not be blank.`)
  } else if (!isCanonicalCategoryKey(categoryKey)) {
    errors.push(
      `products[${index}].canonical_category_key must be one of: ${CANONICAL_CATEGORY_KEYS.join(", ")}.`,
    )
  }

  if (canonicalBrand && cleanName && startsWithCanonicalPrefix(cleanName, canonicalBrand)) {
    errors.push(`products[${index}].clean_name must not duplicate canonical_brand.`)
  }
  if (productLine && cleanName && startsWithCanonicalPrefix(cleanName, productLine)) {
    errors.push(`products[${index}].clean_name must not duplicate product_line.`)
  }

  if (!["draft", "reviewed", "blocked"].includes(reviewStatus ?? "")) {
    errors.push(`products[${index}].review_status must be draft, reviewed, or blocked.`)
  }
  if (options.requireReviewed && reviewStatus !== "reviewed") {
    errors.push(
      `products[${index}].review_status must be reviewed when --require-reviewed is used.`,
    )
  }

  validateAliases(entry.aliases, index, canonicalBrand, productLine, errors)
  validateStringArray(entry.known_titles, `products[${index}].known_titles`, errors)
  validateIdentifiers(entry.identifiers, index, errors)

  if (entry.notes !== null && entry.notes !== undefined && typeof entry.notes !== "string") {
    warnings.push(`products[${index}].notes should be a string or null.`)
  }
}

function validateAliases(
  value: unknown,
  productIndex: number,
  canonicalBrand: string | null,
  productLine: string | null,
  errors: string[],
) {
  if (!Array.isArray(value)) {
    errors.push(`products[${productIndex}].aliases must be an array.`)
    return
  }

  value.forEach((alias, aliasIndex) => {
    const path = `products[${productIndex}].aliases[${aliasIndex}]`
    if (!isRecord(alias)) {
      errors.push(`${path} must be an object.`)
      return
    }

    const row = alias as NormalizationAlias
    const label = stringValue(row.alias)
    const resolvesTo = stringValue(row.resolves_to)
    const aliasBrand = stringValue(row.canonical_brand)
    const aliasLine = nullableStringValue(row.product_line)

    if (!label) errors.push(`${path}.alias must not be blank.`)
    if (resolvesTo !== "brand" && resolvesTo !== "brand_line") {
      errors.push(`${path}.resolves_to must be brand or brand_line.`)
    }
    if (!aliasBrand) errors.push(`${path}.canonical_brand must not be blank.`)
    if (canonicalBrand && aliasBrand && aliasBrand !== canonicalBrand) {
      errors.push(`${path}.canonical_brand must match the row canonical_brand.`)
    }
    if (resolvesTo === "brand" && aliasLine !== null) {
      errors.push(`${path}.product_line must be null for brand aliases.`)
    }
    if (resolvesTo === "brand_line" && !aliasLine) {
      errors.push(`${path}.product_line must not be blank for brand_line aliases.`)
    }
    if (resolvesTo === "brand_line" && !productLine) {
      errors.push(`${path}.product_line requires the row product_line to be set.`)
    }
    if (aliasLine && productLine && aliasLine !== productLine) {
      errors.push(`${path}.product_line must match the row product_line.`)
    }
  })
}

function collectProductId(
  entry: NormalizationEntry,
  index: number,
  productIds: Set<string>,
  errors: string[],
) {
  const productId = stringValue(entry.product_id)
  if (!productId) return

  if (productIds.has(productId)) {
    errors.push(`products[${index}].product_id duplicates product id ${productId}.`)
    return
  }

  productIds.add(productId)
}

function collectAliases(
  entry: NormalizationEntry,
  index: number,
  aliasesByNormalizedValue: Map<
    string,
    { canonicalBrand: string; productLine: string | null; label: string }
  >,
  errors: string[],
) {
  const entryBrand = stringValue(entry.canonical_brand)
  if (entryBrand) {
    registerAliasTarget(entryBrand, entryBrand, null, aliasesByNormalizedValue, errors)
  }

  const aliases = Array.isArray(entry.aliases) ? entry.aliases : []

  for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
    const alias = aliases[aliasIndex]
    if (!isRecord(alias)) continue
    const row = alias as NormalizationAlias
    const label = stringValue(row.alias)
    const canonicalBrand = stringValue(row.canonical_brand)
    const productLine = nullableStringValue(row.product_line)
    if (!label || !canonicalBrand) continue

    registerAliasTarget(label, canonicalBrand, productLine, aliasesByNormalizedValue, errors)
  }

  if (!Array.isArray(entry.aliases)) {
    errors.push(`products[${index}].aliases must be an array.`)
  }
}

function registerAliasTarget(
  label: string,
  canonicalBrand: string,
  productLine: string | null,
  aliasesByNormalizedValue: Map<
    string,
    { canonicalBrand: string; productLine: string | null; label: string }
  >,
  errors: string[],
) {
  const normalized = normalizeAlias(label)
  if (!normalized) return

  const existing = aliasesByNormalizedValue.get(normalized)
  if (
    existing &&
    (existing.canonicalBrand !== canonicalBrand || existing.productLine !== productLine)
  ) {
    errors.push(
      `Alias conflict for "${label}" normalized as "${normalized}" between ${existing.canonicalBrand}/${existing.productLine ?? "brand"} and ${canonicalBrand}/${productLine ?? "brand"}.`,
    )
  } else {
    aliasesByNormalizedValue.set(normalized, { canonicalBrand, productLine, label })
  }
}

function collectIdentifierConflicts(
  entry: NormalizationEntry,
  index: number,
  identifiersByNormalizedValue: Map<string, { productId: string; label: string }>,
  errors: string[],
) {
  const productId = stringValue(entry.product_id) ?? `products[${index}]`
  const identifiers = Array.isArray(entry.identifiers) ? entry.identifiers : []

  for (let identifierIndex = 0; identifierIndex < identifiers.length; identifierIndex += 1) {
    const identifier = identifiers[identifierIndex]
    if (!isRecord(identifier)) continue
    const row = identifier as NormalizationIdentifier
    const type = stringValue(row.type)
    const value = stringValue(row.value)
    if (!type || !value || !["gtin", "ean", "barcode"].includes(type)) continue

    const normalized = `${type}:${normalizeIdentifierValue(value)}`
    const existing = identifiersByNormalizedValue.get(normalized)
    if (existing && existing.productId !== productId) {
      errors.push(
        `Identifier conflict for ${type} "${value}" between ${existing.productId} and ${productId}; exact identifiers require review before sharing across category-use rows.`,
      )
    } else {
      identifiersByNormalizedValue.set(normalized, { productId, label: value })
    }
  }
}

function validateStringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`)
    return
  }

  value.forEach((item, index) => {
    if (stringValue(item) == null) {
      errors.push(`${path}[${index}] must not be blank.`)
    }
  })
}

function validateIdentifiers(value: unknown, productIndex: number, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`products[${productIndex}].identifiers must be an array.`)
    return
  }

  value.forEach((identifier, identifierIndex) => {
    const path = `products[${productIndex}].identifiers[${identifierIndex}]`
    if (!isRecord(identifier)) {
      errors.push(`${path} must be an object.`)
      return
    }

    const row = identifier as NormalizationIdentifier
    const type = stringValue(row.type)
    const value = stringValue(row.value)

    if (!type || !isSupportedIdentifierType(type)) {
      errors.push(`${path}.type must be one of: ${SUPPORTED_IDENTIFIER_TYPES.join(", ")}.`)
    }
    if (!value) {
      errors.push(`${path}.value must not be blank.`)
      return
    }
    if (type) validateIdentifierValue(type, value, path, errors)
  })
}

function validateIdentifierValue(type: string, value: string, path: string, errors: string[]) {
  if ((type === "ean" || type === "gtin" || type === "barcode") && !/^\d{8,14}$/.test(value)) {
    errors.push(`${path}.value must be 8-14 digits for ${type}.`)
  }

  if (type === "retailer_url") {
    try {
      const url = new URL(value)
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.push(`${path}.value must be an http(s) URL.`)
      }
    } catch {
      errors.push(`${path}.value must be a valid URL.`)
    }
  }
}

function assertSnapshotFieldMatches(
  mapping: Record<string, unknown>,
  snapshotProduct: Record<string, unknown>,
  mappingField: string,
  snapshotField: string,
  index: number,
  errors: string[],
) {
  const mappingValue = stringValue(mapping[mappingField]) ?? ""
  const snapshotValue = stringValue(snapshotProduct[snapshotField]) ?? ""

  if (normalizeAlias(mappingValue) !== normalizeAlias(snapshotValue)) {
    errors.push(
      `products[${index}].${mappingField} is stale: mapping has "${mappingValue}", snapshot has "${snapshotValue}".`,
    )
  }
}

function startsWithCanonicalPrefix(value: string, prefix: string): boolean {
  const normalizedValue = normalizeText(value)
  const normalizedPrefix = normalizeText(prefix)
  return normalizedValue === normalizedPrefix || normalizedValue.startsWith(`${normalizedPrefix} `)
}

function normalizeIdentifierValue(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase()
}

function isCanonicalCategoryKey(value: string): value is KnownProductCategoryKey {
  return (CANONICAL_CATEGORY_KEYS as readonly string[]).includes(value)
}

function isSupportedIdentifierType(
  value: string,
): value is (typeof SUPPORTED_IDENTIFIER_TYPES)[number] {
  return (SUPPORTED_IDENTIFIER_TYPES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function nullableStringValue(value: unknown): string | null {
  return value === null || value === undefined ? null : stringValue(value)
}

function blank(value: unknown): boolean {
  return stringValue(value) == null
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const normalized = stringValue(item)
    return normalized ? [normalized] : []
  })
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"))
}

function printResult(label: string, result: ValidationResult) {
  for (const warning of result.warnings) {
    console.warn(`[${label}] warning: ${warning}`)
  }
  for (const error of result.errors) {
    console.error(`[${label}] error: ${error}`)
  }
}

function parseArgs(args: string[]): ValidationOptions {
  return {
    requireReviewed: args.includes("--require-reviewed"),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const results: ValidationResult[] = []
  let snapshot: unknown = null
  let normalization: unknown = null

  if (existsSync(SNAPSHOT_PATH)) {
    snapshot = readJson(SNAPSHOT_PATH)
    const snapshotResult = validateSnapshotDocument(snapshot)
    printResult("snapshot", snapshotResult)
    results.push(snapshotResult)
  } else {
    console.warn(`[snapshot] warning: ${SNAPSHOT_PATH} is missing; run products:identity:export.`)
  }

  if (existsSync(NORMALIZATION_PATH)) {
    normalization = readJson(NORMALIZATION_PATH)
    const normalizationResult = validateNormalizationDocument(normalization, options)
    printResult("normalization", normalizationResult)
    results.push(normalizationResult)
  } else {
    console.warn(`[normalization] warning: ${NORMALIZATION_PATH} is missing; no mapping checked.`)
  }

  if (snapshot && normalization) {
    const coverageResult = validateNormalizationAgainstSnapshot(normalization, snapshot)
    printResult("coverage", coverageResult)
    results.push(coverageResult)
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1
    return
  }

  console.log("Product catalog normalization validation finished without errors.")
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return (
    scriptPath.endsWith("validate-normalization.ts") ||
    scriptPath.endsWith("validate-normalization.js")
  )
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
