import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { buildExpansionProtocolRow } from "@/lib/product-intake/expansion-apply-templates"
import {
  buildExpansionApplyBatch,
  expansionItemKey,
  type ExpansionApplyBatch,
  type ExpansionApplySupplement,
} from "@/lib/product-intake/expansion-apply"

/**
 * Postgres-level tests for the Scan DB Expansion batch adapter (T5 of
 * plans/2026-09-01-scan-db-expansion-pilot.md).
 *
 * Harness pattern: tests/scanner-existing-identifier-backfill-postgres.test.ts and
 * tests/personal-plan-pglite-migration.fixtures.ts — stub only the FK targets and
 * apply the REAL migration files for everything under test. That matters more here
 * than anywhere else: the whole point of F-02 is that this adapter publishes through
 * `product_intake_approve_reviewed_product`, so the test applies that entire
 * function chain plus the deferred curated-publication gate. A stubbed boundary
 * would prove nothing.
 */

const ROOT = new URL("../", import.meta.url)
const REVIEWED_HEAD = "b".repeat(40)
const OPERATOR = "11111111-1111-4111-8111-111111111111"
const IMAGE_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

// Minimal FK targets and project-wide utilities. Column shapes only — every
// behaviour under test comes from the real migration files listed below.
const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE FUNCTION extensions.digest(value bytea, algorithm text)
  RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false);
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, normalized_name)
);
CREATE TABLE public.brand_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  alias text NOT NULL,
  normalized_alias text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'curated'
);
CREATE TABLE public.product_categories (
  key text PRIMARY KEY,
  display_name_de text NOT NULL,
  is_catalog_supported boolean NOT NULL DEFAULT true,
  is_intake_supported boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  description text,
  category text,
  affiliate_link text,
  image_url text,
  price_eur numeric(10,2),
  currency text DEFAULT 'EUR',
  tags text[] DEFAULT '{}',
  suitable_thicknesses text[] NOT NULL DEFAULT '{}',
  suitable_concerns text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  category_key text REFERENCES public.product_categories(key),
  brand_id uuid REFERENCES public.brands(id),
  product_line_id uuid REFERENCES public.product_lines(id),
  origin text NOT NULL DEFAULT 'curated',
  is_chaarlie_recommended boolean NOT NULL DEFAULT false,
  purchase_link_status text,
  purchase_link_checked_at timestamptz,
  price_checked_at timestamptz,
  net_content_value numeric,
  net_content_unit text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  source text NOT NULL DEFAULT 'curated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  user_product_usage_id uuid,
  user_product_id uuid,
  source text NOT NULL,
  source_conversation_id uuid,
  intake_method text NOT NULL,
  category text NOT NULL REFERENCES public.product_categories(key),
  brand_text text,
  product_name_text text,
  frequency_range text,
  status text NOT NULL DEFAULT 'pending_review',
  researched_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  intake_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_product_id uuid REFERENCES public.products(id),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  notification_sent_at timestamptz,
  scanned_identifier_type text,
  scanned_identifier_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_submissions_source_check
    CHECK (source IN ('onboarding','chat','personal_plan','scan')),
  CONSTRAINT product_submissions_frequency_range_required_unless_scan_check
    CHECK (frequency_range IS NOT NULL OR source = 'scan')
);
CREATE TABLE public.user_product_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, category text NOT NULL, product_id uuid,
  product_submission_id uuid, match_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_shampoo_specs (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL, shampoo_bucket text NOT NULL, scalp_route text,
  cleansing_intensity text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, shampoo_bucket)
);
CREATE TABLE public.product_conditioner_specs (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL, protein_moisture_balance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, protein_moisture_balance)
);
CREATE TABLE public.product_conditioner_rerank_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, repair_level text, balance_direction text,
  ingredient_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_mask_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, concentration text, balance_direction text,
  ingredient_flags text[] NOT NULL DEFAULT '{}',
  repair_support_level text, functional_benefits text[],
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_leave_in_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text, weight text, roles text[], provides_heat_protection boolean,
  heat_protection_max_c integer, heat_activation_required boolean,
  care_benefits text[], ingredient_flags text[] NOT NULL DEFAULT '{}',
  application_stage text[],
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_leave_in_fit_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, conditioner_relationship text, care_benefits text[],
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_leave_in_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL, need_bucket text NOT NULL, styling_context text NOT NULL,
  PRIMARY KEY (product_id, thickness, need_bucket, styling_context)
);
CREATE TABLE public.product_oil_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL, oil_subtype text NOT NULL, oil_purpose text,
  ingredient_flags text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (product_id, thickness, oil_subtype)
);
CREATE TABLE public.product_dry_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_effect text, hair_color_fit text, scalp_sensitivity_fit text, format text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_deep_cleansing_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text, reset_intensity text, reset_focus text, color_treated_suitability text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_bondbuilder_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  bond_repair_intensity text, application_mode text, bond_repair_axis text,
  treatment_mode text, product_format text, usage_protocol text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, category text NOT NULL,
  catalog_product_id uuid REFERENCES public.products(id),
  brand_text text, product_name_text text,
  identity_status text, ownership_status text, intake_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, category)
);
CREATE UNIQUE INDEX user_products_owned_catalog_unique
  ON public.user_products (user_id, category, catalog_product_id)
  WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL;
