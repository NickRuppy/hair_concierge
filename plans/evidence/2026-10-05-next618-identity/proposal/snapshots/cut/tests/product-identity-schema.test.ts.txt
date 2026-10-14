import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_product_identity_normalization.sql"),
)

assert.ok(migrationFile, "product identity normalization migration is missing")

const migrationSql = readFileSync(join(migrationsDir, migrationFile), "utf8")
const normalizedSql = migrationSql.replace(/\s+/g, " ").toLowerCase()

function assertIncludes(fragment: string) {
  assert.match(normalizedSql, new RegExp(fragment.replace(/\s+/g, "\\s+"), "i"))
}

test("product identity migration creates the phase 0 identity tables", () => {
  for (const table of [
    "product_categories",
    "brands",
    "product_lines",
    "brand_aliases",
    "product_identifiers",
  ]) {
    assertIncludes(`create table if not exists public.${table}`)
    assertIncludes(`alter table public.${table} enable row level security`)
  }
})

test("product identity migration exposes only public-safe identity tables to public clients", () => {
  for (const table of ["product_categories", "brands"]) {
    assertIncludes(`grant select on table public.${table} to anon, authenticated`)
    assert.match(
      normalizedSql,
      new RegExp(
        `create\\s+policy\\s+${table}_select_public\\s+on\\s+public\\.${table}\\s+for\\s+select\\s+to\\s+anon,\\s+authenticated\\s+using\\s+\\(true\\)`,
        "i",
      ),
    )
    assert.doesNotMatch(
      normalizedSql,
      new RegExp(
        `create\\s+policy\\s+\\w+\\s+on\\s+public\\.${table}\\s+for\\s+(insert|update|delete)`,
        "i",
      ),
    )
  }

  for (const table of ["product_lines", "brand_aliases", "product_identifiers"]) {
    assert.doesNotMatch(
      normalizedSql,
      new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+anon`, "i"),
    )
    assert.doesNotMatch(
      normalizedSql,
      new RegExp(`create\\s+policy\\s+${table}_select_public\\s+on\\s+public\\.${table}`, "i"),
    )
  }
})

test("product identity migration keeps non-recommended products out of public product reads", () => {
  assert.match(normalizedSql, /drop\s+policy\s+if\s+exists\s+"products_select_active"/)
  assert.match(
    normalizedSql,
    /create\s+policy\s+"products_select_active"\s+on\s+public\.products\s+for\s+select\s+to\s+authenticated\s+using\s+\(\s*is_active\s+=\s+true\s+and\s+is_chaarlie_recommended\s+=\s+true\s+and\s+auth\.role\(\)\s+=\s+'authenticated'\s+\)/,
  )
})

test("product identity migration keeps semantic product matching aligned with catalog visibility", () => {
  assert.match(normalizedSql, /drop\s+function\s+if\s+exists\s+public\.match_products/)
  assert.match(normalizedSql, /create\s+or\s+replace\s+function\s+public\.match_products/)
  assert.match(
    normalizedSql,
    /where\s+p\.is_active\s+=\s+true\s+and\s+p\.is_chaarlie_recommended\s+=\s+true\s+and\s+p\.lifecycle_status\s+=\s+'active'/,
  )
})

test("product identity migration extends products without contracting legacy fields", () => {
  for (const column of [
    "category_key",
    "brand_id",
    "product_line_id",
    "origin",
    "is_chaarlie_recommended",
  ]) {
    assertIncludes(`add column if not exists ${column}`)
  }

  assertIncludes("add column if not exists is_chaarlie_recommended boolean not null default true")
  assert.match(normalizedSql, /origin\s+=\s+coalesce\(origin,\s+'curated'\)/)
  assertIncludes("is_chaarlie_recommended = true")
  assertIncludes("add constraint products_origin_check")
  assert.match(normalizedSql, /check\s+\(origin\s+in\s+\('curated',\s+'user_submitted'\)\)/)
  assertIncludes("add constraint products_category_key_fkey")
  assertIncludes("add constraint products_brand_id_fkey")
  assertIncludes("add constraint products_product_line_matches_brand")

  assert.doesNotMatch(normalizedSql, /drop\s+column\s+(if\s+exists\s+)?brand\b/)
  assert.doesNotMatch(normalizedSql, /drop\s+column\s+(if\s+exists\s+)?category\b/)
  assert.doesNotMatch(normalizedSql, /alter\s+column\s+(category_key|brand_id)\s+set\s+not\s+null/)
})

test("product identity migration keeps product lines and identifiers compatible", () => {
  assert.match(normalizedSql, /unique\s+\(id,\s+brand_id\)/)
  assert.match(normalizedSql, /foreign\s+key\s+\(product_line_id,\s+brand_id\)/)
  assert.match(normalizedSql, /on\s+delete\s+set\s+null\s+\(product_line_id\)/)
  assertIncludes("normalized_identifier_value")
  assertIncludes("idx_product_identifiers_product_type_value")
  assertIncludes("idx_product_identifiers_lookup")
  assert.doesNotMatch(
    normalizedSql,
    /unique\s+index\s+\w+\s+on\s+public\.product_identifiers\s+\(identifier_type,\s*normalized_identifier_value\)/,
  )
})

test("product identity migration stores script-normalized identity values", () => {
  assert.match(
    normalizedSql,
    /canonical_name\s+text\s+not\s+null,\s+normalized_name\s+text\s+not\s+null/,
  )
  assert.match(normalizedSql, /alias\s+text\s+not\s+null,\s+normalized_alias\s+text\s+not\s+null/)
  assert.doesNotMatch(normalizedSql, /normalized_name\s+text\s+generated\s+always/)
  assert.doesNotMatch(normalizedSql, /normalized_alias\s+text\s+generated\s+always/)
})

test("product identity migration seeds all phase 0 product categories", () => {
  for (const categoryKey of [
    "shampoo",
    "conditioner",
    "mask",
    "leave_in",
    "oil",
    "dry_shampoo",
    "deep_cleansing_shampoo",
    "bondbuilder",
    "heat_protectant",
    "serum",
    "scrub",
    "peeling",
    "styling_gel",
    "styling_mousse",
    "styling_cream",
    "hairspray",
  ]) {
    assert.match(normalizedSql, new RegExp(`'${categoryKey}'`))
  }
})

test("product identity migration stays inside the phase 0 boundary", () => {
  assert.doesNotMatch(normalizedSql, /product_submissions/)
  assert.doesNotMatch(normalizedSql, /user_product_usage/)
  assert.doesNotMatch(normalizedSql, /alter\s+table\s+public\.product_\w+_specs/)
})
