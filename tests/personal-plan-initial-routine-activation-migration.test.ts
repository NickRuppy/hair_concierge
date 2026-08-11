import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL(
  "../supabase/migrations/20260811154526_personal_plan_initial_routine_activation_v1.sql",
  import.meta.url,
)
const activationFunctionName = "personal_plan_complete_draft_activate_initial_v1"

test("initial activation migration is additive, service-only, and preserves newer outbox work", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.ok(Buffer.byteLength(activationFunctionName, "utf8") <= 63)
  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_complete_draft_activate_initial_v1/,
  )
  assert.match(source, /RETURN public\.personal_plan_complete_product_draft_and_stage_routine\(/)
  assert.match(source, /active_routine_version_id = v_routine_id/)
  assert.match(source, /pending_routine_proposal_id = NULL/)
  assert.match(source, /'routineProposalId', NULL/)
  assert.doesNotMatch(source, /INSERT INTO public\.personal_plan_routine_proposals/)
  assert.match(source, /source_kind = 'user_product'/)
  assert.match(source, /observed_revision <= p_expected_source_revision/)
  assert.match(source, /source_kind = 'portfolio_version'/)
  assert.match(source, /v_consumed_rows <> 1/)
  assert.match(
    source,
    /REVOKE ALL ON FUNCTION public\.personal_plan_complete_draft_activate_initial_v1[\s\S]*FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    source,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_complete_draft_activate_initial_v1[\s\S]*TO service_role/,
  )
})
