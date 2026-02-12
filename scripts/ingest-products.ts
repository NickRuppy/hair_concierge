/**
 * Product Catalog Ingestion Script
 *
 * Usage: npx tsx scripts/ingest-products.ts
 *
 * Expects: data/products.csv or data/products.json
 * CSV format: name,brand,description,category,affiliate_link,image_url,price_eur,tags,suitable_hair_types,suitable_concerns
 * (tags, suitable_hair_types, suitable_concerns are semicolon-separated within the field)
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

// Load .env.local for standalone script execution
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ---------------------------------------------------------------------------
// German label mappings for description generation
// ---------------------------------------------------------------------------

const CONCERN_LABELS: Record<string, string> = {
  schuppen: "Schuppen",
  irritationen: "Kopfhautirritationen",
  normal: "normale Pflege",
  "dehydriert-fettig": "dehydrierte oder fettige Kopfhaut",
  trocken: "trockene Kopfhaut",
  protein: "Proteinbedarf",
  feuchtigkeit: "Feuchtigkeitsbedarf",
  performance: "Performance-Pflege",
  nix: "allgemeine Pflege",
  "natuerliches-oel": "natürliche Ölpflege",
  stylingoel: "Styling mit Öl",
  trockenoel: "Trockenöl-Pflege",
}

const TEXTURE_ADJECTIVES: Record<string, string> = {
  fein: "feines",
  mittel: "mittelstarkes",
  dick: "dickes",
}

interface ProductInput {
  name: string
  brand?: string
  description?: string
  category?: string
  affiliate_link?: string
  image_url?: string
  price_eur?: number
  tags?: string[]
  suitable_hair_types?: string[]
  suitable_concerns?: string[]
  is_active?: boolean
  sort_order?: number
}

function parseCSV(content: string): ProductInput[] {
  const lines = content.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const products: ProductInput[] = []

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parsing (handles basic cases)
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || ""
    })

    products.push({
      name: obj.name,
      brand: obj.brand || undefined,
      description: obj.description || undefined,
      category: obj.category || undefined,
      affiliate_link: obj.affiliate_link || undefined,
      image_url: obj.image_url || undefined,
      price_eur: obj.price_eur ? parseFloat(obj.price_eur) : undefined,
      tags: obj.tags ? obj.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
      suitable_hair_types: obj.suitable_hair_types
        ? obj.suitable_hair_types.split(";").map((t) => t.trim()).filter(Boolean)
        : [],
      suitable_concerns: obj.suitable_concerns
        ? obj.suitable_concerns.split(";").map((t) => t.trim()).filter(Boolean)
        : [],
      is_active: true,
      sort_order: i - 1,
    })
  }

  return products.filter((p) => p.name)
}

function generateDescription(product: ProductInput): string {
  const hairTypes = (product.suitable_hair_types || [])
    .map((t) => TEXTURE_ADJECTIVES[t] || t)
    .join(", ")
  const hair = hairTypes || "alle Haartypen"

  const concerns = (product.suitable_concerns || [])
    .map((c) => CONCERN_LABELS[c] || c)
    .join(", ")
  const concernText = concerns || "allgemeine Pflege"

  // Natural oils: brand === name and category is Öle
  if (product.brand === product.name && product.category === "Öle") {
    return `${product.name} ist ein natürliches Öl, empfohlen für ${hair} Haar bei ${concernText}.`
  }

  const category = product.category || "Produkt"
  const brand = product.brand && product.brand !== product.name ? ` von ${product.brand}` : ""
  return `${product.name} ist ein ${category}${brand}, empfohlen für ${hair} Haar bei ${concernText}.`
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    dimensions: 384,
  })

  return response.data[0].embedding
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "products.csv")
  const jsonPath = path.join(process.cwd(), "data", "products.json")

  let products: ProductInput[] = []

  if (fs.existsSync(jsonPath)) {
    console.log("Reading products.json...")
    const raw = fs.readFileSync(jsonPath, "utf-8")
    products = JSON.parse(raw)
  } else if (fs.existsSync(csvPath)) {
    console.log("Reading products.csv...")
    const raw = fs.readFileSync(csvPath, "utf-8")
    products = parseCSV(raw)
  }

  // Also read products extracted from Excel matrices
  const excelJsonDir = path.join(process.cwd(), "data", "products-from-excel")
  if (fs.existsSync(excelJsonDir)) {
    const files = fs.readdirSync(excelJsonDir).filter((f) => f.endsWith(".json"))
    for (const file of files) {
      console.log(`Reading ${file} from products-from-excel/...`)
      const excelProducts: ProductInput[] = JSON.parse(
        fs.readFileSync(path.join(excelJsonDir, file), "utf-8")
      )
      products.push(...excelProducts)
    }
  }

  if (products.length === 0) {
    console.error("Error: No product data found in data/products.csv, data/products.json, or data/products-from-excel/")
    process.exit(1)
  }

  console.log(`Found ${products.length} products`)

  for (let i = 0; i < products.length; i++) {
    const product = products[i]

    // Generate description if not already set
    const description = product.description || generateDescription(product)

    console.log(`  [${i + 1}/${products.length}] ${product.name}`)

    // Embed the description (rich semantic text)
    const embedding = await generateEmbedding(description)

    // Upsert product
    const { error } = await supabase.from("products").upsert(
      {
        name: product.name,
        brand: product.brand || null,
        description,
        category: product.category || null,
        affiliate_link: product.affiliate_link || null,
        image_url: product.image_url || null,
        price_eur: product.price_eur || null,
        tags: product.tags || [],
        suitable_hair_types: product.suitable_hair_types || [],
        suitable_concerns: product.suitable_concerns || [],
        is_active: product.is_active ?? true,
        sort_order: product.sort_order ?? i,
        embedding: JSON.stringify(embedding),
      },
      { onConflict: "name" }
    )

    if (error) {
      console.error(`  Error upserting ${product.name}:`, error.message)
    }
  }

  console.log("\nDone! Product ingestion complete.")
}

main().catch(console.error)
