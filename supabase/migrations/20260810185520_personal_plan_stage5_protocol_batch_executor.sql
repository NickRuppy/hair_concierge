-- Guarded existing-product protocol executor. This function cannot create or
-- recategorize products: it only attaches a reviewed canonical Stage-5 payload
-- to an active product whose current category already matches the batch.

CREATE OR REPLACE FUNCTION public.apply_personal_plan_stage5_protocol_batch_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_by text
)
RETURNS TABLE(product_id uuid, category_key text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_batch jsonb;
  v_item jsonb;
  v_payload jsonb;
  v_computed_fingerprint text;
  v_content_fingerprint text;
  v_product_id uuid;
  v_category text;
  v_role text;
  v_product_key text;
  v_existing public.product_application_protocols%ROWTYPE;
  v_ledger public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'Stage 5 protocol reviewer must be nick';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Stage 5 protocol fingerprint must be lowercase sha256';
  END IF;

  v_computed_fingerprint := encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_fingerprint <> p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'Stage 5 protocol batch fingerprint mismatch';
  END IF;
  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Stage 5 protocol batch is invalid JSON';
  END;
  IF v_batch->>'schema_version' IS DISTINCT FROM 'personal-plan-stage5-protocol-apply-v1'
     OR coalesce(v_batch->>'batch_id', '') !~ '^S5-[0-9]{2}-[a-z0-9-]+$'
     OR jsonb_typeof(v_batch->'protocols') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_batch->'protocols') < 1 THEN
    RAISE EXCEPTION 'Stage 5 protocol batch header is invalid';
  END IF;
  IF (
    SELECT count(*)
    FROM jsonb_array_elements(v_batch->'protocols') AS entries(item)
  ) <> (
    SELECT count(DISTINCT (item->>'product_id', item->>'category_key', item->>'role'))
    FROM jsonb_array_elements(v_batch->'protocols') AS entries(item)
  ) THEN
    RAISE EXCEPTION 'Stage 5 protocol batch contains duplicate product roles';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-protocol:' || (v_batch->>'batch_id'), 0)
  );

  FOR v_item IN
    SELECT item
    FROM jsonb_array_elements(v_batch->'protocols') AS entries(item)
    ORDER BY item->>'product_id', item->>'role'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Stage 5 protocol product ID is invalid';
    END;
    v_category := v_item->>'category_key';
    v_role := v_item->>'role';
    v_payload := v_item->'guidance_payload';
    v_product_key := v_product_id::text || ':' || v_role;
    v_content_fingerprint := encode(
      extensions.digest(pg_catalog.convert_to(v_item::text, 'UTF8'), 'sha256'),
      'hex'
    );

    IF jsonb_typeof(v_payload) IS DISTINCT FROM 'object'
       OR (v_payload->>'schemaVersion')::integer IS DISTINCT FROM 1
       OR v_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
       OR v_payload#>>'{scope,productId}' IS DISTINCT FROM v_product_id::text
       OR v_payload#>>'{scope,category}' IS DISTINCT FROM v_category
       OR jsonb_typeof(v_payload->'steps') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_payload->'steps') < 1
       OR jsonb_typeof(v_payload->'evidence') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_payload->'evidence') < 1 THEN
      RAISE EXCEPTION 'Stage 5 canonical guidance payload is invalid: %', v_product_key;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.products product
      WHERE product.id = v_product_id
        AND product.category_key = v_category
        AND product.is_active = true
        AND product.lifecycle_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Stage 5 protocol product is missing, inactive, or recategorized: %', v_product_key;
    END IF;

    SELECT protocol.* INTO v_existing
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_product_id
      AND protocol.category = v_category
      AND protocol.role = v_role;

    IF FOUND THEN
      IF v_existing.guidance_payload IS DISTINCT FROM v_payload
         OR v_existing.cadence IS DISTINCT FROM v_item->'cadence'
         OR v_existing.source_url IS DISTINCT FROM v_item->>'source_url' THEN
        RAISE EXCEPTION 'Stage 5 protocol conflicts with existing authority: %', v_product_key;
      END IF;
    ELSE
      INSERT INTO public.product_application_protocols (
        product_id,
        category,
        role,
        cadence,
        application_stage,
        application_state,
        placement,
        contact_time_seconds,
        rinse_action,
        reapplication,
        instruction_modifiers,
        source_label,
        source_url,
        source_text,
        guidance_payload
      ) VALUES (
        v_product_id,
        v_category,
        v_role,
        v_item->'cadence',
        v_payload#>>'{sequence,anchor}',
        CASE v_payload->>'applicationFamily'
          WHEN 'pre_heat_damp' THEN 'damp'
          WHEN 'pre_heat_dry' THEN 'dry'
          WHEN 'either_state_protection' THEN 'either'
          ELSE NULL
        END,
        v_payload#>>'{protocolFacts,applicationArea}',
        NULLIF(v_payload#>>'{protocolFacts,contactTimeSeconds}', '')::integer,
        v_payload#>>'{protocolFacts,rinse}',
        CASE v_payload#>>'{protocolFacts,reapplication}'
          WHEN 'each_separate_heat_event' THEN 'required'
          WHEN 'none' THEN 'not_stated'
          ELSE NULL
        END,
        '[]'::jsonb,
        v_item->>'source_label',
        v_item->>'source_url',
        v_item->>'source_text',
        v_payload
      );
    END IF;

    SELECT applied.* INTO v_ledger
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch->>'batch_id'
      AND applied.product_key = v_product_key;
    IF FOUND THEN
      IF v_ledger.batch_fingerprint <> v_computed_fingerprint
         OR v_ledger.content_fingerprint <> v_content_fingerprint
         OR v_ledger.product_id <> v_product_id
         OR v_ledger.reviewed_by <> 'nick' THEN
        RAISE EXCEPTION 'Stage 5 protocol ledger conflicts with retry: %', v_product_key;
      END IF;
    ELSE
      INSERT INTO public.catalog_enrichment_applied_items (
        batch_id,
        product_key,
        batch_fingerprint,
        content_fingerprint,
        product_id,
        reviewed_by
      ) VALUES (
        v_batch->>'batch_id',
        v_product_key,
        v_computed_fingerprint,
        v_content_fingerprint,
        v_product_id,
        'nick'
      );
    END IF;

    product_id := v_product_id;
    category_key := v_category;
    role := v_role;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_stage5_protocol_batch_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_stage5_protocol_batch_v1(text, text, text)
  TO service_role;
