-- Personal Plan production foundation.  Stage-4 tables deliberately live in the
-- following migration so this file remains usable without a Routine compiler.

CREATE TABLE public.personal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_purchase_source_id uuid,
  current_initial_need_version_id uuid,
  current_refined_need_version_id uuid,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  source_revision bigint NOT NULL DEFAULT 0 CHECK (source_revision >= 0),
  last_evaluated_source_fingerprint text,
  last_rejected_auto_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE TABLE public.personal_plan_need_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial', 'refined')),
  parent_need_version_id uuid,
  prepared_artifact_source_id uuid,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  computation_version text NOT NULL CHECK (length(computation_version) > 0),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  input_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  FOREIGN KEY (personal_plan_id, user_id)
    REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_need_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  CHECK ((kind = 'initial' AND parent_need_version_id IS NULL)
      OR (kind = 'refined' AND parent_need_version_id IS NOT NULL))
);
CREATE UNIQUE INDEX personal_plan_need_versions_initial_input_key
  ON public.personal_plan_need_versions(personal_plan_id, input_hash) WHERE kind = 'initial';
CREATE UNIQUE INDEX personal_plan_need_versions_refined_input_key
  ON public.personal_plan_need_versions(personal_plan_id, parent_need_version_id, input_hash) WHERE kind = 'refined';

CREATE TABLE public.personal_plan_refinement_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  base_initial_need_version_id uuid NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_question_ids text[] NOT NULL DEFAULT '{}',
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'stale')),
  result_refined_need_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  FOREIGN KEY (personal_plan_id, user_id)
    REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (base_initial_need_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (result_refined_need_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  CHECK ((status = 'complete') = (result_refined_need_version_id IS NOT NULL))
);
CREATE UNIQUE INDEX personal_plan_refinement_drafts_open_key
  ON public.personal_plan_refinement_drafts(personal_plan_id, base_initial_need_version_id)
  WHERE status = 'in_progress';

CREATE TABLE public.user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL REFERENCES public.product_categories(key) ON DELETE RESTRICT,
  catalog_product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  brand_text text,
  product_name_text text,
  identity_status text NOT NULL DEFAULT 'text_only'
    CHECK (identity_status IN ('matched', 'pending_review', 'needs_more_info', 'text_only')),
  ownership_status text NOT NULL DEFAULT 'owned' CHECK (ownership_status IN ('owned', 'archived')),
  intake_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, category),
  CHECK ((identity_status = 'matched' AND catalog_product_id IS NOT NULL)
      OR (identity_status <> 'matched' AND catalog_product_id IS NULL)),
  -- Photo-first intake can create a durable pending identity before any label
  -- has been transcribed.  Resolved/live text-only rows still need an identity.
  CHECK (ownership_status = 'archived'
      OR identity_status IN ('pending_review', 'needs_more_info')
      OR brand_text IS NOT NULL OR product_name_text IS NOT NULL OR catalog_product_id IS NOT NULL)
);
CREATE UNIQUE INDEX user_products_live_catalog_identity_key
  ON public.user_products(user_id, category, catalog_product_id)
  WHERE ownership_status = 'owned' AND catalog_product_id IS NOT NULL;