CREATE TABLE public.personal_plan_product_search_dispositions (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE
);
-- Copied verbatim from 20260810090000_catalog_enrichment_personal_plan_heat_v1_executor.sql:13-22
-- (that migration's own body seeds launch-cohort brands this test does not need).
CREATE TABLE public.catalog_enrichment_applied_items (
  batch_id text NOT NULL,
  product_key text NOT NULL,
  batch_fingerprint text NOT NULL CHECK (batch_fingerprint ~ '^[a-f0-9]{64}$'),
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, product_key)
);
-- Copied verbatim from 20260811214000_personal_plan_exact_catalog_bundle_v1.sql:3-17,
-- widened by 20260816150000_fact_evidence_internal_verified_source.sql.
CREATE TABLE public.personal_plan_catalog_fact_evidence (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL,
  source_label text NOT NULL,
  source_url text NOT NULL,
  source_text text NOT NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('manufacturer','retailer','professional_authority','internal_verified')
  ),
  checked_at date NOT NULL,
  batch_id text NOT NULL,
  batch_fingerprint text NOT NULL,
  content_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, fact_key, source_url)
);
INSERT INTO public.product_categories (key, display_name_de) VALUES
  ('shampoo','Shampoo'),('conditioner','Conditioner'),('mask','Maske'),
  ('leave_in','Leave-in'),('oil','Öl'),('dry_shampoo','Trockenshampoo'),
  ('deep_cleansing_shampoo','Tiefenreinigungs-Shampoo'),('bondbuilder','Bondbuilder');
`

/** Single-quote a SQL literal for the hand-written seed blocks below. */
function quote(value: string | number | null): string {
  return value === null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`
}

/** The real publication-boundary chain, in deploy order, ending with the adapter. */
const MIGRATIONS = [
  "supabase/migrations/20260617120000_product_intake_review_workflow_functions.sql",
  "supabase/migrations/20260627122500_fix_product_intake_approve_brand_id_ambiguity.sql",
  "supabase/migrations/20260808065528_personal_plan_category_readiness.sql",
  "supabase/migrations/20260810181837_personal_plan_stage5_exact_product_protocols.sql",
  "supabase/migrations/20260811211000_personal_plan_mask_leave_in_authority_v3.sql",
  "supabase/migrations/20260811213000_personal_plan_oil_authority_v2.sql",
  "supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql",
  "supabase/migrations/20260812182731_personal_plan_stage5_v2_generation_storage.sql",
  "supabase/migrations/20260813085151_personal_plan_catalog_closure.sql",
  "supabase/migrations/20260813113000_personal_plan_stage3_comparison_presentation_metadata.sql",
  "supabase/migrations/20260814120000_personal_plan_application_use_case_variants.sql",
  "supabase/migrations/20260815074148_product_image_thumbnails.sql",
  "supabase/migrations/20260820120000_product_intake_persist_scanned_identifier.sql",
  "supabase/migrations/20260826142000_product_identifier_canonical_gtin_expand.sql",
  "supabase/migrations/20260826142100_product_identifier_canonical_gtin_writers.sql",
  "supabase/migrations/20260826142200_product_identifier_canonical_gtin_invariant.sql",
  "supabase/migrations/20260902110000_fix_product_intake_approve_operation_ambiguity.sql",
  "supabase/migrations/20260902160000_scan_expansion_batch_v1_executor.sql",
] as const

/**
 * Slices that remove statements this harness cannot host — each one is a
 * data-repair or cross-feature statement, never a guard on the path under test:
 *  - 20260812182731: an unrelated ALTER on `application_guidance_protocols`.
 *  - 20260813085151: the one-off OLAPLEX No.0 retirement DO block.
 *  - 20260814120000: the two backfill DO blocks that call launch-cohort executors.
 *  - 20260815074148 / 20260826142100: the Stage-3 search RPC and the REVOKEs on
 *    the retired launch-cohort executors.
 */
