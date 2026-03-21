import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { normalizeShampooBucketPairs, type ShampooBucketPairInput } from "../src/lib/shampoo/eligibility"

type Thickness = "fine" | "normal" | "coarse"
type ShampooBucket = "schuppen" | "irritationen" | "normal" | "dehydriert-fettig" | "trocken"

interface DbProduct {
  id: string
  name: string
  brand: string | null
  category: string | null
}

interface SourceProduct {
  name: string
  brand?: string
  category?: string
  suitable_thicknesses?: string[]
  suitable_hair_textures?: string[]
  suitable_concerns?: string[]
  shampoo_bucket_pairs?: ShampooBucketPairInput[]
  tags?: string[]
}

interface ReviewRow {
  product_id: string
  product_name: string
  brand: string
  thickness: Thickness
  shampoo_bucket: ShampooBucket
  anti_dandruff_active: "yes" | "none"
  use_pattern: string
  verification_status: string
  team_notes: string
  verified_by: string
  verified_on: string
  source_index: number
}

const THICKNESS_ORDER: Thickness[] = ["fine", "normal", "coarse"]
const BUCKET_ORDER: ShampooBucket[] = [
  "schuppen",
  "irritationen",
  "normal",
  "dehydriert-fettig",
  "trocken",
]

const SHAMPOO_CATEGORIES = ["Shampoo", "Shampoo Profi"]

const NAME_ALIASES: Record<string, string> = {
  "pntene hydra glow": "pantene hydra glow shampoo",
  "shampoo curl care": "hask curl care shampoo",
  "laghaarmadchen beautiful curls": "langhaarmadchen beautiful curls shampoo",
  "head shoulder derma x pro sensitive": "head shoulders derma x pro sensitive",
}

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeProductName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function escapeCsvValue(value: string): string {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replace(/"/g, "\"\"")}"`
}

function resolveDbProduct(sourceProduct: SourceProduct, dbProducts: DbProduct[]): DbProduct {
  const normalizedSourceName = normalizeProductName(sourceProduct.name)
  const normalizedAlias = NAME_ALIASES[normalizedSourceName] ?? normalizedSourceName

  const exactMatch = dbProducts.find(
    (product) => normalizeProductName(product.name) === normalizedAlias
  )
  if (exactMatch) return exactMatch

  const fuzzyMatches = dbProducts.filter((product) => {
    const normalizedDbName = normalizeProductName(product.name)
    return normalizedDbName.includes(normalizedAlias) || normalizedAlias.includes(normalizedDbName)
  })

  if (fuzzyMatches.length === 1) {
    return fuzzyMatches[0]
  }

  throw new Error(`Unable to resolve shampoo product "${sourceProduct.name}" to a catalog entry.`)
}

async function main(): Promise<void> {
  loadEnvLocal()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sourcePath = path.join(process.cwd(), "data/products-from-excel/shampoo.json")
  const outputPath = path.join(process.cwd(), "data/research/shampoo-specs-review-table.csv")
  const sourceProducts = JSON.parse(fs.readFileSync(sourcePath, "utf-8")) as SourceProduct[]

  const { data: dbProducts, error } = await supabase
    .from("products")
    .select("id, name, brand, category")
    .in("category", SHAMPOO_CATEGORIES)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Failed to load shampoo products: ${error.message}`)
  }

  const rows: ReviewRow[] = []

  for (const [sourceIndex, sourceProduct] of sourceProducts.entries()) {
    const matchedProduct = resolveDbProduct(sourceProduct, (dbProducts ?? []) as DbProduct[])
    const resolvedPairs = normalizeShampooBucketPairs(sourceProduct)
    const antiDandruffActive = resolvedPairs.some((pair) => pair.shampoo_bucket === "schuppen")
      ? "yes"
      : "none"

    for (const pair of resolvedPairs) {
      rows.push({
        product_id: matchedProduct.id,
        product_name: matchedProduct.name,
        brand: matchedProduct.brand ?? "",
        thickness: pair.thickness,
        shampoo_bucket: pair.shampoo_bucket,
        anti_dandruff_active: antiDandruffActive,
        use_pattern: "",
        verification_status: "PRELIMINARY",
        team_notes: "",
        verified_by: "",
        verified_on: "",
        source_index: sourceIndex,
      })
    }
  }

  rows.sort((a, b) => {
    const thicknessDiff = THICKNESS_ORDER.indexOf(a.thickness) - THICKNESS_ORDER.indexOf(b.thickness)
    if (thicknessDiff !== 0) return thicknessDiff

    const bucketDiff = BUCKET_ORDER.indexOf(a.shampoo_bucket) - BUCKET_ORDER.indexOf(b.shampoo_bucket)
    if (bucketDiff !== 0) return bucketDiff

    return a.source_index - b.source_index
  })

  const header = [
    "product_id",
    "product_name",
    "brand",
    "thickness",
    "shampoo_bucket",
    "anti_dandruff_active",
    "use_pattern",
    "verification_status",
    "team_notes",
    "verified_by",
    "verified_on",
  ]

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.product_id,
        row.product_name,
        row.brand,
        row.thickness,
        row.shampoo_bucket,
        row.anti_dandruff_active,
        row.use_pattern,
        row.verification_status,
        row.team_notes,
        row.verified_by,
        row.verified_on,
      ]
        .map((value) => escapeCsvValue(value))
        .join(",")
    ),
  ]

  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf-8")
  console.log(`Wrote ${rows.length} shampoo review rows to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
