-- A product draft is derived from the plan's current refined need.  The
-- parent-plan lock makes that relationship a single CAS boundary with Stage 2
-- refinement completion, so an in-flight Stage 3 save cannot revive an old
-- source after the current pointer advances.
CREATE OR REPLACE FUNCTION public.personal_plan_save_product_draft(
  p_user_id uuid,
  p_draft_id uuid,
  p_expected_revision bigint,
  p_pass text,
  p_cursor jsonb,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan_id uuid;
  v_plan public.personal_plans%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
BEGIN
  IF p_pass NOT IN ('product_capture', 'product_decisions', 'ready_for_routine')
     OR pg_catalog.jsonb_typeof(p_cursor) <> 'object'
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  -- Read the immutable parent identity before taking the shared plan lock.
  -- Refinement completion locks the plan first, so we use the same lock order
  -- once the draft's parent has been identified.
  SELECT personal_plan_id INTO v_plan_id
    FROM public.personal_plan_product_drafts
    WHERE id=p_draft_id AND user_id=p_user_id;
  IF v_plan_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  SELECT * INTO v_plan
    FROM public.personal_plans
    WHERE id=v_plan_id AND user_id=p_user_id
    FOR UPDATE;
  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE id=p_draft_id
      AND user_id=p_user_id
      AND personal_plan_id=v_plan.id
    FOR UPDATE;
  IF v_plan.id IS NULL OR v_draft.id IS NULL OR v_draft.status <> 'active' THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  IF v_draft.refined_need_version_id IS DISTINCT FROM v_plan.current_refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  IF v_draft.revision <> p_expected_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'outcome','revision_conflict',
      'currentRevision',v_draft.revision,
      'draft',pg_catalog.to_jsonb(v_draft)
    );
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET pass=p_pass,
         cursor=p_cursor,
         payload=p_payload,
         revision=revision+1,
         updated_at=pg_catalog.now()
   WHERE id=v_draft.id
   RETURNING * INTO v_draft;
  RETURN pg_catalog.jsonb_build_object('outcome','saved','draft',pg_catalog.to_jsonb(v_draft));
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) TO service_role;
;
