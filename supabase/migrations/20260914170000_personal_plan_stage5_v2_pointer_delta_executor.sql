-- Stage-5 V2 pointer DELTA executor.
--
-- Why this exists. The full-registry executor
-- (`apply_personal_plan_stage5_v2_artifact_v1`, 20260813060630) applies ONE
-- frozen artifact covering every curated protocol row, and refuses unless its
-- ledger is empty or complete. That premise is dead: the artifact was reset by
-- migration each time it grew (ledger batches of 273 / 289 / 309 rows against a
-- 310-item artifact, so the live RPC now refuses "ledger is partial"), and since
-- 20260903083832 plus the scan-DB expansion waves the live catalog contains rows
-- the frozen artifact never listed. Every lane except the Stage-5 V1 protocol
-- batch now writes its V2 pointer at write time.
--
-- This executor replaces the retired full apply with the operation that is still
-- needed: write a SHORT, separately reviewed list of product pointers. It is
-- idempotent PER ITEM (a partial ledger is a normal state, not an error), so a
-- later delta never has to carry the whole registry with it.
--
-- The retired RPC is deliberately left installed and untouched — nothing calls
-- it, and dropping it would rewrite history this migration has no reason to
-- rewrite.
--
-- This migration creates a function only. It writes no catalog data.

