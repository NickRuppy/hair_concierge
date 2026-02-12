/**
 * Product Matrix → content_chunks Ingestion
 *
 * Reads the JSON files from data/products-from-excel/, groups products by
 * category × hair_texture × concern, and creates rich text chunks with
 * embeddings in the content_chunks table (source_type = 'product_list').
 *
 * This makes product data discoverable via RAG vector search alongside
 * the existing product table (which is used for structured matching).
 *
 * Usage: npx tsx scripts/ingest-product-chunks.ts [--dry-run]
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

const EMBEDDING_MODEL = "text-embedding-3-large"
const EMBEDDING_BATCH_SIZE = 10

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ---------------------------------------------------------------------------
// German labels
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
  nix: "allgemeine Pflege (keine besonderen Probleme)",
  "natuerliches-oel": "natürliche Ölpflege",
  stylingoel: "Styling mit Öl",
  trockenoel: "Trockenöl-Pflege",
}

const TEXTURE_LABELS: Record<string, string> = {
  fein: "feines Haar",
  mittel: "mittelstarkes Haar (normale Haardicke)",
  dick: "dickes Haar",
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductInput {
  name: string
  brand?: string
  category?: string
  suitable_hair_types?: string[]
  suitable_concerns?: string[]
  tags?: string[]
}

interface ChunkData {
  content: string
  sourceName: string
  chunkIndex: number
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Grouping & Chunk Generation
// ---------------------------------------------------------------------------

function buildChunks(allProducts: ProductInput[]): ChunkData[] {
  // Group by: category → hair_texture → concern
  const groups = new Map<string, ProductInput[]>()

  for (const product of allProducts) {
    const category = product.category || "Sonstiges"
    const hairType = product.suitable_hair_types?.[0] || "alle"
    const concern = product.suitable_concerns?.[0] || "allgemein"
    const key = `${category}|${hairType}|${concern}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(product)
  }

  const chunks: ChunkData[] = []
  let chunkIndex = 0

  for (const [key, products] of groups) {
    const [category, hairTexture, concern] = key.split("|")
    const textureLabel = TEXTURE_LABELS[hairTexture] || hairTexture
    const concernLabel = CONCERN_LABELS[concern] || concern

    // Build a rich, natural-language chunk
    const productLines = products.map((p) => {
      if (p.brand && p.brand !== p.name) {
        return `- ${p.name} (${p.brand})`
      }
      return `- ${p.name}`
    })

    const content =
      `Toms Produktempfehlungen: ${category} für ${textureLabel} bei ${concernLabel}\n\n` +
      `Folgende ${category}-Produkte empfiehlt Tom Hannemann für Menschen mit ${textureLabel} ` +
      `und dem Anliegen "${concernLabel}":\n\n` +
      productLines.join("\n") +
      `\n\nInsgesamt ${products.length} empfohlene Produkte in dieser Kategorie.`

    chunks.push({
      content,
      sourceName: `produktmatrix/${category.toLowerCase().replace(/\s+/g, "-")}`,
      chunkIndex: chunkIndex++,
      metadata: {
        category,
        hair_texture: hairTexture,
        concern,
        product_count: products.length,
        product_names: products.map((p) => p.name),
        language: "de",
      },
    })
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Embedding & Storage
// ---------------------------------------------------------------------------

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE)
    process.stdout.write(`  Embedding batch ${batchNum}/${totalBatches}...\r`)

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: 384,
    })

    const sorted = response.data.sort((a, b) => a.index - b.index)
    embeddings.push(...sorted.map((d) => d.embedding))
  }

  console.log(`  Embedded ${texts.length} chunks`)
  return embeddings
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  console.log("=".repeat(60))
  console.log("Product Matrix → content_chunks Ingestion")
  if (dryRun) console.log("(DRY RUN)")
  console.log("=".repeat(60))

  // Read all JSON files from data/products-from-excel/
  const excelDir = path.join(process.cwd(), "data", "products-from-excel")
  if (!fs.existsSync(excelDir)) {
    console.error(`Error: ${excelDir} not found`)
    process.exit(1)
  }

  const jsonFiles = fs.readdirSync(excelDir).filter((f) => f.endsWith(".json"))
  console.log(`\nFound ${jsonFiles.length} JSON files in products-from-excel/`)

  const allProducts: ProductInput[] = []
  for (const file of jsonFiles) {
    const products: ProductInput[] = JSON.parse(
      fs.readFileSync(path.join(excelDir, file), "utf-8")
    )
    console.log(`  ${file}: ${products.length} products`)
    allProducts.push(...products)
  }

  console.log(`\nTotal products: ${allProducts.length}`)

  // Build grouped chunks
  const chunks = buildChunks(allProducts)
  console.log(`Generated ${chunks.length} chunks (category × hair_texture × concern)`)

  if (dryRun) {
    console.log("\nChunk preview:")
    for (const chunk of chunks.slice(0, 3)) {
      console.log(`\n--- ${chunk.sourceName} [${chunk.chunkIndex}] ---`)
      console.log(chunk.content.slice(0, 300))
      console.log("...")
    }
    console.log(`\n(Dry run — nothing was embedded or stored)`)
    return
  }

  // Clear existing product_list chunks
  console.log("\nClearing existing product_list chunks...")
  const { error: deleteError } = await supabase
    .from("content_chunks")
    .delete()
    .eq("source_type", "product_list")

  if (deleteError) {
    console.error("Warning: could not clear product_list chunks:", deleteError.message)
  }

  // Generate embeddings
  console.log("\nGenerating embeddings...")
  const texts = chunks.map((c) => c.content)
  const embeddings = await generateEmbeddings(texts)

  // Insert into content_chunks
  console.log("\nInserting into content_chunks...")
  const rows = chunks.map((chunk, idx) => ({
    source_type: "product_list",
    source_name: chunk.sourceName,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    token_count: Math.ceil(chunk.content.length / 4),
    metadata: chunk.metadata,
    embedding: JSON.stringify(embeddings[idx]),
  }))

  // Insert in batches of 50
  let stored = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase.from("content_chunks").insert(batch)
    if (error) {
      console.error(`  Error inserting batch at ${i}:`, error.message)
    } else {
      stored += batch.length
    }
  }

  console.log(`\nStored ${stored} product_list chunks in content_chunks`)
  console.log("=".repeat(60))
}

main().catch(console.error)
