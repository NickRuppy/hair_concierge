import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"

const productId = "8f84eae5-222d-4bbf-9ab0-f30361882a95"

async function database() {
  const pg = new PGlite()
  await pg.exec(`
    CREATE TABLE public.products (
      id uuid PRIMARY KEY, brand text NOT NULL, name text NOT NULL, description text,
      category_key text NOT NULL, origin text NOT NULL, is_active boolean NOT NULL,
      lifecycle_status text NOT NULL, suitable_thicknesses text[] NOT NULL,
      net_content_value numeric, net_content_unit text
    );
    CREATE TABLE public.product_leave_in_specs (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), category_key text NOT NULL,
      weight text NOT NULL, application_stage text[] NOT NULL, ingredient_flags text[] NOT NULL, care_direction text, repair_support_level text,
      roles text[] NOT NULL, care_benefits text[] NOT NULL, plan_roles text[], functional_benefits text[],
      provides_heat_protection boolean NOT NULL
    );
    CREATE TABLE public.product_leave_in_eligibility (
      product_id uuid NOT NULL REFERENCES public.products(id), category_key text NOT NULL,
      thickness text NOT NULL, need_bucket text NOT NULL, styling_context text NOT NULL,
      PRIMARY KEY(product_id, thickness, need_bucket, styling_context)
    );
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL REFERENCES public.products(id), category text NOT NULL,
      role text NOT NULL, cadence jsonb,
      application_stage text, application_state text, placement text,
      contact_time_seconds integer, rinse_action text, reapplication text,
      instruction_modifiers jsonb, source_label text, source_url text, source_text text,
      guidance_payload jsonb, guidance_payload_v2 jsonb,
      category_key text GENERATED ALWAYS AS (category) STORED,
      application_family text GENERATED ALWAYS AS (guidance_payload_v2->>'applicationFamily') STORED,
      PRIMARY KEY(product_id, category, role, application_family)
    );
    CREATE TABLE public.personal_plan_product_search_dispositions (
      product_id uuid PRIMARY KEY REFERENCES public.products(id), disposition text NOT NULL,
      reason_code text NOT NULL, reason text NOT NULL, sources jsonb NOT NULL,
      source_batch text NOT NULL, source_fingerprint text NOT NULL, reviewed_by text NOT NULL
    );
    CREATE TABLE public.personal_plan_catalog_fact_evidence (
      product_id uuid NOT NULL REFERENCES public.products(id), fact_key text NOT NULL,
      fact_value jsonb NOT NULL, source_label text NOT NULL, source_url text NOT NULL,
      source_text text NOT NULL, source_type text NOT NULL, checked_at date NOT NULL,
      batch_id text NOT NULL, batch_fingerprint text NOT NULL, content_fingerprint text NOT NULL,
      PRIMARY KEY(product_id, fact_key, source_url)
    );
    CREATE TABLE public.catalog_enrichment_applied_items (
      batch_id text NOT NULL, product_key text NOT NULL, batch_fingerprint text NOT NULL,
      content_fingerprint text NOT NULL, product_id uuid NOT NULL REFERENCES public.products(id),
      reviewed_by text NOT NULL, PRIMARY KEY(batch_id, product_key)
    );
  `)
  await pg.query(
    `INSERT INTO public.products VALUES ($1, 'K18', 'K18 Hair Professional Molecular Repair Hair Mist',
      'K18 Hair Professional Molecular Repair Hair Mist ist ein Leave-in von K18, empfohlen für feines Haar bei Proteinbedarf.',
      'leave_in', 'curated', true, 'active', ARRAY['fine'], NULL, NULL)`,
    [productId],
  )
  await pg.query(
    `INSERT INTO public.product_leave_in_specs VALUES ($1, 'leave_in', 'light', ARRAY['towel_dry'], ARRAY[]::text[], NULL, NULL,
      ARRAY['styling_prep'], ARRAY['repair'], NULL, NULL, false)`,
    [productId],
  )
  await pg.query(
    `INSERT INTO public.product_leave_in_eligibility VALUES
      ($1, 'leave_in', 'fine', 'repair', 'air_dry'),
      ($1, 'leave_in', 'fine', 'repair', 'non_heat_style')`,
    [productId],
  )
  await pg.query(
    `INSERT INTO public.personal_plan_product_search_dispositions VALUES
      ($1, 'retired_from_personal_plan', 'wrong_category',
       'Exact product is a professional-service mist and is not compatible with the consumer Personal Plan leave-in role.',
       '[]'::jsonb, 'S5-21-product-search-dispositions',
       'dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6', 'nick')`,
    [productId],
  )
  return pg
}

