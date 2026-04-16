/**
 * Product Catalog Ingestion Script
 *
 * Usage: npx tsx scripts/ingest-products.ts
 *
 * Expects: data/products.csv or data/products.json
 * CSV format: name,brand,description,category,affiliate_link,image_url,price_eur,tags,suitable_thicknesses,suitable_concerns
 * (tags, suitable_thicknesses, suitable_concerns are semicolon-separated within the field)
 */

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
import {
  LEAVE_IN_CONDITIONER_RELATIONSHIPS,
  LEAVE_IN_FIT_CARE_BENEFITS,
  LEAVE_IN_WEIGHTS,
  LEAVE_IN_ROLES,
  LEAVE_IN_APPLICATION_STAGES,
  type ProductLeaveInFitSpecs,
} from "../src/lib/leave-in/constants"
import {
  MASK_WEIGHTS,
  MASK_CONCENTRATIONS,
  isMaskCategory,
  type ProductMaskSpecs,
} from "../src/lib/mask/constants"
import { isShampooCategory, type ShampooBucketPair } from "../src/lib/shampoo/constants"
import {
  type ShampooBucketPairInput,
  normalizeShampooBucketPairs,
} from "../src/lib/shampoo/eligibility"

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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  fine: "feines",
  normal: "mittelstarkes",
  coarse: "dickes",
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
  suitable_thicknesses?: string[]
  suitable_hair_textures?: string[]
  suitable_concerns?: string[]
  shampoo_bucket_pairs?: ShampooBucketPairInput[]
  is_active?: boolean
  sort_order?: number
  leave_in_specs?: Partial<
    Omit<ProductLeaveInFitSpecs, "product_id" | "created_at" | "updated_at">
  > & {
    format?: string
    roles?: string[]
    provides_heat_protection?: boolean
    heat_protection_max_c?: number | null
    heat_activation_required?: boolean
    ingredient_flags?: string[]
    application_stage?: string[]
    care_benefits?: string[]
  }
  mask_specs?: Partial<Omit<ProductMaskSpecs, "product_id" | "created_at" | "updated_at">> & {
    format?: string | null
    benefits?: string[]
    ingredient_flags?: string[]
    leave_on_minutes?: number
  }
}

const LEAVE_IN_RELATIONSHIP_SET = new Set<string>(LEAVE_IN_CONDITIONER_RELATIONSHIPS)
const LEAVE_IN_WEIGHT_SET = new Set<string>(LEAVE_IN_WEIGHTS)
const LEAVE_IN_ROLE_SET = new Set<string>(LEAVE_IN_ROLES)
const LEAVE_IN_STAGE_SET = new Set<string>(LEAVE_IN_APPLICATION_STAGES)
const LEAVE_IN_FIT_CARE_SET = new Set<string>(LEAVE_IN_FIT_CARE_BENEFITS)
const MASK_WEIGHT_SET = new Set<string>(MASK_WEIGHTS)
const MASK_CONCENTRATION_SET = new Set<string>(MASK_CONCENTRATIONS)

function normalizeProductInput(product: ProductInput, fallbackSortOrder: number): ProductInput {
  const suitable_thicknesses = product.suitable_thicknesses?.length
    ? product.suitable_thicknesses
    : (product.suitable_hair_textures?.map((value) => value.trim()).filter(Boolean) ?? [])

  return {
    ...product,
    tags: product.tags?.map((value) => value.trim()).filter(Boolean) ?? [],
    suitable_thicknesses,
    suitable_concerns:
      product.suitable_concerns?.map((value) => value.trim()).filter(Boolean) ?? [],
    shampoo_bucket_pairs: product.shampoo_bucket_pairs?.map((pair) => ({
      thickness: pair.thickness.trim(),
      shampoo_bucket: pair.shampoo_bucket?.trim(),
      concern: pair.concern?.trim(),
    })),
    sort_order: product.sort_order ?? fallbackSortOrder,
  }
}

async function replaceCanonicalShampooPairs(
  productId: string,
  product: ProductInput,
): Promise<void> {
  const canonicalPairs = normalizeShampooBucketPairs(product)

  const { error: deleteError } = await supabase
    .from("product_shampoo_specs")
    .delete()
    .eq("product_id", productId)

  if (deleteError) {
    throw new Error(`Failed to clear shampoo pairs: ${deleteError.message}`)
  }

  if (canonicalPairs.length === 0) {
    throw new Error("Shampoo braucht mindestens ein kanonisches Eligibility-Paar.")
  }

  const rows = canonicalPairs.map((pair: ShampooBucketPair) => ({
    product_id: productId,
    thickness: pair.thickness,
    shampoo_bucket: pair.shampoo_bucket,
  }))

  const { error: insertError } = await supabase.from("product_shampoo_specs").insert(rows)

  if (insertError) {
    throw new Error(`Failed to write canonical shampoo pairs: ${insertError.message}`)
  }
}

