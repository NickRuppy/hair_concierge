import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260813140000_personal_plan_routine_authority_repair_drafts.sql",
  "utf8",
)

test("routine authority repair migration keeps completed drafts immutable and allows one repair continuation", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS draft_origin text NOT NULL DEFAULT 'stage3_entry'/)
  assert.match(migration, /draft_origin IN \('stage3_entry', 'routine_authority_repair'\)/)
  assert.match(migration, /WHERE status = 'active'/)
  assert.match(
    migration,
    /CREATE UNIQUE INDEX personal_plan_product_drafts_routine_repair_key[\s\S]*?WHERE draft_origin = 'routine_authority_repair';/,
  )
  assert.doesNotMatch(
    migration,
    /UPDATE public\.personal_plan_product_drafts\s+SET status='stale'[\s\S]*?status = 'completed'/,
  )
})

test("completed repair provenance is terminal and cannot create a second repair draft", () => {
  assert.match(
    migration,
    /repair_source_routine_version_id = v_routine\.id\n\s+FOR UPDATE;[\s\S]*?IF v_draft\.status = 'active'[\s\S]*?RETURN pg_catalog\.jsonb_build_object\('outcome','stale_source'\)/,
  )
  assert.match(
    migration,
    /ON CONFLICT \(personal_plan_id, repair_source_routine_version_id\)\n\s+WHERE draft_origin = 'routine_authority_repair'/,
  )
  assert.match(
    migration,
    /IF v_draft\.id IS NULL OR v_draft\.status IS DISTINCT FROM 'active' THEN\n\s+RETURN pg_catalog\.jsonb_build_object\('outcome','stale_source'\);/,
  )
})

test("routine authority repair RPC is service-only, owner-scoped, active-routine scoped, and idempotent", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_create_or_load_routine_authority_repair_draft/,
  )
  assert.match(migration, /v_plan\.active_routine_version_id IS DISTINCT FROM v_routine\.id/)
  assert.match(migration, /v_plan\.current_refined_need_version_id IS DISTINCT FROM v_routine\.source_refined_need_version_id/)
  assert.match(migration, /AND status = 'completed'/)
  assert.match(migration, /RETURN pg_catalog\.jsonb_build_object\('outcome','ready','draft',pg_catalog\.to_jsonb\(v_draft\)\)/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.personal_plan_create_or_load_routine_authority_repair_draft\(uuid,uuid,uuid,integer,jsonb,jsonb\) FROM PUBLIC, anon, authenticated;/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_create_or_load_routine_authority_repair_draft\(uuid,uuid,uuid,integer,jsonb,jsonb\) TO service_role;/,
  )
})

test("normal Stage 3 create/load still replays completed drafts when no active draft exists", () => {
  assert.match(
    migration,
    /WHERE personal_plan_id = p_personal_plan_id\s+AND user_id = p_user_id\s+AND refined_need_version_id = p_refined_need_version_id\s+AND status = 'completed'/,
  )
  assert.match(
    migration,
    /INSERT INTO public\.personal_plan_product_drafts\([^)]*draft_origin[^)]*\)[\s\S]+?'stage3_entry'/,
  )
})
