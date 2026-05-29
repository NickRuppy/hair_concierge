import { config as loadEnv } from "dotenv"
import { mkdirSync, readdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import { isUsableUrl } from "../src/lib/affiliate-research/url-gate"
import { writeCsv } from "../src/lib/affiliate-research/csv"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type ProductRow = {
  id: string
  name: string
  brand: string | null
  description: string | null
  category: string | null
  affiliate_link: string | null
  price_eur: number | string | null
  is_active: boolean | null
}

const OUT_DIR = "data/affiliate-research"

const EXPORT_HEADER = ["id", "brand", "name", "description", "category", "price_eur"] as const

type SliceSpec = {
  slug: string
  category: string
  startIndex: number // 0-based, inclusive
  endIndex: number // exclusive
}

const SLICE_PLAN: ReadonlyArray<SliceSpec> = [
  { slug: "shampoo-a", category: "Shampoo", startIndex: 0, endIndex: 13 },
  { slug: "shampoo-b", category: "Shampoo", startIndex: 13, endIndex: 26 },
  { slug: "shampoo-c", category: "Shampoo", startIndex: 26, endIndex: 39 },
  { slug: "shampoo-d", category: "Shampoo", startIndex: 39, endIndex: 51 },
  { slug: "leave-in-a", category: "Leave-in", startIndex: 0, endIndex: 14 },
  { slug: "leave-in-b", category: "Leave-in", startIndex: 14, endIndex: 28 },
  { slug: "leave-in-c", category: "Leave-in", startIndex: 28, endIndex: 42 },
  { slug: "oele-a", category: "Öle", startIndex: 0, endIndex: 14 },
  { slug: "oele-b", category: "Öle", startIndex: 14, endIndex: 28 },
  { slug: "oele-c", category: "Öle", startIndex: 28, endIndex: 41 },
  { slug: "conditioner-a", category: "Conditioner (Drogerie)", startIndex: 0, endIndex: 14 },
  { slug: "conditioner-b", category: "Conditioner (Drogerie)", startIndex: 14, endIndex: 27 },
  { slug: "conditioner-c", category: "Conditioner (Drogerie)", startIndex: 27, endIndex: 40 },
  { slug: "maske-a", category: "Maske", startIndex: 0, endIndex: 18 },
  { slug: "maske-b", category: "Maske", startIndex: 18, endIndex: 35 },
]

function toExportRow(r: ProductRow): Record<string, string> {
  return {
    id: r.id,
    brand: r.brand ?? "",
    name: r.name,
    description: r.description ?? "",
    category: r.category ?? "",
    price_eur: r.price_eur != null ? String(r.price_eur) : "",
  }
}

async function fetchAllMissing(): Promise<ProductRow[]> {
  const pageSize = 1000
  let from = 0
  const all: ProductRow[] = []
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, description, category, affiliate_link, price_eur, is_active")
      .order("category", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as ProductRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all.filter((r) => r.is_active && !isUsableUrl(r.affiliate_link))
}

function pickCanary(rows: ProductRow[]): ProductRow[] {
  // 1-2 rows per category, prefer brand diversity
  const byCat = new Map<string, ProductRow[]>()
  for (const r of rows) {
    const cat = r.category ?? "(none)"
    const arr = byCat.get(cat) ?? []
    arr.push(r)
    byCat.set(cat, arr)
  }
  const out: ProductRow[] = []
  for (const [, list] of byCat) {
    out.push(list[0])
    if (list.length > 1) out.push(list[Math.min(list.length - 1, 5)])
    if (out.length >= 8) break
  }
  return out.slice(0, 8)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // Clear stale results from any prior run so the aggregator can't pick up
  // results-*.csv that don't correspond to this export's slice plan.
  // missing-*.csv are overwritten in place below; only stray files we worry about.
  for (const f of readdirSync(OUT_DIR)) {
    if (/^results-[a-z0-9-]+\.csv$/.test(f)) {
      unlinkSync(join(OUT_DIR, f))
      console.log(`  cleared stale: ${f}`)
    }
  }

  const missing = await fetchAllMissing()
  console.log(`Found ${missing.length} active products missing a usable affiliate_link.`)

  // Write master missing.csv
  writeCsv(join(OUT_DIR, "missing.csv"), [...EXPORT_HEADER], missing.map(toExportRow))

  // Write canary slice
  const canary = pickCanary(missing)
  writeCsv(join(OUT_DIR, "missing-canary.csv"), [...EXPORT_HEADER], canary.map(toExportRow))
  console.log(`Wrote missing-canary.csv with ${canary.length} rows.`)

  // Group by category, sort by id, slice
  const byCategory = new Map<string, ProductRow[]>()
  for (const r of missing) {
    const list = byCategory.get(r.category ?? "") ?? []
    list.push(r)
    byCategory.set(r.category ?? "", list)
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id))
  }

  let totalWritten = 0
  for (const slice of SLICE_PLAN) {
    const pool = byCategory.get(slice.category) ?? []
    const rows = pool.slice(slice.startIndex, slice.endIndex)
    writeCsv(join(OUT_DIR, `missing-${slice.slug}.csv`), [...EXPORT_HEADER], rows.map(toExportRow))
    console.log(`Wrote missing-${slice.slug}.csv (${rows.length} rows from ${slice.category}).`)
    totalWritten += rows.length
  }

  if (totalWritten !== missing.length) {
    console.warn(
      `WARNING: slice plan covers ${totalWritten} rows but ${missing.length} are missing. Adjust SLICE_PLAN ranges if category counts changed.`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