function trimMigration(path: string, sql: string): string {
  if (path.includes("20260812182731")) {
    return sql.slice(sql.indexOf("ALTER TABLE public.product_application_protocols"))
  }
  if (path.includes("20260813085151")) {
    return sql.slice(sql.indexOf("-- Preserve the complete V1 publication assertion"))
  }
  if (path.includes("20260814120000")) {
    return sql.slice(0, sql.indexOf("DO $exact_bundle_family_mapping$"))
  }
  if (path.includes("20260815074148")) {
    return sql.slice(0, sql.indexOf("-- V3 delegates every authorization"))
  }
  if (path.includes("20260826142100")) {
    return sql.slice(0, sql.indexOf("-- These launch-cohort executors were built"))
  }
  return sql
}

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  for (const migration of MIGRATIONS) {
    const sql = (await readFile(new URL(migration, ROOT), "utf8")).replace(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;",
      "",
    )
    await pg.exec(trimMigration(migration, sql))
  }
  await pg.query("INSERT INTO public.profiles (id) VALUES ($1)", [OPERATOR])
  return pg
}

// ---------------------------------------------------------------------------
// Fixture: the reviewed mask research manifest (T4, Claude lane) + an operator
// supplement. Using the real manifest keeps the adapter honest about the exact
// shapes the research lane emits.
// ---------------------------------------------------------------------------

async function maskManifest(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(new URL("plans/scan-db-expansion/research/mask-manifest.json", ROOT), "utf8"),
  ) as Record<string, unknown>
}

function supplementFor(
  manifest: Record<string, unknown>,
  batchId = "scan-expansion-pilot-mask",
): ExpansionApplySupplement {
  const products: ExpansionApplySupplement["products"] = {}
  for (const entry of manifest.products as Array<{ final: Record<string, unknown> }>) {
    const product = entry.final.product as { brand: string; name: string }
    const key = expansionItemKey(product.brand, product.name)
    const evidenceSourceTexts: Record<string, string> = {}
    for (const evidence of entry.final.evidence as Array<{
      fact_key: string
      source_url: string
    }>) {
      evidenceSourceTexts[`${evidence.fact_key}|${evidence.source_url}`] =
        `Belegtext von ${evidence.source_url}`
    }
    products[key] = {
      image_url: `${IMAGE_PREFIX}${key}.png`,
      affiliate_link: (entry.final.product as { candidate_image: { source_url: string } })
        .candidate_image.source_url,
      purchase_link_status: "available",
      checked_at: "2026-09-02T09:00:00.000Z",
      evidence_source_texts: evidenceSourceTexts,
      mask_wait_copy_de: "7 Sekunden einwirken lassen.",
    }
  }
  return {
    batch_id: batchId,
    operator_profile_id: OPERATOR,
    reviewed_head: REVIEWED_HEAD,
    products,
  }
}

type Prepared = {
  batch: ExpansionApplyBatch
  batchJson: string
  fingerprint: string
  parked: ReturnType<typeof buildExpansionApplyBatch>["parked"]
}

function serialize(batch: ExpansionApplyBatch): Prepared {
  const batchJson = JSON.stringify(batch)
  return {
    batch,
    batchJson,
    fingerprint: createHash("sha256").update(batchJson, "utf8").digest("hex"),
    parked: [],
  }
}

async function approve(pg: PGlite, prepared: Prepared) {
  await pg.query(
    `INSERT INTO public.scan_expansion_approved_batches
       (batch_id, batch_fingerprint, reviewed_head, reviewed_by, item_count)
     VALUES ($1, $2, $3, 'nick', $4)`,
    [prepared.batch.batch_id, prepared.fingerprint, REVIEWED_HEAD, prepared.batch.items.length],
  )
}

async function applyItem(
  pg: PGlite,
  prepared: Prepared,
  itemKey: string,
  options: { enabled?: boolean; reviewedBy?: string; reviewedHead?: string } = {},
) {
  return pg.query<{ item_key: string; product_id: string; outcome: string }>(
    `SELECT * FROM public.apply_scan_expansion_batch_v1($1, $2, $3, $4, $5, $6)`,
    [
      prepared.batchJson,
      prepared.fingerprint,
      options.reviewedHead ?? REVIEWED_HEAD,
      options.reviewedBy ?? "nick",
      itemKey,
      options.enabled ?? true,
    ],
  )
}

async function prepareMaskBatch(): Promise<Prepared> {
  const manifest = await maskManifest()
  const built = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })
  return { ...serialize(built.batch), parked: built.parked }
}

// ---------------------------------------------------------------------------

const REPAIR_MIGRATION =
  "supabase/migrations/20260902110000_fix_product_intake_approve_operation_ambiguity.sql"

async function repairSql(): Promise<string> {
  return readFile(new URL(REPAIR_MIGRATION, ROOT), "utf8")
}

