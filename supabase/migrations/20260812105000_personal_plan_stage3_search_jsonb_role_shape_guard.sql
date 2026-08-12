-- The Supabase CLI created this migration with a UTC timestamp that sorted
-- before repository migrations named in local time. It is intentionally
-- ordered after the latest v2 definition so the hotfix remains active.
--
-- Legacy catalog rows can contain scalar/object role fields. Keep those rows
-- fail-closed by expanding only JSON arrays; malformed roles become no roles.
DO $migration$
DECLARE
  v_definition text;
  v_leave_in_elements text :=
    'pg_catalog.jsonb_array_elements_text(to_jsonb(li)->''plan_roles'')';
  v_leave_in_array text :=
    'pg_catalog.jsonb_array_length(to_jsonb(li)->''plan_roles'')';
  v_oil_elements text :=
    'pg_catalog.jsonb_array_elements_text(to_jsonb(os)->''role_support'')';
  v_oil_array text :=
    'pg_catalog.jsonb_array_length(to_jsonb(os)->''role_support'')';
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.personal_plan_search_assessment_products_v2(uuid,text,text,jsonb,integer)'::pg_catalog.regprocedure
  )
  INTO v_definition;

  IF position(v_leave_in_elements IN v_definition) = 0
    OR position(v_leave_in_array IN v_definition) = 0
    OR position(v_oil_elements IN v_definition) = 0
    OR position(v_oil_array IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Stage 3 search v2 role-shape hotfix expected the current unguarded definition';
  END IF;

  v_definition := replace(
    v_definition,
    v_leave_in_elements,
    'pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(to_jsonb(li)->''plan_roles'') = ''array'' THEN to_jsonb(li)->''plan_roles'' ELSE ''[]''::jsonb END)'
  );
  v_definition := replace(
    v_definition,
    v_leave_in_array,
    'pg_catalog.jsonb_array_length(CASE WHEN pg_catalog.jsonb_typeof(to_jsonb(li)->''plan_roles'') = ''array'' THEN to_jsonb(li)->''plan_roles'' ELSE ''[]''::jsonb END)'
  );
  v_definition := replace(
    v_definition,
    v_oil_elements,
    'pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(to_jsonb(os)->''role_support'') = ''array'' THEN to_jsonb(os)->''role_support'' ELSE ''[]''::jsonb END)'
  );
  v_definition := replace(
    v_definition,
    v_oil_array,
    'pg_catalog.jsonb_array_length(CASE WHEN pg_catalog.jsonb_typeof(to_jsonb(os)->''role_support'') = ''array'' THEN to_jsonb(os)->''role_support'' ELSE ''[]''::jsonb END)'
  );

  EXECUTE v_definition;
END;
$migration$;