-- OUT columns are prefixed and `#variable_conflict use_column` is set, the
-- posture established by 20260901131456_fix_oil_authority_executor_product_id_ambiguity.sql
-- and carried by 20260914163000: a bare `product_id` OUT column shadows the table
-- column inside SQL expressions and fails at runtime, not at compile time.
CREATE OR REPLACE FUNCTION public.apply_personal_plan_stage5_v2_pointer_delta_v1(
  p_delta_json text,
  p_expected_delta_fingerprint text,
  p_reviewed_by text
)
RETURNS TABLE(
  delta_product_key text,
  delta_product_id uuid,
  delta_outcome text,
  delta_ledger_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict use_column
DECLARE
  v_schema_version constant text := 'personal-plan-stage5-v2-pointer-delta-v1';
  v_max_items constant integer := 20;
  v_delta jsonb;
  v_batch_id text;
  v_computed_fingerprint text;
  v_item jsonb;
  v_item_count integer;
  v_product_id uuid;
  v_category text;
  v_role text;
  v_family text;
  v_product_key text;
  v_source_fingerprint text;
  v_content_fingerprint text;
  v_outcome text;
  v_ledger_state text;
  v_product public.products%ROWTYPE;
  v_existing_protocol public.product_application_protocols%ROWTYPE;
  v_existing_ledger public.catalog_enrichment_applied_items%ROWTYPE;
BEGIN
  -- Null-safe guards throughout: `x <> 'nick'` and `x !~ '…'` are NULL — not
  -- true — for NULL input, so plain comparisons would let a NULL argument slip
  -- past the approval pins entirely.
  IF p_reviewed_by IS DISTINCT FROM 'nick' THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta reviewer must be nick';
  END IF;
  IF p_expected_delta_fingerprint IS NULL
     OR p_expected_delta_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta fingerprint must be lowercase sha256';
  END IF;
  IF p_delta_json IS NULL THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta payload is required';
  END IF;
  v_computed_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_delta_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_fingerprint IS DISTINCT FROM p_expected_delta_fingerprint THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta fingerprint mismatch';
  END IF;

  BEGIN
    v_delta := p_delta_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta is invalid JSON';
  END;

  v_batch_id := v_delta->>'batch_id';
  IF v_delta->>'schema_version' IS DISTINCT FROM v_schema_version
     OR coalesce(v_batch_id, '') !~ '^S5V2D-[0-9]{2}-[a-z0-9-]+$'
     OR pg_catalog.jsonb_typeof(v_delta->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta header is invalid';
  END IF;

  v_item_count := pg_catalog.jsonb_array_length(v_delta->'items');
  IF v_item_count < 1 OR v_item_count > v_max_items THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta must carry 1..% items', v_max_items;
  END IF;
  IF (v_delta#>>'{observed_counts,items}')::integer IS DISTINCT FROM v_item_count THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta counts are invalid';
  END IF;
  IF v_item_count <> (
       SELECT pg_catalog.count(DISTINCT (item->>'product_id', item->>'source_role'))
       FROM pg_catalog.jsonb_array_elements(v_delta->'items') entries(item)
     ) THEN
    RAISE EXCEPTION 'Stage 5 V2 pointer delta contains duplicate product roles';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-v2-pointer-delta:' || v_batch_id, 0)
  );

  FOR v_item IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_delta->'items') entries(item)
    ORDER BY item->>'product_id', item->>'source_role'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta product ID is invalid';
    END;
    v_category := v_item#>>'{guidance_payload_v2,scope,category}';
    v_role := v_item->>'source_role';
    v_family := v_item#>>'{guidance_payload_v2,applicationFamily}';
    v_source_fingerprint := v_item->>'source_fingerprint';
    -- Namespaced away from the retired full apply's `v2:` keys, so the two lanes
    -- can never claim the same ledger row.
    v_product_key := 'v2-delta:' || v_product_id::text || ':' || v_role;

    IF (v_item#>>'{guidance_payload_v2,schemaVersion}')::integer IS DISTINCT FROM 2
       OR v_item#>>'{guidance_payload_v2,contractKind}' IS DISTINCT FROM 'product_pointer'
       OR v_item#>>'{guidance_payload_v2,scope,kind}' IS DISTINCT FROM 'product'
       OR v_item#>>'{guidance_payload_v2,scope,productId}' IS DISTINCT FROM v_product_id::text
       OR v_item#>>'{guidance_payload_v2,sourceRole}' IS DISTINCT FROM v_role
       OR coalesce(v_category, '') = ''
       OR coalesce(v_role, '') = ''
       OR coalesce(v_family, '') = ''
       OR coalesce(v_source_fingerprint, '') !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta item is invalid: %', v_product_key;
    END IF;

    -- Locked, not merely read: an unlocked existence check is a
    -- time-of-check/time-of-use race — a concurrent deactivation or
    -- recategorization could land between this check and the pointer write.
    -- With the row locked, a concurrent writer waits behind this transaction
    -- (or committed first and is seen here). Lock order is products before
    -- product_application_protocols, matching 20260914163000.
    SELECT product.* INTO v_product
    FROM public.products product
    WHERE product.id = v_product_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_product.category_key IS DISTINCT FROM v_category
       OR v_product.origin IS DISTINCT FROM 'curated'
       OR v_product.is_active IS DISTINCT FROM true
       OR v_product.lifecycle_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta product is missing, inactive, or recategorized: %',
        v_product_key;
    END IF;

    -- Addressed by the table's own unique key
    -- (product_id, category, role, application_family, idx_…_product_category_role_family),
    -- and locked before the fingerprint is recomputed so the guard is not a
    -- time-of-check/time-of-use race against an ordinary writer.
    SELECT protocol.* INTO v_existing_protocol
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_product_id
      AND protocol.category = v_category
      AND protocol.role = v_role
      AND protocol.application_family = v_family
    FOR UPDATE;
    IF NOT FOUND OR v_existing_protocol.guidance_payload IS NULL THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta source protocol is missing: %', v_product_key;
    END IF;
    IF pg_catalog.encode(
         extensions.digest(
           pg_catalog.convert_to(
             public.personal_plan_stage5_v2_canonical_json_v1(
               pg_catalog.jsonb_build_object(
                 'role', v_role,
                 'payload', v_existing_protocol.guidance_payload
               )
             ),
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       ) IS DISTINCT FROM v_source_fingerprint THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta source protocol fingerprint diverged: %',
        v_product_key;
    END IF;

    IF v_existing_protocol.guidance_payload_v2 IS NULL THEN
      UPDATE public.product_application_protocols protocol
      SET guidance_payload_v2 = v_item->'guidance_payload_v2',
          updated_at = pg_catalog.clock_timestamp()
      WHERE protocol.product_id = v_product_id
        AND protocol.category = v_category
        AND protocol.role = v_role
        AND protocol.application_family = v_family
        AND protocol.guidance_payload_v2 IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage 5 V2 pointer delta source protocol changed during apply: %',
          v_product_key;
      END IF;
      v_outcome := 'written';
    ELSIF v_existing_protocol.guidance_payload_v2 IS DISTINCT FROM v_item->'guidance_payload_v2' THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta product authority conflicts: %', v_product_key;
    ELSE
      v_outcome := 'already_current';
    END IF;

    v_content_fingerprint := pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(v_item::text, 'UTF8'), 'sha256'),
      'hex'
    );
    SELECT applied.* INTO v_existing_ledger
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch_id
      AND applied.product_key = v_product_key;
    IF FOUND THEN
      -- Per-item replay. A partial ledger is legitimate here (unlike the retired
      -- full apply): each item is its own unit of idempotency.
      IF v_existing_ledger.batch_fingerprint <> v_computed_fingerprint
         OR v_existing_ledger.content_fingerprint <> v_content_fingerprint
         OR v_existing_ledger.product_id <> v_product_id
         OR v_existing_ledger.reviewed_by <> 'nick' THEN
        RAISE EXCEPTION 'Stage 5 V2 pointer delta ledger conflicts with retry: %', v_product_key;
      END IF;
      v_ledger_state := 'replayed';
    ELSE
      INSERT INTO public.catalog_enrichment_applied_items (
        batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
      ) VALUES (
        v_batch_id, v_product_key, v_computed_fingerprint, v_content_fingerprint,
        v_product_id, 'nick'
      );
      v_ledger_state := 'inserted';
    END IF;

    -- Self-verification: the row this transaction leaves behind must be exactly
    -- the reviewed pointer, whichever branch produced it.
    IF NOT EXISTS (
      SELECT 1
      FROM public.product_application_protocols protocol
      WHERE protocol.product_id = v_product_id
        AND protocol.category = v_category
        AND protocol.role = v_role
        AND protocol.application_family = v_family
        AND protocol.guidance_payload_v2 IS NOT DISTINCT FROM v_item->'guidance_payload_v2'
    ) THEN
      RAISE EXCEPTION 'Stage 5 V2 pointer delta post-write state does not match the delta: %',
        v_product_key;
    END IF;

    delta_product_key := v_product_key;
    delta_product_id := v_product_id;
    delta_outcome := v_outcome;
    delta_ledger_state := v_ledger_state;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_stage5_v2_pointer_delta_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_stage5_v2_pointer_delta_v1(text, text, text)
  TO service_role;