async function boundaryBody(pg: PGlite): Promise<string> {
  const result = await pg.query<{ prosrc: string }>(
    `SELECT proc.prosrc
     FROM pg_catalog.pg_proc proc
     JOIN pg_catalog.pg_namespace namespace ON namespace.oid = proc.pronamespace
     WHERE namespace.nspname = 'public'
       AND proc.proname = 'product_intake_approve_reviewed_product_before_thumbnail_image'`,
  )
  return result.rows[0]!.prosrc
}

/** Overwrite the boundary body with an arbitrary one, bypassing the repair's guard. */
async function forceBoundaryBody(pg: PGlite, body: string) {
  await pg.exec(`
    CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product_before_thumbnail_image(
      p_submission_id uuid, p_final_payload jsonb, p_spec_operations jsonb,
      p_reviewed_by text, p_reviewed_at timestamptz DEFAULT now(), p_review_notes text DEFAULT NULL
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
    AS $forced$
    BEGIN
      ${body}
      RETURN '{}'::jsonb;
    END;
    $forced$;
  `)
}

test("the boundary repair converges both reviewed pre-states and refuses unknown drift", async (t) => {
  const pg = await migratedDatabase(t)
  const repair = await repairSql()

  // Pre-state (a): the migration chain installed the DEFECTIVE body
  // (20260814120000) and the repair replaced it during migratedDatabase().
  const repaired = await boundaryBody(pg)
  assert.ok(repaired.includes("spec_operation(value)"))
  assert.ok(
    !repaired.includes("'[]'::jsonb)) operation"),
    "the ambiguous alias must be gone after a fresh replay",
  )

  // Pre-state (b), repo form: replaying the repair over its own output is a
  // behavioural no-op and must not fail.
  await pg.exec(repair)
  assert.equal(await boundaryBody(pg), repaired)

  // Pre-state (b), PRODUCTION form: prod was fixed out of band as
  // `AS spec_operation(value)`. Same logic, different text — must be accepted
  // and converged onto the repo body.
  await pg.exec(
    repair
      .slice(repair.indexOf("CREATE OR REPLACE FUNCTION"))
      .replace(") spec_operation(value)", ") AS spec_operation(value)"),
  )
  const prodShaped = await boundaryBody(pg)
  assert.ok(prodShaped.includes("AS spec_operation(value)"), "prod-shaped pre-state seeded")
  await pg.exec(repair)
  assert.equal(await boundaryBody(pg), repaired, "prod-shaped body converges onto the repo body")

  // Unknown body, nothing in common with the reviewed ones → hard fail.
  await forceBoundaryBody(pg, "RAISE NOTICE 'unrelated body';")
  await assert.rejects(pg.exec(repair), /matches neither reviewed pre-state/)

  // Unknown body that carries the fix marker but has lost the reviewed logic.
  await forceBoundaryBody(pg, "-- spec_operation(value)\n      RAISE NOTICE 'gutted body';")
  await assert.rejects(pg.exec(repair), /matches neither reviewed pre-state/)
})

test("a drifted body that keeps every landmark but changes behaviour is refused", async (t) => {
  const pg = await migratedDatabase(t)
  const repair = await repairSql()

  // The reviewed body with ONE token changed: the protocol-scope guard now
  // accepts an empty `rows` array. Every marker the old landmark guard looked
  // for is still present — the fixed alias, both RAISE messages, the delegate
  // call, the ON CONFLICT target and all three spec tables — so a marker-based
  // guard would have overwritten this silently. Only a full-body comparison
  // catches it.
  const drifted = repair
    .slice(repair.indexOf("CREATE OR REPLACE FUNCTION"))
    .replace(
      "pg_catalog.jsonb_array_length(spec_operation.value->'rows') > 0",
      "pg_catalog.jsonb_array_length(spec_operation.value->'rows') >= 0",
    )
  assert.ok(drifted.includes(">= 0"), "the behavioural mutation was applied")
  await pg.exec(drifted)

  const seeded = await boundaryBody(pg)
  for (const landmark of [
    "spec_operation(value)",
    "canonical V1/V2 protocol scope is required",
    "canonical V1/V2 protocol scope and application family must match the approved product operation",
    "product_intake_approve_reviewed_product_without_canonical_guidance",
    "ON CONFLICT (product_id, category, role, application_family)",
    "public.product_mask_specs",
    "public.product_leave_in_specs",
    "public.product_oil_specs",
  ]) {
    assert.ok(seeded.includes(landmark), `landmark still present: ${landmark}`)
  }

  await assert.rejects(pg.exec(repair), /matches neither reviewed pre-state/)
  assert.equal(await boundaryBody(pg), seeded, "the drifted body was not overwritten")
})

