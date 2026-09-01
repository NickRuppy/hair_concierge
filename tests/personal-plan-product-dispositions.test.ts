import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildPersonalPlanProductDispositionManifest,
  preflightPersonalPlanProductDispositionManifest,
} from "@/lib/product-intake/catalog-enrichment/stage5-product-dispositions"
import { auditStage5CuratedCohort } from "@/lib/product-intake/catalog-enrichment/stage5-protocols"

const migrationPath =
  "supabase/migrations/20260811205500_personal_plan_product_search_dispositions.sql"
const rpcFixMigrationPath =
  "supabase/migrations/20260812100000_personal_plan_product_search_disposition_rpc_fix.sql"
const reversalMigrationPath =
  "supabase/migrations/20260831182124_personal_plan_product_search_disposition_reversal.sql"
const reversalE18OilMigrationPath =
  "supabase/migrations/20260901162000_personal_plan_product_search_disposition_reversal_e18_oils.sql"
const manifestPath =
  "data/catalog-enrichment/personal-plan-stage5-v1/S5-21-product-search-dispositions.json"
const cohortPath = "data/catalog-enrichment/personal-plan-stage5-v1/curated-cohort-2026-08-11.json"

test("Personal Plan product dispositions are private, replay-safe, and never mutate products", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.personal_plan_product_search_dispositions/i)
  assert.match(
    sql,
    /ALTER TABLE public\.personal_plan_product_search_dispositions ENABLE ROW LEVEL SECURITY/i,
  )
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.personal_plan_product_search_dispositions FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(
    sql,
    /GRANT SELECT, INSERT, UPDATE ON TABLE public\.personal_plan_product_search_dispositions TO service_role/i,
  )
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.apply_personal_plan_product_search_dispositions_v1/i,
  )
  assert.match(sql, /SECURITY DEFINER/i)
  assert.match(sql, /SET search_path = ''/i)
  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /product disposition fingerprint mismatch/i)
  assert.match(sql, /review,state.*approved_by_nick/i)
  assert.match(sql, /review,reviewed_by.*nick/i)
  assert.match(sql, /duplicate_identity/i)
  assert.match(
    sql,
    /reason_code IN \('wrong_category', 'duplicate_identity', 'non_hair_product'\)/i,
  )
  assert.match(sql, /product disposition conflicts with existing quarantine/i)
  assert.match(sql, /v_existing\.sources IS DISTINCT FROM v_sources/i)
  assert.match(sql, /v_product\.origin <> 'curated'/i)
  assert.match(sql, /v_product\.category_key IS DISTINCT FROM v_expected_category/i)
  assert.doesNotMatch(sql, /UPDATE public\.products/i)
  assert.doesNotMatch(sql, /INSERT INTO public\.products/i)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.apply_personal_plan_product_search_dispositions_v1\(text,text,text\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
})

test("product disposition RPC qualifies its table lookup against the product_id output column", async () => {
  const sql = await readFile(rpcFixMigrationPath, "utf8")

  assert.match(
    sql,
    /FROM public\.personal_plan_product_search_dispositions AS existing_disposition[\s\S]*WHERE existing_disposition\.product_id = v_product_id/i,
  )
  assert.doesNotMatch(
    sql,
    /FROM public\.personal_plan_product_search_dispositions\s+WHERE product_id = v_product_id/i,
  )
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = ''/i)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.apply_personal_plan_product_search_dispositions_v1\(text,text,text\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
})

