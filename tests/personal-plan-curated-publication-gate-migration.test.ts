import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql",
)

test("curated publication is transactionally gated by exact facts and canonical protocols", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(
    sql,
    /CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_on_insert/i,
  )
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/i)
  assert.match(sql, /validate_personal_plan_curated_publication_on_visibility_transition/i)
  assert.match(sql, /AFTER INSERT ON public\.products/i)
  assert.match(sql, /NOT \(\s*\(OLD\.origin = 'curated'/i)
  assert.match(sql, /OLD\.category_key IS DISTINCT FROM NEW\.category_key/i)
  assert.match(sql, /product_application_protocols protocol/i)
  assert.match(sql, /protocol\.guidance_payload IS NOT NULL/i)
  assert.match(sql, /jsonb_typeof\(protocol\.guidance_payload\) = 'object'/i)
  assert.match(
    sql,
    /curated publication requires complete category facts and exact canonical protocol/i,
  )
  assert.match(sql, /product_conditioner_specs/i)
  assert.match(sql, /product_conditioner_rerank_specs/i)
  assert.match(sql, /s\.thickness IS NOT NULL/i)
  assert.match(sql, /s\.shampoo_bucket IS NOT NULL/i)
  assert.match(sql, /s\.scalp_route IS NOT NULL/i)
  assert.match(sql, /s\.cleansing_intensity IS NOT NULL/i)
  assert.match(sql, /r\.weight IS NOT NULL/i)
  assert.match(sql, /r\.repair_level IS NOT NULL/i)
  assert.match(sql, /r\.balance_direction IS NOT NULL/i)
})

test("visible curated products stay gated when category facts or canonical protocols change", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.assert_personal_plan_curated_publication\(p_product_id uuid\)/i,
  )
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.validate_personal_plan_curated_publication_dependency\(\)/i,
  )
  assert.match(sql, /'product_application_protocols'/i)
  assert.match(sql, /'product_shampoo_specs'/i)
  assert.match(
    sql,
    /CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_dependency AFTER INSERT OR UPDATE OR DELETE ON public\.%I DEFERRABLE INITIALLY DEFERRED/i,
  )
  assert.match(
    sql,
    /AFTER UPDATE OF origin, is_active, lifecycle_status, is_chaarlie_recommended, category_key, suitable_thicknesses/i,
  )
  assert.match(sql, /OLD\.suitable_thicknesses IS DISTINCT FROM NEW\.suitable_thicknesses/i)
})

test("role-complete publication covers every executable Deep Cleansing and multi-role protocol", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /reset_focus IN \('metal_mineral_hard_water', 'broad_spectrum_detox'\)/i)
  assert.match(sql, /reset_focus IN \('product_sebum_buildup', 'broad_spectrum_detox'\)/i)
  assert.match(sql, /SELECT 'mineral_reset'/i)
  assert.match(sql, /SELECT 'pre_heat_protection'/i)
  assert.match(sql, /unnest\(oil\.role_support\)/i)
  assert.match(sql, /protocol\.role = required\.role/i)
})

test("direct Personal Plan capture permits curated products or the caller's own matched product only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /origin = 'curated' OR EXISTS/i)
  assert.match(sql, /owned\.user_id = p_user_id/i)
  assert.match(sql, /owned\.catalog_product_id = p_catalog_product_id/i)
  assert.match(sql, /owned\.identity_status = 'matched' AND owned\.ownership_status = 'owned'/i)
})

test("review approval persists canonical protocol payloads in its existing transaction", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /RENAME TO product_intake_approve_reviewed_product_without_canonical_guidance/i)
  assert.match(sql, /product_intake_approve_reviewed_product_without_canonical_guidance\(/i)
  assert.match(sql, /source_url, source_text, guidance_payload\s*\n\s*\)/i)
  assert.match(sql, /row_data\.guidance_payload/i)
  assert.match(sql, /jsonb_set\(\s*row_data\.guidance_payload/i)
  assert.match(sql, /\{scope,productId\}/i)
  assert.match(sql, /scope,category/i)
  assert.match(sql, /guidance_payload = EXCLUDED\.guidance_payload/i)
  assert.match(sql, /SET weight = row_data\.weight,\s*role_support = row_data\.role_support/i)
})

test("Leave-In v1.2 replaces the leave-in branch: pre-heat needs heat protection, not a pre_heat label (A1/R8 pins)", async () => {
  const sql = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20261011160000_leave_in_heat_activation_schema.sql",
    ),
    "utf8",
  )
  const branch = sql.slice(
    sql.indexOf("replacement constant text"),
    sql.indexOf("BEGIN\n  SELECT prosrc"),
  )
  // A1: the Gliss/Redken heat-only shape (no pre_heat stage) is publishable.
  assert.match(
    branch,
    /OR \(''pre_heat_application'' = ANY\(li\.plan_roles\) AND li\.provides_heat_protection = true\)\)/,
  )
  // R8: a pre-heat role without a heat-protection claim still fails.
  assert.doesNotMatch(branch, /pre_heat_application'' = ANY\(li\.plan_roles\)\)/)
  // Activated products: pre-heat only, protected, routed, booster_only fit (I2, I4, I5, I6).
  assert.match(branch, /CASE WHEN li\.heat_activation_required THEN/)
  // Spec ↔ workflow agreement (S3 review R1): activated heat rows are the reviewed workflow,
  // and no other product may carry it.
  assert.match(branch, /IS DISTINCT FROM ''heat_activated_verified_product''/)
  assert.match(branch, /ELSE NOT EXISTS \(SELECT 1 FROM public\.product_application_protocols ap/)
  assert.match(branch, /li\.plan_roles = ARRAY\[''pre_heat_application''\]::text\[\]/)
  assert.match(branch, /li\.heat_activation_route IS NOT NULL/)
  assert.match(branch, /f\.conditioner_relationship <> ''booster_only''/)
  assert.match(
    sql,
    /CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_dependency\nAFTER INSERT OR UPDATE OR DELETE ON public\.product_leave_in_fit_specs/,
  )
})
