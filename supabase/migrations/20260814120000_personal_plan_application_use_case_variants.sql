-- Keep stored family identity aligned with the V2 pointer builder even for the
-- two legacy rows whose V1 family described heat state instead of use case.
CREATE OR REPLACE FUNCTION public.personal_plan_application_family_identity_v1(
  p_role text,
  p_guidance_payload jsonb,
  p_guidance_payload_v2 jsonb
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT COALESCE(
    p_guidance_payload_v2->>'applicationFamily',
    CASE
      WHEN p_role = 'post_wash_leave_in'
        AND p_guidance_payload->>'applicationFamily' NOT IN (
          'post_wash_booster', 'post_wash_damp_conditioning',
          'between_wash_damp_refresh', 'between_wash_dry_care', 'post_style_finish'
        ) THEN 'post_wash_damp_conditioning'
      WHEN p_role = 'pre_heat_protection'
        AND p_guidance_payload->>'applicationFamily' NOT IN (
          'pre_heat_damp', 'pre_heat_dry', 'either_state_protection'
        ) THEN 'pre_heat_damp'
      ELSE p_guidance_payload->>'applicationFamily'
    END
  )
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_application_family_identity_v1(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_application_family_identity_v1(text, jsonb, jsonb)
  TO service_role;

-- Preserve the existing protocol payloads as authority while allowing one
-- product/Routine role to carry several researched application families.
ALTER TABLE public.product_application_protocols
  ADD COLUMN application_family text
  GENERATED ALWAYS AS (
    public.personal_plan_application_family_identity_v1(
      role, guidance_payload, guidance_payload_v2
    )
  ) STORED;

DO $application_family_backfill$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.product_application_protocols
    WHERE application_family IS NULL OR pg_catalog.btrim(application_family) = ''
  ) THEN
    RAISE EXCEPTION 'application protocol family backfill is incomplete';
  END IF;
END;
$application_family_backfill$;

ALTER TABLE public.product_application_protocols
  ALTER COLUMN application_family SET NOT NULL;

DROP INDEX IF EXISTS public.idx_product_application_protocols_product_category_role;
CREATE UNIQUE INDEX idx_product_application_protocols_product_category_role_family
  ON public.product_application_protocols (product_id, category, role, application_family);

-- Product Intake already validates canonical V1/V2 payloads. Replace only its
-- protocol identity so a second reviewed family is inserted instead of
-- overwriting the first one. V1 and V2 family names are deliberately not
-- required to match: two legacy Leave-in rows use a V1 heat-state family while
-- their V2 pointer correctly identifies the post-wash application family.
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
  approval_result jsonb;
  approved_product_id uuid;
  operation jsonb;
  legacy_spec_operations jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb)) operation
    WHERE operation->>'table' = 'product_application_protocols'
      AND pg_catalog.jsonb_typeof(operation->'rows') = 'array'
      AND pg_catalog.jsonb_array_length(operation->'rows') > 0
  ) THEN
    RAISE EXCEPTION 'canonical V1/V2 protocol scope is required';
  END IF;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_application_protocols'
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS candidate(
        category text, role text, guidance_payload jsonb, guidance_payload_v2 jsonb
      )
      WHERE candidate.guidance_payload IS NULL
        OR pg_catalog.jsonb_typeof(candidate.guidance_payload) IS DISTINCT FROM 'object'
        OR candidate.guidance_payload->>'schemaVersion' IS DISTINCT FROM '1'
        OR candidate.guidance_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
        OR candidate.guidance_payload#>>'{scope,category}' IS DISTINCT FROM candidate.category
        OR candidate.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
        OR candidate.guidance_payload_v2 IS NULL
        OR pg_catalog.jsonb_typeof(candidate.guidance_payload_v2) IS DISTINCT FROM 'object'
        OR candidate.guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
        OR candidate.guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
        OR candidate.guidance_payload_v2#>>'{scope,kind}' IS DISTINCT FROM 'product'
        OR candidate.guidance_payload_v2#>>'{scope,category}' IS DISTINCT FROM candidate.category
        OR candidate.guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
        OR candidate.guidance_payload_v2->>'sourceRole' IS DISTINCT FROM candidate.role
        OR candidate.guidance_payload_v2->>'applicationFamily' IS NULL
        OR pg_catalog.btrim(candidate.guidance_payload_v2->>'applicationFamily') = ''
        OR candidate.guidance_payload_v2#>'{runtimeBlockerCode}' IS DISTINCT FROM 'null'::jsonb
    ) THEN
      RAISE EXCEPTION 'canonical V1/V2 protocol scope and application family must match the approved product operation';
    END IF;
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(value), '[]'::jsonb)
  INTO legacy_spec_operations
  FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  WHERE (value->>'table') IS DISTINCT FROM 'product_application_protocols';

  approval_result := public.product_intake_approve_reviewed_product_without_canonical_guidance(
    p_submission_id, p_final_payload, legacy_spec_operations, p_reviewed_by, p_reviewed_at, p_review_notes
  );
  approved_product_id := (approval_result->>'product_id')::uuid;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_application_protocols'
  LOOP
    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage, application_state,
      placement, contact_time_seconds, rinse_action, reapplication,
      instruction_modifiers, source_label, source_url, source_text,
      guidance_payload, guidance_payload_v2
    )
    SELECT approved_product_id, row_data.category, row_data.role, row_data.cadence,
      row_data.application_stage, row_data.application_state, row_data.placement,
      row_data.contact_time_seconds, row_data.rinse_action, row_data.reapplication,
      COALESCE(row_data.instruction_modifiers, '[]'::jsonb), row_data.source_label,
      row_data.source_url, row_data.source_text,
      pg_catalog.jsonb_set(row_data.guidance_payload, '{scope,productId}', pg_catalog.to_jsonb(approved_product_id::text), false),
      pg_catalog.jsonb_set(row_data.guidance_payload_v2, '{scope,productId}', pg_catalog.to_jsonb(approved_product_id::text), false)
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      category text, role text, cadence jsonb, application_stage text,
      application_state text, placement text, contact_time_seconds integer,
      rinse_action text, reapplication text, instruction_modifiers jsonb,
      source_label text, source_url text, source_text text,
      guidance_payload jsonb, guidance_payload_v2 jsonb
    )
    ON CONFLICT (product_id, category, role, application_family) DO UPDATE
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
          guidance_payload = EXCLUDED.guidance_payload,
          guidance_payload_v2 = EXCLUDED.guidance_payload_v2,
          updated_at = pg_catalog.now();
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_mask_specs'
  LOOP
    UPDATE public.product_mask_specs mask
    SET repair_support_level = row_data.repair_support_level,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      repair_support_level text, functional_benefits text[]
    )
    WHERE mask.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_leave_in_specs'
  LOOP
    UPDATE public.product_leave_in_specs leave_in
    SET care_direction = row_data.care_direction,
        repair_support_level = row_data.repair_support_level,
        plan_roles = row_data.plan_roles,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      care_direction text, repair_support_level text, plan_roles text[], functional_benefits text[]
    )
    WHERE leave_in.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_oil_specs'
  LOOP
    UPDATE public.product_oil_specs oil
    SET weight = row_data.weight,
        role_support = row_data.role_support,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      weight text, role_support text[]
    )
    WHERE oil.product_id = approved_product_id;
  END LOOP;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;

