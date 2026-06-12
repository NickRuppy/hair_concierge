import { config as loadEnv } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { normalizeAlias, validateNormalizationDocument } from "./validate-normalization"

const NORMALIZATION_PATH = "data/product-catalog-normalization.json"
const PROJECT_REF = "pqdkhefxsxkyeqelqegq"

type CliOptions = {
  apply: boolean
  confirmProject: string | null
}

type IdentifierMapping = {
  type: string
  value: string
}

type AliasMapping = {
  alias: string
  resolves_to: "brand" | "brand_line"
  canonical_brand: string
  product_line: string | null
}

type ProductMapping = {
  product_id: string
  current_brand: string
  current_name: string
  current_category: string
  canonical_category_key: string
  canonical_brand: string
  product_line: string | null
  clean_name: string
  aliases: AliasMapping[]
  known_titles: string[]
  identifiers: IdentifierMapping[]
  review_status: "reviewed"
}

type NormalizationDocument = {
  products: ProductMapping[]
}

type BrandRecord = {
  id: string
  canonical_name: string
  normalized_name: string
}

type ProductLineRecord = {
  id: string
  brand_id: string
  canonical_name: string
  normalized_name: string
}

type BrandAliasRecord = {
  normalized_alias: string
  brand_id: string
  product_line_id: string | null
}

type ProductCurrentRow = {
  id: string
  name: string | null
  brand: string | null
  category: string | null
}

type ProductIdRow = {
  id: string
}

function parseArgs(args: string[]): CliOptions {
  const confirmArg = args.find((arg) => arg.startsWith("--confirm-project="))

  return {
    apply: args.includes("--apply"),
    confirmProject: confirmArg ? (confirmArg.split("=", 2)[1] ?? null) : null,
  }
}

export function brandKey(name: string): string {
  return slugKey(name)
}

export function productLineKey(name: string): string {
  return slugKey(name)
}

export function buildApplyPlan(document: NormalizationDocument) {
  const brandsByKey = new Map<string, { key: string; name: string; aliases: Set<string> }>()
  const productLinesByKey = new Map<string, { key: string; name: string; brandKey: string }>()
  const identifiers = new Map<string, IdentifierMapping & { product_id: string }>()

  const productUpdates = document.products.map((product) => {
    const key = brandKey(product.canonical_brand)
    const brand = brandsByKey.get(key) ?? {
      key,
      name: product.canonical_brand,
      aliases: new Set<string>(),
    }

    brand.aliases.add(product.canonical_brand)
    for (const alias of product.aliases) {
      brand.aliases.add(alias.alias)
    }
    brandsByKey.set(key, brand)

    const productLineKeyValue = product.product_line ? productLineKey(product.product_line) : null
    if (product.product_line && productLineKeyValue) {
      productLinesByKey.set(`${key}:${productLineKeyValue}`, {
        key: productLineKeyValue,
        name: product.product_line,
        brandKey: key,
      })
    }

    for (const identifier of product.identifiers) {
      identifiers.set(
        `${product.product_id}:${identifier.type}:${normalizeIdentifierValue(identifier.value)}`,
        {
          ...identifier,
          product_id: product.product_id,
        },
      )
    }

    return {
      product_id: product.product_id,
      brand_key: key,
      product_line_key: productLineKeyValue,
      category_key: product.canonical_category_key,
      clean_name: product.clean_name,
      aliases: product.aliases,
      known_titles: product.known_titles,
    }
  })

  return {
    brands: [...brandsByKey.values()].map((brand) => ({
      key: brand.key,
      canonical_name: brand.name,
      aliases: [...brand.aliases].sort((left, right) => left.localeCompare(right)),
    })),
    productLines: [...productLinesByKey.values()],
    identifiers: [...identifiers.values()],
    productUpdates,
  }
}

function slugKey(value: string): string {
  return normalizeAlias(value).replace(/\s+/g, "_")
}

