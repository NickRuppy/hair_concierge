import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL(
  "../supabase/migrations/20260812170000_personal_plan_routine_source_settlement.sql",
  import.meta.url,
)

test("accepted Routine activation settles only its exact pending refinement source", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_settle_accepted_routine_refinement\(\)/,
  )
  assert.match(source, /AFTER UPDATE OF active_routine_version_id ON public\.personal_plans/)
  assert.match(
    source,
    /NEW\.active_routine_version_id IS DISTINCT FROM OLD\.active_routine_version_id/,
  )
  assert.match(source, /source_kind = 'refined_need'/)
  assert.match(source, /source_key = v_routine\.source_refined_need_version_id::text/)
  assert.match(source, /observed_revision <= NEW\.source_revision/)
  assert.match(source, /status = 'pending'/)
  assert.match(source, /processed_revision = observed_revision/)
  assert.match(source, /available_at = 'infinity'::timestamptz/)
  assert.doesNotMatch(source, /source_kind = 'portfolio_version'/)
  assert.doesNotMatch(source, /source_kind = 'user_product'/)
  assert.doesNotMatch(source, /jsonb_array_elements/)
  assert.doesNotMatch(source, /lease_token = NULL/)
  assert.doesNotMatch(
    source,
    /UPDATE public\.personal_plan_routine_source_change_outbox[\s\S]*source_key IS NULL/,
  )
})
