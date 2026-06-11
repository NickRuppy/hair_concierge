import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"

import type {
  ConditionerIngredientFlag,
  ConditionerRepairLevel,
  ConditionerWeight,
} from "@/lib/conditioner/constants"

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

type ProductBalanceDirection = "protein" | "moisture" | "balanced"

type ConditionerBackfillSpec = {
  weight: ConditionerWeight
  repair_level: ConditionerRepairLevel
  ingredient_flags: ConditionerIngredientFlag[]
}

const CONDITIONER_BACKFILL_BY_NAME: Record<string, ConditionerBackfillSpec> = {
  "Alverde Glanz": { weight: "light", repair_level: "low", ingredient_flags: [] },
  "Balea Aqua Hyaluron": { weight: "light", repair_level: "low", ingredient_flags: [] },
  "Balea Natural Beauty Hibiskus": { weight: "light", repair_level: "low", ingredient_flags: [] },
  "Balea Oil Repair": { weight: "rich", repair_level: "high", ingredient_flags: [] },
  "Balea Ultra Med Sensitive": { weight: "light", repair_level: "low", ingredient_flags: [] },
  "Bali Curls Moisturising": { weight: "rich", repair_level: "medium", ingredient_flags: ["oils"] },
  "Cantu Conditioner Cream": { weight: "rich", repair_level: "medium", ingredient_flags: ["oils"] },
  "Cantu Leave-In Repair Cream": {
    weight: "rich",
    repair_level: "high",
    ingredient_flags: ["oils"],
  },
  "Cantu Repair Cream": { weight: "rich", repair_level: "high", ingredient_flags: ["oils"] },
  "Dejan Garz The Foundation": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
  "Elvital Fiber Booster": {
    weight: "medium",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
  "Garnier Hair Food Macadamia": {
    weight: "medium",
    repair_level: "low",
    ingredient_flags: ["oils"],
  },
  "Garnier Wahre Schätze Aloe Vera Spülung": {
    weight: "light",
    repair_level: "low",
    ingredient_flags: [],
  },
  "Gliss Kur Aqua Revive": {
    weight: "light",
    repair_level: "low",
    ingredient_flags: ["silicones"],
  },
  "Gliss Ultimate Repair Spülung": {
    weight: "medium",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "Guhl Bond+": { weight: "medium", repair_level: "high", ingredient_flags: ["silicones"] },
  "Guhl Bond+ Reparatur Spülung": {
    weight: "medium",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "Guhl Panthenol*": { weight: "medium", repair_level: "high", ingredient_flags: [] },
  "Hair Biology Full & Shining": { weight: "light", repair_level: "medium", ingredient_flags: [] },
  "Hask Curl Care": { weight: "rich", repair_level: "medium", ingredient_flags: [] },
  "Hask Repairing Argan Oil": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["oils"],
  },
  "Herbal Essences Aloe Vera": {
    weight: "medium",
    repair_level: "low",
    ingredient_flags: ["silicones"],
  },
  "Isana Professional Argan": { weight: "rich", repair_level: "medium", ingredient_flags: [] },
  "Jean&Len Repair Keratin/Mandel": {
    weight: "light",
    repair_level: "medium",
    ingredient_flags: [],
  },
  "Langhaarmädchen Beautiful Curls": {
    weight: "medium",
    repair_level: "low",
    ingredient_flags: [],
  },
  "Langhaarmädchen Lovely Long": { weight: "medium", repair_level: "medium", ingredient_flags: [] },
  "Monday Moisture": {
    weight: "rich",
    repair_level: "low",
    ingredient_flags: ["silicones", "oils"],
  },
  "Neqi Moisture Mystery": {
    weight: "medium",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
  "Neqi Repair Reveal": { weight: "medium", repair_level: "high", ingredient_flags: ["silicones"] },
  "Neqi Volume Victory": { weight: "light", repair_level: "low", ingredient_flags: ["silicones"] },
  "Nivea Repair": { weight: "medium", repair_level: "medium", ingredient_flags: [] },
  "Nivea Volumen & Kraft": { weight: "light", repair_level: "low", ingredient_flags: [] },
  "OGX Biotin & Collagen": {
    weight: "light",
    repair_level: "low",
    ingredient_flags: ["silicones"],
  },
  "OGX Keratin & Protein": {
    weight: "rich",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "OGX Renewing": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones", "oils"],
  },
  "OGX Renewing Argan Oil": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones", "oils"],
  },
  "OGX Renewing Argan Oil of Morocco Conditioner": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones", "oils"],
  },
  "OGX Renewing Argan Oil of Morocco Conditioner (legacy duplicate)": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones", "oils"],
  },
  "Pantene Hydra Glow": {
    weight: "medium",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
  "Pantene Miracles Bond Repair": {
    weight: "medium",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "Pomelo Molecular Repair": {
    weight: "medium",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "Pomélo+Co Shine Therapy Conditioner": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: [],
  },
  "SANTE Deep Repair Conditioner": {
    weight: "rich",
    repair_level: "high",
    ingredient_flags: ["oils"],
  },
  "Sante Intense Hydrating Conditioner": {
    weight: "medium",
    repair_level: "low",
    ingredient_flags: [],
  },
  "Syoss Intense Curls": {
    weight: "medium",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
  "Syoss Intense Keratin": {
    weight: "medium",
    repair_level: "high",
    ingredient_flags: ["silicones"],
  },
  "Wahre Schätze Argan-Mandelcreme": {
    weight: "rich",
    repair_level: "medium",
    ingredient_flags: ["silicones"],
  },
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
    if (product.suitable_concerns.length < 1) {
      throw new Error(
        `${product.name} expected at least one suitable_concern, got ${product.suitable_concerns.join(", ") || "<empty>"}`,
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
    rows.map(({ product_name, balance_direction, weight, repair_level, ingredient_flags }) => ({
      product_name,
      balance_direction,
      weight,
      repair_level,
      ingredient_flags: ingredient_flags.join(",") || "(none)",
    })),
  )

  const includeBalanceDirection = await hasBalanceDirectionColumn()

  const payload = includeBalanceDirection
    ? rows.map(({ product_id, weight, repair_level, balance_direction, ingredient_flags }) => ({
        product_id,
        weight,
        repair_level,
        balance_direction,
        ingredient_flags,
      }))
    : rows.map(({ product_id, weight, repair_level, ingredient_flags }) => ({
        product_id,
        weight,
        repair_level,
        ingredient_flags,
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
