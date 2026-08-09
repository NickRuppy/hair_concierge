-- Approved B1 executor. This is deliberately a narrow, internal-only write
-- boundary; storage verification remains in the caller before this RPC.
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

-- Fixed IDs make a collision fail closed instead of silently adopting a row
-- created by unrelated catalog work.
DO $seeds$
DECLARE
  seed record;
  found_brand uuid;
  found_line uuid;
BEGIN
  FOR seed IN SELECT * FROM (VALUES
    ('brand', '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, NULL::uuid, 'taft', 'taft'),
    ('brand', 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid, NULL::uuid, 'Eucerin', 'eucerin'),
    ('brand', 'c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9'::uuid, NULL::uuid, 'The Ordinary', 'the ordinary'),
    ('line', '424f3e04-4a35-4b52-a23a-a33c06b996b7'::uuid, '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid, 'Elvital Dream Length', 'elvital dream length'),
    ('line', 'cfb409a0-c4d3-4d8f-b605-69f23e68dd1a'::uuid, '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid, 'Elvital Fiber Booster', 'elvital fiber booster'),
    ('line', '4cfd54ce-fd3f-4d5a-a06d-ff4b74163480'::uuid, '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, 'Aloe Boost', 'aloe boost'),
    ('line', '33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf'::uuid, '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid, 'taft x Gliss Lovely Long', 'taft x gliss lovely long'),
    ('line', 'be663588-e88c-48e2-ae10-cfd320ffd444'::uuid, 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid, 'DermoCapillaire Urea', 'dermocapillaire urea'),
    ('line', 'ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8'::uuid, '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid, 'Derma X Pro', 'derma x pro')
  ) AS t(kind, id, brand_id, canonical_name, normalized_name)
  LOOP
    IF seed.kind = 'brand' THEN
      SELECT id INTO found_brand FROM public.brands WHERE normalized_name = seed.normalized_name;
      IF found_brand IS NOT NULL AND found_brand <> seed.id THEN RAISE EXCEPTION 'catalog enrichment seed collision: brand %', seed.canonical_name; END IF;
      INSERT INTO public.brands (id, canonical_name, normalized_name) VALUES (seed.id, seed.canonical_name, seed.normalized_name)
      ON CONFLICT (id) DO NOTHING;
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = seed.id AND canonical_name = seed.canonical_name AND normalized_name = seed.normalized_name) THEN RAISE EXCEPTION 'catalog enrichment seed mismatch: brand %', seed.canonical_name; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = seed.brand_id) THEN RAISE EXCEPTION 'catalog enrichment seed missing parent: %', seed.canonical_name; END IF;
      SELECT id INTO found_line FROM public.product_lines WHERE brand_id = seed.brand_id AND normalized_name = seed.normalized_name;
      IF found_line IS NOT NULL AND found_line <> seed.id THEN RAISE EXCEPTION 'catalog enrichment seed collision: line %', seed.canonical_name; END IF;
      INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name) VALUES (seed.id, seed.brand_id, seed.canonical_name, seed.normalized_name)
      ON CONFLICT (id) DO NOTHING;
      IF NOT EXISTS (SELECT 1 FROM public.product_lines WHERE id = seed.id AND brand_id = seed.brand_id AND canonical_name = seed.canonical_name AND normalized_name = seed.normalized_name) THEN RAISE EXCEPTION 'catalog enrichment seed mismatch: line %', seed.canonical_name; END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.brand_aliases WHERE normalized_alias = 'schwarzkopf taft' AND brand_id <> '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid) THEN RAISE EXCEPTION 'catalog enrichment seed collision: Schwarzkopf taft alias'; END IF;
  INSERT INTO public.brand_aliases (brand_id, alias, normalized_alias, source) VALUES ('7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1', 'Schwarzkopf taft', 'schwarzkopf taft', 'curated') ON CONFLICT (normalized_alias) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.brand_aliases WHERE brand_id='7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid AND product_line_id IS NULL AND alias='Schwarzkopf taft' AND normalized_alias='schwarzkopf taft' AND source='curated') THEN RAISE EXCEPTION 'catalog enrichment seed mismatch: Schwarzkopf taft alias'; END IF;
END;
$seeds$;

CREATE OR REPLACE FUNCTION public.catalog_enrichment_apply_batch(
  p_batch_json text, p_expected_batch_fingerprint text, p_reviewed_by text
) RETURNS TABLE(product_key text, product_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_batch jsonb; v_batch_fingerprint text; v_item jsonb; v_product jsonb; v_image jsonb;
  v_key text; v_category text; v_content_fingerprint text; v_id uuid; v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_brand_id uuid; v_line_id uuid; v_expected_brand_id uuid; v_expected_line_id uuid; v_expected_brand_name text; v_expected_line_name text; v_protocol jsonb; v_identifier jsonb;
  v_existing_count integer;
  v_expected_b0_index_fingerprint constant text := '6347a416f47dd48615bcfbf82863c99823028b3c83dffc9b1a63c8bcf490342e';
BEGIN
  IF p_reviewed_by <> 'nick' THEN RAISE EXCEPTION 'catalog enrichment reviewer must be nick'; END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'catalog enrichment batch fingerprint must be lowercase sha256'; END IF;
  v_batch_fingerprint := encode(extensions.digest(convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex');
  IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN RAISE EXCEPTION 'catalog enrichment batch fingerprint mismatch'; END IF;
  BEGIN v_batch := p_batch_json::jsonb; EXCEPTION WHEN others THEN RAISE EXCEPTION 'catalog enrichment batch is invalid JSON'; END;
  IF v_batch->>'schema_version' IS DISTINCT FROM 'personal-plan-catalog-enrichment-b1' OR v_batch->>'batch_id' IS DISTINCT FROM 'personal-plan-launch-v1'
     OR v_batch->>'accepted_base_sha' IS DISTINCT FROM '580c3c118bc979679aee7b5782ad29c3dd0622ca'
     OR v_batch->>'b0_index_fingerprint' IS DISTINCT FROM v_expected_b0_index_fingerprint THEN RAISE EXCEPTION 'catalog enrichment batch header is invalid'; END IF;
  IF jsonb_typeof(v_batch->'products') IS DISTINCT FROM 'array' OR jsonb_array_length(v_batch->'products') IS DISTINCT FROM 15 THEN RAISE EXCEPTION 'catalog enrichment batch must contain exactly 15 products'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:personal-plan-launch-v1', 0));
  IF (SELECT count(DISTINCT value->>'product_key') FROM jsonb_array_elements(v_batch->'products')) <> 15 THEN RAISE EXCEPTION 'catalog enrichment product keys must be unique'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_batch->'products') AS items(value)
    WHERE value->>'product_key' NOT IN (
      'balea-two-phase-200ml','balea-ultralight-200ml','got2b-schutzengel-200ml','jean-len-beat-the-heat-100ml','loreal-elvital-dream-length-defeat-the-heat-150ml','taft-aloe-boost-hydra-protect-150ml','taft-gliss-lovely-long-150ml','balea-professional-aha-scalp-peeling','balea-professional-sensitive-scalp-serum','eucerin-dermocapillaire-urea-intensive-tonic','gliss-scalp-balance-clarifying-serum','head-shoulders-derma-x-pro-scalp-leave-in','isana-professional-aha-pha-scalp-peeling','loreal-elvital-fiber-booster-scalp-serum','the-ordinary-multi-peptide-hair-density-serum'
    )
  ) THEN RAISE EXCEPTION 'catalog enrichment batch contains an unapproved product key'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_batch->'products') AS i(value) WHERE (value->>'product_key', value->>'category_key') NOT IN (
    ('balea-two-phase-200ml','heat_protectant'),('balea-ultralight-200ml','heat_protectant'),('got2b-schutzengel-200ml','heat_protectant'),('jean-len-beat-the-heat-100ml','heat_protectant'),('loreal-elvital-dream-length-defeat-the-heat-150ml','heat_protectant'),('taft-aloe-boost-hydra-protect-150ml','heat_protectant'),('taft-gliss-lovely-long-150ml','heat_protectant'),('balea-professional-aha-scalp-peeling','scalp_care'),('balea-professional-sensitive-scalp-serum','scalp_care'),('eucerin-dermocapillaire-urea-intensive-tonic','scalp_care'),('gliss-scalp-balance-clarifying-serum','scalp_care'),('head-shoulders-derma-x-pro-scalp-leave-in','scalp_care'),('isana-professional-aha-pha-scalp-peeling','scalp_care'),('loreal-elvital-fiber-booster-scalp-serum','scalp_care'),('the-ordinary-multi-peptide-hair-density-serum','scalp_care')
  )) THEN RAISE EXCEPTION 'catalog enrichment key/category mapping is invalid'; END IF;
  SELECT count(*) INTO v_existing_count FROM public.catalog_enrichment_applied_items ledger WHERE ledger.batch_id='personal-plan-launch-v1';
  IF v_existing_count NOT IN (0, 15) OR (v_existing_count = 15 AND EXISTS (
    SELECT 1 FROM public.catalog_enrichment_applied_items ledger WHERE ledger.batch_id='personal-plan-launch-v1' AND ledger.product_key NOT IN (
      'balea-two-phase-200ml','balea-ultralight-200ml','got2b-schutzengel-200ml','jean-len-beat-the-heat-100ml','loreal-elvital-dream-length-defeat-the-heat-150ml','taft-aloe-boost-hydra-protect-150ml','taft-gliss-lovely-long-150ml','balea-professional-aha-scalp-peeling','balea-professional-sensitive-scalp-serum','eucerin-dermocapillaire-urea-intensive-tonic','gliss-scalp-balance-clarifying-serum','head-shoulders-derma-x-pro-scalp-leave-in','isana-professional-aha-pha-scalp-peeling','loreal-elvital-fiber-booster-scalp-serum','the-ordinary-multi-peptide-hair-density-serum'
    )
  )) THEN RAISE EXCEPTION 'catalog enrichment partial ledger state'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_batch->'products') ORDER BY value->>'product_key' LOOP
    v_key := v_item->>'product_key'; v_category := v_item->>'category_key'; v_product := v_item->'product'; v_image := v_item->'image_asset'; v_content_fingerprint := v_item->>'content_fingerprint';
    IF v_key !~ '^[a-z0-9][a-z0-9-]*$' OR v_category IS NULL OR v_category NOT IN ('heat_protectant','scalp_care') OR v_content_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'catalog enrichment item is invalid: %', coalesce(v_key, '?'); END IF;
    IF coalesce(jsonb_typeof(v_product),'') <> 'object' OR coalesce(jsonb_typeof(v_image),'') <> 'object' OR coalesce(jsonb_typeof(v_item->'identifiers'),'') <> 'array' OR coalesce(jsonb_array_length(v_item->'identifiers'),0) = 0 OR coalesce(jsonb_typeof(v_item->'protocols'),'') <> 'array' OR coalesce(jsonb_array_length(v_item->'protocols'),0) = 0 THEN RAISE EXCEPTION 'catalog enrichment item shape is invalid: %', v_key; END IF;
    IF v_product->>'origin' IS DISTINCT FROM 'curated' OR (v_product->>'is_active')::boolean IS DISTINCT FROM true OR v_product->>'lifecycle_status' IS DISTINCT FROM 'active' OR coalesce(jsonb_typeof(v_product->'is_chaarlie_recommended'),'') <> 'boolean' OR coalesce(v_product->>'name','') = '' OR coalesce(v_product->>'brand','') = '' OR coalesce(v_product->>'affiliate_link','') = '' OR v_product->>'currency' IS DISTINCT FROM 'EUR' OR v_product->>'category' IS DISTINCT FROM v_category OR v_product->>'purchase_link_status' NOT IN ('available','unavailable') OR (v_product->>'purchase_link_status'='unavailable' AND (v_product->>'is_chaarlie_recommended')::boolean) OR ((v_key IN ('balea-two-phase-200ml','taft-aloe-boost-hydra-protect-150ml')) <> NOT (v_product->>'is_chaarlie_recommended')::boolean) THEN RAISE EXCEPTION 'catalog enrichment product fields are invalid: %', v_key; END IF;
    IF coalesce(v_image->>'storage_bucket','') <> 'product-images' OR v_image->>'manifest_batch_id' <> 'personal-plan-launch-v1' OR coalesce(v_image->>'storage_path','') = '' OR coalesce(v_image->>'public_url','') = '' OR v_product->>'image_url' <> v_image->>'public_url' OR coalesce(v_image->>'source_page_url','') = '' OR coalesce(v_image->>'source_type','') NOT IN ('brand','retailer','marketplace','search_result','unknown') OR coalesce(v_image->>'quality_confidence','') NOT IN ('high','medium') OR coalesce(v_image->>'processing_method','') NOT IN ('local','third_party','manual') OR coalesce(v_image->>'asset_sha256','') !~ '^[a-f0-9]{64}$' OR (v_image->>'user_approved')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'catalog enrichment image fields are invalid: %', v_key; END IF;
    BEGIN
      v_brand_id := NULLIF(v_product->>'brand_id','')::uuid;
      v_line_id := NULLIF(v_product->>'product_line_id','')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'catalog enrichment identity is invalid: %', v_key;
    END;
    v_expected_brand_id := CASE
      WHEN v_key IN ('balea-two-phase-200ml','balea-ultralight-200ml','balea-professional-aha-scalp-peeling','balea-professional-sensitive-scalp-serum') THEN '58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid
      WHEN v_key='got2b-schutzengel-200ml' THEN 'a286e2c2-6b44-41f3-a37b-f57d4ed1e93c'::uuid
      WHEN v_key='jean-len-beat-the-heat-100ml' THEN 'd1a06eff-1c23-472e-908e-f5364edb1bec'::uuid
      WHEN v_key LIKE 'loreal-%' THEN '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid
      WHEN v_key LIKE 'taft-%' THEN '7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid
      WHEN v_key='eucerin-dermocapillaire-urea-intensive-tonic' THEN 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid
      WHEN v_key='gliss-scalp-balance-clarifying-serum' THEN '1c460ddf-75b8-4db6-9a33-748dfe7a5da0'::uuid
      WHEN v_key='head-shoulders-derma-x-pro-scalp-leave-in' THEN '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid
      WHEN v_key='isana-professional-aha-pha-scalp-peeling' THEN 'c3481711-82bb-436b-8ae8-654f013387c6'::uuid
      WHEN v_key='the-ordinary-multi-peptide-hair-density-serum' THEN 'c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9'::uuid
    END;
    v_expected_brand_name := CASE
      WHEN v_key LIKE 'balea-%' THEN 'Balea' WHEN v_key='got2b-schutzengel-200ml' THEN 'got2b' WHEN v_key='jean-len-beat-the-heat-100ml' THEN 'Jean&Len'
      WHEN v_key LIKE 'loreal-%' THEN 'L''Oréal Paris' WHEN v_key LIKE 'taft-%' THEN 'taft' WHEN v_key LIKE 'eucerin-%' THEN 'Eucerin'
      WHEN v_key LIKE 'gliss-%' THEN 'Gliss' WHEN v_key LIKE 'head-shoulders-%' THEN 'Head & Shoulders' WHEN v_key LIKE 'isana-%' THEN 'Isana'
      WHEN v_key LIKE 'the-ordinary-%' THEN 'The Ordinary'
    END;
    v_expected_line_id := CASE
      WHEN v_key='loreal-elvital-dream-length-defeat-the-heat-150ml' THEN '424f3e04-4a35-4b52-a23a-a33c06b996b7'::uuid
      WHEN v_key='loreal-elvital-fiber-booster-scalp-serum' THEN 'cfb409a0-c4d3-4d8f-b605-69f23e68dd1a'::uuid
      WHEN v_key='taft-aloe-boost-hydra-protect-150ml' THEN '4cfd54ce-fd3f-4d5a-a06d-ff4b74163480'::uuid
      WHEN v_key='taft-gliss-lovely-long-150ml' THEN '33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf'::uuid
      WHEN v_key='eucerin-dermocapillaire-urea-intensive-tonic' THEN 'be663588-e88c-48e2-ae10-cfd320ffd444'::uuid
      WHEN v_key='head-shoulders-derma-x-pro-scalp-leave-in' THEN 'ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8'::uuid
      WHEN v_key='gliss-scalp-balance-clarifying-serum' THEN 'f1d4f755-ed3c-4762-a15e-8b905e3d1a8b'::uuid
      WHEN v_key IN ('balea-professional-aha-scalp-peeling','balea-professional-sensitive-scalp-serum') THEN '7acc1a31-fe34-4e3a-8ee9-634a0761943c'::uuid
      WHEN v_key='isana-professional-aha-pha-scalp-peeling' THEN 'e117d1fb-1398-42da-9bcb-669b9696f6b1'::uuid
    END;
    v_expected_line_name := CASE
      WHEN v_key='loreal-elvital-dream-length-defeat-the-heat-150ml' THEN 'Elvital Dream Length'
      WHEN v_key='loreal-elvital-fiber-booster-scalp-serum' THEN 'Elvital Fiber Booster'
      WHEN v_key='taft-aloe-boost-hydra-protect-150ml' THEN 'Aloe Boost'
      WHEN v_key='taft-gliss-lovely-long-150ml' THEN 'taft x Gliss Lovely Long'
      WHEN v_key='eucerin-dermocapillaire-urea-intensive-tonic' THEN 'DermoCapillaire Urea'
      WHEN v_key='head-shoulders-derma-x-pro-scalp-leave-in' THEN 'Derma X Pro'
      WHEN v_key='gliss-scalp-balance-clarifying-serum' THEN 'Scalp Balance'
      WHEN v_key IN ('balea-professional-aha-scalp-peeling','balea-professional-sensitive-scalp-serum','isana-professional-aha-pha-scalp-peeling') THEN 'Professional'
    END;
    IF v_brand_id IS DISTINCT FROM v_expected_brand_id OR v_line_id IS DISTINCT FROM v_expected_line_id THEN RAISE EXCEPTION 'catalog enrichment identity is not approved: %', v_key; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id=v_brand_id AND canonical_name=v_expected_brand_name) OR (v_line_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_lines WHERE id=v_line_id AND brand_id=v_brand_id AND canonical_name=v_expected_line_name)) THEN RAISE EXCEPTION 'catalog enrichment identity is invalid: %', v_key; END IF;
    SELECT * INTO v_existing FROM public.catalog_enrichment_applied_items ledger WHERE ledger.batch_id = 'personal-plan-launch-v1' AND ledger.product_key = v_key;
    IF FOUND THEN
      IF v_existing.batch_fingerprint <> v_batch_fingerprint OR v_existing.content_fingerprint <> v_content_fingerprint
        OR NOT EXISTS (
          SELECT 1 FROM public.products p WHERE p.id=v_existing.product_id
            AND p.name=v_product->>'name' AND p.brand=v_product->>'brand' AND p.category=v_category
            AND p.affiliate_link=v_product->>'affiliate_link' AND p.image_url=v_product->>'image_url'
            AND p.price_eur=(v_product->>'price_eur')::numeric AND p.currency='EUR'
            AND p.is_active=true AND p.lifecycle_status='active' AND p.category_key=v_category
            AND p.brand_id=v_brand_id AND p.product_line_id IS NOT DISTINCT FROM v_line_id
            AND p.origin='curated' AND p.is_chaarlie_recommended=(v_product->>'is_chaarlie_recommended')::boolean
            AND p.purchase_link_status=v_product->>'purchase_link_status'
            AND p.purchase_link_checked_at=(v_product->>'purchase_link_checked_at')::timestamptz
            AND p.price_checked_at=(v_product->>'price_checked_at')::timestamptz
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.product_image_assets i WHERE i.product_id=v_existing.product_id
            AND i.storage_bucket=v_image->>'storage_bucket' AND i.storage_path=v_image->>'storage_path'
            AND i.public_url=v_image->>'public_url' AND i.source_page_url=v_image->>'source_page_url'
            AND i.source_image_url IS NOT DISTINCT FROM v_image->>'source_image_url'
            AND i.source_type=v_image->>'source_type' AND i.quality_confidence=v_image->>'quality_confidence'
            AND i.processing_method=v_image->>'processing_method' AND i.asset_sha256=v_image->>'asset_sha256'
            AND i.manifest_batch_id='personal-plan-launch-v1' AND i.user_approved=true
            AND i.notes IS NOT DISTINCT FROM v_image->>'notes'
        )
        OR EXISTS (
          (SELECT jsonb_build_object('type',pi.identifier_type,'value',pi.identifier_value,'source',pi.source) FROM public.product_identifiers pi WHERE pi.product_id=v_existing.product_id
           EXCEPT SELECT value FROM jsonb_array_elements(v_item->'identifiers'))
          UNION ALL
          (SELECT value FROM jsonb_array_elements(v_item->'identifiers')
           EXCEPT SELECT jsonb_build_object('type',pi.identifier_type,'value',pi.identifier_value,'source',pi.source) FROM public.product_identifiers pi WHERE pi.product_id=v_existing.product_id)
        )
        OR (v_category='heat_protectant' AND NOT EXISTS (SELECT 1 FROM public.product_heat_protectant_specs hs WHERE hs.product_id=v_existing.product_id AND (to_jsonb(hs)-'product_id'-'created_at'-'updated_at')=v_item->'heat_spec'))
        OR (v_category='scalp_care' AND NOT EXISTS (SELECT 1 FROM public.product_scalp_care_specs ss WHERE ss.product_id=v_existing.product_id AND (to_jsonb(ss)-'product_id'-'created_at'-'updated_at')=v_item->'scalp_spec'))
        OR EXISTS (
          (SELECT jsonb_strip_nulls(to_jsonb(pp)-'id'-'product_id'-'created_at'-'updated_at') FROM public.product_application_protocols pp WHERE pp.product_id=v_existing.product_id
           EXCEPT SELECT jsonb_strip_nulls(value) FROM jsonb_array_elements(v_item->'protocols'))
          UNION ALL
          (SELECT jsonb_strip_nulls(value) FROM jsonb_array_elements(v_item->'protocols')
           EXCEPT SELECT jsonb_strip_nulls(to_jsonb(pp)-'id'-'product_id'-'created_at'-'updated_at') FROM public.product_application_protocols pp WHERE pp.product_id=v_existing.product_id)
        )
      THEN RAISE EXCEPTION 'catalog enrichment conflicting or partial retry: %', v_key; END IF;
      product_key := v_key; product_id := v_existing.product_id; RETURN NEXT; CONTINUE;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:' || v_key, 0));
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.brand_id=v_brand_id AND regexp_replace(lower(coalesce(p.name,'')),'[^a-z0-9]+',' ','g')=regexp_replace(lower(v_product->>'name'),'[^a-z0-9]+',' ','g') AND p.category_key=v_category) THEN RAISE EXCEPTION 'catalog enrichment product already exists: %', v_key; END IF;
    FOR v_identifier IN SELECT value FROM jsonb_array_elements(v_item->'identifiers') LOOP
      IF v_identifier->>'type' NOT IN ('ean','gtin','barcode','retailer_sku','retailer_url','manufacturer_sku') OR coalesce(v_identifier->>'value','')='' OR coalesce(v_identifier->>'source','')='' OR EXISTS (SELECT 1 FROM public.product_identifiers pi WHERE pi.identifier_type=(v_identifier->>'type') AND pi.normalized_identifier_value=public.product_intake_review_normalize_identifier_value(v_identifier->>'type',v_identifier->>'value')) OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_batch->'products') b, jsonb_array_elements(b.value->'identifiers') other WHERE (b.value->>'product_key')<>v_key AND (other.value->>'type')=(v_identifier->>'type') AND public.product_intake_review_normalize_identifier_value(other.value->>'type',other.value->>'value')=public.product_intake_review_normalize_identifier_value(v_identifier->>'type',v_identifier->>'value')) THEN RAISE EXCEPTION 'catalog enrichment identifier collision: %', v_key; END IF;
    END LOOP;
    IF (v_category='heat_protectant' AND (jsonb_typeof(v_item->'heat_spec') <> 'object' OR v_item ? 'scalp_spec')) OR (v_category='scalp_care' AND (jsonb_typeof(v_item->'scalp_spec') <> 'object' OR v_item ? 'heat_spec')) THEN RAISE EXCEPTION 'catalog enrichment spec is invalid: %', v_key; END IF;
    FOR v_protocol IN SELECT value FROM jsonb_array_elements(v_item->'protocols') LOOP
      IF v_protocol->>'category' <> v_category OR (v_category='heat_protectant' AND v_protocol->>'role' <> 'pre_heat_protection') OR (v_category='scalp_care' AND v_protocol->>'role' NOT IN ('scalp_comfort','scalp_flake_oil_adjunct','density_claim_tonic','scalp_exfoliant')) THEN RAISE EXCEPTION 'catalog enrichment protocol is invalid: %', v_key; END IF;
    END LOOP;
    INSERT INTO public.products (name,brand,category,affiliate_link,image_url,price_eur,currency,is_active,lifecycle_status,category_key,brand_id,product_line_id,origin,is_chaarlie_recommended,purchase_link_status,purchase_link_checked_at,price_checked_at)
    VALUES (v_product->>'name',v_product->>'brand',v_product->>'category',v_product->>'affiliate_link',v_product->>'image_url',(v_product->>'price_eur')::numeric,'EUR',true,'active',v_category,v_brand_id,v_line_id,'curated',(v_product->>'is_chaarlie_recommended')::boolean,v_product->>'purchase_link_status',(v_product->>'purchase_link_checked_at')::timestamptz,(v_product->>'price_checked_at')::timestamptz) RETURNING id INTO v_id;
    INSERT INTO public.product_image_assets (product_id,storage_bucket,storage_path,public_url,source_page_url,source_image_url,source_type,quality_confidence,processing_method,asset_sha256,manifest_batch_id,user_approved,notes) VALUES (v_id,v_image->>'storage_bucket',v_image->>'storage_path',v_image->>'public_url',v_image->>'source_page_url',v_image->>'source_image_url',v_image->>'source_type',v_image->>'quality_confidence',v_image->>'processing_method',v_image->>'asset_sha256','personal-plan-launch-v1',true,v_image->>'notes');
    INSERT INTO public.product_identifiers (product_id,identifier_type,identifier_value,source) SELECT v_id,value->>'type',value->>'value',value->>'source' FROM jsonb_array_elements(v_item->'identifiers');
    IF v_category='heat_protectant' THEN INSERT INTO public.product_heat_protectant_specs(product_id,format,provides_heat_protection) VALUES(v_id,v_item->'heat_spec'->>'format',(v_item->'heat_spec'->>'provides_heat_protection')::boolean); ELSE INSERT INTO public.product_scalp_care_specs(product_id,primary_role,presentation_format,rinse_mode,application_instructions) VALUES(v_id,v_item->'scalp_spec'->>'primary_role',v_item->'scalp_spec'->>'presentation_format',v_item->'scalp_spec'->>'rinse_mode',v_item->'scalp_spec'->>'application_instructions'); END IF;
    INSERT INTO public.product_application_protocols(product_id,category,role,cadence,application_stage,application_state,placement,contact_time_seconds,rinse_action,reapplication,instruction_modifiers,source_label,source_url,source_text) SELECT v_id,value->>'category',value->>'role',value->'cadence',value->>'application_stage',value->>'application_state',value->>'placement',NULLIF(value->>'contact_time_seconds','')::integer,value->>'rinse_action',value->>'reapplication',coalesce(value->'instruction_modifiers','[]'::jsonb),value->>'source_label',value->>'source_url',value->>'source_text' FROM jsonb_array_elements(v_item->'protocols');
    INSERT INTO public.catalog_enrichment_applied_items(batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by) VALUES('personal-plan-launch-v1',v_key,v_batch_fingerprint,v_content_fingerprint,v_id,'nick'); product_key:=v_key; product_id:=v_id; RETURN NEXT;
  END LOOP;
END;
$fn$;
REVOKE ALL ON FUNCTION public.catalog_enrichment_apply_batch(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_enrichment_apply_batch(text,text,text) TO service_role;
