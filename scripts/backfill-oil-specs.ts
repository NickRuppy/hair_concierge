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

type OilSubtype = "natuerliches-oel" | "styling-oel" | "trocken-oel"
type OilPurpose = "pre_wash_oiling" | "styling_finish" | "light_finish"

type OilProductRow = {
  id: string
  name: string
}

type OilEligibilityRow = {
  product_id: string
  thickness: "fine" | "normal" | "coarse"
  oil_subtype: OilSubtype
}

type OilExportRow = {
  product_id: string
  product_name: string
  oil_purpose: OilPurpose
  source_subtypes: OilSubtype[]
}

const OIL_PURPOSE_OVERRIDE_BY_NAME: Partial<Record<string, OilPurpose>> = {
  "Olaplex No.7 Bonding Oil (Silikone)": "styling_finish",
}

function deriveOilPurpose(productName: string, subtypes: OilSubtype[]): OilPurpose {
  const override = OIL_PURPOSE_OVERRIDE_BY_NAME[productName]
  if (override) return override

  if (subtypes.length !== 1) {
    throw new Error(`${productName} expected exactly one oil subtype, got ${subtypes.join(", ")}`)
  }

  switch (subtypes[0]) {
    case "natuerliches-oel":
      return "pre_wash_oiling"
    case "styling-oel":
      return "styling_finish"
    case "trocken-oel":
      return "light_finish"
  }
}

async function fetchOilProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name")
    .eq("category", "Öle")
    .order("name")

  if (error) throw error
  return (data ?? []) as OilProductRow[]
}

async function fetchOilEligibility() {
  const { data, error } = await supabase
    .from("product_oil_eligibility")
    .select("product_id,thickness,oil_subtype")
    .order("product_id")

  if (error) throw error
  return (data ?? []) as OilEligibilityRow[]
}

async function main() {
  const [products, eligibilityRows] = await Promise.all([fetchOilProducts(), fetchOilEligibility()])
  const productById = new Map(products.map((product) => [product.id, product]))

  const productsWithoutEligibility = products
    .filter((product) => !eligibilityRows.some((row) => row.product_id === product.id))
    .map((product) => product.name)

  if (productsWithoutEligibility.length > 0) {
    throw new Error(
      `Products missing oil eligibility rows: ${productsWithoutEligibility.join(", ")}`,
    )
  }

  const exportRows: OilExportRow[] = products.map((product) => {
    const source_subtypes = [
      ...new Set(
        eligibilityRows
          .filter((row) => row.product_id === product.id)
          .map((row) => row.oil_subtype),
      ),
    ]

    return {
      product_id: product.id,
      product_name: product.name,
      oil_purpose: deriveOilPurpose(product.name, source_subtypes),
      source_subtypes,
    }
  })

  const purposeByProductId = new Map(
    exportRows.map((row) => [row.product_id, row.oil_purpose] as const),
  )

  const payload = eligibilityRows.map((row) => {
    const product = productById.get(row.product_id)
    if (!product) {
      throw new Error(`Missing product for oil eligibility row ${row.product_id}`)
    }

    const oil_purpose = purposeByProductId.get(row.product_id)
    if (!oil_purpose) {
      throw new Error(`Missing oil purpose for ${product.name}`)
    }

    return {
      product_id: row.product_id,
      thickness: row.thickness,
      oil_subtype: row.oil_subtype,
      oil_purpose,
    }
  })

  const summary = {
    total_products: exportRows.length,
    total_eligibility_rows: payload.length,
    oil_purpose: exportRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.oil_purpose] = (acc[row.oil_purpose] ?? 0) + 1
      return acc
    }, {}),
    multi_subtype_products: exportRows
      .filter((row) => row.source_subtypes.length > 1)
      .map((row) => row.product_name),
  }

  const markdown = [
    "# Oil V1 Canonical Specs",
    "",
    "| Product | oil_purpose | source_subtypes |",
    "|---|---|---|",
    ...exportRows.map(
      (row) => `| ${row.product_name} | ${row.oil_purpose} | ${row.source_subtypes.join(", ")} |`,
    ),
    "",
  ].join("\n")

  await writeFile("data/research/oil-v1-canonical-specs.json", JSON.stringify(exportRows, null, 2))
  await writeFile(
    "data/research/oil-v1-canonical-specs-summary.json",
    JSON.stringify(summary, null, 2),
  )
  await writeFile("data/research/oil-v1-canonical-specs.md", markdown)

  const { error: upsertError } = await supabase.from("product_oil_eligibility").upsert(payload, {
    onConflict: "product_id,thickness,oil_subtype",
  })

  if (upsertError) throw upsertError

  console.log(`Upserted ${payload.length} oil eligibility rows.`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