-- The exact-catalog executor predates multi-family identity. Keep its existing
-- locking, validation, provenance, and replay contract, but make every lookup
-- and conflict target family-aware through the same deterministic identity.
DO $exact_bundle_family_mapping$
DECLARE
  v_definition text;
  v_old_duplicate text := $old$(SELECT count(*) FROM jsonb_array_elements(v_item->'protocols') entries(protocol)) <> (SELECT count(DISTINCT protocol->>'role') FROM jsonb_array_elements(v_item->'protocols') entries(protocol))$old$;
  v_new_duplicate text := $new$(SELECT count(*) FROM jsonb_array_elements(v_item->'protocols') entries(protocol)) <> (SELECT count(DISTINCT (protocol->>'role', public.personal_plan_application_family_identity_v1(protocol->>'role', protocol->'guidance_payload', NULL))) FROM jsonb_array_elements(v_item->'protocols') entries(protocol))$new$;
  v_old_role_match text := $old$p.role=v_protocol->>'role'$old$;
  v_new_role_match text := $new$p.role=v_protocol->>'role'
          AND p.application_family=public.personal_plan_application_family_identity_v1(v_protocol->>'role', v_protocol->'guidance_payload', NULL)$new$;
  v_old_conflict text := $old$ON CONFLICT DO NOTHING;$old$;
  v_new_conflict text := $new$ON CONFLICT (product_id,category,role,application_family) DO NOTHING;$new$;
