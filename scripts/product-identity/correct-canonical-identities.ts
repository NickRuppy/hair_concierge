import { config as loadEnv } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { join, sep } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { buildApplyPlan, brandKey, productLineKey } from "./apply-normalization"
import { normalizeAlias, validateNormalizationDocument } from "./validate-normalization"

const NORMALIZATION_PATH = "data/product-catalog-normalization.json"
const PROJECT_REF = "pqdkhefxsxkyeqelqegq"
const EXPECTED_SUPABASE_HOSTNAME = `${PROJECT_REF}.supabase.co`

type CliOptions = {
  apply: boolean
  confirmProject: string | null
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
  identifiers: Array<{ type: string; value: string }>
  review_status: "reviewed"
}

type NormalizationDocument = {
  products: ProductMapping[]
}

type CorrectionSpec = {
  product_id: string
  old_brand: string
  old_product_line: string | null
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

type ProductCurrentRow = {
  id: string
  name: string | null
  brand: string | null
  category: string | null
  brand_id: string | null
  product_line_id: string | null
}

type BrandAliasPayload = {
  brand_id: string
  product_line_id: string | null
  alias: string
  normalized_alias: string
  source: "curated"
  target_brand_name: string
  target_product_line_name: string | null
}

type BrandAliasRecord = {
  normalized_alias: string
  brand_id: string
  product_line_id: string | null
}

type AliasChange = {
  normalized_alias: string
  alias: string
  action: "insert" | "reuse" | "retarget"
  from: string | null
  to: string
}

type ProductPatch = {
  brand_id: string
  product_line_id: string | null
}

const CORRECTION_SPECS: CorrectionSpec[] = [
  {
    product_id: "02113cc7-80c4-45a5-a56b-738ac96f4f02",
    old_brand: "Gliss",
    old_product_line: "Kur",
  },
  {
    product_id: "ffd37427-0cb6-4d6a-8b83-ea904bf2b1d7",
    old_brand: "Monday",
    old_product_line: null,
  },
  {
    product_id: "5516009a-eecb-42dd-87f6-07c560161136",
    old_brand: "Garnier",
    old_product_line: "Fructis Hair Food",
  },
  {
    product_id: "c6e80f39-20ba-401e-b041-6ee7c89a5996",
    old_brand: "Balea",
    old_product_line: "Aqua",
  },
  {
    product_id: "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
    old_brand: "Gliss",
    old_product_line: null,
  },
  {
    product_id: "4c3e1a63-4696-406a-be67-f2aacc678b0c",
    old_brand: "Garnier",
    old_product_line: "Hair Food",
  },
  {
    product_id: "0307c903-84f9-46b4-8f1f-a51c2b1f38ff",
    old_brand: "Garnier",
    old_product_line: "Hair Food",
  },
  {
    product_id: "a72d630d-547a-465f-9846-3006b38af0a2",
    old_brand: "Garnier",
    old_product_line: "Hair Food",
  },
  {
    product_id: "55727898-2a5e-4f01-ace1-bd91521d98ab",
    old_brand: "Balea",
    old_product_line: "Aqua",
  },
  {
    product_id: "52264c47-f339-49db-9fb2-207d1ad3b470",
    old_brand: "Fructis",
    old_product_line: null,
  },
  {
    product_id: "9e1442c9-4ab8-4819-a851-66859a98ed80",
    old_brand: "Fructis",
    old_product_line: null,
  },
  {
    product_id: "7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9",
    old_brand: "Gliss",
    old_product_line: null,
  },
  {
    product_id: "d9825ad6-f549-4b02-a62a-eaa3bf917936",
    old_brand: "Gliss",
    old_product_line: null,
  },
  {
    product_id: "4e76bb70-b521-48e1-9708-4edc48b17c73",
    old_brand: "Glisskur",
    old_product_line: null,
  },
  {
    product_id: "ea353b65-544d-48a8-a057-c3e733b66326",
    old_brand: "Wahre Schätze",
    old_product_line: null,
  },
  {
    product_id: "b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75",
    old_brand: "Wahre Schätze",
    old_product_line: null,
  },
  {
    product_id: "c05773dd-9656-4381-a0ab-8e9fc310c520",
    old_brand: "L’Oréal",
    old_product_line: null,
  },
  {
    product_id: "21a94166-3813-4c0f-8912-508fb8f704f1",
    old_brand: "L’Oréal",
    old_product_line: null,
  },
  {
    product_id: "ead1333b-6839-464d-b272-673d39bb95a4",
    old_brand: "Balea",
    old_product_line: "Aqua",
  },
  {
    product_id: "6dc65df2-2466-43e4-bdc2-3a05803f305c",
    old_brand: "Monday Haircare",
    old_product_line: null,
  },
  {
    product_id: "7200bb0b-7463-433b-86c8-744f5c1431de",
    old_brand: "Wahre Schätze",
    old_product_line: null,
  },
  {
    product_id: "0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33",
    old_brand: "Wahre Schätze",
    old_product_line: null,
  },
  {
    product_id: "514ffd65-e4a5-4f7f-96c5-0f194e3b3b36",
    old_brand: "L'Oreal Professionnel",
    old_product_line: null,
  },
]

const CORRECTION_PRODUCT_IDS = new Set(CORRECTION_SPECS.map((spec) => spec.product_id))

export function parseArgs(args: string[]): CliOptions {
  const confirmArg = args.find((arg) => arg.startsWith("--confirm-project="))

  return {
    apply: args.includes("--apply"),
    confirmProject: confirmArg ? (confirmArg.split("=", 2)[1] ?? null) : null,
  }
}

export function assertCanonicalCorrectionApplyTarget(params: {
  apply: boolean
  confirmProject: string | null
  supabaseUrl: string
}) {
  if (!params.apply) return

  const hostname = new URL(params.supabaseUrl).hostname
  if (hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `Refusing to apply canonical identity correction to unexpected Supabase project: ${hostname}. Expected ${EXPECTED_SUPABASE_HOSTNAME}.`,
    )
  }

  if (params.confirmProject !== PROJECT_REF) {
    throw new Error(`Writes require --confirm-project=${PROJECT_REF}.`)
  }
}

