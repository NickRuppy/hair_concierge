import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { buildStage5ProtocolAmendmentManifest } from "@/lib/product-intake/catalog-enrichment/stage5-protocol-amendments"

const PRODUCT_ID = "b000d235-1fc6-434c-9ba1-f1207d36cded"
const AMENDMENT_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments/S5-22-balea-urea-everyday-protocol.json"
const BASELINE_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json"
const MIGRATION_PATH =
  "supabase/migrations/20260901140744_20260901133000_personal_plan_product_disposition_resolution.sql"

test("the disposition-resolution RPC resolves, replays, and rejects conflicting state atomically", async (t) => {
  const [amendmentText, baselineText, migration] = await Promise.all([
    readFile(AMENDMENT_PATH, "utf8"),
    readFile(BASELINE_PATH, "utf8"),
    readFile(MIGRATION_PATH, "utf8"),
  ])
  const built = buildStage5ProtocolAmendmentManifest(JSON.parse(amendmentText), baselineText)
  const manifestItem = built.manifest.items[0]!
  const resolutionItem = built.resolutionBatch.items[0]!
  const pg = new PGlite()
  t.after(async () => pg.close())

  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(bytea, text)
      RETURNS bytea
      LANGUAGE sql
      IMMUTABLE
      AS $$ SELECT pg_catalog.decode('${built.resolutionBatch.fingerprint}', 'hex') $$;

    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      category_key text,
      origin text,
      is_active boolean NOT NULL,
      lifecycle_status text NOT NULL
    );
    CREATE TABLE public.product_application_protocols (
      product_id uuid NOT NULL,
      category text NOT NULL,
      role text NOT NULL,
      application_family text NOT NULL,
      source_url text,
      guidance_payload jsonb,
      guidance_payload_v2 jsonb,
      PRIMARY KEY (product_id, category, role, application_family)
    );
    CREATE TABLE public.personal_plan_product_search_dispositions (
      product_id uuid PRIMARY KEY,
      disposition text NOT NULL,
      reason_code text NOT NULL,
      reason text NOT NULL,
      sources jsonb NOT NULL,
      source_batch text NOT NULL,
      source_fingerprint text NOT NULL,
      reviewed_by text NOT NULL
    );
    CREATE TABLE public.catalog_enrichment_applied_items (
      batch_id text NOT NULL,
      product_key text NOT NULL,
      batch_fingerprint text NOT NULL,
      content_fingerprint text NOT NULL,
      product_id uuid NOT NULL,
      reviewed_by text NOT NULL,
      PRIMARY KEY (batch_id, product_key)
    );

    CREATE FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(text, text, text)
      RETURNS TABLE(family_rows bigint, product_rows bigint)
      LANGUAGE plpgsql
      AS $stub$
      DECLARE
        v_batch_id constant text := 'personal-plan-stage5-v2-2026-08-14-use-case-coverage';
        v_artifact jsonb := '{"source_kind":"reviewed_stage5_v1_and_use_case_artifacts","snapshot_date":"2026-08-14"}'::jsonb;
      BEGIN
        IF v_artifact->>'source_kind' IS DISTINCT FROM 'reviewed_stage5_v1_and_use_case_artifacts'
           OR coalesce(v_artifact->>'snapshot_date', '') !~ '^2026-08-14$' THEN
          RAISE EXCEPTION 'invalid %', v_batch_id;
        END IF;
        RETURN;
      END;
      $stub$;
  `)
  await pg.exec(migration)

  await pg.query(
    `INSERT INTO public.products (id, category_key, origin, is_active, lifecycle_status)
     VALUES ($1, 'shampoo', 'curated', true, 'active')`,
    [PRODUCT_ID],
  )
  await pg.query(
    `INSERT INTO public.product_application_protocols
       (product_id, category, role, application_family, source_url, guidance_payload, guidance_payload_v2)
     VALUES ($1, 'shampoo', $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      PRODUCT_ID,
      resolutionItem.role,
      resolutionItem.application_family,
      resolutionItem.expected_source_url,
      JSON.stringify(resolutionItem.expected_guidance_payload),
      JSON.stringify(resolutionItem.expected_guidance_payload_v2),
    ],
  )
  await insertDisposition(pg, { ...manifestItem.expected_disposition, reason: "changed" })

  await assert.rejects(resolve(pg, built), /conflicts with current quarantine/)
  assert.equal(await count(pg, "personal_plan_product_search_dispositions"), 1)
  assert.equal(await count(pg, "catalog_enrichment_applied_items"), 0)

  await pg.query(
    "UPDATE public.personal_plan_product_search_dispositions SET reason = $1 WHERE product_id = $2",
    [manifestItem.expected_disposition.reason, PRODUCT_ID],
  )
  assert.equal((await resolve(pg, built)).rows[0]!.resolution, "resolved")
  assert.equal(await count(pg, "personal_plan_product_search_dispositions"), 0)
  assert.equal(await count(pg, "catalog_enrichment_applied_items"), 1)

  assert.equal((await resolve(pg, built)).rows[0]!.resolution, "already_resolved")
  await insertDisposition(pg, manifestItem.expected_disposition)
  await assert.rejects(resolve(pg, built), /receipt conflicts with live quarantine/)
  assert.equal(await count(pg, "personal_plan_product_search_dispositions"), 1)
  assert.equal(await count(pg, "catalog_enrichment_applied_items"), 1)
})

async function insertDisposition(
  pg: PGlite,
  disposition: {
    disposition: string
    reason_code: string
    reason: string
    sources: unknown
    source_batch: string
    source_fingerprint: string
    reviewed_by: string
  },
) {
  await pg.query(
    `INSERT INTO public.personal_plan_product_search_dispositions
       (product_id, disposition, reason_code, reason, sources, source_batch, source_fingerprint, reviewed_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [
      PRODUCT_ID,
      disposition.disposition,
      disposition.reason_code,
      disposition.reason,
      JSON.stringify(disposition.sources),
      disposition.source_batch,
      disposition.source_fingerprint,
      disposition.reviewed_by,
    ],
  )
}

async function resolve(pg: PGlite, built: ReturnType<typeof buildStage5ProtocolAmendmentManifest>) {
  return pg.query<{ product_id: string; resolution: string }>(
    "SELECT * FROM public.apply_personal_plan_product_disposition_resolutions_v1($1, $2, 'nick')",
    [built.resolutionBatch.canonicalJson, built.resolutionBatch.fingerprint],
  )
}

async function count(pg: PGlite, table: string) {
  const result = await pg.query<{ count: string }>(
    `SELECT pg_catalog.count(*)::text AS count FROM public.${table}`,
  )
  return Number(result.rows[0]!.count)
}
