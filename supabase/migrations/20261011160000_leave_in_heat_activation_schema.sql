-- Leave-In Standard v1.2 — heat activation (S3, rulings A1, A2, D-c, D-d, D-e; Nick 2026-10-09).
-- Plan: plans/catalog-completeness-fill/s3-heat-activation.md §1.4, §2.5, §2.6(1), §3.
--
-- Code-coupled schema change, deploys with the PR. Writes no catalogue data:
--   1. lineage guards on the exact live bodies of the two functions it redefines
--      (abort on unknown drift — rebase and re-pin instead of overwriting);
--   2. product_leave_in_specs.heat_activation_route + row-local CHECKs (I1, I2, I3, I6):
--      activation and plan_roles must change in ONE statement (the CHECK is immediate);
--   3. expand_leave_in_eligibility v1.2: heat_protect bucket iff heat protection (D-e);
--      an activated product emits heat_style rows for every care bucket;
--   4. curated-publication gate, leave-in branch: pre-heat use needs a heat-protection
--      claim only (T1.1/H1 parity, no pre_heat stage requirement); an activated product
--      is pre-heat only, protected, routed, and booster_only in the fit table (I4, I5);
--   5. product_leave_in_fit_specs joins the deferred publication dependency triggers.
-- 0 rows carry heat_activation_required = true at authoring time (read 2026-10-11).

DO $lineage$
BEGIN
  IF (SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') FROM pg_catalog.pg_proc
      WHERE oid = 'public.expand_leave_in_eligibility(text[],text[],text[],text[],boolean,boolean)'::regprocedure)
    IS DISTINCT FROM '797fc3dab95b3e6b80fcd40393f19df4a68191c59b3d6454fae77a882befcf7e'
  THEN
    RAISE EXCEPTION 'Leave-In v1.2 heat activation: expand_leave_in_eligibility lineage changed';
  END IF;
  IF (SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') FROM pg_catalog.pg_proc
      WHERE oid = 'public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure)
    IS DISTINCT FROM '77b8b02f8f6dad278619a1c62259773c5a506429f23d9cadf27a4becb9c5f6b7'
  THEN
    RAISE EXCEPTION 'Leave-In v1.2 heat activation: curated publication gate lineage changed';
  END IF;
  IF (SELECT encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') FROM pg_catalog.pg_proc
      WHERE oid = 'public.validate_personal_plan_curated_publication_dependency()'::regprocedure)
    IS DISTINCT FROM 'fa824278149856a2cd052c5c87d8ab0dc9138d65463397d6021fadf1d8e564d5'
  THEN
    RAISE EXCEPTION 'Leave-In v1.2 heat activation: publication dependency trigger lineage changed';
  END IF;
END $lineage$;

ALTER TABLE public.product_leave_in_specs
  ADD COLUMN IF NOT EXISTS heat_activation_route text;

COMMENT ON COLUMN public.product_leave_in_specs.heat_activation_route IS
  'Leave-In v1.2 (HA-4): heat step that activates the product, transcribed from the manufacturer direction. NULL iff heat_activation_required = false.';

ALTER TABLE public.product_leave_in_specs
  ADD CONSTRAINT product_leave_in_specs_heat_activation_route_check
    CHECK (heat_activation_route IS NULL
      OR heat_activation_route IN ('airflow_shaping', 'direct_contact_heat', 'either_heat')) NOT VALID,
  ADD CONSTRAINT product_leave_in_specs_heat_activation_route_iff_required
    CHECK (heat_activation_required = (heat_activation_route IS NOT NULL)) NOT VALID,
  ADD CONSTRAINT product_leave_in_specs_heat_activation_pre_heat_only
    CHECK (
      heat_activation_required = false
      OR (
        plan_roles IS NOT DISTINCT FROM ARRAY['pre_heat_application']::text[]
        AND 'pre_heat' = ANY(COALESCE(application_stage, ARRAY[]::text[]))
        AND NOT ('replacement_conditioner' = ANY(COALESCE(roles, ARRAY[]::text[])))
      )
    ) NOT VALID;

ALTER TABLE public.product_leave_in_specs
  VALIDATE CONSTRAINT product_leave_in_specs_heat_activation_route_check;
ALTER TABLE public.product_leave_in_specs
  VALIDATE CONSTRAINT product_leave_in_specs_heat_activation_route_iff_required;
ALTER TABLE public.product_leave_in_specs
  VALIDATE CONSTRAINT product_leave_in_specs_heat_activation_pre_heat_only;

-- TS mirror: expandLeaveInEligibility (src/lib/leave-in-research/production-adapter.ts).
CREATE OR REPLACE FUNCTION public.expand_leave_in_eligibility(
  p_thicknesses text[],
  p_roles text[],
  p_care_benefits text[],
  p_application_stage text[],
  p_provides_heat_protection boolean,
  p_heat_activation_required boolean
)
RETURNS TABLE(
  thickness text,
  need_bucket text,
  styling_context text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  t text;
  bucket text;
  context text;
  buckets text[] := ARRAY[]::text[];
  contexts text[] := ARRAY[]::text[];
BEGIN
  -- Leave-In v1.2 (D-e): activation is never heat protection.
  IF p_provides_heat_protection THEN
    buckets := array_append(buckets, 'heat_protect');
  END IF;

  IF 'curl_definition' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'curl_definition');
  END IF;

  IF
    'repair' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'protein' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'repair');
  END IF;

  IF
    'moisture' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'anti_frizz' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
    OR 'detangling' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[]))
  THEN
    buckets := array_append(buckets, 'moisture_anti_frizz');
  END IF;

  IF 'shine' = ANY(COALESCE(p_care_benefits, ARRAY[]::text[])) THEN
    buckets := array_append(buckets, 'shine_protect');
  END IF;

  IF p_heat_activation_required THEN
    contexts := ARRAY['heat_style'];
  ELSE
    IF
      p_provides_heat_protection
      OR 'pre_heat' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'heat_style');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'air_dry');
    END IF;

    IF
      'towel_dry' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'dry_hair' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'post_style' = ANY(COALESCE(p_application_stage, ARRAY[]::text[]))
      OR 'styling_prep' = ANY(COALESCE(p_roles, ARRAY[]::text[]))
    THEN
      contexts := array_append(contexts, 'non_heat_style');
    END IF;
  END IF;

  IF array_length(contexts, 1) IS NULL THEN
    contexts := ARRAY['air_dry', 'non_heat_style'];
  END IF;

  FOREACH t IN ARRAY COALESCE(p_thicknesses, ARRAY[]::text[]) LOOP
    IF t NOT IN ('fine', 'normal', 'coarse') THEN
      CONTINUE;
    END IF;

    FOREACH bucket IN ARRAY buckets LOOP
      IF bucket = 'heat_protect' THEN
        thickness := t;
        need_bucket := bucket;
        styling_context := 'heat_style';
        RETURN NEXT;
        CONTINUE;
      END IF;

      FOREACH context IN ARRAY contexts LOOP
        -- Activated products live in heat_style only and keep their care buckets there.
        IF context = 'heat_style' AND NOT COALESCE(p_heat_activation_required, false) THEN
          CONTINUE;
        END IF;

        thickness := t;
        need_bucket := bucket;
        styling_context := context;
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;

