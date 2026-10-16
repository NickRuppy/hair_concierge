// Offline SQL owner fixture adapted from scan-expansion-batch-postgres.test.ts.
// FK shapes are synthetic; catalog guards and writers are the actual migration chain.
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
const ROOT = new URL("../../", import.meta.url)
export const OPERATOR = "11111111-1111-4111-8111-111111111111"
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

export async function loadPublicationTestDatabaseSql(): Promise<string> {
  const statements: string[] = []
  statements.push(STUB_PREREQUISITES)
  // Bondbuilder storage tests share this real approval chain. Replay its actual
  // table owner too, so nullable/domain compatibility is not proven by a stub.
  statements.push("DROP TABLE public.product_bondbuilder_specs")
  const bondbuilderBase = await readFile(
    new URL("supabase/migrations/20260416121500_add_support_category_fit_tables.sql", ROOT),
    "utf8",
  )
  statements.push(
    bondbuilderBase.slice(
      0,
      bondbuilderBase.indexOf(
        "CREATE TABLE IF NOT EXISTS public.product_deep_cleansing_shampoo_specs",
      ),
    ),
  )
  const bondbuilderLegacy = await readFile(
    new URL(
      "supabase/migrations/20260503123000_add_product_lifecycle_and_bondbuilder_specs.sql",
      ROOT,
    ),
    "utf8",
  )
  statements.push(
    bondbuilderLegacy.slice(
      bondbuilderLegacy.indexOf("ALTER TABLE public.product_bondbuilder_specs\n  ADD COLUMN"),
      bondbuilderLegacy.indexOf("DROP FUNCTION IF EXISTS public.match_products"),
    ),
  )
  for (const migration of MIGRATIONS) {
    const sql = (await readFile(new URL(migration, ROOT), "utf8")).replace(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;",
      "",
    )
    statements.push(trimMigration(migration, sql))
  }
  statements.push(`INSERT INTO public.profiles (id) VALUES ('${OPERATOR}');`)
  statements.push(`CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
    ALTER ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text);
    ALTER TABLE public.product_submissions ADD COLUMN user_facing_resolution_reason text, ADD COLUMN user_facing_next_step text,
      ADD COLUMN user_facing_missing_fields jsonb, ADD COLUMN cleanup_after timestamptz;
    GRANT ALL ON public.product_submissions,public.products,public.profiles TO service_role;`)
  const more = [
    "20260929230000_expansion_protocol_binding_repair.sql",
    "20261002132306_bondbuilder_research_profile_storage.sql",
    "20260630120000_product_intake_research_jobs.sql",
    "20260630130000_product_intake_research_artifacts_decisions.sql",
    "20260701090000_product_intake_rework_resets_attempts.sql",
    "20260701100000_product_intake_auto_enqueue.sql",
    "20261006112322_product_intake_job_attempt_hygiene.sql",
    "20261006112337_product_intake_worker_heartbeats.sql",
    "20261006141653_product_intake_job_engine_binding.sql",
    "20261007062729_product_intake_stage_artifact_kinds.sql",
    "20261015200636_product_intake_admin_notifications.sql",
    "20261016052958_product_intake_review_cycles.sql",
    "20261016104506_product_intake_review_evidence.sql",
  ]
  for (const name of more)
    statements.push(await readFile(new URL(`supabase/migrations/${name}`, ROOT), "utf8"))
  // The real Personal Plan synchronization and status guards are part of the
  // publication boundary; omit only unrelated intake-creation/search functions.
  const personalPlan = await readFile(
    new URL(
      "supabase/migrations/20260808062620_personal_plan_product_intake_user_products.sql",
      ROOT,
    ),
    "utf8",
  )
  statements.push(
    personalPlan.slice(
      personalPlan.indexOf(
        "CREATE OR REPLACE FUNCTION public.sync_user_product_from_submission_review()",
      ),
      personalPlan.indexOf(
        "CREATE OR REPLACE FUNCTION public.product_intake_create_submission_for_user_product(",
      ),
    ),
  )
  statements.push(
    await readFile(
      new URL("supabase/migrations/20261016131659_admin_publication.sql", ROOT),
      "utf8",
    ),
  )
  statements.push("SET ROLE service_role")
  return statements.join(";\n")
}

export async function publicationDatabase(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(await loadPublicationTestDatabaseSql())
  return pg
}

import {
  buildExpansionApplyBatch,
  expansionItemKey,
  type ExpansionApplySupplement,
} from "@/lib/product-intake/expansion-apply"
export async function publicationMaskBatch() {
  const manifest = JSON.parse(
    await readFile(new URL("plans/scan-db-expansion/research/mask-manifest.json", ROOT), "utf8"),
  )
  const products: ExpansionApplySupplement["products"] = {}
  for (const entry of manifest.products) {
    const key = expansionItemKey(entry.final.product.brand, entry.final.product.name)
    const texts: Record<string, string> = {}
    for (const evidence of entry.final.evidence)
      texts[`${evidence.fact_key}|${evidence.source_url}`] = `Belegtext von ${evidence.source_url}`
    const protocol = entry.final.protocols.find((p: any) => p.template_id === "TPL-MASK")
    const seconds = protocol?.contact_time?.seconds ?? null
    products[key] = {
      image_url: `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/${key}.png`,
      affiliate_link: entry.final.product.candidate_image.source_url,
      purchase_link_status: "available",
      checked_at: "2026-09-02T09:00:00.000Z",
      evidence_source_texts: texts,
      ...(seconds === null || seconds % 60 !== 0
        ? { mask_wait_copy_de: protocol?.contact_time?.source_text }
        : {}),
    }
  }
  return buildExpansionApplyBatch({
    manifest,
    supplement: {
      batch_id: "admin-review-scan-preservation",
      operator_profile_id: OPERATOR,
      reviewed_head: "b".repeat(40),
      products,
    },
  }).batch
}
