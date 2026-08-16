-- Extend the guarded Stage-3 authority refresh for the later independent Scalp v3 release.
-- The earlier Shampoo and Mask transitions remain supported; captured products
-- are preserved and authority decisions are reopened.

CREATE OR REPLACE FUNCTION public.personal_plan_refresh_product_draft_authority(
  p_user_id uuid,
  p_draft_id uuid,
  p_expected_revision bigint,
  p_contract_version integer,
  p_category_authority_versions jsonb,
  p_pass text,
  p_cursor jsonb,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_personal_plan_id uuid;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_plan public.personal_plans%ROWTYPE;
  v_old_snapshot jsonb;
  v_new_snapshot jsonb;
  v_old_snapshot_versions jsonb;
  v_new_snapshot_versions jsonb;
  v_expected_current_versions jsonb := pg_catalog.jsonb_build_object(
    'shampoo', 'personal-plan.shampoo.v4',
    'conditioner', 'personal-plan.conditioner.v3',
    'leave_in', 'personal-plan.leave-in.v3',
    'heat_protectant', 'personal-plan.heat-protectant.v1',
    'oil', 'personal-plan.oil.v2',
    'mask', 'personal-plan.mask.v4',
    'scalp_care', 'personal-plan.scalp-care.v3',
    'dry_shampoo', 'personal-plan.dry-shampoo.v2',
    'bondbuilder', 'personal-plan.bondbuilder.v2',
    'deep_cleansing_shampoo', 'personal-plan.deep-cleansing.v2'
  );
  -- Keep the migration safe when it is applied immediately before the Scalp
  -- code deploy: the preceding Mask v4 runtime still derives Scalp v2 during
  -- that bounded deployment window.
  v_previous_current_versions jsonb := pg_catalog.jsonb_set(
    v_expected_current_versions,
    '{scalp_care}',
    pg_catalog.to_jsonb('personal-plan.scalp-care.v2'::text),
    false
  );
  -- Also admit the currently deployed pre-Mask runtime during any migration
  -- window. It derives Mask v3 and Scalp v2 and still sends a destructive
  -- fresh seed for its Shampoo-only refresh.
  v_pre_mask_current_versions jsonb := pg_catalog.jsonb_set(
    v_previous_current_versions,
    '{mask}',
    pg_catalog.to_jsonb('personal-plan.mask.v3'::text),
    false
  );
  v_normalized_old_snapshot_versions jsonb;
  v_normalized_old_draft_versions jsonb;
  v_normalized_old_snapshot jsonb;
  v_normalized_old_payload jsonb;
  v_changed_categories jsonb := '{}'::jsonb;
  v_changed_count integer := 0;
  v_category text;
  v_old_version text;
  v_new_version text;
  v_old_resolution jsonb;
  v_new_resolution jsonb;
  v_normalized_old_resolution jsonb;
  v_normalized_old_resolution_versions jsonb;
  v_normalized_old_requirements jsonb;
  v_old_cursor jsonb;
  v_matching_requirement_count integer;
  v_preceding_runtime_refresh boolean := false;
  v_effective_pass text;
  v_effective_cursor jsonb;
  v_effective_payload jsonb;
  v_effective_category_authority_versions jsonb;
BEGIN
  SELECT personal_plan_id INTO v_personal_plan_id
    FROM public.personal_plan_product_drafts
    WHERE id = p_draft_id
      AND user_id = p_user_id;

  IF v_personal_plan_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  SELECT * INTO v_plan
    FROM public.personal_plans
    WHERE id = v_personal_plan_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_plan.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE id = p_draft_id
      AND user_id = p_user_id
      AND personal_plan_id = v_plan.id
    FOR UPDATE;

  IF v_draft.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  IF v_draft.status = 'completed' THEN
    RETURN pg_catalog.jsonb_build_object(
      'outcome','completed',
      'draft',pg_catalog.to_jsonb(v_draft)
    );
  END IF;
  IF v_draft.status IS DISTINCT FROM 'active'
     OR v_draft.revision IS DISTINCT FROM p_expected_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'outcome','revision_conflict',
      'draft',pg_catalog.to_jsonb(v_draft)
    );
  END IF;
  IF p_contract_version IS DISTINCT FROM v_draft.contract_version
     OR p_contract_version <= 0
     OR p_pass NOT IN ('product_capture','need_revision_review','product_decisions','ready_for_routine')
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_cursor) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(v_draft.cursor) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288
     OR pg_catalog.jsonb_typeof(v_draft.category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(v_draft.payload) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(v_draft.payload->'authoritySnapshot') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload->'authoritySnapshot') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(v_draft.payload->'authoritySnapshot'->'authorityVersions') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload->'authoritySnapshot'->'authorityVersions') IS DISTINCT FROM 'object'
     OR p_payload->'decisions' IS DISTINCT FROM '[]'::jsonb
     OR p_payload->'completedDecisionKeys' IS DISTINCT FROM '[]'::jsonb
     OR p_cursor->'completedDecisionKeys' IS DISTINCT FROM '[]'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  v_old_snapshot := v_draft.payload->'authoritySnapshot';
  v_new_snapshot := p_payload->'authoritySnapshot';
  v_old_snapshot_versions := v_old_snapshot->'authorityVersions';
  v_new_snapshot_versions := v_new_snapshot->'authorityVersions';
  IF (v_new_snapshot_versions IS DISTINCT FROM v_expected_current_versions
      AND v_new_snapshot_versions IS DISTINCT FROM v_previous_current_versions
      AND v_new_snapshot_versions IS DISTINCT FROM v_pre_mask_current_versions)
     OR NOT (v_old_snapshot_versions @> v_draft.category_authority_versions)
     OR NOT (v_new_snapshot_versions @> p_category_authority_versions) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  v_normalized_old_snapshot_versions := v_old_snapshot_versions;
  v_normalized_old_draft_versions := v_draft.category_authority_versions;
  FOR v_category IN SELECT pg_catalog.jsonb_object_keys(v_old_snapshot_versions)
  LOOP
    v_old_version := v_old_snapshot_versions->>v_category;
    v_new_version := v_new_snapshot_versions->>v_category;
    IF v_old_version IS DISTINCT FROM v_new_version THEN
      IF NOT (
        (v_category = 'shampoo' AND v_old_version = 'personal-plan.shampoo.v3' AND v_new_version = 'personal-plan.shampoo.v4')
        OR (v_category = 'mask' AND v_old_version = 'personal-plan.mask.v3' AND v_new_version = 'personal-plan.mask.v4')
        OR (v_category = 'scalp_care' AND v_old_version = 'personal-plan.scalp-care.v2' AND v_new_version = 'personal-plan.scalp-care.v3')
      ) THEN
        RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
      END IF;
      v_changed_count := v_changed_count + 1;
      v_changed_categories := v_changed_categories || pg_catalog.jsonb_build_object(v_category, true);
      v_normalized_old_snapshot_versions := pg_catalog.jsonb_set(
        v_normalized_old_snapshot_versions,
        ARRAY[v_category],
        pg_catalog.to_jsonb(v_new_version),
        false
      );
      IF v_normalized_old_draft_versions ? v_category THEN
        IF v_normalized_old_draft_versions->>v_category IS DISTINCT FROM v_old_version
           OR p_category_authority_versions->>v_category IS DISTINCT FROM v_new_version THEN
          RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
        END IF;
        v_normalized_old_draft_versions := pg_catalog.jsonb_set(
          v_normalized_old_draft_versions,
          ARRAY[v_category],
          pg_catalog.to_jsonb(v_new_version),
          false
        );
      END IF;
    END IF;
  END LOOP;

  IF v_changed_count = 0
     OR v_normalized_old_snapshot_versions IS DISTINCT FROM v_new_snapshot_versions
     OR v_normalized_old_draft_versions IS DISTINCT FROM p_category_authority_versions THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  -- The currently deployed pre-Mask runtime sends a destructive fresh seed.
  -- Discard it only for its exact Shampoo-only transition; the Mask v4 runtime
  -- uses the strict preserving-payload path while Scalp remains v2.
  v_preceding_runtime_refresh :=
    v_new_snapshot_versions IS NOT DISTINCT FROM v_pre_mask_current_versions
    AND v_changed_count = 1
    AND v_changed_categories ? 'shampoo';

  v_normalized_old_snapshot := pg_catalog.jsonb_set(
    v_old_snapshot,
    '{authorityVersions}',
    v_normalized_old_snapshot_versions,
    false
  );
  IF v_normalized_old_snapshot IS DISTINCT FROM v_new_snapshot THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  v_old_resolution := v_draft.payload->'productLoadResolution';
  v_new_resolution := p_payload->'productLoadResolution';
  IF NOT v_preceding_runtime_refresh
     AND (v_old_resolution IS NULL) IS DISTINCT FROM (v_new_resolution IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  IF v_old_resolution IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(v_old_resolution) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_old_resolution->'authorityVersions') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_old_resolution->'requirements') IS DISTINCT FROM 'array' THEN
      RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
    END IF;
    IF NOT v_preceding_runtime_refresh
       AND (pg_catalog.jsonb_typeof(v_new_resolution) IS DISTINCT FROM 'object'
         OR pg_catalog.jsonb_typeof(v_new_resolution->'authorityVersions') IS DISTINCT FROM 'object'
         OR pg_catalog.jsonb_typeof(v_new_resolution->'requirements') IS DISTINCT FROM 'array') THEN
      RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
    END IF;
    v_normalized_old_resolution_versions := v_old_resolution->'authorityVersions';
    FOR v_category IN SELECT pg_catalog.jsonb_object_keys(v_normalized_old_resolution_versions)
    LOOP
      IF v_changed_categories ? v_category THEN
        IF v_normalized_old_resolution_versions->>v_category IS DISTINCT FROM v_old_snapshot_versions->>v_category
           OR (NOT v_preceding_runtime_refresh
             AND v_new_resolution->'authorityVersions'->>v_category IS DISTINCT FROM v_new_snapshot_versions->>v_category) THEN
          RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
        END IF;
        SELECT pg_catalog.count(*) INTO v_matching_requirement_count
        FROM pg_catalog.jsonb_array_elements(v_old_resolution->'requirements') AS entries(requirement)
        WHERE requirement->>'category' = v_category;
        IF v_matching_requirement_count IS DISTINCT FROM 1 THEN
          RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
        END IF;
        v_normalized_old_resolution_versions := pg_catalog.jsonb_set(
          v_normalized_old_resolution_versions,
          ARRAY[v_category],
          v_new_snapshot_versions->v_category,
          false
        );
      END IF;
    END LOOP;

    SELECT coalesce(
      pg_catalog.jsonb_agg(
        CASE
          WHEN v_changed_categories ? (requirement->>'category') THEN
            CASE
              WHEN requirement->>'authorityVersion' IS DISTINCT FROM v_old_snapshot_versions->>(requirement->>'category')
              THEN NULL
              ELSE pg_catalog.jsonb_set(
                requirement,
                '{authorityVersion}',
                v_new_snapshot_versions->(requirement->>'category'),
                false
              )
            END
          ELSE requirement
        END
        ORDER BY ordinal
      ),
      '[]'::jsonb
    ) INTO v_normalized_old_requirements
    FROM pg_catalog.jsonb_array_elements(v_old_resolution->'requirements') WITH ORDINALITY AS entries(requirement, ordinal);

    IF v_normalized_old_requirements @> '[null]'::jsonb THEN
      RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
    END IF;
    v_normalized_old_resolution := pg_catalog.jsonb_set(
      v_old_resolution,
      '{authorityVersions}',
      v_normalized_old_resolution_versions,
      false
    );
    v_normalized_old_resolution := pg_catalog.jsonb_set(
      v_normalized_old_resolution,
      '{requirements}',
      v_normalized_old_requirements,
      false
    );
    IF NOT v_preceding_runtime_refresh
       AND v_normalized_old_resolution IS DISTINCT FROM v_new_resolution THEN
      RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
    END IF;
  END IF;

  v_effective_pass := p_pass;
  IF v_preceding_runtime_refresh THEN
    v_effective_pass := CASE
      WHEN v_draft.pass = 'ready_for_routine' THEN 'product_decisions'
      ELSE v_draft.pass
    END;
  ELSE
    IF NOT (
      p_pass = v_draft.pass
      OR (v_draft.pass = 'ready_for_routine' AND p_pass = 'product_decisions')
    ) THEN
      RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
    END IF;
  END IF;
  v_old_cursor := pg_catalog.jsonb_set(v_draft.cursor, '{completedDecisionKeys}', '[]'::jsonb, true);
  v_effective_cursor := CASE
    WHEN v_preceding_runtime_refresh THEN v_old_cursor
    ELSE p_cursor
  END;
  IF NOT v_preceding_runtime_refresh AND v_old_cursor IS DISTINCT FROM p_cursor THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  v_normalized_old_payload := pg_catalog.jsonb_set(
    v_draft.payload,
    '{authoritySnapshot}',
    v_normalized_old_snapshot,
    false
  );
  v_normalized_old_payload := pg_catalog.jsonb_set(
    v_normalized_old_payload,
    '{authorityVersions}',
    v_normalized_old_draft_versions,
    false
  );
  v_normalized_old_payload := pg_catalog.jsonb_set(
    v_normalized_old_payload,
    '{decisions}',
    '[]'::jsonb,
    true
  );
  v_normalized_old_payload := pg_catalog.jsonb_set(
    v_normalized_old_payload,
    '{completedDecisionKeys}',
    '[]'::jsonb,
    true
  );
  v_normalized_old_payload := pg_catalog.jsonb_set(
    v_normalized_old_payload,
    '{pass}',
    pg_catalog.to_jsonb(v_effective_pass),
    true
  );
  IF v_old_resolution IS NOT NULL THEN
    v_normalized_old_payload := pg_catalog.jsonb_set(
      v_normalized_old_payload,
      '{productLoadResolution}',
      v_normalized_old_resolution,
      false
    );
  END IF;
  IF NOT v_preceding_runtime_refresh
     AND v_normalized_old_payload IS DISTINCT FROM p_payload THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  v_effective_payload := CASE
    WHEN v_preceding_runtime_refresh THEN v_normalized_old_payload
    ELSE p_payload
  END;
  v_effective_category_authority_versions := CASE
    WHEN v_preceding_runtime_refresh THEN v_normalized_old_draft_versions
    ELSE p_category_authority_versions
  END;

  IF v_plan.current_refined_need_version_id IS DISTINCT FROM v_draft.refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET contract_version = p_contract_version,
         category_authority_versions = v_effective_category_authority_versions,
         pass = v_effective_pass,
         cursor = v_effective_cursor,
         payload = v_effective_payload,
         revision = revision + 1,
         updated_at = pg_catalog.now()
   WHERE id = p_draft_id
     AND user_id = p_user_id
     AND personal_plan_id = v_plan.id
     AND status = 'active'
     AND revision = p_expected_revision
   RETURNING * INTO v_draft;

  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_product_drafts
      WHERE id = p_draft_id
        AND user_id = p_user_id;
    RETURN pg_catalog.jsonb_build_object(
      'outcome','revision_conflict',
      'draft',pg_catalog.to_jsonb(v_draft)
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'outcome','saved',
    'draft',pg_catalog.to_jsonb(v_draft)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_refresh_product_draft_authority(uuid,uuid,bigint,integer,jsonb,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_refresh_product_draft_authority(uuid,uuid,bigint,integer,jsonb,text,jsonb,jsonb) TO service_role;
