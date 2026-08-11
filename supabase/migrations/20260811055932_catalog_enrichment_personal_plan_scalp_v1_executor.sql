-- Approved Scalp-only catalog-enrichment executor. It depends on the merged
-- Heat executor for the shared idempotency ledger and identifier type support.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $prereq$
BEGIN
  IF to_regclass('public.catalog_enrichment_applied_items') IS NULL THEN
    RAISE EXCEPTION 'catalog enrichment Scalp prerequisite missing: Heat ledger';
  END IF;
  IF to_regprocedure('public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'catalog enrichment Scalp prerequisite missing: Heat executor';
  END IF;
  IF to_regclass('public.product_scalp_care_specs') IS NULL THEN
    RAISE EXCEPTION 'catalog enrichment Scalp prerequisite missing: product_scalp_care_specs';
  END IF;
  IF to_regclass('public.product_application_protocols') IS NULL THEN
    RAISE EXCEPTION 'catalog enrichment Scalp prerequisite missing: product_application_protocols';
  END IF;
END;
$prereq$;

DO $seeds$
DECLARE
  seed record;
  found_brand uuid;
  found_line uuid;
BEGIN
  FOR seed IN SELECT * FROM (VALUES
    ('brand', 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid, NULL::uuid, 'Eucerin', 'eucerin'),
    ('brand', '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid, NULL::uuid, 'Head & Shoulders', 'head shoulders'),
    ('brand', 'c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9'::uuid, NULL::uuid, 'The Ordinary', 'the ordinary'),
    ('line', 'be663588-e88c-48e2-ae10-cfd320ffd444'::uuid, 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid, 'DermoCapillaire Urea', 'dermocapillaire urea'),
    ('line', 'ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8'::uuid, '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid, 'Derma X Pro', 'derma x pro'),
    ('line', 'cfb409a0-c4d3-4d8f-b605-69f23e68dd1a'::uuid, '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid, 'Elvital Fiber Booster', 'elvital fiber booster')
  ) AS t(kind, id, brand_id, canonical_name, normalized_name)
  LOOP
    IF seed.kind = 'brand' THEN
      SELECT id INTO found_brand
      FROM public.brands
      WHERE normalized_name = seed.normalized_name;

      IF found_brand IS NOT NULL AND found_brand <> seed.id THEN
        RAISE EXCEPTION 'catalog enrichment Scalp seed collision: brand %', seed.canonical_name;
      END IF;

      INSERT INTO public.brands (id, canonical_name, normalized_name)
      VALUES (seed.id, seed.canonical_name, seed.normalized_name)
      ON CONFLICT (id) DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
        FROM public.brands
        WHERE id = seed.id
          AND canonical_name = seed.canonical_name
          AND normalized_name = seed.normalized_name
      ) THEN
        RAISE EXCEPTION 'catalog enrichment Scalp seed mismatch: brand %', seed.canonical_name;
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = seed.brand_id) THEN
        RAISE EXCEPTION 'catalog enrichment Scalp seed missing parent: %', seed.canonical_name;
      END IF;

      SELECT id INTO found_line
      FROM public.product_lines
      WHERE brand_id = seed.brand_id
        AND normalized_name = seed.normalized_name;

      IF found_line IS NOT NULL AND found_line <> seed.id THEN
        RAISE EXCEPTION 'catalog enrichment Scalp seed collision: line %', seed.canonical_name;
      END IF;

      INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name)
      VALUES (seed.id, seed.brand_id, seed.canonical_name, seed.normalized_name)
      ON CONFLICT (id) DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
        FROM public.product_lines
        WHERE id = seed.id
          AND brand_id = seed.brand_id
          AND canonical_name = seed.canonical_name
          AND normalized_name = seed.normalized_name
      ) THEN
        RAISE EXCEPTION 'catalog enrichment Scalp seed mismatch: line %', seed.canonical_name;
      END IF;
    END IF;
  END LOOP;
