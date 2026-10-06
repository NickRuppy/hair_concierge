import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const foundationMigration = readFileSync(
  "supabase/migrations/20260711120000_funnel_attribution.sql",
  "utf8",
)
const quizVariantMigration = readFileSync(
  "supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql",
  "utf8",
)

test("migration creates private summary and append-only event tables", () => {
  assert.match(foundationMigration, /CREATE TABLE IF NOT EXISTS public\.funnel_sessions/)
  assert.match(foundationMigration, /CREATE TABLE IF NOT EXISTS public\.funnel_events/)
  assert.match(foundationMigration, /event_id text PRIMARY KEY/)
  assert.match(foundationMigration, /ALTER TABLE public\.funnel_sessions ENABLE ROW LEVEL SECURITY/)
  assert.match(foundationMigration, /ALTER TABLE public\.funnel_events ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(foundationMigration, /CREATE POLICY/i)
})

test("atomic recorder serializes event IDs and keeps first milestones", () => {
  assert.match(foundationMigration, /pg_advisory_xact_lock\(hashtextextended\(p_event_id, 0\)\)/)
  assert.match(foundationMigration, /IF existing_event\.event_id IS NOT NULL THEN/)
  for (const column of [
    "landing_viewed_at",
    "quiz_started_at",
    "quiz_completed_at",
    "lead_captured_at",
    "offer_viewed_at",
    "checkout_started_at",
    "purchase_completed_at",
  ]) {
    assert.match(
      foundationMigration,
      new RegExp(`COALESCE\\(sessions\\.${column}, p_occurred_at\\)`),
    )
  }
})

test("atomic recorder is service-role only", () => {
  assert.match(foundationMigration, /SECURITY DEFINER/)
  assert.match(
    foundationMigration,
    /REVOKE ALL ON FUNCTION public\.record_funnel_event[\s\S]+FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    foundationMigration,
    /GRANT EXECUTE ON FUNCTION public\.record_funnel_event[\s\S]+TO service_role/,
  )
})

test("quiz variant migration validates known sessions before mutation and makes the snapshot immutable", () => {
  assert.match(
    quizVariantMigration,
    /IF EXISTS \([\s\S]*FROM public\.funnel_sessions[\s\S]*package_key NOT IN \([\s\S]*'default_organic'[\s\S]*'meta_routine_v1'[\s\S]*'scalp_check_placeholder'[\s\S]*'meta_personal_plan_v1'/,
  )
  assert.match(
    quizVariantMigration,
    /ALTER TABLE public\.funnel_sessions\s+ADD COLUMN quiz_variant text/,
  )
  assert.match(quizVariantMigration, /SET quiz_variant = CASE package_key/)
  assert.match(quizVariantMigration, /WHEN 'meta_personal_plan_v1' THEN 'personal-plan-quiz-v1'/)
  assert.match(quizVariantMigration, /ELSE 'legacy-quiz-v1'/)
  assert.match(quizVariantMigration, /ALTER COLUMN quiz_variant SET NOT NULL/)
  assert.match(quizVariantMigration, /quiz_variant,[\s\S]*p_quiz_variant/)
  assert.match(
    quizVariantMigration,
    /WHEN p_quiz_variant IS NOT NULL THEN p_quiz_variant[\s\S]*WHEN p_package_key = 'meta_personal_plan_v1' THEN 'personal-plan-quiz-v1'[\s\S]*ELSE 'legacy-quiz-v1'/,
  )

  const conflictUpdate = quizVariantMigration.match(
    /ON CONFLICT \(id\) DO UPDATE([\s\S]*?)RETURNING \*/,
  )?.[1]
  assert.ok(conflictUpdate)
  assert.doesNotMatch(conflictUpdate, /quiz_variant/)
})

test("quiz variant RPC migration supports old named callers while granting only the new signature", () => {
  assert.match(
    quizVariantMigration,
    /DROP FUNCTION public\.record_funnel_event\(\s*uuid, uuid, text, text, text, text, text, text, text, text, text, text,\s*jsonb, timestamptz, timestamptz, uuid, uuid, text, text, jsonb\s*\)/,
  )
  assert.match(quizVariantMigration, /p_quiz_variant text DEFAULT NULL/)
  assert.match(
    quizVariantMigration,
    /REVOKE ALL ON FUNCTION public\.record_funnel_event\([\s\S]*uuid, uuid, text, text, text, text, text, text, text, text, text, text, text,[\s\S]*jsonb[\s\S]*\) FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    quizVariantMigration,
    /GRANT EXECUTE ON FUNCTION public\.record_funnel_event\([\s\S]*uuid, uuid, text, text, text, text, text, text, text, text, text, text, text,[\s\S]*jsonb[\s\S]*\) TO service_role/,
  )
})
