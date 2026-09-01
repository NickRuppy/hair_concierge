-- Remove only the seven superseded food/body-oil quarantines through an exact,
-- receipted, replay-safe operator path. Removing a disposition makes an active
-- curated product user-visible, so exact Oil facts plus V1/V2 protocols must be
-- complete before this function can run.
CREATE TABLE public.personal_plan_product_search_disposition_reversal_batches (
  batch_id text PRIMARY KEY CHECK (batch_id ~ '^S5R-[0-9]{2}-[a-z0-9-]+$'),
  manifest_fingerprint text NOT NULL UNIQUE CHECK (manifest_fingerprint ~ '^[a-f0-9]{64}$'),
  reviewed_head text NOT NULL CHECK (reviewed_head ~ '^[a-f0-9]{40}$'),
  reviewed_by text NOT NULL CHECK (reviewed_by = 'nick'),
  item_count integer NOT NULL CHECK (item_count = 7),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.personal_plan_product_search_disposition_reversal_items (
  batch_id text NOT NULL REFERENCES public.personal_plan_product_search_disposition_reversal_batches(batch_id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  prior_disposition text NOT NULL CHECK (prior_disposition = 'retired_from_personal_plan'),
  prior_reason_code text NOT NULL CHECK (prior_reason_code IN ('wrong_category', 'non_hair_product')),
  prior_reason text NOT NULL CHECK (pg_catalog.btrim(prior_reason) <> ''),
  prior_sources jsonb NOT NULL CHECK (
    pg_catalog.jsonb_typeof(prior_sources) = 'array'
    AND pg_catalog.jsonb_array_length(prior_sources) > 0
  ),
  prior_source_batch text NOT NULL CHECK (prior_source_batch = 'S5-21-product-search-dispositions'),
  prior_source_fingerprint text NOT NULL CHECK (
    prior_source_fingerprint = 'dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6'
  ),
  reversal_reason text NOT NULL CHECK (pg_catalog.btrim(reversal_reason) <> ''),
  reversal_sources jsonb NOT NULL CHECK (
    pg_catalog.jsonb_typeof(reversal_sources) = 'array'
    AND pg_catalog.jsonb_array_length(reversal_sources) > 0
  ),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (batch_id, product_id),
  UNIQUE (product_id)
);

ALTER TABLE public.personal_plan_product_search_disposition_reversal_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_product_search_disposition_reversal_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personal_plan_product_search_disposition_reversal_batches
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.personal_plan_product_search_disposition_reversal_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.personal_plan_product_search_disposition_reversal_batches
  TO service_role;
GRANT SELECT, INSERT ON TABLE public.personal_plan_product_search_disposition_reversal_items
  TO service_role;

CREATE OR REPLACE FUNCTION public.apply_personal_plan_product_search_disposition_reversal_v1(
  p_manifest_json text,
  p_expected_manifest_fingerprint text,
  p_reviewed_head text,
  p_reviewed_by text,
  p_execution_enabled boolean DEFAULT false
) RETURNS TABLE(product_id uuid, removed boolean, replay boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_manifest jsonb;
  v_manifest_fingerprint text;
  v_batch_id text;
  v_item jsonb;
  v_product_id uuid;
  v_expected_reason_code text;
  v_expected_source_batch constant text := 'S5-21-product-search-dispositions';
  v_expected_source_fingerprint constant text := 'dcdc396bcfdb3a12e9aab4eb62a4f0e21ab2a6ca6227e495fc62b5be40ced6a6';
  v_reversal_reason text;
  v_reversal_sources jsonb;
  v_product public.products%ROWTYPE;
  v_removed public.personal_plan_product_search_dispositions%ROWTYPE;
  v_existing_batch public.personal_plan_product_search_disposition_reversal_batches%ROWTYPE;
  v_existing_item public.personal_plan_product_search_disposition_reversal_items%ROWTYPE;
BEGIN
  IF p_execution_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'product disposition reversal execution is disabled';
  END IF;
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'product disposition reversal reviewer must be nick';
  END IF;
  IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN
    RAISE EXCEPTION 'product disposition reversal reviewed head must be a git sha';
  END IF;
  IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'product disposition reversal fingerprint must be lowercase sha256';
  END IF;

  v_manifest_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_manifest_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_manifest_fingerprint <> p_expected_manifest_fingerprint THEN
    RAISE EXCEPTION 'product disposition reversal fingerprint mismatch';
  END IF;

  BEGIN
    v_manifest := p_manifest_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'product disposition reversal manifest is invalid JSON';
  END;

  v_batch_id := v_manifest->>'batch_id';
  IF v_manifest->>'schema_version' IS DISTINCT FROM 'personal-plan-product-disposition-reversal-v1'
     OR coalesce(v_batch_id, '') !~ '^S5R-[0-9]{2}-[a-z0-9-]+$'
     OR v_manifest#>>'{review,state}' IS DISTINCT FROM 'approved_by_nick'
     OR v_manifest#>>'{review,reviewed_by}' IS DISTINCT FROM 'nick'
     OR pg_catalog.jsonb_typeof(v_manifest->'items') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_manifest->'items') <> 7 THEN
    RAISE EXCEPTION 'product disposition reversal manifest header is invalid';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_manifest->'items')) <> (
    SELECT count(DISTINCT item->>'product_id')
    FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
  ) THEN
    RAISE EXCEPTION 'product disposition reversal manifest has duplicate products';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
    WHERE item->>'product_id' NOT IN (
      '29e36443-93ff-4b62-9cf0-55ad9f89f530',
      '3eb198a5-9aab-4f28-9df1-c4869c6a12db',
      '517dca50-5d55-4038-ba1d-f9b745708327',
      '9bfe0a67-72ad-4951-bb99-9f2f5d5c724a',
      'a11855eb-64e5-438f-8880-1d3573efa9fa',
      'acf9d5cd-76e4-49c7-9c04-0af1f20506ad',
      'ca4ae209-79d2-4f4d-8e44-46e586cec62d'
    )
  ) THEN
    RAISE EXCEPTION 'product disposition reversal product is outside the approved oil cohort';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-product-disposition-reversal:' || v_batch_id, 0)
  );

  SELECT * INTO v_existing_batch
  FROM public.personal_plan_product_search_disposition_reversal_batches AS batch
  WHERE batch.batch_id = v_batch_id;

  IF FOUND THEN
    IF v_existing_batch.manifest_fingerprint IS DISTINCT FROM v_manifest_fingerprint
       OR v_existing_batch.reviewed_head IS DISTINCT FROM p_reviewed_head
       OR v_existing_batch.reviewed_by IS DISTINCT FROM 'nick'
       OR v_existing_batch.item_count <> 7 THEN
      RAISE EXCEPTION 'product disposition reversal conflicts with prior receipt';
    END IF;

    FOR v_item IN
      SELECT item
      FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
      ORDER BY item->>'product_id'
    LOOP
      v_product_id := (v_item->>'product_id')::uuid;
      SELECT * INTO v_existing_item
      FROM public.personal_plan_product_search_disposition_reversal_items AS receipt
      WHERE receipt.batch_id = v_batch_id
        AND receipt.product_id = v_product_id;
      IF NOT FOUND
         OR v_existing_item.prior_disposition IS DISTINCT FROM v_item#>>'{expected_disposition,disposition}'
         OR v_existing_item.prior_reason_code IS DISTINCT FROM v_item#>>'{expected_disposition,reason_code}'
         OR v_existing_item.prior_reason IS DISTINCT FROM v_item#>>'{expected_disposition,reason}'
         OR v_existing_item.prior_sources IS DISTINCT FROM v_item#>'{expected_disposition,sources}'
         OR v_existing_item.prior_source_batch IS DISTINCT FROM v_item#>>'{expected_disposition,source_batch}'
         OR v_existing_item.prior_source_fingerprint IS DISTINCT FROM v_item#>>'{expected_disposition,source_fingerprint}'
         OR v_existing_item.reversal_reason IS DISTINCT FROM v_item->>'reversal_reason'
         OR v_existing_item.reversal_sources IS DISTINCT FROM v_item->'sources'
         OR EXISTS (
           SELECT 1
           FROM public.personal_plan_product_search_dispositions AS disposition
           WHERE disposition.product_id = v_product_id
         ) THEN
        RAISE EXCEPTION 'product disposition reversal conflicts with prior receipt';
      END IF;
      product_id := v_product_id;
      removed := false;
      replay := true;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  INSERT INTO public.personal_plan_product_search_disposition_reversal_batches(
    batch_id,
    manifest_fingerprint,
    reviewed_head,
    reviewed_by,
    item_count
  ) VALUES (
    v_batch_id,
    v_manifest_fingerprint,
    p_reviewed_head,
    'nick',
    7
  );

  FOR v_item IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
    ORDER BY item->>'product_id'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'product disposition reversal product ID is invalid';
    END;
    v_reversal_reason := v_item->>'reversal_reason';
    v_reversal_sources := v_item->'sources';

    v_expected_reason_code := CASE v_product_id::text
      WHEN 'a11855eb-64e5-438f-8880-1d3573efa9fa' THEN 'wrong_category'
      WHEN 'ca4ae209-79d2-4f4d-8e44-46e586cec62d' THEN 'wrong_category'
      ELSE 'non_hair_product'
    END;

    IF v_item#>>'{expected_disposition,disposition}' IS DISTINCT FROM 'retired_from_personal_plan'
       OR v_item#>>'{expected_disposition,reason_code}' IS DISTINCT FROM v_expected_reason_code
       OR coalesce(pg_catalog.btrim(v_item#>>'{expected_disposition,reason}'), '') = ''
       OR pg_catalog.jsonb_typeof(v_item#>'{expected_disposition,sources}') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_item#>'{expected_disposition,sources}') < 1
       OR v_item#>>'{expected_disposition,source_batch}' IS DISTINCT FROM v_expected_source_batch
       OR v_item#>>'{expected_disposition,source_fingerprint}' IS DISTINCT FROM v_expected_source_fingerprint
       OR coalesce(pg_catalog.btrim(v_reversal_reason), '') = ''
       OR pg_catalog.jsonb_typeof(v_reversal_sources) IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_reversal_sources) < 1
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.jsonb_array_elements(v_reversal_sources) AS source(value)
         WHERE coalesce(source.value->>'label', '') = ''
           OR coalesce(source.value->>'url', '') !~ '^https://'
           OR coalesce(source.value->>'checked_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       ) THEN
      RAISE EXCEPTION 'product disposition reversal item shape is invalid: %', v_product_id;
    END IF;

    SELECT * INTO v_product
    FROM public.products AS product
    WHERE product.id = v_product_id
    FOR SHARE;
    IF NOT FOUND
       OR v_product.origin <> 'curated'
       OR NOT v_product.is_active
       OR v_product.lifecycle_status <> 'active'
       OR v_product.category_key IS DISTINCT FROM 'oil' THEN
      RAISE EXCEPTION 'product disposition reversal product is not an active curated oil: %', v_product_id;
    END IF;

    IF coalesce(pg_catalog.cardinality(v_product.suitable_thicknesses), 0) < 1
       OR NOT EXISTS (
         SELECT 1
         FROM public.product_oil_eligibility AS eligibility
         WHERE eligibility.product_id = v_product_id
           AND eligibility.thickness IS NOT NULL
           AND eligibility.oil_subtype IS NOT NULL
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.product_oil_specs AS specs
         WHERE specs.product_id = v_product_id
           AND specs.weight IS NOT NULL
           AND pg_catalog.cardinality(specs.role_support) > 0
       )
       OR EXISTS (
         SELECT 1
         FROM public.product_oil_specs AS specs,
           LATERAL pg_catalog.unnest(specs.role_support) AS required(role)
         WHERE specs.product_id = v_product_id
           AND NOT EXISTS (
             SELECT 1
             FROM public.product_application_protocols AS protocol
             WHERE protocol.product_id = v_product_id
               AND protocol.category = 'oil'
               AND protocol.role = required.role
               AND protocol.guidance_payload IS NOT NULL
               AND pg_catalog.jsonb_typeof(protocol.guidance_payload) = 'object'
               AND protocol.guidance_payload#>>'{scope,kind}' = 'product'
               AND protocol.guidance_payload#>>'{scope,productId}' = v_product_id::text
               AND protocol.guidance_payload#>>'{scope,category}' = 'oil'
               AND protocol.source_url IS NOT NULL
               AND protocol.source_text IS NOT NULL
               AND pg_catalog.btrim(protocol.source_text) <> ''
               AND EXISTS (
                 SELECT 1
                 FROM pg_catalog.jsonb_array_elements(protocol.guidance_payload->'evidence') AS evidence
                 WHERE evidence->>'sourceUrl' = protocol.source_url
               )
               AND protocol.guidance_payload_v2 IS NOT NULL
               AND pg_catalog.jsonb_typeof(protocol.guidance_payload_v2) = 'object'
               AND protocol.guidance_payload_v2->>'schemaVersion' = '2'
               AND protocol.guidance_payload_v2->>'contractKind' = 'product_pointer'
               AND protocol.guidance_payload_v2#>>'{scope,kind}' = 'product'
               AND protocol.guidance_payload_v2#>>'{scope,productId}' = v_product_id::text
               AND protocol.guidance_payload_v2#>>'{scope,category}' = 'oil'
               AND protocol.guidance_payload_v2#>'{runtimeBlockerCode}' = 'null'::jsonb
           )
       ) THEN
      RAISE EXCEPTION 'product disposition reversal publication gate would block: %', v_product_id;
    END IF;

    DELETE FROM public.personal_plan_product_search_dispositions AS disposition
    WHERE disposition.product_id = v_product_id
      AND disposition.disposition = 'retired_from_personal_plan'
      AND disposition.reason_code = v_expected_reason_code
      AND disposition.reason = v_item#>>'{expected_disposition,reason}'
      AND disposition.sources = v_item#>'{expected_disposition,sources}'
      AND disposition.source_batch = v_expected_source_batch
      AND disposition.source_fingerprint = v_expected_source_fingerprint
      AND disposition.reviewed_by = 'nick'
    RETURNING disposition.* INTO v_removed;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product disposition reversal expected quarantine drifted or is missing: %', v_product_id;
    END IF;

    INSERT INTO public.personal_plan_product_search_disposition_reversal_items(
      batch_id,
      product_id,
      prior_disposition,
      prior_reason_code,
      prior_reason,
      prior_sources,
      prior_source_batch,
      prior_source_fingerprint,
      reversal_reason,
      reversal_sources
    ) VALUES (
      v_batch_id,
      v_product_id,
      v_removed.disposition,
      v_removed.reason_code,
      v_removed.reason,
      v_removed.sources,
      v_removed.source_batch,
      v_removed.source_fingerprint,
      v_reversal_reason,
      v_reversal_sources
    );

    product_id := v_product_id;
    removed := true;
    replay := false;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)
  TO service_role;
