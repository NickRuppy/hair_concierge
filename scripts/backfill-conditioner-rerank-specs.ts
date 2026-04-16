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

type ConditionerWeight = "light" | "medium" | "rich"
type ConditionerRepairLevel = "low" | "medium" | "high"
type ProductBalanceDirection = "protein" | "moisture" | "balanced"

type ConditionerBackfillSpec = {
  weight: ConditionerWeight
  repair_level: ConditionerRepairLevel
}

const CONDITIONER_BACKFILL_BY_NAME: Record<string, ConditionerBackfillSpec> = {
  "Alverde Glanz": { weight: "light", repair_level: "low" },
  "Balea Aqua Hyaluron": { weight: "light", repair_level: "low" },
  "Balea Natural Beauty Hibiskus": { weight: "light", repair_level: "low" },
  "Balea Oil Repair": { weight: "rich", repair_level: "high" },
  "Balea Ultra Med Sensitive": { weight: "light", repair_level: "low" },
  "Bali Curls Moisturising (Kokos)": { weight: "rich", repair_level: "medium" },
  "Cantu Conditioner Cream (Kokos)": { weight: "rich", repair_level: "medium" },
  "Cantu Repair Cream (Kokos)": { weight: "rich", repair_level: "high" },
  "Dejan Garz The Foundation (Silikone)": { weight: "rich", repair_level: "medium" },
  "Elvital Fiber Booster (Silikone)": { weight: "medium", repair_level: "medium" },
  "Garnier Hair Food Macadamia (Kokos)": { weight: "medium", repair_level: "low" },
  "Garnier Wahre Schätze Aloe Vera Spülung": { weight: "light", repair_level: "low" },
  "Gliss Kur Aqua Revive (Silikone)": { weight: "light", repair_level: "low" },
  "Gliss Ultimate Repair Spülung (Silikone)": { weight: "medium", repair_level: "high" },
  "Guhl Bond+ (Silikone)": { weight: "medium", repair_level: "high" },
  "Guhl Panthenol*": { weight: "medium", repair_level: "high" },
  "Hair Biology Full & Shining": { weight: "light", repair_level: "medium" },
  "Hask Curl Care": { weight: "rich", repair_level: "medium" },
  "Hask Repairing Argan Oil (Kokos)": { weight: "rich", repair_level: "medium" },
  "Herbal Essences Aloe Vera (Silikone)": { weight: "medium", repair_level: "low" },
  "Isana Professional Argan": { weight: "rich", repair_level: "medium" },
  "Jean&Len Repair Keratin/Mandel": { weight: "light", repair_level: "medium" },
  "Langhaarmädchen Beautiful Curls": { weight: "medium", repair_level: "low" },
  "Langhaarmädchen Lovely Long": { weight: "medium", repair_level: "medium" },
  "Monday Moisture (Silikone / Kokos)": { weight: "rich", repair_level: "low" },
  "Neqi Moisture Mystery (Silikone)": { weight: "medium", repair_level: "medium" },
  "Neqi Repair Reveal  (Silikone)": { weight: "medium", repair_level: "high" },
  "Neqi Volume Victory (Silikone)": { weight: "light", repair_level: "low" },
  "Nivea Repair": { weight: "medium", repair_level: "medium" },
  "Nivea Volumen & Kraft": { weight: "light", repair_level: "low" },
  "OGX Biotin & Collagen (Silikone)": { weight: "light", repair_level: "low" },
  "OGX Keratin & Protein (Silikone)": { weight: "rich", repair_level: "high" },
  "OGX Renewing (Silikone / Kokos)": { weight: "rich", repair_level: "medium" },
  "OGX Renewing Argan Oil (Silikone /Kokos)": { weight: "rich", repair_level: "medium" },
  "Pantene Hydra Glow (Silikone)": { weight: "medium", repair_level: "medium" },
  "Pantene Miracles Bond Repair (Silikone)": { weight: "medium", repair_level: "high" },
  "Pomelo Molecular Repair (Silikone)": { weight: "medium", repair_level: "high" },
  "Pomélo+Co Shine Therapy Conditioner": { weight: "rich", repair_level: "medium" },
  "SANTE Deep Repair Conditioner (Kokos)": { weight: "rich", repair_level: "high" },
  "Sante Intense Hydrating Conditioner": { weight: "medium", repair_level: "low" },
  "Syoss Intense Curls (Silikone)": { weight: "medium", repair_level: "medium" },
  "Syoss Intense Keratin (Silikone)": { weight: "medium", repair_level: "high" },
  "Wahre Schätze Argan-Mandelcreme (Silikone)": { weight: "rich", repair_level: "medium" },
}