CREATE TABLE public.personal_plan_product_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  refined_need_version_id uuid NOT NULL,
  contract_version integer NOT NULL CHECK (contract_version > 0),
  category_authority_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  pass text NOT NULL DEFAULT 'product_capture'
    CHECK (pass IN ('product_capture', 'product_decisions', 'ready_for_routine')),
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(payload::text) <= 524288),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stale')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  FOREIGN KEY (personal_plan_id, user_id)
    REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (refined_need_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX personal_plan_product_drafts_current_key
  ON public.personal_plan_product_drafts(personal_plan_id, refined_need_version_id)
  WHERE status <> 'stale';

CREATE TABLE public.personal_plan_portfolio_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  refined_need_version_id uuid NOT NULL,
  source_product_draft_id uuid NOT NULL,
  source_product_draft_revision bigint NOT NULL CHECK (source_product_draft_revision >= 0),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  category_authority_versions jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb NOT NULL CHECK (octet_length(snapshot::text) <= 524288),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  UNIQUE (source_product_draft_id),
  UNIQUE (personal_plan_id, refined_need_version_id, content_hash),
  FOREIGN KEY (personal_plan_id, user_id)
    REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (refined_need_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_product_draft_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_product_drafts(id, user_id, personal_plan_id) ON DELETE RESTRICT
);

ALTER TABLE public.personal_plans
  ADD CONSTRAINT personal_plans_initial_need_pointer_fkey
    FOREIGN KEY (current_initial_need_version_id, user_id, id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  ADD CONSTRAINT personal_plans_refined_need_pointer_fkey
    FOREIGN KEY (current_refined_need_version_id, user_id, id)
    REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT;

CREATE INDEX personal_plans_user_id_idx ON public.personal_plans(user_id);
CREATE INDEX personal_plan_need_versions_user_id_idx ON public.personal_plan_need_versions(user_id);
CREATE INDEX personal_plan_need_versions_plan_id_idx ON public.personal_plan_need_versions(personal_plan_id);
CREATE INDEX personal_plan_need_versions_parent_id_idx ON public.personal_plan_need_versions(parent_need_version_id) WHERE parent_need_version_id IS NOT NULL;
CREATE INDEX personal_plan_refinement_drafts_user_id_idx ON public.personal_plan_refinement_drafts(user_id);
CREATE INDEX personal_plan_refinement_drafts_plan_id_idx ON public.personal_plan_refinement_drafts(personal_plan_id);
CREATE INDEX personal_plan_refinement_drafts_base_id_idx ON public.personal_plan_refinement_drafts(base_initial_need_version_id);
CREATE INDEX personal_plan_refinement_drafts_result_id_idx ON public.personal_plan_refinement_drafts(result_refined_need_version_id) WHERE result_refined_need_version_id IS NOT NULL;
CREATE INDEX user_products_user_id_idx ON public.user_products(user_id);
CREATE INDEX user_products_owner_category_idx ON public.user_products(user_id, category)
  WHERE ownership_status = 'owned';
CREATE INDEX user_products_catalog_product_id_idx ON public.user_products(catalog_product_id) WHERE catalog_product_id IS NOT NULL;
CREATE INDEX personal_plan_product_drafts_user_id_idx ON public.personal_plan_product_drafts(user_id);
CREATE INDEX personal_plan_product_drafts_plan_id_idx ON public.personal_plan_product_drafts(personal_plan_id);
CREATE INDEX personal_plan_product_drafts_refined_id_idx ON public.personal_plan_product_drafts(refined_need_version_id);
CREATE INDEX personal_plan_portfolio_versions_user_id_idx ON public.personal_plan_portfolio_versions(user_id);
CREATE INDEX personal_plan_portfolio_versions_plan_id_idx ON public.personal_plan_portfolio_versions(personal_plan_id);
CREATE INDEX personal_plan_portfolio_versions_refined_id_idx ON public.personal_plan_portfolio_versions(refined_need_version_id);

CREATE OR REPLACE FUNCTION public.personal_plan_reject_immutable_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND OLD.user_id::text = pg_catalog.current_setting('app.personal_plan_erasure_user_id', true) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'personal plan version rows are immutable' USING ERRCODE = '22000';
END;
$$;
CREATE OR REPLACE FUNCTION public.personal_plan_validate_need_version_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent_kind text;
BEGIN
  IF NEW.kind = 'refined' THEN
    SELECT kind INTO parent_kind FROM public.personal_plan_need_versions
      WHERE id = NEW.parent_need_version_id AND user_id = NEW.user_id AND personal_plan_id = NEW.personal_plan_id;
    IF parent_kind IS DISTINCT FROM 'initial' THEN
      RAISE EXCEPTION 'refined need versions require an initial parent' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER personal_plan_need_versions_parent_guard
  BEFORE INSERT ON public.personal_plan_need_versions
  FOR EACH ROW EXECUTE FUNCTION public.personal_plan_validate_need_version_parent();

CREATE TRIGGER personal_plan_need_versions_immutable
  BEFORE UPDATE OR DELETE ON public.personal_plan_need_versions
  FOR EACH ROW EXECUTE FUNCTION public.personal_plan_reject_immutable_write();
CREATE TRIGGER personal_plan_portfolio_versions_immutable
  BEFORE UPDATE OR DELETE ON public.personal_plan_portfolio_versions
  FOR EACH ROW EXECUTE FUNCTION public.personal_plan_reject_immutable_write();

CREATE TRIGGER set_updated_at_personal_plans BEFORE UPDATE ON public.personal_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_personal_plan_refinement_drafts BEFORE UPDATE ON public.personal_plan_refinement_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_user_products BEFORE UPDATE ON public.user_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_personal_plan_product_drafts BEFORE UPDATE ON public.personal_plan_product_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service-only primitives keep the current heads and mutable draft revisions
-- inside the database; routes never update these pointers directly.
CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_initial_need(
  p_user_id uuid, p_enrollment_purchase_source_id uuid, p_prepared_artifact_source_id uuid,
  p_schema_version integer, p_computation_version text, p_input_hash text,
  p_input_snapshot jsonb, p_output_snapshot jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_need_id uuid; v_output_snapshot jsonb;
BEGIN
  INSERT INTO public.personal_plans(user_id,enrollment_purchase_source_id)
  VALUES(p_user_id,p_enrollment_purchase_source_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_plan FROM public.personal_plans WHERE user_id=p_user_id FOR UPDATE;
  IF v_plan.enrollment_purchase_source_id IS DISTINCT FROM p_enrollment_purchase_source_id THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','enrollment_mismatch');
  END IF;
  IF p_schema_version <= 0 OR p_computation_version='' OR p_input_hash !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_input_snapshot) <> 'object' OR pg_catalog.jsonb_typeof(p_output_snapshot) <> 'object' THEN
    RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_initial_need');
  END IF;
  INSERT INTO public.personal_plan_need_versions(user_id,personal_plan_id,kind,prepared_artifact_source_id,schema_version,computation_version,input_hash,input_snapshot,output_snapshot)
  VALUES(p_user_id,v_plan.id,'initial',p_prepared_artifact_source_id,p_schema_version,p_computation_version,p_input_hash,p_input_snapshot,p_output_snapshot)
  ON CONFLICT (personal_plan_id,input_hash) WHERE kind='initial' DO NOTHING RETURNING id INTO v_need_id;
  IF v_need_id IS NULL THEN SELECT id INTO v_need_id FROM public.personal_plan_need_versions WHERE personal_plan_id=v_plan.id AND kind='initial' AND input_hash=p_input_hash; END IF;
  IF v_plan.current_initial_need_version_id IS DISTINCT FROM v_need_id THEN
    UPDATE public.personal_plan_refinement_drafts
      SET status='stale', updated_at=pg_catalog.now()
      WHERE personal_plan_id=v_plan.id AND status='in_progress';
    UPDATE public.personal_plan_product_drafts
      SET status='stale', updated_at=pg_catalog.now()
      WHERE personal_plan_id=v_plan.id AND status='active';
    UPDATE public.personal_plans
      SET current_initial_need_version_id=v_need_id,
          current_refined_need_version_id=NULL,
          revision=revision+1
      WHERE id=v_plan.id;
  END IF;
  SELECT output_snapshot INTO v_output_snapshot
    FROM public.personal_plan_need_versions
    WHERE id=v_need_id AND user_id=p_user_id AND personal_plan_id=v_plan.id;
  RETURN jsonb_build_object(
    'outcome','completed',
    'personalPlanId',v_plan.id,
    'needVersionId',v_need_id,
    'outputSnapshot',v_output_snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_save_refinement_draft(
  p_user_id uuid, p_draft_id uuid, p_expected_revision bigint, p_answers jsonb, p_completed_question_ids text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_draft public.personal_plan_refinement_drafts%ROWTYPE;
BEGIN
  IF pg_catalog.jsonb_typeof(p_answers) <> 'object' THEN RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_answers'); END IF;
  UPDATE public.personal_plan_refinement_drafts
     SET answers=p_answers,
         completed_question_ids=p_completed_question_ids,
         revision=revision+1,
         updated_at=pg_catalog.now()
   WHERE id=p_draft_id
     AND user_id=p_user_id
     AND status='in_progress'
     AND revision=p_expected_revision
   RETURNING * INTO v_draft;
  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_refinement_drafts
      WHERE id=p_draft_id AND user_id=p_user_id;
    IF v_draft.id IS NULL OR v_draft.status <> 'in_progress' THEN
      RETURN jsonb_build_object('outcome','invalid_source');
    END IF;
    RETURN jsonb_build_object('outcome','revision_conflict','currentRevision',v_draft.revision);
  END IF;
  RETURN jsonb_build_object('outcome','saved','revision',v_draft.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_complete_refinement_draft(
  p_user_id uuid, p_personal_plan_id uuid, p_draft_id uuid, p_expected_revision bigint,
  p_schema_version integer, p_computation_version text, p_input_hash text, p_input_snapshot jsonb, p_output_snapshot jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_draft public.personal_plan_refinement_drafts%ROWTYPE; v_need_id uuid;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_draft FROM public.personal_plan_refinement_drafts WHERE id=p_draft_id AND personal_plan_id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  IF v_plan.id IS NULL OR v_draft.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  IF v_draft.status='complete' THEN RETURN jsonb_build_object('outcome','already_completed','refinedNeedVersionId',v_draft.result_refined_need_version_id); END IF;
  IF v_draft.status <> 'in_progress' OR v_draft.revision <> p_expected_revision THEN RETURN jsonb_build_object('outcome','revision_conflict','currentRevision',v_draft.revision); END IF;
  IF v_plan.current_initial_need_version_id IS DISTINCT FROM v_draft.base_initial_need_version_id THEN RETURN jsonb_build_object('outcome','stale_source','currentInitialNeedVersionId',v_plan.current_initial_need_version_id); END IF;
  IF p_schema_version<=0 OR p_computation_version='' OR p_input_hash !~ '^[0-9a-f]{64}$' OR pg_catalog.jsonb_typeof(p_input_snapshot)<>'object' OR pg_catalog.jsonb_typeof(p_output_snapshot)<>'object' THEN RETURN jsonb_build_object('outcome','invalid_source','reasonCode','invalid_refined_need'); END IF;
  INSERT INTO public.personal_plan_need_versions(user_id,personal_plan_id,kind,parent_need_version_id,schema_version,computation_version,input_hash,input_snapshot,output_snapshot)
  VALUES(p_user_id,p_personal_plan_id,'refined',v_draft.base_initial_need_version_id,p_schema_version,p_computation_version,p_input_hash,p_input_snapshot,p_output_snapshot)
  ON CONFLICT (personal_plan_id,parent_need_version_id,input_hash) WHERE kind='refined' DO NOTHING RETURNING id INTO v_need_id;
  IF v_need_id IS NULL THEN SELECT id INTO v_need_id FROM public.personal_plan_need_versions WHERE personal_plan_id=p_personal_plan_id AND parent_need_version_id=v_draft.base_initial_need_version_id AND kind='refined' AND input_hash=p_input_hash; END IF;
  UPDATE public.personal_plan_refinement_drafts SET status='complete',result_refined_need_version_id=v_need_id,updated_at=pg_catalog.now() WHERE id=v_draft.id;
  UPDATE public.personal_plan_product_drafts
    SET status='stale', updated_at=pg_catalog.now()
    WHERE personal_plan_id=v_plan.id AND status='active'
      AND refined_need_version_id IS DISTINCT FROM v_need_id;
  UPDATE public.personal_plans
    SET current_refined_need_version_id=v_need_id,
        revision=revision+1
    WHERE id=v_plan.id;
  PERFORM public.personal_plan_enqueue_routine_source_change(
    p_user_id, v_plan.id, 'refined_need', v_need_id::text
  );
  RETURN jsonb_build_object('outcome','completed','refinedNeedVersionId',v_need_id);
END;
$$;

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
    WHERE id=p_personal_plan_id AND user_id=p_user_id
    FOR UPDATE;
  IF v_plan.id IS NULL
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM p_refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  IF p_contract_version <= 0
     OR pg_catalog.jsonb_typeof(p_category_authority_versions) <> 'object'
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;

  UPDATE public.personal_plan_product_drafts
     SET status='stale', updated_at=pg_catalog.now()
   WHERE personal_plan_id=p_personal_plan_id
     AND user_id=p_user_id
     AND status='active'
     AND refined_need_version_id IS DISTINCT FROM p_refined_need_version_id;

  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE personal_plan_id=p_personal_plan_id
      AND user_id=p_user_id
      AND refined_need_version_id=p_refined_need_version_id
      AND status <> 'stale'
    FOR UPDATE;
  IF v_draft.id IS NOT NULL THEN
    RETURN pg_catalog.to_jsonb(v_draft);
  END IF;

  INSERT INTO public.personal_plan_product_drafts(
    user_id, personal_plan_id, refined_need_version_id, contract_version,
    category_authority_versions, pass, cursor, payload
  ) VALUES (
    p_user_id, p_personal_plan_id, p_refined_need_version_id, p_contract_version,
    p_category_authority_versions,
    COALESCE(p_payload->>'pass', 'product_capture'),
    pg_catalog.jsonb_build_object(
      'categoryCursor', p_payload->'categoryCursor',
      'completedCaptureCategories', COALESCE(p_payload->'completedCaptureCategories', '[]'::jsonb),
      'completedDecisionKeys', COALESCE(p_payload->'completedDecisionKeys', '[]'::jsonb)
    ),
    p_payload
  )
  ON CONFLICT (personal_plan_id, refined_need_version_id) WHERE status <> 'stale'
  DO NOTHING
  RETURNING * INTO v_draft;

  IF v_draft.id IS NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_product_drafts
      WHERE personal_plan_id=p_personal_plan_id
        AND user_id=p_user_id
        AND refined_need_version_id=p_refined_need_version_id
        AND status <> 'stale';
  END IF;
  RETURN pg_catalog.to_jsonb(v_draft);
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_save_product_draft(
  p_user_id uuid,
  p_draft_id uuid,
  p_expected_revision bigint,
  p_pass text,
  p_cursor jsonb,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_draft public.personal_plan_product_drafts%ROWTYPE;
BEGIN
  IF p_pass NOT IN ('product_capture', 'product_decisions', 'ready_for_routine')
     OR pg_catalog.jsonb_typeof(p_cursor) <> 'object'
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
     OR pg_catalog.octet_length(p_payload::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  UPDATE public.personal_plan_product_drafts
     SET pass=p_pass,
         cursor=p_cursor,
         payload=p_payload,
         revision=revision+1,
         updated_at=pg_catalog.now()
   WHERE id=p_draft_id
     AND user_id=p_user_id
     AND status='active'
     AND revision=p_expected_revision
   RETURNING * INTO v_draft;
  IF v_draft.id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','saved','draft',pg_catalog.to_jsonb(v_draft));
  END IF;
  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
    WHERE id=p_draft_id AND user_id=p_user_id;
  IF v_draft.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'outcome','revision_conflict',
    'currentRevision',v_draft.revision,
    'draft',pg_catalog.to_jsonb(v_draft)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_create_or_reuse_user_product(
  p_user_id uuid,
  p_category text,
  p_catalog_product_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_user_product public.user_products%ROWTYPE;
BEGIN
  SELECT * INTO v_product
    FROM public.products
    WHERE id=p_catalog_product_id
      AND category_key=p_category
      AND is_active=true
      AND lifecycle_status='active'
    FOR SHARE;
  IF v_product.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source');
  END IF;
  INSERT INTO public.user_products(
    user_id, category, catalog_product_id, brand_text, product_name_text,
    identity_status, ownership_status, intake_source
  ) VALUES (
    p_user_id, p_category, v_product.id, v_product.brand, v_product.name,
    'matched', 'owned', 'catalog_search'
  )
  ON CONFLICT (user_id, category, catalog_product_id)
    WHERE ownership_status='owned' AND catalog_product_id IS NOT NULL
  DO UPDATE SET updated_at=pg_catalog.now()
  RETURNING * INTO v_user_product;
  RETURN pg_catalog.jsonb_build_object('outcome','ready','userProduct',pg_catalog.to_jsonb(v_user_product));
END;
$$;

ALTER TABLE public.personal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_need_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_refinement_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_product_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_portfolio_versions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal_plans','personal_plan_need_versions','personal_plan_refinement_drafts','user_products','personal_plan_product_drafts','personal_plan_portfolio_versions'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t || '_owner_read', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_complete_refinement_draft(uuid,uuid,uuid,bigint,integer,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_create_or_load_product_draft(uuid,uuid,uuid,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_create_or_reuse_user_product(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_reject_immutable_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.personal_plan_validate_need_version_parent() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_refinement_draft(uuid,uuid,bigint,jsonb,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_complete_refinement_draft(uuid,uuid,uuid,bigint,integer,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_load_product_draft(uuid,uuid,uuid,integer,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_create_or_reuse_user_product(uuid,text,uuid) TO service_role;
