-- Retire the sole non-executable Stage-5 catalog product before requiring V2
-- coverage for every globally visible curated product. The migration is one
-- transaction, so the stricter assertion never observes active OLAPLEX No.0.
DO $retire_no0$
DECLARE
  v_no0 constant uuid := 'aadbbab5-bcf5-4b46-b38a-5533648bcb1d'::uuid;
  v_no3plus constant uuid := '3dc24d67-e6c0-4239-a273-058a87d13553'::uuid;
  v_product public.products%ROWTYPE;
  v_invalid_v2_count integer;
  v_invalid_v2_ids uuid[];
BEGIN
  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_no0
  FOR UPDATE;

  IF v_product.id IS NULL
     OR v_product.origin IS DISTINCT FROM 'curated'
     OR v_product.category_key IS DISTINCT FROM 'bondbuilder'
     OR v_product.is_active IS DISTINCT FROM true
     OR v_product.lifecycle_status IS DISTINCT FROM 'active'
     OR v_product.is_chaarlie_recommended IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'OLAPLEX No.0 retirement precondition changed';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.product_relationships relationship
      WHERE relationship.source_product_id = v_no0 OR relationship.target_product_id = v_no0) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.product_relationships relationship
       WHERE relationship.source_product_id = v_no0
         AND relationship.target_product_id = v_no3plus
         AND relationship.relationship_type = 'add_on_for'
     ) THEN
    RAISE EXCEPTION 'OLAPLEX No.0 relationship precondition changed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = v_no0)
     OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = v_no0)
     OR EXISTS (SELECT 1 FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%' || v_no0::text || '%')
     OR EXISTS (SELECT 1 FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%' || v_no0::text || '%')
     OR EXISTS (SELECT 1 FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%' || v_no0::text || '%')
     OR EXISTS (SELECT 1 FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%' || v_no0::text || '%')
     OR EXISTS (
       SELECT 1
       FROM public.personal_plans plan
       JOIN public.personal_plan_routine_versions routine ON routine.id = plan.active_routine_version_id
       WHERE routine.payload::text LIKE '%' || v_no0::text || '%'
     ) THEN
    RAISE EXCEPTION 'OLAPLEX No.0 has acquired an owner or Personal Plan reference';
  END IF;

  WITH visible_protocols AS (
    SELECT product.id AS product_id, protocol.guidance_payload_v2
    FROM public.products product
    JOIN public.product_application_protocols protocol ON protocol.product_id = product.id
    WHERE (
      (product.origin = 'curated' AND product.is_active = true AND product.lifecycle_status = 'active')
      OR product.is_chaarlie_recommended = true
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.personal_plan_product_search_dispositions disposition
        WHERE disposition.product_id = product.id
      )
      AND protocol.guidance_payload IS NOT NULL
      AND pg_catalog.jsonb_typeof(protocol.guidance_payload) = 'object'
      AND protocol.guidance_payload#>>'{scope,kind}' = 'product'
      AND protocol.guidance_payload#>>'{scope,productId}' = product.id::text
      AND protocol.guidance_payload#>>'{scope,category}' = product.category_key
  ), invalid_v2 AS (
    SELECT product_id
    FROM visible_protocols
    WHERE guidance_payload_v2 IS NULL
       OR pg_catalog.jsonb_typeof(guidance_payload_v2) IS DISTINCT FROM 'object'
       OR guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
       OR guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
       OR guidance_payload_v2#>>'{scope,kind}' IS DISTINCT FROM 'product'
       OR guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM product_id::text
       OR guidance_payload_v2#>'{runtimeBlockerCode}' IS DISTINCT FROM 'null'::jsonb
  )
  SELECT pg_catalog.count(*), pg_catalog.array_agg(product_id ORDER BY product_id)
  INTO v_invalid_v2_count, v_invalid_v2_ids
  FROM invalid_v2;

  IF v_invalid_v2_count IS DISTINCT FROM 1 OR v_invalid_v2_ids IS DISTINCT FROM ARRAY[v_no0] THEN
    RAISE EXCEPTION 'OLAPLEX No.0 is not the sole V2 publication blocker';
  END IF;

  UPDATE public.products
  SET is_active = false,
      lifecycle_status = 'discontinued',
      is_chaarlie_recommended = false,
      updated_at = pg_catalog.now()
  WHERE id = v_no0;

  UPDATE public.product_application_protocols
  SET guidance_payload_v2 = NULL,
      updated_at = pg_catalog.now()
  WHERE product_id = v_no0;
END;
$retire_no0$;

-- Preserve the complete V1 publication assertion as a private helper and add
-- the V2 required-role invariant as a narrow wrapper.
ALTER FUNCTION public.assert_personal_plan_curated_publication(uuid)
  RENAME TO assert_personal_plan_curated_publication_v1_without_v2;

CREATE OR REPLACE FUNCTION public.assert_personal_plan_curated_publication(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_has_v2 boolean;
BEGIN
  PERFORM public.assert_personal_plan_curated_publication_v1_without_v2(p_product_id);

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT (
    (v_product.origin = 'curated' AND v_product.is_active = true AND v_product.lifecycle_status = 'active')
    OR v_product.is_chaarlie_recommended = true
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.personal_plan_product_search_dispositions disposition
    WHERE disposition.product_id = v_product.id
  ) THEN
    RETURN;
  END IF;

  WITH required_roles AS (
    SELECT CASE WHEN s.shampoo_bucket = 'schuppen' THEN 'shampoo_dandruff' ELSE 'shampoo_everyday' END AS role
    FROM public.product_shampoo_specs s
    WHERE v_product.category_key = 'shampoo' AND s.product_id = v_product.id
    UNION
    SELECT 'conditioner_rinse_out' WHERE v_product.category_key = 'conditioner'
    UNION
    SELECT CASE value WHEN 'pre_heat_application' THEN 'pre_heat_protection' ELSE value END
    FROM public.product_leave_in_specs li,
      LATERAL pg_catalog.unnest(li.plan_roles) AS value
    WHERE v_product.category_key = 'leave_in' AND li.product_id = v_product.id
    UNION
    SELECT 'intensive_conditioning_mask' WHERE v_product.category_key = 'mask'
    UNION
    SELECT value
    FROM public.product_oil_specs oil,
      LATERAL pg_catalog.unnest(oil.role_support) AS value
    WHERE v_product.category_key = 'oil' AND oil.product_id = v_product.id
    UNION
    SELECT 'root_refresh_bridge' WHERE v_product.category_key = 'dry_shampoo'
    UNION
    SELECT 'residue_reset' FROM public.product_deep_cleansing_shampoo_specs deep
    WHERE v_product.category_key = 'deep_cleansing_shampoo' AND deep.product_id = v_product.id
      AND deep.reset_focus IN ('product_sebum_buildup', 'broad_spectrum_detox')
    UNION
    SELECT 'mineral_reset' FROM public.product_deep_cleansing_shampoo_specs deep
    WHERE v_product.category_key = 'deep_cleansing_shampoo' AND deep.product_id = v_product.id
      AND deep.reset_focus IN ('metal_mineral_hard_water', 'broad_spectrum_detox')
    UNION
    SELECT 'specialized_bond_treatment' WHERE v_product.category_key = 'bondbuilder'
    UNION
    SELECT 'pre_heat_protection' WHERE v_product.category_key = 'heat_protectant'
    UNION
    SELECT scalp.primary_role FROM public.product_scalp_care_specs scalp
    WHERE v_product.category_key = 'scalp_care' AND scalp.product_id = v_product.id
      AND scalp.primary_role IS NOT NULL
  )
  SELECT EXISTS (SELECT 1 FROM required_roles)
    AND NOT EXISTS (
      SELECT 1 FROM required_roles required
      WHERE NOT EXISTS (
        SELECT 1 FROM public.product_application_protocols protocol
        WHERE protocol.product_id = v_product.id
          AND protocol.category = v_product.category_key
          AND protocol.role = required.role
          AND protocol.guidance_payload_v2 IS NOT NULL
          AND pg_catalog.jsonb_typeof(protocol.guidance_payload_v2) = 'object'
          AND protocol.guidance_payload_v2->>'schemaVersion' = '2'
          AND protocol.guidance_payload_v2->>'contractKind' = 'product_pointer'
          AND protocol.guidance_payload_v2#>>'{scope,kind}' = 'product'
          AND protocol.guidance_payload_v2#>>'{scope,productId}' = v_product.id::text
          AND protocol.guidance_payload_v2#>>'{scope,category}' = v_product.category_key
          AND protocol.guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
      )
    )
  INTO v_has_v2;

  IF v_has_v2 IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'curated publication requires complete category facts and exact V1/V2 protocol';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_personal_plan_curated_publication_v1_without_v2(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_personal_plan_curated_publication(uuid)
  FROM PUBLIC, anon, authenticated;

-- Product Intake derives V2 before approval. Validate both scopes before the
-- legacy body can create/link either a curated or owner-only user product.
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
        OR candidate.guidance_payload_v2#>'{runtimeBlockerCode}' IS DISTINCT FROM 'null'::jsonb
    ) THEN
      RAISE EXCEPTION 'canonical V1/V2 protocol scope must use the approved product placeholder and matching category';
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
