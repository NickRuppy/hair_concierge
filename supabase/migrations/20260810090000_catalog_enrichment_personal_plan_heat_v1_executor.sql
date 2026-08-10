-- Approved Heat-only catalog-enrichment executor. It depends on the category
-- readiness migration for product facts and application protocols.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.product_identifiers
  DROP CONSTRAINT IF EXISTS product_identifiers_type_check;
ALTER TABLE public.product_identifiers
  ADD CONSTRAINT product_identifiers_type_check CHECK (
    identifier_type IN ('ean', 'gtin', 'barcode', 'retailer_sku', 'retailer_url', 'manufacturer_sku')
  );

CREATE TABLE IF NOT EXISTS public.catalog_enrichment_applied_items (
  batch_id text NOT NULL,
  product_key text NOT NULL,
  batch_fingerprint text NOT NULL CHECK (batch_fingerprint ~ '^[a-f0-9]{64}$'),
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, product_key)
);
ALTER TABLE public.catalog_enrichment_applied_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_enrichment_applied_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.catalog_enrichment_applied_items FROM service_role;
GRANT SELECT ON TABLE public.catalog_enrichment_applied_items TO service_role;

DO $seeds$
DECLARE seed record; found_brand uuid; found_line uuid;
BEGIN
  FOR seed IN SELECT * FROM (VALUES
    ('brand', '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid, NULL::uuid, 'L''Oréal Paris', 'loreal paris'),
    ('brand', '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, NULL::uuid, 'taft', 'taft'),
    ('line', '424f3e04-4a35-4b52-a23a-a33c06b996b7'::uuid, '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid, 'Elvital Dream Length', 'elvital dream length'),
    ('line', '4cfd54ce-fd3f-4d5a-a06d-ff4b74163480'::uuid, '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, 'Aloe Boost', 'aloe boost'),
    ('line', '33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf'::uuid, '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, 'taft x Gliss Lovely Long', 'taft x gliss lovely long')
  ) AS t(kind, id, brand_id, canonical_name, normalized_name)
  LOOP
    IF seed.kind = 'brand' THEN
      SELECT id INTO found_brand FROM public.brands WHERE normalized_name = seed.normalized_name;
      IF found_brand IS NOT NULL AND found_brand <> seed.id THEN RAISE EXCEPTION 'catalog enrichment seed collision: brand %', seed.canonical_name; END IF;
      INSERT INTO public.brands (id, canonical_name, normalized_name) VALUES (seed.id, seed.canonical_name, seed.normalized_name) ON CONFLICT (id) DO NOTHING;
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id=seed.id AND canonical_name=seed.canonical_name AND normalized_name=seed.normalized_name) THEN RAISE EXCEPTION 'catalog enrichment seed mismatch: brand %', seed.canonical_name; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id=seed.brand_id) THEN RAISE EXCEPTION 'catalog enrichment seed missing parent: %', seed.canonical_name; END IF;
      SELECT id INTO found_line FROM public.product_lines WHERE brand_id=seed.brand_id AND normalized_name=seed.normalized_name;
      IF found_line IS NOT NULL AND found_line <> seed.id THEN RAISE EXCEPTION 'catalog enrichment seed collision: line %', seed.canonical_name; END IF;
      INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name) VALUES (seed.id, seed.brand_id, seed.canonical_name, seed.normalized_name) ON CONFLICT (id) DO NOTHING;
      IF NOT EXISTS (SELECT 1 FROM public.product_lines WHERE id=seed.id AND brand_id=seed.brand_id AND canonical_name=seed.canonical_name AND normalized_name=seed.normalized_name) THEN RAISE EXCEPTION 'catalog enrichment seed mismatch: line %', seed.canonical_name; END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.brand_aliases WHERE normalized_alias='schwarzkopf taft' AND brand_id <> '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid) THEN RAISE EXCEPTION 'catalog enrichment seed collision: Schwarzkopf taft alias'; END IF;
  INSERT INTO public.brand_aliases (brand_id, alias, normalized_alias, source) VALUES ('7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1', 'Schwarzkopf taft', 'schwarzkopf taft', 'curated') ON CONFLICT (normalized_alias) DO NOTHING;
END;
$seeds$;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_personal_plan_heat_v1(
  p_batch_json text, p_expected_batch_fingerprint text, p_reviewed_by text
) RETURNS TABLE(product_key text, product_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_batch jsonb; v_batch_fingerprint text; v_item jsonb; v_product jsonb; v_image jsonb; v_protocol jsonb; v_identifier jsonb;
  v_key text; v_content_fingerprint text; v_id uuid; v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_brand_id uuid; v_line_id uuid; v_expected_brand_id uuid; v_expected_line_id uuid; v_expected_brand_name text; v_expected_line_name text; v_existing_count integer;
  v_approved_batch_fingerprint constant text := 'b7b0148bdf59c723c15e7af0627c3acf8a8ff04fdf261d2fe6ad825cdf3ce91a';
BEGIN
  IF p_reviewed_by <> 'nick' THEN RAISE EXCEPTION 'catalog enrichment reviewer must be nick'; END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'catalog enrichment batch fingerprint must be lowercase sha256'; END IF;
  v_batch_fingerprint := encode(extensions.digest(convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex');
  IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN RAISE EXCEPTION 'catalog enrichment batch fingerprint mismatch'; END IF;
  IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN RAISE EXCEPTION 'catalog enrichment batch fingerprint is not approved'; END IF;
  BEGIN v_batch := p_batch_json::jsonb; EXCEPTION WHEN others THEN RAISE EXCEPTION 'catalog enrichment batch is invalid JSON'; END;
  IF v_batch->>'schema_version' IS DISTINCT FROM 'personal-plan-catalog-enrichment-heat-v1'
     OR v_batch->>'batch_id' IS DISTINCT FROM 'personal-plan-heat-launch-v1'
     OR v_batch->>'cohort_index_fingerprint' IS DISTINCT FROM 'f4edd43d54f9604b6287a86e5187a18bd44b4084260b0458ccbcde56cb6ee5f7' THEN RAISE EXCEPTION 'catalog enrichment batch header is invalid'; END IF;
  IF jsonb_typeof(v_batch->'products') IS DISTINCT FROM 'array' OR jsonb_array_length(v_batch->'products') <> 7 THEN RAISE EXCEPTION 'catalog enrichment batch must contain exactly 7 products'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:personal-plan-heat-launch-v1', 0));
  IF (SELECT count(DISTINCT value->>'product_key') FROM jsonb_array_elements(v_batch->'products')) <> 7 OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_batch->'products') i(value) WHERE (value->>'product_key',value->>'category_key') NOT IN (
    ('balea-two-phase-200ml','heat_protectant'),('balea-ultralight-200ml','heat_protectant'),('got2b-schutzengel-200ml','heat_protectant'),('jean-len-beat-the-heat-100ml','heat_protectant'),('loreal-elvital-dream-length-defeat-the-heat-150ml','heat_protectant'),('taft-aloe-boost-hydra-protect-150ml','heat_protectant'),('taft-gliss-lovely-long-150ml','heat_protectant')
  )) THEN RAISE EXCEPTION 'catalog enrichment product keys or category mapping are invalid'; END IF;
  SELECT count(*) INTO v_existing_count FROM public.catalog_enrichment_applied_items applied WHERE applied.batch_id='personal-plan-heat-launch-v1';
  IF v_existing_count NOT IN (0,7) OR (v_existing_count=7 AND EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items applied WHERE applied.batch_id='personal-plan-heat-launch-v1' AND applied.product_key NOT IN ('balea-two-phase-200ml','balea-ultralight-200ml','got2b-schutzengel-200ml','jean-len-beat-the-heat-100ml','loreal-elvital-dream-length-defeat-the-heat-150ml','taft-aloe-boost-hydra-protect-150ml','taft-gliss-lovely-long-150ml'))) THEN RAISE EXCEPTION 'catalog enrichment partial ledger state'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v_batch->'products') i(value) WHERE (i.value->'product'->>'is_chaarlie_recommended')::boolean) <> 5 THEN RAISE EXCEPTION 'catalog enrichment recommendation mix must be exactly 5 recommended and 2 not recommended'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_batch->'products') ORDER BY value->>'product_key' LOOP
    v_key:=v_item->>'product_key'; v_product:=v_item->'product'; v_image:=v_item->'image_asset'; v_content_fingerprint:=v_item->>'content_fingerprint';
    IF v_key !~ '^[a-z0-9][a-z0-9-]*$' OR v_content_fingerprint !~ '^[a-f0-9]{64}$' OR jsonb_typeof(v_product)<>'object' OR jsonb_typeof(v_image)<>'object' OR jsonb_typeof(v_item->'identifiers')<>'array' OR jsonb_array_length(v_item->'identifiers')=0 OR jsonb_typeof(v_item->'heat_spec')<>'object' OR jsonb_typeof(v_item->'protocols')<>'array' OR jsonb_array_length(v_item->'protocols')=0 THEN RAISE EXCEPTION 'catalog enrichment item is invalid: %', coalesce(v_key,'?'); END IF;
    IF v_product->>'origin' IS DISTINCT FROM 'curated' OR (v_product->>'is_active')::boolean IS DISTINCT FROM true OR v_product->>'lifecycle_status' IS DISTINCT FROM 'active' OR v_product->>'category' IS DISTINCT FROM 'heat_protectant' OR v_product->>'currency' IS DISTINCT FROM 'EUR' OR coalesce(jsonb_typeof(v_product->'is_chaarlie_recommended'),'')<>'boolean' OR ((v_key IN ('balea-two-phase-200ml','taft-aloe-boost-hydra-protect-150ml')) <> NOT (v_product->>'is_chaarlie_recommended')::boolean) OR v_product->>'purchase_link_status' NOT IN ('available','unavailable') OR ((v_product->>'purchase_link_status'='unavailable') AND (v_product->>'is_chaarlie_recommended')::boolean) THEN RAISE EXCEPTION 'catalog enrichment product fields are invalid: %', v_key; END IF;
    IF coalesce(v_image->>'storage_bucket','')<>'product-images' OR v_image->>'manifest_batch_id'<>'personal-plan-launch-v1' OR v_product->>'image_url'<>v_image->>'public_url' OR coalesce(v_image->>'asset_sha256','') !~ '^[a-f0-9]{64}$' OR (v_image->>'user_approved')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'catalog enrichment image fields are invalid: %', v_key; END IF;
    BEGIN v_brand_id:=NULLIF(v_product->>'brand_id','')::uuid; v_line_id:=NULLIF(v_product->>'product_line_id','')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'catalog enrichment identity is invalid: %',v_key; END;
    v_expected_brand_id:=CASE WHEN v_key LIKE 'balea-%' THEN '58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid WHEN v_key='got2b-schutzengel-200ml' THEN 'a286e2c2-6b44-41f3-a37b-f57d4ed1e93c'::uuid WHEN v_key='jean-len-beat-the-heat-100ml' THEN 'd1a06eff-1c23-472e-908e-f5364edb1bec'::uuid WHEN v_key LIKE 'loreal-%' THEN '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid ELSE '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid END;
    v_expected_brand_name:=CASE WHEN v_key LIKE 'balea-%' THEN 'Balea' WHEN v_key='got2b-schutzengel-200ml' THEN 'got2b' WHEN v_key='jean-len-beat-the-heat-100ml' THEN 'Jean&Len' WHEN v_key LIKE 'loreal-%' THEN 'L''Oréal Paris' ELSE 'taft' END;
    v_expected_line_id:=CASE WHEN v_key='loreal-elvital-dream-length-defeat-the-heat-150ml' THEN '424f3e04-4a35-4b52-a23a-a33c06b996b7'::uuid WHEN v_key='taft-aloe-boost-hydra-protect-150ml' THEN '4cfd54ce-fd3f-4d5a-a06d-ff4b74163480'::uuid WHEN v_key='taft-gliss-lovely-long-150ml' THEN '33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf'::uuid END;
    v_expected_line_name:=CASE WHEN v_key='loreal-elvital-dream-length-defeat-the-heat-150ml' THEN 'Elvital Dream Length' WHEN v_key='taft-aloe-boost-hydra-protect-150ml' THEN 'Aloe Boost' WHEN v_key='taft-gliss-lovely-long-150ml' THEN 'taft x Gliss Lovely Long' END;
    IF v_brand_id IS DISTINCT FROM v_expected_brand_id OR v_line_id IS DISTINCT FROM v_expected_line_id OR NOT EXISTS (SELECT 1 FROM public.brands WHERE id=v_brand_id AND canonical_name=v_expected_brand_name) OR (v_line_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_lines WHERE id=v_line_id AND brand_id=v_brand_id AND canonical_name=v_expected_line_name)) THEN RAISE EXCEPTION 'catalog enrichment identity is not approved: %',v_key; END IF;
    SELECT applied.* INTO v_existing FROM public.catalog_enrichment_applied_items applied WHERE applied.batch_id='personal-plan-heat-launch-v1' AND applied.product_key=v_key;
    IF FOUND THEN
      IF v_existing.batch_fingerprint<>v_batch_fingerprint OR v_existing.content_fingerprint<>v_content_fingerprint OR NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id=v_existing.product_id AND p.name=v_product->>'name' AND p.brand=v_product->>'brand' AND p.category_key='heat_protectant' AND p.brand_id=v_brand_id AND p.product_line_id IS NOT DISTINCT FROM v_line_id AND p.is_chaarlie_recommended=(v_product->>'is_chaarlie_recommended')::boolean) OR NOT EXISTS (SELECT 1 FROM public.product_image_assets i WHERE i.product_id=v_existing.product_id AND i.storage_bucket=v_image->>'storage_bucket' AND i.storage_path=v_image->>'storage_path' AND i.public_url=v_image->>'public_url' AND i.asset_sha256=v_image->>'asset_sha256' AND i.manifest_batch_id='personal-plan-launch-v1' AND i.user_approved=true) OR EXISTS ((SELECT jsonb_build_object('type',pi.identifier_type,'value',pi.identifier_value,'source',pi.source) FROM public.product_identifiers pi WHERE pi.product_id=v_existing.product_id EXCEPT SELECT value FROM jsonb_array_elements(v_item->'identifiers'))) OR EXISTS ((SELECT value FROM jsonb_array_elements(v_item->'identifiers') EXCEPT SELECT jsonb_build_object('type',pi.identifier_type,'value',pi.identifier_value,'source',pi.source) FROM public.product_identifiers pi WHERE pi.product_id=v_existing.product_id)) OR NOT EXISTS (SELECT 1 FROM public.product_heat_protectant_specs s WHERE s.product_id=v_existing.product_id AND s.format=v_item->'heat_spec'->>'format' AND s.provides_heat_protection=(v_item->'heat_spec'->>'provides_heat_protection')::boolean) OR EXISTS ((SELECT jsonb_build_object('category',pp.category,'role',pp.role,'cadence',pp.cadence,'application_stage',pp.application_stage,'application_state',pp.application_state,'placement',pp.placement,'contact_time_seconds',pp.contact_time_seconds,'rinse_action',pp.rinse_action,'reapplication',pp.reapplication,'instruction_modifiers',pp.instruction_modifiers,'source_label',pp.source_label,'source_url',pp.source_url,'source_text',pp.source_text) FROM public.product_application_protocols pp WHERE pp.product_id=v_existing.product_id EXCEPT SELECT value FROM jsonb_array_elements(v_item->'protocols'))) OR EXISTS ((SELECT value FROM jsonb_array_elements(v_item->'protocols') EXCEPT SELECT jsonb_build_object('category',pp.category,'role',pp.role,'cadence',pp.cadence,'application_stage',pp.application_stage,'application_state',pp.application_state,'placement',pp.placement,'contact_time_seconds',pp.contact_time_seconds,'rinse_action',pp.rinse_action,'reapplication',pp.reapplication,'instruction_modifiers',pp.instruction_modifiers,'source_label',pp.source_label,'source_url',pp.source_url,'source_text',pp.source_text) FROM public.product_application_protocols pp WHERE pp.product_id=v_existing.product_id)) THEN RAISE EXCEPTION 'catalog enrichment conflicting or partial retry: %',v_key; END IF;
      product_key:=v_key; product_id:=v_existing.product_id; RETURN NEXT; CONTINUE;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:'||v_key,0));
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.brand_id=v_brand_id AND regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+',' ','g')=regexp_replace(lower(v_product->>'name'),'[^a-z0-9]+',' ','g') AND p.category_key='heat_protectant') THEN RAISE EXCEPTION 'catalog enrichment product already exists: %',v_key; END IF;
    FOR v_identifier IN SELECT value FROM jsonb_array_elements(v_item->'identifiers') LOOP
      IF v_identifier->>'type' NOT IN ('ean','gtin','barcode','retailer_sku','retailer_url','manufacturer_sku') OR coalesce(v_identifier->>'value','')='' OR coalesce(v_identifier->>'source','')='' OR EXISTS (SELECT 1 FROM public.product_identifiers pi WHERE pi.identifier_type=v_identifier->>'type' AND pi.normalized_identifier_value=public.product_intake_review_normalize_identifier_value(v_identifier->>'type',v_identifier->>'value')) OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_batch->'products') b, jsonb_array_elements(b.value->'identifiers') other WHERE b.value->>'product_key'<>v_key AND other.value->>'type'=v_identifier->>'type' AND public.product_intake_review_normalize_identifier_value(other.value->>'type',other.value->>'value')=public.product_intake_review_normalize_identifier_value(v_identifier->>'type',v_identifier->>'value')) THEN RAISE EXCEPTION 'catalog enrichment identifier collision: %',v_key; END IF;
    END LOOP;
    FOR v_protocol IN SELECT value FROM jsonb_array_elements(v_item->'protocols') LOOP IF v_protocol->>'category'<>'heat_protectant' OR v_protocol->>'role'<>'pre_heat_protection' THEN RAISE EXCEPTION 'catalog enrichment protocol is invalid: %',v_key; END IF; END LOOP;
    INSERT INTO public.products(name,brand,category,affiliate_link,image_url,price_eur,currency,is_active,lifecycle_status,category_key,brand_id,product_line_id,origin,is_chaarlie_recommended,purchase_link_status,purchase_link_checked_at,price_checked_at) VALUES(v_product->>'name',v_product->>'brand','heat_protectant',v_product->>'affiliate_link',v_product->>'image_url',(v_product->>'price_eur')::numeric,'EUR',true,'active','heat_protectant',v_brand_id,v_line_id,'curated',(v_product->>'is_chaarlie_recommended')::boolean,v_product->>'purchase_link_status',(v_product->>'purchase_link_checked_at')::timestamptz,(v_product->>'price_checked_at')::timestamptz) RETURNING id INTO v_id;
    INSERT INTO public.product_image_assets(product_id,storage_bucket,storage_path,public_url,source_page_url,source_image_url,source_type,quality_confidence,processing_method,asset_sha256,manifest_batch_id,user_approved,notes) VALUES(v_id,v_image->>'storage_bucket',v_image->>'storage_path',v_image->>'public_url',v_image->>'source_page_url',v_image->>'source_image_url',v_image->>'source_type',v_image->>'quality_confidence',v_image->>'processing_method',v_image->>'asset_sha256','personal-plan-launch-v1',true,v_image->>'notes');
    INSERT INTO public.product_identifiers(product_id,identifier_type,identifier_value,source) SELECT v_id,value->>'type',value->>'value',value->>'source' FROM jsonb_array_elements(v_item->'identifiers');
    INSERT INTO public.product_heat_protectant_specs(product_id,format,provides_heat_protection) VALUES(v_id,v_item->'heat_spec'->>'format',(v_item->'heat_spec'->>'provides_heat_protection')::boolean);
    INSERT INTO public.product_application_protocols(product_id,category,role,cadence,application_stage,application_state,placement,contact_time_seconds,rinse_action,reapplication,instruction_modifiers,source_label,source_url,source_text) SELECT v_id,'heat_protectant','pre_heat_protection',value->'cadence',value->>'application_stage',value->>'application_state',value->>'placement',NULLIF(value->>'contact_time_seconds','')::integer,value->>'rinse_action',value->>'reapplication',coalesce(value->'instruction_modifiers','[]'::jsonb),value->>'source_label',value->>'source_url',value->>'source_text' FROM jsonb_array_elements(v_item->'protocols');
    INSERT INTO public.catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by) VALUES('personal-plan-heat-launch-v1',v_key,v_batch_fingerprint,v_content_fingerprint,v_id,'nick'); product_key:=v_key; product_id:=v_id; RETURN NEXT;
  END LOOP;
END;
$fn$;
REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text) TO service_role;
