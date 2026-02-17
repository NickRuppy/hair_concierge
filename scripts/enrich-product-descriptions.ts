/**
 * Product Description Enrichment Script
 *
 * Generates short_description and tom_take for all products using GPT-4o-mini.
 * Skips products that already have a short_description.
 *
 * Usage: npx tsx scripts/enrich-product-descriptions.ts
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs
    .readFileSync(envPath, "utf-8")
    .replace(/\r/g, "")
    .split("\n")) {
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

const BATCH_SIZE = 10
const DELAY_MS = 500

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function enrichProduct(product: {
  id: string
  name: string
  brand: string | null
  category: string | null
  tags: string[]
  suitable_hair_textures: string[]
  suitable_concerns: string[]
}): Promise<{ short_description: string; tom_take: string | null }> {
  const hairTypes = product.suitable_hair_textures?.length
    ? product.suitable_hair_textures.join(", ")
    : "alle Haartypen"
  const concerns = product.suitable_concerns?.length
    ? product.suitable_concerns.join(", ")
    : "allgemeine Pflege"
  const tags = product.tags?.length ? product.tags.join(", ") : ""

  const prompt = `Du schreibst kurze, sachliche Produktbeschreibungen für eine Haarpflege-App.

Produkt:
- Name: ${product.name}
- Marke: ${product.brand || "unbekannt"}
- Kategorie: ${product.category || "unbekannt"}
- Geeignet für Haartypen: ${hairTypes}
- Hilft bei: ${concerns}
${tags ? `- Tags: ${tags}` : ""}

Aufgabe:
1. "short_description": 1-2 Sätze. Sachlich, was das Produkt kann und für wen es geeignet ist. Kein Marketing-Sprech, keine Superlative. Deutsch.
2. "tom_take": OPTIONAL. Nur wenn du eine interessante, kurze Expertenmeinung dazu hast (1 Satz, locker, als ob ein Friseur es sagt). Wenn nicht, gib null zurück.

Antworte NUR als JSON: {"short_description": "...", "tom_take": "..." oder null}`

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  })

  const text = response.choices[0]?.message?.content?.trim() || ""

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json?\s*|\s*```$/g, "")
    const parsed = JSON.parse(cleaned)
    return {
      short_description: parsed.short_description || "",
      tom_take: parsed.tom_take || null,
    }
  } catch {
    console.warn(`  Failed to parse JSON for ${product.name}, using raw text`)
    return { short_description: text.slice(0, 200), tom_take: null }
  }
}

async function main() {
  console.log("Fetching products without short_description...")

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, brand, category, tags, suitable_hair_textures, suitable_concerns")
    .is("short_description", null)
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("Error fetching products:", error)
    process.exit(1)
  }

  console.log(`Found ${products.length} products to enrich.\n`)

  let enriched = 0
  let failed = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(
      batch.map(async (product) => {
        try {
          const desc = await enrichProduct(product)
          return { id: product.id, name: product.name, ...desc, ok: true }
        } catch (err) {
          console.error(`  Error enriching ${product.name}:`, err)
          return { id: product.id, name: product.name, short_description: "", tom_take: null, ok: false }
        }
      })
    )

    for (const result of results) {
      if (!result.ok || !result.short_description) {
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          short_description: result.short_description,
          tom_take: result.tom_take,
        })
        .eq("id", result.id)

      if (updateError) {
        console.error(`  DB update failed for ${result.name}:`, updateError)
        failed++
      } else {
        enriched++
        console.log(`  [${enriched}] ${result.name}`)
      }
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`)

    if (i + BATCH_SIZE < products.length) {
      await delay(DELAY_MS)
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Failed: ${failed}`)
}

main()
