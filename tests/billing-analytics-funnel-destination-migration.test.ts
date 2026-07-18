import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260718120000_allow_funnel_billing_analytics_destination.sql",
  "utf8",
)

test("billing analytics destination migration replaces the named check constraint", () => {
  assert.match(
    migration,
    /DROP CONSTRAINT IF EXISTS billing_analytics_deliveries_destination_check/i,
  )
  assert.match(migration, /ADD CONSTRAINT billing_analytics_deliveries_destination_check\s+CHECK/i)
  assert.match(migration, /CHECK[\s\S]+NOT VALID/i)
  assert.match(migration, /VALIDATE CONSTRAINT billing_analytics_deliveries_destination_check/i)
  for (const destination of ["customerio", "meta", "posthog", "funnel"]) {
    assert.match(migration, new RegExp(`'${destination}'`))
  }
  assert.doesNotMatch(migration, /UPDATE|DELETE|TRUNCATE/i)
})
