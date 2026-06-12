import { config as loadEnv } from "dotenv"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createClient } from "@supabase/supabase-js"

loadEnv({ path: ".env.local" })

const outputPath =
  process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length) ??
  "data/product-images/pilot-2026-06-10/pilot-products.csv"
const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 20,
)
const allowPartial = process.argv.includes("--allow-partial")

if (!Number.isInteger(limit) || limit <= 0) {
  throw new Error(`--limit must be a positive integer, got ${limit}`)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function csvCell(value: unknown): string {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from("products")
    .select("id,brand,name,category,affiliate_link,image_url,lifecycle_status,is_active")
    .is("image_url", null)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("brand", { ascending: true })
    .limit(Math.max(limit * 3, limit))

  if (error) throw error

  const rows = data ?? []
  const byCategory = new Map<string, typeof rows>()

  for (const row of rows) {
    const key = row.category ?? "Uncategorized"
    byCategory.set(key, [...(byCategory.get(key) ?? []), row])
  }

  const selected: typeof rows = []
  for (const categoryRows of byCategory.values()) {
    if (selected.length >= limit) break
    if (categoryRows[0]) selected.push(categoryRows[0])
  }
  for (const row of rows) {
    if (selected.length >= limit) break
    if (!selected.some((entry) => entry.id === row.id)) selected.push(row)
  }

  if (selected.length < limit && !allowPartial) {
    throw new Error(
      `Expected ${limit} eligible products, found ${selected.length}. Use --allow-partial for the final batch.`,
    )
  }

  mkdirSync(dirname(outputPath), { recursive: true })

  const header = ["id", "brand", "name", "category", "affiliate_link", "notes"]
  const csv = [
    header.join(","),
    ...selected
      .slice(0, limit)
      .map((row) =>
        [
          row.id,
          row.brand,
          row.name,
          row.category,
          row.affiliate_link,
          "manual source review required",
        ]
          .map(csvCell)
          .join(","),
      ),
  ].join("\n")

  writeFileSync(outputPath, `${csv}\n`)
  console.log(`Wrote ${Math.min(selected.length, limit)} products to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
