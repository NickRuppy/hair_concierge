-- Leave-In research calibration executor, batch leave-in-research-calibration-v2-t20.
--
-- Standard v1.1 (ruling T20) plus the AD-3a revision, both 2026-09-29, move three
-- product_leave_in_specs columns — care_direction, care_benefits,
-- functional_benefits — on five products that batch v1
-- (20260914163000, applied 2026-09-14) already wrote: EVO, Gliss, Redken,
-- Olaplex No.6 and Neqi. Nothing else moves: fit specs, the eligibility set and
-- products.suitable_thicknesses are identical (plans/leave-in-moisture-balanced/
-- t20-catalog-delta.md).
--
-- This migration creates functions only and writes no catalog data. The data
-- apply is a separate, explicitly authorized step.
--
-- House discipline, all enforced below:
--   * reviewer pinned to 'nick'; batch and cohort-index fingerprints hardwired;
--   * null-safe guards only (IS DISTINCT FROM / explicit NULL checks) — a bare
--     `<>` against a NULL parameter is NULL, not true, and would slip past a pin;
--   * the shared catalog-apply advisory lock
--     hashtextextended('catalog-enrichment:product-apply', 0) before any product
--     row lock (see 20260914170000), then the batch lock, then per-product locks;
--   * FOR UPDATE row locks before any snapshot read;
--   * drift guard against the pinned current_catalog_target;
--   * the package may only change the three allowlisted spec columns, and must
--     prove that the fit row, the eligibility set and the thicknesses are the
--     pinned ones — the executor never writes fit or eligibility at all;
--   * per-product ledger rows in public.catalog_enrichment_applied_items with a
--     replay short-circuit that re-asserts the live state;
--   * post-write self-check; one transaction; service_role-only grants.
--
-- Depends on the batch-v1 helpers public.leave_in_calibration_current_target,
-- public.leave_in_calibration_normalize_target and
-- public.leave_in_calibration_sorted_text_array (20260914163000), which it reuses
-- unchanged so the drift snapshot is byte-for-byte the one batch v1 pinned.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Arrays compare as sorted sets (the snapshot convention); scalars as-is; a
-- missing value is JSON null.
CREATE OR REPLACE FUNCTION public.leave_in_calibration_v2_t20_comparable(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN 'null'::jsonb
    WHEN pg_catalog.jsonb_typeof(p_value) = 'array' THEN coalesce(
      (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(entry) ORDER BY entry COLLATE "C")
       FROM pg_catalog.jsonb_array_elements_text(p_value) AS entry),
      '[]'::jsonb
    )
    ELSE p_value
  END
$$;