DO $publication_gate$
DECLARE
  body text;
  needle constant text := E'    WHEN ''leave_in'' THEN EXISTS (SELECT 1 FROM public.product_leave_in_specs li WHERE li.product_id = v_product.id\n      AND li.weight IS NOT NULL AND to_jsonb(li)->>''care_direction'' IS NOT NULL\n      AND to_jsonb(li)->>''repair_support_level'' IS NOT NULL\n      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->''plan_roles''), 0) > 0\n      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->''functional_benefits''), 0) > 0\n      AND ((''post_wash_leave_in'' IN (SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->''plan_roles'') AS value)\n            AND ''towel_dry'' = ANY(li.application_stage))\n        OR (''pre_heat_application'' IN (SELECT value FROM pg_catalog.jsonb_array_elements_text(to_jsonb(li)->''plan_roles'') AS value)\n            AND li.provides_heat_protection = true AND ''pre_heat'' = ANY(li.application_stage))))\n';
  replacement constant text := E'    WHEN ''leave_in'' THEN EXISTS (SELECT 1 FROM public.product_leave_in_specs li WHERE li.product_id = v_product.id\n      AND li.weight IS NOT NULL AND to_jsonb(li)->>''care_direction'' IS NOT NULL\n      AND to_jsonb(li)->>''repair_support_level'' IS NOT NULL\n      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->''plan_roles''), 0) > 0\n      AND COALESCE(pg_catalog.jsonb_array_length(to_jsonb(li)->''functional_benefits''), 0) > 0\n      AND ((''post_wash_leave_in'' = ANY(li.plan_roles) AND ''towel_dry'' = ANY(li.application_stage))\n        OR (''pre_heat_application'' = ANY(li.plan_roles) AND li.provides_heat_protection = true))\n      AND (li.heat_activation_required = false OR (\n            li.plan_roles = ARRAY[''pre_heat_application'']::text[]\n            AND li.provides_heat_protection = true\n            AND ''pre_heat'' = ANY(li.application_stage)\n            AND li.heat_activation_route IS NOT NULL\n            AND NOT EXISTS (SELECT 1 FROM public.product_leave_in_fit_specs f\n                            WHERE f.product_id = li.product_id AND f.conditioner_relationship <> ''booster_only''))))\n';
BEGIN
  SELECT prosrc INTO body
  FROM pg_catalog.pg_proc
  WHERE oid = 'public.assert_personal_plan_curated_publication_v1_without_v2(uuid)'::regprocedure;
  IF pg_catalog.strpos(body, needle) = 0 THEN
    RAISE EXCEPTION 'Leave-In v1.2 heat activation: curated publication leave-in branch not found';
  END IF;
  body := pg_catalog.replace(body, needle, replacement);
  EXECUTE pg_catalog.format(
    'CREATE OR REPLACE FUNCTION public.assert_personal_plan_curated_publication_v1_without_v2(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS %L',
    body
  );
END $publication_gate$;

-- I4 is cross-table: a fit row edited alone must re-run the gate at COMMIT.
DROP TRIGGER IF EXISTS validate_personal_plan_curated_publication_dependency ON public.product_leave_in_fit_specs;
CREATE CONSTRAINT TRIGGER validate_personal_plan_curated_publication_dependency
AFTER INSERT OR UPDATE OR DELETE ON public.product_leave_in_fit_specs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_personal_plan_curated_publication_dependency();

-- Postflight: every visible leave-in still passes the replaced branch (it is
-- strictly looser for non-activated rows, and none is activated yet).
DO $postflight$
DECLARE
  v_product_id uuid;
BEGIN
  FOR v_product_id IN
    SELECT p.id FROM public.products p
    WHERE p.category_key = 'leave_in'
      AND ((p.origin = 'curated' AND p.is_active = true AND p.lifecycle_status = 'active')
        OR p.is_chaarlie_recommended = true)
    ORDER BY p.id
  LOOP
    PERFORM public.assert_personal_plan_curated_publication(v_product_id);
  END LOOP;
END $postflight$;
