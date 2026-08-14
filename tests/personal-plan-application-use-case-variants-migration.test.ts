import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath =
  "supabase/migrations/20260814120000_personal_plan_application_use_case_variants.sql"
const coverageMigrationPath =
  "supabase/migrations/20260814121000_personal_plan_leave_in_use_case_coverage.sql"

test("application protocols persist more than one researched family per product role", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /ADD COLUMN application_family text/i)
  assert.match(sql, /GENERATED ALWAYS AS/i)
  assert.match(sql, /personal_plan_application_family_identity_v1/i)
  assert.match(sql, /p_role = 'post_wash_leave_in'/i)
  assert.match(sql, /THEN 'post_wash_damp_conditioning'/i)
  assert.match(sql, /DROP INDEX[^;]*idx_product_application_protocols_product_category_role/i)
  assert.match(sql, /UNIQUE INDEX[^;]*\(product_id, category, role, application_family\)/i)
})

test("reviewed Leave-in coverage migration is exact-cohort guarded and inserts the 18-pointer delta", async () => {
  const sql = await readFile(coverageMigrationPath, "utf8")

  assert.match(sql, /reviewed Leave-in use-case cohort drifted/)
  assert.match(sql, /reviewed Leave-in use-case delta is not pristine/)
  assert.match(sql, /expected 18 reviewed Leave-in use-case protocol inserts/)
  assert.match(sql, /between_wash_damp_refresh/)
  assert.match(sql, /DELETE FROM public\.product_application_protocols/)
  // Money Mist has no reviewed between-wash delta and must remain absent.
  assert.doesNotMatch(sql, /11a099f7-eabe-4bdb-bfd3-995f35cb6ee4/)
  assert.doesNotMatch(sql, /UPDATE public\.product_leave_in_specs/)
  assert.match(sql, /direction_summary, guidance_v1, guidance_v2/)
  assert.match(sql, /'contractKind', 'product_pointer'/)
  assert.match(sql, /'applicationFamily', application_family/)
  assert.match(sql, /'sourceRole', source_role/)
  assert.match(sql, /reviewed Leave-in use-case inserts require exact V2 pointer identity/)
})

test("Product Intake upserts variants by their exact application family", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /ON CONFLICT \(product_id, category, role, application_family\) DO UPDATE/i)
  assert.match(sql, /candidate\.guidance_payload_v2->>'applicationFamily' IS NULL/i)
  assert.doesNotMatch(
    sql,
    /guidance_payload_v2->>'applicationFamily' IS DISTINCT FROM candidate\.guidance_payload->>'applicationFamily'/i,
  )
  assert.match(sql, /apply_personal_plan_exact_catalog_bundle_v1/i)
  assert.match(sql, /application_family=public\.personal_plan_application_family_identity_v1/i)
  assert.match(sql, /ON CONFLICT \(product_id,category,role,application_family\) DO NOTHING/i)
  assert.match(sql, /apply_personal_plan_stage5_v2_artifact_v1/i)
  assert.match(
    sql,
    /v_product_key := 'v2:' \|\| v_product_id::text \|\| ':' \|\| v_role \|\| ':' \|\| v_item#>>'\{guidance_payload_v2,applicationFamily\}'/i,
  )
})
