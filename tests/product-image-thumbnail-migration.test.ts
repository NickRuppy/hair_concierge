import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/20260815074148_product_image_thumbnails.sql", import.meta.url),
  "utf8",
)

test("adds a nullable versioned thumbnail URL that is cleared with canonical replacement", () => {
  assert.match(migration, /ADD COLUMN thumbnail_image_url text/i)
  assert.ok(migration.includes("thumbnails/search-v[0-9]+/[a-f0-9]{64}\\.webp"))
  assert.match(migration, /OLD\.image_url IS DISTINCT FROM NEW\.image_url/i)
  assert.match(migration, /NEW\.thumbnail_image_url := NULL/i)
  assert.match(migration, /BEFORE UPDATE OF image_url ON public\.products/i)
})

test("wraps product intake approval and validates matching source-hash metadata", () => {
  assert.match(
    migration,
    /RENAME TO product_intake_approve_reviewed_product_before_thumbnail_image/i,
  )
  assert.match(migration, /canonical_image_sha256/i)
  assert.match(migration, /thumbnail_image_url/i)
  assert.match(
    migration,
    /canonical_image_sha256 IS NULL AND v_thumbnail_image_url IS NULL[\s\S]*expected_thumbnail_image_url := NULL/i,
  )
  assert.match(migration, /approved_product_id := \(approval_result->>'product_id'\)::uuid/i)
  assert.match(
    migration,
    /IF v_thumbnail_image_url IS NOT NULL THEN[\s\S]*UPDATE public\.products[\s\S]*thumbnail_image_url/i,
  )
})

test("adds service-role-only v3 search by delegating to v2 and restoring its order", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_search_assessment_products_v3/i,
  )
  assert.match(migration, /personal_plan_search_assessment_products_v2\(/i)
  assert.match(migration, /product\.thumbnail_image_url/i)
  assert.match(
    migration,
    /ORDER BY result\.sort_order NULLS LAST, result\.product_name, result\.product_id/i,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.personal_plan_search_assessment_products_v3[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_search_assessment_products_v3[\s\S]*TO service_role/i,
  )
})
