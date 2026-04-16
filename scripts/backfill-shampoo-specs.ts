import { config as loadEnv } from "dotenv"
import { writeFile } from "node:fs/promises"
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

type ShampooBucket = "schuppen" | "irritationen" | "normal" | "dehydriert-fettig" | "trocken"
type ShampooScalpRoute = "oily" | "balanced" | "dry" | "dandruff" | "dry_flakes" | "irritated"
type CleansingIntensity = "gentle" | "regular" | "clarifying"

type ShampooProductRow = {
  id: string
  name: string
  category: string | null
}

type ShampooSpecRow = {
  product_id: string
  thickness: "fine" | "normal" | "coarse"
  shampoo_bucket: ShampooBucket
}

type ShampooExportRow = {
  product_id: string
  product_name: string
  scalp_routes: ShampooScalpRoute[]
  shampoo_buckets: ShampooBucket[]
  cleansing_intensity: CleansingIntensity
}

const SHAMPOO_CLEANSING_INTENSITY_BY_NAME: Record<string, CleansingIntensity> = {
  "Balea 2 in 1 Urea 5%": "gentle",
  "Balea Aqua Hyaluron": "gentle",
  "Balea Kopfhaut Sensitive Shampoo": "gentle",
  "Balea Med Anti Schuppen": "regular",
  "Balea Professional Ultra Volume": "regular",
  "Balea Tiefenreinigung": "clarifying",
  "Balea Ultra Sensitive": "gentle",
  "Cantu Lockenshampoo": "gentle",
  "Dejan Garz Shampoo": "regular",
  "Guhl Anti Schuppen": "regular",
  "Guhl Frische und Leichtigkeit": "regular",
  "Guhl Hyaluron+": "gentle",
  "Guhl Kopfhaut Sensitive": "gentle",
  "Guhl Kraft & Fülle": "regular",
  "Hair Biology Revitalize & Soothe": "gentle",
  "Hask Curl Care Shampoo": "gentle",
  "Hask Shampoo Argan Oil": "gentle",
  "Head & Shoulders Anti Schuppen Sensitive": "regular",
  "Head & Shoulders Derma X 0%": "gentle",
  "Head & Shoulders Derma X Aloe": "gentle",
  "Head & Shoulders Derma X Pro Beruhigend": "regular",
  "Head & Shoulders Derma X Pro Sensitive": "gentle",
  "Langhaarmädchen Beautiful Curls Shampoo": "gentle",
  "Langhaarmädchen Lovely Long": "regular",
  "Lavera Basis Sensitiv": "gentle",
  "Monday Volume": "regular",
  "Neqi Moisture Mystery": "gentle",
  "Neqi Volume Victory": "regular",
  "Nivea Shampoo&Conditioner 2in1": "regular",
  "OGX Biotin & Collagen": "regular",
  "OGX Keratin Oil": "gentle",
  "OGX Renewing": "gentle",
  "OGX Rosemary": "clarifying",
  "Pantene Anti Schuppen": "regular",
  "Pantene Grow Abundance": "regular",
  "Pantene Hydra Glow Shampoo": "gentle",
  "Pantene Volume Pur": "regular",
  "Salthouse Anti Fett": "clarifying",
  "Salthouse Anti Juckreiz": "gentle",
  "Salthouse Anti Schuppen": "regular",
  "Sante Glossy Shine": "regular",
  "Sante Sensitive Care": "gentle",
  "Schauma Anti Schuppen": "regular",
  "Sebamed Anti Schuppen": "regular",
  "Sebamed Anti Schuppen Plus": "regular",
  "Sebamed Everyday": "gentle",
  "Sebamed Urea 5%": "gentle",
  "Swiss-O-Par Teebaumöl": "regular",
  "Syoss Intense Curls": "gentle",
  "Wahre Schätze Aktivkohle": "clarifying",
  "Wahre Schätze Sanfte Hafermilch": "gentle",
}

function mapBucketToScalpRoute(bucket: ShampooBucket): ShampooScalpRoute {
  switch (bucket) {
    case "dehydriert-fettig":
      return "oily"
    case "normal":
      return "balanced"
    case "trocken":
      return "dry"
    case "schuppen":
      return "dandruff"
    case "irritationen":
      return "irritated"
  }
}

async function fetchShampooProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category")
    .in("category", ["Shampoo", "Shampoo Profi"])
    .order("name")

  if (error) throw error
  return (data ?? []) as ShampooProductRow[]
}

