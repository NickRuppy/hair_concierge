// Seed test user with a realistic populated profile matching the mockup.
import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf-8")
    .split("\n").filter(Boolean).filter((l) => !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1)] }),
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const email = "ux-audit-test@hairconscierge.test"

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
const user = list.users.find((u) => u.email === email)
if (!user) throw new Error("user not found — run create-test-user first")

// 1. profiles row: mark onboarding complete, subscription active.
const { error: profErr } = await admin.from("profiles").upsert({
  id: user.id,
  onboarding_completed: true,
  subscription_status: "active",
})
if (profErr) console.log("profiles upsert error:", profErr.message)

// 2. hair_profiles row matching mockup (wavy, fine, smooth surface, stretches-bounces, oily scalp, bleached)
const { error: hpErr } = await admin.from("hair_profiles").upsert({
  user_id: user.id,
  hair_texture: "wavy",
  thickness: "fine",
  cuticle_condition: "smooth",
  protein_moisture_balance: "stretches_bounces",
  chemical_treatment: ["bleached"],
  scalp_type: "oily",
  scalp_condition: null,
  concerns: [],
  goals: ["shine", "volume", "less_frizz", "healthier_hair"],
  heat_styling: "once_weekly",
  styling_tools: ["flat_iron"],
  uses_heat_protection: true,
  towel_material: "frottee",
  towel_technique: "tupfen",
  drying_method: "air_dry",
  brush_type: "wide_tooth_comb",
  night_protection: null,
}, { onConflict: "user_id" })
if (hpErr) console.log("hair_profiles upsert error:", hpErr.message)

// 3. user_product_usage: three products like mockup
await admin.from("user_product_usage").delete().eq("user_id", user.id)
const { error: prErr } = await admin.from("user_product_usage").insert([
  { user_id: user.id, category: "shampoo", product_name: "Daily Shampoo", frequency_range: "1_2x" },
  { user_id: user.id, category: "conditioner", product_name: "Curl Conditioner", frequency_range: "1_2x" },
  { user_id: user.id, category: "dry_shampoo", product_name: "Dry Refresh", frequency_range: "rarely" },
])
if (prErr) console.log("user_product_usage insert error:", prErr.message)

console.log("SEED_DONE user_id=" + user.id)
