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

type ProductBalanceDirection = "protein" | "moisture" | "balanced"
type MaskWeight = "light" | "medium" | "rich"
type MaskConcentration = "low" | "medium" | "high"

type MaskBackfillSpec = {
  balance_direction: ProductBalanceDirection
  weight: MaskWeight
  concentration: MaskConcentration
}

const DUPLICATE_MASK_NAME = "Neqi Build & Boost"

const MASK_BACKFILL_BY_NAME: Record<string, MaskBackfillSpec> = {
  "Alterra Bio-Granatapfel & Bio Aloe Vera": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "low",
  },
  "Balea 3 in 1 Intensivmaske": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "medium",
  },
  "Balea Aqua Hyaluron 3 in 1": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "low",
  },
  "Balea Natural Beauty 3in1 Locken": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
  },
  "Balea Natural Beauty reparierend.": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Balea Plex Care": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Balea Professional Glow & Shine": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
  },
  "Balea Professionel Plexcare": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Bali Curls Bond Repair": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Bali Curls Deep Hydration (Kokos)": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
  },
  "Bali Curls SOS Protein Treatment": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
  },
  "Fructis Hair Food Aloe Vera": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "low",
  },
  "Fructis Hair Food Papaya": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "medium",
  },
  "Gliss Aqua Revive": {
    balance_direction: "balanced",
    weight: "light",
    concentration: "low",
  },
  "Gliss Liquid Silk": {
    balance_direction: "balanced",
    weight: "light",
    concentration: "medium",
  },
  "Glisskur Liquid Silk (Silikone)": {
    balance_direction: "protein",
    weight: "light",
    concentration: "medium",
  },
  "Guhl 30 sec. Feuchtigkeit": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "low",
  },
  "Guhl Panthenol +": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Haarkur Lamination Intense Glaze": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "low",
  },
  "Hask Argan Deep Conditioning Treatment": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "high",
  },
  "Isana 3in1 Michprotein & Mandel": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "medium",
  },
  "Jean&Len Tiefenreparatur Haarkur": {
    balance_direction: "balanced",
    weight: "rich",
    concentration: "high",
  },
  "Neqi Build Boost": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Neqi Gloss Glaze": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
  },
  "Neqi Peptide Power": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Neqi Repair Reveal": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Pantene Bond Repair": {
    balance_direction: "protein",
    weight: "medium",
    concentration: "high",
  },
  "Pantene Hydra Glow": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "medium",
  },
  "Pantene Keratin Repair & Care": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
  },
  "Pomélo+Co Shine Therapy": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
  },
  "Sante Intense Hydration": {
    balance_direction: "moisture",
    weight: "light",
    concentration: "medium",
  },
  "Schaebens Argan-Öl Haarmaske": {
    balance_direction: "balanced",
    weight: "medium",
    concentration: "medium",
  },
  "Syoss Intense Keratin": {
    balance_direction: "protein",
    weight: "rich",
    concentration: "high",
  },
  "WAHRE SCHÄTZE 1-MINUTE HAARKUR Argan": {
    balance_direction: "moisture",
    weight: "medium",
    concentration: "low",
  },
  "Wahre Schätze Avocado": {
    balance_direction: "moisture",
    weight: "rich",
    concentration: "medium",
  },
}

async function removeDuplicateMask() {
  const { data: duplicates, error: duplicateQueryError } = await supabase
    .from("products")
    .select("id,name")
    .eq("category", "Maske")
    .eq("name", DUPLICATE_MASK_NAME)

  if (duplicateQueryError) throw duplicateQueryError
  if (!duplicates || duplicates.length === 0) return 0

  const duplicateIds = duplicates.map((product) => product.id)
  const { error: deleteError } = await supabase.from("products").delete().in("id", duplicateIds)
  if (deleteError) throw deleteError

  return duplicateIds.length
}

async function fetchMasks() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,suitable_concerns,suitable_thicknesses")
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

  const extraMappings = [...mappedNames].filter(
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

  const payload = rows.map(({ product_id, weight, concentration, balance_direction }) => ({
    product_id,
    format: null,
    weight,
    concentration,
    balance_direction,
    benefits: [],
    ingredient_flags: [],
    leave_on_minutes: 10,
  }))

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