function deriveBalanceDirection(suitableConcerns: string[]): ProductBalanceDirection {
  const [primaryConcern] = suitableConcerns
  switch (primaryConcern) {
    case "protein":
      return "protein"
    case "feuchtigkeit":
      return "moisture"
    case "performance":
      return "balanced"
    default:
      throw new Error(`Unsupported conditioner concern "${primaryConcern}" for balance mapping`)
  }
}

async function fetchConditioners() {
  const allRows: Array<{
    id: string
    name: string
    brand: string | null
    suitable_concerns: string[]
    suitable_thicknesses: string[]
  }> = []

  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,brand,suitable_concerns,suitable_thicknesses")
      .eq("category", "Conditioner (Drogerie)")
      .range(from, from + pageSize - 1)
      .order("name")

    if (error) throw error

    allRows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

async function hasBalanceDirectionColumn() {
  const { error } = await supabase
    .from("product_conditioner_rerank_specs")
    .select("balance_direction")
    .limit(1)

  if (!error) return true
  if (error.code === "42703") return false
  throw error
}

async function main() {
  const conditioners = await fetchConditioners()
  const mappedNames = new Set(Object.keys(CONDITIONER_BACKFILL_BY_NAME))

  const missingMappings = conditioners
    .filter((product) => !CONDITIONER_BACKFILL_BY_NAME[product.name])
    .map((product) => product.name)

  const extraMappings = [...mappedNames].filter(
    (name) => !conditioners.some((product) => product.name === name),
  )

  if (missingMappings.length > 0 || extraMappings.length > 0) {
    throw new Error(
      [
        missingMappings.length > 0 ? `Missing DB mappings: ${missingMappings.join(", ")}` : null,
        extraMappings.length > 0
          ? `Missing catalog products for mappings: ${extraMappings.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
  }

  const rows = conditioners.map((product) => {
    if (product.suitable_concerns.length !== 1) {
      throw new Error(
        `${product.name} expected exactly one suitable_concern, got ${product.suitable_concerns.join(", ")}`,
      )
    }

    return {
      product_id: product.id,
      product_name: product.name,
      balance_direction: deriveBalanceDirection(product.suitable_concerns),
      ...CONDITIONER_BACKFILL_BY_NAME[product.name],
    }
  })

  console.log("Final conditioner backfill table:")
  console.table(
    rows.map(({ product_name, balance_direction, weight, repair_level }) => ({
      product_name,
      balance_direction,
      weight,
      repair_level,
    })),
  )

  const includeBalanceDirection = await hasBalanceDirectionColumn()

  const payload = includeBalanceDirection
    ? rows.map(({ product_id, weight, repair_level, balance_direction }) => ({
        product_id,
        weight,
        repair_level,
        balance_direction,
      }))
    : rows.map(({ product_id, weight, repair_level }) => ({
        product_id,
        weight,
        repair_level,
      }))

  const { error } = await supabase
    .from("product_conditioner_rerank_specs")
    .upsert(payload, { onConflict: "product_id" })

  if (error) throw error

  console.log(
    includeBalanceDirection
      ? `Upserted ${rows.length} conditioner spec rows with balance_direction.`
      : `Upserted ${rows.length} conditioner spec rows without balance_direction because the remote column does not exist yet.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
