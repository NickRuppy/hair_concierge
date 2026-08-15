import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

const migrationPath =
  "supabase/migrations/20260815110000_personal_plan_stage3_authority_resume_refresh.sql"
const lockOrderMigrationPath =
  "supabase/migrations/20260815120000_personal_plan_stage3_authority_refresh_lock_order.sql"

test("the already-applied authority refresh migration remains immutable", () => {
  const sql = readFileSync(migrationPath)
  assert.equal(
    createHash("sha256").update(sql).digest("hex"),
    "98bbf11ce9e4c2259d244dbad72dff83825bbc1b73e060f57ab1f80432310b90",
  )
})

test("authority refresh is an owner-scoped active-only CAS that preserves completed drafts", () => {
  const sql = readFileSync(migrationPath, "utf8")

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_refresh_product_draft_authority/,
  )
  assert.match(sql, /WHERE id = p_draft_id\s+AND user_id = p_user_id\s+FOR UPDATE/)
  assert.match(sql, /IF v_draft\.status = 'completed' THEN[\s\S]*'completed'/)
  assert.match(sql, /v_draft\.status IS DISTINCT FROM 'active'/)
  assert.match(sql, /v_draft\.revision IS DISTINCT FROM p_expected_revision/)
  assert.match(
    sql,
    /SET contract_version = p_contract_version,[\s\S]*category_authority_versions = p_category_authority_versions,[\s\S]*payload = p_payload,[\s\S]*revision = revision \+ 1/,
  )
  assert.doesNotMatch(sql, /UPDATE public\.personal_plan_product_drafts[\s\S]*status = 'completed'/)
})

test("authority refresh requires the same current refined source before replacing active state", () => {
  const sql = readFileSync(migrationPath, "utf8")

  assert.match(
    sql,
    /current_refined_need_version_id IS DISTINCT FROM v_draft\.refined_need_version_id/,
  )
  assert.match(sql, /RETURN pg_catalog\.jsonb_build_object\('outcome','stale_source'\)/)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.personal_plan_refresh_product_draft_authority[\s\S]*GRANT EXECUTE ON FUNCTION public\.personal_plan_refresh_product_draft_authority/,
  )
})

test("forward authority refresh replacement locks plan before draft and narrows admission", () => {
  const sql = readFileSync(lockOrderMigrationPath, "utf8")
  const planLock = sql.search(
    /SELECT \* INTO v_plan[\s\S]*?FROM public\.personal_plans[\s\S]*?FOR UPDATE/,
  )
  const draftLock = sql.search(
    /SELECT \* INTO v_draft[\s\S]*?FROM public\.personal_plan_product_drafts[\s\S]*?FOR UPDATE/,
  )

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_refresh_product_draft_authority/,
  )
  assert.ok(planLock >= 0, "plan lock is present")
  assert.ok(draftLock > planLock, "draft lock follows the plan lock")
  assert.match(sql, /personal-plan\.shampoo\.v3/)
  assert.match(sql, /personal-plan\.shampoo\.v4/)
  assert.match(sql, /v_old_snapshot_versions @> v_draft\.category_authority_versions/)
  assert.match(sql, /v_new_snapshot_versions @> p_category_authority_versions/)
  assert.match(
    sql,
    /\(v_draft\.category_authority_versions - 'shampoo'\) IS DISTINCT FROM \(p_category_authority_versions - 'shampoo'\)/,
  )
  assert.match(
    sql,
    /\(v_old_snapshot_versions - 'shampoo'\) IS DISTINCT FROM \(v_new_snapshot_versions - 'shampoo'\)/,
  )
  assert.match(
    sql,
    /pg_catalog\.jsonb_set\(\s*v_draft\.payload->'authoritySnapshot',\s*'\{authorityVersions,shampoo\}',\s*v_new_snapshot_versions->'shampoo',\s*false\s*\) IS DISTINCT FROM p_payload->'authoritySnapshot'/,
  )
  assert.match(sql, /v_draft\.status = 'completed'/)
  assert.match(sql, /v_draft\.revision IS DISTINCT FROM p_expected_revision/)
  assert.match(sql, /category_authority_versions = p_category_authority_versions/)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.personal_plan_refresh_product_draft_authority[\s\S]*GRANT EXECUTE ON FUNCTION public\.personal_plan_refresh_product_draft_authority/,
  )
})
