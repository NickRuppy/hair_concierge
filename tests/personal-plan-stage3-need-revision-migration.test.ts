import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260813124500_personal_plan_stage3_need_revision_authority.sql",
  import.meta.url,
)

test("Stage 3 need-revision authority migration is additive, CAS guarded, and service-only", async () => {
  const source = await readFile(migration, "utf8")
  assert.match(source, /'need_revision_review'/)
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.personal_plan_resolve_stage3_need_revision_v1/)
  assert.match(source, /v_draft\.revision IS DISTINCT FROM p_expected_revision/)
  assert.match(source, /p_expected_proposal_fingerprint IS NULL/)
  assert.match(source, /proposalFingerprint' IS DISTINCT FROM p_expected_proposal_fingerprint/)
  assert.match(source, /jsonb_typeof\(v_authority\) IS DISTINCT FROM 'object'/)
  assert.match(source, /stage2RefinedNeedVersionId' IS DISTINCT FROM v_draft\.refined_need_version_id::text/)
  assert.match(source, /jsonb_typeof\(p_payload\) IS DISTINCT FROM 'object'/)
  assert.match(source, /v_computation_version IS DISTINCT FROM 'stage3\.product_load_refined_snapshot\.v1'/)
  assert.match(source, /'refinedInputHash', v_base\.output_snapshot->>'inputHash'/)
  assert.match(source, /v_base\.output_snapshot->>'inputHash' !~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(source, /'inventorySnapshotFingerprint', v_authority->>'inventorySnapshotFingerprint'/)
  assert.match(source, /v_base\.schema_version,v_computation_version,v_input_hash,v_input_snapshot,v_proposed/)
  assert.match(source, /FOR UPDATE/)
  assert.match(source, /INSERT INTO public\.personal_plan_need_versions/)
  assert.match(source, /current_refined_need_version_id=v_need_id/)
  assert.match(source, /p_action = 'accept'/)
  assert.match(source, /p_action NOT IN \('accept','reject'\)/)
  assert.match(source, /REVOKE ALL ON FUNCTION public\.personal_plan_resolve_stage3_need_revision_v1[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.personal_plan_resolve_stage3_need_revision_v1[\s\S]*TO service_role/)
  assert.doesNotMatch(source, /SELECT public\.personal_plan_resolve_stage3_need_revision_v1/)
})
