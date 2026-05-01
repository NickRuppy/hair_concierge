import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

loadEnv({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const SEED_TAG = "temporary-deep-cleansing-seed"
const CATEGORY = "Tiefenreinigungsshampoo"

const SEED_PRODUCTS = [
  {
    name: "Sanfter Reset Shampoo",
    brand: "Hair Concierge",
    description:
      "Temporaeres Testprodukt fuer einen sanften Tiefenreinigungs-Reset bei allgemeinem Produktaufbau.",
    short_description: "Sanfter Reset fuer gelegentliche Tiefenreinigung.",
    price_eur: 8.9,
    sort_order: 9101,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "gentle",
      reset_focus: "general_buildup",
      color_treated_suitability: "suitable",
    },
  },
  {
    name: "Klarer Aufbau-Reset Shampoo",
    brand: "Hair Concierge",
    description:
      "Temporaeres Testprodukt fuer staerkeren Reset bei fettigem Ansatz und Styling- oder Pflegeaufbau.",
    short_description: "Staerkerer Aufbau-Reset fuer Produktueberladung.",
    price_eur: 9.9,
    sort_order: 9102,
    specs: {
      scalp_type_focus: "oily",
      reset_intensity: "strong",
      reset_focus: "general_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    name: "Mineral & Styling Reset Shampoo",
    brand: "Hair Concierge",
    description:
      "Temporaeres Testprodukt fuer breiteren Reset bei Stylingaufbau sowie Kalk-, Chlor- oder Mineral-Kontext.",
    short_description: "Breiter Reset fuer Styling, Kalk und Chlor-Kontext.",
    price_eur: 10.9,
    sort_order: 9103,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum",
      color_treated_suitability: "suitable",
    },
  },
] as const

type SeedProductRow = {
  id: string
  name: string
  tags: string[] | null
}

async function upsertProduct(seed: (typeof SEED_PRODUCTS)[number]): Promise<SeedProductRow> {
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id,name,tags")
    .eq("name", seed.name)
    .eq("brand", seed.brand)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    name: seed.name,
    brand: seed.brand,
    description: seed.description,
    short_description: seed.short_description,
    category: CATEGORY,
    affiliate_link: null,
    image_url: null,
    price_eur: seed.price_eur,
    currency: "EUR",
    tags: Array.from(new Set([...(existing?.tags ?? []), SEED_TAG])),
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["healthy_scalp"],
    is_active: true,
    sort_order: seed.sort_order,
  }

  if (existing) {
    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", existing.id)
      .select("id,name,tags")
      .single()

    if (error) throw error
    return data as SeedProductRow
  }

  const { data, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id,name,tags")
    .single()

  if (error) throw error
  return data as SeedProductRow
}

async function warnAboutMissingSpecs() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,product_deep_cleansing_shampoo_specs(product_id)")
    .eq("is_active", true)
    .in("category", [CATEGORY, "Deep Cleansing Shampoo", "deep_cleansing_shampoo"])

  if (error) throw error

  const missing = (data ?? []).filter((row) => {
    const specs = row.product_deep_cleansing_shampoo_specs as unknown[] | null
    return !specs || specs.length === 0
  })

  if (missing.length > 0) {
    console.warn("Active deep-cleansing products missing specs:")
    for (const row of missing) {
      console.warn(`- ${row.name} (${row.id})`)
    }
  }
}

async function main() {
  const seeded: SeedProductRow[] = []

  for (const seed of SEED_PRODUCTS) {
    const product = await upsertProduct(seed)
    seeded.push(product)

    const { error } = await supabase.from("product_deep_cleansing_shampoo_specs").upsert(
      {
        product_id: product.id,
        ...seed.specs,
      },
      { onConflict: "product_id" },
    )

    if (error) throw error
  }

  await warnAboutMissingSpecs()

  console.log(`Seeded ${seeded.length} temporary deep-cleansing products.`)
  for (const product of seeded) {
    console.log(`- ${product.name} (${product.id})`)
  }
  console.log(
    `Cleanup: delete from product_deep_cleansing_shampoo_specs where product_id in (select id from products where tags @> array['${SEED_TAG}']);`,
  )
  console.log(`Cleanup: delete from products where tags @> array['${SEED_TAG}'];`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
