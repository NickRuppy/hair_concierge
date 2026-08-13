import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL(
  "../supabase/migrations/20260813085151_personal_plan_catalog_closure.sql",
  import.meta.url,
)

test("No.0 retirement is guarded, soft, and preserves evidence and relationships", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /aadbbab5-bcf5-4b46-b38a-5533648bcb1d/i)
  assert.match(sql, /FOR UPDATE/i)
  for (const table of [
    "user_products",
    "user_product_usage",
    "personal_plan_product_drafts",
    "personal_plan_portfolio_versions",
    "personal_plan_routine_versions",
    "personal_plans",
    "personal_plan_routine_proposals",
  ]) {
    assert.match(sql, new RegExp(`public\\.${table}`, "i"), table)
  }
  assert.match(sql, /is_active\s*=\s*false/i)
  assert.match(sql, /lifecycle_status\s*=\s*'discontinued'/i)
  assert.match(sql, /is_chaarlie_recommended\s*=\s*false/i)
  assert.match(sql, /guidance_payload_v2\s*=\s*NULL/i)
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.products/i)
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.product_relationships/i)
})

test("precondition proves No.0 is the sole blocked curated required-role pointer", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /schemaVersion/i)
  assert.match(sql, /contractKind/i)
  assert.match(sql, /runtimeBlockerCode/i)
  assert.match(sql, /scope,productId/i)
  assert.match(sql, /scope,category/i)
  assert.match(sql, /No\.0 is not the sole V2 publication blocker/i)
})

test("Product Intake validates and persists V1 and V2 before completing either origin path", async () => {
  const sql = await readFile(migrationPath, "utf8")

  const validationIndex = sql.indexOf("canonical V1/V2 protocol scope")
  const legacyApprovalIndex = sql.indexOf(
    "product_intake_approve_reviewed_product_without_canonical_guidance(",
  )
  assert.ok(validationIndex >= 0)
  assert.ok(legacyApprovalIndex > validationIndex)
  assert.match(sql, /guidance_payload jsonb, guidance_payload_v2 jsonb/i)
  assert.match(sql, /guidance_payload_v2#>>'\{scope,productId\}'[\s\S]*__PRODUCT_ID__/i)
  assert.match(sql, /jsonb_set\(\s*row_data\.guidance_payload_v2/i)
  assert.match(sql, /guidance_payload_v2\s*=\s*EXCLUDED\.guidance_payload_v2/i)
  assert.match(sql, /guidance_payload\s*=\s*EXCLUDED\.guidance_payload/i)
})

test("curated activation and promotion require complete nonblocked V2 while user-submitted stays owner-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /v_product\.origin = 'curated'/i)
  assert.match(sql, /v_product\.is_chaarlie_recommended = true/i)
  assert.match(sql, /protocol\.guidance_payload_v2 IS NOT NULL/i)
  assert.match(sql, /guidance_payload_v2#>>'\{scope,productId\}' = v_product\.id::text/i)
  assert.match(sql, /guidance_payload_v2#>'\{runtimeBlockerCode\}' = 'null'::jsonb/i)
  assert.match(
    sql,
    /curated publication requires complete category facts and exact V1\/V2 protocol/i,
  )
  assert.doesNotMatch(sql, /v_product\.origin = 'user_submitted'[\s\S]*RAISE EXCEPTION/i)
})
