-- Personal Plan category readiness: additive category references, exact
-- category-local product facts, and shared role-keyed application protocols.
-- Catalog enrichment and legacy category reconciliation intentionally remain
-- separate, reviewed work.

INSERT INTO public.product_categories (
  key, display_name_de, is_catalog_supported, is_intake_supported, sort_order
)
VALUES
  ('heat_protectant', 'Hitzeschutz', true, true, 90),
  ('scalp_care', 'Kopfhautpflege', true, true, 160)
ON CONFLICT (key) DO UPDATE
SET
  display_name_de = EXCLUDED.display_name_de,
  is_catalog_supported = true,
  is_intake_supported = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Preserve existing reviewed values while restoring the signed tri-state
-- contract for future Leave-in review. No existing row is rewritten here.
ALTER TABLE public.product_leave_in_specs
  ALTER COLUMN provides_heat_protection DROP NOT NULL,
  ALTER COLUMN provides_heat_protection DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.product_heat_protectant_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'spray'
    CHECK (format = 'spray'),
  provides_heat_protection boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_oil_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  provides_heat_protection boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_scalp_care_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  primary_role text CHECK (
    primary_role IN (
      'scalp_comfort',
      'scalp_flake_oil_adjunct',
      'density_claim_tonic',
      'scalp_exfoliant'
    )
  ),
  presentation_format text NOT NULL DEFAULT 'unknown' CHECK (
    presentation_format IN ('serum', 'tonic', 'lotion_or_fluid', 'oil', 'scrub', 'other', 'unknown')
  ),
  rinse_mode text CHECK (rinse_mode IN ('leave_on', 'rinse_off')),
  application_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_application_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category text NOT NULL REFERENCES public.product_categories(key) ON DELETE RESTRICT,
  role text NOT NULL CHECK (
    role IN (
      'pre_heat_protection',
      'scalp_comfort',
      'scalp_flake_oil_adjunct',
      'density_claim_tonic',
      'scalp_exfoliant'
    )
  ),
  cadence jsonb,
  application_stage text,
  application_state text CHECK (application_state IN ('damp', 'dry', 'either')),
  placement text,
  contact_time_seconds integer CHECK (contact_time_seconds IS NULL OR contact_time_seconds >= 0),
  rinse_action text,
  reapplication text CHECK (reapplication IN ('required', 'optional', 'not_stated')),
  instruction_modifiers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(instruction_modifiers) = 'array'),
  source_label text,
  source_url text,
  source_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_application_protocols_role_category_check CHECK (
    (role = 'pre_heat_protection' AND category IN ('heat_protectant', 'leave_in', 'oil'))
    OR (role <> 'pre_heat_protection' AND category = 'scalp_care')
  ),
  CONSTRAINT product_application_protocols_heat_fields_check CHECK (
    role <> 'pre_heat_protection'
    OR (application_state IS NOT NULL AND reapplication IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_product_heat_protectant_specs_capability
  ON public.product_heat_protectant_specs (provides_heat_protection);
CREATE INDEX IF NOT EXISTS idx_product_oil_specs_heat_capability
  ON public.product_oil_specs (provides_heat_protection);
CREATE INDEX IF NOT EXISTS idx_product_scalp_care_specs_primary_role
  ON public.product_scalp_care_specs (primary_role);
CREATE INDEX IF NOT EXISTS idx_product_application_protocols_product_role
  ON public.product_application_protocols (product_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_application_protocols_product_category_role
  ON public.product_application_protocols (product_id, category, role);

DROP TRIGGER IF EXISTS set_updated_at_product_heat_protectant_specs ON public.product_heat_protectant_specs;
CREATE TRIGGER set_updated_at_product_heat_protectant_specs
  BEFORE UPDATE ON public.product_heat_protectant_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_product_oil_specs ON public.product_oil_specs;
CREATE TRIGGER set_updated_at_product_oil_specs
  BEFORE UPDATE ON public.product_oil_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_product_scalp_care_specs ON public.product_scalp_care_specs;
CREATE TRIGGER set_updated_at_product_scalp_care_specs
  BEFORE UPDATE ON public.product_scalp_care_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_product_application_protocols ON public.product_application_protocols;
CREATE TRIGGER set_updated_at_product_application_protocols
  BEFORE UPDATE ON public.product_application_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_heat_protectant_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_oil_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_scalp_care_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_application_protocols ENABLE ROW LEVEL SECURITY;

DO $policy$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_heat_protectant_specs',
    'product_oil_specs',
    'product_scalp_care_specs',
    'product_application_protocols'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_admin_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      )',
      table_name || '_admin_all', table_name
    );
  END LOOP;
END;
$policy$;

DO $grant$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_heat_protectant_specs',
    'product_oil_specs',
    'product_scalp_care_specs',
    'product_application_protocols'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END;
$grant$;

-- Keep the current dispatcher body intact under a private implementation name.
-- The public signature below adds the Personal Plan user-product completion
-- path without altering the established legacy usage transition or any of its
-- existing specification branches.
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_legacy;
-- Preserve the reviewed legacy implementation's existing function settings:
-- its body contains unqualified references and changing only search_path would
-- make every established category branch fail. The new wrapper below is fully
-- qualified and uses an empty search path.

CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product(
  p_submission_id uuid,
  p_final_payload jsonb,
  p_spec_operations jsonb,
  p_reviewed_by text,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  submission_row public.product_submissions%ROWTYPE;
  approval_result jsonb;
  approved_product_id uuid;
  operation jsonb;
  operation_table text;
  legacy_spec_operations jsonb;
BEGIN
  SELECT *
  INTO submission_row
  FROM public.product_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF submission_row.id IS NULL THEN
    RAISE EXCEPTION 'product submission not found';
  END IF;

  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  INTO legacy_spec_operations
  FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  WHERE (value ->> 'table') IS NULL
    OR (value ->> 'table') NOT IN (
      'product_heat_protectant_specs',
      'product_oil_specs',
      'product_scalp_care_specs',
      'product_application_protocols'
    );

  approval_result := public.product_intake_approve_reviewed_product_legacy(
    p_submission_id,
    p_final_payload,
    legacy_spec_operations,
    p_reviewed_by,
    p_reviewed_at,
    p_review_notes
  );
  approved_product_id := (approval_result ->> 'product_id')::uuid;

  FOR operation IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  LOOP
    operation_table := operation ->> 'table';

    IF operation_table = 'product_heat_protectant_specs' THEN
      INSERT INTO public.product_heat_protectant_specs (
        product_id, format, provides_heat_protection
      )
      SELECT
        approved_product_id,
        COALESCE(row_data.format, 'spray'),
        row_data.provides_heat_protection
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        format text,
        provides_heat_protection boolean
      )
      ON CONFLICT (product_id) DO UPDATE
        SET format = EXCLUDED.format,
            provides_heat_protection = EXCLUDED.provides_heat_protection,
            updated_at = now();
    ELSIF operation_table = 'product_oil_specs' THEN
      INSERT INTO public.product_oil_specs (
        product_id, provides_heat_protection
      )
      SELECT
        approved_product_id,
        row_data.provides_heat_protection
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        provides_heat_protection boolean
      )
      ON CONFLICT (product_id) DO UPDATE
        SET provides_heat_protection = EXCLUDED.provides_heat_protection,
            updated_at = now();
    ELSIF operation_table = 'product_scalp_care_specs' THEN
      INSERT INTO public.product_scalp_care_specs (
        product_id, primary_role, presentation_format, rinse_mode, application_instructions
      )
      SELECT
        approved_product_id,
        row_data.primary_role,
        COALESCE(row_data.presentation_format, 'unknown'),
        row_data.rinse_mode,
        row_data.application_instructions
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        primary_role text,
        presentation_format text,
        rinse_mode text,
        application_instructions text
      )
      ON CONFLICT (product_id) DO UPDATE
        SET primary_role = EXCLUDED.primary_role,
            presentation_format = EXCLUDED.presentation_format,
            rinse_mode = EXCLUDED.rinse_mode,
            application_instructions = EXCLUDED.application_instructions,
            updated_at = now();
    ELSIF operation_table = 'product_application_protocols' THEN
      INSERT INTO public.product_application_protocols (
        product_id, category, role, cadence, application_stage, application_state,
        placement, contact_time_seconds, rinse_action, reapplication,
        instruction_modifiers, source_label, source_url, source_text
      )
      SELECT
        approved_product_id,
        row_data.category,
        row_data.role,
        row_data.cadence,
        row_data.application_stage,
        row_data.application_state,
        row_data.placement,
        row_data.contact_time_seconds,
        row_data.rinse_action,
        row_data.reapplication,
        COALESCE(row_data.instruction_modifiers, '[]'::jsonb),
        row_data.source_label,
        row_data.source_url,
        row_data.source_text
      FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
        category text,
        role text,
        cadence jsonb,
        application_stage text,
        application_state text,
        placement text,
        contact_time_seconds integer,
        rinse_action text,
        reapplication text,
        instruction_modifiers jsonb,
        source_label text,
        source_url text,
        source_text text
      )
      ON CONFLICT (product_id, category, role) DO UPDATE
        SET cadence = EXCLUDED.cadence,
            application_stage = EXCLUDED.application_stage,
            application_state = EXCLUDED.application_state,
            placement = EXCLUDED.placement,
            contact_time_seconds = EXCLUDED.contact_time_seconds,
            rinse_action = EXCLUDED.rinse_action,
            reapplication = EXCLUDED.reapplication,
            instruction_modifiers = EXCLUDED.instruction_modifiers,
            source_label = EXCLUDED.source_label,
            source_url = EXCLUDED.source_url,
            source_text = EXCLUDED.source_text,
            updated_at = now();
    END IF;
  END LOOP;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_legacy(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;
