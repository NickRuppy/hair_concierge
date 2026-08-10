import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function migration(path: string) {
  return readFile(new URL(`../../../supabase/migrations/${path}`, import.meta.url), "utf8")
}

test("Stage 3 plural authority relations have composite product-context keys", async () => {
  const [shampoo, conditioner, oilEligibility] = await Promise.all([
    migration("20260316113000_realign_shampoo_buckets.sql"),
    migration("20260309123000_add_conditioner_specs_and_matcher.sql"),
    migration("20260321113000_add_oil_eligibility_and_matcher.sql"),
  ])

  assert.match(shampoo, /PRIMARY KEY \(product_id, thickness, shampoo_bucket\)/)
  assert.match(conditioner, /PRIMARY KEY \(product_id, thickness, protein_moisture_balance\)/)
  assert.match(oilEligibility, /PRIMARY KEY \(product_id, thickness, oil_subtype\)/)
})

test("Stage 3 one-row authority relations keep product_id as their primary key", async () => {
  const [leaveIn, mask, support, readiness] = await Promise.all([
    migration("20260307152000_leave_in_specs_and_profile_fields.sql"),
    migration("20260307170000_add_mask_specs.sql"),
    migration("20260416121500_add_support_category_fit_tables.sql"),
    migration("20260808065528_personal_plan_category_readiness.sql"),
  ])

  for (const table of ["product_leave_in_specs"]) {
    assert.match(
      leaveIn,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?product_id uuid PRIMARY KEY`),
    )
  }
  assert.match(
    mask,
    /CREATE TABLE IF NOT EXISTS product_mask_specs \([\s\S]*?product_id uuid PRIMARY KEY/,
  )
  for (const table of [
    "product_bondbuilder_specs",
    "product_deep_cleansing_shampoo_specs",
    "product_dry_shampoo_specs",
  ]) {
    assert.match(
      support,
      new RegExp(
        `CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?product_id uuid PRIMARY KEY`,
      ),
    )
  }
  for (const table of [
    "product_heat_protectant_specs",
    "product_oil_specs",
    "product_scalp_care_specs",
  ]) {
    assert.match(
      readiness,
      new RegExp(
        `CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?product_id uuid PRIMARY KEY`,
      ),
    )
  }
})
