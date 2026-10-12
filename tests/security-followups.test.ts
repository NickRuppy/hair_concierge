import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const migrationName = "20261012150150_security_matcher_access.sql"

test("BIL-2: the unused unauthenticated Stripe session endpoint is removed", () => {
  assert.equal(
    existsSync(new URL("../src/app/api/stripe/session/route.ts", import.meta.url)),
    false,
  )
})

test("RLS-3 / RLS-6: every schema match_* name explicitly loses public, anon and authenticated execution", () => {
  // Discover the schema inventory independently of the hardening migration.
  // Include historical names too: the catalog loop must safely cover any surviving overload.
  const names = new Set<string>()
  for (const file of readdirSync(migrations).filter(
    (name) => name.endsWith(".sql") && name < migrationName,
  )) {
    const sql = readFileSync(new URL(file, migrations), "utf8")
    for (const match of sql.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(match_\w+)\s*\(/gi,
    )) {
      names.add(match[1]!)
    }
  }
  assert.ok(names.size > 0, "schema matcher inventory must not be empty")
  const migration = readFileSync(new URL(migrationName, migrations), "utf8")
  for (const name of names) {
    assert.ok(migration.includes(`'${name}'`), `${name} must be in the catalog inventory`)
  }
  assert.match(migration, /pg_get_function_identity_arguments\(p\.oid\)/)
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO service_role/)
  assert.match(
    migration,
    /REVOKE SELECT ON TABLE public\.content_chunks FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /DROP POLICY IF EXISTS content_chunks_select_authenticated ON public\.content_chunks/,
  )
})