export function buildProductPatch(params: {
  brandId: string
  productLineId: string | null
}): ProductPatch {
  return {
    brand_id: params.brandId,
    product_line_id: params.productLineId,
  }
}

export function selectCorrectionProducts(document: NormalizationDocument): NormalizationDocument {
  const selected = document.products.filter((product) =>
    CORRECTION_PRODUCT_IDS.has(product.product_id),
  )

  if (selected.length !== CORRECTION_PRODUCT_IDS.size) {
    const found = new Set(selected.map((product) => product.product_id))
    const missing = [...CORRECTION_PRODUCT_IDS].filter((id) => !found.has(id))
    throw new Error(`Correction mapping is missing product ids: ${missing.join(", ")}`)
  }

  return { products: selected }
}

function loadLocalEnv() {
  for (const envPath of envCandidatePaths()) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath })
    }
  }
}

function envCandidatePaths(): string[] {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)

  if (worktreeIndex >= 0) {
    candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  }

  return [...new Set(candidates)]
}

function createSupabaseClientFromEnv(): SupabaseClient {
  loadLocalEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function readCorrectionDocument(): NormalizationDocument {
  const parsed = JSON.parse(readFileSync(NORMALIZATION_PATH, "utf-8")) as unknown
  const validation = validateNormalizationDocument(parsed, { requireReviewed: true })

  if (!validation.ok) {
    throw new Error(`Normalization document is invalid:\n${validation.errors.join("\n")}`)
  }

  return selectCorrectionProducts(parsed as NormalizationDocument)
}

async function verifyCurrentProducts(supabase: SupabaseClient, document: NormalizationDocument) {
  const ids = document.products.map((product) => product.product_id)
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,category,brand_id,product_line_id")
    .in("id", ids)

  if (error) throw new Error(`Failed to fetch current products: ${error.message}`)

  const rowsById = new Map((data as ProductCurrentRow[]).map((row) => [row.id, row]))
  const errors: string[] = []
  const brandsById = await fetchBrandsByIds(supabase, [
    ...new Set((data as ProductCurrentRow[]).flatMap((row) => row.brand_id ?? [])),
  ])
  const linesById = await fetchProductLinesByIds(supabase, [
    ...new Set((data as ProductCurrentRow[]).flatMap((row) => row.product_line_id ?? [])),
  ])

  for (const product of document.products) {
    const row = rowsById.get(product.product_id)
    if (!row) {
      errors.push(`Product ${product.product_id} is missing from production.`)
      continue
    }

    assertCurrentField(product, row, "current_brand", "brand", errors)
    assertCurrentField(product, row, "current_name", "name", errors)
    assertCurrentField(product, row, "current_category", "category", errors)
    assertCurrentIdentity(product, row, brandsById, linesById, errors)
  }

  if (errors.length > 0) {
    throw new Error(
      [
        "Refusing to apply canonical identity correction because reviewed mapping is stale.",
        ...errors,
      ].join("\n"),
    )
  }

  return rowsById
}

async function fetchBrandsByIds(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, BrandRecord>()
  const { data, error } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
    .in("id", ids)

  if (error) throw new Error(`Failed to fetch current product brands: ${error.message}`)
  return new Map((data as BrandRecord[]).map((brand) => [brand.id, brand]))
}

async function fetchProductLinesByIds(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, ProductLineRecord>()
  const { data, error } = await supabase
    .from("product_lines")
    .select("id,brand_id,canonical_name,normalized_name")
    .in("id", ids)

  if (error) throw new Error(`Failed to fetch current product lines: ${error.message}`)
  return new Map((data as ProductLineRecord[]).map((line) => [line.id, line]))
}

function assertCurrentField(
  product: ProductMapping,
  row: ProductCurrentRow,
  mappingField: "current_brand" | "current_name" | "current_category",
  currentField: "brand" | "name" | "category",
  errors: string[],
) {
  const expected = product[mappingField] ?? ""
  const actual = row[currentField] ?? ""
  if (normalizeAlias(expected) === normalizeAlias(actual)) return

  errors.push(
    `${product.product_id} ${mappingField} is stale: mapping has "${expected}", database has "${actual}".`,
  )
}

function assertCurrentIdentity(
  product: ProductMapping,
  row: ProductCurrentRow,
  brandsById: Map<string, BrandRecord>,
  linesById: Map<string, ProductLineRecord>,
  errors: string[],
) {
  const spec = CORRECTION_SPECS.find((correction) => correction.product_id === product.product_id)
  if (!spec) return

  const brand = row.brand_id ? (brandsById.get(row.brand_id) ?? null) : null
  const actualBrand = brand?.normalized_name ?? null
  const allowedBrands = new Set([
    normalizeAlias(spec.old_brand),
    normalizeAlias(product.canonical_brand),
  ])

  if (!actualBrand || !allowedBrands.has(actualBrand)) {
    errors.push(
      `${product.product_id} brand_id points to ${brand?.canonical_name ?? "null"}, expected ${spec.old_brand} or ${product.canonical_brand}.`,
    )
  }

  const line = row.product_line_id ? (linesById.get(row.product_line_id) ?? null) : null
  const actualLine = line?.normalized_name ?? null
  const allowedLines = new Set([
    spec.old_product_line ? normalizeAlias(spec.old_product_line) : null,
    product.product_line ? normalizeAlias(product.product_line) : null,
  ])

  if (!allowedLines.has(actualLine)) {
    errors.push(
      `${product.product_id} product_line_id points to ${line?.canonical_name ?? "null"}, expected ${spec.old_product_line ?? "null"} or ${product.product_line ?? "null"}.`,
    )
  }
}

async function upsertBrands(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
  apply: boolean,
) {
  const payload = plan.brands.map((brand) => ({
    canonical_name: brand.canonical_name,
    normalized_name: normalizeAlias(brand.canonical_name),
  }))

  if (payload.length === 0) return new Map<string, BrandRecord>()

  if (apply) {
    const { error } = await supabase.from("brands").upsert(payload, {
      onConflict: "normalized_name",
    })
    if (error) throw new Error(`Failed to upsert corrected brands: ${error.message}`)
  }

  const { data, error } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
    .in(
      "normalized_name",
      payload.map((brand) => brand.normalized_name),
    )

  if (error) throw new Error(`Failed to fetch corrected brands: ${error.message}`)

  const brandsByKey = new Map(
    (data as BrandRecord[]).map((brand) => [brandKey(brand.canonical_name), brand]),
  )

  if (!apply) {
    for (const brand of plan.brands) {
      const existing = brandsByKey.get(brand.key)
      if (existing) {
        brandsByKey.set(brand.key, {
          ...existing,
          canonical_name: brand.canonical_name,
          normalized_name: normalizeAlias(brand.canonical_name),
        })
        continue
      }
      brandsByKey.set(brand.key, {
        id: `dry-run:brand:${brand.key}`,
        canonical_name: brand.canonical_name,
        normalized_name: normalizeAlias(brand.canonical_name),
      })
    }
  }

  return brandsByKey
}

async function upsertProductLines(
  supabase: SupabaseClient,
  plan: ReturnType<typeof buildApplyPlan>,
  brandsByKey: Map<string, BrandRecord>,
  apply: boolean,
) {
  const payload = plan.productLines.flatMap((line) => {
    const brand = brandsByKey.get(line.brandKey)
    if (!brand) return []
    return [
      {
        brand_id: brand.id,
        canonical_name: line.name,
        normalized_name: normalizeAlias(line.name),
      },
    ]
  })

  if (payload.length === 0) return new Map<string, ProductLineRecord>()

  if (apply) {
    const { error } = await supabase.from("product_lines").upsert(payload, {
      onConflict: "brand_id,normalized_name",
    })
    if (error) throw new Error(`Failed to upsert corrected product lines: ${error.message}`)
  }

  const realBrandIds = [
    ...new Set(payload.map((line) => line.brand_id).filter((id) => !id.startsWith("dry-run:"))),
  ]
  const { data, error } =
    realBrandIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("product_lines")
          .select("id,brand_id,canonical_name,normalized_name")
          .in("brand_id", realBrandIds)

  if (error) throw new Error(`Failed to fetch corrected product lines: ${error.message}`)

  const expectedLineKeys = new Set(
    payload.map((line) => `${line.brand_id}:${line.normalized_name}`),
  )

  const linesByKey = new Map(
    (data as ProductLineRecord[])
      .filter((line) => expectedLineKeys.has(`${line.brand_id}:${line.normalized_name}`))
      .map((line) => [`${line.brand_id}:${productLineKey(line.canonical_name)}`, line]),
  )

  if (!apply) {
    for (const line of plan.productLines) {
      const brand = brandsByKey.get(line.brandKey)
      if (!brand) continue
      const key = `${brand.id}:${line.key}`
      if (linesByKey.has(key)) continue
      linesByKey.set(key, {
        id: `dry-run:line:${line.brandKey}:${line.key}`,
        brand_id: brand.id,
        canonical_name: line.name,
        normalized_name: normalizeAlias(line.name),
      })
    }
  }

  return linesByKey
}

function buildBrandAliasPayload(
  document: NormalizationDocument,
  brandsByKey: Map<string, BrandRecord>,
  productLinesByKey: Map<string, ProductLineRecord>,
) {
  const aliasesByNormalizedValue = new Map<string, BrandAliasPayload>()

  for (const brand of brandsByKey.values()) {
    const normalizedAlias = normalizeAlias(brand.canonical_name)
    aliasesByNormalizedValue.set(normalizedAlias, {
      brand_id: brand.id,
      product_line_id: null,
      alias: brand.canonical_name,
      normalized_alias: normalizedAlias,
      source: "curated",
      target_brand_name: brand.canonical_name,
      target_product_line_name: null,
    })
  }

  for (const product of document.products) {
    const brand = brandsByKey.get(brandKey(product.canonical_brand))
    if (!brand) throw new Error(`Missing brand id for ${product.canonical_brand}.`)

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
      const payload: BrandAliasPayload = {
        brand_id: brand.id,
        product_line_id: productLineId,
        alias: alias.alias,
        normalized_alias: normalizedAlias,
        source: "curated",
        target_brand_name: brand.canonical_name,
        target_product_line_name: line?.canonical_name ?? null,
      }
      const existing = aliasesByNormalizedValue.get(normalizedAlias)
      if (
        existing &&
        (existing.brand_id !== payload.brand_id ||
          (existing.product_line_id ?? null) !== payload.product_line_id)
      ) {
        throw new Error(`Conflicting alias payload for ${alias.alias}.`)
      }
      aliasesByNormalizedValue.set(normalizedAlias, payload)
    }
  }

  return [...aliasesByNormalizedValue.values()].sort((left, right) =>
    left.normalized_alias.localeCompare(right.normalized_alias),
  )
}