test("K18 readiness migration completes facts before removing only its guarded disposition", async () => {
  const pg = await database()
  const migration = await readFile(
    "supabase/migrations/20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "utf8",
  )
  const manifest = JSON.parse(
    await readFile(
      "data/catalog-enrichment/personal-plan-stage5-v1/S5R-02-k18-molecular-repair-hair-mist-readiness.json",
      "utf8",
    ),
  ) as {
    item: {
      target: {
        protocol: {
          guidance_payload: Record<string, unknown>
          guidance_payload_v2: Record<string, unknown>
        }
      }
    }
  }
  await pg.exec(migration)
  await pg.exec(migration)

  const product = await pg.query<{
    suitable_thicknesses: string[]
    net_content_value: string
    net_content_unit: string
  }>(
    `SELECT suitable_thicknesses, net_content_value, net_content_unit FROM public.products WHERE id = $1`,
    [productId],
  )
  assert.deepEqual(product.rows[0], {
    suitable_thicknesses: ["fine", "normal", "coarse"],
    net_content_value: "300",
    net_content_unit: "ml",
  })
  const specs = await pg.query(
    `SELECT ingredient_flags, care_direction, repair_support_level, plan_roles, functional_benefits, provides_heat_protection FROM public.product_leave_in_specs WHERE product_id = $1`,
    [productId],
  )
  assert.deepEqual(specs.rows[0], {
    ingredient_flags: ["humectants", "proteins", "polymers"],
    care_direction: "protein",
    repair_support_level: "medium",
    plan_roles: ["post_wash_leave_in"],
    functional_benefits: ["repair_support"],
    provides_heat_protection: false,
  })
  const eligibility = await pg.query(
    `SELECT thickness, need_bucket, styling_context FROM public.product_leave_in_eligibility WHERE product_id = $1 ORDER BY thickness, styling_context`,
    [productId],
  )
  assert.deepEqual(eligibility.rows, [
    { thickness: "coarse", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "coarse", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "fine", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "fine", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "normal", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "normal", need_bucket: "repair", styling_context: "non_heat_style" },
  ])
  const protocol = await pg.query<{
    contact_time_seconds: number
    rinse_action: string
    guidance_payload: Record<string, unknown>
    guidance_payload_v2: Record<string, unknown>
  }>(
    `SELECT contact_time_seconds, rinse_action, guidance_payload, guidance_payload_v2 FROM public.product_application_protocols WHERE product_id = $1`,
    [productId],
  )
  assert.equal(protocol.rows[0]?.contact_time_seconds, 240)
  assert.equal(protocol.rows[0]?.rinse_action, "leave_in")
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse(protocol.rows[0]?.guidance_payload).success,
    true,
  )
  assert.equal(
    productApplicationPointerV2Schema.safeParse(protocol.rows[0]?.guidance_payload_v2).success,
    true,
  )
  assert.deepEqual(
    protocol.rows[0]?.guidance_payload,
    manifest.item.target.protocol.guidance_payload,
  )
  assert.deepEqual(
    protocol.rows[0]?.guidance_payload_v2,
    manifest.item.target.protocol.guidance_payload_v2,
  )
  const disposition = await pg.query(
    `SELECT 1 FROM public.personal_plan_product_search_dispositions WHERE product_id = $1`,
    [productId],
  )
  assert.equal(disposition.rows.length, 0)
  const receipt = await pg.query(
    `SELECT batch_id, product_key FROM public.catalog_enrichment_applied_items WHERE product_id = $1`,
    [productId],
  )
  assert.deepEqual(receipt.rows, [
    { batch_id: "S5R-02-k18-mist-readiness", product_key: `k18-readiness:${productId}` },
  ])
  const evidence = await pg.query(
    `SELECT fact_key, source_type FROM public.personal_plan_catalog_fact_evidence WHERE product_id = $1 ORDER BY fact_key, source_type`,
    [productId],
  )
  assert.deepEqual(evidence.rows, [
    { fact_key: "leave_in.authority_facts", source_type: "manufacturer" },
    { fact_key: "leave_in.authority_facts", source_type: "retailer" },
    { fact_key: "leave_in.consumer_role_decision", source_type: "internal_verified" },
  ])
  await pg.close()
})

test("K18 readiness migration fails closed when its prior disposition changes", async () => {
  const pg = await database()
  await pg.query(
    `UPDATE public.personal_plan_product_search_dispositions SET reason_code = 'non_hair_product' WHERE product_id = $1`,
    [productId],
  )
  const migration = await readFile(
    "supabase/migrations/20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "utf8",
  )
  await assert.rejects(pg.exec(migration), /prior disposition/i)
  await pg.exec("ROLLBACK")
  const product = await pg.query(`SELECT suitable_thicknesses FROM public.products WHERE id = $1`, [
    productId,
  ])
  assert.deepEqual(product.rows[0], { suitable_thicknesses: ["fine"] })
  await pg.close()
})

test("K18 readiness replay rejects a V2 protocol without an explicit runtime blocker key", async () => {
  const pg = await database()
  const migration = await readFile(
    "supabase/migrations/20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "utf8",
  )
  await pg.exec(migration)
  await pg.query(
    `UPDATE public.product_application_protocols
     SET guidance_payload_v2 = guidance_payload_v2 - 'runtimeBlockerCode'
     WHERE product_id = $1`,
    [productId],
  )

  await assert.rejects(pg.exec(migration), /readiness receipt conflicts/i)
  await pg.exec("ROLLBACK")
  await pg.close()
})

test("K18 readiness replay rejects drift from the reviewed V1 protocol", async () => {
  const pg = await database()
  const migration = await readFile(
    "supabase/migrations/20260901090000_k18_molecular_repair_hair_mist_readiness.sql",
    "utf8",
  )
  await pg.exec(migration)
  await pg.query(
    `UPDATE public.product_application_protocols
     SET guidance_payload = jsonb_set(guidance_payload, '{protocolFacts,contactTimeSeconds}', '300'::jsonb)
     WHERE product_id = $1`,
    [productId],
  )

  await assert.rejects(pg.exec(migration), /readiness receipt conflicts/i)
  await pg.exec("ROLLBACK")
  await pg.close()
})
