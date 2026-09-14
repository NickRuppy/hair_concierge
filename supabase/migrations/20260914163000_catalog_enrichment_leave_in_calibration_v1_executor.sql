-- Leave-In research calibration executor (cohort leave-in-research-calibration-v1).
--
-- Mirrors the Heat/Scalp catalog-enrichment executors: one fingerprint-pinned,
-- SECURITY DEFINER RPC, guarded by the reviewer name, the approved batch
-- fingerprint, the approved cohort index, advisory locks, and the shared
-- public.catalog_enrichment_applied_items ledger for replay idempotency.
--
-- This migration creates functions only. It writes no catalog data. The data
-- apply is a separate, later, explicitly authorized step.
--
-- Unlike Heat/Scalp this cohort enriches EXISTING products: it can never insert
-- a product, and it is the first executor to delete rows — eligibility rows only,
-- by full natural key, and always before the upserts for the same product,
-- because a recommended-only research projection replaces the eligibility set.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Sorted-array helper so the SQL-side snapshot matches the TypeScript snapshot
-- byte for byte (the TS builder sorts every array column before hashing).
CREATE OR REPLACE FUNCTION public.leave_in_calibration_sorted_text_array(p_values text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_values IS NULL THEN 'null'::jsonb
    ELSE coalesce(
      (SELECT pg_catalog.jsonb_agg(entry ORDER BY entry COLLATE "C")
       FROM pg_catalog.unnest(p_values) AS entry),
      '[]'::jsonb
    )
  END
$$;

REVOKE ALL ON FUNCTION public.leave_in_calibration_sorted_text_array(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_in_calibration_sorted_text_array(text[]) TO service_role;

-- Live drift snapshot. Protocol rows are deliberately excluded: the Stage-5
-- protocol step must run BEFORE this apply (the deferred curated-publication
-- trigger requires it), so including them would make that step invalidate the
-- pinned batch. Array columns are SORTED here because the reviewed
-- manifest's `current_catalog_target` is built the same way (the TypeScript
-- snapshot sorts every array before hashing), so the comparison is insensitive
-- to stored element order.
CREATE OR REPLACE FUNCTION public.leave_in_calibration_current_target(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'product_id', p_product_id::text,
    'products', coalesce((
      SELECT pg_catalog.jsonb_build_object(
        'name', product.name,
        'brand', product.brand,
        'category_key', product.category_key,
        'origin', product.origin,
        'is_active', product.is_active,
        'lifecycle_status', product.lifecycle_status,
        'is_chaarlie_recommended', product.is_chaarlie_recommended,
        'suitable_thicknesses',
          public.leave_in_calibration_sorted_text_array(product.suitable_thicknesses),
        'image_url', product.image_url
      )
      FROM public.products product WHERE product.id = p_product_id
    ), 'null'::jsonb),
    'product_leave_in_specs', coalesce((
      SELECT pg_catalog.jsonb_build_object(
        'format', spec.format,
        'weight', spec.weight,
        'roles', public.leave_in_calibration_sorted_text_array(spec.roles),
        'provides_heat_protection', spec.provides_heat_protection,
        'heat_protection_max_c', spec.heat_protection_max_c,
        'heat_activation_required', spec.heat_activation_required,
        'care_benefits', public.leave_in_calibration_sorted_text_array(spec.care_benefits),
        'ingredient_flags', public.leave_in_calibration_sorted_text_array(spec.ingredient_flags),
        'application_stage', public.leave_in_calibration_sorted_text_array(spec.application_stage),
        'care_direction', spec.care_direction,
        'repair_support_level', spec.repair_support_level,
        'plan_roles', public.leave_in_calibration_sorted_text_array(spec.plan_roles),
        'functional_benefits',
          public.leave_in_calibration_sorted_text_array(spec.functional_benefits),
        'category_key', spec.category_key,
        'conditioner_relationship', spec.conditioner_relationship
      )
      FROM public.product_leave_in_specs spec WHERE spec.product_id = p_product_id
    ), 'null'::jsonb),
    'product_leave_in_fit_specs', coalesce((
      SELECT pg_catalog.jsonb_build_object(
        'weight', fit.weight,
        'conditioner_relationship', fit.conditioner_relationship,
        'care_benefits', public.leave_in_calibration_sorted_text_array(fit.care_benefits)
      )
      FROM public.product_leave_in_fit_specs fit WHERE fit.product_id = p_product_id
    ), 'null'::jsonb),
    'product_leave_in_eligibility', coalesce((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'thickness', eligibility.thickness,
          'need_bucket', eligibility.need_bucket,
          'styling_context', eligibility.styling_context
        )
        ORDER BY eligibility.thickness COLLATE "C",
                 eligibility.need_bucket COLLATE "C",
                 eligibility.styling_context COLLATE "C"
      )
      FROM public.product_leave_in_eligibility eligibility
      WHERE eligibility.product_id = p_product_id
    ), '[]'::jsonb)
  )
