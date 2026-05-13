import { config as loadEnv } from "dotenv"
import { readFile, writeFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { OIL_INGREDIENT_FLAGS, type OilIngredientFlag } from "../src/lib/oil/constants"

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
  "Olaplex No.7 Bonding Oil": "styling_finish",
}

// ingredient_flags per product, derived from the regenerated oil JSON
// (data/products-from-excel/oele.json — parser strips trailing (Silikone)/(Kokos)
// annotations and emits the structured flags here). Products not listed get [].
const OIL_INGREDIENT_FLAGS_BY_NAME: Partial<Record<string, OilIngredientFlag[]>> = {
  "Balea Oil Repair Haaröl": ["silicones"],
  "Balea Traumlocken Öl": ["silicones"],
  "Garnier Fructis Sleek & Stay Öl": ["silicones"],
  "Garnier Fructis Wunderöl": ["silicones"],
  "Garnier Wahre Schätze Curl Revival Öl": ["silicones"],
  "Jean&Len Repair Keratin & Mandel": ["silicones"],
  "L’Oréal Elvital Öl Magique Jojoba": ["silicones"],
  "Maria Nila True Soft Argan Oil": ["silicones"],
  "Neqi Opulent Oil": ["silicones"],
  "OGX Argan Oil": ["silicones"],
  "OGX Argan weightless Öl": ["silicones"],
  "OGX Bond Protein Repair": ["silicones", "oils"],
  "OGX Miracle Coconut Oil": ["silicones", "oils"],
  "Olaplex No.7 Bonding Oil": ["silicones"],
  "Pantene Pro-V 7in1 Spray": ["silicones"],
  "Pantene Pro-V Coconut Oil": ["silicones", "oils"],
  "Pantene Pro-V Keratin Protect Öl": ["silicones", "oils"],
  "Shiseido Fino Oil": ["silicones"],
  "Urban Alchemy Smooth Serum": ["silicones"],
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

  // Validate the manual lookup maps against both the live DB and the
  // parser-emitted JSON. Catches name drift in either direction so the
  // backfill fails fast instead of silently writing [] / falling through
  // to subtype-derivation.
  const knownProductNames = new Set(products.map((product) => product.name))
  const orphanFlagKeys = Object.keys(OIL_INGREDIENT_FLAGS_BY_NAME).filter(
    (name) => !knownProductNames.has(name),
  )
  const orphanOverrideKeys = Object.keys(OIL_PURPOSE_OVERRIDE_BY_NAME).filter(
    (name) => !knownProductNames.has(name),
  )
  if (orphanFlagKeys.length > 0 || orphanOverrideKeys.length > 0) {
    throw new Error(
      [
        orphanFlagKeys.length > 0
          ? `Stale OIL_INGREDIENT_FLAGS_BY_NAME keys (no DB match): ${orphanFlagKeys.join(", ")}`
          : null,
        orphanOverrideKeys.length > 0
          ? `Stale OIL_PURPOSE_OVERRIDE_BY_NAME keys (no DB match): ${orphanOverrideKeys.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
  }

  // Cross-check against parser-emitted JSON: every oil product that the
  // parser flagged with non-empty ingredient_flags must be in the script's
  // map. Catches "Excel updated, parser regenerated, script forgot to sync"
  // so we can't silently overwrite ingredient_flags with [].
  type OilJsonEntry = { name: string; ingredient_flags?: string[] }
  const oilJsonRaw = await readFile("data/products-from-excel/oele.json", "utf8")
  const oilJson = JSON.parse(oilJsonRaw) as OilJsonEntry[]
  const allowedFlags = new Set<string>(OIL_INGREDIENT_FLAGS)
  const expectedFlagBearers = oilJson.filter((entry) => (entry.ingredient_flags ?? []).length > 0)
  const unmappedFlagged = expectedFlagBearers
    .filter((entry) => !(entry.name in OIL_INGREDIENT_FLAGS_BY_NAME))
    .map((entry) => `${entry.name} -> ${(entry.ingredient_flags ?? []).join(",")}`)
  const flagsetMismatches = expectedFlagBearers
    .filter((entry) => entry.name in OIL_INGREDIENT_FLAGS_BY_NAME)
    .filter((entry) => {
      const expected = (entry.ingredient_flags ?? []).slice().sort().join(",")
      const actual = (OIL_INGREDIENT_FLAGS_BY_NAME[entry.name] ?? []).slice().sort().join(",")
      return expected !== actual
    })
    .map(
      (entry) =>
        `${entry.name}: parser=${(entry.ingredient_flags ?? []).join(",")} script=${(OIL_INGREDIENT_FLAGS_BY_NAME[entry.name] ?? []).join(",")}`,
    )
  const invalidParserFlags = expectedFlagBearers.flatMap((entry) =>
    (entry.ingredient_flags ?? [])
      .filter((flag) => !allowedFlags.has(flag))
      .map((flag) => `${entry.name}:${flag}`),
  )
  if (unmappedFlagged.length > 0 || flagsetMismatches.length > 0 || invalidParserFlags.length > 0) {
    throw new Error(
      [
        unmappedFlagged.length > 0
          ? `Parser flagged products missing from OIL_INGREDIENT_FLAGS_BY_NAME: ${unmappedFlagged.join(" | ")}`
          : null,
        flagsetMismatches.length > 0
          ? `Flag set drift between parser JSON and script map: ${flagsetMismatches.join(" | ")}`
          : null,
        invalidParserFlags.length > 0
          ? `Parser emitted flag value not in OIL_INGREDIENT_FLAGS enum: ${invalidParserFlags.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" || "),
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
      ingredient_flags: OIL_INGREDIENT_FLAGS_BY_NAME[product.name] ?? [],
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
    "# Oil V1 Canonical Eligibility",
    "",
    "| Product | oil_purpose | source_subtypes |",
    "|---|---|---|",
    ...exportRows.map(
      (row) => `| ${row.product_name} | ${row.oil_purpose} | ${row.source_subtypes.join(", ")} |`,
    ),
    "",
  ].join("\n")

  await writeFile(
    "data/research/oil-v1-canonical-eligibility.json",
    JSON.stringify(exportRows, null, 2),
  )
  await writeFile(
    "data/research/oil-v1-canonical-eligibility-summary.json",
    JSON.stringify(summary, null, 2),
  )
  await writeFile("data/research/oil-v1-canonical-eligibility.md", markdown)

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