BEGIN
  SELECT pg_get_functiondef('public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position('SET search_path TO ''''' IN v_definition) = 0
     OR position(v_old_duplicate IN v_definition) = 0
     OR position(v_old_role_match IN v_definition) = 0
     OR position(v_old_conflict IN v_definition) = 0 THEN
    RAISE EXCEPTION 'exact catalog bundle family migration cannot verify the expected executor contract';
  END IF;

  v_definition := replace(v_definition, v_old_duplicate, v_new_duplicate);
  v_definition := replace(v_definition, v_old_role_match, v_new_role_match);
  v_definition := replace(v_definition, v_old_conflict, v_new_conflict);
  EXECUTE v_definition;
END;
$exact_bundle_family_mapping$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)
  TO service_role;

-- The Stage 5 V2 artifact now carries the final reviewed family set rather
-- than one row per role. Patch its guarded executor to bind, ledger, and update
-- each exact family independently.
DO $stage5_v2_family_mapping$
DECLARE
  v_definition text;
  v_old_distinct text := $old$item->>'source_role'
       ))$old$;
  v_new_distinct text := $new$item->>'source_role',
         item#>>'{guidance_payload_v2,applicationFamily}'
       ))$new$;
  v_old_order text := $old$ORDER BY item->>'product_id', item->>'source_role'$old$;
  v_new_order text := $new$ORDER BY item->>'product_id', item->>'source_role', item#>>'{guidance_payload_v2,applicationFamily}'$new$;
  v_old_key text := $old$v_product_key := 'v2:' || v_product_id::text || ':' || v_role;$old$;
  v_new_key text := $new$v_product_key := 'v2:' || v_product_id::text || ':' || v_role || ':' || v_item#>>'{guidance_payload_v2,applicationFamily}';$new$;
  v_old_role_match text := $old$AND protocol.role = v_role$old$;
  v_new_role_match text := $new$AND protocol.role = v_role
      AND protocol.application_family = v_item#>>'{guidance_payload_v2,applicationFamily}'$new$;
BEGIN
  SELECT pg_get_functiondef('public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position('SET search_path TO ''''' IN v_definition) = 0
     OR position(v_old_distinct IN v_definition) = 0
     OR position(v_old_order IN v_definition) = 0
     OR position(v_old_key IN v_definition) = 0
     OR position(v_old_role_match IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Stage 5 V2 family migration cannot verify the expected executor contract';
  END IF;

  v_definition := replace(v_definition, v_old_distinct, v_new_distinct);
  v_definition := replace(v_definition, v_old_order, v_new_order);
  v_definition := replace(v_definition, v_old_key, v_new_key);
  v_definition := replace(v_definition, v_old_role_match, v_new_role_match);
  EXECUTE v_definition;
END;
$stage5_v2_family_mapping$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)
  TO service_role;