test("the repair pins the sha256 of every body it is willing to accept", async () => {
  const repair = await repairSql()

  /** The `$function$ … $function$` body of one function in a migration file. */
  function functionBody(sql: string, name: string): string {
    const head = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
    assert.ok(head >= 0, `function not found: ${name}`)
    const start = sql.indexOf("AS $function$", head) + "AS $function$".length
    const end = sql.indexOf("$function$;", start)
    assert.ok(end > start, `unterminated body: ${name}`)
    return sql.slice(start, end)
  }
  const digest = (body: string) =>
    createHash("sha256").update(body.replace(/\s+/g, ""), "utf8").digest("hex")

  const legacy = await readFile(
    new URL(
      "supabase/migrations/20260814120000_personal_plan_application_use_case_variants.sql",
      ROOT,
    ),
    "utf8",
  )
  const defective = functionBody(legacy, "product_intake_approve_reviewed_product")
  const repoFixed = functionBody(
    repair,
    "product_intake_approve_reviewed_product_before_thumbnail_image",
  )
  const prodFixed = repoFixed.replace(") spec_operation(value)", ") AS spec_operation(value)")

  // The two logical pre-states really are the same reviewed logic: rewriting
  // only the four ambiguous alias references turns one into the other. That is
  // what makes converging them a behavioural no-op — and it is an assertion,
  // not a comment, so a future edit to either body has to face it.
  assert.notEqual(defective, repoFixed)
  assert.equal(
    defective
      .replace("'[]'::jsonb)) operation\n", "'[]'::jsonb)) spec_operation(value)\n")
      .replace("WHERE operation->>'table'", "WHERE spec_operation.value->>'table'")
      .replace("jsonb_typeof(operation->'rows')", "jsonb_typeof(spec_operation.value->'rows')")
      .replace(
        "jsonb_array_length(operation->'rows')",
        "jsonb_array_length(spec_operation.value->'rows')",
      ),
    repoFixed,
    "the repair must change the alias and nothing else",
  )
  assert.notEqual(prodFixed, repoFixed, "the production form is textually distinct")

  for (const expected of [digest(defective), digest(repoFixed), digest(prodFixed)]) {
    assert.ok(
      repair.includes(expected),
      `the repair migration must pin the normalized sha256 ${expected}`,
    )
  }
})

test("preflight parks incomplete products and publishes the rest through the boundary", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)

  // Three of the six reviewed mask products carry a genuine deviation (and one of
  // those also has an excluded EAN) — they are parked, never sent (F-04).
  assert.equal(prepared.batch.items.length, 3)
  assert.equal(prepared.parked.length, 3)
  assert.ok(
    prepared.parked.every((entry) =>
      entry.gaps.some((gap) => gap.startsWith("deviation_requires_review")),
    ),
  )

  for (const item of prepared.batch.items) {
    const result = await applyItem(pg, prepared, item.item_key)
    assert.equal(result.rows[0]?.outcome, "applied", item.item_key)
  }

  const products = await pg.query<{
    id: string
    origin: string
    is_chaarlie_recommended: boolean
    lifecycle_status: string
    suitable_thicknesses: string[]
    image_url: string
  }>(
    `SELECT id, origin, is_chaarlie_recommended, lifecycle_status, suitable_thicknesses, image_url
     FROM public.products ORDER BY name`,
  )
  assert.equal(products.rows.length, 3)
  for (const row of products.rows) {
    assert.equal(row.origin, "curated")
    assert.equal(row.is_chaarlie_recommended, false, "R3: scannable-only")
    assert.equal(row.lifecycle_status, "active")
    assert.ok(row.suitable_thicknesses.length > 0)
    assert.ok(row.image_url.startsWith(IMAGE_PREFIX))
  }

  // The boundary — not this adapter — wrote the facts, identifiers and protocols.
  const protocols = await pg.query<{
    role: string
    application_family: string
    guidance_payload: unknown
    guidance_payload_v2: unknown
    source_url: string
    source_text: string
  }>(
    `SELECT role, application_family, guidance_payload, guidance_payload_v2, source_url, source_text
     FROM public.product_application_protocols`,
  )
  assert.equal(protocols.rows.length, 3)
  for (const row of protocols.rows) {
    assert.equal(row.role, "intensive_conditioning_mask")
    assert.equal(row.application_family, "post_shampoo_rinse_out_mask")
    assert.ok(row.guidance_payload)
    assert.ok(row.guidance_payload_v2, "V2 pointer is derived by the boundary")
    assert.ok(row.source_url.startsWith("https://"))
    assert.ok(row.source_text.length > 0, "F-06: per-product protocol source")
  }

  const evidence = await pg.query(
    "SELECT count(*)::int AS count FROM public.personal_plan_catalog_fact_evidence",
  )
  assert.ok((evidence.rows[0] as { count: number }).count >= 3)

  const ledger = await pg.query<{ product_key: string; reviewed_by: string }>(
    "SELECT product_key, reviewed_by FROM public.catalog_enrichment_applied_items",
  )
  assert.equal(ledger.rows.length, 3)
  assert.ok(ledger.rows.every((row) => row.reviewed_by === "nick"))

  // The adapter mints exactly one operator-owned submission per product and the
  // boundary closes it in the same transaction.
  const submissions = await pg.query<{ source: string; status: string }>(
    "SELECT source, status FROM public.product_submissions",
  )
  assert.equal(submissions.rows.length, 3)
  assert.ok(submissions.rows.every((row) => row.source === "catalog_expansion"))
  assert.ok(submissions.rows.every((row) => row.status === "approved"))
})