async function fetchShampooSpecs() {
  const { data, error } = await supabase
    .from("product_shampoo_specs")
    .select("product_id,thickness,shampoo_bucket")
    .order("product_id")

  if (error) throw error
  return (data ?? []) as ShampooSpecRow[]
}

async function main() {
  const [products, specs] = await Promise.all([fetchShampooProducts(), fetchShampooSpecs()])

  const productById = new Map(products.map((product) => [product.id, product]))
  const mappedNames = new Set(Object.keys(SHAMPOO_CLEANSING_INTENSITY_BY_NAME))

  const missingMappings = products
    .filter((product) => !SHAMPOO_CLEANSING_INTENSITY_BY_NAME[product.name])
    .map((product) => product.name)

  const extraMappings = [...mappedNames].filter(
    (name) => !products.some((product) => product.name === name),
  )

  const productsWithoutSpecs = products
    .filter((product) => !specs.some((spec) => spec.product_id === product.id))
    .map((product) => product.name)

  if (missingMappings.length > 0 || extraMappings.length > 0 || productsWithoutSpecs.length > 0) {
    throw new Error(
      [
        missingMappings.length > 0
          ? `Missing shampoo mappings: ${missingMappings.join(", ")}`
          : null,
        extraMappings.length > 0 ? `Extra shampoo mappings: ${extraMappings.join(", ")}` : null,
        productsWithoutSpecs.length > 0
          ? `Products missing shampoo specs: ${productsWithoutSpecs.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
  }

  const payload = specs.map((spec) => {
    const product = productById.get(spec.product_id)
    if (!product) {
      throw new Error(`Missing product for shampoo spec row ${spec.product_id}`)
    }

    return {
      product_id: spec.product_id,
      thickness: spec.thickness,
      shampoo_bucket: spec.shampoo_bucket,
      scalp_route: mapBucketToScalpRoute(spec.shampoo_bucket),
      cleansing_intensity: SHAMPOO_CLEANSING_INTENSITY_BY_NAME[product.name],
      product_name: product.name,
    }
  })

  const exportRows: ShampooExportRow[] = products.map((product) => {
    const productSpecs = payload.filter((row) => row.product_id === product.id)
    const scalp_routes = [...new Set(productSpecs.map((row) => row.scalp_route))]
    const shampoo_buckets = [...new Set(productSpecs.map((row) => row.shampoo_bucket))]

    return {
      product_id: product.id,
      product_name: product.name,
      scalp_routes,
      shampoo_buckets,
      cleansing_intensity: SHAMPOO_CLEANSING_INTENSITY_BY_NAME[product.name],
    }
  })

  const summary = {
    total_products: exportRows.length,
    total_spec_rows: payload.length,
    cleansing_intensity: exportRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.cleansing_intensity] = (acc[row.cleansing_intensity] ?? 0) + 1
      return acc
    }, {}),
    scalp_routes: exportRows.reduce<Record<string, number>>((acc, row) => {
      for (const route of row.scalp_routes) {
        acc[route] = (acc[route] ?? 0) + 1
      }
      return acc
    }, {}),
    multi_route_products: exportRows
      .filter((row) => row.scalp_routes.length > 1)
      .map((row) => row.product_name),
  }

  const markdown = [
    "# Shampoo V1 Canonical Specs",
    "",
    "Product-side dry flakes stay merged into the dry route.",
    "",
    "| Product | scalp_routes | shampoo_buckets | cleansing_intensity |",
    "|---|---|---|---|",
    ...exportRows.map(
      (row) =>
        `| ${row.product_name} | ${row.scalp_routes.join(", ")} | ${row.shampoo_buckets.join(", ")} | ${row.cleansing_intensity} |`,
    ),
    "",
  ].join("\n")

  await writeFile(
    "data/research/shampoo-v1-canonical-specs.json",
    JSON.stringify(exportRows, null, 2),
  )
  await writeFile(
    "data/research/shampoo-v1-canonical-specs-summary.json",
    JSON.stringify(summary, null, 2),
  )
  await writeFile("data/research/shampoo-v1-canonical-specs.md", markdown)

  const { error: upsertError } = await supabase.from("product_shampoo_specs").upsert(
    payload.map(({ product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity }) => ({
      product_id,
      thickness,
      shampoo_bucket,
      scalp_route,
      cleansing_intensity,
    })),
    { onConflict: "product_id,thickness,shampoo_bucket" },
  )

  if (upsertError) throw upsertError

  console.log(`Upserted ${payload.length} shampoo spec rows.`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
