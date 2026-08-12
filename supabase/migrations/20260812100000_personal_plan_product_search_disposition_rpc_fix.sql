-- Qualify the disposition lookup inside the table-returning RPC. The output
-- column named product_id otherwise conflicts with the table column in PL/pgSQL.
CREATE OR REPLACE FUNCTION public.apply_personal_plan_product_search_dispositions_v1(
  p_manifest_json text,
  p_expected_manifest_fingerprint text,
  p_reviewed_by text
) RETURNS TABLE(product_id uuid, disposition text, reason_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_manifest jsonb;
  v_manifest_fingerprint text;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_product_id uuid;
  v_expected_category text;
  v_target_category text;
  v_sources jsonb;
  v_existing public.personal_plan_product_search_dispositions%ROWTYPE;
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'product disposition reviewer must be nick';
  END IF;
  IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'product disposition fingerprint must be lowercase sha256';
  END IF;

  v_manifest_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_manifest_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_manifest_fingerprint <> p_expected_manifest_fingerprint THEN
    RAISE EXCEPTION 'product disposition fingerprint mismatch';
  END IF;

  BEGIN
    v_manifest := p_manifest_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'product disposition manifest is invalid JSON';
  END;

  IF v_manifest->>'schema_version' IS DISTINCT FROM 'personal-plan-stage5-product-dispositions-v1'
     OR coalesce(v_manifest->>'batch_id', '') !~ '^S5-[0-9]{2}-[a-z0-9-]+$'
     OR v_manifest#>>'{review,state}' IS DISTINCT FROM 'approved_by_nick'
     OR v_manifest#>>'{review,reviewed_by}' IS DISTINCT FROM 'nick'
     OR coalesce(v_manifest->>'frozen_cohort_fingerprint', '') !~ '^[a-f0-9]{64}$'
     OR pg_catalog.jsonb_typeof(v_manifest->'items') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_manifest->'items') < 1 THEN
    RAISE EXCEPTION 'product disposition manifest header is invalid';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_manifest->'items')) <> (
    SELECT count(DISTINCT item->>'product_id')
    FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
  ) THEN
    RAISE EXCEPTION 'product disposition manifest has duplicate products';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-product-dispositions:' || (v_manifest->>'batch_id'), 0)
  );

  FOR v_item IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_manifest->'items') AS entries(item)
    ORDER BY item->>'product_id'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'product disposition product ID is invalid';
    END;

    v_expected_category := v_item->>'expected_current_category';
    v_target_category := v_item->>'target_category';
    v_sources := v_item->'sources';

    IF v_item->>'disposition' NOT IN (
      'awaiting_exact_analysis',
      'retired_from_personal_plan',
      'identity_ambiguous'
    ) OR v_item->>'reason_code' NOT IN (
      'insufficient_executable_directions',
      'insufficient_finished_product_evidence',
      'wrong_category',
      'identity_ambiguous',
      'duplicate_identity',
      'non_hair_product'
    ) OR coalesce(pg_catalog.btrim(v_item->>'reason'), '') = ''
      OR v_target_category IS NULL
      OR v_expected_category IS DISTINCT FROM v_target_category
      OR pg_catalog.jsonb_typeof(v_sources) IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(v_sources) < 1 THEN
      RAISE EXCEPTION 'product disposition item shape is invalid: %', v_product_id;
    END IF;

    IF NOT (
      (v_item->>'disposition' = 'identity_ambiguous' AND v_item->>'reason_code' = 'identity_ambiguous')
      OR (
        v_item->>'disposition' = 'retired_from_personal_plan'
        AND v_item->>'reason_code' IN ('wrong_category', 'duplicate_identity', 'non_hair_product')
      )
      OR (
        v_item->>'disposition' = 'awaiting_exact_analysis'
        AND v_item->>'reason_code' IN (
          'insufficient_executable_directions',
          'insufficient_finished_product_evidence'
        )
      )
    ) THEN
      RAISE EXCEPTION 'product disposition reason pair is invalid: %', v_product_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_sources) AS source(value)
      WHERE coalesce(source.value->>'label', '') = ''
        OR coalesce(source.value->>'text', '') = ''
        OR coalesce(source.value->>'url', '') !~ '^https?://'
        OR source.value->>'source_type' NOT IN ('manufacturer', 'retailer', 'professional_authority')
        OR coalesce(source.value->>'checked_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ) THEN
      RAISE EXCEPTION 'product disposition source evidence is invalid: %', v_product_id;
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR SHARE;

    IF NOT FOUND OR v_product.origin <> 'curated' OR NOT v_product.is_active OR v_product.lifecycle_status <> 'active' THEN
      RAISE EXCEPTION 'product disposition product is not an active curated product: %', v_product_id;
    END IF;
    IF v_product.category_key IS DISTINCT FROM v_expected_category THEN
      RAISE EXCEPTION 'product disposition expected category conflict: %', v_product_id;
    END IF;

    SELECT * INTO v_existing
    FROM public.personal_plan_product_search_dispositions AS existing_disposition
    WHERE existing_disposition.product_id = v_product_id;

    IF FOUND THEN
      IF v_existing.disposition IS DISTINCT FROM v_item->>'disposition'
         OR v_existing.reason_code IS DISTINCT FROM v_item->>'reason_code'
         OR v_existing.reason IS DISTINCT FROM v_item->>'reason'
         OR v_existing.sources IS DISTINCT FROM v_sources
         OR v_existing.source_batch IS DISTINCT FROM v_manifest->>'batch_id'
         OR v_existing.source_fingerprint IS DISTINCT FROM v_manifest_fingerprint
         OR v_existing.reviewed_by IS DISTINCT FROM 'nick' THEN
        RAISE EXCEPTION 'product disposition conflicts with existing quarantine: %', v_product_id;
      END IF;
    ELSE
      INSERT INTO public.personal_plan_product_search_dispositions(
        product_id,
        disposition,
        reason_code,
        reason,
        sources,
        source_batch,
        source_fingerprint,
        reviewed_by
      ) VALUES (
        v_product_id,
        v_item->>'disposition',
        v_item->>'reason_code',
        v_item->>'reason',
        v_sources,
        v_manifest->>'batch_id',
        v_manifest_fingerprint,
        'nick'
      );
    END IF;

    product_id := v_product_id;
    disposition := v_item->>'disposition';
    reason_code := v_item->>'reason_code';
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_product_search_dispositions_v1(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_product_search_dispositions_v1(text,text,text)
  TO service_role;