async function retargetBrandAliases(
  supabase: SupabaseClient,
  payload: BrandAliasPayload[],
  apply: boolean,
) {
  if (payload.length === 0) return { retargeted: 0, insertedOrReused: 0, changes: [] }
  const normalizedAliases = payload.map((alias) => alias.normalized_alias)
  const { data, error } = await supabase
    .from("brand_aliases")
    .select("normalized_alias,brand_id,product_line_id")
    .in("normalized_alias", normalizedAliases)

  if (error) throw new Error(`Failed to inspect existing brand aliases: ${error.message}`)

  const existingAliases = data as BrandAliasRecord[]
  const existingBrandsById = await fetchBrandsByIds(supabase, [
    ...new Set(existingAliases.map((alias) => alias.brand_id)),
  ])
  const existingLinesById = await fetchProductLinesByIds(supabase, [
    ...new Set(existingAliases.flatMap((alias) => alias.product_line_id ?? [])),
  ])
  const existingByAlias = new Map(existingAliases.map((alias) => [alias.normalized_alias, alias]))
  const payloadByAlias = new Map(payload.map((alias) => [alias.normalized_alias, alias]))
  const changes: AliasChange[] = payload.map((incoming) => {
    const existing = existingByAlias.get(incoming.normalized_alias)
    const from = existing
      ? formatTarget(
          existingBrandsById.get(existing.brand_id)?.canonical_name ?? "unknown",
          existing.product_line_id
            ? (existingLinesById.get(existing.product_line_id)?.canonical_name ?? "unknown")
            : null,
        )
      : null
    const to = formatTarget(incoming.target_brand_name, incoming.target_product_line_name)
    const action =
      from === null ? "insert" : normalizeAlias(from) === normalizeAlias(to) ? "reuse" : "retarget"

    return {
      normalized_alias: incoming.normalized_alias,
      alias: incoming.alias,
      action,
      from,
      to,
    }
  })
  const retargeted = changes.filter((change) => change.action === "retarget").length

  if (apply) {
    const { error: insertError } = await supabase
      .from("brand_aliases")
      .upsert(payload.map(brandAliasWriteRow), { onConflict: "normalized_alias" })
    if (insertError)
      throw new Error(`Failed to upsert corrected brand aliases: ${insertError.message}`)
  }

  return { retargeted, insertedOrReused: payload.length, changes }
}

