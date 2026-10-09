-- Keep the exact-bundle executor's established validation, locking, replay,
-- provenance, and service-role contract intact while mapping the two canonical
-- heat fields required by product_application_protocols_heat_fields_check.
DO $mapping$
DECLARE
  v_definition text;
  v_old_insert text := $insert$VALUES(v_product_id,v_target,v_protocol->>'role',v_protocol->'cadence',v_protocol#>>'{guidance_payload,sequence,anchor}',NULL,v_protocol#>>'{guidance_payload,protocolFacts,applicationArea}',NULLIF(v_protocol#>>'{guidance_payload,protocolFacts,contactTimeSeconds}','')::integer,v_protocol#>>'{guidance_payload,protocolFacts,rinse}',NULL,'[]'::jsonb,v_protocol#>>'{source,label}',v_protocol#>>'{source,url}',v_protocol#>>'{source,text}',v_protocol->'guidance_payload') ON CONFLICT DO NOTHING;$insert$;
  v_new_insert text := $insert$VALUES(v_product_id,v_target,v_protocol->>'role',v_protocol->'cadence',v_protocol#>>'{guidance_payload,sequence,anchor}',CASE v_protocol#>>'{guidance_payload,applicationFamily}' WHEN 'pre_heat_damp' THEN 'damp' WHEN 'pre_heat_dry' THEN 'dry' WHEN 'either_state_protection' THEN 'either' ELSE NULL END,v_protocol#>>'{guidance_payload,protocolFacts,applicationArea}',NULLIF(v_protocol#>>'{guidance_payload,protocolFacts,contactTimeSeconds}','')::integer,v_protocol#>>'{guidance_payload,protocolFacts,rinse}',CASE v_protocol#>>'{guidance_payload,protocolFacts,reapplication}' WHEN 'each_separate_heat_event' THEN 'required' WHEN 'none' THEN 'not_stated' ELSE NULL END,'[]'::jsonb,v_protocol#>>'{source,label}',v_protocol#>>'{source,url}',v_protocol#>>'{source,text}',v_protocol->'guidance_payload') ON CONFLICT DO NOTHING;$insert$;
BEGIN
  SELECT pg_get_functiondef('public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL
     OR position('SECURITY DEFINER' IN v_definition) = 0
     OR position('SET search_path TO ''''' IN v_definition) = 0
     OR position(v_old_insert IN v_definition) = 0 THEN
    RAISE EXCEPTION 'exact catalog bundle heat mapping migration cannot verify the expected executor contract';
  END IF;

  v_definition := replace(v_definition, v_old_insert, v_new_insert);
  EXECUTE v_definition;
END;
$mapping$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) TO service_role;