function parseProductNamesFilter(rawValue?: string): Set<string> | null {
  if (!rawValue?.trim()) return null
  const names = rawValue
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean)

  return names.length > 0 ? new Set(names) : null
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
      tags: obj.tags
        ? obj.tags
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      suitable_thicknesses: obj.suitable_thicknesses
        ? obj.suitable_thicknesses
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      suitable_concerns: obj.suitable_concerns
        ? obj.suitable_concerns
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      is_active: true,
      sort_order: i - 1,
    })
  }

  return products.filter((p) => p.name)
}

function isLeaveInCategory(category?: string): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "leave-in" || normalized === "leave_in" || normalized === "leave in"
}

function asUniqueAllowed(values: string[] | undefined, allowedSet: Set<string>): string[] {
  if (!values) return []
  return Array.from(new Set(values.filter((value) => allowedSet.has(value))))
}

function inferLeaveInSpecs(
  product: ProductInput,
): Omit<ProductLeaveInFitSpecs, "product_id" | "created_at" | "updated_at"> {
  const existing = product.leave_in_specs
  const normalizedName = product.name.toLowerCase()
  const concerns = new Set(product.suitable_concerns ?? [])
  const textures = new Set(product.suitable_thicknesses ?? [])

  const weight =
    existing && LEAVE_IN_WEIGHT_SET.has(existing.weight ?? "")
      ? existing.weight
      : textures.size === 1 && textures.has("fine")
        ? "light"
        : textures.size === 1 && textures.has("coarse")
          ? "rich"
          : "medium"

  const rawRoles = asUniqueAllowed(existing?.roles, LEAVE_IN_ROLE_SET)
  const rawCareBenefits = (existing?.care_benefits ?? []) as string[]
  const rawStages = asUniqueAllowed(existing?.application_stage, LEAVE_IN_STAGE_SET)
  const explicitRelationship =
    existing && LEAVE_IN_RELATIONSHIP_SET.has(existing.conditioner_relationship ?? "")
      ? existing.conditioner_relationship
      : null

  const conditioner_relationship =
    explicitRelationship ??
    (rawRoles.includes("replacement_conditioner") ? "replacement_capable" : "booster_only")

  const careBenefits = new Set<string>()
  for (const benefit of rawCareBenefits) {
    if (LEAVE_IN_FIT_CARE_SET.has(benefit)) {
      careBenefits.add(benefit)
      continue
    }

    if (benefit === "repair" || benefit === "protein") {
      careBenefits.add("repair")
      continue
    }

    if (benefit === "curl_definition") {
      careBenefits.add("curl_definition")
      continue
    }

    if (["moisture", "anti_frizz", "detangling", "shine"].includes(benefit)) {
      careBenefits.add("detangle_smooth")
    }
  }

  if (existing) {
    if (existing.provides_heat_protection || rawStages.includes("pre_heat")) {
      careBenefits.add("heat_protect")
    }

    return {
      weight,
      conditioner_relationship,
      care_benefits: Array.from(careBenefits),
    }
  }

  const inferredFormat =
    normalizedName.includes("spray") || normalizedName.includes("mist")
      ? "spray"
      : normalizedName.includes("milk")
        ? "milk"
        : normalizedName.includes("serum")
          ? "serum"
          : normalizedName.includes("cream")
            ? "cream"
            : "lotion"

  const providesHeatProtection =
    normalizedName.includes("protect") ||
    normalizedName.includes("hitz") ||
    normalizedName.includes("10-in-1") ||
    normalizedName.includes("7in1") ||
    normalizedName.includes("5-in-1")

  const heatActivationRequired =
    normalizedName.includes("heat activated") ||
    normalizedName.includes("fohn") ||
    normalizedName.includes("blow dry")

  if (providesHeatProtection || heatActivationRequired || inferredFormat === "spray") {
    careBenefits.add("heat_protect")
  }
  if (normalizedName.includes("curl")) {
    careBenefits.add("curl_definition")
  }
  if (
    concerns.has("protein") ||
    normalizedName.includes("repair") ||
    normalizedName.includes("protein") ||
    normalizedName.includes("keratin")
  ) {
    careBenefits.add("repair")
  }
  if (
    concerns.has("feuchtigkeit") ||
    concerns.has("performance") ||
    normalizedName.includes("anti-frizz") ||
    normalizedName.includes("smooth") ||
    normalizedName.includes("shine") ||
    normalizedName.includes("gloss")
  ) {
    careBenefits.add("detangle_smooth")
  }

  return {
    weight,
    conditioner_relationship: normalizedName.includes("conditioner")
      ? "replacement_capable"
      : "booster_only",
    care_benefits: Array.from(careBenefits),
  }
}