test("a parked product cannot be applied by naming its item key", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)

  const parkedKey = prepared.parked.find((entry) => entry.item_key)?.item_key
  assert.ok(parkedKey)
  await assert.rejects(applyItem(pg, prepared, parkedKey), /is not part of batch/)
  const products = await pg.query("SELECT count(*)::int AS count FROM public.products")
  assert.equal((products.rows[0] as { count: number }).count, 0)
})

test("a duplicate canonical GTIN is rejected before anything is written", async (t) => {
  const pg = await migratedDatabase(t)
  const base = await prepareMaskBatch()
  const [first, second] = base.batch.items
  assert.ok(first && second && first.kind === "new_product" && second.kind === "new_product")

  // Same reviewed formulation, two item keys claiming the same barcode.
  const clash = structuredClone(base.batch)
  const clashSecond = clash.items[1] as typeof second
  clashSecond.identifiers = structuredClone(first.identifiers)
  const prepared = serialize(clash)
  await approve(pg, prepared)

  await assert.rejects(applyItem(pg, prepared, first.item_key), /duplicate canonical GTIN/)
  const products = await pg.query("SELECT count(*)::int AS count FROM public.products")
  assert.equal((products.rows[0] as { count: number }).count, 0)
})

test("a GTIN already owned by another product is rejected by the canonical-owner guard", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)

  const first = prepared.batch.items[0]!
  const owner = await pg.query<{ id: string }>(
    `INSERT INTO public.products (name, category_key, origin, is_active, lifecycle_status)
     VALUES ('Fremdprodukt', 'mask', 'user_submitted', true, 'active') RETURNING id`,
  )
  await pg.query(
    `INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, source)
     VALUES ($1, 'ean', $2, 'curated')`,
    [owner.rows[0]!.id, first.identifiers[0]!.value],
  )

  await assert.rejects(applyItem(pg, prepared, first.item_key), /already belongs to product/)
})

test("one bad product fails alone; the products around it stay committed", async (t) => {
  const pg = await migratedDatabase(t)
  const base = await prepareMaskBatch()

  // Hand-corrupt the second item so the DEFERRED curated-publication gate rejects
  // it at COMMIT. The TS layer would have parked this; the DB must fail closed on
  // its own, and only for that one product.
  const broken = structuredClone(base.batch)
  const brokenItem = broken.items[1] as Extract<
    ExpansionApplyBatch["items"][number],
    { kind: "new_product" }
  >
  for (const operation of brokenItem.spec_operations) {
    if (operation.table === "product_mask_specs") {
      for (const row of operation.rows as Array<Record<string, unknown>>) {
        row.functional_benefits = []
      }
    }
  }
  const prepared = serialize(broken)
  await approve(pg, prepared)

  const first = await applyItem(pg, prepared, broken.items[0]!.item_key)
  assert.equal(first.rows[0]?.outcome, "applied")

  await assert.rejects(
    applyItem(pg, prepared, brokenItem.item_key),
    /curated publication requires complete category facts/,
  )

  const third = await applyItem(pg, prepared, broken.items[2]!.item_key)
  assert.equal(third.rows[0]?.outcome, "applied")

  const products = await pg.query<{ name: string }>("SELECT name FROM public.products")
  assert.equal(products.rows.length, 2, "only the failing product rolled back")
  const submissions = await pg.query(
    "SELECT count(*)::int AS count FROM public.product_submissions",
  )
  assert.equal(
    (submissions.rows[0] as { count: number }).count,
    2,
    "the failing product's synthetic submission rolled back with it",
  )
})