export function brandAliasWriteRow(alias: BrandAliasPayload) {
  return {
    brand_id: alias.brand_id,
    product_line_id: alias.product_line_id,
    alias: alias.alias,
    normalized_alias: alias.normalized_alias,
    source: alias.source,
  }
}

function formatTarget(brandName: string, productLineName: string | null) {
  return productLineName ? `${brandName} > ${productLineName}` : brandName
}

async function updateProducts(
  supabase: SupabaseClient,
  document: NormalizationDocument,
  brandsByKey: Map<string, BrandRecord>,
  productLinesByKey: Map<string, ProductLineRecord>,
  apply: boolean,
) {
  const updates = []

  for (const product of document.products) {
    const brand = brandsByKey.get(brandKey(product.canonical_brand))
    if (!brand) throw new Error(`Missing brand id for ${product.canonical_brand}.`)

    const line =
      product.product_line === null
        ? null
        : (productLinesByKey.get(`${brand.id}:${productLineKey(product.product_line)}`) ?? null)

    if (product.product_line !== null && !line) {
      throw new Error(`Missing product line id for ${product.product_line}.`)
    }

    const patch = buildProductPatch({ brandId: brand.id, productLineId: line?.id ?? null })
    updates.push({ product_id: product.product_id, ...patch })

    if (apply) {
      const { error } = await supabase.from("products").update(patch).eq("id", product.product_id)
      if (error) throw new Error(`Failed to update product ${product.product_id}: ${error.message}`)
    }
  }

  return updates
}

