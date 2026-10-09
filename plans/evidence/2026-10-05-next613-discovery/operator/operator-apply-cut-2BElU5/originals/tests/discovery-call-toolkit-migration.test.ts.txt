import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "../src/lib/personal-plan/products/contracts"
import { STAGE1_CATEGORY_ORDER } from "../src/lib/personal-plan/types"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "../src/lib/product-identity"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => name.endsWith("_discovery_call_toolkit.sql")) ??
    "missing_discovery_call_toolkit.sql",
)
const source = readFileSync(migrationPath, "utf8")
const migration = source.replace(/\s+/g, " ")

function sqlInList(column: string) {
  const match = source.match(
    new RegExp(`${column} text NOT NULL CHECK \\(${column} IN \\(([^)]*)\\)`),
  )
  assert.ok(match, `migration must declare a CHECK list for ${column}`)
  return match[1]
    .split(",")
    .map((entry) => entry.trim().replace(/^'|'$/g, ""))
    .filter((entry) => entry.length > 0)
}

test("the checklist category vocabulary is one set across engine, plan and migration", () => {
  const supported = [...SUPPORTED_PRODUCT_CATEGORY_KEYS].sort()

  assert.deepEqual([...PERSONAL_PLAN_PRODUCT_CATEGORIES].sort(), supported)
  assert.deepEqual([...STAGE1_CATEGORY_ORDER].sort(), supported)

  const migrationCategories = sqlInList("category")
  assert.equal(
    new Set(migrationCategories).size,
    migrationCategories.length,
    "migration category CHECK must not repeat a key",
  )
  assert.deepEqual([...migrationCategories].sort(), supported)
})

test("the intake item source vocabulary is pinned", () => {
  assert.deepEqual(sqlInList("source"), [
    "catalog_search",
    "barcode",
    "barcode_unknown",
    "dm_search",
    "name_research",
    "none",
  ])
})

test("the migration creates the four discovery tables with their shape constraints", () => {
  assert.match(migration, /CREATE TABLE public\.discovery_enrollments/)
  assert.match(migration, /token_version integer NOT NULL DEFAULT 1 CHECK \(token_version > 0\)/)
  assert.match(
    migration,
    /CONSTRAINT discovery_enrollments_claim_pair CHECK \( \(claimed_user_id IS NULL\) = \(claimed_at IS NULL\) \)/,
  )
  assert.match(
    migration,
    /CREATE UNIQUE INDEX discovery_enrollments_one_current_email ON public\.discovery_enrollments \(normalized_email\) WHERE revoked_at IS NULL/,
  )
  assert.match(
    migration,
    /CREATE UNIQUE INDEX discovery_enrollments_one_current_claimed_user[\s\S]*WHERE claimed_user_id IS NOT NULL AND revoked_at IS NULL/,
  )

  assert.match(migration, /CREATE TABLE public\.discovery_intakes/)
  assert.match(migration, /enrollment_id uuid NOT NULL UNIQUE/)
  assert.match(
    migration,
    /state text NOT NULL DEFAULT 'draft' CHECK \(state IN \('draft', 'submitted'\)\)/,
  )
  assert.match(migration, /finalized_source_hash text/)
  assert.match(
    migration,
    /CONSTRAINT discovery_intakes_finalize_requires_submit CHECK \( call_finalized_at IS NULL OR state = 'submitted' \)/,
  )
  assert.match(
    migration,
    /CONSTRAINT discovery_intakes_finalized_pair CHECK \( \(call_finalized_at IS NULL\) = \(finalized_source_hash IS NULL\) \)/,
  )

  assert.match(migration, /CREATE TABLE public\.discovery_intake_items/)
  assert.match(migration, /CONSTRAINT discovery_intake_items_none_is_empty/)
  assert.match(
    migration,
    /CREATE UNIQUE INDEX discovery_intake_items_one_none_per_category ON public\.discovery_intake_items \(intake_id, category\) WHERE source = 'none'/,
  )

  assert.match(migration, /CREATE TABLE public\.discovery_call_decisions/)
  assert.match(migration, /decision text NOT NULL CHECK \(decision IN \('keep', 'swap'\)\)/)
  assert.match(
    migration,
    /CONSTRAINT discovery_call_decisions_swap_pair CHECK \( \(decision = 'swap'\) = \(swap_product_id IS NOT NULL\) \)/,
  )
  assert.match(migration, /UNIQUE \(intake_id, decision_key\)/)
})

test("all four discovery tables are service-only", () => {
  for (const table of [
    "discovery_enrollments",
    "discovery_intakes",
    "discovery_intake_items",
    "discovery_call_decisions",
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`),
    )
    assert.match(migration, new RegExp(`ON TABLE public\\.${table} TO service_role`))
    assert.match(
      migration,
      new RegExp(
        `CREATE POLICY ${table}_service_role_all ON public\\.${table} FOR ALL TO service_role`,
      ),
    )
    assert.doesNotMatch(migration, new RegExp(`ON TABLE public\\.${table} TO (anon|authenticated)`))
  }
})
