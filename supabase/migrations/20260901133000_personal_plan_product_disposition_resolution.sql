-- Repin the existing Stage 5 V2 executor to the reviewed post-baseline product
-- protocol amendment. The executor implementation and permissions stay intact.
DO $repin_stage5_v2_executor$
DECLARE
  v_definition text;
  v_installed text;
  v_old_batch_clause constant text := 'v_batch_id constant text := ''personal-plan-stage5-v2-2026-08-14-use-case-coverage'';';
  v_new_batch_clause constant text := 'v_batch_id constant text := ''personal-plan-stage5-v2-2026-09-01-protocol-amendment'';';
  v_old_source_clause constant text := 'v_artifact->>''source_kind'' IS DISTINCT FROM ''reviewed_stage5_v1_and_use_case_artifacts''';
  v_new_source_clause constant text := 'v_artifact->>''source_kind'' IS DISTINCT FROM ''reviewed_stage5_v1_use_case_and_amendment_artifacts''';
  v_old_snapshot_clause constant text := 'coalesce(v_artifact->>''snapshot_date'', '''') !~ ''^2026-08-14$''';
  v_new_snapshot_clause constant text := 'coalesce(v_artifact->>''snapshot_date'', '''') !~ ''^2026-09-01$''';
  v_occurrences integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_definition;

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_batch_clause, ''))) / pg_catalog.length(v_old_batch_clause);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one prior Stage 5 V2 batch clause, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_batch_clause, v_new_batch_clause);

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_source_clause, ''))) / pg_catalog.length(v_old_source_clause);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one prior Stage 5 V2 source-kind clause, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_source_clause, v_new_source_clause);

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_snapshot_clause, ''))) / pg_catalog.length(v_old_snapshot_clause);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one prior Stage 5 V2 snapshot clause, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_snapshot_clause, v_new_snapshot_clause);
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_installed;
  IF pg_catalog.strpos(v_installed, v_new_batch_clause) = 0
     OR pg_catalog.strpos(v_installed, v_new_source_clause) = 0
     OR pg_catalog.strpos(v_installed, v_new_snapshot_clause) = 0
     OR pg_catalog.strpos(v_installed, v_old_batch_clause) <> 0
     OR pg_catalog.strpos(v_installed, v_old_source_clause) <> 0
     OR pg_catalog.strpos(v_installed, v_old_snapshot_clause) <> 0 THEN
    RAISE EXCEPTION 'installed Stage 5 V2 amendment identity verification failed';
  END IF;
END;
$repin_stage5_v2_executor$;