test("replay is idempotent and full-bundle readback catches post-apply drift", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)

  const item = prepared.batch.items[0]!
  const applied = await applyItem(pg, prepared, item.item_key)
  assert.equal(applied.rows[0]?.outcome, "applied")

  const replay = await applyItem(pg, prepared, item.item_key)
  assert.equal(replay.rows[0]?.outcome, "replayed")
  assert.equal(replay.rows[0]?.product_id, applied.rows[0]?.product_id)
  const ledger = await pg.query(
    "SELECT count(*)::int AS count FROM public.catalog_enrichment_applied_items",
  )
  assert.equal((ledger.rows[0] as { count: number }).count, 1)

  // F-07: replay compares the FULL bundle, not just the ledger fingerprints.
  await pg.query(
    "UPDATE public.personal_plan_catalog_fact_evidence SET source_text = 'manuell verändert' WHERE product_id = $1",
    [applied.rows[0]!.product_id],
  )
  await assert.rejects(applyItem(pg, prepared, item.item_key), /fact evidence drift/)

  await pg.query(
    "UPDATE public.personal_plan_catalog_fact_evidence SET source_text = $2 WHERE product_id = $1",
    [applied.rows[0]!.product_id, item.kind === "new_product" ? item.evidence[0]!.source_text : ""],
  )
  await pg.query("UPDATE public.products SET image_url = $2 WHERE id = $1", [
    applied.rows[0]!.product_id,
    `${IMAGE_PREFIX}tampered.png`,
  ])
  await assert.rejects(applyItem(pg, prepared, item.item_key), /lifecycle\/presentation drift/)
})

test("promotion is unreachable: an item that asks for the flag is rejected", async (t) => {
  const pg = await migratedDatabase(t)
  const base = await prepareMaskBatch()

  const sneaky = structuredClone(base.batch)
  const item = sneaky.items[0] as Extract<
    ExpansionApplyBatch["items"][number],
    { kind: "new_product" }
  >
  ;(item.final_payload.product as Record<string, unknown>).is_chaarlie_recommended = true
  const prepared = serialize(sneaky)
  await approve(pg, prepared)

  await assert.rejects(
    applyItem(pg, prepared, item.item_key),
    /may never request a recommendation flag/,
  )

  const alsoSneaky = structuredClone(base.batch)
  const alsoItem = alsoSneaky.items[0] as Extract<
    ExpansionApplyBatch["items"][number],
    { kind: "new_product" }
  >
  ;(alsoItem.product_updates as Record<string, unknown>).is_chaarlie_recommended = true
  const preparedToo = serialize(alsoSneaky)
  preparedToo.batch.batch_id = alsoSneaky.batch_id
  await pg.query("DELETE FROM public.scan_expansion_approved_batches")
  await approve(pg, preparedToo)
  await assert.rejects(
    applyItem(pg, preparedToo, alsoItem.item_key),
    /may never request a recommendation flag/,
  )

  const products = await pg.query("SELECT count(*)::int AS count FROM public.products")
  assert.equal((products.rows[0] as { count: number }).count, 0)
})

test("kill switch, reviewer, head and approval binding all fail closed", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)
  const itemKey = prepared.batch.items[0]!.item_key

  await assert.rejects(
    applyItem(pg, prepared, itemKey, { enabled: false }),
    /kill switch is disabled/,
  )
  await assert.rejects(
    applyItem(pg, prepared, itemKey, { reviewedBy: "jonas" }),
    /reviewer must be nick/,
  )
  await assert.rejects(
    applyItem(pg, prepared, itemKey, { reviewedHead: "c".repeat(40) }),
    /does not match its approved fingerprint\/head/,
  )

  // An unapproved batch (or a re-serialized one) can never execute.
  await pg.query("DELETE FROM public.scan_expansion_approved_batches")
  await assert.rejects(applyItem(pg, prepared, itemKey), /is not approved/)

  const products = await pg.query("SELECT count(*)::int AS count FROM public.products")
  assert.equal((products.rows[0] as { count: number }).count, 0)
})

