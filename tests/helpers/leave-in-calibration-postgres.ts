import { readFile } from "node:fs/promises"

/**
 * Shared PGlite prerequisites for the Leave-In calibration executor harnesses
 * (batch v1: tests/leave-in-calibration-executor-postgres.test.ts; batch v2-t20:
 * tests/leave-in-calibration-v2-t20-executor-postgres.test.ts). Moved verbatim
 * out of the v1 harness so both lanes stub the same production table shapes.
 */

const ROOT = new URL("../../", import.meta.url)

export const STUB_PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE FUNCTION extensions.digest(value bytea, algorithm text)
  RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256(value) $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category text,
  affiliate_link text,
  image_url text,
  price_eur numeric(10,2),
  currency text DEFAULT 'EUR',
  suitable_thicknesses text[] NOT NULL DEFAULT '{}',
  suitable_concerns text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  category_key text,
  origin text NOT NULL DEFAULT 'curated',
  is_chaarlie_recommended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_leave_in_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text NOT NULL,
  weight text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}',
  provides_heat_protection boolean,
  heat_protection_max_c integer,
  heat_activation_required boolean NOT NULL DEFAULT false,
  care_benefits text[] NOT NULL DEFAULT '{}',
  ingredient_flags text[] NOT NULL DEFAULT '{}',
  application_stage text[] NOT NULL DEFAULT '{towel_dry}',
  care_direction text,
  repair_support_level text,
  plan_roles text[],
  functional_benefits text[],
  category_key text NOT NULL DEFAULT 'leave_in',
  conditioner_relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_leave_in_fit_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text NOT NULL,
  conditioner_relationship text NOT NULL,
  care_benefits text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_leave_in_eligibility (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text NOT NULL,
  need_bucket text NOT NULL,
  styling_context text NOT NULL,
  category_key text NOT NULL DEFAULT 'leave_in',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, thickness, need_bucket, styling_context)
);

CREATE OR REPLACE FUNCTION public.personal_plan_application_family_identity_v1(
  p_role text, p_guidance_payload jsonb, p_guidance_payload_v2 jsonb
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_guidance_payload_v2->>'applicationFamily', p_guidance_payload->>'applicationFamily')
$$;

CREATE TABLE public.product_application_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category text NOT NULL,
  role text NOT NULL,
  cadence jsonb,
  application_stage text,
  application_state text,
  placement text,
  contact_time_seconds integer,
  rinse_action text,
  reapplication text,
  instruction_modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_label text,
  source_url text,
  source_text text,
  guidance_payload jsonb,
  guidance_payload_v2 jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  application_family text GENERATED ALWAYS AS (
    public.personal_plan_application_family_identity_v1(role, guidance_payload, guidance_payload_v2)
  ) STORED,
  category_key text GENERATED ALWAYS AS (category) STORED
);

-- Sibling spec tables the curated-publication assertion's single SQL statements
-- reference. Only the leave_in branch ever executes for this cohort, but plpgsql
-- parses the whole statement, so every table has to exist.
CREATE TABLE public.product_shampoo_specs (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, shampoo_bucket text, scalp_route text, cleansing_intensity text
);
CREATE TABLE public.product_conditioner_specs (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, protein_moisture_balance text
);
CREATE TABLE public.product_conditioner_rerank_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, repair_level text, balance_direction text
);
CREATE TABLE public.product_mask_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, repair_support_level text, functional_benefits text[]
);
CREATE TABLE public.product_oil_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text, role_support text[], provides_heat_protection boolean
);
CREATE TABLE public.product_oil_eligibility (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  thickness text, oil_subtype text, oil_purpose text, ingredient_flags text[]
);
CREATE TABLE public.product_dry_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_effect text, hair_color_fit text, scalp_sensitivity_fit text, format text
);
CREATE TABLE public.product_deep_cleansing_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text, reset_intensity text, reset_focus text, color_treated_suitability text
);
CREATE TABLE public.product_bondbuilder_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  bond_repair_intensity text, application_mode text, bond_repair_axis text,
  treatment_mode text, product_format text, usage_protocol text
);
CREATE TABLE public.product_heat_protectant_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text, provides_heat_protection boolean
);
CREATE TABLE public.product_scalp_care_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_role text, presentation_format text, rinse_mode text, application_instructions text
);
CREATE TABLE public.personal_plan_product_search_dispositions (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE
);

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
`

/**
 * The REAL curated-publication gate, loaded from its own migrations: the V1
 * assertion plus its constraint triggers (20260811212000, sliced before the
 * unrelated user-product function, per the precedent in
 * tests/personal-plan-product-disposition-reversal-postgres.test.ts), then the
 * rename + V2 wrapper (20260813085151, sliced past the one-off OLAPLEX
 * retirement block). This matters because the executor's
 * `UPDATE products SET suitable_thicknesses` is exactly the column the deferred
 * `..._on_visibility_transition` trigger watches — so the gate fires at COMMIT.
 */
export async function publicationGateSql(): Promise<string> {
  const gate = await readFile(
    new URL("supabase/migrations/20260811212000_personal_plan_curated_publication_gate.sql", ROOT),
    "utf8",
  )
  const closure = await readFile(
    new URL("supabase/migrations/20260813085151_personal_plan_catalog_closure.sql", ROOT),
    "utf8",
  )
  const gateSlice = gate.slice(
    0,
    gate.indexOf("CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_user_product"),
  )
  const closureFrom = closure.indexOf("-- Preserve the complete V1 publication assertion")
  const closureSlice = closure.slice(
    closureFrom,
    closure.indexOf(
      "CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product",
      closureFrom,
    ),
  )
  return `${gateSlice}\n${closureSlice}`
}
