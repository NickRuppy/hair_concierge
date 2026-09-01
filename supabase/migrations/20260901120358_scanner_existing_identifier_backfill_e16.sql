-- Extend the existing guarded executor with the exact reviewed E16 cohort.
-- Applied E1-E15 migrations and fingerprints remain unchanged.
ALTER TABLE public.scanner_identifier_backfill_batches
  DROP CONSTRAINT scanner_identifier_backfill_batches_batch_name_check;
ALTER TABLE public.scanner_identifier_backfill_batches
  ADD CONSTRAINT scanner_identifier_backfill_batches_batch_name_check
  CHECK (batch_name IN ('E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16'));

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
     OR v_batch->>'batch' NOT IN ('E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16')
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
  ELSIF v_batch_name = 'E7' THEN
    v_expected_products := 15;
    v_expected_gtins := 15;
    v_approved_fingerprint := 'c705507449cea92051853b15f1995f03d4b42b1fecdb1e439b8732d46c557e5e';
  ELSIF v_batch_name = 'E8' THEN
    v_expected_products := 20;
    v_expected_gtins := 20;
    v_approved_fingerprint := 'd0307aa4fc449a49b438dd7efe6652757cf2f54239ebfa9b5082854fc24df602';
  ELSIF v_batch_name = 'E9' THEN
    v_expected_products := 6;
    v_expected_gtins := 6;
    v_approved_fingerprint := '69730542eb6a5a51ca590954fe2efaa865c91b6f1f7ff73118c563fa21f2bfd6';
  ELSIF v_batch_name = 'E10' THEN
    v_expected_products := 12;
    v_expected_gtins := 12;
    v_approved_fingerprint := 'e9b803b9d36f7cc41a6a0972958e0f045d5c91668c8b5766c60976a84384f0e3';
  ELSIF v_batch_name = 'E11' THEN
    v_expected_products := 1;
    v_expected_gtins := 1;
    v_approved_fingerprint := 'f224db6c44e4b50dc22b15a8ed28b81922273d3127d83ad4c8e3c55711abf6ec';
  ELSIF v_batch_name = 'E12' THEN
    v_expected_products := 6;
    v_expected_gtins := 7;
    v_approved_fingerprint := '1e1c69be793d4ab00b42c3c618b4580403dde6a85c47185568b2a7ebfb76915b';
  ELSIF v_batch_name = 'E13' THEN
    v_expected_products := 5;
    v_expected_gtins := 6;
    v_approved_fingerprint := '2efe9cf73fd0294298daaad125f95cf9c387bb2fabe88ad90efade5ca1f9afe4';
  ELSIF v_batch_name = 'E14' THEN
    v_expected_products := 1;
    v_expected_gtins := 1;
    v_approved_fingerprint := 'bc6a9751dffbd28508e47d37ef9c340591e6cb233aee8eab5081e2f015a94c34';
  ELSIF v_batch_name = 'E15' THEN
    v_expected_products := 2;
    v_expected_gtins := 3;
    v_approved_fingerprint := '82841d4d5d7438f6eb029c8f542a708a3c4ee6d22c0583643f4b246c6dad1175';
  ELSIF v_batch_name = 'E16' THEN
    v_expected_products := 8;
    v_expected_gtins := 12;
    v_approved_fingerprint := 'ccead11317e181fedaad572ebf14d33b6300c7bd9c85eaae76bc8b2bef2a54c0';
  ELSE
    RAISE EXCEPTION 'scanner identifier backfill batch is not approved: %', v_batch_name;
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
    -- E11 is intentionally coupled to the bounded K18 readiness correction.
    -- A barcode must not make this package scanner-resolvable while its
    -- Personal Plan result would still be quarantined or lack a usable leave-in.
    IF v_batch_name = 'E11' AND (
      EXISTS (
        SELECT 1
        FROM public.personal_plan_product_search_dispositions disposition
        WHERE disposition.product_id = v_product_id
      )
      OR v_product.description IS DISTINCT FROM
        'K18 Hair Professional Molecular Repair Hair Mist ist ein leichtes Leave-in für Längen und Spitzen bei Proteinbedarf.'
      OR v_product.suitable_thicknesses IS DISTINCT FROM ARRAY['fine', 'normal', 'coarse']::text[]
      OR v_product.net_content_value IS DISTINCT FROM 300::numeric
      OR v_product.net_content_unit IS DISTINCT FROM 'ml'
      OR NOT EXISTS (
        SELECT 1
        FROM public.product_leave_in_specs spec
        WHERE spec.product_id = v_product_id
          AND spec.category_key = 'leave_in'
          AND spec.ingredient_flags = ARRAY['humectants', 'proteins', 'polymers']::text[]
          AND spec.care_direction = 'protein'
          AND spec.repair_support_level = 'medium'
          AND spec.plan_roles = ARRAY['post_wash_leave_in']::text[]
          AND spec.functional_benefits = ARRAY['repair_support']::text[]
          AND spec.provides_heat_protection = false
      )
      OR (SELECT pg_catalog.count(*) FROM public.product_leave_in_eligibility eligibility
          WHERE eligibility.product_id = v_product_id) <> 6
      OR EXISTS (
        SELECT 1
        FROM public.product_leave_in_eligibility eligibility
        WHERE eligibility.product_id = v_product_id
          AND (eligibility.thickness, eligibility.need_bucket, eligibility.styling_context) NOT IN (
            ('fine', 'repair', 'air_dry'),
            ('fine', 'repair', 'non_heat_style'),
            ('normal', 'repair', 'air_dry'),
            ('normal', 'repair', 'non_heat_style'),
            ('coarse', 'repair', 'air_dry'),
            ('coarse', 'repair', 'non_heat_style')
          )
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.product_application_protocols protocol
        WHERE protocol.product_id = v_product_id
          AND protocol.category = 'leave_in'
          AND protocol.category_key = 'leave_in'
          AND protocol.role = 'post_wash_leave_in'
          AND protocol.application_family = 'post_wash_damp_conditioning'
          AND protocol.contact_time_seconds = 240
          AND protocol.rinse_action = 'leave_in'
          AND protocol.guidance_payload_v2#>>'{schemaVersion}' = '2'
          AND protocol.guidance_payload_v2#>>'{contractKind}' = 'product_pointer'
          AND protocol.guidance_payload_v2#>>'{scope,productId}' = v_product_id::text
          AND protocol.guidance_payload_v2#>>'{scope,category}' = 'leave_in'
          AND protocol.guidance_payload_v2#>>'{sourceRole}' = 'post_wash_leave_in'
          AND protocol.guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
      )
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E11 K18 readiness is incomplete';
    END IF;
    -- E12 has a separately frozen strict-readiness audit. A disposition is the
    -- live safety boundary that can regress between that audit and execution.
    IF v_batch_name = 'E12' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E12 product is not scan-result-ready';
    END IF;
    -- E13 uses the same frozen strict-readiness boundary as E12.
    IF v_batch_name = 'E13' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E13 product is not scan-result-ready';
    END IF;
    -- E14 applies the same frozen strict-readiness boundary before it can make
    -- the reviewed package scanner-resolvable.
    IF v_batch_name = 'E14' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E14 product is not scan-result-ready';
    END IF;
    -- E15 applies the same frozen strict-readiness boundary before it can make
    -- the reviewed packages scanner-resolvable.
    IF v_batch_name = 'E15' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E15 product is not scan-result-ready';
    END IF;
    IF v_batch_name = 'E16' AND EXISTS (
      SELECT 1
      FROM public.personal_plan_product_search_dispositions disposition
      WHERE disposition.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'scanner identifier backfill E16 product is not scan-result-ready';
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
