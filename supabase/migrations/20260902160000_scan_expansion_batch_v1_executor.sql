-- Scan DB Expansion — batch publication adapter (T5 of
-- plans/2026-09-01-scan-db-expansion-pilot.md).
--
-- F-02: this path owns NO direct multi-table product writer. Every new product is
-- created by the canonical transactional publication boundary
-- `public.product_intake_approve_reviewed_product(...)` (see
-- 20260811212000 / 20260813085151 / 20260826142100). This function is an ADAPTER:
-- it validates the reviewed batch, mints the operator-owned submission the
-- boundary requires, calls the boundary, then applies only the two things the
-- boundary cannot express for a curated catalog row (origin/eligibility) plus the
-- fact-evidence and ledger rows.
--
-- F-04: exactly ONE item is applied per call. The curated publication gate is a
-- set of DEFERRABLE INITIALLY DEFERRED constraint triggers that fire at COMMIT, so
-- a savepoint inside a multi-item transaction could not isolate a failing product.
-- One item per call == one transaction per product == a failing product fails alone.
--
-- R3: `is_chaarlie_recommended = true` is unreachable from this path. The boundary
-- hard-codes false on insert, this adapter re-asserts false, and the batch contract
-- rejects any item that even asks for true.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- The adapter mints one operator-owned submission per imported product so the
-- publication boundary can run unchanged. Tag it with its own source value so
-- review queues and reporting never confuse it with a real user submission.
ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_source_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_source_check
  CHECK (source IN ('onboarding', 'chat', 'personal_plan', 'scan', 'catalog_expansion'));

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_frequency_range_required_unless_scan_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_frequency_range_required_unless_scan_check CHECK (
    frequency_range IS NOT NULL OR source IN ('scan', 'catalog_expansion')
  );

