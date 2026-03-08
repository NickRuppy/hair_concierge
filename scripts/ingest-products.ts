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
  LEAVE_IN_FORMATS,
  LEAVE_IN_WEIGHTS,
  LEAVE_IN_ROLES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_APPLICATION_STAGES,
  type ProductLeaveInSpecs,
} from "../src/lib/leave-in/constants"
import {
  MASK_FORMATS,
  MASK_WEIGHTS,
  MASK_CONCENTRATIONS,
  MASK_BENEFITS,
  MASK_INGREDIENT_FLAGS,
  isMaskCategory,
  type ProductMaskSpecs,
} from "../src/lib/mask/constants"

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
  suitable_concerns?: string[]
  is_active?: boolean
  sort_order?: number
  leave_in_specs?: Omit<ProductLeaveInSpecs, "product_id" | "created_at" | "updated_at">
  mask_specs?: Omit<ProductMaskSpecs, "product_id" | "created_at" | "updated_at">
}

const LEAVE_IN_FORMAT_SET = new Set<string>(LEAVE_IN_FORMATS)
const LEAVE_IN_WEIGHT_SET = new Set<string>(LEAVE_IN_WEIGHTS)
const LEAVE_IN_ROLE_SET = new Set<string>(LEAVE_IN_ROLES)
const LEAVE_IN_CARE_SET = new Set<string>(LEAVE_IN_CARE_BENEFITS)
const LEAVE_IN_INGREDIENT_SET = new Set<string>(LEAVE_IN_INGREDIENT_FLAGS)
const LEAVE_IN_STAGE_SET = new Set<string>(LEAVE_IN_APPLICATION_STAGES)
const MASK_FORMAT_SET = new Set<string>(MASK_FORMATS)
const MASK_WEIGHT_SET = new Set<string>(MASK_WEIGHTS)
const MASK_CONCENTRATION_SET = new Set<string>(MASK_CONCENTRATIONS)
const MASK_BENEFIT_SET = new Set<string>(MASK_BENEFITS)
const MASK_INGREDIENT_SET = new Set<string>(MASK_INGREDIENT_FLAGS)

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
      suitable_thicknesses: obj.suitable_thicknesses
        ? obj.suitable_thicknesses.split(";").map((t) => t.trim()).filter(Boolean)
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

function isLeaveInCategory(category?: string): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "leave-in" || normalized === "leave_in" || normalized === "leave in"
}

function asUniqueAllowed(values: string[] | undefined, allowedSet: Set<string>): string[] {
  if (!values) return []
  return [...new Set(values.filter((value) => allowedSet.has(value)))]
}

function inferLeaveInSpecs(product: ProductInput): Omit<ProductLeaveInSpecs, "product_id" | "created_at" | "updated_at"> {
  const existing = product.leave_in_specs
  if (existing) {
    const format = LEAVE_IN_FORMAT_SET.has(existing.format) ? existing.format : "spray"
    const weight = LEAVE_IN_WEIGHT_SET.has(existing.weight) ? existing.weight : "medium"
    const roles = asUniqueAllowed(existing.roles, LEAVE_IN_ROLE_SET)
    const care_benefits = asUniqueAllowed(existing.care_benefits, LEAVE_IN_CARE_SET)
    const ingredient_flags = asUniqueAllowed(existing.ingredient_flags, LEAVE_IN_INGREDIENT_SET)
    const application_stage = asUniqueAllowed(existing.application_stage, LEAVE_IN_STAGE_SET)
    const heat_activation_required = Boolean(existing.heat_activation_required)

    return {
      format,
      weight,
      roles: heat_activation_required && !roles.includes("styling_prep")
        ? [...roles, "styling_prep"]
        : roles,
      provides_heat_protection: Boolean(existing.provides_heat_protection),
      heat_protection_max_c: existing.provides_heat_protection
        ? existing.heat_protection_max_c ?? null
        : null,
      heat_activation_required,
      care_benefits,
      ingredient_flags,
      application_stage: application_stage.length > 0 ? application_stage : ["towel_dry"],
    }
  }

  const normalizedName = product.name.toLowerCase()
  const textures = new Set(product.suitable_thicknesses ?? [])
  const concerns = new Set(product.suitable_concerns ?? [])

  const format =
    normalizedName.includes("spray") || normalizedName.includes("mist")
      ? "spray"
      : normalizedName.includes("milk")
        ? "milk"
        : normalizedName.includes("serum")
          ? "serum"
          : normalizedName.includes("cream")
            ? "cream"
            : "lotion"

  const weight =
    textures.size === 1 && textures.has("fine")
      ? "light"
      : textures.size === 1 && textures.has("coarse")
        ? "rich"
        : "medium"

  const roles: string[] = []
  if (normalizedName.includes("conditioner")) {
    roles.push("replacement_conditioner", "extension_conditioner")
  } else {
    roles.push("extension_conditioner")
  }
  if (normalizedName.includes("oil")) {
    roles.push("oil_replacement")
  }
  if (format === "spray" || normalizedName.includes("style") || normalizedName.includes("10-in-1")) {
    roles.push("styling_prep")
  }

  const care_benefits: string[] = []
  if (concerns.has("protein")) care_benefits.push("protein", "repair")
  if (concerns.has("feuchtigkeit")) care_benefits.push("moisture", "detangling")
  if (concerns.has("performance")) care_benefits.push("anti_frizz", "shine")
  if (normalizedName.includes("curl")) care_benefits.push("curl_definition")
  if (normalizedName.includes("volume")) care_benefits.push("volume")

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

  const ingredientFlags: string[] = []
  if (normalizedName.includes("silikone") || normalizedName.includes("silicone")) {
    ingredientFlags.push("silicones")
  }
  if (normalizedName.includes("protein") || concerns.has("protein")) {
    ingredientFlags.push("proteins")
  }
  if (normalizedName.includes("oil") || normalizedName.includes("kokos")) {
    ingredientFlags.push("oils")
  }
  if (normalizedName.includes("hyaluron") || concerns.has("feuchtigkeit")) {
    ingredientFlags.push("humectants")
  }

  const dedupRoles = [...new Set(roles)].filter((role) => LEAVE_IN_ROLE_SET.has(role))
  const dedupCare = [...new Set(care_benefits)].filter((benefit) => LEAVE_IN_CARE_SET.has(benefit))
  const dedupIngredients = [...new Set(ingredientFlags)].filter((flag) => LEAVE_IN_INGREDIENT_SET.has(flag))
  const application_stage = providesHeatProtection
    ? ["towel_dry", "pre_heat"]
    : ["towel_dry"]

  return {
    format,
    weight,
    roles: heatActivationRequired && !dedupRoles.includes("styling_prep")
      ? [...dedupRoles, "styling_prep"]
      : dedupRoles,
    provides_heat_protection: providesHeatProtection,
    heat_protection_max_c: null,
    heat_activation_required: heatActivationRequired,
    care_benefits: dedupCare,
    ingredient_flags: dedupIngredients,
    application_stage,
  }
}

