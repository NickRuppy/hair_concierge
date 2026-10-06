import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../supabase/migrations/20260813091352_regular_quiz_field_test_personal_plan_routing.sql",
  import.meta.url,
)

test("routing RPC exposes both exact field-test enrollment kinds without weakening paid provenance", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.match(sql, /FROM public\.personal_plan_test_enrollments AS enrollment/)
  assert.match(sql, /FROM public\.regular_quiz_test_enrollments AS enrollment/)
  assert.match(sql, /lead\.quiz_kind = 'personal_plan'/)
  assert.match(sql, /lead\.quiz_kind = 'legacy'/)
  assert.match(sql, /enrollment\.user_id = v_user_id/)
  assert.match(sql, /access_grant\.user_id = v_user_id/)
  assert.match(sql, /lead\.user_id = v_user_id/)
  assert.match(sql, /enrollment\.status = 'active'/)
  assert.match(sql, /enrollment\.expires_at > pg_catalog\.now\(\)/)
  assert.match(sql, /access_grant\.reason = 'tester'/)
  assert.match(sql, /access_grant\.expires_at > pg_catalog\.now\(\)/)
  assert.match(sql, /'paid'::text AS source_kind/)
  assert.match(sql, /'field_test'::text AS source_kind/)
  assert.match(sql, /'source_kind', v_source_kind/)
})

test("routing RPC remains owner-scoped and exposes only its authenticated wrapper", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.personal_plan_get_own_routing_source\(\)/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.personal_plan_get_own_routing_source\(\)/)
  assert.match(sql, /SECURITY INVOKER/)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.personal_plan_get_own_routing_source\(\)\s+FROM PUBLIC, anon;/,
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_get_own_routing_source\(\)\s+TO authenticated, service_role;/,
  )
})