-- Reviewed-head binding + immutable approved fingerprint. Rows are written by
-- migrations only; service_role can read but never insert, so a batch cannot be
-- self-approved by the runner.
CREATE TABLE IF NOT EXISTS public.scan_expansion_approved_batches (
  batch_id text PRIMARY KEY CHECK (batch_id ~ '^[a-z0-9][a-z0-9-]*$'),
  batch_fingerprint text NOT NULL CHECK (batch_fingerprint ~ '^[a-f0-9]{64}$'),
  reviewed_head text NOT NULL CHECK (reviewed_head ~ '^[a-f0-9]{40}$'),
  reviewed_by text NOT NULL CHECK (reviewed_by = 'nick'),
  item_count integer NOT NULL CHECK (item_count BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.scan_expansion_approved_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_expansion_approved_batches FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.scan_expansion_approved_batches FROM service_role;
GRANT SELECT ON TABLE public.scan_expansion_approved_batches TO service_role;

CREATE OR REPLACE FUNCTION public.scan_expansion_assert_fact_rows(
  p_product_id uuid,
  p_spec_operations jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_operation jsonb;
  v_row jsonb;
  v_table text;
  v_found boolean;
BEGIN
  FOR v_operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  LOOP
    v_table := v_operation->>'table';
    -- Whitelist: the table name reaches dynamic SQL, so it may never come from
    -- free-form batch text.
    IF v_table NOT IN (
      'product_shampoo_specs', 'product_conditioner_specs', 'product_conditioner_rerank_specs',
      'product_mask_specs', 'product_leave_in_specs', 'product_leave_in_fit_specs',
      'product_leave_in_eligibility', 'product_oil_eligibility', 'product_oil_specs',
      'product_dry_shampoo_specs', 'product_deep_cleansing_shampoo_specs',
      'product_bondbuilder_specs', 'product_heat_protectant_specs', 'product_scalp_care_specs',
      'product_application_protocols'
    ) THEN
      RAISE EXCEPTION 'scan expansion spec operation table is not allowed: %', COALESCE(v_table, '?');
    END IF;

    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_operation->'rows')
    LOOP
      EXECUTE pg_catalog.format(
        'SELECT EXISTS (SELECT 1 FROM public.%I candidate WHERE candidate.product_id = $1 AND pg_catalog.to_jsonb(candidate) @> $2)',
        v_table
      )
      INTO v_found
      USING p_product_id, (v_row - 'product_id');

      IF v_found IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'scan expansion fact readback mismatch on %: %', v_table, v_row;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.scan_expansion_assert_fact_rows(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_scan_expansion_batch_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_head text,
  p_reviewed_by text,
  p_item_key text,
  p_execution_enabled boolean DEFAULT false
) RETURNS TABLE(item_key text, product_id uuid, outcome text, identifier_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_batch jsonb;
  v_batch_id text;
  v_batch_fingerprint text;
  v_approved public.scan_expansion_approved_batches%ROWTYPE;
  v_item jsonb;
  v_item_count integer;
  v_kind text;
  v_content_fingerprint text;
  v_identifier jsonb;
  v_canonical text;
  v_owner uuid;
  v_operator uuid;
  v_submission_id uuid;
  v_category text;
  v_product_id uuid;
  v_product public.products%ROWTYPE;
  v_approval jsonb;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_ledger_key text;
  v_inserted integer := 0;
  v_expected_gtins text[];
  v_actual_gtins text[];
  v_protocol jsonb;
BEGIN
  ---------------------------------------------------------------------------
  -- Guard set (F-05)
  ---------------------------------------------------------------------------
  IF p_execution_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'scan expansion kill switch is disabled';
  END IF;
  IF p_reviewed_by IS DISTINCT FROM 'nick' THEN
    RAISE EXCEPTION 'scan expansion reviewer must be nick';
  END IF;
  IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN
    RAISE EXCEPTION 'scan expansion reviewed head must be a 40-char sha';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'scan expansion fingerprint must be lowercase sha256';
  END IF;
  IF COALESCE(p_item_key, '') !~ '^[a-z0-9][a-z0-9:-]*$' THEN
    RAISE EXCEPTION 'scan expansion item key is required and must be slug-shaped';
  END IF;

  v_batch_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'scan expansion raw UTF-8 fingerprint mismatch';
  END IF;

  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'scan expansion batch is invalid JSON';
  END;

  IF v_batch->>'schema_version' IS DISTINCT FROM 'scan-db-expansion-batch-v1'
     OR COALESCE(v_batch->>'batch_id', '') !~ '^[a-z0-9][a-z0-9-]*$'
     OR pg_catalog.jsonb_typeof(v_batch->'items') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_batch->'items') < 1 THEN
    RAISE EXCEPTION 'scan expansion batch header is invalid';
  END IF;
  v_batch_id := v_batch->>'batch_id';
  v_item_count := pg_catalog.jsonb_array_length(v_batch->'items');
  IF v_item_count > 60 THEN
    RAISE EXCEPTION 'scan expansion batch exceeds 60 items';
  END IF;

  -- Immutable approved fingerprint + reviewed-head binding.
  SELECT approved.* INTO v_approved
  FROM public.scan_expansion_approved_batches approved
  WHERE approved.batch_id = v_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan expansion batch % is not approved', v_batch_id;
  END IF;
  IF v_approved.batch_fingerprint IS DISTINCT FROM v_batch_fingerprint
     OR v_approved.reviewed_head IS DISTINCT FROM p_reviewed_head
     OR v_approved.reviewed_by IS DISTINCT FROM p_reviewed_by
     OR v_approved.item_count IS DISTINCT FROM v_item_count THEN
    RAISE EXCEPTION 'scan expansion batch % does not match its approved fingerprint/head', v_batch_id;
  END IF;

  IF (SELECT pg_catalog.count(DISTINCT entry.value->>'item_key')
      FROM pg_catalog.jsonb_array_elements(v_batch->'items') entry(value)) <> v_item_count THEN
    RAISE EXCEPTION 'scan expansion item keys must be unique';
  END IF;

  -- Batch-global identifier contract: valid GS1, and no canonical GTIN may appear
  -- twice anywhere in the batch (new products and existing-product updates alike).
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') entry(value),
         pg_catalog.jsonb_array_elements(
           COALESCE(entry.value->'identifiers', '[]'::jsonb)
         ) identifier(value)
    WHERE identifier.value->>'type' NOT IN ('ean', 'gtin', 'barcode')
       OR public.product_identifier_canonical_gtin14(
            identifier.value->>'type', identifier.value->>'value'
          ) IS NULL
       OR COALESCE(identifier.value->>'source_url', '') !~ '^https://'
  ) THEN
    RAISE EXCEPTION 'scan expansion identifier type/checksum/source URL is invalid';
  END IF;
  IF (SELECT pg_catalog.count(*)
      FROM pg_catalog.jsonb_array_elements(v_batch->'items') entry(value),
           pg_catalog.jsonb_array_elements(COALESCE(entry.value->'identifiers', '[]'::jsonb)) identifier(value))
     <> (SELECT pg_catalog.count(DISTINCT public.product_identifier_canonical_gtin14(
                  identifier.value->>'type', identifier.value->>'value'))
         FROM pg_catalog.jsonb_array_elements(v_batch->'items') entry(value),
              pg_catalog.jsonb_array_elements(COALESCE(entry.value->'identifiers', '[]'::jsonb)) identifier(value)) THEN
    RAISE EXCEPTION 'scan expansion batch contains a duplicate canonical GTIN';
  END IF;

  SELECT entry.value INTO v_item
  FROM pg_catalog.jsonb_array_elements(v_batch->'items') entry(value)
  WHERE entry.value->>'item_key' = p_item_key;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'scan expansion item % is not part of batch %', p_item_key, v_batch_id;
  END IF;

  v_kind := v_item->>'kind';
  v_content_fingerprint := v_item->>'content_fingerprint';
  IF v_kind NOT IN ('new_product', 'existing_product_update')
     OR COALESCE(v_content_fingerprint, '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'scan expansion item contract is invalid: %', p_item_key;
  END IF;
  -- The item fingerprint is not recomputed here: the raw-UTF-8 batch fingerprint
  -- already binds every byte of every item to Nick's approval. The item value is
  -- carried so the ledger can detect a conflicting replay of the same item key.

  ---------------------------------------------------------------------------
  -- Serialize: batch lock, item lock, then every canonical GTIN in stable order.
  ---------------------------------------------------------------------------
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scan-expansion:batch:' || v_batch_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scan-expansion:item:' || v_batch_id || ':' || p_item_key, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('product-identifier:canonical-gtin14:' || locked.canonical_gtin14, 0)
  )
  FROM (
    SELECT DISTINCT public.product_identifier_canonical_gtin14(
      identifier.value->>'type', identifier.value->>'value'
    ) AS canonical_gtin14
    FROM pg_catalog.jsonb_array_elements(COALESCE(v_item->'identifiers', '[]'::jsonb)) identifier(value)
    ORDER BY canonical_gtin14
  ) locked;

  -- Hold submission writes for this short transaction so a new unresolved scan
  -- cannot appear between overlap validation and insertion. This also protects
  -- direct RPC callers that bypass the CLI preflight.
  LOCK TABLE public.product_submissions IN SHARE MODE;
  IF EXISTS (
    SELECT 1
    FROM public.product_submissions submission
    CROSS JOIN LATERAL (
      SELECT submission.scanned_identifier_type AS identifier_type,
             submission.scanned_identifier_value AS identifier_value
      UNION ALL
      SELECT COALESCE(candidate->>'type', candidate->>'identifier_type'),
             COALESCE(candidate->>'value', candidate->>'identifier_value')
      FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(submission.researched_payload #> '{final,identifiers}') = 'array'
          THEN submission.researched_payload #> '{final,identifiers}'
          ELSE '[]'::jsonb
        END
      ) candidate(value)
    ) submitted
    WHERE submission.status NOT IN ('approved', 'matched_existing', 'rejected', 'cancelled_by_user')
      AND public.product_identifier_canonical_gtin14(
            submitted.identifier_type, submitted.identifier_value
          ) IN (
            SELECT public.product_identifier_canonical_gtin14(
              identifier.value->>'type', identifier.value->>'value'
            )
            FROM pg_catalog.jsonb_array_elements(COALESCE(v_item->'identifiers', '[]'::jsonb)) identifier(value)
          )
  ) THEN
    RAISE EXCEPTION 'scan expansion open submission GTIN overlap requires review: %', p_item_key;
  END IF;

  v_ledger_key := 'scan-expansion:' || p_item_key;
  SELECT applied.* INTO v_existing
  FROM public.catalog_enrichment_applied_items applied
  WHERE applied.batch_id = v_batch_id AND applied.product_key = v_ledger_key;

  IF FOUND THEN
    IF v_existing.batch_fingerprint IS DISTINCT FROM v_batch_fingerprint
       OR v_existing.content_fingerprint IS DISTINCT FROM v_content_fingerprint
       OR v_existing.reviewed_by IS DISTINCT FROM 'nick' THEN
      RAISE EXCEPTION 'scan expansion conflicting replay ledger: %', p_item_key;
    END IF;
    v_product_id := v_existing.product_id;
    PERFORM public.scan_expansion_assert_applied_bundle(v_item, v_product_id);
    item_key := p_item_key;
    product_id := v_product_id;
    outcome := 'replayed';
    identifier_count := pg_catalog.jsonb_array_length(COALESCE(v_item->'identifiers', '[]'::jsonb));
    RETURN NEXT;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- Existing-product updates (F-09 identity rule: same formulation, new EAN/size)
  ---------------------------------------------------------------------------
  IF v_kind = 'existing_product_update' THEN
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'scan expansion existing product id is invalid: %', p_item_key;
    END;
    SELECT product.* INTO v_product FROM public.products product
    WHERE product.id = v_product_id FOR UPDATE;
    IF NOT FOUND
       OR v_product.name IS DISTINCT FROM v_item->'expected_product'->>'name'
       OR v_product.brand IS DISTINCT FROM v_item->'expected_product'->>'brand'
       OR v_product.category_key IS DISTINCT FROM v_item->'expected_product'->>'category_key'
       OR v_product.is_active IS DISTINCT FROM (v_item->'expected_product'->>'is_active')::boolean
       OR v_product.lifecycle_status IS DISTINCT FROM v_item->'expected_product'->>'lifecycle_status' THEN
      RAISE EXCEPTION 'scan expansion existing product identity/lifecycle drift: %', p_item_key;
    END IF;

    IF pg_catalog.jsonb_typeof(v_item->'rename') = 'object' THEN
      IF v_item->'rename'->>'from' IS DISTINCT FROM v_product.name
         OR COALESCE(pg_catalog.btrim(v_item->'rename'->>'to'), '') = ''
         OR COALESCE(pg_catalog.btrim(v_item->'rename'->>'reason'), '') = '' THEN
        RAISE EXCEPTION 'scan expansion rename precondition failed: %', p_item_key;
      END IF;
      UPDATE public.products
      SET name = v_item->'rename'->>'to', updated_at = pg_catalog.now()
      WHERE id = v_product_id;
    END IF;

    FOR v_identifier IN
      SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(v_item->'identifiers', '[]'::jsonb))
      ORDER BY public.product_identifier_canonical_gtin14(value->>'type', value->>'value')
    LOOP
      v_canonical := public.product_identifier_canonical_gtin14(
        v_identifier->>'type', v_identifier->>'value'
      );
      SELECT identifier.product_id INTO v_owner
      FROM public.product_identifiers identifier
      WHERE identifier.canonical_gtin14 = v_canonical;
      IF FOUND AND v_owner IS DISTINCT FROM v_product_id THEN
        RAISE EXCEPTION 'scan expansion global owner collision for %: %', v_canonical, v_owner;
      ELSIF NOT FOUND THEN
        PERFORM public.product_identifier_assert_canonical_owner_available(
          v_identifier->>'type', v_identifier->>'value', v_product_id
        );
        INSERT INTO public.product_identifiers (
          product_id, identifier_type, identifier_value, source
        ) VALUES (
          v_product_id, v_identifier->>'type', v_identifier->>'value',
          'scan-db-expansion:' || v_batch_id
        );
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;

    -- R3 post-condition: an update path may never change promotion state.
    SELECT product.* INTO v_product FROM public.products product WHERE product.id = v_product_id;
    IF v_product.is_chaarlie_recommended IS DISTINCT FROM (
         SELECT (v_item->'expected_product'->>'is_chaarlie_recommended')::boolean
       ) THEN
      RAISE EXCEPTION 'scan expansion must not change promotion state: %', p_item_key;
    END IF;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch_id, v_ledger_key, v_batch_fingerprint, v_content_fingerprint, v_product_id, 'nick'
    );

    item_key := p_item_key;
    product_id := v_product_id;
    outcome := 'applied';
    identifier_count := v_inserted;
    RETURN NEXT;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- New product: adapter over the publication boundary (F-02)
  ---------------------------------------------------------------------------
  v_category := v_item->>'category_key';
  IF pg_catalog.jsonb_typeof(v_item->'final_payload') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(v_item->'spec_operations') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_typeof(v_item->'evidence') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_item->'evidence') < 1
     OR pg_catalog.jsonb_typeof(v_item->'identifiers') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_item->'identifiers') < 1
     OR v_item#>>'{final_payload,product,category_key}' IS DISTINCT FROM v_category
     -- T4b: only a finalized own-bucket packshot may be published (R5).
     OR COALESCE(v_item#>>'{final_payload,product,image_url}', '')
        !~ '^https://pqdkhefxsxkyeqelqegq\.supabase\.co/storage/v1/object/public/product-images/.+'
     OR pg_catalog.jsonb_typeof(v_item#>'{product_updates,suitable_thicknesses}') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_item#>'{product_updates,suitable_thicknesses}') < 1 THEN
    RAISE EXCEPTION 'scan expansion new-product item contract is invalid: %', p_item_key;
  END IF;

  -- R3 at the contract edge: the batch may not even ask for a recommendation.
  IF (v_item#>'{product_updates,is_chaarlie_recommended}') IS NOT NULL
     OR (
       (v_item#>>'{final_payload,product,is_chaarlie_recommended}') IS NOT NULL
       AND (v_item#>>'{final_payload,product,is_chaarlie_recommended}') <> 'false'
     ) THEN
    RAISE EXCEPTION 'scan expansion may never request a recommendation flag: %', p_item_key;
  END IF;

  -- Every batch protocol must be scoped to the approval placeholder; the boundary
  -- re-checks this, we fail early with a batch-local message.
  FOR v_protocol IN
    SELECT protocol.value
    FROM pg_catalog.jsonb_array_elements(v_item->'spec_operations') operation(value),
         pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
    WHERE operation.value->>'table' = 'product_application_protocols'
  LOOP
    IF v_protocol#>>'{guidance_payload,scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
       OR v_protocol#>>'{guidance_payload_v2,scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
       OR COALESCE(pg_catalog.btrim(v_protocol->>'source_text'), '') = ''
       OR COALESCE(v_protocol->>'source_url', '') !~ '^https?://' THEN
      RAISE EXCEPTION 'scan expansion protocol scope/source is invalid: %', p_item_key;
    END IF;
  END LOOP;

  BEGIN
    v_operator := (v_batch->>'operator_profile_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'scan expansion operator profile id is invalid';
  END;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_operator) THEN
    RAISE EXCEPTION 'scan expansion operator profile does not exist';
  END IF;

  -- Canonical-owner validation before the boundary runs, so a colliding GTIN
  -- never reaches product creation.
  FOR v_identifier IN
    SELECT value FROM pg_catalog.jsonb_array_elements(v_item->'identifiers')
    ORDER BY public.product_identifier_canonical_gtin14(value->>'type', value->>'value')
  LOOP
    PERFORM public.product_identifier_assert_canonical_owner_available(
      v_identifier->>'type', v_identifier->>'value', NULL
    );
  END LOOP;

  INSERT INTO public.product_submissions (
    user_id, source, intake_method, category, brand_text, product_name_text,
    frequency_range, status, researched_payload
  ) VALUES (
    v_operator, 'catalog_expansion', 'manual', v_category,
    v_item#>>'{final_payload,product,canonical_brand}',
    v_item#>>'{final_payload,product,clean_name}',
    NULL, 'ready_for_review', '{}'::jsonb
  )
  RETURNING id INTO v_submission_id;

  -- THE publication boundary. No direct INSERT INTO public.products exists on
  -- this path (F-02); products, identifiers, category facts and V1/V2 protocols
  -- are all created by the canonical approval RPC.
  v_approval := public.product_intake_approve_reviewed_product(
    v_submission_id,
    v_item->'final_payload',
    v_item->'spec_operations',
    'nick',
    pg_catalog.now(),
    'scan-db-expansion:' || v_batch_id || ':' || p_item_key
  );
  v_product_id := (v_approval->>'product_id')::uuid;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'scan expansion publication boundary returned no product: %', p_item_key;
  END IF;

  -- The boundary creates owner-scoped `user_submitted` rows. A scan catalog row
  -- is a curated, recommendable-grade row with the recommendation flag OFF (R3);
  -- flipping origin here is what arms the deferred curated-publication gate for
  -- this transaction. `is_chaarlie_recommended` is written as an explicit false.
  UPDATE public.products
  SET origin = 'curated',
      is_chaarlie_recommended = false,
      suitable_thicknesses = ARRAY(
        SELECT pg_catalog.jsonb_array_elements_text(v_item#>'{product_updates,suitable_thicknesses}')
      ),
      suitable_concerns = ARRAY(
        SELECT pg_catalog.jsonb_array_elements_text(
          COALESCE(v_item#>'{product_updates,suitable_concerns}', '[]'::jsonb)
        )
      ),
      description = COALESCE(
        NULLIF(v_item#>>'{product_updates,description}', ''), description
      ),
      updated_at = pg_catalog.now()
  WHERE id = v_product_id;

  INSERT INTO public.personal_plan_catalog_fact_evidence (
    product_id, fact_key, fact_value, source_label, source_url, source_text,
    source_type, checked_at, batch_id, batch_fingerprint, content_fingerprint
  )
  SELECT
    v_product_id,
    evidence.value->>'fact_key',
    evidence.value->'fact_value',
    evidence.value->>'source_label',
    evidence.value->>'source_url',
    evidence.value->>'source_text',
    evidence.value->>'source_type',
    (evidence.value->>'checked_at')::date,
    v_batch_id,
    v_batch_fingerprint,
    v_content_fingerprint
  FROM pg_catalog.jsonb_array_elements(v_item->'evidence') evidence(value);

  -- R3 post-condition: no path above may have produced a recommended product.
  SELECT product.* INTO v_product FROM public.products product WHERE product.id = v_product_id;
  IF v_product.is_chaarlie_recommended IS DISTINCT FROM false
     OR v_product.origin IS DISTINCT FROM 'curated' THEN
    RAISE EXCEPTION 'scan expansion published an unexpected recommendation/origin state: %', p_item_key;
  END IF;

  -- Identifier set must be exactly the reviewed set (the boundary may also fold in
  -- a scanned identifier; a synthetic submission never carries one).
  SELECT ARRAY(
    SELECT DISTINCT public.product_identifier_canonical_gtin14(
      identifier.value->>'type', identifier.value->>'value'
    )
    FROM pg_catalog.jsonb_array_elements(v_item->'identifiers') identifier(value)
    ORDER BY 1
  ) INTO v_expected_gtins;
  SELECT ARRAY(
    SELECT DISTINCT identifier.canonical_gtin14
    FROM public.product_identifiers identifier
    WHERE identifier.product_id = v_product_id AND identifier.canonical_gtin14 IS NOT NULL
    ORDER BY 1
  ) INTO v_actual_gtins;
  IF v_expected_gtins IS DISTINCT FROM v_actual_gtins THEN
    RAISE EXCEPTION 'scan expansion identifier set drift: %', p_item_key;
  END IF;

  INSERT INTO public.catalog_enrichment_applied_items (
    batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
  ) VALUES (
    v_batch_id, v_ledger_key, v_batch_fingerprint, v_content_fingerprint, v_product_id, 'nick'
  );

  -- Prove the freshly written bundle reads back exactly as reviewed (F-07). The
  -- same assertion is what a replay compares against.
  PERFORM public.scan_expansion_assert_applied_bundle(v_item, v_product_id);

  item_key := p_item_key;
  product_id := v_product_id;
  outcome := 'applied';
  identifier_count := pg_catalog.jsonb_array_length(v_item->'identifiers');
  RETURN NEXT;
END;
$function$;

-- Full-bundle readback (F-07): identifiers, category facts, V1/V2 protocols,
-- fact evidence, lifecycle and recommendation flag.
CREATE OR REPLACE FUNCTION public.scan_expansion_assert_applied_bundle(
  p_item jsonb,
  p_product_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_expected_gtins text[];
  v_actual_gtins text[];
  v_protocol jsonb;
  v_expected_roles text[];
  v_actual_roles text[];
BEGIN
  SELECT product.* INTO v_product FROM public.products product WHERE product.id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan expansion readback: product % is gone', p_product_id;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT public.product_identifier_canonical_gtin14(
      identifier.value->>'type', identifier.value->>'value'
    )
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_item->'identifiers', '[]'::jsonb)) identifier(value)
    ORDER BY 1
  ) INTO v_expected_gtins;

  IF p_item->>'kind' = 'existing_product_update' THEN
    IF v_product.name IS DISTINCT FROM COALESCE(
         p_item->'rename'->>'to', p_item->'expected_product'->>'name'
       )
       OR v_product.is_chaarlie_recommended IS DISTINCT FROM
          (p_item->'expected_product'->>'is_chaarlie_recommended')::boolean
       OR v_product.lifecycle_status IS DISTINCT FROM p_item->'expected_product'->>'lifecycle_status' THEN
      RAISE EXCEPTION 'scan expansion readback: existing-product state drift on %', p_product_id;
    END IF;
    IF EXISTS (
      SELECT pg_catalog.unnest(v_expected_gtins)
      EXCEPT
      SELECT identifier.canonical_gtin14 FROM public.product_identifiers identifier
      WHERE identifier.product_id = p_product_id
    ) THEN
      RAISE EXCEPTION 'scan expansion readback: missing identifier on %', p_product_id;
    END IF;
    RETURN;
  END IF;

  IF v_product.origin IS DISTINCT FROM 'curated'
     OR v_product.is_active IS DISTINCT FROM true
     OR v_product.lifecycle_status IS DISTINCT FROM 'active'
     OR v_product.is_chaarlie_recommended IS DISTINCT FROM false
     OR v_product.category_key IS DISTINCT FROM p_item->>'category_key'
     OR v_product.image_url IS DISTINCT FROM p_item#>>'{final_payload,product,image_url}'
     OR v_product.suitable_thicknesses IS DISTINCT FROM ARRAY(
          SELECT pg_catalog.jsonb_array_elements_text(p_item#>'{product_updates,suitable_thicknesses}')
        ) THEN
    RAISE EXCEPTION 'scan expansion readback: product lifecycle/presentation drift on %', p_product_id;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT identifier.canonical_gtin14
    FROM public.product_identifiers identifier
    WHERE identifier.product_id = p_product_id AND identifier.canonical_gtin14 IS NOT NULL
    ORDER BY 1
  ) INTO v_actual_gtins;
  IF v_expected_gtins IS DISTINCT FROM v_actual_gtins THEN
    RAISE EXCEPTION 'scan expansion readback: identifier set drift on %', p_product_id;
  END IF;

  PERFORM public.scan_expansion_assert_fact_rows(
    p_product_id,
    (SELECT COALESCE(pg_catalog.jsonb_agg(operation.value), '[]'::jsonb)
     FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value)
     WHERE operation.value->>'table' <> 'product_application_protocols')
  );

  SELECT ARRAY(
    SELECT DISTINCT protocol.value->>'role'
    FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value),
         pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
    WHERE operation.value->>'table' = 'product_application_protocols'
    ORDER BY 1
  ) INTO v_expected_roles;
  SELECT ARRAY(
    SELECT DISTINCT stored.role FROM public.product_application_protocols stored
    WHERE stored.product_id = p_product_id ORDER BY 1
  ) INTO v_actual_roles;
  IF v_expected_roles IS DISTINCT FROM v_actual_roles THEN
    RAISE EXCEPTION 'scan expansion readback: protocol role set drift on %', p_product_id;
  END IF;

  FOR v_protocol IN
    SELECT protocol.value
    FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value),
         pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
    WHERE operation.value->>'table' = 'product_application_protocols'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_application_protocols stored
      WHERE stored.product_id = p_product_id
        AND stored.category = v_protocol->>'category'
        AND stored.role = v_protocol->>'role'
        AND stored.source_label IS NOT DISTINCT FROM v_protocol->>'source_label'
        AND stored.source_url IS NOT DISTINCT FROM v_protocol->>'source_url'
        AND stored.source_text IS NOT DISTINCT FROM v_protocol->>'source_text'
        AND stored.contact_time_seconds IS NOT DISTINCT FROM
            NULLIF(v_protocol->>'contact_time_seconds', '')::integer
        AND stored.rinse_action IS NOT DISTINCT FROM v_protocol->>'rinse_action'
        AND stored.guidance_payload = pg_catalog.jsonb_set(
              v_protocol->'guidance_payload', '{scope,productId}',
              pg_catalog.to_jsonb(p_product_id::text), false
            )
        AND stored.guidance_payload_v2 = pg_catalog.jsonb_set(
              v_protocol->'guidance_payload_v2', '{scope,productId}',
              pg_catalog.to_jsonb(p_product_id::text), false
            )
    ) THEN
      RAISE EXCEPTION 'scan expansion readback: protocol drift on %:%',
        p_product_id, v_protocol->>'role';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_item->'evidence') evidence(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence stored
      WHERE stored.product_id = p_product_id
        AND stored.fact_key = evidence.value->>'fact_key'
        AND stored.source_url = evidence.value->>'source_url'
        AND stored.fact_value = evidence.value->'fact_value'
        AND stored.source_label = evidence.value->>'source_label'
        AND stored.source_text = evidence.value->>'source_text'
        AND stored.source_type = evidence.value->>'source_type'
        AND stored.checked_at = (evidence.value->>'checked_at')::date
    )
  ) THEN
    RAISE EXCEPTION 'scan expansion readback: fact evidence drift on %', p_product_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.scan_expansion_assert_applied_bundle(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_scan_expansion_batch_v1(text, text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_scan_expansion_batch_v1(text, text, text, text, text, boolean)
  TO service_role;
