-- Stage-3 need revisions are service-authored semantic decisions. This is
-- additive: earlier constraints/RPC definitions remain historical evidence.
ALTER TABLE public.personal_plan_product_drafts
  DROP CONSTRAINT IF EXISTS personal_plan_product_drafts_pass_check;
ALTER TABLE public.personal_plan_product_drafts
  ADD CONSTRAINT personal_plan_product_drafts_pass_check
  CHECK (pass IN ('product_capture', 'need_revision_review', 'product_decisions', 'ready_for_routine'));

CREATE OR REPLACE FUNCTION public.personal_plan_save_product_draft(
  p_user_id uuid, p_draft_id uuid, p_expected_revision bigint, p_pass text, p_cursor jsonb, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan_id uuid; v_plan public.personal_plans%ROWTYPE; v_draft public.personal_plan_product_drafts%ROWTYPE;
BEGIN
  IF p_pass IS NULL OR p_pass NOT IN ('product_capture','need_revision_review','product_decisions','ready_for_routine')
     OR pg_catalog.jsonb_typeof(p_cursor) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
  SELECT personal_plan_id INTO v_plan_id FROM public.personal_plan_product_drafts WHERE id=p_draft_id AND user_id=p_user_id;
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=v_plan_id AND user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_draft FROM public.personal_plan_product_drafts WHERE id=p_draft_id AND user_id=p_user_id AND personal_plan_id=v_plan.id FOR UPDATE;
  IF v_plan.id IS NULL OR v_draft.id IS NULL OR v_draft.status IS DISTINCT FROM 'active' THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
  IF v_draft.refined_need_version_id IS DISTINCT FROM v_plan.current_refined_need_version_id THEN RETURN pg_catalog.jsonb_build_object('outcome','stale_source'); END IF;
  IF v_draft.revision IS DISTINCT FROM p_expected_revision THEN RETURN pg_catalog.jsonb_build_object('outcome','revision_conflict','draft',pg_catalog.to_jsonb(v_draft)); END IF;
  UPDATE public.personal_plan_product_drafts SET pass=p_pass,cursor=p_cursor,payload=p_payload,revision=revision+1,updated_at=pg_catalog.now() WHERE id=v_draft.id RETURNING * INTO v_draft;
  RETURN pg_catalog.jsonb_build_object('outcome','saved','draft',pg_catalog.to_jsonb(v_draft));
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_resolve_stage3_need_revision_v1(
  p_user_id uuid, p_draft_id uuid, p_expected_revision bigint, p_expected_proposal_fingerprint text,
  p_action text, p_pass text, p_cursor jsonb, p_category_authority_versions jsonb, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan_id uuid; v_plan public.personal_plans%ROWTYPE; v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_base public.personal_plan_need_versions%ROWTYPE; v_need_id uuid; v_authority jsonb; v_proposed jsonb;
  v_input_hash text; v_computation_version text; v_input_snapshot jsonb;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('accept','reject')
     OR p_pass IS DISTINCT FROM 'product_decisions'
     OR p_expected_proposal_fingerprint IS NULL
     OR p_expected_proposal_fingerprint !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_cursor) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  SELECT personal_plan_id INTO v_plan_id FROM public.personal_plan_product_drafts WHERE id=p_draft_id AND user_id=p_user_id;
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=v_plan_id AND user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_draft FROM public.personal_plan_product_drafts WHERE id=p_draft_id AND user_id=p_user_id AND personal_plan_id=v_plan.id FOR UPDATE;
  IF v_plan.id IS NULL OR v_draft.id IS NULL OR v_draft.status IS DISTINCT FROM 'active' THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
  IF v_draft.refined_need_version_id IS DISTINCT FROM v_plan.current_refined_need_version_id THEN RETURN pg_catalog.jsonb_build_object('outcome','stale_source'); END IF;
  IF v_draft.revision IS DISTINCT FROM p_expected_revision THEN RETURN pg_catalog.jsonb_build_object('outcome','revision_conflict','draft',pg_catalog.to_jsonb(v_draft)); END IF;
  v_authority := v_draft.payload->'inventoryAuthority';
  IF v_draft.pass IS DISTINCT FROM 'need_revision_review'
     OR pg_catalog.jsonb_typeof(v_authority) IS DISTINCT FROM 'object'
     OR v_authority->>'status' IS DISTINCT FROM 'pending'
     OR v_authority->>'proposalFingerprint' IS DISTINCT FROM p_expected_proposal_fingerprint
     OR v_authority->>'stage2RefinedNeedVersionId' IS DISTINCT FROM v_draft.refined_need_version_id::text THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  IF p_action = 'accept' THEN
    v_proposed := v_authority->'proposedOutputSnapshot';
    v_input_hash := v_authority->>'proposedInputHash';
    v_computation_version := v_proposed->>'computationVersion';
    SELECT * INTO v_base FROM public.personal_plan_need_versions WHERE id=v_draft.refined_need_version_id AND user_id=p_user_id AND personal_plan_id=v_plan.id AND kind='refined';
    IF v_base.id IS NULL OR v_base.parent_need_version_id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
    v_input_snapshot := pg_catalog.jsonb_build_object(
      'computationVersion', v_computation_version,
      'refinedInputHash', v_base.output_snapshot->>'inputHash',
      'inventorySnapshotFingerprint', v_authority->>'inventorySnapshotFingerprint',
      'decisions', v_proposed->'decisions',
      'coverage', v_proposed->'coverage'
    );
    IF pg_catalog.jsonb_typeof(v_proposed) IS DISTINCT FROM 'object'
       OR v_input_hash IS NULL OR v_input_hash !~ '^[0-9a-f]{64}$'
       OR v_computation_version IS DISTINCT FROM 'stage3.product_load_refined_snapshot.v1'
       OR v_base.output_snapshot->>'inputHash' IS NULL
       OR v_base.output_snapshot->>'inputHash' !~ '^[0-9a-f]{64}$'
       OR pg_catalog.jsonb_typeof(v_proposed->'decisions') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_typeof(v_proposed->'coverage') IS DISTINCT FROM 'array'
       THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
    INSERT INTO public.personal_plan_need_versions(user_id,personal_plan_id,kind,parent_need_version_id,schema_version,computation_version,input_hash,input_snapshot,output_snapshot)
    VALUES(p_user_id,v_plan.id,'refined',v_base.parent_need_version_id,v_base.schema_version,v_computation_version,v_input_hash,v_input_snapshot,v_proposed)
    ON CONFLICT (personal_plan_id,parent_need_version_id,input_hash) WHERE kind='refined' DO NOTHING RETURNING id INTO v_need_id;
    IF v_need_id IS NULL THEN SELECT id INTO v_need_id FROM public.personal_plan_need_versions WHERE personal_plan_id=v_plan.id AND parent_need_version_id=v_base.parent_need_version_id AND kind='refined' AND input_hash=v_input_hash; END IF;
    UPDATE public.personal_plans SET current_refined_need_version_id=v_need_id,revision=revision+1 WHERE id=v_plan.id;
    PERFORM public.personal_plan_enqueue_routine_source_change(p_user_id,v_plan.id,'refined_need',v_need_id::text);
    UPDATE public.personal_plan_product_drafts SET status='stale',updated_at=pg_catalog.now() WHERE personal_plan_id=v_plan.id AND user_id=p_user_id AND status='active' AND id <> v_draft.id;
    p_payload := pg_catalog.jsonb_set(pg_catalog.jsonb_set(p_payload,'{refinedVersionId}',pg_catalog.to_jsonb(v_need_id::text),true),'{authoritySnapshot,refinedNeedVersionId}',pg_catalog.to_jsonb(v_need_id::text),true);
  ELSE
    v_need_id := v_draft.refined_need_version_id;
  END IF;
  UPDATE public.personal_plan_product_drafts SET refined_need_version_id=v_need_id,pass=p_pass,cursor=p_cursor,category_authority_versions=p_category_authority_versions,payload=p_payload,revision=revision+1,updated_at=pg_catalog.now() WHERE id=v_draft.id RETURNING * INTO v_draft;
  RETURN pg_catalog.jsonb_build_object('outcome','saved','draft',pg_catalog.to_jsonb(v_draft));
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.personal_plan_resolve_stage3_need_revision_v1(uuid,uuid,bigint,text,text,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_resolve_stage3_need_revision_v1(uuid,uuid,bigint,text,text,text,jsonb,jsonb,jsonb) TO service_role;
