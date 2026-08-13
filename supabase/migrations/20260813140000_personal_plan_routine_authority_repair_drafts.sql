-- Legacy Stage-4 category-authority repair drafts.
-- Completed historical Stage-3 drafts remain immutable; repair creates a new
-- active continuation from a frozen active Routine/source draft when Stage 4
-- detects that the Routine category order no longer matches the refined source.

ALTER TABLE public.personal_plan_product_drafts
  ADD COLUMN IF NOT EXISTS draft_origin text NOT NULL DEFAULT 'stage3_entry',
  ADD COLUMN IF NOT EXISTS repair_source_routine_version_id uuid,
  ADD COLUMN IF NOT EXISTS repair_source_product_draft_id uuid;

ALTER TABLE public.personal_plan_product_drafts
  DROP CONSTRAINT IF EXISTS personal_plan_product_drafts_origin_check,
  ADD CONSTRAINT personal_plan_product_drafts_origin_check
    CHECK (draft_origin IN ('stage3_entry', 'routine_authority_repair'));

ALTER TABLE public.personal_plan_product_drafts
  DROP CONSTRAINT IF EXISTS personal_plan_product_drafts_repair_source_check,
  ADD CONSTRAINT personal_plan_product_drafts_repair_source_check
    CHECK (
      (draft_origin = 'stage3_entry'
        AND repair_source_routine_version_id IS NULL
        AND repair_source_product_draft_id IS NULL)
      OR
      (draft_origin = 'routine_authority_repair'
        AND repair_source_routine_version_id IS NOT NULL
        AND repair_source_product_draft_id IS NOT NULL)
    );