function normalizeIdentifierValue(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase()
}

function createSupabaseClientFromEnv(): SupabaseClient {
  loadEnv({ path: ".env.local" })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function assertWriteGuards(options: CliOptions) {
  if (!options.apply) return
  if (options.confirmProject !== PROJECT_REF) {
    throw new Error(`Writes require --confirm-project=${PROJECT_REF}.`)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!url.includes(PROJECT_REF)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL does not appear to target ${PROJECT_REF}.`)
  }
}

function readNormalizationDocument(): NormalizationDocument {
  if (!existsSync(NORMALIZATION_PATH)) {
    throw new Error(`${NORMALIZATION_PATH} is missing.`)
  }

  const parsed = JSON.parse(readFileSync(NORMALIZATION_PATH, "utf-8")) as unknown
  const validation = validateNormalizationDocument(parsed, { requireReviewed: true })

  if (!validation.ok) {
    throw new Error(`Normalization document is invalid:\n${validation.errors.join("\n")}`)
  }

  return parsed as NormalizationDocument
}

async function upsertBrands(supabase: SupabaseClient, plan: ReturnType<typeof buildApplyPlan>) {
  const payload = plan.brands.map((brand) => ({
    canonical_name: brand.canonical_name,
    normalized_name: normalizeAlias(brand.canonical_name),
  }))
  if (payload.length === 0) return new Map<string, BrandRecord>()

  await assertExistingBrandsCompatible(supabase, payload)

  const { error: upsertError } = await supabase
    .from("brands")
    .upsert(payload, { onConflict: "normalized_name", ignoreDuplicates: true })

  if (upsertError) throw new Error(`Failed to upsert brands: ${upsertError.message}`)

  const { data, error } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
    .in(
      "normalized_name",
      payload.map((brand) => brand.normalized_name),
    )

  if (error) throw new Error(`Failed to fetch brands after upsert: ${error.message}`)

  return new Map((data as BrandRecord[]).map((brand) => [brandKey(brand.canonical_name), brand]))
}

async function assertExistingBrandsCompatible(
  supabase: SupabaseClient,
  payload: Array<{ canonical_name: string; normalized_name: string }>,
) {
  const normalizedNames = payload.map((brand) => brand.normalized_name)
  if (normalizedNames.length === 0) return

  const { data, error } = await supabase
    .from("brands")
    .select("canonical_name,normalized_name")
    .in("normalized_name", normalizedNames)

  if (error) throw new Error(`Failed to check existing brands: ${error.message}`)

  const incomingByNormalizedName = new Map(payload.map((brand) => [brand.normalized_name, brand]))
  const conflicts = (data as Array<{ canonical_name: string; normalized_name: string }>).flatMap(
    (existing) => {
      const incoming = incomingByNormalizedName.get(existing.normalized_name)
      if (!incoming || existing.canonical_name === incoming.canonical_name) return []
      return [
        `${existing.normalized_name}: database has "${existing.canonical_name}", mapping has "${incoming.canonical_name}"`,
      ]
    },
  )

  if (conflicts.length > 0) {
    throw new Error(
      [
        "Refusing to rewrite existing brand display names during product identity apply.",
        ...conflicts,
      ].join("\n"),
    )
  }
}

async function assertProductsExist(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
) {
  const productIds = plan.productUpdates.map((product) => product.product_id)
  if (productIds.length === 0) return

  const { data, error } = await supabase.from("products").select("id").in("id", productIds)

  if (error) {
    throw new Error(`Failed to verify product ids before apply: ${error.message}`)
  }

  const foundIds = new Set((data as ProductIdRow[]).map((row) => row.id))
  const missingIds = productIds.filter((id) => !foundIds.has(id))

  if (missingIds.length > 0) {
    throw new Error(
      [
        "Refusing to apply product identity normalization because product ids are missing.",
        "Re-run products:identity:export and refresh data/product-catalog-normalization.json.",
        `Missing ids: ${missingIds.join(", ")}`,
      ].join(" "),
    )
  }
}

async function assertProductsMatchReviewedMapping(
  supabase: SupabaseClient,
  document: NormalizationDocument,
) {
  const productIds = document.products.map((product) => product.product_id)
  if (productIds.length === 0) return

  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,category")
    .in("id", productIds)

  if (error) {
    throw new Error(`Failed to verify current products before apply: ${error.message}`)
  }

  const rowsById = new Map((data as ProductCurrentRow[]).map((row) => [row.id, row]))
  const errors: string[] = []

  for (const [index, product] of document.products.entries()) {
    const current = rowsById.get(product.product_id)
    if (!current) continue

    assertCurrentFieldMatches(product, current, "current_brand", "brand", index, errors)
    assertCurrentFieldMatches(product, current, "current_name", "name", index, errors)
    assertCurrentFieldMatches(product, current, "current_category", "category", index, errors)
  }

  if (errors.length > 0) {
    throw new Error(
      [
        "Refusing to apply product identity normalization because reviewed mapping is stale.",
        "Re-run products:identity:export and refresh data/product-catalog-normalization.json.",
        ...errors,
      ].join("\n"),
    )
  }
}

function assertCurrentFieldMatches(
  product: ProductMapping,
  current: ProductCurrentRow,
  mappingField: "current_brand" | "current_name" | "current_category",
  currentField: "brand" | "name" | "category",
  index: number,
  errors: string[],
) {
  const mappingValue = product[mappingField] ?? ""
  const currentValue = current[currentField] ?? ""

  if (normalizeAlias(mappingValue) !== normalizeAlias(currentValue)) {
    errors.push(
      `products[${index}].${mappingField} is stale for ${product.product_id}: mapping has "${mappingValue}", database has "${currentValue}".`,
    )
  }
}

async function upsertProductLines(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
  brandsByKey: Map<string, BrandRecord>,
) {
  const payload = plan.productLines.flatMap((line) => {
    const brand = brandsByKey.get(line.brandKey)
    if (!brand) return []
    return [
      {
        canonical_name: line.name,
        normalized_name: normalizeAlias(line.name),
        brand_id: brand.id,
      },
    ]
  })

  if (payload.length === 0) return new Map<string, ProductLineRecord>()

  await assertExistingProductLinesCompatible(supabase, payload)

  const { error: upsertError } = await supabase
    .from("product_lines")
    .upsert(payload, { onConflict: "brand_id,normalized_name", ignoreDuplicates: true })

  if (upsertError) throw new Error(`Failed to upsert product lines: ${upsertError.message}`)

  const { data, error } = await supabase
    .from("product_lines")
    .select("id,brand_id,canonical_name,normalized_name")
    .in("brand_id", [...new Set(payload.map((line) => line.brand_id))])

  if (error) throw new Error(`Failed to fetch product lines after upsert: ${error.message}`)

  const expectedLineKeys = new Set(
    payload.map((line) => `${line.brand_id}:${line.normalized_name}`),
  )

  return new Map(
    (data as ProductLineRecord[])
      .filter((line) => expectedLineKeys.has(`${line.brand_id}:${line.normalized_name}`))
      .map((line) => [`${line.brand_id}:${productLineKey(line.canonical_name)}`, line]),
  )
}

async function assertExistingProductLinesCompatible(
  supabase: SupabaseClient,
  payload: Array<{ canonical_name: string; normalized_name: string; brand_id: string }>,
) {
  const brandIds = [...new Set(payload.map((line) => line.brand_id))]
  if (brandIds.length === 0) return

  const { data, error } = await supabase
    .from("product_lines")
    .select("brand_id,canonical_name,normalized_name")
    .in("brand_id", brandIds)

  if (error) throw new Error(`Failed to check existing product lines: ${error.message}`)

  const incomingByLineKey = new Map(
    payload.map((line) => [`${line.brand_id}:${line.normalized_name}`, line]),
  )
  const conflicts = (
    data as Array<{ brand_id: string; canonical_name: string; normalized_name: string }>
  ).flatMap((existing) => {
    const incoming = incomingByLineKey.get(`${existing.brand_id}:${existing.normalized_name}`)
    if (!incoming || existing.canonical_name === incoming.canonical_name) return []
    return [
      `${existing.brand_id}/${existing.normalized_name}: database has "${existing.canonical_name}", mapping has "${incoming.canonical_name}"`,
    ]
  })

  if (conflicts.length > 0) {
    throw new Error(
      [
        "Refusing to rewrite existing product line display names during product identity apply.",
        ...conflicts,
      ].join("\n"),
    )
  }
}

async function upsertBrandAliases(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
  brandsByKey: Map<string, BrandRecord>,
  productLinesByKey: Map<string, ProductLineRecord>,
) {
  const aliasesByNormalizedValue = new Map<
    string,
    {
      brand_id: string
      product_line_id: string | null
      alias: string
      normalized_alias: string
      source: "curated"
    }
  >()

  for (const brand of plan.brands) {
    const brandRecord = brandsByKey.get(brand.key)
    if (!brandRecord) continue

    const normalizedAlias = normalizeAlias(brand.canonical_name)
    aliasesByNormalizedValue.set(normalizedAlias, {
      brand_id: brandRecord.id,
      product_line_id: null,
      alias: brand.canonical_name,
      normalized_alias: normalizedAlias,
      source: "curated",
    })
  }

  for (const product of plan.productUpdates) {
    const brand = brandsByKey.get(product.brand_key)
    if (!brand) continue

    for (const alias of product.aliases) {
      const line =
        alias.product_line === null
          ? null
          : (productLinesByKey.get(`${brand.id}:${productLineKey(alias.product_line)}`) ?? null)

      if (alias.resolves_to === "brand_line" && !line) {
        throw new Error(
          `Missing product line id for brand-line alias "${alias.alias}" on product ${product.product_id}.`,
        )
      }

      const productLineId = alias.resolves_to === "brand_line" ? (line?.id ?? null) : null
      const normalizedAlias = normalizeAlias(alias.alias)
      aliasesByNormalizedValue.set(normalizedAlias, {
        brand_id: brand.id,
        product_line_id: productLineId,
        alias: alias.alias,
        normalized_alias: normalizedAlias,
        source: "curated",
      })
    }
  }

  const payload = [...aliasesByNormalizedValue.values()]

  if (payload.length === 0) return

  await assertExistingBrandAliasesCompatible(supabase, payload)

  const { error } = await supabase
    .from("brand_aliases")
    .upsert(payload, { onConflict: "normalized_alias", ignoreDuplicates: true })

  if (error) throw new Error(`Failed to upsert brand aliases: ${error.message}`)
}

async function assertExistingBrandAliasesCompatible(
  supabase: SupabaseClient,
  payload: Array<{
    brand_id: string
    product_line_id: string | null
    alias: string
    normalized_alias: string
    source: "curated"
  }>,
) {
  const normalizedAliases = payload.map((alias) => alias.normalized_alias)
  if (normalizedAliases.length === 0) return

  const { data, error } = await supabase
    .from("brand_aliases")
    .select("normalized_alias,brand_id,product_line_id")
    .in("normalized_alias", normalizedAliases)

  if (error) throw new Error(`Failed to check existing brand aliases: ${error.message}`)

  const incomingByNormalizedAlias = new Map(payload.map((alias) => [alias.normalized_alias, alias]))
  const conflicts = (data as BrandAliasRecord[]).flatMap((existing) => {
    const incoming = incomingByNormalizedAlias.get(existing.normalized_alias)
    if (!incoming) return []
    if (
      existing.brand_id === incoming.brand_id &&
      (existing.product_line_id ?? null) === incoming.product_line_id
    ) {
      return []
    }

    return [
      `${existing.normalized_alias}: database points to ${existing.brand_id}/${existing.product_line_id ?? "brand"}, mapping points to ${incoming.brand_id}/${incoming.product_line_id ?? "brand"}`,
    ]
  })

  if (conflicts.length > 0) {
    throw new Error(
      [
        "Refusing to re-point existing brand aliases during product identity apply.",
        ...conflicts,
      ].join("\n"),
    )
  }
}

async function upsertProductIdentifiers(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
) {
  const payload = plan.identifiers.map((identifier) => ({
    product_id: identifier.product_id,
    identifier_type: identifier.type,
    identifier_value: identifier.value,
    source: "curated",
  }))

  if (payload.length === 0) return

  const { error } = await supabase.from("product_identifiers").upsert(payload, {
    onConflict: "product_id,identifier_type,normalized_identifier_value",
  })

  if (error) throw new Error(`Failed to upsert product identifiers: ${error.message}`)
}

async function updateProducts(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
  brandsByKey: Map<string, BrandRecord>,
  productLinesByKey: Map<string, ProductLineRecord>,
) {
  for (const update of plan.productUpdates) {
    const brand = brandsByKey.get(update.brand_key)
    if (!brand) throw new Error(`Missing brand id for ${update.brand_key}.`)

    const productLine =
      update.product_line_key == null
        ? null
        : (productLinesByKey.get(`${brand.id}:${update.product_line_key}`) ?? null)

    if (update.product_line_key != null && !productLine) {
      throw new Error(`Missing product line id for ${update.product_line_key}.`)
    }

    const patch: Record<string, unknown> = {
      category_key: update.category_key,
      brand_id: brand.id,
      product_line_id: productLine?.id ?? null,
    }

    const { error } = await supabase.from("products").update(patch).eq("id", update.product_id)
    if (error) {
      throw new Error(`Failed to update product ${update.product_id}: ${error.message}`)
    }
  }
}

async function applyNormalization(options: CliOptions, document: NormalizationDocument) {
  const plan = buildApplyPlan(document)

  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply and --confirm-project to write.")
    printPlan(plan)
    return
  }

  const supabase = createSupabaseClientFromEnv()
  assertWriteGuards(options)
  await assertProductsExist(supabase, plan)
  await assertProductsMatchReviewedMapping(supabase, document)

  const brandsByKey = await upsertBrands(supabase, plan)
  const productLinesByKey = await upsertProductLines(supabase, plan, brandsByKey)
  await upsertBrandAliases(supabase, plan, brandsByKey, productLinesByKey)
  await upsertProductIdentifiers(supabase, plan)
  await updateProducts(supabase, plan, brandsByKey, productLinesByKey)

  printPlan(plan)
  console.log("Applied product identity normalization.")
}

function printPlan(plan: ReturnType<typeof buildApplyPlan>) {
  const uniqueBrandAliasCount = new Set(
    plan.brands.flatMap((brand) => brand.aliases.map((alias) => normalizeAlias(alias))),
  ).size

  console.log(
    [
      `Brands: ${plan.brands.length}`,
      `Brand aliases: ${uniqueBrandAliasCount}`,
      `Product lines: ${plan.productLines.length}`,
      `Product identifiers: ${plan.identifiers.length}`,
      `Product updates: ${plan.productUpdates.length}`,
      "Rename products.name: no (not supported in Phase 0)",
    ].join("\n"),
  )
}

async function main() {
  loadEnv({ path: ".env.local" })
  const options = parseArgs(process.argv.slice(2))
  const document = readNormalizationDocument()
  await applyNormalization(options, document)
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return (
    scriptPath.endsWith("apply-normalization.ts") || scriptPath.endsWith("apply-normalization.js")
  )
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