test("oil disposition reversal is exact, receipted, replay-safe, and service-role-only", async () => {
  const sql = await readFile(reversalMigrationPath, "utf8")

  assert.match(
    sql,
    /CREATE TABLE public\.personal_plan_product_search_disposition_reversal_batches/i,
  )
  assert.match(sql, /CREATE TABLE public\.personal_plan_product_search_disposition_reversal_items/i)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/gi)
  assert.match(sql, /GRANT SELECT, INSERT[\s\S]*TO service_role/i)
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.apply_personal_plan_product_search_disposition_reversal_v1/i,
  )
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = ''/i)
  assert.match(sql, /p_execution_enabled IS DISTINCT FROM true/i)
  assert.match(sql, /approved_by_nick/i)
  assert.match(sql, /dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6/i)
  for (const productId of [
    "29e36443-93ff-4b62-9cf0-55ad9f89f530",
    "3eb198a5-9aab-4f28-9df1-c4869c6a12db",
    "517dca50-5d55-4038-ba1d-f9b745708327",
    "9bfe0a67-72ad-4951-bb99-9f2f5d5c724a",
    "a11855eb-64e5-438f-8880-1d3573efa9fa",
    "acf9d5cd-76e4-49c7-9c04-0af1f20506ad",
    "ca4ae209-79d2-4f4d-8e44-46e586cec62d",
  ]) {
    assert.match(sql, new RegExp(productId, "i"))
  }
  assert.match(sql, /v_product\.origin <> 'curated'/i)
  assert.match(sql, /v_product\.category_key IS DISTINCT FROM 'oil'/i)
  assert.match(
    sql,
    /DELETE FROM public\.personal_plan_product_search_dispositions AS disposition[\s\S]*disposition\.product_id = v_product_id[\s\S]*disposition\.source_fingerprint = v_expected_source_fingerprint[\s\S]*RETURNING/i,
  )
  assert.match(sql, /personal_plan_product_search_disposition_reversal_items/i)
  assert.match(sql, /prior_reason text NOT NULL/i)
  assert.match(sql, /prior_sources jsonb NOT NULL/i)
  assert.match(sql, /product disposition reversal publication gate would block/i)
  assert.match(sql, /product_oil_eligibility/i)
  assert.match(sql, /product_oil_specs/i)
  assert.match(sql, /guidance_payload_v2/i)
  assert.match(sql, /disposition\.reason = v_item#>>'\{expected_disposition,reason\}'/i)
  assert.match(sql, /disposition\.sources = v_item#>'\{expected_disposition,sources\}'/i)
  assert.match(sql, /product disposition reversal conflicts with prior receipt/i)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.apply_personal_plan_product_search_disposition_reversal_v1\(text,text,text,text,boolean\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
})

test("E18 oil disposition reversal extension keeps exact batches and guarded readiness", async () => {
  const sql = await readFile(reversalE18OilMigrationPath, "utf8")

  assert.match(sql, /S5R-01-oil-reentry/i)
  assert.match(sql, /S5R-03-e18-oil-reentry/i)
  assert.match(sql, /pg_catalog\.pg_get_constraintdef\(oid\) LIKE '%item_count%'/i)
  assert.match(sql, /pp_disposition_reversal_batch_count_check/i)
  assert.match(sql, /pp_disposition_reversal_prior_disposition_check/i)
  assert.match(sql, /pp_disposition_reversal_prior_reason_check/i)
  assert.match(sql, /item_count IN \(6, 7\)/i)
  assert.match(
    sql,
    /prior_disposition IN \('retired_from_personal_plan', 'awaiting_exact_analysis'\)/i,
  )
  assert.match(sql, /insufficient_executable_directions/i)
  assert.match(sql, /insufficient_finished_product_evidence/i)
  assert.match(sql, /v_expected_item_count := CASE v_batch_id/i)
  for (const productId of [
    "19aea9c4-4b90-4ec4-8cb6-90cb270010f7",
    "1dce2c18-6a45-4017-a748-e3a7f1cba36f",
    "2ffeae68-c625-4df5-be02-0c1b620aa0fc",
    "38886b62-2c45-4b34-9a24-7d831e97946e",
    "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b",
    "4a95e1de-54e9-4fcd-b227-72a5824d13c1",
  ]) {
    assert.match(sql, new RegExp(productId, "i"))
  }
  assert.match(sql, /product_oil_eligibility/i)
  assert.match(sql, /product_oil_specs/i)
  assert.match(sql, /guidance_payload_v2/i)
  assert.match(
    sql,
    /DELETE FROM public\.personal_plan_product_search_dispositions AS disposition[\s\S]*disposition\.disposition = v_expected_disposition[\s\S]*disposition\.reason_code = v_expected_reason_code[\s\S]*RETURNING/i,
  )
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.apply_personal_plan_product_search_disposition_reversal_v1\(text,text,text,text,boolean\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
  )
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
  assert.doesNotMatch(sql, /UPDATE public\.products/i)
  assert.doesNotMatch(sql, /INSERT INTO public\.products/i)
})

test("Stage 3 search excludes only disposed curated catalog candidates", async () => {
  const sql = await readFile(
    "supabase/migrations/20260811210000_personal_plan_stage3_search_readiness_v2.sql",
    "utf8",
  )

  assert.match(sql, /FROM public\.personal_plan_product_search_dispositions disposition/i)
  assert.match(sql, /disposition\.product_id = p\.id/i)
  assert.match(sql, /p\.origin <> 'curated'[\s\S]*OR NOT EXISTS/i)
  assert.match(sql, /p\.origin = 'user_submitted'[\s\S]*owned\.user_id = p_user_id/i)
})

test("publication gate accepts explicit disposition and direct new capture cannot bypass search", async () => {
  const sql = await readFile(
    "supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql",
    "utf8",
  )

  assert.match(
    sql,
    /FROM public\.personal_plan_product_search_dispositions disposition[\s\S]*disposition\.product_id = v_product\.id[\s\S]*THEN[\s\S]*RETURN;/i,
  )
  assert.match(
    sql,
    /curated publication requires complete category facts and exact canonical protocol/i,
  )
  assert.match(sql, /personal_plan_create_or_reuse_user_product/i)
  assert.match(
    sql,
    /NOT EXISTS \([\s\S]*personal_plan_product_search_dispositions disposition[\s\S]*disposition\.product_id = p_catalog_product_id/i,
  )
})

test("S5-21 disposition manifest contains exactly the current frozen-cohort exceptions", async () => {
  const [manifestInput, cohort] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(cohortPath, "utf8").then(JSON.parse),
  ])
  const built = buildPersonalPlanProductDispositionManifest(manifestInput)
  assert.equal(built.manifest.batch_id, "S5-21-product-search-dispositions")
  assert.deepEqual(built.manifest.review, {
    state: "approved_by_nick",
    reviewed_by: "nick",
  })
  assert.equal(built.manifest.items.length, 19)
  assert.match(built.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(
    built.manifest.items.find(
      ({ product_id }) => product_id === "7539ab79-f4f6-49d7-9269-08034ef4de96",
    )?.reason_code,
    "duplicate_identity",
  )
  assert.deepEqual(
    built.manifest.items
      .filter(({ product_id }) => product_id === "8f84eae5-222d-4bbf-9ab0-f30361882a95")
      .map(({ disposition, reason_code }) => ({ disposition, reason_code })),
    [{ disposition: "retired_from_personal_plan", reason_code: "wrong_category" }],
  )

  const cohortById = new Map<
    string,
    { product_id: string; expected_current_category: string | null; target_category: string }
  >(
    cohort.products.map(
      (product: {
        product_id: string
        expected_current_category: string | null
        target_category: string
      }) => [product.product_id, product] as const,
    ),
  )
  for (const item of built.manifest.items) {
    const product = cohortById.get(item.product_id)
    assert.ok(product, `${item.product_id} is outside frozen cohort`)
    assert.equal(item.expected_current_category, product.expected_current_category)
    assert.equal(item.target_category, product.target_category)
    assert.ok(item.sources.length > 0)
  }
})

test("disposition apply client requires approval, reviewed head, fingerprint, and clean worktree", async () => {
  const source = await readFile(
    "scripts/product-intake/catalog-enrichment/stage5-product-dispositions-client.ts",
    "utf8",
  )

  assert.match(source, /product_disposition_apply_requires_approved_by_nick_manifest/)
  assert.match(
    source,
    /product_disposition_apply_requires_--confirm_--reviewed-head_and_matching_--expected-fingerprint/,
  )
  assert.match(source, /\["status", "--porcelain"\]/)
  assert.match(source, /product_disposition_apply_requires_clean_worktree/)
  assert.match(source, /apply_personal_plan_product_search_dispositions_v1/)
})

test("disposition preflight is read-only and detects existing conflict including sources", async () => {
  const built = buildPersonalPlanProductDispositionManifest(
    JSON.parse(await readFile(manifestPath, "utf8")),
  )
  const item = built.manifest.items[0]!
  const ok = await preflightPersonalPlanProductDispositionManifest(built, {
    async listProducts(ids) {
      return ids.map((id) => ({
        id,
        category_key: built.manifest.items.find((entry) => entry.product_id === id)!
          .expected_current_category,
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
      }))
    },
    async listDispositions() {
      return []
    },
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.writes, false)
  assert.equal(ok.itemCount, 19)

  const conflict = await preflightPersonalPlanProductDispositionManifest(built, {
    async listProducts(ids) {
      return ids.map((id) => ({
        id,
        category_key: built.manifest.items.find((entry) => entry.product_id === id)!
          .expected_current_category,
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
      }))
    },
    async listDispositions() {
      return [
        {
          product_id: item.product_id,
          disposition: item.disposition,
          reason_code: item.reason_code,
          source_batch: built.manifest.batch_id,
          source_fingerprint: built.fingerprint,
          reason: item.reason,
          sources: [{ changed: true }],
        },
      ]
    },
  })
  assert.equal(conflict.ok, false)
  assert.ok(conflict.blockers.includes(`disposition_conflict:${item.product_id}`))
})

test("curated audit treats disposed products as explicit exceptions without hiding drift", async () => {
  const disposedId = "11111111-1111-4111-8111-111111111111"
  const result = await auditStage5CuratedCohort(
    {
      schema_version: "personal-plan-stage5-curated-cohort-v2",
      selection: {},
      products: [{ product_id: disposedId, target_category: "oil" }],
    },
    [
      {
        product_id: disposedId,
        category_key: "oil",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
        brand: "Fixture",
        name: "Disposed Oil",
        affiliate_link: null,
        category_repair: null,
        required_roles: [],
        authority_fact_blockers: [`canonical_fact_missing:${disposedId}:oil.v2`],
      },
    ],
    [],
    [
      {
        product_id: disposedId,
        disposition: "awaiting_exact_analysis",
        reason_code: "insufficient_finished_product_evidence",
      },
    ],
  )

  assert.equal(result.ok, true)
  assert.equal(result.disposedProductCount, 1)
  assert.deepEqual(result.disposedProductIds, [disposedId])
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.worklist, [])
})
