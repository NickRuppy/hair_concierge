-- Refresh only an active same-source Stage-3 continuation when a category
-- authority version changes. Completed drafts and their receipts stay frozen.

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
  v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_plan public.personal_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE id = p_draft_id
      AND user_id = p_user_id
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
  IF p_contract_version <= 0
     OR p_pass NOT IN ('product_capture','need_revision_review','product_decisions','ready_for_routine')
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_cursor) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  SELECT * INTO v_plan
    FROM public.personal_plans
    WHERE id = v_draft.personal_plan_id
      AND user_id = p_user_id
    FOR SHARE;
  IF v_plan.id IS NULL
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM v_draft.refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET contract_version = p_contract_version,
         category_authority_versions = p_category_authority_versions,
         pass = p_pass,
         cursor = p_cursor,
         payload = p_payload,
         revision = revision + 1,
         updated_at = pg_catalog.now()
   WHERE id = p_draft_id
     AND user_id = p_user_id
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
