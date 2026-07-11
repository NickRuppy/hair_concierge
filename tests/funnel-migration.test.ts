import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync("supabase/migrations/20260711120000_funnel_attribution.sql", "utf8")

test("migration creates private summary and append-only event tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.funnel_sessions/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.funnel_events/)
  assert.match(migration, /event_id text PRIMARY KEY/)
  assert.match(migration, /ALTER TABLE public\.funnel_sessions ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /ALTER TABLE public\.funnel_events ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(migration, /CREATE POLICY/i)
})

test("atomic recorder serializes event IDs and keeps first milestones", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_event_id, 0\)\)/)
  assert.match(migration, /IF existing_event\.event_id IS NOT NULL THEN/)
  for (const column of [
    "landing_viewed_at",
    "quiz_started_at",
    "quiz_completed_at",
    "lead_captured_at",
    "offer_viewed_at",
    "checkout_started_at",
    "purchase_completed_at",
  ]) {
    assert.match(migration, new RegExp(`COALESCE\\(sessions\\.${column}, p_occurred_at\\)`))
  }
})

test("atomic recorder is service-role only", () => {
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.record_funnel_event[\s\S]+FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.record_funnel_event[\s\S]+TO service_role/,
  )
})