REVOKE ALL ON FUNCTION public.leave_in_calibration_v2_t20_comparable(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_in_calibration_v2_t20_comparable(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v2_t20(
  p_batch_json text,
  p_expected_batch_fingerprint text,
  p_reviewed_by text
)
-- OUT columns are prefixed so none shadows a table column inside SQL
-- (20260901131456); `#variable_conflict use_column` below is the same
-- belt-and-braces posture batch v1 uses.
RETURNS TABLE(
  applied_product_key text,
  applied_product_id uuid,
  applied_changed_columns text[],
  applied_replay boolean
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
  v_projected jsonb;
  v_projected_fit jsonb;
  v_target jsonb;
  v_target_norm jsonb;
  v_expected jsonb;
  v_live jsonb;
  v_changed text[];
  v_computed_changed text[];
  v_column text;
  v_count integer;
  v_rows integer;
  v_eligibility_before integer;
  v_existing_count integer;
  v_existing public.catalog_enrichment_applied_items%ROWTYPE;
  v_content_fingerprint text;
  v_batch_id constant text := 'leave-in-research-calibration-v2-t20';
  v_schema_version constant text :=
    'personal-plan-catalog-enrichment-leave-in-calibration-v2-t20';
  v_expected_products constant integer := 5;
  v_approved_batch_fingerprint constant text :=
    '059cdca2fb98bde5b4c3b70d0920e93f78bb22eb993f0f207e669b848b1ddd4c';
  v_approved_cohort_index constant text :=
    '3a63acc89c081080bda4e4157254836103336a9490d067dd3cf148203727baed';
  v_allowed_columns constant text[] :=
    ARRAY['care_benefits', 'care_direction', 'functional_benefits'];
  v_projected_columns constant text[] := ARRAY[
    'application_stage', 'care_benefits', 'care_direction', 'format',
    'functional_benefits', 'heat_activation_required', 'ingredient_flags',
    'plan_roles', 'provides_heat_protection', 'repair_support_level', 'roles', 'weight'
  ];
  v_fit_columns constant text[] := ARRAY['care_benefits', 'conditioner_relationship', 'weight'];
BEGIN
  IF p_reviewed_by IS DISTINCT FROM 'nick' THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 reviewer must be nick';
  END IF;
  IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch fingerprint must be lowercase sha256';
  END IF;
  IF p_batch_json IS NULL THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch payload is required';
  END IF;
  v_batch_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_batch_json, 'UTF8'), 'sha256'), 'hex'
  );
  IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch fingerprint mismatch';
  END IF;
  IF v_batch_fingerprint IS DISTINCT FROM v_approved_batch_fingerprint THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch fingerprint is not approved';
  END IF;

  BEGIN
    v_batch := p_batch_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch is invalid JSON';
  END;

  IF v_batch->>'schema_version' IS DISTINCT FROM v_schema_version
     OR v_batch->>'batch_id' IS DISTINCT FROM v_batch_id
     OR v_batch->>'cohort_index_fingerprint' IS DISTINCT FROM v_approved_cohort_index THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch header is invalid';
  END IF;
  IF pg_catalog.jsonb_typeof(v_batch->'products') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(v_batch->'products') IS DISTINCT FROM v_expected_products THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 batch must contain exactly % products',
      v_expected_products;
  END IF;

  -- Shared cross-executor serialization first (20260914170000): every catalog
  -- executor that takes product row locks takes this lock before any of them.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:' || v_batch_id, 0)
  );

  IF (
    SELECT pg_catalog.count(DISTINCT entry.value->>'product_key')
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
  ) IS DISTINCT FROM v_expected_products::bigint THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 product keys are not unique';
  END IF;
  -- NOT EXISTS + IS NOT DISTINCT FROM, so a NULL key or id can never match by
  -- slipping through a NULL-valued NOT IN.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
    WHERE NOT EXISTS (
      SELECT 1
      FROM (VALUES
        ('leave-in-slot-05-evo-head-mistress', '118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'),
        ('leave-in-slot-08-gliss-ultimate-repair', '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'),
        ('leave-in-slot-09-redken-extreme-anti-snap', '2b7db7e3-2058-4178-8a03-7d05f4a1d447'),
        ('leave-in-slot-10-olaplex-no6-bond-smoother', '4e99706a-2232-4ee6-ba1b-9ca1029a7364'),
        ('leave-in-slot-13-neqi-diamond-glass', '42a2fe20-bd7e-49a3-a880-8ae89015a5c9')
      ) AS approved(product_key, product_id)
      WHERE approved.product_key IS NOT DISTINCT FROM entry.value->>'product_key'
        AND approved.product_id IS NOT DISTINCT FROM entry.value->>'product_id'
    )
  ) THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 product mapping is not approved';
  END IF;

  -- The batch's ledger key SET must be either empty (first apply) or exactly
  -- the five approved product keys (replay). A count check alone would accept
  -- four expected keys plus one foreign key, replay four, apply the fifth and
  -- leave six rows behind.
  SELECT pg_catalog.count(*) INTO v_existing_count
  FROM public.catalog_enrichment_applied_items applied
  WHERE applied.batch_id = v_batch_id;
  IF v_existing_count <> 0 AND (
    ARRAY(
      SELECT applied.product_key
      FROM public.catalog_enrichment_applied_items applied
      WHERE applied.batch_id = v_batch_id
      ORDER BY applied.product_key COLLATE "C"
    ) IS DISTINCT FROM ARRAY[
      'leave-in-slot-05-evo-head-mistress',
      'leave-in-slot-08-gliss-ultimate-repair',
      'leave-in-slot-09-redken-extreme-anti-snap',
      'leave-in-slot-10-olaplex-no6-bond-smoother',
      'leave-in-slot-13-neqi-diamond-glass'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'leave-in calibration v2-t20 partial ledger state';
  END IF;

  FOR v_item IN
    SELECT entry.value
    FROM pg_catalog.jsonb_array_elements(v_batch->'products') AS entry
    ORDER BY entry.value->>'product_key'
  LOOP
    v_key := v_item->>'product_key';
    BEGIN
      v_pid := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 product id is invalid: %', coalesce(v_key, '?');
    END;
    v_projected := v_item->'projected_leave_in_specs';
    v_projected_fit := v_item->'projected_leave_in_fit_specs';
    v_target := v_item->'current_catalog_target';
    v_content_fingerprint := v_item->>'content_fingerprint';

    IF v_pid IS NULL
       OR coalesce(v_content_fingerprint, '') !~ '^[a-f0-9]{64}$'
       OR pg_catalog.jsonb_typeof(v_projected) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_projected_fit) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_target) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_item->'changed_spec_columns') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_typeof(v_item->'projected_eligibility') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_typeof(v_item->'projected_suitable_thicknesses') IS DISTINCT FROM 'array'
       OR v_target->>'product_id' IS DISTINCT FROM v_pid::text THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 item is invalid: %', coalesce(v_key, '?');
    END IF;

    v_changed := ARRAY(
      SELECT col
      FROM pg_catalog.jsonb_array_elements_text(v_item->'changed_spec_columns') AS col
      ORDER BY col COLLATE "C"
    );
    IF pg_catalog.cardinality(v_changed) < 1
       OR pg_catalog.cardinality(v_changed) IS DISTINCT FROM (
         SELECT pg_catalog.count(DISTINCT col)::integer FROM pg_catalog.unnest(v_changed) AS col
       )
       OR NOT (v_changed <@ v_allowed_columns) THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 may only change care_direction, care_benefits, functional_benefits: %',
        v_key;
    END IF;
    IF ARRAY(
         SELECT key FROM pg_catalog.jsonb_object_keys(v_projected) AS key ORDER BY key COLLATE "C"
       ) IS DISTINCT FROM v_projected_columns
       OR ARRAY(
         SELECT key FROM pg_catalog.jsonb_object_keys(v_projected_fit) AS key ORDER BY key COLLATE "C"
       ) IS DISTINCT FROM v_fit_columns THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 projected rows have unexpected columns: %', v_key;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('catalog-enrichment:' || v_batch_id || ':' || v_key, 0)
    );

    -- Real row locks BEFORE any snapshot read, so the state compared is the
    -- state written. Order: products, specs, fit, eligibility (same as batch v1).
    PERFORM 1 FROM public.products WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 product is missing: %', v_key;
    END IF;
    PERFORM 1 FROM public.product_leave_in_specs WHERE product_id = v_pid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 spec row is missing: %', v_key;
    END IF;
    PERFORM 1 FROM public.product_leave_in_fit_specs WHERE product_id = v_pid FOR UPDATE;
    PERFORM 1 FROM public.product_leave_in_eligibility WHERE product_id = v_pid FOR UPDATE;

    v_target_norm := public.leave_in_calibration_normalize_target(v_target);

    -- The package must prove its own delta against the pinned state: the declared
    -- columns are exactly the projected columns that differ, ...
    v_computed_changed := ARRAY(
      SELECT col
      FROM pg_catalog.unnest(v_projected_columns) AS col
      WHERE public.leave_in_calibration_v2_t20_comparable(v_projected->col)
            IS DISTINCT FROM
            public.leave_in_calibration_v2_t20_comparable(v_target_norm->'product_leave_in_specs'->col)
      ORDER BY col COLLATE "C"
    );
    IF v_computed_changed IS DISTINCT FROM v_changed THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 declared spec delta does not match the pinned target: %',
        v_key;
    END IF;
    -- ... the fit row is unchanged, ...
    IF EXISTS (
      SELECT 1 FROM pg_catalog.unnest(v_fit_columns) AS col
      WHERE public.leave_in_calibration_v2_t20_comparable(v_projected_fit->col)
            IS DISTINCT FROM
            public.leave_in_calibration_v2_t20_comparable(v_target_norm->'product_leave_in_fit_specs'->col)
    ) THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 would change the fit row: %', v_key;
    END IF;
    -- ... the eligibility set is unchanged (no delete, no insert — ever), ...
    IF public.leave_in_calibration_normalize_target(
         pg_catalog.jsonb_build_object('product_leave_in_eligibility', v_item->'projected_eligibility')
       )->'product_leave_in_eligibility'
       IS DISTINCT FROM v_target_norm->'product_leave_in_eligibility' THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 would change the eligibility set: %', v_key;
    END IF;
    -- ... and the thicknesses are unchanged.
    IF public.leave_in_calibration_v2_t20_comparable(v_item->'projected_suitable_thicknesses')
       IS DISTINCT FROM
       public.leave_in_calibration_v2_t20_comparable(v_target_norm#>'{products,suitable_thicknesses}') THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 would change suitable_thicknesses: %', v_key;
    END IF;

    -- The exact state the apply intends to leave: the pinned snapshot with only
    -- the declared spec columns replaced.
    v_expected := v_target_norm;
    FOREACH v_column IN ARRAY v_changed LOOP
      v_expected := pg_catalog.jsonb_set(
        v_expected,
        ARRAY['product_leave_in_specs', v_column],
        public.leave_in_calibration_v2_t20_comparable(v_projected->v_column)
      );
    END LOOP;

    SELECT applied.* INTO v_existing
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch_id AND applied.product_key = v_key;

    IF FOUND THEN
      -- Replay: re-assert the live state and write nothing.
      IF v_existing.batch_fingerprint IS DISTINCT FROM v_batch_fingerprint
         OR v_existing.content_fingerprint IS DISTINCT FROM v_content_fingerprint
         OR v_existing.product_id IS DISTINCT FROM v_pid
         OR v_existing.reviewed_by IS DISTINCT FROM 'nick' THEN
        RAISE EXCEPTION 'leave-in calibration v2-t20 ledger conflicts with retry: %', v_key;
      END IF;
      v_live := public.leave_in_calibration_current_target(v_pid);
      IF v_live IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'leave-in calibration v2-t20 conflicting or partial retry: %', v_key;
      END IF;
      applied_product_key := v_key;
      applied_product_id := v_pid;
      applied_changed_columns := v_changed;
      applied_replay := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Drift guard: live rows must still be exactly the reviewed snapshot.
    v_live := public.leave_in_calibration_current_target(v_pid);
    IF v_live IS DISTINCT FROM v_target_norm THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 target drifted since review: %', v_key;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.product_leave_in_specs spec
      WHERE spec.product_id = v_pid AND spec.heat_protection_max_c IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 refuses a row that still carries heat_protection_max_c (AD-6): %', v_key;
    END IF;

    SELECT pg_catalog.count(*) INTO v_eligibility_before
    FROM public.product_leave_in_eligibility eligibility
    WHERE eligibility.product_id = v_pid;

    -- The only write: the declared columns of the one spec row.
    UPDATE public.product_leave_in_specs spec SET
      care_direction = CASE WHEN 'care_direction' = ANY (v_changed)
        THEN v_projected->>'care_direction' ELSE spec.care_direction END,
      care_benefits = CASE WHEN 'care_benefits' = ANY (v_changed)
        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_projected->'care_benefits'))
        ELSE spec.care_benefits END,
      functional_benefits = CASE WHEN 'functional_benefits' = ANY (v_changed)
        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_projected->'functional_benefits'))
        ELSE spec.functional_benefits END
    WHERE spec.product_id = v_pid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 updated % spec rows: %', v_rows, v_key;
    END IF;

    -- Self-verification. Eligibility first, so its invariant gets its own error.
    SELECT pg_catalog.count(*) INTO v_count
    FROM public.product_leave_in_eligibility eligibility
    WHERE eligibility.product_id = v_pid;
    v_live := public.leave_in_calibration_current_target(v_pid);
    IF v_count IS DISTINCT FROM v_eligibility_before
       OR v_live->'product_leave_in_eligibility'
          IS DISTINCT FROM v_target_norm->'product_leave_in_eligibility' THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 eligibility changed during apply: %', v_key;
    END IF;
    IF v_live IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 post-write state does not match the batch: %', v_key;
    END IF;
    -- Stored element order of the written arrays is the projection's own order.
    IF EXISTS (
      SELECT 1 FROM public.product_leave_in_specs spec
      WHERE spec.product_id = v_pid
        AND (('care_benefits' = ANY (v_changed)
               AND pg_catalog.to_jsonb(spec.care_benefits) IS DISTINCT FROM v_projected->'care_benefits')
          OR ('functional_benefits' = ANY (v_changed)
               AND pg_catalog.to_jsonb(spec.functional_benefits) IS DISTINCT FROM v_projected->'functional_benefits')
          OR spec.heat_protection_max_c IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'leave-in calibration v2-t20 written arrays do not match the projection: %', v_key;
    END IF;

    INSERT INTO public.catalog_enrichment_applied_items (
      batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
    ) VALUES (
      v_batch_id, v_key, v_batch_fingerprint, v_content_fingerprint, v_pid, 'nick'
    );

    applied_product_key := v_key;
    applied_product_id := v_pid;
    applied_changed_columns := v_changed;
    applied_replay := false;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v2_t20(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v2_t20(text, text, text)
  TO service_role;