async function countRefs(supabase: SupabaseClient, table: string, column: string, value: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value)

  if (error) throw new Error(`Failed to count ${table}.${column} refs: ${error.message}`)
  return count ?? 0
}

async function cleanupOrphans(supabase: SupabaseClient, apply: boolean) {
  const staleLineTargets = buildStaleLineTargets()
  const staleBrandNames = buildStaleBrandNames()
  const deleted: string[] = []
  const wouldDelete: string[] = []
  const skipped: string[] = []

  for (const target of staleLineTargets) {
    const brand = await fetchBrandByNormalizedName(supabase, normalizeAlias(target.brand))
    if (!brand) continue
    const line = await fetchLineByNormalizedName(supabase, brand.id, normalizeAlias(target.line))
    if (!line) continue

    const productRefs = await countRefs(supabase, "products", "product_line_id", line.id)
    const aliasRefs = await countRefs(supabase, "brand_aliases", "product_line_id", line.id)
    if (productRefs > 0 || aliasRefs > 0) {
      skipped.push(
        `${target.brand} > ${target.line} (${productRefs} product refs, ${aliasRefs} alias refs)`,
      )
      continue
    }

    if (apply) {
      const { error } = await supabase.from("product_lines").delete().eq("id", line.id)
      if (error)
        throw new Error(
          `Failed to delete orphan product line ${target.brand} > ${target.line}: ${error.message}`,
        )
      deleted.push(`${target.brand} > ${target.line}`)
    } else {
      wouldDelete.push(`${target.brand} > ${target.line}`)
    }
  }

  for (const brandName of staleBrandNames) {
    const brand = await fetchBrandByNormalizedName(supabase, normalizeAlias(brandName))
    if (!brand) continue

    const productRefs = await countRefs(supabase, "products", "brand_id", brand.id)
    const aliasRefs = await countRefs(supabase, "brand_aliases", "brand_id", brand.id)
    const lineRefs = await countRefs(supabase, "product_lines", "brand_id", brand.id)
    if (productRefs > 0 || aliasRefs > 0 || lineRefs > 0) {
      skipped.push(
        `${brandName} (${productRefs} product refs, ${aliasRefs} alias refs, ${lineRefs} line refs)`,
      )
      continue
    }

    if (apply) {
      const { error } = await supabase.from("brands").delete().eq("id", brand.id)
      if (error) throw new Error(`Failed to delete orphan brand ${brandName}: ${error.message}`)
      deleted.push(brandName)
    } else {
      wouldDelete.push(brandName)
    }
  }

  return { deleted, wouldDelete, skipped }
}