function inferMaskSpecs(
  product: ProductInput,
): Omit<ProductMaskSpecs, "product_id" | "created_at" | "updated_at"> {
  const existing = product.mask_specs
  const normalizedName = product.name.toLowerCase()
  const concerns = new Set(product.suitable_concerns ?? [])
  const textures = new Set(product.suitable_thicknesses ?? [])

  if (existing) {
    const weight = MASK_WEIGHT_SET.has(existing.weight ?? "") ? existing.weight : "medium"
    const concentration = MASK_CONCENTRATION_SET.has(existing.concentration)
      ? existing.concentration
      : "low"
    const rawBenefits = existing.benefits ?? []
    const balance_direction =
      existing.balance_direction === "protein" ||
      existing.balance_direction === "moisture" ||
      existing.balance_direction === "balanced"
        ? existing.balance_direction
        : rawBenefits.includes("protein") || rawBenefits.includes("repair")
          ? "protein"
          : rawBenefits.includes("moisture")
            ? "moisture"
            : "balanced"

    return {
      weight,
      concentration,
      balance_direction,
    }
  }

  const weight =
    textures.size === 1 && textures.has("fine")
      ? "light"
      : textures.size === 1 && textures.has("coarse")
        ? "rich"
        : "medium"

  const concentration =
    normalizedName.includes("repair") ||
    normalizedName.includes("plex") ||
    normalizedName.includes("protein") ||
    normalizedName.includes("keratin")
      ? "high"
      : concerns.has("protein")
        ? "medium"
        : "low"

  const balance_direction =
    concerns.has("protein") ||
    normalizedName.includes("repair") ||
    normalizedName.includes("plex") ||
    normalizedName.includes("protein") ||
    normalizedName.includes("keratin")
      ? "protein"
      : concerns.has("feuchtigkeit") ||
          normalizedName.includes("moisture") ||
          normalizedName.includes("hydra") ||
          normalizedName.includes("hyaluron") ||
          normalizedName.includes("aloe")
        ? "moisture"
        : "balanced"

  return {
    weight,
    concentration,
    balance_direction,
  }
}

function generateDescription(product: ProductInput): string {
  const hairTypes = (product.suitable_thicknesses || [])
    .map((t) => TEXTURE_ADJECTIVES[t] || t)
    .join(", ")
  const hair = hairTypes || "alle Haartypen"

  const concerns = (product.suitable_concerns || []).map((c) => CONCERN_LABELS[c] || c).join(", ")
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
        fs.readFileSync(path.join(excelJsonDir, file), "utf-8"),
      )
      products.push(...excelProducts)
    }
  }

  if (products.length === 0) {
    console.error(
      "Error: No product data found in data/products.csv, data/products.json, or data/products-from-excel/",
    )
    process.exit(1)
  }

  products = products.map((product, index) => normalizeProductInput(product, index))

  const requestedNames = parseProductNamesFilter(process.env.PRODUCT_NAMES)
  if (requestedNames) {
    products = products.filter((product) => requestedNames.has(product.name))
    console.log(`Filtered to ${products.length} products via PRODUCT_NAMES`)
  }

  if (products.length === 0) {
    console.error("Error: No products left after filtering.")
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
    const { data: upsertedProduct, error } = await supabase
      .from("products")
      .upsert(
        {
          name: product.name,
          brand: product.brand || null,
          description,
          category: product.category || null,
          affiliate_link: product.affiliate_link || null,
          image_url: product.image_url || null,
          price_eur: product.price_eur || null,
          tags: product.tags || [],
          suitable_thicknesses: product.suitable_thicknesses || [],
          suitable_concerns: product.suitable_concerns || [],
          is_active: product.is_active ?? true,
          sort_order: product.sort_order ?? i,
          embedding: JSON.stringify(embedding),
        },
        { onConflict: "name,category" },
      )
      .select("id, category")
      .single()

    if (error) {
      console.error(`  Error upserting ${product.name}:`, error.message)
      continue
    }

    if (upsertedProduct && isShampooCategory(upsertedProduct.category || product.category)) {
      try {
        await replaceCanonicalShampooPairs(upsertedProduct.id, product)
      } catch (shampooError) {
        const message = shampooError instanceof Error ? shampooError.message : String(shampooError)
        console.error(`  Error syncing shampoo pairs for ${product.name}:`, message)
        throw shampooError
      }
    }

    if (upsertedProduct && isLeaveInCategory(upsertedProduct.category || product.category)) {
      const leaveInSpecs = inferLeaveInSpecs(product)
      const { error: leaveInError } = await supabase.from("product_leave_in_fit_specs").upsert({
        product_id: upsertedProduct.id,
        ...leaveInSpecs,
      })

      if (leaveInError) {
        console.error(`  Error upserting leave-in specs for ${product.name}:`, leaveInError.message)
      } else {
        const { error: legacyDeleteError } = await supabase
          .from("product_leave_in_specs")
          .delete()
          .eq("product_id", upsertedProduct.id)

        if (legacyDeleteError) {
          console.error(
            `  Error deleting legacy leave-in specs for ${product.name}:`,
            legacyDeleteError.message,
          )
        }
      }
    }

    if (upsertedProduct && isMaskCategory(upsertedProduct.category || product.category)) {
      const maskSpecs = inferMaskSpecs(product)
      const { error: maskError } = await supabase.from("product_mask_specs").upsert({
        product_id: upsertedProduct.id,
        ...maskSpecs,
      })

      if (maskError) {
        console.error(`  Error upserting mask specs for ${product.name}:`, maskError.message)
      }
    }
  }

  console.log("\nDone! Product ingestion complete.")
}

main().catch(console.error)