-- Resolve only a reviewed disposition whose complete V1 and V2 authority is
-- already present. Protocol application remains owned by the existing Stage 5
-- executors, so this function cannot expose a partially prepared product.
CREATE OR REPLACE FUNCTION public.apply_personal_plan_product_disposition_resolutions_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_by text
)
RETURNS TABLE(product_id uuid, resolution text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_batch jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_batch_fingerprint text;
  v_product_key text;
  v_existing_protocol public.product_application_protocols%ROWTYPE;
  v_existing_disposition public.personal_plan_product_search_dispositions%ROWTYPE;
  v_existing_ledger public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'product disposition resolution reviewer must be nick';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'product disposition resolution fingerprint must be lowercase sha256';
  END IF;
  v_batch_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'product disposition resolution fingerprint mismatch';
  END IF;
  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'product disposition resolution batch is invalid JSON';
  END;
  IF v_batch->>'schema_version' IS DISTINCT FROM 'personal-plan-stage5-product-disposition-resolutions-v1'
     OR coalesce(v_batch->>'batch_id', '') !~ '^S5-[0-9]{2}-[a-z0-9-]+$'
     OR pg_catalog.jsonb_typeof(v_batch->'items') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_batch->'items') < 1 THEN
    RAISE EXCEPTION 'product disposition resolution batch header is invalid';
  END IF;
  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') entries(item)
  ) <> (
    SELECT pg_catalog.count(DISTINCT item->>'product_id')
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') entries(item)
  ) THEN
    RAISE EXCEPTION 'product disposition resolution batch contains duplicate products';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-disposition-resolution:' || (v_batch->>'batch_id'), 0)
  );

  FOR v_item IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_batch->'items') entries(item)
    ORDER BY item->>'product_id'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'product disposition resolution product ID is invalid';
    END;
    v_product_key := 'disposition-resolution:' || v_product_id::text;

    IF coalesce(v_item->>'category_key', '') = ''
       OR coalesce(v_item->>'role', '') = ''
       OR coalesce(v_item->>'application_family', '') = ''
       OR coalesce(v_item->>'expected_source_url', '') !~ '^https?://'
       OR coalesce(v_item->>'content_fingerprint', '') !~ '^[a-f0-9]{64}$'
       OR pg_catalog.jsonb_typeof(v_item->'expected_guidance_payload') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_item->'expected_guidance_payload_v2') IS DISTINCT FROM 'object'
       OR v_item#>>'{expected_guidance_payload,scope,kind}' IS DISTINCT FROM 'product'
       OR v_item#>>'{expected_guidance_payload,scope,productId}' IS DISTINCT FROM v_product_id::text
       OR v_item#>>'{expected_guidance_payload,scope,category}' IS DISTINCT FROM v_item->>'category_key'
       OR v_item#>>'{expected_guidance_payload_v2,scope,kind}' IS DISTINCT FROM 'product'
       OR v_item#>>'{expected_guidance_payload_v2,scope,productId}' IS DISTINCT FROM v_product_id::text
       OR v_item#>>'{expected_guidance_payload_v2,scope,category}' IS DISTINCT FROM v_item->>'category_key'
       OR v_item#>>'{expected_guidance_payload_v2,sourceRole}' IS DISTINCT FROM v_item->>'role'
       OR v_item#>>'{expected_guidance_payload_v2,applicationFamily}' IS DISTINCT FROM v_item->>'application_family'
       OR v_item#>'{expected_guidance_payload_v2,runtimeBlockerCode}' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'product disposition resolution protocol payload is invalid: %', v_product_id;
    END IF;
    PERFORM 1
    FROM public.products product
    WHERE product.id = v_product_id
      AND product.category_key = v_item->>'category_key'
      AND product.origin = 'curated'
      AND product.is_active = true
      AND product.lifecycle_status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product disposition resolution product state diverged: %', v_product_id;
    END IF;

    SELECT protocol.* INTO v_existing_protocol
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_product_id
      AND protocol.category = v_item->>'category_key'
      AND protocol.role = v_item->>'role'
      AND protocol.application_family = v_item->>'application_family'
    FOR SHARE;
    IF NOT FOUND
       OR v_existing_protocol.source_url IS DISTINCT FROM v_item->>'expected_source_url'
       OR v_existing_protocol.guidance_payload IS DISTINCT FROM v_item->'expected_guidance_payload'
       OR v_existing_protocol.guidance_payload_v2 IS DISTINCT FROM v_item->'expected_guidance_payload_v2' THEN
      RAISE EXCEPTION 'product disposition resolution requires complete exact V1/V2 authority: %', v_product_id;
    END IF;

    SELECT applied.* INTO v_existing_ledger
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch->>'batch_id'
      AND applied.product_key = v_product_key;
    SELECT disposition.* INTO v_existing_disposition
    FROM public.personal_plan_product_search_dispositions disposition
    WHERE disposition.product_id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      IF v_existing_ledger.batch_fingerprint IS DISTINCT FROM v_batch_fingerprint
         OR v_existing_ledger.content_fingerprint IS DISTINCT FROM v_item->>'content_fingerprint'
         OR v_existing_ledger.product_id IS DISTINCT FROM v_product_id
         OR v_existing_ledger.reviewed_by IS DISTINCT FROM 'nick' THEN
        RAISE EXCEPTION 'product disposition resolution is missing without an exact receipt: %', v_product_id;
      END IF;
      product_id := v_product_id;
      resolution := 'already_resolved';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_existing_ledger.batch_id IS NOT NULL THEN
      RAISE EXCEPTION 'product disposition resolution receipt conflicts with live quarantine: %', v_product_id;
    END IF;
    IF v_existing_disposition.disposition IS DISTINCT FROM v_item#>>'{expected_disposition,disposition}'
       OR v_existing_disposition.reason_code IS DISTINCT FROM v_item#>>'{expected_disposition,reason_code}'
       OR v_existing_disposition.reason IS DISTINCT FROM v_item#>>'{expected_disposition,reason}'
       OR v_existing_disposition.sources IS DISTINCT FROM v_item#>'{expected_disposition,sources}'
       OR v_existing_disposition.source_batch IS DISTINCT FROM v_item#>>'{expected_disposition,source_batch}'
       OR v_existing_disposition.source_fingerprint IS DISTINCT FROM v_item#>>'{expected_disposition,source_fingerprint}'
       OR v_existing_disposition.reviewed_by IS DISTINCT FROM v_item#>>'{expected_disposition,reviewed_by}' THEN
      RAISE EXCEPTION 'product disposition resolution conflicts with current quarantine: %', v_product_id;
    END IF;

    DELETE FROM public.personal_plan_product_search_dispositions AS disposition
    WHERE disposition.product_id = v_product_id
      AND disposition.disposition = v_item#>>'{expected_disposition,disposition}'
      AND disposition.reason_code = v_item#>>'{expected_disposition,reason_code}'
      AND disposition.reason = v_item#>>'{expected_disposition,reason}'
      AND disposition.sources = v_item#>'{expected_disposition,sources}'
      AND disposition.source_batch = v_item#>>'{expected_disposition,source_batch}'
      AND disposition.source_fingerprint = v_item#>>'{expected_disposition,source_fingerprint}'
      AND disposition.reviewed_by = v_item#>>'{expected_disposition,reviewed_by}';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product disposition resolution changed during apply: %', v_product_id;
    END IF;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch->>'batch_id', v_product_key, v_batch_fingerprint,
      v_item->>'content_fingerprint', v_product_id, 'nick'
    );

    product_id := v_product_id;
    resolution := 'resolved';
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_product_disposition_resolutions_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_product_disposition_resolutions_v1(text, text, text)
  TO service_role;