function buildStaleLineTargets() {
  const targets = new Map<string, { brand: string; line: string }>()
  for (const spec of CORRECTION_SPECS) {
    if (!spec.old_product_line) continue
    targets.set(`${normalizeAlias(spec.old_brand)}:${normalizeAlias(spec.old_product_line)}`, {
      brand: spec.old_brand,
      line: spec.old_product_line,
    })
  }
  return [...targets.values()]
}

function buildStaleBrandNames() {
  const targetBrandNormalizations = new Set(
    [
      "Garnier",
      "Schwarzkopf GLISS",
      "MONDAY",
      "L'Oréal Paris",
      "L'Oréal Professionnel",
      "Balea",
    ].map(normalizeAlias),
  )

  return [
    ...new Set(
      CORRECTION_SPECS.map((spec) => spec.old_brand).filter(
        (brand) => !targetBrandNormalizations.has(normalizeAlias(brand)),
      ),
    ),
  ]
}

async function fetchBrandByNormalizedName(supabase: SupabaseClient, normalizedName: string) {
  const { data, error } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
    .eq("normalized_name", normalizedName)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch brand ${normalizedName}: ${error.message}`)
  return data as BrandRecord | null
}

async function fetchLineByNormalizedName(
  supabase: SupabaseClient,
  brandId: string,
  normalizedName: string,
) {
  const { data, error } = await supabase
    .from("product_lines")
    .select("id,brand_id,canonical_name,normalized_name")
    .eq("brand_id", brandId)
    .eq("normalized_name", normalizedName)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch product line ${brandId}/${normalizedName}: ${error.message}`)
  }
  return data as ProductLineRecord | null
}

