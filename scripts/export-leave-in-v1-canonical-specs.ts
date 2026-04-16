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

type LeaveInWeight = "light" | "medium" | "rich"
type LeaveInRole =
  | "replacement_conditioner"
  | "extension_conditioner"
  | "styling_prep"
  | "oil_replacement"
type LegacyLeaveInCareBenefit =
  | "moisture"
  | "protein"
  | "repair"
  | "detangling"
  | "anti_frizz"
  | "shine"
  | "curl_definition"
  | "volume"
type LeaveInApplicationStage = "towel_dry" | "dry_hair" | "pre_heat" | "post_style"

type CanonicalConditionerRelationship = "replacement_capable" | "booster_only"
type CanonicalLeaveInCareBenefit = "heat_protect" | "curl_definition" | "repair" | "detangle_smooth"

type LeaveInSpecRow = {
  product_id: string
  product_name: string
  weight: LeaveInWeight
  conditioner_relationship: CanonicalConditionerRelationship
  care_benefits: CanonicalLeaveInCareBenefit[]
  source: {
    roles: LeaveInRole[]
    provides_heat_protection: boolean
    care_benefits: LegacyLeaveInCareBenefit[]
    application_stage: LeaveInApplicationStage[]
  }
}

const CANONICAL_BENEFIT_ORDER: CanonicalLeaveInCareBenefit[] = [
  "heat_protect",
  "curl_definition",
  "repair",
  "detangle_smooth",
]

function deriveConditionerRelationship(roles: LeaveInRole[]): CanonicalConditionerRelationship {
  return roles.includes("replacement_conditioner") ? "replacement_capable" : "booster_only"
}

function deriveCanonicalCareBenefits(input: {
  provides_heat_protection: boolean
  care_benefits: LegacyLeaveInCareBenefit[]
  application_stage: LeaveInApplicationStage[]
}): CanonicalLeaveInCareBenefit[] {
  const benefits = new Set<CanonicalLeaveInCareBenefit>()

  if (input.provides_heat_protection || input.application_stage.includes("pre_heat")) {
    benefits.add("heat_protect")
  }

  if (input.care_benefits.includes("curl_definition")) {
    benefits.add("curl_definition")
  }

  if (input.care_benefits.includes("repair") || input.care_benefits.includes("protein")) {
    benefits.add("repair")
  }

  if (
    input.care_benefits.includes("moisture") ||
    input.care_benefits.includes("detangling") ||
    input.care_benefits.includes("anti_frizz") ||
    input.care_benefits.includes("shine")
  ) {
    benefits.add("detangle_smooth")
  }

  return CANONICAL_BENEFIT_ORDER.filter((benefit) => benefits.has(benefit))
}

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,product_leave_in_specs!inner(weight,roles,provides_heat_protection,care_benefits,application_stage)",
    )
    .eq("category", "Leave-in")
    .order("name")

  if (error) throw error

  const rows: LeaveInSpecRow[] = (data ?? []).map((row) => {
    const spec = Array.isArray(row.product_leave_in_specs)
      ? row.product_leave_in_specs[0]
      : row.product_leave_in_specs

    const roles = (spec.roles ?? []) as LeaveInRole[]
    const careBenefits = (spec.care_benefits ?? []) as LegacyLeaveInCareBenefit[]
    const applicationStage = (spec.application_stage ?? []) as LeaveInApplicationStage[]

    return {
      product_id: row.id,
      product_name: row.name,
      weight: spec.weight as LeaveInWeight,
      conditioner_relationship: deriveConditionerRelationship(roles),
      care_benefits: deriveCanonicalCareBenefits({
        provides_heat_protection: Boolean(spec.provides_heat_protection),
        care_benefits: careBenefits,
        application_stage: applicationStage,
      }),
      source: {
        roles,
        provides_heat_protection: Boolean(spec.provides_heat_protection),
        care_benefits: careBenefits,
        application_stage: applicationStage,
      },
    }
  })

  const summary = {
    total_products: rows.length,
    weights: rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.weight] = (acc[row.weight] ?? 0) + 1
      return acc
    }, {}),
    conditioner_relationships: rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.conditioner_relationship] = (acc[row.conditioner_relationship] ?? 0) + 1
      return acc
    }, {}),
    care_benefits: rows.reduce<Record<string, number>>((acc, row) => {
      for (const benefit of row.care_benefits) {
        acc[benefit] = (acc[benefit] ?? 0) + 1
      }
      return acc
    }, {}),
  }

  const markdown = [
    "# Leave-in V1 Canonical Specs",
    "",
    `Generated from live leave-in specs on ${new Date().toISOString()}.`,
    "",
    "| Product | weight | conditioner_relationship | care_benefits |",
    "|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.product_name} | ${row.weight} | ${row.conditioner_relationship} | ${row.care_benefits.join(", ")} |`,
    ),
    "",
  ].join("\n")

  await writeFile("data/research/leave-in-v1-canonical-specs.json", JSON.stringify(rows, null, 2))
  await writeFile(
    "data/research/leave-in-v1-canonical-specs-summary.json",
    JSON.stringify(summary, null, 2),
  )
  await writeFile("data/research/leave-in-v1-canonical-specs.md", markdown)

  console.log(
    `Wrote ${rows.length} canonical leave-in rows to data/research/leave-in-v1-canonical-specs.{json,md}`,
  )
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
