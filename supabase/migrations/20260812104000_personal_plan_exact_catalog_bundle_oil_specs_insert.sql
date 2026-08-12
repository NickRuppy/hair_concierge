-- The exact-bundle executor already validates Oil facts and rejects any
-- conflicting non-null authority. Legacy Oil products can have eligibility
-- rows without a companion spec row, however, so insert that narrow missing
-- row before preserving the established guarded UPDATE path.
DO $mapping$
DECLARE
  v_definition text;
  v_old_update text := $update$UPDATE public.product_oil_specs AS s SET weight=v_fact#>>'{values,weight}', role_support=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,role_support}')) WHERE s.product_id=v_product_id;$update$;
  v_new_update text := $update$INSERT INTO public.product_oil_specs(product_id,weight,role_support) VALUES(v_product_id,v_fact#>>'{values,weight}',ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,role_support}'))) ON CONFLICT ON CONSTRAINT product_oil_specs_pkey DO NOTHING;
      UPDATE public.product_oil_specs AS s SET weight=v_fact#>>'{values,weight}', role_support=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,role_support}')) WHERE s.product_id=v_product_id;$update$;
BEGIN
  SELECT pg_get_functiondef('public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position('SET search_path TO ''''' IN v_definition) = 0
     OR position(v_old_update IN v_definition) = 0 THEN
    RAISE EXCEPTION 'exact catalog bundle Oil spec migration cannot verify the expected executor contract';
  END IF;

  v_definition := replace(v_definition, v_old_update, v_new_update);
  EXECUTE v_definition;
END;
$mapping$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) TO service_role;