async function runCorrection(options: CliOptions) {
  loadLocalEnv()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  assertCanonicalCorrectionApplyTarget({
    apply: options.apply,
    confirmProject: options.confirmProject,
    supabaseUrl,
  })

  const document = readCorrectionDocument()
  const plan = buildApplyPlan(document)
  const supabase = createSupabaseClientFromEnv()

  await verifyCurrentProducts(supabase, document)
  const brandsByKey = await upsertBrands(supabase, plan, options.apply)
  const productLinesByKey = await upsertProductLines(supabase, plan, brandsByKey, options.apply)
  const aliasPayload = buildBrandAliasPayload(document, brandsByKey, productLinesByKey)
  const aliasSummary = await retargetBrandAliases(supabase, aliasPayload, options.apply)
  const productUpdates = await updateProducts(
    supabase,
    document,
    brandsByKey,
    productLinesByKey,
    options.apply,
  )
  const orphanSummary = await cleanupOrphans(supabase, options.apply)

  if (options.apply) {
    await verifyPostconditions(supabase, document, aliasPayload)
  }

  printSummary({
    apply: options.apply,
    brands: plan.brands.length,
    productLines: plan.productLines.length,
    aliases: aliasSummary.insertedOrReused,
    retargetedAliases: aliasSummary.retargeted,
    productUpdates: productUpdates.length,
    orphanSummary,
    aliasChanges: aliasSummary.changes,
  })
}