test("existing-product update renames and adds an identifier through the same guards", async (t) => {
  const pg = await migratedDatabase(t)
  const productId = "22222222-2222-4222-8222-222222222222"
  // A real rename target is a complete curated product, so seed the whole
  // publication bundle in ONE transaction — the gate's constraint triggers are
  // DEFERRABLE INITIALLY DEFERRED and would otherwise reject a bare product row.
  const seedSource = "https://www.dm.de/p/d/1343854/l-oreal-paris-elvital"
  const seedProtocol = buildExpansionProtocolRow("TPL-SHAMPOO-STD", {
    productId,
    evidence: [{ sourceUrl: seedSource, sourceType: "retailer", checkedAt: "2026-09-02" }],
  })
  const seedV2 = buildProductApplicationPointerV2({
    sourceRole: seedProtocol.role,
    guidancePayload: seedProtocol.guidance_payload as never,
    applicationState: seedProtocol.application_state,
  })
  await pg.exec(`
    INSERT INTO public.products
      (id, name, brand, category_key, origin, is_active, lifecycle_status,
       is_chaarlie_recommended, image_url, suitable_thicknesses)
    VALUES ('${productId}', 'Ultimate Shampoo', 'L''Oréal Paris Elvital', 'shampoo', 'curated',
            true, 'active', false, '${IMAGE_PREFIX}ultimate-shampoo.png',
            ARRAY['fine','normal','coarse']::text[]);
    INSERT INTO public.product_shampoo_specs
      (product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity)
    VALUES ('${productId}', 'fine', 'standard', 'balanced', 'mild'),
           ('${productId}', 'normal', 'standard', 'balanced', 'mild'),
           ('${productId}', 'coarse', 'standard', 'balanced', 'mild');
    INSERT INTO public.product_application_protocols
      (product_id, category, role, application_stage, application_state, placement,
       contact_time_seconds, rinse_action, reapplication, instruction_modifiers,
       source_label, source_url, source_text, guidance_payload, guidance_payload_v2)
    VALUES ('${productId}', 'shampoo', ${quote(seedProtocol.role)},
            ${quote(seedProtocol.application_stage)}, ${quote(seedProtocol.application_state)},
            ${quote(seedProtocol.placement)}, ${seedProtocol.contact_time_seconds ?? "NULL"},
            ${quote(seedProtocol.rinse_action)}, ${quote(seedProtocol.reapplication)}, '[]'::jsonb,
            'dm.de Produktseite', ${quote(seedSource)}, 'Ins nasse Haar einmassieren und ausspülen.',
            ${quote(JSON.stringify(seedProtocol.guidance_payload))}::jsonb,
            ${quote(JSON.stringify(seedV2))}::jsonb);
  `)

  const manifest = {
    batch_id: "scan-expansion-existing",
    generated_at: "2026-09-02T09:00:00.000Z",
    products: [],
    existing_product_updates: [
      {
        product_id: productId,
        rename: {
          from: "Ultimate Shampoo",
          to: "Elvital Glycolic Gloss Shampoo",
          reason:
            "Katalogname war der Platzhalter der Erstaufnahme; korrekter Handelsname laut dm.de.",
        },
        add_identifiers: [
          {
            type: "ean" as const,
            value: "3600524128173",
            cross_source_agreement: true,
            source_urls: ["https://www.dm.de/p/d/1343854/l-oreal-paris-elvital"],
            excluded_from_apply: false,
          },
        ],
      },
    ],
  }

  const built = buildExpansionApplyBatch({
    manifest,
    supplement: {
      batch_id: "scan-expansion-existing",
      operator_profile_id: OPERATOR,
      reviewed_head: REVIEWED_HEAD,
      products: {},
    },
    existingProducts: [
      {
        id: productId,
        name: "Ultimate Shampoo",
        brand: "L'Oréal Paris Elvital",
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
      },
    ],
  })
  assert.equal(built.parked.length, 0, JSON.stringify(built.parked))
  const prepared = serialize(built.batch)
  await approve(pg, prepared)

  const result = await applyItem(pg, prepared, `existing:${productId}`)
  assert.equal(result.rows[0]?.outcome, "applied")

  const renamed = await pg.query<{ name: string; is_chaarlie_recommended: boolean }>(
    "SELECT name, is_chaarlie_recommended FROM public.products WHERE id = $1",
    [productId],
  )
  assert.equal(renamed.rows[0]?.name, "Elvital Glycolic Gloss Shampoo")
  assert.equal(renamed.rows[0]?.is_chaarlie_recommended, false)

  const identifiers = await pg.query<{ identifier_value: string; source: string }>(
    "SELECT identifier_value, source FROM public.product_identifiers WHERE product_id = $1",
    [productId],
  )
  assert.equal(identifiers.rows.length, 1)
  assert.equal(identifiers.rows[0]?.identifier_value, "3600524128173")
  assert.match(identifiers.rows[0]!.source, /^scan-db-expansion:/)

  const replay = await applyItem(pg, prepared, `existing:${productId}`)
  assert.equal(replay.rows[0]?.outcome, "replayed")

  // A rename whose precondition has moved on must not re-fire.
  await pg.query("DELETE FROM public.catalog_enrichment_applied_items")
  await assert.rejects(
    applyItem(pg, prepared, `existing:${productId}`),
    /identity\/lifecycle drift/,
  )
})

test("an open unresolved submission on the same GTIN blocks the apply", async (t) => {
  const pg = await migratedDatabase(t)
  const prepared = await prepareMaskBatch()
  await approve(pg, prepared)
  const item = prepared.batch.items[0]!

  await pg.query(
    `INSERT INTO public.product_submissions
       (user_id, source, intake_method, category, frequency_range, status,
        scanned_identifier_type, scanned_identifier_value)
     VALUES ($1, 'scan', 'manual', 'mask', NULL, 'ready_for_review', 'ean', $2)`,
    [OPERATOR, item.identifiers[0]!.value],
  )

  await assert.rejects(
    applyItem(pg, prepared, item.item_key),
    /open submission GTIN overlap requires review/,
  )
})
