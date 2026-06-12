import { config as loadEnv } from "dotenv"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { normalizeCategoryKey } from "../../src/lib/product-identity"
import { normalizeProductFrequency } from "../../src/lib/vocabulary/frequencies"

const PRODUCT_SELECT_COLUMNS = [
  "id",
  "brand",
  "name",
  "category",
  "is_active",
  "lifecycle_status",
  "image_url",
  "affiliate_link",
  "price_eur",
  "currency",
  "purchase_link_status",
  "purchase_link_checked_at",
  "price_checked_at",
].join(",")

const OUT_PATH = "data/product-catalog-snapshot.json"

export type ProductCatalogSnapshotRow = {
  id: string
  brand: string | null
  name: string | null
  category: string | null
  is_active: boolean | null
  lifecycle_status: string | null
  image_url: string | null
  affiliate_link: string | null
  price_eur: number | string | null
  currency: string | null
  purchase_link_status: string | null
  purchase_link_checked_at: string | null
  price_checked_at: string | null
}

export type UsageFact = {
  category: string | null
  frequency: string | null
  count: number
}

export type ProductCatalogSnapshot = {
  schema_version: 1
  exported_at: string
  source: {
    products_table: "products"
    usage_table: "user_product_usage"
    usage_privacy: "aggregate_category_frequency_only"
    products_count: number
    usage_facts_count: number
  }
  products: ProductCatalogSnapshotRow[]
  usage_facts: UsageFact[]
}

type SupabaseUsageAggregateRow = {
  category?: unknown
  frequency_range?: unknown
}

export function productSnapshotRow(row: Record<string, unknown>): ProductCatalogSnapshotRow {
  return {
    id: String(row.id ?? ""),
    brand: nullableString(row.brand),
    name: nullableString(row.name),
    category: nullableString(row.category),
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
    lifecycle_status: nullableString(row.lifecycle_status),
    image_url: nullableString(row.image_url),
    affiliate_link: nullableString(row.affiliate_link),
    price_eur: nullableNumberLike(row.price_eur),
    currency: nullableString(row.currency),
    purchase_link_status: nullableString(row.purchase_link_status),
    purchase_link_checked_at: nullableString(row.purchase_link_checked_at),
    price_checked_at: nullableString(row.price_checked_at),
  }
}

export function normalizeUsageFacts(rows: Array<Record<string, unknown>>): UsageFact[] {
  const factsByKey = new Map<string, UsageFact>()

  for (const row of rows) {
    const aggregateRow = row as SupabaseUsageAggregateRow
    const rawCategory = nullableString(aggregateRow.category)
    const category = normalizeCategoryForUsageFact(rawCategory)
    const rawFrequency = nullableString(aggregateRow.frequency_range)
    const frequency = rawFrequency === null ? null : normalizeProductFrequency(rawFrequency)
    const count = 1

    if (rawCategory !== null && category === null) {
      throw new Error(`Unknown user_product_usage.category in snapshot export: ${rawCategory}`)
    }
    if (rawFrequency !== null && frequency === null) {
      throw new Error(
        `Unknown user_product_usage.frequency_range in snapshot export: ${rawFrequency}`,
      )
    }

    const key = `${category ?? ""}\u0000${frequency ?? ""}`
    const existing = factsByKey.get(key)

    if (existing) {
      existing.count += count
    } else {
      factsByKey.set(key, { category, frequency, count })
    }
  }

  return [...factsByKey.values()].sort((left, right) => {
    const categoryCompare = (left.category ?? "").localeCompare(right.category ?? "")
    if (categoryCompare !== 0) return categoryCompare
    return (left.frequency ?? "").localeCompare(right.frequency ?? "")
  })
}

function normalizeCategoryForUsageFact(category: string | null): string | null {
  if (category === null) return null
  return normalizeCategoryKey(category)
}

export function buildSnapshot(params: {
  products: ProductCatalogSnapshotRow[]
  usageFacts: UsageFact[]
  exportedAt?: string
}): ProductCatalogSnapshot {
  return {
    schema_version: 1,
    exported_at: params.exportedAt ?? new Date().toISOString(),
    source: {
      products_table: "products",
      usage_table: "user_product_usage",
      usage_privacy: "aggregate_category_frequency_only",
      products_count: params.products.length,
      usage_facts_count: params.usageFacts.length,
    },
    products: params.products,
    usage_facts: params.usageFacts,
  }
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  return value
}

function nullableNumberLike(value: unknown): number | string | null {
  if (typeof value === "number" || typeof value === "string") return value
  return null
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

async function fetchProducts(supabase: SupabaseClient): Promise<ProductCatalogSnapshotRow[]> {
  const pageSize = 1000
  let from = 0
  const rows: ProductCatalogSnapshotRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT_COLUMNS)
      .order("category", { ascending: true })
      .order("brand", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to export products: ${error.message}`)
    }

    if (!data || data.length === 0) break
    rows.push(...data.map((row) => productSnapshotRow(row as unknown as Record<string, unknown>)))
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function fetchUsageFacts(supabase: SupabaseClient): Promise<UsageFact[]> {
  const pageSize = 1000
  let from = 0
  const rows: Array<Record<string, unknown>> = []

  while (true) {
    const { data, error } = await supabase
      .from("user_product_usage")
      .select("category,frequency_range")
      .order("category", { ascending: true })
      .order("frequency_range", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(
        [
          "Failed to export aggregate user_product_usage facts.",
          "This query intentionally selects only category and frequency_range, never user ids.",
          `Original error: ${error.message}`,
        ].join(" "),
      )
    }

    if (!data || data.length === 0) break
    rows.push(...(data as Array<Record<string, unknown>>))
    if (data.length < pageSize) break
    from += pageSize
  }

  return normalizeUsageFacts(rows)
}

async function main() {
  const supabase = createSupabaseClientFromEnv()
  const products = await fetchProducts(supabase)
  const usageFacts = await fetchUsageFacts(supabase)
  const snapshot = buildSnapshot({ products, usageFacts })

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(join(process.cwd(), OUT_PATH), `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8")

  console.log(`Exported ${products.length} products to ${OUT_PATH}.`)
  console.log(`Exported ${usageFacts.length} aggregate usage facts without user ids.`)
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return scriptPath.endsWith("export-catalog.ts") || scriptPath.endsWith("export-catalog.js")
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