async function verifyPostconditions(
  supabase: SupabaseClient,
  document: NormalizationDocument,
  aliasPayload: BrandAliasPayload[],
) {
  const rowsById = await verifyCurrentProducts(supabase, document)
  const brandsById = await fetchBrandsByIds(supabase, [
    ...new Set([...rowsById.values()].flatMap((row) => row.brand_id ?? [])),
  ])
  const linesById = await fetchProductLinesByIds(supabase, [
    ...new Set([...rowsById.values()].flatMap((row) => row.product_line_id ?? [])),
  ])
  const errors: string[] = []

  for (const product of document.products) {
    const row = rowsById.get(product.product_id)
    if (!row) continue

    const brand = row.brand_id ? brandsById.get(row.brand_id) : null
    const line = row.product_line_id ? linesById.get(row.product_line_id) : null
    if (normalizeAlias(brand?.canonical_name ?? "") !== normalizeAlias(product.canonical_brand)) {
      errors.push(`${product.product_id} did not land on brand ${product.canonical_brand}.`)
    }
    if (
      (line ? normalizeAlias(line.canonical_name) : null) !==
      (product.product_line ? normalizeAlias(product.product_line) : null)
    ) {
      errors.push(
        `${product.product_id} did not land on product line ${product.product_line ?? "null"}.`,
      )
    }
    if (normalizeAlias(row.name ?? "") !== normalizeAlias(product.current_name)) {
      errors.push(`${product.product_id} products.name changed unexpectedly.`)
    }
  }

  const normalizedAliases = aliasPayload.map((alias) => alias.normalized_alias)
  const { data, error } = await supabase
    .from("brand_aliases")
    .select("normalized_alias,brand_id,product_line_id")
    .in("normalized_alias", normalizedAliases)

  if (error) throw new Error(`Failed to verify corrected aliases: ${error.message}`)

  const aliasesByName = new Map(
    (data as BrandAliasRecord[]).map((alias) => [alias.normalized_alias, alias]),
  )
  for (const expected of aliasPayload) {
    const actual = aliasesByName.get(expected.normalized_alias)
    if (!actual) {
      errors.push(`Alias ${expected.normalized_alias} is missing after apply.`)
      continue
    }
    if (
      actual.brand_id !== expected.brand_id ||
      (actual.product_line_id ?? null) !== expected.product_line_id
    ) {
      errors.push(
        `Alias ${expected.normalized_alias} did not land on ${formatTarget(expected.target_brand_name, expected.target_product_line_name)}.`,
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(["Canonical identity correction postcondition failed.", ...errors].join("\n"))
  }
}

function printSummary(summary: {
  apply: boolean
  brands: number
  productLines: number
  aliases: number
  retargetedAliases: number
  productUpdates: number
  orphanSummary: { deleted: string[]; wouldDelete: string[]; skipped: string[] }
  aliasChanges: AliasChange[]
}) {
  const orphanActionLabel = summary.apply ? "Orphans deleted" : "Orphans that would be deleted"
  const orphanActionCount = summary.apply
    ? summary.orphanSummary.deleted.length
    : summary.orphanSummary.wouldDelete.length

  console.log(
    [
      summary.apply ? "Applied canonical identity correction." : "Dry run only. No writes made.",
      `Brands inserted/reused: ${summary.brands}`,
      `Product lines inserted/reused: ${summary.productLines}`,
      `Brand aliases inserted/reused: ${summary.aliases}`,
      `Brand aliases retargeted: ${summary.retargetedAliases}`,
      `Product brand/line updates: ${summary.productUpdates}`,
      "Rename products.name: no",
      `${orphanActionLabel}: ${orphanActionCount}`,
      `Orphans skipped: ${summary.orphanSummary.skipped.length}`,
    ].join("\n"),
  )

  if (summary.orphanSummary.deleted.length > 0) {
    console.log(`Deleted orphans:\n${summary.orphanSummary.deleted.join("\n")}`)
  }
  if (!summary.apply && summary.orphanSummary.wouldDelete.length > 0) {
    console.log(`Orphans that would be deleted:\n${summary.orphanSummary.wouldDelete.join("\n")}`)
  }
  if (summary.orphanSummary.skipped.length > 0) {
    console.log(`Skipped orphans:\n${summary.orphanSummary.skipped.join("\n")}`)
  }
  if (summary.aliasChanges.length > 0) {
    console.table(
      summary.aliasChanges.map((change) => ({
        action: change.action,
        alias: change.alias,
        normalized_alias: change.normalized_alias,
        from: change.from ?? "(new)",
        to: change.to,
      })),
    )
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await runCorrection(options)
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return (
    scriptPath.endsWith("correct-canonical-identities.ts") ||
    scriptPath.endsWith("correct-canonical-identities.js")
  )
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
