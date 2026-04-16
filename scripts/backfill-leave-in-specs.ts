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

type LeaveInFormat = "spray" | "milk" | "lotion" | "cream" | "serum"
type LeaveInWeight = "light" | "medium" | "rich"
type LeaveInRole =
  | "replacement_conditioner"
  | "extension_conditioner"
  | "styling_prep"
  | "oil_replacement"
type LeaveInCareBenefit =
  | "moisture"
  | "protein"
  | "repair"
  | "detangling"
  | "anti_frizz"
  | "shine"
  | "curl_definition"
  | "volume"
type LeaveInIngredientFlag = "silicones" | "polymers" | "oils" | "proteins" | "humectants"
type LeaveInApplicationStage = "towel_dry" | "dry_hair" | "pre_heat" | "post_style"

type LeaveInBackfillSpec = {
  format: LeaveInFormat
  weight: LeaveInWeight
  roles: LeaveInRole[]
  provides_heat_protection: boolean
  heat_protection_max_c: number | null
  heat_activation_required: boolean
  care_benefits: LeaveInCareBenefit[]
  ingredient_flags: LeaveInIngredientFlag[]
  application_stage: LeaveInApplicationStage[]
}

function spec(
  format: LeaveInFormat,
  weight: LeaveInWeight,
  roles: LeaveInRole[],
  providesHeatProtection: boolean,
  careBenefits: LeaveInCareBenefit[],
  ingredientFlags: LeaveInIngredientFlag[],
  applicationStage: LeaveInApplicationStage[],
  heatProtectionMaxC: number | null = null,
): LeaveInBackfillSpec {
  return {
    format,
    weight,
    roles,
    provides_heat_protection: providesHeatProtection,
    heat_protection_max_c: heatProtectionMaxC,
    heat_activation_required: false,
    care_benefits: careBenefits,
    ingredient_flags: ingredientFlags,
    application_stage: applicationStage,
  }
}