function inferMaskSpecs(product: ProductInput): Omit<ProductMaskSpecs, "product_id" | "created_at" | "updated_at"> {
  const existing = product.mask_specs
  if (existing) {
    const format = MASK_FORMAT_SET.has(existing.format) ? existing.format : "lotion"
    const weight = MASK_WEIGHT_SET.has(existing.weight) ? existing.weight : "medium"
    const concentration = MASK_CONCENTRATION_SET.has(existing.concentration)
      ? existing.concentration
      : "low"
    const benefits = asUniqueAllowed(existing.benefits, MASK_BENEFIT_SET)
    const ingredient_flags = asUniqueAllowed(existing.ingredient_flags, MASK_INGREDIENT_SET)

    return {
      format,
      weight,
      concentration,
      benefits,
      ingredient_flags,
      apply_on_scalp_allowed: Boolean(existing.apply_on_scalp_allowed),
      leave_on_minutes: Math.max(1, Math.min(60, existing.leave_on_minutes ?? 10)),
      max_uses_per_week: Math.max(1, Math.min(3, existing.max_uses_per_week ?? 1)),
      dose_fine_ml: existing.dose_fine_ml ?? null,
      dose_normal_ml: existing.dose_normal_ml ?? null,
      dose_coarse_ml: existing.dose_coarse_ml ?? null,
    }
  }

  const normalizedName = product.name.toLowerCase()
  const concerns = new Set(product.suitable_concerns ?? [])
  const textures = new Set(product.suitable_thicknesses ?? [])

  const format =
    normalizedName.includes("gel")
      ? "gel"
      : normalizedName.includes("butter")
        ? "butter"
        : normalizedName.includes("cream")
          ? "cream"
          : "lotion"

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

  const benefits: string[] = []
  if (concerns.has("protein")) benefits.push("protein", "repair")
  if (concerns.has("feuchtigkeit")) benefits.push("moisture", "detangling")
  if (concerns.has("performance")) benefits.push("anti_frizz", "shine", "elasticity")

  const ingredientFlags: string[] = []
  if (normalizedName.includes("oil") || normalizedName.includes("argan") || normalizedName.includes("kokos")) {
    ingredientFlags.push("oils")
  }
  if (normalizedName.includes("butter")) {
    ingredientFlags.push("butters")
  }
  if (normalizedName.includes("protein") || normalizedName.includes("keratin")) {
    ingredientFlags.push("proteins")
  }
  if (normalizedName.includes("hyaluron") || concerns.has("feuchtigkeit")) {
    ingredientFlags.push("humectants")
  }
  if (normalizedName.includes("silikone") || normalizedName.includes("silicone")) {
    ingredientFlags.push("silicones")
  }
  if (normalizedName.includes("acid") || normalizedName.includes("saeure")) {
    ingredientFlags.push("acids")
  }

  const dedupBenefits = [...new Set(benefits)].filter((benefit) => MASK_BENEFIT_SET.has(benefit))
  const dedupIngredients = [...new Set(ingredientFlags)].filter((flag) => MASK_INGREDIENT_SET.has(flag))

  return {
    format,
    weight,
    concentration,
    benefits: dedupBenefits,
    ingredient_flags: dedupIngredients,
    apply_on_scalp_allowed: false,
    leave_on_minutes: 10,
    max_uses_per_week: 1,
    dose_fine_ml: 3,
    dose_normal_ml: 6,
    dose_coarse_ml: 10,
  }
}

function generateDescription(product: ProductInput): string {
  const hairTypes = (product.suitable_thicknesses || [])
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
    const { data: upsertedProduct, error } = await supabase.from("products").upsert(
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
      { onConflict: "name" }
    )
      .select("id, category")
      .single()

    if (error) {
      console.error(`  Error upserting ${product.name}:`, error.message)
      continue
    }

    if (upsertedProduct && isLeaveInCategory(upsertedProduct.category || product.category)) {
      const leaveInSpecs = inferLeaveInSpecs(product)
      const { error: leaveInError } = await supabase
        .from("product_leave_in_specs")
        .upsert({
          product_id: upsertedProduct.id,
          ...leaveInSpecs,
        })

      if (leaveInError) {
        console.error(`  Error upserting leave-in specs for ${product.name}:`, leaveInError.message)
      }
    }

    if (upsertedProduct && isMaskCategory(upsertedProduct.category || product.category)) {
      const maskSpecs = inferMaskSpecs(product)
      const { error: maskError } = await supabase
        .from("product_mask_specs")
        .upsert({
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
