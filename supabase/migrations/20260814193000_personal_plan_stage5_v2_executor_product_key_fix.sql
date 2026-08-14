-- Repair operator precedence in the Stage 5 V2 executor product key added by
-- the application-family expansion. The replacement is exact and fail-closed.
BEGIN;

DO $repair_stage5_v2_product_key$
DECLARE
  v_definition text;
  v_installed text;
  v_old_expression constant text := $old$v_product_key := 'v2:' || v_product_id::text || ':' || v_role || ':' || v_item#>>'{guidance_payload_v2,applicationFamily}';$old$;
  v_new_expression constant text := $new$v_product_key := 'v2:' || v_product_id::text || ':' || v_role || ':' || (v_item#>>'{guidance_payload_v2,applicationFamily}');$new$;
  v_occurrences integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_definition;

  v_occurrences := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_old_expression, ''))
  ) / pg_catalog.length(v_old_expression);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one unparenthesized Stage 5 V2 product key expression, found %', v_occurrences;
  END IF;

  v_definition := pg_catalog.replace(v_definition, v_old_expression, v_new_expression);
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_installed;
  IF pg_catalog.strpos(v_installed, v_old_expression) <> 0
     OR pg_catalog.strpos(v_installed, v_new_expression) = 0 THEN
    RAISE EXCEPTION 'installed Stage 5 V2 product key precedence verification failed';
  END IF;
END;
$repair_stage5_v2_product_key$;

COMMIT;
