import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDirectory = join(process.cwd(), "supabase/migrations")
const migrationSuffix = "_lock_down_billing_backup_tables.sql"
const protectedTables = [
  "billing_subscriptions_backup_20260822",
  "profiles_backup_20260822",
] as const

function loadContainmentMigration() {
  const matches = readdirSync(migrationsDirectory).filter((name) => name.endsWith(migrationSuffix))
  assert.equal(
    matches.length,
    1,
    `expected one ${migrationSuffix} migration, found ${matches.length}`,
  )
  return readFileSync(join(migrationsDirectory, matches[0]), "utf8")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

test("backup containment revokes public API roles and enables RLS without changing rows", () => {
  const migration = loadContainmentMigration()

  for (const table of protectedTables) {
    assert.match(migration, new RegExp(`to_regclass\\('public\\.${table}'\\)`))
    assert.match(
      migration,
      new RegExp(
        `if to_regclass\\('public\\.${table}'\\) is not null then ` +
          `execute 'revoke all privileges on table public\\.${table} from public, anon, authenticated'; ` +
          `execute 'alter table public\\.${table} enable row level security'; end if;`,
      ),
    )
  }

  assert.doesNotMatch(migration, /create\s+policy/)
  assert.doesNotMatch(migration, /grant[^;]*\b(public|anon|authenticated)\b/)
  assert.doesNotMatch(migration, /revoke[^;]*service_role/)
  assert.doesNotMatch(migration, /\b(drop\s+table|truncate|insert|update|delete|create\s+table)\b/)
})
