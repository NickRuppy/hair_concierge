import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260811210000_personal_plan_stage3_search_readiness_v2.sql",
  "utf8",
)
const dryShampooApplicabilityMigration = readFileSync(
  "supabase/migrations/20260812101000_personal_plan_dry_shampoo_thickness_applicability.sql",
  "utf8",
)

test("Stage 3 assessment search v2 is an owner-aware private, set-based, capped canonical-identity projection", () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.personal_plan_search_assessment_products_v2\([\s\S]*p_user_id uuid,[\s\S]*p_category text,[\s\S]*p_query text,[\s\S]*p_context jsonb,[\s\S]*p_limit integer DEFAULT 8/,
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
  assert.match(migration, /p\.origin = 'curated'/)
  assert.match(migration, /p\.origin = 'user_submitted'/)
  assert.match(migration, /owned\.user_id = p_user_id/)
  assert.match(migration, /owned\.identity_status = 'matched'/)
  assert.match(migration, /owned\.ownership_status = 'owned'/)
  assert.match(migration, /pg_catalog\.cardinality\(p\.suitable_thicknesses\) > 0/)
  assert.match(migration, /p\.category_key = 'heat_protectant'/)
  assert.doesNotMatch(migration, /shampoo_targets/)
  assert.doesNotMatch(migration, /conditionerTarget/)
  assert.match(migration, /s\.cleansing_intensity IS NOT NULL/)
  assert.match(
    migration,
    /s\.thickness IS NULL[\s\S]*s\.shampoo_bucket IS NULL[\s\S]*s\.scalp_route IS NULL/,
  )
  assert.match(migration, /r\.weight IS NOT NULL/)
  assert.match(migration, /r\.repair_level IS NOT NULL/)
  assert.match(migration, /r\.balance_direction IS NOT NULL/)
  assert.match(migration, /hp\.provides_heat_protection IS NOT NULL/)
  assert.match(migration, /ds\.primary_effect IS NOT NULL/)
  assert.match(migration, /bb\.usage_protocol IS NOT NULL/)
  assert.match(migration, /ag\.verified_at IS NOT NULL/)
  assert.doesNotMatch(migration, /m\.format/)
  assert.match(migration, /FROM public\.product_oil_eligibility oe/)
  assert.match(migration, /FROM public\.product_oil_specs os/)
  assert.match(migration, /catalog_roles AS/)
  assert.match(migration, /'shampoo_dandruff'/)
  assert.match(migration, /'shampoo_everyday'/)
  assert.match(migration, /'pre_wash_fibre_treatment'/)
  assert.match(migration, /'dry_finish'/)
  assert.match(migration, /ag\.scope_kind = 'product'/)
  assert.match(migration, /ap\.guidance_payload->'scope'->>'productId' = p\.id::text/)
  assert.match(migration, /assessment_status/)
  assert.match(migration, /assessment_reason_codes/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.personal_plan_search_assessment_products_v2\(uuid,text,text,jsonb,integer\) FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.personal_plan_search_assessment_products_v2\(uuid,text,text,jsonb,integer\) TO service_role/,
  )
  assert.doesNotMatch(
    migration,
    /REVOKE ALL ON FUNCTION public\.personal_plan_search_assessment_products_v1\(text,text,jsonb,integer\) FROM service_role/,
    "the expand phase must not break application instances still running v1",
  )
})

test("Stage 3 assessment search v2 requires an exact protocol for every supported Oil and Leave-in role", () => {
  assert.match(
    migration,
    /'pre_wash_fibre_treatment'[\s\S]*'dry_finish'[\s\S]*FROM public\.product_oil_specs os/,
  )
  assert.match(
    migration,
    /'pre_heat_application'[\s\S]*'pre_heat_protection'[\s\S]*FROM public\.product_leave_in_specs li/,
  )
  assert.match(
    migration,
    /FROM catalog_roles cr[\s\S]*WHERE cr\.product_id = p\.id[\s\S]*AND NOT \([\s\S]*ap\.role = cr\.role/,
  )
})

test("Stage 3 assessment search v2 separates source completeness from fit and waits for canonical Oil v2 facts", () => {
  assert.doesNotMatch(migration, /p\.suitable_thicknesses @>/)
  assert.match(migration, /to_jsonb\(os\)->>'weight' IS NOT NULL/)
  assert.match(migration, /to_jsonb\(os\)->'role_support'/)
  assert.match(migration, /'leave_on_fibre_conditioning'/)
  assert.doesNotMatch(migration, /oe\.oil_purpose IS NULL[\s\S]*leave_on/)
})

test("Dry Shampoo readiness does not fabricate a hair-thickness applicability fact", () => {
  assert.match(
    dryShampooApplicabilityMigration,
    /p\.category_key IN \('heat_protectant', 'dry_shampoo'\)[\s\S]*pg_catalog\.cardinality\(p\.suitable_thicknesses\) > 0/,
  )
  assert.match(
    dryShampooApplicabilityMigration,
    /v_product\.category_key IN \('heat_protectant', 'dry_shampoo'\)[\s\S]*pg_catalog\.cardinality\(v_product\.suitable_thicknesses\) > 0/,
  )
})
