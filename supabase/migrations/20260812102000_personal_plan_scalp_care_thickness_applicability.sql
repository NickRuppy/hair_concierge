-- Scalp Care is scalp-targeted; hair-shaft thickness is not an applicable fact.

CREATE OR REPLACE FUNCTION public.personal_plan_search_assessment_products_v2(
  p_user_id uuid,
  p_category text,
  p_query text,
  p_context jsonb,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(
  product_id uuid,
  category_key text,
  brand_name text,
  product_line_name text,
  product_name text,
  image_url text,
  sort_order integer,
  assessment_status text,
  assessment_reason_codes text[],
  total_capped boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH catalog_roles AS (
    SELECT s.product_id, CASE WHEN s.shampoo_bucket = 'schuppen' THEN 'shampoo_dandruff' ELSE 'shampoo_everyday' END AS role
    FROM public.product_shampoo_specs s
    WHERE s.cleansing_intensity IS NOT NULL
    UNION
    SELECT s.product_id, 'conditioner_rinse_out'
    FROM public.product_conditioner_specs s
    UNION
    SELECT li.product_id,
      CASE value
        WHEN 'pre_heat_application' THEN 'pre_heat_protection'
        ELSE value
      END
    FROM public.product_leave_in_specs li
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(to_jsonb(li)->'plan_roles') AS value
    UNION
    SELECT m.product_id, 'intensive_conditioning_mask'
    FROM public.product_mask_specs m
    UNION
    SELECT hp.product_id, 'pre_heat_protection'
    FROM public.product_heat_protectant_specs hp
    WHERE hp.provides_heat_protection IS NOT NULL
    UNION
    SELECT os.product_id, value
    FROM public.product_oil_specs os
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(to_jsonb(os)->'role_support') AS value
    WHERE value IN (
      'pre_wash_fibre_treatment',
      'leave_on_fibre_conditioning',
      'dry_finish',
      'pre_heat_protection'
    )
    UNION
    SELECT sc.product_id, sc.primary_role
    FROM public.product_scalp_care_specs sc
    WHERE sc.primary_role IS NOT NULL
    UNION
    SELECT ds.product_id, 'root_refresh_bridge'
    FROM public.product_dry_shampoo_specs ds
    UNION
    SELECT bb.product_id, 'specialized_bond_treatment'
    FROM public.product_bondbuilder_specs bb
    UNION
    SELECT dc.product_id,
      CASE dc.reset_focus
        WHEN 'product_sebum_buildup' THEN 'residue_reset'
        WHEN 'metal_mineral_hard_water' THEN 'mineral_reset'
        WHEN 'broad_spectrum_detox' THEN 'residue_reset'
      END
    FROM public.product_deep_cleansing_shampoo_specs dc
    WHERE dc.reset_focus IN ('product_sebum_buildup', 'metal_mineral_hard_water', 'broad_spectrum_detox')
    UNION
    SELECT dc.product_id, 'mineral_reset'
    FROM public.product_deep_cleansing_shampoo_specs dc
    WHERE dc.reset_focus = 'broad_spectrum_detox'
  ), active_candidates AS (
    SELECT
      p.id AS product_id,
      p.category_key,
      COALESCE(b.canonical_name, p.brand) AS brand_name,
      pl.canonical_name AS product_line_name,
      p.name AS product_name,
      p.image_url,
      p.sort_order,
      CASE
        WHEN p.category_key = 'shampoo' THEN EXISTS (
          SELECT 1
          FROM public.product_shampoo_specs s
          WHERE s.product_id = p.id
            AND s.thickness IS NOT NULL
            AND s.shampoo_bucket IS NOT NULL
            AND s.scalp_route IS NOT NULL
            AND s.cleansing_intensity IS NOT NULL
        ) AND NOT EXISTS (
          SELECT 1
          FROM public.product_shampoo_specs s
          WHERE s.product_id = p.id
            AND (
              s.thickness IS NULL
              OR s.shampoo_bucket IS NULL
              OR s.scalp_route IS NULL
              OR s.cleansing_intensity IS NULL
            )
        )
        WHEN p.category_key = 'conditioner' THEN EXISTS (
          SELECT 1
          FROM public.product_conditioner_specs s
          WHERE s.product_id = p.id
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
          SELECT 1
          FROM public.product_conditioner_specs s
          WHERE s.product_id = p.id
            AND (
              s.thickness IS NULL
              OR CASE s.protein_moisture_balance
                WHEN 'stretches_stays' THEN 'protein'
                WHEN 'protein' THEN 'protein'
                WHEN 'snaps' THEN 'moisture'
                WHEN 'moisture' THEN 'moisture'
                WHEN 'stretches_bounces' THEN 'balanced'
                WHEN 'balanced' THEN 'balanced'
                ELSE NULL
              END IS NULL
            )
        ) AND EXISTS (
          SELECT 1
          FROM public.product_conditioner_rerank_specs r
          WHERE r.product_id = p.id
            AND r.weight IS NOT NULL
            AND r.repair_level IS NOT NULL
            AND r.balance_direction IS NOT NULL
        )
        WHEN p.category_key = 'leave_in' THEN EXISTS (
          SELECT 1
          FROM public.product_leave_in_specs li
          WHERE li.product_id = p.id
            AND li.weight IS NOT NULL
            -- The nullable v3 authority facts are added by the immediately
            -- following migration. jsonb access keeps this versioned search
            -- deployable first, and remains fail-closed until they exist.
            AND to_jsonb(li)->>'care_direction' IS NOT NULL
            AND to_jsonb(li)->>'repair_support_level' IS NOT NULL
            AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'plan_roles'), 0) > 0
            AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->'functional_benefits'), 0) > 0
            AND (
              ('post_wash_leave_in' IN (
                SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->'plan_roles')
              )
                AND 'towel_dry' = ANY(li.application_stage))
              OR
              ('pre_heat_application' IN (
                SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->'plan_roles')
              )
                AND li.provides_heat_protection = true
                AND 'pre_heat' = ANY(li.application_stage))
            )
        )
        WHEN p.category_key = 'mask' THEN EXISTS (
          SELECT 1
          FROM public.product_mask_specs m
          WHERE m.product_id = p.id
            AND m.weight IS NOT NULL
            AND to_jsonb(m)->>'repair_support_level' IS NOT NULL
            AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(m)->'functional_benefits'), 0) > 0
        )
        WHEN p.category_key = 'heat_protectant' THEN EXISTS (
          SELECT 1
          FROM public.product_heat_protectant_specs hp
          WHERE hp.product_id = p.id
            AND hp.provides_heat_protection IS NOT NULL
        )
        WHEN p.category_key = 'oil' THEN EXISTS (
          SELECT 1
          FROM public.product_oil_eligibility oe
          WHERE oe.product_id = p.id
            AND oe.thickness IS NOT NULL
            AND oe.oil_subtype IS NOT NULL
        ) AND EXISTS (
          SELECT 1
          FROM public.product_oil_specs os
          WHERE os.product_id = p.id
            AND to_jsonb(os)->>'weight' IS NOT NULL
            AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(os)->'role_support'), 0) > 0
        )
        WHEN p.category_key = 'scalp_care' THEN EXISTS (
          SELECT 1
          FROM public.product_scalp_care_specs sc
          WHERE sc.product_id = p.id
            AND sc.primary_role IS NOT NULL
            AND sc.presentation_format IS NOT NULL
            AND sc.presentation_format <> 'unknown'
            AND sc.rinse_mode IS NOT NULL
        )
        WHEN p.category_key = 'dry_shampoo' THEN EXISTS (
          SELECT 1
          FROM public.product_dry_shampoo_specs ds
          WHERE ds.product_id = p.id
            AND ds.primary_effect IS NOT NULL
            AND ds.hair_color_fit IS NOT NULL
            AND ds.scalp_sensitivity_fit IS NOT NULL
            AND ds.format IS NOT NULL
        )
        WHEN p.category_key = 'bondbuilder' THEN EXISTS (
          SELECT 1
          FROM public.product_bondbuilder_specs bb
          WHERE bb.product_id = p.id
            AND bb.application_mode IS NOT NULL
            AND bb.treatment_mode IS NOT NULL
            AND bb.product_format IS NOT NULL
            AND bb.usage_protocol IS NOT NULL
        )
        WHEN p.category_key = 'deep_cleansing_shampoo' THEN EXISTS (
          SELECT 1
          FROM public.product_deep_cleansing_shampoo_specs dc
          WHERE dc.product_id = p.id
            AND dc.reset_focus IN (
              'product_sebum_buildup',
              'metal_mineral_hard_water',
              'broad_spectrum_detox'
            )
        )
        ELSE false
      END
      AND (
        p.category_key IN ('heat_protectant', 'dry_shampoo', 'scalp_care')
        OR pg_catalog.cardinality(p.suitable_thicknesses) > 0
      ) AS has_required_spec,
      EXISTS (
        SELECT 1 FROM catalog_roles cr WHERE cr.product_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM catalog_roles cr
        WHERE cr.product_id = p.id
          AND NOT (
            EXISTS (
              SELECT 1
              FROM public.application_guidance_protocols ag
              WHERE ag.product_id = p.id
                AND ag.category_key = p.category_key
                AND ag.role_key = cr.role
                AND ag.scope_kind = 'product'
                AND ag.status = 'active'
                AND ag.locale = 'de'
                AND ag.verified_at IS NOT NULL
            )
            OR EXISTS (
              SELECT 1
              FROM public.product_application_protocols ap
              WHERE ap.product_id = p.id
                AND ap.category = p.category_key
                AND ap.role = cr.role
                AND ap.guidance_payload IS NOT NULL
                AND ap.guidance_payload->'scope'->>'kind' = 'product'
                AND ap.guidance_payload->'scope'->>'productId' = p.id::text
                AND ap.guidance_payload->'scope'->>'category' = p.category_key
            )
          )
      ) AS has_required_protocol
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.category_key = p_category
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
      AND (
        p.origin = 'curated'
        OR (
          p.origin = 'user_submitted'
          AND EXISTS (
            SELECT 1
            FROM public.user_products owned
            WHERE owned.user_id = p_user_id
              AND owned.catalog_product_id = p.id
              AND owned.category = p.category_key
              AND owned.identity_status = 'matched'
              AND owned.ownership_status = 'owned'
          )
        )
      )
      AND (
        p.origin <> 'curated'
        OR NOT EXISTS (
          SELECT 1
          FROM public.personal_plan_product_search_dispositions disposition
          WHERE disposition.product_id = p.id
        )
      )
      AND length(pg_catalog.btrim(p_query)) BETWEEN 2 AND 120
      AND pg_catalog.lower(pg_catalog.concat_ws(
        ' ', COALESCE(b.canonical_name, p.brand), pl.canonical_name, p.name
      )) LIKE '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
  ), assessed AS (
    SELECT
      *,
      CASE
        WHEN has_required_spec AND has_required_protocol THEN 'ready'
        ELSE 'pending_analysis'
      END AS assessment_status,
      pg_catalog.array_remove(ARRAY[
        CASE WHEN NOT has_required_spec THEN 'missing_required_spec' END,
        CASE WHEN NOT has_required_protocol THEN 'missing_application_protocol' END
      ], NULL) AS assessment_reason_codes
    FROM active_candidates
  ), ranked AS (
    SELECT *, pg_catalog.count(*) OVER () AS matched_count
    FROM assessed
  )
  SELECT
    product_id,
    category_key,
    brand_name,
    product_line_name,
    product_name,
    image_url,
    sort_order,
    assessment_status,
    assessment_reason_codes,
    matched_count > LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8) AS total_capped
  FROM ranked
  ORDER BY sort_order NULLS LAST, product_name, product_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8);
$function$;

-- Expand first: the currently deployed application may still call v1 while the
-- database migration is rolling out. A later cleanup migration can revoke v1
-- after every application instance is confirmed on v2.
REVOKE ALL ON FUNCTION public.personal_plan_search_assessment_products_v2(uuid,text,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_search_assessment_products_v2(uuid,text,text,jsonb,integer) TO service_role;

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
    v_product.category_key IN ('heat_protectant', 'dry_shampoo', 'scalp_care')
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
