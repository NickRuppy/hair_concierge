import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260815220000_catalog_spec_relationship_convergence.sql",
)

const categoryTables = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_leave_in_specs",
  "product_leave_in_eligibility",
  "product_heat_protectant_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_mask_specs",
  "product_scalp_care_specs",
  "product_dry_shampoo_specs",
  "product_bondbuilder_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_application_protocols",
] as const

test("relationship convergence validates every composite FK before removing its legacy FK", () => {
  assert.equal(existsSync(migrationPath), true, "relationship convergence migration is missing")
  const sql = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase()

  for (const table of categoryTables) {
    const validate = `alter table public.${table} validate constraint ${table}_product_category_fkey;`
    const drop = `alter table public.${table} drop constraint ${table}_product_id_fkey;`
    assert.equal((sql.match(new RegExp(validate.replaceAll(".", "\\."), "g")) ?? []).length, 1)
    assert.equal((sql.match(new RegExp(drop.replaceAll(".", "\\."), "g")) ?? []).length, 1)
    assert.ok(sql.indexOf(validate) < sql.indexOf(drop), `${table} must validate before drop`)
  }

  assert.doesNotMatch(sql, /drop constraint [^;]*product_category_fkey/)
  assert.doesNotMatch(sql, /if exists|execute\s+format|\b(update|insert|delete|truncate)\b/)
  assert.match(sql, /^begin;/)
  assert.match(sql, /commit;\s*$/)
})

test("schema receipt inspects the exact redundant relationship names", () => {
  const auditSql = readFileSync(
    join(process.cwd(), "scripts", "catalog-authority", "schema-audit.sql"),
    "utf8",
  )
  for (const table of categoryTables) {
    assert.match(auditSql, new RegExp(`${table}_product_id_fkey`))
  }
})