$$;

-- Re-sorts the manifest's own snapshot with the same ordering so the drift
-- comparison never depends on how the reviewed JSON happened to be ordered.
CREATE OR REPLACE FUNCTION public.leave_in_calibration_normalize_target(p_target jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'product_id', p_target->>'product_id',
    'products', coalesce(p_target->'products', 'null'::jsonb),
    'product_leave_in_specs', coalesce(p_target->'product_leave_in_specs', 'null'::jsonb),
    'product_leave_in_fit_specs', coalesce(p_target->'product_leave_in_fit_specs', 'null'::jsonb),
    'product_leave_in_eligibility', coalesce((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'thickness', element.value->>'thickness',
          'need_bucket', element.value->>'need_bucket',
          'styling_context', element.value->>'styling_context'
        )
        ORDER BY element.value->>'thickness' COLLATE "C",
                 element.value->>'need_bucket' COLLATE "C",
                 element.value->>'styling_context' COLLATE "C"
      )
      FROM pg_catalog.jsonb_array_elements(p_target->'product_leave_in_eligibility') AS element
    ), '[]'::jsonb)
  )
$$;

-- Post-apply state. Array columns are NOT sorted here: the projection's own
-- element order is what gets written and what the batch carries, so comparing
-- in stored order is the stricter and correct check.
CREATE OR REPLACE FUNCTION public.leave_in_calibration_applied_state(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'suitable_thicknesses', coalesce((
      SELECT pg_catalog.to_jsonb(product.suitable_thicknesses)
      FROM public.products product WHERE product.id = p_product_id
    ), 'null'::jsonb),
    'specs', coalesce((
      SELECT pg_catalog.jsonb_build_object(
        'format', spec.format,
        'weight', spec.weight,
        'roles', pg_catalog.to_jsonb(spec.roles),
        'provides_heat_protection', spec.provides_heat_protection,
        'heat_activation_required', spec.heat_activation_required,
        'care_benefits', pg_catalog.to_jsonb(spec.care_benefits),
        'ingredient_flags', pg_catalog.to_jsonb(spec.ingredient_flags),
        'application_stage', pg_catalog.to_jsonb(spec.application_stage),
        'care_direction', spec.care_direction,
        'repair_support_level', spec.repair_support_level,
        'plan_roles', pg_catalog.to_jsonb(spec.plan_roles),
        'functional_benefits', pg_catalog.to_jsonb(spec.functional_benefits)
      )
      FROM public.product_leave_in_specs spec WHERE spec.product_id = p_product_id
    ), 'null'::jsonb),
    'fit', coalesce((
      SELECT pg_catalog.jsonb_build_object(
        'weight', fit.weight,
        'conditioner_relationship', fit.conditioner_relationship,
        'care_benefits', pg_catalog.to_jsonb(fit.care_benefits)
      )
      FROM public.product_leave_in_fit_specs fit WHERE fit.product_id = p_product_id
    ), 'null'::jsonb),
    'eligibility', coalesce((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'thickness', eligibility.thickness,
          'need_bucket', eligibility.need_bucket,
          'styling_context', eligibility.styling_context
        )
        ORDER BY eligibility.thickness COLLATE "C",
                 eligibility.need_bucket COLLATE "C",
                 eligibility.styling_context COLLATE "C"
      )
      FROM public.product_leave_in_eligibility eligibility
      WHERE eligibility.product_id = p_product_id
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.leave_in_calibration_current_target(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_in_calibration_normalize_target(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_in_calibration_applied_state(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_in_calibration_current_target(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_in_calibration_normalize_target(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_in_calibration_applied_state(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v1(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_by text
)
-- OUT column names are deliberately prefixed. A bare `product_id` OUT column
-- shadows the table column inside SQL expressions such as
-- `ON CONFLICT (product_id)`, which is the exact defect
-- 20260901131456_fix_oil_authority_executor_product_id_ambiguity.sql had to
-- repair in the Oil executor. Prefixing removes the collision outright; the
-- `#variable_conflict use_column` pragma below keeps the same belt-and-braces
-- posture that fix established.
RETURNS TABLE(
  applied_product_key text,
  applied_product_id uuid,
  applied_deleted_rows integer,
  applied_eligibility_rows integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
#variable_conflict use_column
DECLARE
  v_batch jsonb;
  v_batch_fingerprint text;
  v_item jsonb;
  v_key text;
  v_pid uuid;
  v_specs jsonb;
  v_fit jsonb;
  v_target jsonb;
  v_live jsonb;
  v_intended jsonb;
  v_deleted integer;
  v_count integer;
  v_existing_count integer;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_content_fingerprint text;
  v_batch_id constant text := 'leave-in-research-calibration-v1';
  v_schema_version constant text :=
    'personal-plan-catalog-enrichment-leave-in-calibration-v1';
  v_expected_products constant integer := 9;
  v_approved_batch_fingerprint constant text :=
    'eaffe5481438c6639de05040c48937a17280fc6c2e9e192f64d3d8d569979ba6';
  v_approved_cohort_index constant text :=
    '78260563c2e818f23a14b74096c7b7c0e423a176cbe8327a93651357df98c06d';
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'leave-in calibration reviewer must be nick';
  END IF;
  IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'leave-in calibration batch fingerprint must be lowercase sha256';
  END IF;
  v_batch_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex'
  );
  IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'leave-in calibration batch fingerprint mismatch';
  END IF;
  IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN
    RAISE EXCEPTION 'leave-in calibration batch fingerprint is not approved';
  END IF;

  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'leave-in calibration batch is invalid JSON';
  END;

  IF v_batch->>'schema_version' IS DISTINCT FROM v_schema_version
     OR v_batch->>'batch_id' IS DISTINCT FROM v_batch_id
     OR v_batch->>'cohort_index_fingerprint' IS DISTINCT FROM v_approved_cohort_index THEN
    RAISE EXCEPTION 'leave-in calibration batch header is invalid';
  END IF;
  IF pg_catalog.jsonb_typeof(v_batch->'products') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_batch->'products') <> v_expected_products THEN
    RAISE EXCEPTION 'leave-in calibration batch must contain exactly % products', v_expected_products;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:' || v_batch_id, 0)
  );

  IF (
    SELECT pg_catalog.count(DISTINCT entry.value->>'product_key')
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
  ) <> v_expected_products THEN
    RAISE EXCEPTION 'leave-in calibration product keys are not unique';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
    WHERE (entry.value->>'product_key', entry.value->>'product_id') NOT IN (
      ('leave-in-slot-01-alverde-express-7in1', 'f9595d2c-d86d-4bdb-9758-c98d1e213f3c'),
      ('leave-in-slot-02-isana-hyaluron-panthenol', '0b21f996-bb42-4b10-89bd-4881c4346d53'),
      ('leave-in-slot-03-cantu-repair-cream', 'e3c4b607-8f81-462c-8a2b-e45c8b3a2976'),
      ('leave-in-slot-05-evo-head-mistress', '118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'),
      ('leave-in-slot-06-curlsmith-hydrate-plump', '648ba537-5180-440e-81ad-2b310b447d87'),
      ('leave-in-slot-08-gliss-ultimate-repair', '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'),
      ('leave-in-slot-09-redken-extreme-anti-snap', '2b7db7e3-2058-4178-8a03-7d05f4a1d447'),
      ('leave-in-slot-10-olaplex-no6-bond-smoother', '4e99706a-2232-4ee6-ba1b-9ca1029a7364'),
      ('leave-in-slot-13-neqi-diamond-glass', '42a2fe20-bd7e-49a3-a880-8ae89015a5c9')
    )
  ) THEN
    RAISE EXCEPTION 'leave-in calibration product mapping is not approved';
  END IF;

  SELECT pg_catalog.count(*) INTO v_existing_count
  FROM public.catalog_enrichment_applied_items applied
  WHERE applied.batch_id = v_batch_id;
  IF v_existing_count NOT IN (0, v_expected_products) THEN
    RAISE EXCEPTION 'leave-in calibration partial ledger state';
  END IF;

  FOR v_item IN
    SELECT entry.value
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
    ORDER BY entry.value->>'product_key'
  LOOP
    v_key := v_item->>'product_key';
    v_pid := (v_item->>'product_id')::uuid;
    v_specs := v_item->'leave_in_specs';
    v_fit := v_item->'leave_in_fit_specs';
    v_target := v_item->'current_catalog_target';
    v_content_fingerprint := v_item->>'content_fingerprint';

    IF v_content_fingerprint !~ '^[a-f0-9]{64}$'
       OR pg_catalog.jsonb_typeof(v_specs) <> 'object'
       OR pg_catalog.jsonb_typeof(v_fit) <> 'object'
       OR pg_catalog.jsonb_typeof(v_target) <> 'object'
       OR pg_catalog.jsonb_typeof(v_item->'suitable_thicknesses') <> 'array'
       OR pg_catalog.jsonb_array_length(v_item->'suitable_thicknesses') < 1
       OR pg_catalog.jsonb_typeof(v_item->'eligibility_delete') <> 'array'
       OR pg_catalog.jsonb_typeof(v_item->'eligibility_upsert') <> 'array'
       OR pg_catalog.jsonb_array_length(v_item->'eligibility_upsert') < 1 THEN
      RAISE EXCEPTION 'leave-in calibration item is invalid: %', coalesce(v_key, '?');
    END IF;

    -- A row may never be deleted and re-inserted in the same product (the
    -- TypeScript contract rejects it too; this is the executor-side backstop).
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_item->'eligibility_delete') AS removed
      JOIN pg_catalog.jsonb_array_elements(v_item->'eligibility_upsert') AS kept
        ON removed.value->>'thickness' = kept.value->>'thickness'
       AND removed.value->>'need_bucket' = kept.value->>'need_bucket'
       AND removed.value->>'styling_context' = kept.value->>'styling_context'
    ) THEN
      RAISE EXCEPTION 'leave-in calibration plans a delete and an upsert for the same row: %', v_key;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('catalog-enrichment:' || v_batch_id || ':' || v_key, 0)
    );

    -- Advisory locks only serialize callers that take the same advisory key; an
    -- ordinary writer touching these rows is not bound by them. Take real row
    -- locks BEFORE the snapshot is read, so the state this transaction compares
    -- against is the state it goes on to write. Without this the fingerprint
    -- guard is a time-of-check/time-of-use race.
    PERFORM 1 FROM public.products WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'leave-in calibration product is missing: %', v_key;
    END IF;
    PERFORM 1 FROM public.product_leave_in_specs WHERE product_id = v_pid FOR UPDATE;
    PERFORM 1 FROM public.product_leave_in_fit_specs WHERE product_id = v_pid FOR UPDATE;
    PERFORM 1 FROM public.product_leave_in_eligibility WHERE product_id = v_pid FOR UPDATE;

    -- The state the apply intends to leave behind; used both to verify a replay
    -- and to assert the result of a first run.
    v_intended := pg_catalog.jsonb_build_object(
      'suitable_thicknesses', v_item->'suitable_thicknesses',
      'specs', v_specs,
      'fit', v_fit,
      'eligibility', (
        SELECT coalesce(pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'thickness', kept.value->>'thickness',
            'need_bucket', kept.value->>'need_bucket',
            'styling_context', kept.value->>'styling_context'
          )
          ORDER BY kept.value->>'thickness' COLLATE "C",
                   kept.value->>'need_bucket' COLLATE "C",
                   kept.value->>'styling_context' COLLATE "C"
        ), '[]'::jsonb)
        FROM pg_catalog.jsonb_array_elements(v_item->'eligibility_upsert') AS kept
      )
    );

    SELECT applied.* INTO v_existing
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch_id AND applied.product_key = v_key;

    IF FOUND THEN
      -- Replay: the ledger says this product was already applied by this exact
      -- batch, so assert the live rows still equal the intended state and return
      -- without writing anything.
      IF v_existing.batch_fingerprint <> v_batch_fingerprint
         OR v_existing.content_fingerprint <> v_content_fingerprint
         OR v_existing.product_id <> v_pid
         OR v_existing.reviewed_by <> 'nick' THEN
        RAISE EXCEPTION 'leave-in calibration ledger conflicts with retry: %', v_key;
      END IF;
      v_live := public.leave_in_calibration_applied_state(v_pid);
      IF v_live IS DISTINCT FROM v_intended THEN
        RAISE EXCEPTION 'leave-in calibration conflicting or partial retry: %', v_key;
      END IF;
      applied_product_key := v_key;
      applied_product_id := v_pid;
      applied_deleted_rows := 0;
      applied_eligibility_rows := pg_catalog.jsonb_array_length(v_item->'eligibility_upsert');
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Fingerprint guard: the live rows must still be exactly the snapshot the
    -- reviewed manifest pinned itself to.
    v_live := public.leave_in_calibration_current_target(v_pid);
    IF v_live IS DISTINCT FROM public.leave_in_calibration_normalize_target(v_target) THEN
      RAISE EXCEPTION 'leave-in calibration target drifted since review: %', v_key;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.product_leave_in_specs spec
      WHERE spec.product_id = v_pid AND spec.heat_protection_max_c IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'leave-in calibration refuses a row that still carries heat_protection_max_c (AD-6): %', v_key;
    END IF;

    -- 1. product row, 2. deletes, 3. upserts — the contract's execution order.
    UPDATE public.products
    SET suitable_thicknesses = ARRAY(
      SELECT pg_catalog.jsonb_array_elements_text(v_item->'suitable_thicknesses')
    )
    WHERE id = v_pid;

    DELETE FROM public.product_leave_in_eligibility eligibility
    USING pg_catalog.jsonb_array_elements(v_item->'eligibility_delete') AS removed
    WHERE eligibility.product_id = v_pid
      AND eligibility.thickness = removed.value->>'thickness'
      AND eligibility.need_bucket = removed.value->>'need_bucket'
      AND eligibility.styling_context = removed.value->>'styling_context';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted <> pg_catalog.jsonb_array_length(v_item->'eligibility_delete') THEN
      RAISE EXCEPTION 'leave-in calibration delete removed % of % planned rows: %',
        v_deleted, pg_catalog.jsonb_array_length(v_item->'eligibility_delete'), v_key;
    END IF;

    INSERT INTO public.product_leave_in_specs (
      product_id, format, weight, roles, provides_heat_protection, heat_activation_required,
      care_benefits, ingredient_flags, application_stage, care_direction, repair_support_level,
      plan_roles, functional_benefits
    ) VALUES (
      v_pid,
      v_specs->>'format',
      v_specs->>'weight',
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'roles')),
      (v_specs->>'provides_heat_protection')::boolean,
      (v_specs->>'heat_activation_required')::boolean,
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'care_benefits')),
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'ingredient_flags')),
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'application_stage')),
      v_specs->>'care_direction',
      v_specs->>'repair_support_level',
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'plan_roles')),
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_specs->'functional_benefits'))
    )
    ON CONFLICT (product_id) DO UPDATE SET
      format = EXCLUDED.format,
      weight = EXCLUDED.weight,
      roles = EXCLUDED.roles,
      provides_heat_protection = EXCLUDED.provides_heat_protection,
      heat_activation_required = EXCLUDED.heat_activation_required,
      care_benefits = EXCLUDED.care_benefits,
      ingredient_flags = EXCLUDED.ingredient_flags,
      application_stage = EXCLUDED.application_stage,
      care_direction = EXCLUDED.care_direction,
      repair_support_level = EXCLUDED.repair_support_level,
      plan_roles = EXCLUDED.plan_roles,
      functional_benefits = EXCLUDED.functional_benefits;

    INSERT INTO public.product_leave_in_fit_specs (
      product_id, weight, conditioner_relationship, care_benefits
    ) VALUES (
      v_pid,
      v_fit->>'weight',
      v_fit->>'conditioner_relationship',
      ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_fit->'care_benefits'))
    )
    ON CONFLICT (product_id) DO UPDATE SET
      weight = EXCLUDED.weight,
      conditioner_relationship = EXCLUDED.conditioner_relationship,
      care_benefits = EXCLUDED.care_benefits;

    INSERT INTO public.product_leave_in_eligibility (
      product_id, thickness, need_bucket, styling_context
    )
    SELECT v_pid,
           kept.value->>'thickness',
           kept.value->>'need_bucket',
           kept.value->>'styling_context'
    FROM pg_catalog.jsonb_array_elements(v_item->'eligibility_upsert') AS kept
    ON CONFLICT (product_id, thickness, need_bucket, styling_context) DO NOTHING;

    -- Self-verification: the live state must now be exactly the intended state.
    v_live := public.leave_in_calibration_applied_state(v_pid);
    IF v_live IS DISTINCT FROM v_intended THEN
      RAISE EXCEPTION 'leave-in calibration post-write state does not match the batch: %', v_key;
    END IF;
    SELECT pg_catalog.count(*) INTO v_count
    FROM public.product_leave_in_eligibility eligibility
    WHERE eligibility.product_id = v_pid;
    IF v_count <> pg_catalog.jsonb_array_length(v_item->'eligibility_upsert') THEN
      RAISE EXCEPTION 'leave-in calibration eligibility set is not the projection: %', v_key;
    END IF;

    -- Re-assert the invariants that must still hold after this transaction's own
    -- writes: AD-6 keeps heat protection binary, and the apply must never have
    -- landed on a product whose identity moved under it.
    IF EXISTS (
      SELECT 1 FROM public.product_leave_in_specs spec
      WHERE spec.product_id = v_pid AND spec.heat_protection_max_c IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'leave-in calibration left heat_protection_max_c set (AD-6): %', v_key;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.products product
      WHERE product.id = v_pid
        AND product.name IS NOT DISTINCT FROM v_target#>>'{products,name}'
        AND product.brand IS NOT DISTINCT FROM v_target#>>'{products,brand}'
        AND product.category_key IS NOT DISTINCT FROM v_target#>>'{products,category_key}'
        AND product.origin IS NOT DISTINCT FROM v_target#>>'{products,origin}'
        AND product.lifecycle_status IS NOT DISTINCT FROM v_target#>>'{products,lifecycle_status}'
    ) THEN
      RAISE EXCEPTION 'leave-in calibration product identity changed during apply: %', v_key;
    END IF;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch_id, v_key, v_batch_fingerprint, v_content_fingerprint, v_pid, 'nick'
    );

    applied_product_key := v_key;
    applied_product_id := v_pid;
    applied_deleted_rows := v_deleted;
    applied_eligibility_rows := v_count;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v1(text, text, text)
  TO service_role;