const LEAVE_IN_BACKFILL_BY_NAME: Record<string, LeaveInBackfillSpec> = {
  "Acina Hyaluron 2.0 (Silikone)": spec(
    "lotion",
    "light",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["silicones", "humectants"],
    ["towel_dry"],
  ),
  "alverde Leave-In Sprühkur Express 7in1": spec(
    "spray",
    "light",
    ["extension_conditioner"],
    false,
    ["detangling", "anti_frizz", "shine"],
    [],
    ["towel_dry"],
  ),
  "Authentic Beauty Concept Hydrate Spray (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Balea Aqua Hyaluron 3in1": spec(
    "lotion",
    "light",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["humectants"],
    ["towel_dry"],
  ),
  "Cantu Leave-In Conditioning Repair Cream (Kokos)": spec(
    "cream",
    "rich",
    ["extension_conditioner"],
    false,
    ["moisture", "repair", "anti_frizz"],
    ["oils"],
    ["towel_dry"],
  ),
  "Cantu Leave-In Repair Cream (Kokos)": spec(
    "cream",
    "rich",
    ["extension_conditioner"],
    false,
    ["moisture", "repair", "anti_frizz"],
    ["oils"],
    ["towel_dry"],
  ),
  "Color WOW Money Mist (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
  ),
  "Curlsmith Hydrate & Plump Leave-In": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["humectants"],
    ["towel_dry"],
  ),
  "Curlsmith Multitasking Conditioner 3 in 1": spec(
    "lotion",
    "rich",
    ["extension_conditioner", "replacement_conditioner"],
    false,
    ["protein", "repair"],
    ["proteins"],
    ["towel_dry"],
  ),
  "Curlsmith Weightless Protein Leave-In Conditioner": spec(
    "lotion",
    "light",
    ["extension_conditioner"],
    false,
    ["protein", "repair"],
    ["proteins"],
    ["towel_dry"],
  ),
  "Elvital Öl Magique Serum (Silikone)": spec(
    "serum",
    "rich",
    ["oil_replacement"],
    false,
    ["anti_frizz", "shine"],
    ["silicones", "oils"],
    ["towel_dry", "dry_hair", "post_style"],
  ),
  "EVO Day of Grace Leave-In (Silikone)": spec(
    "lotion",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["moisture", "detangling", "anti_frizz"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    221,
  ),
  "EVO Happy Campers (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner", "styling_prep"],
    false,
    ["moisture", "anti_frizz", "curl_definition"],
    ["silicones"],
    ["towel_dry"],
  ),
  "EVO Head Mistress (Silikone)": spec(
    "cream",
    "light",
    ["extension_conditioner", "styling_prep"],
    false,
    ["anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Garnier Hair Food Aloe Vera": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["humectants"],
    ["towel_dry"],
  ),
  "Garnier Hair Food Macadamia": spec(
    "lotion",
    "rich",
    ["extension_conditioner"],
    false,
    ["moisture", "anti_frizz"],
    ["oils"],
    ["towel_dry"],
  ),
  "HASK Keratin 5-in-1 Spray": spec(
    "spray",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["protein", "repair", "detangling"],
    ["proteins"],
    ["towel_dry", "pre_heat"],
  ),
  "Isana Feuchtigkeits Leave-In (Hyaluron)": spec(
    "lotion",
    "light",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["humectants"],
    ["towel_dry"],
  ),
  "It’s a 10 Miracle Leave-In  (Silikone)": spec(
    "spray",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
  ),
  "It’s a 10 Miracle Leave-In Lite (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
  ),
  "K18 Hair Professional Molecular Repair Hair Mist": spec(
    "spray",
    "light",
    ["styling_prep"],
    false,
    ["repair"],
    [],
    ["towel_dry"],
  ),
  "Kevin Murphy Young Again (Silikone)": spec(
    "serum",
    "medium",
    ["oil_replacement"],
    false,
    ["anti_frizz", "shine"],
    ["silicones", "oils"],
    ["towel_dry", "dry_hair", "post_style"],
  ),
  "Living Proof Restore Instant Repair": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["repair", "anti_frizz", "shine"],
    [],
    ["towel_dry", "dry_hair"],
  ),
  "Maria Nila Coils & Curls Oil in Cream": spec(
    "cream",
    "rich",
    ["oil_replacement", "styling_prep"],
    false,
    ["moisture", "anti_frizz", "curl_definition"],
    ["oils"],
    ["towel_dry"],
  ),
  "Maria Nila Structure Repair (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["repair"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Maria Nila Structure Repair Leave-In (Silikone)": spec(
    "lotion",
    "light",
    ["extension_conditioner"],
    false,
    ["repair"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Maria Nila True Soft Leave-In": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["moisture", "anti_frizz", "shine"],
    ["oils"],
    ["towel_dry"],
  ),
  "Moroccanoil All In One Leave In Conditioner (Silikone)": spec(
    "spray",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["moisture", "detangling", "anti_frizz"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
  ),
  "Neqi Moisture Mystery (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["moisture", "detangling"],
    ["silicones", "humectants"],
    ["towel_dry"],
  ),
  "Olaplex No.5 Leave-In (Silikone)": spec(
    "lotion",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["repair", "detangling", "anti_frizz"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    232,
  ),
  "Olaplex No.6 Bond Smoother (Silikone)": spec(
    "cream",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["repair", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    232,
  ),
  "OUAI Leave In Conditioner (Silikone)": spec(
    "spray",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    232,
  ),
  "Pantene Bonding Leave-In (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["repair", "anti_frizz"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Pantene Hydra Glow Leave-In (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["moisture", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Pantene Pro-V Keratin Protect 10-in-1 Spray (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["protein", "repair", "detangling"],
    ["silicones", "proteins"],
    ["towel_dry", "pre_heat"],
  ),
  "Paul Mitchell Full Circle Leave-In": spec(
    "lotion",
    "rich",
    ["extension_conditioner", "styling_prep"],
    false,
    ["curl_definition", "anti_frizz"],
    [],
    ["towel_dry"],
  ),
  "Redken Acidic Color Gloss Leave-In (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    230,
  ),
  "Redken All Soft Mega Curls Leave-In (Silikone)": spec(
    "lotion",
    "rich",
    ["extension_conditioner", "styling_prep"],
    false,
    ["moisture", "anti_frizz", "curl_definition"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Redken Extreme Anti-Snap (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["repair", "anti_frizz"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Redken One United (Silikone)": spec(
    "spray",
    "light",
    ["extension_conditioner", "replacement_conditioner", "styling_prep"],
    true,
    ["detangling", "anti_frizz", "shine"],
    ["silicones"],
    ["towel_dry", "dry_hair", "pre_heat", "post_style"],
    230,
  ),
  "Urban Alchemy Repair (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner"],
    false,
    ["repair", "detangling"],
    ["silicones"],
    ["towel_dry"],
  ),
  "Wella Ultimate Repair Leave-In (Silikone)": spec(
    "lotion",
    "medium",
    ["extension_conditioner", "styling_prep"],
    true,
    ["repair", "detangling", "anti_frizz"],
    ["silicones"],
    ["towel_dry", "pre_heat"],
    230,
  ),
}

async function fetchLeaveIns() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand")
    .eq("category", "Leave-in")
    .order("name")

  if (error) throw error
  return data ?? []
}

async function main() {
  const leaveIns = await fetchLeaveIns()
  const mappedNames = new Set(Object.keys(LEAVE_IN_BACKFILL_BY_NAME))

  const missingMappings = leaveIns
    .filter((product) => !LEAVE_IN_BACKFILL_BY_NAME[product.name])
    .map((product) => product.name)

  const extraMappings = [...mappedNames].filter(
    (name) => !leaveIns.some((product) => product.name === name),
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

  const rows = leaveIns.map((product) => ({
    product_id: product.id,
    product_name: product.name,
    ...LEAVE_IN_BACKFILL_BY_NAME[product.name],
  }))

  console.log("Final leave-in backfill table:")
  console.table(
    rows.map(
      ({
        product_name,
        format,
        weight,
        roles,
        provides_heat_protection,
        care_benefits,
        application_stage,
      }) => ({
        product_name,
        format,
        weight,
        roles: roles.join(", "),
        provides_heat_protection,
        care_benefits: care_benefits.join(", "),
        application_stage: application_stage.join(", "),
      }),
    ),
  )

  const payload = rows.map(({ product_id, product_name: _productName, ...rest }) => ({
    product_id,
    ...rest,
  }))

  const { error } = await supabase
    .from("product_leave_in_specs")
    .upsert(payload, { onConflict: "product_id" })

  if (error) throw error

  console.log(`Upserted ${rows.length} leave-in spec rows.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
