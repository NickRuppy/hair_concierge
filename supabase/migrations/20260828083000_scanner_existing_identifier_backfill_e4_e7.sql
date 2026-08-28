-- Extend the existing guarded executor with the exact reviewed E4-E7 cohorts.
-- Applied E1-E3 migrations and fingerprints remain unchanged.
ALTER TABLE public.scanner_identifier_backfill_batches
  DROP CONSTRAINT scanner_identifier_backfill_batches_batch_name_check;
ALTER TABLE public.scanner_identifier_backfill_batches
  ADD CONSTRAINT scanner_identifier_backfill_batches_batch_name_check
  CHECK (batch_name IN ('E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'));

CREATE OR REPLACE FUNCTION public.apply_scanner_existing_identifier_backfill_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_head text,
  p_reviewed_by text,
  p_execution_enabled boolean DEFAULT false
) RETURNS TABLE(item_key text, product_id uuid, inserted_identifier_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_batch jsonb;
  v_batch_name text;
  v_batch_id text;
  v_batch_fingerprint text;
  v_approved_fingerprint text;
  v_expected_products integer;
  v_expected_gtins integer;
  v_item jsonb;
  v_identifier jsonb;
  v_product public.products%ROWTYPE;
  v_product_id uuid;
  v_canonical text;
  v_owner uuid;
  v_inserted integer;
  v_existing_batch public.scanner_identifier_backfill_batches%ROWTYPE;
  v_existing_item public.scanner_identifier_backfill_items%ROWTYPE;
  v_ledger_count integer;
BEGIN
  IF p_execution_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'scanner identifier backfill kill switch is disabled';
  END IF;
  IF p_reviewed_by IS DISTINCT FROM 'nick' THEN
    RAISE EXCEPTION 'scanner identifier backfill reviewer must be nick';
  END IF;
  IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN
    RAISE EXCEPTION 'scanner identifier backfill reviewed head must be a 40-char sha';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'scanner identifier backfill fingerprint must be lowercase sha256';
  END IF;
  v_batch_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'scanner identifier backfill raw UTF-8 fingerprint mismatch';
  END IF;
  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'scanner identifier backfill manifest is invalid JSON';
  END;
  IF v_batch->>'schema_version' IS DISTINCT FROM 'scanner-existing-identifier-backfill-v1'
     OR v_batch->>'batch' NOT IN ('E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7')
     OR coalesce(v_batch->>'batch_id', '') !~ '^[a-z0-9][a-z0-9-]*$'
     OR pg_catalog.jsonb_typeof(v_batch->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'scanner identifier backfill manifest header is invalid';
  END IF;
  v_batch_name := v_batch->>'batch';
  v_batch_id := v_batch->>'batch_id';
  IF v_batch_name = 'E1' THEN
    v_expected_products := 20;
    v_expected_gtins := 21;
    v_approved_fingerprint := '0002bbd596cc88acff0982ef147341d87d6c39a26a4b0709efd68aa48e733522';
  ELSIF v_batch_name = 'E2' THEN
    v_expected_products := 21;
    v_expected_gtins := 22;
    v_approved_fingerprint := 'aa3c2a026c1a372e963f47d47e9c611d1b8dd8ca9edf0c334390a56443fda147';
  ELSIF v_batch_name = 'E3' THEN
    v_expected_products := 17;
    v_expected_gtins := 17;
    v_approved_fingerprint := 'ef20870b5c5ca23b001cea92ce33524c6f1f2416f5e39225237ef05eb5fc7134';
  ELSIF v_batch_name = 'E4' THEN
    v_expected_products := 20;
    v_expected_gtins := 21;
    v_approved_fingerprint := '6335df5709bde47fadb5c2740ca96866d461d6a37fe192a989c66ca0773a2436';
  ELSIF v_batch_name = 'E5' THEN
    v_expected_products := 19;
    v_expected_gtins := 20;
    v_approved_fingerprint := '8b94a3a22d1e5554d00f84c9858b16a66d73afc3f24adbf7499f43d5d4a08136';
  ELSIF v_batch_name = 'E6' THEN
    v_expected_products := 19;
    v_expected_gtins := 19;
    v_approved_fingerprint := '92def27ab25378987eb0c9e01f7d4818c886b9b63363716410658cf6cb4ae903';
  ELSE
    v_expected_products := 15;
    v_expected_gtins := 15;
    v_approved_fingerprint := 'c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e';
  END IF;
  IF v_approved_fingerprint !~ '^[a-f0-9]{64}$'
     OR v_batch_fingerprint IS DISTINCT FROM v_approved_fingerprint THEN
    RAISE EXCEPTION 'scanner identifier backfill manifest fingerprint is not approved';
  END IF;
  IF pg_catalog.jsonb_array_length(v_batch->'items') > 25 THEN
    RAISE EXCEPTION 'scanner identifier backfill transaction exceeds 25 products';
  END IF;
  IF pg_catalog.jsonb_array_length(v_batch->'items') IS DISTINCT FROM v_expected_products THEN
    RAISE EXCEPTION 'scanner identifier backfill % requires exactly % products',
      v_batch_name, v_expected_products;
  END IF;
  IF (SELECT pg_catalog.count(DISTINCT item.value->>'item_key')
      FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value)) <> v_expected_products
     OR (SELECT pg_catalog.count(DISTINCT item.value->>'product_id')
         FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value)) <> v_expected_products THEN
    RAISE EXCEPTION 'scanner identifier backfill item keys and product ids must be unique';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value)
    WHERE coalesce(item.value->>'item_key', '') !~ '^[a-z0-9][a-z0-9-]*$'
       OR coalesce(item.value->>'content_fingerprint', '') !~ '^[a-f0-9]{64}$'
       OR pg_catalog.jsonb_typeof(item.value->'expected_product') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(item.value->'identifiers') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(item.value->'identifiers') = 0
  ) THEN
    RAISE EXCEPTION 'scanner identifier backfill item contract is invalid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value),
         pg_catalog.jsonb_array_elements(item.value->'identifiers') identifier(value)
    WHERE identifier.value->>'type' NOT IN ('ean', 'gtin', 'barcode')
       OR public.product_identifier_canonical_gtin14(
            identifier.value->>'type', identifier.value->>'value'
          ) IS NULL
       OR coalesce(identifier.value->>'source_url', '') !~ '^https://'
  ) THEN
    RAISE EXCEPTION 'scanner identifier backfill identifier/checksum/source URL is invalid';
  END IF;
  IF (SELECT pg_catalog.count(DISTINCT public.product_identifier_canonical_gtin14(
               identifier.value->>'type', identifier.value->>'value'))
      FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value),
           pg_catalog.jsonb_array_elements(item.value->'identifiers') identifier(value))
     IS DISTINCT FROM v_expected_gtins THEN
    RAISE EXCEPTION 'scanner identifier backfill % requires exactly % unique canonical GTINs',
      v_batch_name, v_expected_gtins;
  END IF;

  -- Serialize the batch, then lock every product and GTIN in stable order before
  -- reading ownership or mutating any row. The unique partial index is the final arbiter.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scanner-identifier-backfill:batch:' || v_batch_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'scanner-identifier-backfill:product:' || locked_products.locked_product_id, 0
    )
  )
  FROM (
    SELECT DISTINCT item.value->>'product_id' AS locked_product_id
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value)
    ORDER BY locked_product_id
  ) locked_products;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('product-identifier:canonical-gtin14:' || canonical_gtin14, 0)
  )
  FROM (
    SELECT DISTINCT public.product_identifier_canonical_gtin14(
      identifier.value->>'type', identifier.value->>'value'
    ) AS canonical_gtin14
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value),
         pg_catalog.jsonb_array_elements(item.value->'identifiers') identifier(value)
    ORDER BY canonical_gtin14
  ) locked_gtins;

  -- Hold submission writes only for this short identifier transaction so a new
  -- unresolved scan cannot appear between overlap validation and insertion.
  -- This check also protects direct RPC callers that bypass the CLI preflight.
  LOCK TABLE public.product_submissions IN SHARE MODE;
  IF EXISTS (
    SELECT 1
    FROM public.product_submissions submission
    CROSS JOIN LATERAL (
      SELECT submission.scanned_identifier_type AS identifier_type,
             submission.scanned_identifier_value AS identifier_value
      UNION ALL
      SELECT coalesce(candidate->>'type', candidate->>'identifier_type'),
             coalesce(candidate->>'value', candidate->>'identifier_value')
      FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(submission.researched_payload #> '{final,identifiers}') = 'array'
          THEN submission.researched_payload #> '{final,identifiers}'
          ELSE '[]'::jsonb
        END
      ) candidate
    ) submitted
    WHERE submission.status NOT IN ('approved', 'matched_existing', 'rejected', 'cancelled_by_user')
      AND public.product_identifier_canonical_gtin14(
        submitted.identifier_type, submitted.identifier_value
      ) IN (
        SELECT public.product_identifier_canonical_gtin14(identifier.value->>'type', identifier.value->>'value')
        FROM pg_catalog.jsonb_array_elements(v_batch->'items') item(value),
             pg_catalog.jsonb_array_elements(item.value->'identifiers') identifier(value)
      )
  ) THEN
    RAISE EXCEPTION 'scanner identifier backfill open submission GTIN overlap requires review';
  END IF;

  SELECT applied.* INTO v_existing_batch
  FROM public.scanner_identifier_backfill_batches applied
  WHERE applied.batch_id = v_batch_id;
  SELECT pg_catalog.count(*) INTO v_ledger_count
  FROM public.scanner_identifier_backfill_items applied
  WHERE applied.batch_id = v_batch_id;
  IF v_existing_batch.batch_id IS NULL AND v_ledger_count <> 0 THEN
    RAISE EXCEPTION 'scanner identifier backfill partial ledger state';
  END IF;
  IF v_existing_batch.batch_id IS NOT NULL THEN
    IF v_existing_batch.batch_name IS DISTINCT FROM v_batch_name
       OR v_existing_batch.batch_fingerprint IS DISTINCT FROM v_batch_fingerprint
       OR v_existing_batch.reviewed_head IS DISTINCT FROM p_reviewed_head
       OR v_existing_batch.reviewed_by IS DISTINCT FROM p_reviewed_by
       OR v_existing_batch.product_count IS DISTINCT FROM v_expected_products
       OR v_existing_batch.gtin_count IS DISTINCT FROM v_expected_gtins
       OR v_ledger_count IS DISTINCT FROM v_expected_products THEN
      RAISE EXCEPTION 'scanner identifier backfill conflicting or partial replay';
    END IF;
  ELSE
    INSERT INTO public.scanner_identifier_backfill_batches (
      batch_id, batch_name, batch_fingerprint, reviewed_head, reviewed_by,
      product_count, gtin_count
    ) VALUES (
      v_batch_id, v_batch_name, v_batch_fingerprint, p_reviewed_head, p_reviewed_by,
      v_expected_products, v_expected_gtins
    );
  END IF;

  FOR v_item IN
    SELECT value FROM pg_catalog.jsonb_array_elements(v_batch->'items') ORDER BY value->>'item_key'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'scanner identifier backfill product id is invalid: %', v_item->>'item_key';
    END;
    SELECT product.* INTO v_product
    FROM public.products product
    WHERE product.id = v_product_id
    FOR SHARE;
    IF NOT FOUND
       OR v_product.name IS DISTINCT FROM v_item->'expected_product'->>'name'
       OR v_product.brand IS DISTINCT FROM v_item->'expected_product'->>'brand'
       OR v_product.category_key IS DISTINCT FROM v_item->'expected_product'->>'category_key'
       OR v_product.is_active IS DISTINCT FROM (v_item->'expected_product'->>'is_active')::boolean
       OR v_product.lifecycle_status IS DISTINCT FROM v_item->'expected_product'->>'lifecycle_status' THEN
      RAISE EXCEPTION 'scanner identifier backfill exact product identity/lifecycle drift: %',
        v_item->>'item_key';
    END IF;
    SELECT applied.* INTO v_existing_item
    FROM public.scanner_identifier_backfill_items applied
    WHERE applied.batch_id = v_batch_id AND applied.item_key = v_item->>'item_key';
    IF FOUND AND (
      v_existing_item.product_id IS DISTINCT FROM v_product_id
      OR v_existing_item.content_fingerprint IS DISTINCT FROM v_item->>'content_fingerprint'
      OR v_existing_item.identifier_count IS DISTINCT FROM pg_catalog.jsonb_array_length(v_item->'identifiers')
      OR v_existing_item.item_payload IS DISTINCT FROM v_item
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill conflicting replay: %', v_item->>'item_key';
    END IF;
    v_inserted := 0;
    FOR v_identifier IN
      SELECT value FROM pg_catalog.jsonb_array_elements(v_item->'identifiers')
      ORDER BY public.product_identifier_canonical_gtin14(value->>'type', value->>'value')
    LOOP
      v_canonical := public.product_identifier_canonical_gtin14(
        v_identifier->>'type', v_identifier->>'value'
      );
      SELECT identifier.product_id INTO v_owner
      FROM public.product_identifiers identifier
      WHERE identifier.canonical_gtin14 = v_canonical;
      IF FOUND AND v_owner IS DISTINCT FROM v_product_id THEN
        RAISE EXCEPTION 'scanner identifier backfill global owner collision for %: %',
          v_canonical, v_owner;
      ELSIF NOT FOUND THEN
        INSERT INTO public.product_identifiers (
          product_id, identifier_type, identifier_value, source
        ) VALUES (
          v_product_id, v_identifier->>'type', v_identifier->>'value',
          'scanner-catalog-coverage-2026-08-26'
        );
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;
    IF v_existing_item.item_key IS NULL THEN
      INSERT INTO public.scanner_identifier_backfill_items (
        batch_id, item_key, product_id, content_fingerprint, identifier_count, item_payload
      ) VALUES (
        v_batch_id, v_item->>'item_key', v_product_id, v_item->>'content_fingerprint',
        pg_catalog.jsonb_array_length(v_item->'identifiers'), v_item
      );
    END IF;
    item_key := v_item->>'item_key';
    product_id := v_product_id;
    inserted_identifier_count := v_inserted;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_scanner_existing_identifier_backfill_v1(
  text, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scanner_existing_identifier_backfill_v1(
  text, text, text, text, boolean
) TO service_role;
