import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import type { MaskIngredientFlag } from "../src/lib/mask/constants"

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
type MaskWeight = "light" | "medium" | "rich"
type MaskConcentration = "low" | "medium" | "high"

type MaskBackfillSpec = {
  balance_direction: ProductBalanceDirection
  weight: MaskWeight
  concentration: MaskConcentration
  ingredient_flags: MaskIngredientFlag[]
}

const DUPLICATE_MASK_NAME = "Neqi Build & Boost"

const MASK_BACKFILL_BY_NAME: Record<string, MaskBackfillSpec> = {
  "Alterra Bio-Granatapfel & Bio Aloe Vera": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "low",
    ingredient_flags: [],
  },
  "Balea 3 in 1 Intensivmaske": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Balea Aqua Hyaluron 3 in 1": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "low",
    ingredient_flags: [],
  },
  "Balea Natural Beauty 3in1 Locken": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Balea Natural Beauty reparierend.": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Balea Plex Care": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Balea Professional Glow & Shine": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Balea Professionel Plexcare": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Bali Curls Bond Repair": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Bali Curls Deep Hydration": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
    ingredient_flags: ["oils"],
  },
  "Bali Curls SOS Protein Treatment": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
    ingredient_flags: [],
  },
  "Fructis Hair Food Aloe Vera": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "low",
    ingredient_flags: [],
  },
  "Fructis Hair Food Papaya": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Gliss Aqua Revive": {
    balance_direction: "balanced",
    weight: "light",
    concentration: "low",
    ingredient_flags: [],
  },
  "Gliss Liquid Silk": {
    balance_direction: "balanced",
    weight: "light",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Glisskur Liquid Silk": {
    balance_direction: "protein",
    weight: "light",
    concentration: "medium",
    ingredient_flags: ["silicones"],
  },
  "Guhl 30 sec. Feuchtigkeit": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "low",
    ingredient_flags: [],
  },
  "Guhl Panthenol +": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Haarkur Lamination Intense Glaze": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "low",
    ingredient_flags: [],
  },
  "Hask Argan Deep Conditioning Treatment": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "high",
    ingredient_flags: [],
  },
  "Isana 3in1 Michprotein & Mandel": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Jean&Len Tiefenreparatur Haarkur": {
    balance_direction: "balanced",
    weight: "rich",
    concentration: "high",
    ingredient_flags: [],
  },
  "Neqi Build Boost": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Neqi Gloss Glaze": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Neqi Peptide Power": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Neqi Repair Reveal": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Pantene Bond Repair": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
    ingredient_flags: [],
  },
  "Pantene Hydra Glow": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Pantene Keratin Repair & Care": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
    ingredient_flags: [],
  },
  "Pomélo+Co Shine Therapy": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Sante Intense Hydration": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Schaebens Argan-Öl Haarmaske": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
    ingredient_flags: [],
  },
  "Syoss Intense Keratin": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
    ingredient_flags: [],
  },
  "WAHRE SCHÄTZE 1-MINUTE HAARKUR Argan": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "low",
    ingredient_flags: [],
  },
  "Wahre Schätze Avocado": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
    ingredient_flags: [],
  },
}

async function removeDuplicateMask() {
  const { data: duplicates, error: duplicateQueryError } = await supabase
    .from("products")
    .select("id,name,created_at,updated_at")
    .eq("category", "Maske")
    .eq("name", DUPLICATE_MASK_NAME)
    .order("created_at", { ascending: true })
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })

  if (duplicateQueryError) throw duplicateQueryError
  if (!duplicates || duplicates.length < 2) return 0

  if (duplicates.length > 2) {
    throw new Error(
      `Expected at most two ${DUPLICATE_MASK_NAME} rows, found ${duplicates.length}. Resolve the duplicate manually before running the backfill.`,
    )
  }

  const duplicate = duplicates[1]
  if (!duplicate) return 0

  const { error: deleteError } = await supabase.from("products").delete().eq("id", duplicate.id)
  if (deleteError) throw deleteError

  return 1
}

async function fetchMasks() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,created_at,updated_at,suitable_concerns,suitable_thicknesses")
    .eq("category", "Maske")
    .order("name")

  if (error) throw error
  return data ?? []
}

async function main() {
  const removedDuplicates = await removeDuplicateMask()
  if (removedDuplicates > 0) {
    console.log(
      `Removed ${removedDuplicates} duplicate mask product row(s): ${DUPLICATE_MASK_NAME}`,
    )
  }

  const masks = await fetchMasks()
  const mappedNames = new Set(Object.keys(MASK_BACKFILL_BY_NAME))

  const missingMappings = masks
    .filter((product) => !MASK_BACKFILL_BY_NAME[product.name])
    .map((product) => product.name)

  const extraMappings = Array.from(mappedNames).filter(
    (name) => !masks.some((product) => product.name === name),
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

  const rows = masks.map((product) => ({
    product_id: product.id,
    product_name: product.name,
    ...MASK_BACKFILL_BY_NAME[product.name],
  }))

  console.log("Final mask backfill table:")
  console.table(
    rows.map(({ product_name, balance_direction, weight, concentration }) => ({
      product_name,
      balance_direction,
      weight,
      concentration,
    })),
  )

  const payload = rows.map(
    ({ product_id, weight, concentration, balance_direction, ingredient_flags }) => ({
      product_id,
      weight,
      concentration,
      balance_direction,
      ingredient_flags,
    }),
  )

  const { error } = await supabase
    .from("product_mask_specs")
    .upsert(payload, { onConflict: "product_id" })

  if (error) throw error

  console.log(`Upserted ${rows.length} mask spec rows.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