END;
$seeds$;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_personal_plan_scalp_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_by text
) RETURNS TABLE(product_key text, product_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_batch jsonb;
  v_batch_fingerprint text;
  v_item jsonb;
  v_product jsonb;
  v_image jsonb;
  v_protocol jsonb;
  v_identifier jsonb;
  v_key text;
  v_content_fingerprint text;
  v_id uuid;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_brand_id uuid;
  v_line_id uuid;
  v_expected_brand_id uuid;
  v_expected_line_id uuid;
  v_expected_brand_name text;
  v_expected_line_name text;
  v_existing_count integer;
  v_approved_batch_fingerprint constant text := 'e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50';
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'catalog enrichment Scalp reviewer must be nick';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch fingerprint must be lowercase sha256';
  END IF;

  v_batch_fingerprint := encode(extensions.digest(convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex');
  IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch fingerprint mismatch';
  END IF;
  IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch fingerprint is not approved';
  END IF;

  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch is invalid JSON';
  END;

  IF v_batch->>'schema_version' IS DISTINCT FROM 'personal-plan-catalog-enrichment-scalp-v1'
     OR v_batch->>'batch_id' IS DISTINCT FROM 'personal-plan-scalp-launch-v1'
     OR v_batch->>'cohort_index_fingerprint' IS DISTINCT FROM '8ed553db305cf715058eece4b364565b3552df2505516657c9d2cf67437aa01f' THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch header is invalid';
  END IF;

  IF jsonb_typeof(v_batch->'products') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_batch->'products') <> 8 THEN
    RAISE EXCEPTION 'catalog enrichment Scalp batch must contain exactly 8 products';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:personal-plan-scalp-launch-v1', 0));

  IF (SELECT count(DISTINCT value->>'product_key') FROM jsonb_array_elements(v_batch->'products')) <> 8
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_batch->'products') AS items(value)
       WHERE (value->>'product_key', value->>'category_key') NOT IN (
         ('balea-professional-aha-scalp-peeling', 'scalp_care'),
         ('balea-professional-sensitive-scalp-serum', 'scalp_care'),
         ('eucerin-dermocapillaire-urea-intensive-tonic', 'scalp_care'),
         ('gliss-scalp-balance-clarifying-serum', 'scalp_care'),
         ('head-shoulders-derma-x-pro-scalp-leave-in', 'scalp_care'),
         ('isana-professional-aha-pha-scalp-peeling', 'scalp_care'),
         ('loreal-elvital-fiber-booster-scalp-serum', 'scalp_care'),
         ('the-ordinary-multi-peptide-hair-density-serum', 'scalp_care')
       )
     ) THEN
    RAISE EXCEPTION 'catalog enrichment Scalp product keys or category mapping are invalid';
  END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.catalog_enrichment_applied_items applied
  WHERE applied.batch_id = 'personal-plan-scalp-launch-v1';

  IF v_existing_count NOT IN (0, 8)
     OR (
       v_existing_count = 8
       AND EXISTS (
         SELECT 1
         FROM public.catalog_enrichment_applied_items applied
         WHERE applied.batch_id = 'personal-plan-scalp-launch-v1'
           AND applied.product_key NOT IN (
             'balea-professional-aha-scalp-peeling',
             'balea-professional-sensitive-scalp-serum',
             'eucerin-dermocapillaire-urea-intensive-tonic',
             'gliss-scalp-balance-clarifying-serum',
             'head-shoulders-derma-x-pro-scalp-leave-in',
             'isana-professional-aha-pha-scalp-peeling',
             'loreal-elvital-fiber-booster-scalp-serum',
             'the-ordinary-multi-peptide-hair-density-serum'
           )
       )
     ) THEN
    RAISE EXCEPTION 'catalog enrichment Scalp partial ledger state';
  END IF;

  IF (SELECT count(*) FROM jsonb_array_elements(v_batch->'products') AS i(value) WHERE (i.value->'product'->>'is_chaarlie_recommended')::boolean) <> 8 THEN
    RAISE EXCEPTION 'catalog enrichment Scalp recommendation state must be exactly 8 recommended';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_batch->'products') ORDER BY value->>'product_key'
  LOOP
    v_key := v_item->>'product_key';
    v_product := v_item->'product';
    v_image := v_item->'image_asset';
    v_content_fingerprint := v_item->>'content_fingerprint';

    IF v_key !~ '^[a-z0-9][a-z0-9-]*$'
       OR v_content_fingerprint !~ '^[a-f0-9]{64}$'
       OR coalesce(jsonb_typeof(v_product), '') <> 'object'
       OR coalesce(jsonb_typeof(v_image), '') <> 'object'
       OR coalesce(jsonb_typeof(v_item->'identifiers'), '') <> 'array'
       OR coalesce(jsonb_array_length(v_item->'identifiers'), 0) = 0
       OR coalesce(jsonb_typeof(v_item->'scalp_spec'), '') <> 'object'
       OR v_item ? 'heat_spec'
       OR coalesce(jsonb_typeof(v_item->'protocols'), '') <> 'array'
       OR jsonb_array_length(v_item->'protocols') <> 1 THEN
      RAISE EXCEPTION 'catalog enrichment Scalp item is invalid: %', coalesce(v_key, '?');
    END IF;

    IF v_product->>'origin' IS DISTINCT FROM 'curated'
       OR (v_product->>'is_active')::boolean IS DISTINCT FROM true
       OR v_product->>'lifecycle_status' IS DISTINCT FROM 'active'
       OR v_product->>'category' IS DISTINCT FROM 'scalp_care'
       OR v_product->>'category_key' IS DISTINCT FROM 'scalp_care'
       OR v_product->>'currency' IS DISTINCT FROM 'EUR'
       OR (v_product->>'is_chaarlie_recommended')::boolean IS DISTINCT FROM true
       OR v_product->>'purchase_link_status' IS DISTINCT FROM 'available'
       OR coalesce(v_product->>'name', '') = ''
       OR coalesce(v_product->>'affiliate_link', '') = '' THEN
      RAISE EXCEPTION 'catalog enrichment Scalp product fields are invalid: %', v_key;
    END IF;

    IF coalesce(v_image->>'storage_bucket', '') <> 'product-images'
       OR v_image->>'manifest_batch_id' <> 'personal-plan-launch-v1'
       OR coalesce(v_image->>'storage_path', '') = ''
       OR coalesce(v_image->>'public_url', '') = ''
       OR v_product->>'image_url' <> v_image->>'public_url'
       OR coalesce(v_image->>'source_page_url', '') = ''
       OR coalesce(v_image->>'source_type', '') NOT IN ('brand', 'retailer', 'marketplace', 'search_result', 'unknown')
       OR coalesce(v_image->>'quality_confidence', '') NOT IN ('high', 'medium')
       OR coalesce(v_image->>'processing_method', '') NOT IN ('local', 'third_party', 'manual')
       OR coalesce(v_image->>'asset_sha256', '') !~ '^[a-f0-9]{64}$'
       OR (v_image->>'user_approved')::boolean IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'catalog enrichment Scalp image fields are invalid: %', v_key;
    END IF;

    BEGIN
      v_brand_id := NULLIF(v_product->>'brand_id', '')::uuid;
      v_line_id := NULLIF(v_product->>'product_line_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'catalog enrichment Scalp identity is invalid: %', v_key;
    END;

    v_expected_brand_id := CASE
      WHEN v_key IN ('balea-professional-aha-scalp-peeling', 'balea-professional-sensitive-scalp-serum') THEN '58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid
      WHEN v_key = 'eucerin-dermocapillaire-urea-intensive-tonic' THEN 'eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid
      WHEN v_key = 'gliss-scalp-balance-clarifying-serum' THEN '1c460ddf-75b8-4db6-9a33-748dfe7a5da0'::uuid
      WHEN v_key = 'head-shoulders-derma-x-pro-scalp-leave-in' THEN '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid
      WHEN v_key = 'isana-professional-aha-pha-scalp-peeling' THEN 'c3481711-82bb-436b-8ae8-654f013387c6'::uuid
      WHEN v_key = 'loreal-elvital-fiber-booster-scalp-serum' THEN '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid
      WHEN v_key = 'the-ordinary-multi-peptide-hair-density-serum' THEN 'c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9'::uuid
    END;
    v_expected_brand_name := CASE
      WHEN v_key LIKE 'balea-%' THEN 'Balea'
      WHEN v_key LIKE 'eucerin-%' THEN 'Eucerin'
      WHEN v_key LIKE 'gliss-%' THEN 'Gliss'
      WHEN v_key LIKE 'head-shoulders-%' THEN 'Head & Shoulders'
      WHEN v_key LIKE 'isana-%' THEN 'Isana'
      WHEN v_key LIKE 'loreal-%' THEN 'L''Oréal Paris'
      WHEN v_key LIKE 'the-ordinary-%' THEN 'The Ordinary'
    END;
    v_expected_line_id := CASE
      WHEN v_key IN ('balea-professional-aha-scalp-peeling', 'balea-professional-sensitive-scalp-serum') THEN '7acc1a31-fe34-4e3a-8ee9-634a0761943c'::uuid
      WHEN v_key = 'eucerin-dermocapillaire-urea-intensive-tonic' THEN 'be663588-e88c-48e2-ae10-cfd320ffd444'::uuid
      WHEN v_key = 'gliss-scalp-balance-clarifying-serum' THEN 'f1d4f755-ed3c-4762-a15e-8b905e3d1a8b'::uuid
      WHEN v_key = 'head-shoulders-derma-x-pro-scalp-leave-in' THEN 'ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8'::uuid
      WHEN v_key = 'isana-professional-aha-pha-scalp-peeling' THEN 'e117d1fb-1398-42da-9bcb-669b9696f6b1'::uuid
      WHEN v_key = 'loreal-elvital-fiber-booster-scalp-serum' THEN 'cfb409a0-c4d3-4d8f-b605-69f23e68dd1a'::uuid
    END;
    v_expected_line_name := CASE
      WHEN v_key IN ('balea-professional-aha-scalp-peeling', 'balea-professional-sensitive-scalp-serum', 'isana-professional-aha-pha-scalp-peeling') THEN 'Professional'
      WHEN v_key = 'eucerin-dermocapillaire-urea-intensive-tonic' THEN 'DermoCapillaire Urea'
      WHEN v_key = 'gliss-scalp-balance-clarifying-serum' THEN 'Scalp Balance'
      WHEN v_key = 'head-shoulders-derma-x-pro-scalp-leave-in' THEN 'Derma X Pro'
      WHEN v_key = 'loreal-elvital-fiber-booster-scalp-serum' THEN 'Elvital Fiber Booster'
    END;

    IF v_brand_id IS DISTINCT FROM v_expected_brand_id
       OR v_line_id IS DISTINCT FROM v_expected_line_id
       OR v_product->>'brand' IS DISTINCT FROM v_expected_brand_name
       OR NOT EXISTS (SELECT 1 FROM public.brands WHERE id = v_brand_id AND canonical_name = v_expected_brand_name)
       OR (v_line_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_lines WHERE id = v_line_id AND brand_id = v_brand_id AND canonical_name = v_expected_line_name)) THEN
      RAISE EXCEPTION 'catalog enrichment Scalp identity is not approved: %', v_key;
    END IF;

    IF v_key = 'eucerin-dermocapillaire-urea-intensive-tonic'
       AND NOT (
         EXISTS (SELECT 1 FROM jsonb_array_elements(v_item->'identifiers') AS i(value) WHERE value->>'type' = 'barcode' AND value->>'value' = 'PZN:09508065')
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_item->'identifiers') AS i(value) WHERE value->>'type' = 'manufacturer_sku' AND value->>'value' = 'NART:69658-00000-26')
       ) THEN
      RAISE EXCEPTION 'catalog enrichment Scalp Eucerin identifier contract is invalid';
    END IF;

    SELECT applied.* INTO v_existing
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = 'personal-plan-scalp-launch-v1'
      AND applied.product_key = v_key;

    IF FOUND THEN
      IF v_existing.batch_fingerprint <> v_batch_fingerprint
         OR v_existing.content_fingerprint <> v_content_fingerprint
         OR NOT EXISTS (
           SELECT 1
           FROM public.products p
           WHERE p.id = v_existing.product_id
             AND p.name = v_product->>'name'
             AND p.brand = v_product->>'brand'
             AND p.category = 'scalp_care'
             AND p.affiliate_link = v_product->>'affiliate_link'
             AND p.image_url = v_product->>'image_url'
             AND p.price_eur = (v_product->>'price_eur')::numeric
             AND p.currency = 'EUR'
             AND p.is_active = true
             AND p.lifecycle_status = 'active'
             AND p.category_key = 'scalp_care'
             AND p.brand_id = v_brand_id
             AND p.product_line_id IS NOT DISTINCT FROM v_line_id
             AND p.origin = 'curated'
             AND p.is_chaarlie_recommended = true
             AND p.purchase_link_status = 'available'
             AND p.purchase_link_checked_at = (v_product->>'purchase_link_checked_at')::timestamptz
             AND p.price_checked_at = (v_product->>'price_checked_at')::timestamptz
         )
         OR NOT EXISTS (
           SELECT 1
           FROM public.product_image_assets i
           WHERE i.product_id = v_existing.product_id
             AND i.storage_bucket = v_image->>'storage_bucket'
             AND i.storage_path = v_image->>'storage_path'
             AND i.public_url = v_image->>'public_url'
             AND i.source_page_url = v_image->>'source_page_url'
             AND i.source_image_url IS NOT DISTINCT FROM v_image->>'source_image_url'
             AND i.source_type = v_image->>'source_type'
             AND i.quality_confidence = v_image->>'quality_confidence'
             AND i.processing_method = v_image->>'processing_method'
             AND i.asset_sha256 = v_image->>'asset_sha256'
             AND i.manifest_batch_id = 'personal-plan-launch-v1'
             AND i.user_approved = true
             AND i.notes IS NOT DISTINCT FROM v_image->>'notes'
         )
         OR EXISTS (
           (SELECT jsonb_build_object('type', pi.identifier_type, 'value', pi.identifier_value, 'source', pi.source)
            FROM public.product_identifiers pi
            WHERE pi.product_id = v_existing.product_id
            EXCEPT
            SELECT value FROM jsonb_array_elements(v_item->'identifiers'))
           UNION ALL
           (SELECT value FROM jsonb_array_elements(v_item->'identifiers')
            EXCEPT
            SELECT jsonb_build_object('type', pi.identifier_type, 'value', pi.identifier_value, 'source', pi.source)
            FROM public.product_identifiers pi
            WHERE pi.product_id = v_existing.product_id)
         )
         OR NOT EXISTS (
           SELECT 1
           FROM public.product_scalp_care_specs s
           WHERE s.product_id = v_existing.product_id
             AND (to_jsonb(s) - 'product_id' - 'created_at' - 'updated_at') = v_item->'scalp_spec'
         )
         OR EXISTS (
           (SELECT jsonb_strip_nulls(to_jsonb(pp) - 'id' - 'product_id' - 'created_at' - 'updated_at')
            FROM public.product_application_protocols pp
            WHERE pp.product_id = v_existing.product_id
            EXCEPT
            SELECT jsonb_strip_nulls(value) FROM jsonb_array_elements(v_item->'protocols'))
           UNION ALL
           (SELECT jsonb_strip_nulls(value) FROM jsonb_array_elements(v_item->'protocols')
            EXCEPT
            SELECT jsonb_strip_nulls(to_jsonb(pp) - 'id' - 'product_id' - 'created_at' - 'updated_at')
            FROM public.product_application_protocols pp
            WHERE pp.product_id = v_existing.product_id)
         ) THEN
        RAISE EXCEPTION 'catalog enrichment Scalp conflicting or partial retry: %', v_key;
      END IF;

      product_key := v_key;
      product_id := v_existing.product_id;
      RETURN NEXT;
      CONTINUE;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:' || v_key, 0));

    IF EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.brand_id = v_brand_id
        AND regexp_replace(lower(coalesce(p.name, '')), '[^a-z0-9]+', ' ', 'g') = regexp_replace(lower(v_product->>'name'), '[^a-z0-9]+', ' ', 'g')
        AND p.category_key = 'scalp_care'
    ) THEN
      RAISE EXCEPTION 'catalog enrichment Scalp product already exists: %', v_key;
    END IF;

    FOR v_identifier IN SELECT value FROM jsonb_array_elements(v_item->'identifiers')
    LOOP
      IF v_identifier->>'type' NOT IN ('ean', 'gtin', 'barcode', 'retailer_sku', 'retailer_url', 'manufacturer_sku')
         OR coalesce(v_identifier->>'value', '') = ''
         OR coalesce(v_identifier->>'source', '') !~ '^[a-z0-9][a-z0-9-]*$'
         OR EXISTS (
           SELECT 1
           FROM public.product_identifiers pi
           WHERE pi.identifier_type = v_identifier->>'type'
             AND pi.normalized_identifier_value = public.product_intake_review_normalize_identifier_value(v_identifier->>'type', v_identifier->>'value')
         )
         OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(v_batch->'products') b,
                jsonb_array_elements(b.value->'identifiers') other
           WHERE b.value->>'product_key' <> v_key
             AND other.value->>'type' = v_identifier->>'type'
             AND public.product_intake_review_normalize_identifier_value(other.value->>'type', other.value->>'value') =
                 public.product_intake_review_normalize_identifier_value(v_identifier->>'type', v_identifier->>'value')
         ) THEN
        RAISE EXCEPTION 'catalog enrichment Scalp identifier collision: %', v_key;
      END IF;
    END LOOP;

    IF coalesce(v_item->'scalp_spec'->>'primary_role', '') NOT IN ('scalp_comfort', 'scalp_flake_oil_adjunct', 'density_claim_tonic', 'scalp_exfoliant')
       OR coalesce(v_item->'scalp_spec'->>'presentation_format', '') NOT IN ('serum', 'tonic', 'lotion_or_fluid', 'oil', 'scrub', 'other', 'unknown')
       OR coalesce(v_item->'scalp_spec'->>'rinse_mode', '') NOT IN ('leave_on', 'rinse_off')
       OR coalesce(v_item->'scalp_spec'->>'application_instructions', '') = '' THEN
      RAISE EXCEPTION 'catalog enrichment Scalp spec is invalid: %', v_key;
    END IF;

    FOR v_protocol IN SELECT value FROM jsonb_array_elements(v_item->'protocols')
    LOOP
      IF v_protocol->>'category' <> 'scalp_care'
         OR v_protocol->>'role' <> v_item->'scalp_spec'->>'primary_role'
         OR v_protocol->>'role' NOT IN ('scalp_comfort', 'scalp_flake_oil_adjunct', 'density_claim_tonic', 'scalp_exfoliant') THEN
        RAISE EXCEPTION 'catalog enrichment Scalp protocol is invalid: %', v_key;
      END IF;
    END LOOP;

    INSERT INTO public.products (
      name, brand, category, affiliate_link, image_url, price_eur, currency,
      is_active, lifecycle_status, category_key, brand_id, product_line_id,
      origin, is_chaarlie_recommended, purchase_link_status,
      purchase_link_checked_at, price_checked_at
    )
    VALUES (
      v_product->>'name', v_product->>'brand', 'scalp_care',
      v_product->>'affiliate_link', v_product->>'image_url',
      (v_product->>'price_eur')::numeric, 'EUR', true, 'active',
      'scalp_care', v_brand_id, v_line_id, 'curated', true, 'available',
      (v_product->>'purchase_link_checked_at')::timestamptz,
      (v_product->>'price_checked_at')::timestamptz
    )
    RETURNING id INTO v_id;

    INSERT INTO public.product_image_assets (
      product_id, storage_bucket, storage_path, public_url, source_page_url,
      source_image_url, source_type, quality_confidence, processing_method,
      asset_sha256, manifest_batch_id, user_approved, notes
    )
    VALUES (
      v_id, v_image->>'storage_bucket', v_image->>'storage_path',
      v_image->>'public_url', v_image->>'source_page_url',
      v_image->>'source_image_url', v_image->>'source_type',
      v_image->>'quality_confidence', v_image->>'processing_method',
      v_image->>'asset_sha256', 'personal-plan-launch-v1', true,
      v_image->>'notes'
    );

    INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, source)
    SELECT v_id, value->>'type', value->>'value', value->>'source'
    FROM jsonb_array_elements(v_item->'identifiers');

    INSERT INTO public.product_scalp_care_specs (
      product_id, primary_role, presentation_format, rinse_mode,
      application_instructions
    )
    VALUES (
      v_id,
      v_item->'scalp_spec'->>'primary_role',
      v_item->'scalp_spec'->>'presentation_format',
      v_item->'scalp_spec'->>'rinse_mode',
      v_item->'scalp_spec'->>'application_instructions'
    );

    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage,
      application_state, placement, contact_time_seconds, rinse_action,
      reapplication, instruction_modifiers, source_label, source_url, source_text
    )
    SELECT
      v_id,
      value->>'category',
      value->>'role',
      value->'cadence',
      value->>'application_stage',
      value->>'application_state',
      value->>'placement',
      NULLIF(value->>'contact_time_seconds', '')::integer,
      value->>'rinse_action',
      value->>'reapplication',
      coalesce(value->'instruction_modifiers', '[]'::jsonb),
      value->>'source_label',
      value->>'source_url',
      value->>'source_text'
    FROM jsonb_array_elements(v_item->'protocols');

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint,
      product_id, reviewed_by
    )
    VALUES (
      'personal-plan-scalp-launch-v1', v_key, v_batch_fingerprint,
      v_content_fingerprint, v_id, 'nick'
    );

    product_key := v_key;
    product_id := v_id;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_personal_plan_scalp_v1(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_personal_plan_scalp_v1(text, text, text) TO service_role;
