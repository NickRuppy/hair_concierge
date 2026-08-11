import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260811150000_personal_plan_stage3_search_assessment_products_v1.sql",
  "utf8",
)

test("Stage 3 assessment search is a private set-based, capped canonical-identity projection", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_search_assessment_products_v1\([\s\S]*p_category text,[\s\S]*p_query text,[\s\S]*p_context jsonb,[\s\S]*p_limit integer DEFAULT 8/,
  )
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(migration, /SET search_path = ''/)
  assert.match(migration, /FROM public\.products p/)
  assert.match(migration, /LEFT JOIN public\.brands b/)
  assert.match(migration, /LEFT JOIN public\.product_lines pl/)
  assert.match(migration, /p\.category_key = p_category/)
  assert.match(migration, /p\.is_active = true/)
  assert.match(migration, /p\.lifecycle_status = 'active'/)
  assert.match(migration, /LIMIT LEAST\(GREATEST\(COALESCE\(p_limit, 8\), 1\), 8\)/)
  assert.match(migration, /jsonb_array_elements\(COALESCE\(p_context->'requiredRoles'/)
  assert.match(migration, /s\.cleansing_intensity IS NOT NULL/)
  assert.match(migration, /r\.weight IS NOT NULL/)
  assert.match(migration, /r\.repair_level IS NOT NULL/)
  assert.match(migration, /hp\.provides_heat_protection IS NOT NULL/)
  assert.match(migration, /ds\.primary_effect IS NOT NULL/)
  assert.match(migration, /bb\.usage_protocol IS NOT NULL/)
  assert.match(migration, /ag\.verified_at IS NOT NULL/)
  assert.match(migration, /NOT EXISTS \([\s\S]*FROM required_roles rr[\s\S]*NOT EXISTS/)
  assert.match(migration, /WHEN p\.category_key = 'leave_in' THEN false/)
  assert.match(migration, /WHEN p\.category_key = 'mask' THEN false/)
  assert.match(migration, /assessment_status/)
  assert.match(migration, /assessment_reason_codes/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.personal_plan_search_assessment_products_v1\(text,text,jsonb,integer\) FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_search_assessment_products_v1\(text,text,jsonb,integer\) TO service_role/,
  )
})
