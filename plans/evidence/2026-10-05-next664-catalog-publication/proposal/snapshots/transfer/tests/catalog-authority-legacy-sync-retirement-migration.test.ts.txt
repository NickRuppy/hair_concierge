import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS,
  CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS,
} from "../src/lib/catalog-authority/contracts"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_catalog_authority_retire_legacy_sync_and_validate.sql"),
)

function sql(): string {
  assert.ok(migrationFile, "legacy sync retirement migration is missing")
  return readFileSync(join(migrationsDir, migrationFile), "utf8").replace(/\s+/g, " ").toLowerCase()
}

test("every destructive legacy-derivation trigger and function is retired", () => {
  const text = sql()
  for (const trigger of [
    "trg_sync_product_oil_eligibility on public.products",
    "trg_sync_product_conditioner_specs on public.products",
    "trg_sync_product_leave_in_eligibility_from_products on public.products",
    "trg_sync_product_leave_in_eligibility_from_specs on public.product_leave_in_specs",
  ]) {
    assert.match(text, new RegExp(`drop trigger if exists ${trigger}`))
  }
  for (const fn of [
    "sync_product_oil_eligibility_from_products",
    "sync_product_conditioner_specs_from_products",
    "sync_product_leave_in_eligibility_from_products",
    "sync_product_leave_in_eligibility_from_specs",
    "rebuild_product_leave_in_eligibility",
  ]) {
    assert.match(text, new RegExp(`drop function if exists public\\.${fn}`))
  }
  // The Task 2 transitional compat triggers must survive this migration.
  assert.doesNotMatch(text, /catalog_authority_sync_product_eligibility_compat/)
})

test("the Neqi legacy projection sync is guarded and asserts canonical safety", () => {
  const text = sql()
  assert.match(
    text,
    /update public\.products set suitable_thicknesses = array\['fine', 'normal', 'coarse'\]/,
  )
  assert.match(text, /where id = '010cf825-4892-4f78-bf20-26ad72122c60' and category_key = 'oil'/)
  assert.match(text, /is distinct from array\['fine', 'normal', 'coarse'\]/)
  assert.match(text, /neqi legacy projection sync failed/)
  assert.match(text, /canonical oil eligibility was altered/)
})

test("deferred constraints are validated and category identity becomes a column contract", () => {
  const text = sql()
  for (const constraint of [
    "products_recommendable_requires_active_check",
    "products_category_key_not_null_check",
    "product_thickness_eligibility_product_category_fkey",
    "product_concern_eligibility_product_category_fkey",
    "product_shampoo_specs_thickness_eligibility_fkey",
    "product_conditioner_specs_thickness_eligibility_fkey",
    "product_leave_in_eligibility_thickness_eligibility_fkey",
    "product_oil_eligibility_thickness_eligibility_fkey",
  ]) {
    assert.match(text, new RegExp(`validate constraint ${constraint}`))
  }
  assert.match(text, /alter column category_key set not null/)
  assert.match(text, /drop constraint products_category_key_not_null_check/)
})

test("the schema contract matches the migration outcome", () => {
  const required = new Set<string>(CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS)
  const validated = new Set<string>(CATALOG_AUTHORITY_REQUIRED_VALIDATED_SCHEMA_OBJECTS)

  assert.equal(required.has("products_category_key_not_null_check"), false)
  assert.equal(validated.has("products_category_key_not_null_check"), false)
  for (const name of [
    "products_recommendable_requires_active_check",
    "product_thickness_eligibility_product_category_fkey",
    "product_concern_eligibility_product_category_fkey",
    "product_shampoo_specs_thickness_eligibility_fkey",
    "product_conditioner_specs_thickness_eligibility_fkey",
    "product_leave_in_eligibility_thickness_eligibility_fkey",
    "product_oil_eligibility_thickness_eligibility_fkey",
  ]) {
    assert.equal(required.has(name), true, `${name} missing from required objects`)
    assert.equal(validated.has(name), true, `${name} missing from validated objects`)
  }
})
