BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.personal_plans
  ADD COLUMN IF NOT EXISTS legacy_prefill_v1 jsonb
    CHECK (legacy_prefill_v1 IS NULL OR pg_catalog.jsonb_typeof(legacy_prefill_v1) = 'object');

COMMENT ON COLUMN public.personal_plans.legacy_prefill_v1 IS
  'Namespaced one-time receipts for regular-quiz-to-Personal-Plan optional prefill. Stage 3 stores stage3Inventory after opening the products module so legacy user_product_usage rows are never re-imported after the buyer edits/removes them.';

CREATE OR REPLACE FUNCTION public.personal_plan_open_optional_inventory_v1(
  p_user_id uuid,
  p_personal_plan_id uuid,
  p_refined_need_version_id uuid,
  p_contract_version integer,
  p_category_authority_versions jsonb,
  p_payload jsonb,
  p_exact_inventory jsonb,
  p_source_fingerprint text,
  p_source_ids jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_user_product public.user_products%ROWTYPE;
  v_item jsonb;
  v_seeded_products jsonb := '[]'::jsonb;
  v_seeded_usage_ids jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_receipt jsonb;
  v_outcome text := 'nothing_usable';
  v_opened_at timestamptz := pg_catalog.now();
  v_current_admission_source_id uuid;
BEGIN
  SELECT *
    INTO v_plan
    FROM public.personal_plans
    WHERE id = p_personal_plan_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_plan.id IS NULL
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM p_refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'stale_source');
  END IF;

  IF v_plan.enrollment_purchase_source_id IS NULL
     OR pg_catalog.jsonb_typeof(COALESCE(v_plan.legacy_prefill_v1, '{}'::jsonb)) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  SELECT authority.admission_source_id
    INTO v_current_admission_source_id
    FROM private.personal_plan_current_paid_migration_authority(p_user_id) AS authority;

  IF v_current_admission_source_id IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM public.personal_plan_migration_enrollments AS enrollment
        WHERE enrollment.id = v_plan.enrollment_purchase_source_id
          AND enrollment.user_id = p_user_id
          AND enrollment.status = 'ready'
     ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.personal_plan_refinement_drafts refinement
      WHERE refinement.personal_plan_id = p_personal_plan_id
        AND refinement.user_id = p_user_id
        AND refinement.module_projections -> 'products' IS NOT NULL
        AND refinement.module_projections #>> '{products,needVersionId}' = p_refined_need_version_id::text
        AND COALESCE((refinement.module_projections #>> '{products,stage3Handoff}')::boolean, false) = true
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'stale_source');
  END IF;

  IF p_contract_version <= 0
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(COALESCE(p_exact_inventory, '[]'::jsonb)) IS DISTINCT FROM 'array'
     OR p_source_fingerprint IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_source_fingerprint)) = 0
     OR pg_catalog.jsonb_typeof(COALESCE(p_source_ids, '[]'::jsonb)) IS DISTINCT FROM 'array'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET status = 'stale', updated_at = pg_catalog.now()
   WHERE personal_plan_id = p_personal_plan_id
     AND user_id = p_user_id
     AND status = 'active'
     AND refined_need_version_id IS DISTINCT FROM p_refined_need_version_id;

  SELECT *
    INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
      AND refined_need_version_id = p_refined_need_version_id
      AND status IN ('active', 'completed')
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;

  IF v_draft.id IS NOT NULL THEN
    IF NOT COALESCE(v_plan.legacy_prefill_v1, '{}'::jsonb) ? 'stage3Inventory' THEN
      UPDATE public.personal_plans
         SET legacy_prefill_v1 = COALESCE(legacy_prefill_v1, '{}'::jsonb)
           || pg_catalog.jsonb_build_object(
             'stage3Inventory',
             pg_catalog.jsonb_build_object(
               'schemaVersion', 1,
               'outcome', 'skipped_existing_state',
               'draftId', v_draft.id,
               'appliedAt', v_opened_at,
               'sourceFingerprint', p_source_fingerprint,
               'sourceIds', p_source_ids,
               'exactUsageIds', '[]'::jsonb
             )
           )
       WHERE id = p_personal_plan_id
         AND user_id = p_user_id;
    END IF;
    RETURN pg_catalog.jsonb_build_object('outcome', 'ready', 'draft', pg_catalog.to_jsonb(v_draft));
  END IF;

  v_receipt := COALESCE(v_plan.legacy_prefill_v1, '{}'::jsonb);
  v_payload := p_payload;

  IF NOT v_receipt ? 'stage3Inventory' THEN
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_exact_inventory, '[]'::jsonb))
    LOOP
      IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object'
         OR NOT (v_item ? 'usageId')
         OR NOT (v_item ? 'productId')
         OR NOT (v_item ? 'category')
         OR NOT (v_item ? 'frequencyRange') THEN
        CONTINUE;
      END IF;

      SELECT *
        INTO v_product
        FROM public.products product
        WHERE product.id = (v_item ->> 'productId')::uuid
          AND product.category_key = v_item ->> 'category'
          AND product.is_active = true
          AND product.lifecycle_status = 'active'
          AND NOT EXISTS (
            SELECT 1
              FROM public.personal_plan_product_search_dispositions disposition
              WHERE disposition.product_id = product.id
          )
          AND (
            product.origin = 'curated'
            OR EXISTS (
              SELECT 1
                FROM public.user_products owned
                WHERE owned.user_id = p_user_id
                  AND owned.category = product.category_key
                  AND owned.catalog_product_id = product.id
                  AND owned.identity_status = 'matched'
                  AND owned.ownership_status = 'owned'
            )
          )
        FOR SHARE;

      IF v_product.id IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO public.user_products(
        user_id, category, catalog_product_id, brand_text, product_name_text,
        identity_status, ownership_status, intake_source
      ) VALUES (
        p_user_id, v_product.category_key, v_product.id, v_product.brand, v_product.name,
        'matched', 'owned', 'existing_inventory'
      )
      ON CONFLICT (user_id, category, catalog_product_id)
        WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL
      DO UPDATE SET updated_at = pg_catalog.now()
      RETURNING * INTO v_user_product;

      v_seeded_products := v_seeded_products || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'capturedProductId', 'legacy-prefill:' || (v_item ->> 'usageId'),
          'userProductId', v_user_product.id::text,
          'identity', pg_catalog.jsonb_build_object(
            'kind', 'catalog_product',
            'productId', v_product.id::text,
            'displayName', COALESCE(NULLIF(v_item ->> 'displayName', ''), pg_catalog.concat_ws(' ', v_product.brand, v_product.name)),
            'category', v_product.category_key,
            'imageUrl', v_product.image_url
          ),
          'frequencyRange', v_item ->> 'frequencyRange',
          'ownership', 'owned',
          'source', 'existing_inventory'
        )
      );
      v_seeded_usage_ids := v_seeded_usage_ids || pg_catalog.jsonb_build_array(v_item ->> 'usageId');
    END LOOP;
  ELSE
    v_payload := v_payload - 'legacyPrefillHints';
  END IF;

  v_payload := v_payload || pg_catalog.jsonb_build_object('products', v_seeded_products);
  IF pg_catalog.jsonb_array_length(v_seeded_products) > 0 THEN
    v_outcome := 'imported';
  ELSIF (p_payload ? 'legacyPrefillHints')
        AND p_payload -> 'legacyPrefillHints' ? 'categories'
        AND p_payload #> '{legacyPrefillHints,categories}' <> '{}'::jsonb THEN
    v_outcome := 'hints_only';
  END IF;

  INSERT INTO public.personal_plan_product_drafts(
    user_id, personal_plan_id, refined_need_version_id, contract_version,
    category_authority_versions, draft_origin, pass, cursor, payload
  ) VALUES (
    p_user_id, p_personal_plan_id, p_refined_need_version_id, p_contract_version,
    p_category_authority_versions, 'stage3_entry',
    COALESCE(v_payload ->> 'pass', 'product_capture'),
    pg_catalog.jsonb_build_object(
      'categoryCursor', v_payload -> 'categoryCursor',
      'completedCaptureCategories', COALESCE(v_payload -> 'completedCaptureCategories', '[]'::jsonb),
      'completedDecisionKeys', COALESCE(v_payload -> 'completedDecisionKeys', '[]'::jsonb)
    ),
    v_payload
  )
  ON CONFLICT (personal_plan_id, refined_need_version_id) WHERE status = 'active'
  DO NOTHING
  RETURNING * INTO v_draft;

  IF v_draft.id IS NULL THEN
    SELECT *
      INTO v_draft
      FROM public.personal_plan_product_drafts
      WHERE personal_plan_id = p_personal_plan_id
        AND user_id = p_user_id
        AND refined_need_version_id = p_refined_need_version_id
        AND status = 'active'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
      FOR UPDATE;
  END IF;

  IF v_draft.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;

  IF NOT v_receipt ? 'stage3Inventory' THEN
    UPDATE public.personal_plans
       SET legacy_prefill_v1 = COALESCE(legacy_prefill_v1, '{}'::jsonb)
         || pg_catalog.jsonb_build_object(
           'stage3Inventory',
           pg_catalog.jsonb_build_object(
             'schemaVersion', 1,
             'outcome', v_outcome,
             'draftId', v_draft.id,
             'appliedAt', v_opened_at,
             'sourceFingerprint', p_source_fingerprint,
             'sourceIds', p_source_ids,
             'exactUsageIds', v_seeded_usage_ids
           )
         )
     WHERE id = p_personal_plan_id
       AND user_id = p_user_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object('outcome', 'ready', 'draft', pg_catalog.to_jsonb(v_draft));
END;
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_open_optional_inventory_v1(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_open_optional_inventory_v1(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,text,jsonb)
  TO service_role;

COMMIT;
