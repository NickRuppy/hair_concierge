-- Stage 3 catalog search needs identity and owner-context assessment readiness
-- before capture. Keep the projection set-based, service-only, and fail closed
-- when the current authority loader cannot yet produce a complete fact bundle.

CREATE OR REPLACE FUNCTION public.personal_plan_search_assessment_products_v1(
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
  WITH required_roles AS (
    SELECT DISTINCT
      CASE value #>> '{}'
        WHEN 'pre_heat_application' THEN 'pre_heat_protection'
        ELSE value #>> '{}'
      END AS role
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_context->'requiredRoles', '[]'::jsonb))
  ), shampoo_targets AS (
    SELECT
      value->>'thickness' AS thickness,
      value->>'shampooBucket' AS shampoo_bucket,
      value->>'scalpRoute' AS scalp_route
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_context->'shampooTargets', '[]'::jsonb))
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
        WHEN p.category_key = 'shampoo' THEN
          EXISTS (SELECT 1 FROM shampoo_targets)
          AND NOT EXISTS (
            SELECT 1
            FROM shampoo_targets target
            WHERE (
              SELECT pg_catalog.count(DISTINCT pg_catalog.concat_ws(
                '|', s.thickness, s.shampoo_bucket, s.scalp_route, s.cleansing_intensity
              ))
              FROM public.product_shampoo_specs s
              WHERE s.product_id = p.id
                AND s.thickness = target.thickness
                AND s.shampoo_bucket = target.shampoo_bucket
                AND s.scalp_route = target.scalp_route
                AND s.cleansing_intensity IS NOT NULL
            ) <> 1
          )
        WHEN p.category_key = 'conditioner' THEN
          p_context->'conditionerTarget' IS NOT NULL
          AND (
            SELECT pg_catalog.count(DISTINCT pg_catalog.concat_ws(
              '|', s.thickness, s.protein_moisture_balance
            ))
            FROM public.product_conditioner_specs s
            WHERE s.product_id = p.id
              AND s.thickness = p_context->'conditionerTarget'->>'thickness'
              AND CASE s.protein_moisture_balance
                WHEN 'stretches_stays' THEN 'protein'
                WHEN 'protein' THEN 'protein'
                WHEN 'snaps' THEN 'moisture'
                WHEN 'moisture' THEN 'moisture'
                WHEN 'stretches_bounces' THEN 'balanced'
                WHEN 'balanced' THEN 'balanced'
                ELSE NULL
              END = p_context->'conditionerTarget'->>'careDirection'
          ) = 1
          AND EXISTS (
            SELECT 1
            FROM public.product_conditioner_rerank_specs r
            WHERE r.product_id = p.id
              AND r.weight IS NOT NULL
              AND r.repair_level IS NOT NULL
          )
        -- The current authority loader intentionally emits missing care
        -- direction/repair facts for these categories. Do not claim readiness
        -- until their typed source contracts are completed.
        WHEN p.category_key = 'leave_in' THEN false
        WHEN p.category_key = 'heat_protectant' THEN EXISTS (
          SELECT 1
          FROM public.product_heat_protectant_specs hp
          WHERE hp.product_id = p.id
            AND hp.provides_heat_protection IS NOT NULL
        )
        WHEN p.category_key = 'oil' THEN
          NOT EXISTS (
            SELECT 1 FROM required_roles rr
            WHERE rr.role <> 'pre_wash_fibre_treatment'
          )
          AND EXISTS (SELECT 1 FROM required_roles)
          AND NOT EXISTS (
            SELECT 1
            FROM required_roles rr
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.product_oil_eligibility oe
              WHERE oe.product_id = p.id
                AND oe.thickness = p_context->>'hairThickness'
                AND oe.oil_purpose = 'pre_wash_oiling'
            )
          )
        WHEN p.category_key = 'mask' THEN false
        WHEN p.category_key = 'scalp_care' THEN
          EXISTS (SELECT 1 FROM required_roles)
          AND NOT EXISTS (
            SELECT 1
            FROM required_roles rr
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.product_scalp_care_specs sc
              WHERE sc.product_id = p.id
                AND sc.primary_role = rr.role
                AND sc.presentation_format IS NOT NULL
                AND sc.presentation_format <> 'unknown'
                AND sc.rinse_mode IS NOT NULL
            )
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
        p.category_key = 'heat_protectant'
        OR (
          p_context->>'hairThickness' IN ('fine', 'normal', 'coarse')
          AND p.suitable_thicknesses @> ARRAY[p_context->>'hairThickness']::text[]
        )
      ) AS has_required_spec,
      EXISTS (SELECT 1 FROM required_roles)
      AND NOT EXISTS (
        SELECT 1
        FROM required_roles rr
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.application_guidance_protocols ag
          WHERE ag.product_id = p.id
            AND ag.scope_kind = 'product'
            AND ag.status = 'active'
            AND ag.locale = 'de'
            AND ag.verified_at IS NOT NULL
            AND (ag.role_key = rr.role OR ag.role_key IS NULL)
          UNION ALL
          SELECT 1
          FROM public.product_application_protocols ap
          WHERE ap.product_id = p.id
            AND ap.category = p.category_key
            AND ap.role = rr.role
            AND (
              (
                ap.guidance_payload->'scope'->>'kind' = 'product'
                AND ap.guidance_payload->'scope'->>'productId' = p.id::text
                AND ap.guidance_payload->'scope'->>'category' = p.category_key
              )
              OR (
                rr.role = 'pre_heat_protection'
                AND ap.application_state IS NOT NULL
                AND ap.reapplication IS NOT NULL
              )
              OR (
                rr.role <> 'pre_heat_protection'
                AND ap.application_stage IS NOT NULL
                AND ap.placement IS NOT NULL
                AND (ap.rinse_action IS NOT NULL OR ap.contact_time_seconds IS NOT NULL)
              )
            )
        )
      ) AS has_required_protocol
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.category_key = p_category
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
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

REVOKE ALL ON FUNCTION public.personal_plan_search_assessment_products_v1(text,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_search_assessment_products_v1(text,text,jsonb,integer) TO service_role;