ALTER TABLE public.personal_plan_product_drafts
  DROP CONSTRAINT IF EXISTS personal_plan_product_drafts_repair_routine_fkey,
  ADD CONSTRAINT personal_plan_product_drafts_repair_routine_fkey
    FOREIGN KEY (repair_source_routine_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_routine_versions(id, user_id, personal_plan_id)
    ON DELETE RESTRICT;

ALTER TABLE public.personal_plan_product_drafts
  DROP CONSTRAINT IF EXISTS personal_plan_product_drafts_repair_draft_fkey,
  ADD CONSTRAINT personal_plan_product_drafts_repair_draft_fkey
    FOREIGN KEY (repair_source_product_draft_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_product_drafts(id, user_id, personal_plan_id)
    ON DELETE RESTRICT;

DROP INDEX IF EXISTS public.personal_plan_product_drafts_current_key;
CREATE UNIQUE INDEX personal_plan_product_drafts_current_key
  ON public.personal_plan_product_drafts(personal_plan_id, refined_need_version_id)
  WHERE status = 'active';

DROP INDEX IF EXISTS public.personal_plan_product_drafts_routine_repair_active_key;
CREATE UNIQUE INDEX personal_plan_product_drafts_routine_repair_key
  ON public.personal_plan_product_drafts(personal_plan_id, repair_source_routine_version_id)
  WHERE draft_origin = 'routine_authority_repair';

CREATE INDEX IF NOT EXISTS personal_plan_product_drafts_repair_source_idx
  ON public.personal_plan_product_drafts(repair_source_product_draft_id)
  WHERE repair_source_product_draft_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_load_product_draft(
  p_user_id uuid,
  p_personal_plan_id uuid,
  p_refined_need_version_id uuid,
  p_contract_version integer,
  p_category_authority_versions jsonb,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_plan
    FROM public.personal_plans
    WHERE id = p_personal_plan_id AND user_id = p_user_id
    FOR UPDATE;
  IF v_plan.id IS NULL
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM p_refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  IF p_contract_version <= 0
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET status = 'stale', updated_at = pg_catalog.now()
   WHERE personal_plan_id = p_personal_plan_id
     AND user_id = p_user_id
     AND status = 'active'
     AND refined_need_version_id IS DISTINCT FROM p_refined_need_version_id;

  -- Repair provenance is terminal. Once a continuation exists for this frozen
  -- Routine, a later call must never recreate it after completion or staling.
  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
      AND refined_need_version_id = p_refined_need_version_id
      AND status = 'active'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;
  IF v_draft.id IS NOT NULL THEN
    RETURN pg_catalog.to_jsonb(v_draft);
  END IF;

  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
      AND refined_need_version_id = p_refined_need_version_id
      AND status = 'completed'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;
  IF v_draft.id IS NOT NULL THEN
    RETURN pg_catalog.to_jsonb(v_draft);
  END IF;

  INSERT INTO public.personal_plan_product_drafts(
    user_id, personal_plan_id, refined_need_version_id, contract_version,
    category_authority_versions, draft_origin, pass, cursor, payload
  ) VALUES (
    p_user_id, p_personal_plan_id, p_refined_need_version_id, p_contract_version,
    p_category_authority_versions, 'stage3_entry',
    COALESCE(p_payload->>'pass', 'product_capture'),
    pg_catalog.jsonb_build_object(
      'categoryCursor', p_payload->'categoryCursor',
      'completedCaptureCategories', COALESCE(p_payload->'completedCaptureCategories', '[]'::jsonb),
      'completedDecisionKeys', COALESCE(p_payload->'completedDecisionKeys', '[]'::jsonb)
    ),
    p_payload
  )
  ON CONFLICT (personal_plan_id, refined_need_version_id) WHERE status = 'active'
  DO NOTHING
  RETURNING * INTO v_draft;

  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_product_drafts
      WHERE personal_plan_id = p_personal_plan_id
        AND user_id = p_user_id
        AND refined_need_version_id = p_refined_need_version_id
        AND status = 'active'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1;
  END IF;
  RETURN pg_catalog.to_jsonb(v_draft);
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_load_routine_authority_repair_draft(
  p_user_id uuid,
  p_personal_plan_id uuid,
  p_routine_version_id uuid,
  p_contract_version integer,
  p_category_authority_versions jsonb,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_routine public.personal_plan_routine_versions%ROWTYPE;
  v_source_draft public.personal_plan_product_drafts%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_plan
    FROM public.personal_plans
    WHERE id = p_personal_plan_id AND user_id = p_user_id
    FOR UPDATE;
  SELECT * INTO v_routine
    FROM public.personal_plan_routine_versions
    WHERE id = p_routine_version_id
      AND personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
    FOR SHARE;

  IF v_plan.id IS NULL
     OR v_routine.id IS NULL
     OR v_plan.active_routine_version_id IS DISTINCT FROM v_routine.id
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM v_routine.source_refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;

  SELECT * INTO v_source_draft
    FROM public.personal_plan_product_drafts
    WHERE id = v_routine.source_product_draft_id
      AND personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
      AND refined_need_version_id = v_routine.source_refined_need_version_id
      AND status = 'completed'
    FOR SHARE;
  IF v_source_draft.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  IF p_contract_version <= 0
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR p_payload->>'pass' IS DISTINCT FROM 'product_capture'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE personal_plan_id = p_personal_plan_id
      AND user_id = p_user_id
      AND draft_origin = 'routine_authority_repair'
      AND repair_source_routine_version_id = v_routine.id
    FOR UPDATE;
  IF v_draft.id IS NOT NULL THEN
    IF v_draft.status = 'active' THEN
      RETURN pg_catalog.jsonb_build_object('outcome','ready','draft',pg_catalog.to_jsonb(v_draft));
    END IF;
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.personal_plan_product_drafts
      WHERE personal_plan_id = p_personal_plan_id
        AND user_id = p_user_id
        AND refined_need_version_id = v_routine.source_refined_need_version_id
        AND status = 'active'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','active_draft_exists');
  END IF;

  INSERT INTO public.personal_plan_product_drafts(
    user_id, personal_plan_id, refined_need_version_id, contract_version,
    category_authority_versions, draft_origin, repair_source_routine_version_id,
    repair_source_product_draft_id, pass, cursor, payload
  ) VALUES (
    p_user_id, p_personal_plan_id, v_routine.source_refined_need_version_id, p_contract_version,
    p_category_authority_versions, 'routine_authority_repair', v_routine.id,
    v_source_draft.id, 'product_capture',
    pg_catalog.jsonb_build_object(
      'categoryCursor', p_payload->'categoryCursor',
      'completedCaptureCategories', COALESCE(p_payload->'completedCaptureCategories', '[]'::jsonb),
      'completedDecisionKeys', COALESCE(p_payload->'completedDecisionKeys', '[]'::jsonb)
    ),
    p_payload
  )
  ON CONFLICT (personal_plan_id, repair_source_routine_version_id)
    WHERE draft_origin = 'routine_authority_repair'
  DO NOTHING
  RETURNING * INTO v_draft;

  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_product_drafts
      WHERE personal_plan_id = p_personal_plan_id
        AND user_id = p_user_id
        AND draft_origin = 'routine_authority_repair'
        AND repair_source_routine_version_id = v_routine.id
      LIMIT 1;
  END IF;

  IF v_draft.id IS NULL OR v_draft.status IS DISTINCT FROM 'active' THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  RETURN pg_catalog.jsonb_build_object('outcome','ready','draft',pg_catalog.to_jsonb(v_draft));
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_create_or_load_product_draft(uuid,uuid,uuid,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_create_or_load_routine_authority_repair_draft(uuid,uuid,uuid,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_load_product_draft(uuid,uuid,uuid,integer,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_load_routine_authority_repair_draft(uuid,uuid,uuid,integer,jsonb,jsonb) TO service_role;
