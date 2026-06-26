import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const migrationPath = "supabase/migrations/20260625120000_conditioner_category_label_cleanup.sql"

function readMigration() {
  assert.equal(existsSync(migrationPath), true, "conditioner label cleanup migration is missing")
  return readFileSync(migrationPath, "utf8")
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim()
}

function extractStatement(sql: string, tableName: string) {
  const pattern = new RegExp(`UPDATE\\s+public\\.${tableName}\\b[\\s\\S]*?;`, "i")
  const match = sql.match(pattern)

  assert.ok(match, `migration is missing the public.${tableName} update`)
  return normalizeSql(match[0])
}

test("conditioner label cleanup migration updates active display and product categories only", () => {
  const migration = readMigration()
  const normalizedSql = normalizeSql(migration)
  const categoryUpdate = extractStatement(migration, "product_categories")
  const productUpdate = extractStatement(migration, "products")

  assert.match(categoryUpdate, /UPDATE public\.product_categories/i)
  assert.match(categoryUpdate, /display_name_de = 'Conditioner'/i)
  assert.match(categoryUpdate, /updated_at = now\(\)/i)
  assert.match(categoryUpdate, /WHERE key = 'conditioner'/i)
  assert.match(categoryUpdate, /display_name_de IS DISTINCT FROM 'Conditioner'/i)

  assert.match(productUpdate, /UPDATE public\.products/i)
  assert.match(productUpdate, /category = 'Conditioner'/i)
  assert.match(productUpdate, /WHERE category = 'Conditioner \(Drogerie\)'/i)
  assert.match(productUpdate, /is_active = true/i)
  assert.match(productUpdate, /lifecycle_status = 'active'/i)
  assert.match(productUpdate, /updated_at = now\(\)/i)

  assert.match(normalizedSql, /RAISE EXCEPTION/i)
  assert.match(normalizedSql, /products_name_category_unique/i)
  assert.match(normalizedSql, /existing\.name = legacy\.name/i)
  assert.match(normalizedSql, /existing\.category = 'Conditioner'/i)
  assert.match(normalizedSql, /existing\.id <> legacy\.id/i)

  assert.doesNotMatch(normalizedSql, /DROP\s+COLUMN\s+(IF\s+EXISTS\s+)?brand\b/i)
  assert.doesNotMatch(normalizedSql, /DROP\s+COLUMN\s+(IF\s+EXISTS\s+)?category\b/i)
  assert.doesNotMatch(normalizedSql, /DROP\s+TABLE/i)
  assert.doesNotMatch(normalizedSql, /ALTER\s+TABLE/i)
  assert.doesNotMatch(normalizedSql, /ALTER\s+TABLE\s+public\.products\s+DROP/i)
})
