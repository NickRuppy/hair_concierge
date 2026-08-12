-- Exact catalog bundles are the only replay-safe route for completing a
-- curated product's authority facts and exact application directions together.
CREATE TABLE IF NOT EXISTS public.personal_plan_catalog_fact_evidence (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL,
  source_label text NOT NULL,
  source_url text NOT NULL,
  source_text text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manufacturer', 'retailer', 'professional_authority')),
  checked_at date NOT NULL,
  batch_id text NOT NULL,
  batch_fingerprint text NOT NULL,
  content_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, fact_key, source_url)
);
ALTER TABLE public.personal_plan_catalog_fact_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_catalog_fact_evidence FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(
  p_bundle_json text,
  p_expected_bundle_fingerprint text,
  p_reviewed_by text
) RETURNS TABLE(product_id uuid, category_key text, applied_roles text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_bundle jsonb; v_item jsonb; v_fact jsonb; v_protocol jsonb; v_source jsonb;
  v_bundle_fingerprint text; v_item_fingerprint text; v_product public.products%ROWTYPE;
  v_product_id uuid; v_target text; v_expected text; v_roles text[]; v_existing public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  IF p_reviewed_by <> 'nick' THEN RAISE EXCEPTION 'exact catalog bundle reviewer must be nick'; END IF;
  IF p_expected_bundle_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'exact catalog bundle fingerprint must be lowercase sha256'; END IF;
  v_bundle_fingerprint := encode(extensions.digest(pg_catalog.convert_to(p_bundle_json, 'UTF8'), 'sha256'), 'hex');
  IF v_bundle_fingerprint <> p_expected_bundle_fingerprint THEN RAISE EXCEPTION 'exact catalog bundle fingerprint mismatch'; END IF;
  BEGIN v_bundle := p_bundle_json::jsonb; EXCEPTION WHEN others THEN RAISE EXCEPTION 'exact catalog bundle is invalid JSON'; END;
  IF v_bundle->>'schema_version' IS DISTINCT FROM 'personal-plan-exact-catalog-bundle-v1'
     OR coalesce(v_bundle->>'batch_id', '') !~ '^S5-[0-9]{2}-[a-z0-9-]+$'
     OR jsonb_typeof(v_bundle->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(v_bundle->'items') < 1 THEN
    RAISE EXCEPTION 'exact catalog bundle header is invalid';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v_bundle->'items')) <> (SELECT count(DISTINCT item->>'product_id') FROM jsonb_array_elements(v_bundle->'items') entries(item)) THEN RAISE EXCEPTION 'exact catalog bundle has duplicate products'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal-plan-exact-catalog-bundle:' || (v_bundle->>'batch_id'), 0));

  FOR v_item IN SELECT item FROM jsonb_array_elements(v_bundle->'items') entries(item) ORDER BY item->>'product_id' LOOP
    BEGIN v_product_id := (v_item->>'product_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'exact catalog bundle product ID is invalid'; END;
    v_target := v_item->>'target_category'; v_expected := v_item->>'expected_current_category'; v_fact := v_item->'facts';
    v_item_fingerprint := encode(extensions.digest(pg_catalog.convert_to(v_item::text, 'UTF8'), 'sha256'), 'hex');
    IF v_target NOT IN ('mask','leave_in','oil','deep_cleansing_shampoo') OR jsonb_typeof(v_fact) IS DISTINCT FROM 'object' OR v_fact->>'category' IS DISTINCT FROM v_target OR jsonb_typeof(v_item->'protocols') IS DISTINCT FROM 'array' OR jsonb_array_length(v_item->'protocols') < 1 THEN RAISE EXCEPTION 'exact catalog bundle item shape is invalid: %', v_product_id; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND OR v_product.origin <> 'curated' OR NOT v_product.is_active OR v_product.lifecycle_status <> 'active' THEN RAISE EXCEPTION 'exact catalog bundle product is not an active curated product: %', v_product_id; END IF;
    IF v_product.category_key IS DISTINCT FROM NULLIF(v_expected, '') THEN RAISE EXCEPTION 'exact catalog bundle expected category conflict: %', v_product_id; END IF;
    IF (v_expected IS NULL OR v_expected = '') AND v_target <> 'deep_cleansing_shampoo' THEN RAISE EXCEPTION 'only Deep Cleansing category repair may start with a NULL category: %', v_product_id; END IF;
    IF v_product.category_key IS NOT NULL AND v_product.category_key <> v_target THEN RAISE EXCEPTION 'exact catalog bundle cannot recategorize an existing category: %', v_product_id; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(v_item->'protocols') entries(protocol)) <> (SELECT count(DISTINCT protocol->>'role') FROM jsonb_array_elements(v_item->'protocols') entries(protocol)) THEN RAISE EXCEPTION 'exact catalog bundle has duplicate roles: %', v_product_id; END IF;

    -- Validate every canonical protocol before writing any fact. This mirrors the
    -- TS schema at the trust boundary and rejects incomplete/foreign evidence.
    FOR v_protocol IN SELECT protocol FROM jsonb_array_elements(v_item->'protocols') entries(protocol) LOOP
      IF jsonb_typeof(v_protocol->'guidance_payload') IS DISTINCT FROM 'object'
         OR (v_protocol->'guidance_payload'->>'schemaVersion') IS DISTINCT FROM '1'
         OR v_protocol#>>'{guidance_payload,scope,kind}' IS DISTINCT FROM 'product'
         OR v_protocol#>>'{guidance_payload,scope,productId}' IS DISTINCT FROM v_product_id::text
         OR v_protocol#>>'{guidance_payload,scope,category}' IS DISTINCT FROM v_target
         OR jsonb_typeof(v_protocol->'guidance_payload'->'steps') IS DISTINCT FROM 'array' OR jsonb_array_length(v_protocol->'guidance_payload'->'steps') < 1
         OR jsonb_typeof(v_protocol->'guidance_payload'->'evidence') IS DISTINCT FROM 'array' OR jsonb_array_length(v_protocol->'guidance_payload'->'evidence') < 1
         OR coalesce(pg_catalog.btrim(v_protocol#>>'{source,label}'), '') = ''
         OR coalesce(pg_catalog.btrim(v_protocol#>>'{source,text}'), '') = ''
         OR coalesce(v_protocol#>>'{source,url}', '') !~ '^https?://'
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_protocol->'guidance_payload'->'evidence') evidence WHERE evidence->>'sourceUrl' = v_protocol#>>'{source,url}') THEN
        RAISE EXCEPTION 'exact catalog bundle canonical protocol is invalid: %:%', v_product_id, v_protocol->>'role';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.product_application_protocols p
        WHERE p.product_id=v_product_id
          AND p.category=v_target
          AND p.role=v_protocol->>'role'
          AND (
            p.cadence IS DISTINCT FROM v_protocol->'cadence'
            OR p.source_label IS DISTINCT FROM v_protocol#>>'{source,label}'
            OR p.source_url IS DISTINCT FROM v_protocol#>>'{source,url}'
            OR p.source_text IS DISTINCT FROM v_protocol#>>'{source,text}'
            OR p.guidance_payload IS DISTINCT FROM v_protocol->'guidance_payload'
          )
      ) THEN RAISE EXCEPTION 'exact catalog bundle protocol conflicts with existing authority: %:%', v_product_id, v_protocol->>'role'; END IF;
    END LOOP;

    -- Whitelist exactly the authority fields added by v3/v4; no generic JSON-to-row update exists.
    IF v_target = 'mask' THEN
      IF v_fact#>>'{values,repair_support_level}' NOT IN ('low','medium','high') OR jsonb_typeof(v_fact#>'{values,functional_benefits}') <> 'array' OR jsonb_array_length(v_fact#>'{values,functional_benefits}') < 1 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_fact#>'{values,functional_benefits}') x WHERE x NOT IN ('smoothing_frizz_control','detangling_slip','shine')) THEN RAISE EXCEPTION 'exact catalog bundle Mask facts are invalid: %', v_product_id; END IF;
      IF EXISTS (SELECT 1 FROM public.product_mask_specs s WHERE s.product_id=v_product_id AND ((s.repair_support_level IS NOT NULL AND s.repair_support_level IS DISTINCT FROM v_fact#>>'{values,repair_support_level}') OR (s.functional_benefits IS NOT NULL AND s.functional_benefits IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,functional_benefits}'))))) THEN RAISE EXCEPTION 'exact catalog bundle Mask facts conflict: %', v_product_id; END IF;
      UPDATE public.product_mask_specs AS s SET repair_support_level=v_fact#>>'{values,repair_support_level}', functional_benefits=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,functional_benefits}')) WHERE s.product_id=v_product_id;
    ELSIF v_target = 'leave_in' THEN
      IF v_fact#>>'{values,care_direction}' NOT IN ('moisture','balanced','protein') OR v_fact#>>'{values,repair_support_level}' NOT IN ('low','medium','high') OR jsonb_typeof(v_fact#>'{values,plan_roles}') <> 'array' OR jsonb_array_length(v_fact#>'{values,plan_roles}') < 1 OR jsonb_typeof(v_fact#>'{values,functional_benefits}') <> 'array' OR jsonb_array_length(v_fact#>'{values,functional_benefits}') < 1 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_fact#>'{values,plan_roles}') x WHERE x NOT IN ('post_wash_leave_in','pre_heat_application')) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_fact#>'{values,functional_benefits}') x WHERE x NOT IN ('detangle','moisture_softness','smooth_anti_frizz','heat_protect','repair_support','curl_shape_support','shine_support')) THEN RAISE EXCEPTION 'exact catalog bundle Leave-in facts are invalid: %', v_product_id; END IF;
      IF EXISTS (SELECT 1 FROM public.product_leave_in_specs s WHERE s.product_id=v_product_id AND ((s.care_direction IS NOT NULL AND s.care_direction IS DISTINCT FROM v_fact#>>'{values,care_direction}') OR (s.repair_support_level IS NOT NULL AND s.repair_support_level IS DISTINCT FROM v_fact#>>'{values,repair_support_level}') OR (s.plan_roles IS NOT NULL AND s.plan_roles IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,plan_roles}'))) OR (s.functional_benefits IS NOT NULL AND s.functional_benefits IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,functional_benefits}'))))) THEN RAISE EXCEPTION 'exact catalog bundle Leave-in facts conflict: %', v_product_id; END IF;
      UPDATE public.product_leave_in_specs AS s SET care_direction=v_fact#>>'{values,care_direction}', repair_support_level=v_fact#>>'{values,repair_support_level}', plan_roles=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,plan_roles}')), functional_benefits=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,functional_benefits}')) WHERE s.product_id=v_product_id;
    ELSIF v_target = 'oil' THEN
      IF v_fact#>>'{values,weight}' NOT IN ('light','medium','rich') OR jsonb_typeof(v_fact#>'{values,role_support}') <> 'array' OR jsonb_array_length(v_fact#>'{values,role_support}') < 1 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_fact#>'{values,role_support}') x WHERE x NOT IN ('pre_wash_fibre_treatment','leave_on_fibre_conditioning','dry_finish','pre_heat_protection')) THEN RAISE EXCEPTION 'exact catalog bundle Oil facts are invalid: %', v_product_id; END IF;
      IF EXISTS (SELECT 1 FROM public.product_oil_specs s WHERE s.product_id=v_product_id AND ((s.weight IS NOT NULL AND s.weight IS DISTINCT FROM v_fact#>>'{values,weight}') OR (s.role_support IS NOT NULL AND s.role_support IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,role_support}'))))) THEN RAISE EXCEPTION 'exact catalog bundle Oil facts conflict: %', v_product_id; END IF;
      UPDATE public.product_oil_specs AS s SET weight=v_fact#>>'{values,weight}', role_support=ARRAY(SELECT jsonb_array_elements_text(v_fact#>'{values,role_support}')) WHERE s.product_id=v_product_id;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.product_deep_cleansing_shampoo_specs AS s WHERE s.product_id=v_product_id) THEN RAISE EXCEPTION 'Deep Cleansing category repair requires an existing Deep Cleansing spec: %', v_product_id; END IF;
    END IF;
    IF NOT FOUND AND v_target <> 'deep_cleansing_shampoo' THEN RAISE EXCEPTION 'exact catalog bundle required fact row is missing: %', v_product_id; END IF;

    SELECT array_agg(protocol->>'role' ORDER BY protocol->>'role') INTO v_roles FROM jsonb_array_elements(v_item->'protocols') entries(protocol);
    IF v_target = 'mask' AND NOT ('intensive_conditioning_mask' = ANY(v_roles)) THEN RAISE EXCEPTION 'exact catalog bundle is missing the required Mask protocol: %', v_product_id; END IF;
    IF v_target = 'leave_in' AND ((v_fact#>>'{values,plan_roles}') IS NOT NULL) AND ((v_fact#>'{values,plan_roles}') ? 'post_wash_leave_in') AND NOT ('post_wash_leave_in' = ANY(v_roles)) THEN RAISE EXCEPTION 'exact catalog bundle is missing the required Leave-in post-wash protocol: %', v_product_id; END IF;
    IF v_target = 'leave_in' AND ((v_fact#>'{values,plan_roles}') ? 'pre_heat_application') AND NOT ('pre_heat_protection' = ANY(v_roles)) THEN RAISE EXCEPTION 'exact catalog bundle is missing the required Leave-in heat protocol: %', v_product_id; END IF;
    IF v_target = 'oil' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_fact#>'{values,role_support}') required(role) WHERE NOT (required.role = ANY(v_roles))) THEN RAISE EXCEPTION 'exact catalog bundle is missing a required Oil protocol: %', v_product_id; END IF;
    IF v_target = 'deep_cleansing_shampoo' AND ((EXISTS (SELECT 1 FROM public.product_deep_cleansing_shampoo_specs AS s WHERE s.product_id=v_product_id AND s.reset_focus IN ('product_sebum_buildup','broad_spectrum_detox')) AND NOT ('residue_reset' = ANY(v_roles))) OR (EXISTS (SELECT 1 FROM public.product_deep_cleansing_shampoo_specs AS s WHERE s.product_id=v_product_id AND s.reset_focus IN ('metal_mineral_hard_water','broad_spectrum_detox')) AND NOT ('mineral_reset' = ANY(v_roles)))) THEN RAISE EXCEPTION 'Deep Cleansing category repair requires every exact reset protocol in the same bundle: %', v_product_id; END IF;
    FOR v_protocol IN SELECT protocol FROM jsonb_array_elements(v_item->'protocols') entries(protocol) LOOP
      INSERT INTO public.product_application_protocols(product_id,category,role,cadence,application_stage,application_state,placement,contact_time_seconds,rinse_action,reapplication,instruction_modifiers,source_label,source_url,source_text,guidance_payload)
      VALUES(v_product_id,v_target,v_protocol->>'role',v_protocol->'cadence',v_protocol#>>'{guidance_payload,sequence,anchor}',NULL,v_protocol#>>'{guidance_payload,protocolFacts,applicationArea}',NULLIF(v_protocol#>>'{guidance_payload,protocolFacts,contactTimeSeconds}','')::integer,v_protocol#>>'{guidance_payload,protocolFacts,rinse}',NULL,'[]'::jsonb,v_protocol#>>'{source,label}',v_protocol#>>'{source,url}',v_protocol#>>'{source,text}',v_protocol->'guidance_payload') ON CONFLICT DO NOTHING;
    END LOOP;
    FOR v_source IN SELECT source FROM jsonb_array_elements(v_fact->'sources') entries(source) LOOP
      IF coalesce(v_source->>'label','')='' OR coalesce(v_source->>'text','')='' OR coalesce(v_source->>'url','') !~ '^https?://' OR v_source->>'sourceType' NOT IN ('manufacturer','retailer','professional_authority') OR (v_source->>'checkedAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'exact catalog bundle fact provenance is invalid: %', v_product_id; END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_fact->'sources') entries(source)
      JOIN public.personal_plan_catalog_fact_evidence existing
        ON existing.product_id = v_product_id
       AND existing.fact_key = v_target || '.authority_facts'
       AND existing.source_url = source->>'url'
      WHERE existing.fact_value IS DISTINCT FROM v_fact->'values'
         OR existing.source_label IS DISTINCT FROM source->>'label'
         OR existing.source_text IS DISTINCT FROM source->>'text'
         OR existing.source_type IS DISTINCT FROM source->>'sourceType'
         OR existing.checked_at IS DISTINCT FROM (source->>'checkedAt')::date
    ) THEN RAISE EXCEPTION 'exact catalog bundle fact evidence conflicts: %', v_product_id; END IF;
    INSERT INTO public.personal_plan_catalog_fact_evidence(product_id,fact_key,fact_value,source_label,source_url,source_text,source_type,checked_at,batch_id,batch_fingerprint,content_fingerprint)
    SELECT v_product_id, v_target || '.authority_facts', v_fact->'values', source->>'label', source->>'url', source->>'text', source->>'sourceType', (source->>'checkedAt')::date, v_bundle->>'batch_id', v_bundle_fingerprint, v_item_fingerprint FROM jsonb_array_elements(v_fact->'sources') entries(source)
    ON CONFLICT ON CONSTRAINT personal_plan_catalog_fact_evidence_pkey DO UPDATE SET fact_value=EXCLUDED.fact_value,source_label=EXCLUDED.source_label,source_text=EXCLUDED.source_text,source_type=EXCLUDED.source_type,checked_at=EXCLUDED.checked_at,batch_id=EXCLUDED.batch_id,batch_fingerprint=EXCLUDED.batch_fingerprint,content_fingerprint=EXCLUDED.content_fingerprint
    WHERE public.personal_plan_catalog_fact_evidence.fact_value IS NOT DISTINCT FROM EXCLUDED.fact_value AND public.personal_plan_catalog_fact_evidence.source_url IS NOT DISTINCT FROM EXCLUDED.source_url;
    IF NOT FOUND THEN RAISE EXCEPTION 'exact catalog bundle fact evidence conflicts: %', v_product_id; END IF;
    SELECT * INTO v_existing FROM public.catalog_enrichment_applied_items WHERE batch_id=v_bundle->>'batch_id' AND product_key='bundle:' || v_product_id::text;
    IF FOUND THEN IF v_existing.batch_fingerprint <> v_bundle_fingerprint OR v_existing.content_fingerprint <> v_item_fingerprint OR v_existing.product_id <> v_product_id OR v_existing.reviewed_by <> 'nick' THEN RAISE EXCEPTION 'exact catalog bundle retry ledger conflicts: %', v_product_id; END IF;
    ELSE INSERT INTO public.catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by) VALUES(v_bundle->>'batch_id','bundle:' || v_product_id::text,v_bundle_fingerprint,v_item_fingerprint,v_product_id,'nick'); END IF;
    IF v_product.category_key IS NULL THEN UPDATE public.products SET category_key=v_target WHERE id=v_product_id; END IF;
    product_id:=v_product_id; category_key:=v_target; applied_roles:=v_roles; RETURN NEXT;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text) TO service_role;
