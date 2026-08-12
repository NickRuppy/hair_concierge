-- Curated products become globally visible only as one complete exact bundle.
-- User-submitted products remain owner-scoped and may stay active without
-- becoming recommendations while their intake work is pending.
CREATE OR REPLACE FUNCTION public.assert_personal_plan_curated_publication(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_has_facts boolean;
  v_has_protocol boolean;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT (
    (v_product.origin = 'curated' AND v_product.is_active = true AND v_product.lifecycle_status = 'active')
    OR v_product.is_chaarlie_recommended = true
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.personal_plan_product_search_dispositions disposition
    WHERE disposition.product_id = v_product.id
  ) THEN
    RETURN;
  END IF;

  v_has_facts := CASE v_product.category_key
    WHEN 'shampoo' THEN EXISTS (
      SELECT 1 FROM public.product_shampoo_specs s
      WHERE s.product_id = v_product.id
        AND s.thickness IS NOT NULL
        AND s.shampoo_bucket IS NOT NULL
        AND s.scalp_route IS NOT NULL
        AND s.cleansing_intensity IS NOT NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM public.product_shampoo_specs s
      WHERE s.product_id = v_product.id
        AND (s.thickness IS NULL OR s.shampoo_bucket IS NULL OR s.scalp_route IS NULL OR s.cleansing_intensity IS NULL)
    )
    WHEN 'conditioner' THEN EXISTS (
      SELECT 1 FROM public.product_conditioner_specs s
      WHERE s.product_id = v_product.id
        AND s.thickness IS NOT NULL
        AND CASE s.protein_moisture_balance
          WHEN 'stretches_stays' THEN 'protein'
          WHEN 'protein' THEN 'protein'
          WHEN 'snaps' THEN 'moisture'
          WHEN 'moisture' THEN 'moisture'
          WHEN 'stretches_bounces' THEN 'balanced'
          WHEN 'balanced' THEN 'balanced'
          ELSE NULL
        END IS NOT NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM public.product_conditioner_specs s
      WHERE s.product_id = v_product.id
        AND (s.thickness IS NULL OR CASE s.protein_moisture_balance
          WHEN 'stretches_stays' THEN 'protein'
          WHEN 'protein' THEN 'protein'
          WHEN 'snaps' THEN 'moisture'
          WHEN 'moisture' THEN 'moisture'
          WHEN 'stretches_bounces' THEN 'balanced'
          WHEN 'balanced' THEN 'balanced'
          ELSE NULL
        END IS NULL)
    ) AND EXISTS (
      SELECT 1 FROM public.product_conditioner_rerank_specs r
      WHERE r.product_id = v_product.id AND r.weight IS NOT NULL
        AND r.repair_level IS NOT NULL AND r.balance_direction IS NOT NULL
    )
    WHEN 'leave_in' THEN EXISTS (SELECT 1 FROM public.product_leave_in_specs li WHERE li.product_id = v_product.id
      AND li.weight IS NOT NULL AND to_jsonb(li)->>'care_direction' IS NOT NULL
      AND to_jsonb(li)->>'repair_support_level' IS NOT NULL
      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'plan_roles'), 0) > 0
      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'functional_benefits'), 0) > 0
      AND (('post_wash_leave_in' IN (SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->'plan_roles') AS value)
            AND 'towel_dry' = ANY(li.application_stage))
        OR ('pre_heat_application' IN (SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->'plan_roles') AS value)
            AND li.provides_heat_protection = true AND 'pre_heat' = ANY(li.application_stage))))
    WHEN 'mask' THEN EXISTS (SELECT 1 FROM public.product_mask_specs m WHERE m.product_id = v_product.id
      AND m.weight IS NOT NULL AND to_jsonb(m)->>'repair_support_level' IS NOT NULL
      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(m)->'functional_benefits'), 0) > 0)
    WHEN 'oil' THEN EXISTS (SELECT 1 FROM public.product_oil_eligibility oe WHERE oe.product_id = v_product.id
      AND oe.thickness IS NOT NULL AND oe.oil_subtype IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.product_oil_specs oil WHERE oil.product_id = v_product.id
      AND to_jsonb(oil)->>'weight' IS NOT NULL
      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(oil)->'role_support'), 0) > 0)
    WHEN 'dry_shampoo' THEN EXISTS (SELECT 1 FROM public.product_dry_shampoo_specs ds WHERE ds.product_id = v_product.id
      AND ds.primary_effect IS NOT NULL AND ds.hair_color_fit IS NOT NULL
      AND ds.scalp_sensitivity_fit IS NOT NULL AND ds.format IS NOT NULL)
    WHEN 'deep_cleansing_shampoo' THEN EXISTS (SELECT 1 FROM public.product_deep_cleansing_shampoo_specs dc WHERE dc.product_id = v_product.id
      AND dc.reset_focus IN ('product_sebum_buildup', 'metal_mineral_hard_water', 'broad_spectrum_detox'))
    WHEN 'bondbuilder' THEN EXISTS (SELECT 1 FROM public.product_bondbuilder_specs bb WHERE bb.product_id = v_product.id
      AND bb.application_mode IS NOT NULL AND bb.treatment_mode IS NOT NULL
      AND bb.product_format IS NOT NULL AND bb.usage_protocol IS NOT NULL)
    WHEN 'heat_protectant' THEN EXISTS (SELECT 1 FROM public.product_heat_protectant_specs hp WHERE hp.product_id = v_product.id
      AND hp.provides_heat_protection IS NOT NULL)
    WHEN 'scalp_care' THEN EXISTS (SELECT 1 FROM public.product_scalp_care_specs sc WHERE sc.product_id = v_product.id
      AND sc.primary_role IS NOT NULL AND sc.presentation_format IS NOT NULL
      AND sc.presentation_format <> 'unknown' AND sc.rinse_mode IS NOT NULL)
    ELSE false
  END;
  v_has_facts := v_has_facts AND (
    v_product.category_key = 'heat_protectant'
    OR pg_catalog.cardinality(v_product.suitable_thicknesses) > 0
  );
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
    SELECT 'residue_reset'
    FROM public.product_deep_cleansing_shampoo_specs deep
    WHERE v_product.category_key = 'deep_cleansing_shampoo'
      AND deep.product_id = v_product.id
      AND deep.reset_focus IN ('product_sebum_buildup', 'broad_spectrum_detox')
    UNION
    SELECT 'mineral_reset'
    FROM public.product_deep_cleansing_shampoo_specs deep
    WHERE v_product.category_key = 'deep_cleansing_shampoo'
      AND deep.product_id = v_product.id
      AND deep.reset_focus IN ('metal_mineral_hard_water', 'broad_spectrum_detox')
    UNION
    SELECT 'specialized_bond_treatment' WHERE v_product.category_key = 'bondbuilder'
    UNION
    SELECT 'pre_heat_protection' WHERE v_product.category_key = 'heat_protectant'
    UNION
    SELECT scalp.primary_role
    FROM public.product_scalp_care_specs scalp
    WHERE v_product.category_key = 'scalp_care'
      AND scalp.product_id = v_product.id
      AND scalp.primary_role IS NOT NULL
  )
  SELECT EXISTS (SELECT 1 FROM required_roles)
    AND NOT EXISTS (
      SELECT 1
      FROM required_roles required
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.product_application_protocols protocol
        WHERE protocol.product_id = v_product.id
          AND protocol.category = v_product.category_key
          AND protocol.role = required.role
          AND protocol.guidance_payload IS NOT NULL
          AND pg_catalog.jsonb_typeof(protocol.guidance_payload) = 'object'
          AND protocol.guidance_payload#>>'{scope,kind}' = 'product'
          AND protocol.guidance_payload#>>'{scope,productId}' = v_product.id::text
          AND protocol.guidance_payload#>>'{scope,category}' = v_product.category_key
          AND protocol.source_url IS NOT NULL
          AND protocol.source_text IS NOT NULL
          AND pg_catalog.btrim(protocol.source_text) <> ''
          AND EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(protocol.guidance_payload->'evidence') evidence
            WHERE evidence->>'sourceUrl' = protocol.source_url
          )
      )
    )
  INTO v_has_protocol;
  IF v_has_facts IS DISTINCT FROM true OR v_has_protocol IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'curated publication requires complete category facts and exact canonical protocol';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_personal_plan_curated_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.assert_personal_plan_curated_publication(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_personal_plan_curated_publication_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.assert_personal_plan_curated_publication(OLD.product_id);
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM public.assert_personal_plan_curated_publication(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS validate_personal_plan_curated_publication ON public.products;
DROP TRIGGER IF EXISTS validate_personal_plan_curated_publication_on_insert ON public.products;
DROP TRIGGER IF EXISTS validate_personal_plan_curated_publication_on_visibility_transition ON public.products;
CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_on_insert
AFTER INSERT ON public.products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_personal_plan_curated_publication();
CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_on_visibility_transition
AFTER UPDATE OF origin, is_active, lifecycle_status, is_chaarlie_recommended, category_key, suitable_thicknesses ON public.products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (
  (
    (NEW.origin = 'curated' AND NEW.is_active = true AND NEW.lifecycle_status = 'active')
    OR NEW.is_chaarlie_recommended = true
  )
  AND (
    NOT (
      (OLD.origin = 'curated' AND OLD.is_active = true AND OLD.lifecycle_status = 'active')
      OR OLD.is_chaarlie_recommended = true
    )
    OR OLD.category_key IS DISTINCT FROM NEW.category_key
    OR OLD.suitable_thicknesses IS DISTINCT FROM NEW.suitable_thicknesses
  )
) EXECUTE FUNCTION public.validate_personal_plan_curated_publication();

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_shampoo_specs', 'product_conditioner_specs', 'product_conditioner_rerank_specs',
    'product_leave_in_specs', 'product_mask_specs', 'product_oil_eligibility', 'product_oil_specs',
    'product_dry_shampoo_specs', 'product_deep_cleansing_shampoo_specs', 'product_bondbuilder_specs',
    'product_heat_protectant_specs', 'product_scalp_care_specs', 'product_application_protocols',
    'personal_plan_product_search_dispositions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS validate_personal_plan_curated_publication_dependency ON public.%I', table_name);
    EXECUTE format(
      'CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_dependency AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_personal_plan_curated_publication_dependency()',
      table_name
    );
  END LOOP;
END;
$triggers$;

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_user_product(
  p_user_id uuid,
  p_category text,
  p_catalog_product_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_product public.products%ROWTYPE; v_user_product public.user_products%ROWTYPE;
BEGIN
  SELECT * INTO v_product FROM public.products
   WHERE id = p_catalog_product_id AND category_key = p_category AND is_active = true AND lifecycle_status = 'active'
     AND NOT EXISTS (
       SELECT 1
       FROM public.personal_plan_product_search_dispositions disposition
       WHERE disposition.product_id = p_catalog_product_id
     )
     AND (origin = 'curated' OR EXISTS (
       SELECT 1 FROM public.user_products owned
       WHERE owned.user_id = p_user_id AND owned.category = p_category
         AND owned.catalog_product_id = p_catalog_product_id
         AND owned.identity_status = 'matched' AND owned.ownership_status = 'owned'
     ))
   FOR SHARE;
  IF v_product.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
  INSERT INTO public.user_products(user_id, category, catalog_product_id, brand_text, product_name_text, identity_status, ownership_status, intake_source)
  VALUES (p_user_id, p_category, v_product.id, v_product.brand, v_product.name, 'matched', 'owned', 'catalog_search')
  ON CONFLICT (user_id, category, catalog_product_id) WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL
  DO UPDATE SET updated_at = pg_catalog.now()
  RETURNING * INTO v_user_product;
  RETURN pg_catalog.jsonb_build_object('outcome','ready','userProduct',pg_catalog.to_jsonb(v_user_product));
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_personal_plan_curated_publication() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_user_product(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_user_product(uuid,text,uuid) TO service_role;

-- The category-readiness wrapper already owns every legacy fact branch. Keep
-- that authority and replace only its protocol persistence branch so canonical
-- Stage-5 payloads are stored in the same approval transaction.
ALTER FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  RENAME TO product_intake_approve_reviewed_product_without_canonical_guidance;

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
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  INTO legacy_spec_operations
  FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  WHERE (value ->> 'table') IS DISTINCT FROM 'product_application_protocols';

  approval_result := public.product_intake_approve_reviewed_product_without_canonical_guidance(
    p_submission_id, p_final_payload, legacy_spec_operations, p_reviewed_by, p_reviewed_at, p_review_notes
  );
  approved_product_id := (approval_result ->> 'product_id')::uuid;

  FOR operation IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value ->> 'table' = 'product_application_protocols'
  LOOP
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(operation -> 'rows') AS candidate(category text, guidance_payload jsonb)
      WHERE candidate.guidance_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
        OR candidate.guidance_payload#>>'{scope,category}' IS DISTINCT FROM candidate.category
        OR candidate.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
    ) THEN
      RAISE EXCEPTION 'canonical protocol scope must use the approved product placeholder and matching category';
    END IF;
    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage, application_state,
      placement, contact_time_seconds, rinse_action, reapplication,
      instruction_modifiers, source_label, source_url, source_text, guidance_payload
    )
    SELECT
      approved_product_id, row_data.category, row_data.role, row_data.cadence,
      row_data.application_stage, row_data.application_state, row_data.placement,
      row_data.contact_time_seconds, row_data.rinse_action, row_data.reapplication,
      COALESCE(row_data.instruction_modifiers, '[]'::jsonb), row_data.source_label,
      row_data.source_url, row_data.source_text,
      pg_catalog.jsonb_set(
        row_data.guidance_payload,
        '{scope,productId}',
        pg_catalog.to_jsonb(approved_product_id::text),
        false
      )
    FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
      category text, role text, cadence jsonb, application_stage text,
      application_state text, placement text, contact_time_seconds integer,
      rinse_action text, reapplication text, instruction_modifiers jsonb,
      source_label text, source_url text, source_text text, guidance_payload jsonb
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
          updated_at = pg_catalog.now();
  END LOOP;

  FOR operation IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value ->> 'table' = 'product_mask_specs'
  LOOP
    UPDATE public.product_mask_specs mask
    SET repair_support_level = row_data.repair_support_level,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
      repair_support_level text, functional_benefits text[]
    )
    WHERE mask.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value ->> 'table' = 'product_leave_in_specs'
  LOOP
    UPDATE public.product_leave_in_specs leave_in
    SET care_direction = row_data.care_direction,
        repair_support_level = row_data.repair_support_level,
        plan_roles = row_data.plan_roles,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
      care_direction text, repair_support_level text, plan_roles text[], functional_benefits text[]
    )
    WHERE leave_in.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value ->> 'table' = 'product_oil_specs'
  LOOP
    UPDATE public.product_oil_specs oil
    SET weight = row_data.weight,
        role_support = row_data.role_support,
        updated_at = pg_catalog.now()
    FROM jsonb_to_recordset(operation -> 'rows') AS row_data(
      weight text, role_support text[]
    )
    WHERE oil.product_id = approved_product_id;
  END LOOP;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_without_canonical_guidance(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_intake_approve_reviewed_product(uuid, jsonb, jsonb, text, timestamptz, text)
  TO service_role;
