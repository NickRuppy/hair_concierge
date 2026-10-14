import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_catalog_authority_historical_repair.sql"),
)

test("historical repair migration exists", () => {
  assert.ok(migrationFile, "catalogue authority historical repair migration is missing")
})

test("Leave-in shared semantics are canonical and legacy parity fails closed", () => {
  assert.ok(migrationFile)
  const sql = readFileSync(join(migrationsDir, migrationFile), "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase()

  assert.match(sql, /legacy leave-in weight conflicts with canonical authority/)
  assert.match(sql, /legacy leave-in conditioner relationship conflicts with canonical roles/)
  assert.match(
    sql,
    /add column conditioner_relationship text generated always as \(\s*case when 'replacement_conditioner' = any \(roles\) then 'replacement_capable' else 'booster_only' end\s*\) stored/,
  )
  assert.doesNotMatch(sql, /set care_benefits\s*=/)
  assert.doesNotMatch(sql, /drop table public\.product_leave_in_fit_specs/)
})

test("contextual eligibility foreign keys receive demonstrated supporting indexes", () => {
  assert.ok(migrationFile)
  const sql = readFileSync(join(migrationsDir, migrationFile), "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase()

  for (const [table, index] of Object.entries({
    product_shampoo_specs: "product_shampoo_specs_identity_thickness_idx",
    product_conditioner_specs: "product_conditioner_specs_identity_thickness_idx",
    product_leave_in_eligibility: "product_leave_in_eligibility_identity_thickness_idx",
    product_oil_eligibility: "product_oil_eligibility_identity_thickness_idx",
  })) {
    assert.match(
      sql,
      new RegExp(
        `create index ${index} on public\\.${table} \\(product_id, category_key, thickness\\)`,
      ),
    )
  }
})

test("constraint validation remains gated on clean reviewed repair receipts", () => {
  assert.ok(migrationFile)
  const sql = readFileSync(join(migrationsDir, migrationFile), "utf8").toLowerCase()

  assert.doesNotMatch(sql, /validate constraint products_category_key_not_null_check/)
  assert.doesNotMatch(sql, /alter column category_key set not null/)
  assert.doesNotMatch(sql, /validate constraint product_.*_product_category_fkey/)
})

test("new writes cannot create contradictory recommendation lifecycle state", () => {
  assert.ok(migrationFile)
  const sql = readFileSync(join(migrationsDir, migrationFile), "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase()

  assert.match(
    sql,
    /add constraint products_recommendable_requires_active_check check \( not is_chaarlie_recommended or \(is_active and lifecycle_status = 'active'\) \) not valid/,
  )
  assert.doesNotMatch(sql, /validate constraint products_recommendable_requires_active_check/)
})
