-- Consolidated minimal Stage-4 backend.  It stages and confirms whole Routine
-- versions; it does not compile routines or expose a customer editor.

CREATE TABLE public.personal_plan_routine_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  parent_routine_version_id uuid,
  source_refined_need_version_id uuid NOT NULL,
  source_portfolio_version_id uuid NOT NULL,
  source_product_draft_id uuid NOT NULL,
  source_product_draft_revision bigint NOT NULL CHECK (source_product_draft_revision >= 0),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  compiler_version text NOT NULL CHECK (length(compiler_version) > 0),
  authority_versions jsonb NOT NULL,
  source_fingerprint text NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 524288),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  UNIQUE (personal_plan_id, source_portfolio_version_id, payload_hash),
  FOREIGN KEY (personal_plan_id, user_id) REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_routine_version_id, user_id, personal_plan_id) REFERENCES public.personal_plan_routine_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_refined_need_version_id, user_id, personal_plan_id) REFERENCES public.personal_plan_need_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_portfolio_version_id, user_id, personal_plan_id) REFERENCES public.personal_plan_portfolio_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_product_draft_id, user_id, personal_plan_id) REFERENCES public.personal_plan_product_drafts(id, user_id, personal_plan_id) ON DELETE RESTRICT
);

CREATE TABLE public.personal_plan_routine_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  base_routine_version_id uuid,
  candidate_routine_version_id uuid NOT NULL,
  origin text NOT NULL CHECK (origin IN ('stage3_completion', 'editor', 'source_sync', 'acquisition', 'product_review')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  source_revision bigint NOT NULL CHECK (source_revision >= 0),
  source_fingerprint text NOT NULL,
  proposal_fingerprint text NOT NULL CHECK (proposal_fingerprint ~ '^[0-9a-f]{64}$'),
  delta jsonb NOT NULL CHECK (octet_length(delta::text) <= 524288),
  direct_operation_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, personal_plan_id),
  UNIQUE (personal_plan_id, candidate_routine_version_id, proposal_fingerprint),
  FOREIGN KEY (personal_plan_id, user_id) REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (base_routine_version_id, user_id, personal_plan_id) REFERENCES public.personal_plan_routine_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidate_routine_version_id, user_id, personal_plan_id) REFERENCES public.personal_plan_routine_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX personal_plan_routine_proposals_pending_key
  ON public.personal_plan_routine_proposals(personal_plan_id) WHERE status = 'pending';

CREATE TABLE public.personal_plan_routine_source_change_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_plan_id uuid NOT NULL,
  source_kind text NOT NULL,
  source_key text NOT NULL,
  observed_revision bigint NOT NULL CHECK (observed_revision >= 0),
  processed_revision bigint NOT NULL DEFAULT 0 CHECK (processed_revision >= 0 AND processed_revision <= observed_revision),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personal_plan_id, source_kind, source_key),
  FOREIGN KEY (personal_plan_id, user_id) REFERENCES public.personal_plans(id, user_id) ON DELETE RESTRICT,
  CHECK ((status = 'pending' AND lease_token IS NULL AND lease_expires_at IS NULL)
      OR (status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);

ALTER TABLE public.personal_plans
  ADD COLUMN active_routine_version_id uuid,
  ADD COLUMN pending_routine_proposal_id uuid,
  ADD CONSTRAINT personal_plans_active_routine_pointer_fkey
    FOREIGN KEY (active_routine_version_id, user_id, id)
    REFERENCES public.personal_plan_routine_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  ADD CONSTRAINT personal_plans_pending_routine_proposal_pointer_fkey
    FOREIGN KEY (pending_routine_proposal_id, user_id, id)
    REFERENCES public.personal_plan_routine_proposals(id, user_id, personal_plan_id) ON DELETE RESTRICT;

CREATE INDEX personal_plan_routine_versions_user_id_idx ON public.personal_plan_routine_versions(user_id);
CREATE INDEX personal_plan_routine_versions_plan_id_idx ON public.personal_plan_routine_versions(personal_plan_id);
CREATE INDEX personal_plan_routine_versions_parent_id_idx ON public.personal_plan_routine_versions(parent_routine_version_id) WHERE parent_routine_version_id IS NOT NULL;
CREATE INDEX personal_plan_routine_versions_refined_id_idx ON public.personal_plan_routine_versions(source_refined_need_version_id);
CREATE INDEX personal_plan_routine_versions_portfolio_id_idx ON public.personal_plan_routine_versions(source_portfolio_version_id);
CREATE INDEX personal_plan_routine_versions_draft_id_idx ON public.personal_plan_routine_versions(source_product_draft_id);
CREATE INDEX personal_plan_routine_proposals_user_id_idx ON public.personal_plan_routine_proposals(user_id);
CREATE INDEX personal_plan_routine_proposals_plan_id_idx ON public.personal_plan_routine_proposals(personal_plan_id);
CREATE INDEX personal_plan_routine_proposals_base_id_idx ON public.personal_plan_routine_proposals(base_routine_version_id) WHERE base_routine_version_id IS NOT NULL;
CREATE INDEX personal_plan_routine_proposals_candidate_id_idx ON public.personal_plan_routine_proposals(candidate_routine_version_id);
CREATE INDEX personal_plan_routine_source_change_outbox_user_id_idx ON public.personal_plan_routine_source_change_outbox(user_id);
CREATE INDEX personal_plan_routine_source_change_outbox_due_idx ON public.personal_plan_routine_source_change_outbox(status, available_at, first_observed_at);

CREATE TRIGGER personal_plan_routine_versions_immutable BEFORE UPDATE OR DELETE ON public.personal_plan_routine_versions
  FOR EACH ROW EXECUTE FUNCTION public.personal_plan_reject_immutable_write();
CREATE TRIGGER set_updated_at_personal_plan_routine_proposals BEFORE UPDATE ON public.personal_plan_routine_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_personal_plan_routine_source_change_outbox BEFORE UPDATE ON public.personal_plan_routine_source_change_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.personal_plan_enqueue_user_product_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.personal_plans WHERE user_id = NEW.user_id;
  IF v_plan_id IS NOT NULL THEN
    PERFORM public.personal_plan_enqueue_routine_source_change(
      NEW.user_id, v_plan_id, 'user_product', NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.personal_plan_routine_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_routine_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_plan_routine_source_change_outbox ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal_plan_routine_versions','personal_plan_routine_proposals','personal_plan_routine_source_change_outbox'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t || '_owner_read', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_enqueue_routine_source_change(
  p_user_id uuid, p_personal_plan_id uuid, p_source_kind text, p_source_key text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_revision bigint;
BEGIN
  IF p_source_kind IS NULL OR length(p_source_kind) NOT BETWEEN 1 AND 64
     OR p_source_key IS NULL OR length(p_source_key) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'invalid personal plan source key' USING ERRCODE = '22023';
  END IF;
  UPDATE public.personal_plans SET source_revision = source_revision + 1
   WHERE id = p_personal_plan_id AND user_id = p_user_id RETURNING source_revision INTO v_revision;
  IF v_revision IS NULL THEN RAISE EXCEPTION 'invalid personal plan source' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.personal_plan_routine_source_change_outbox AS o
    (user_id, personal_plan_id, source_kind, source_key, observed_revision)
  VALUES (p_user_id, p_personal_plan_id, p_source_kind, p_source_key, v_revision)
  ON CONFLICT (personal_plan_id, source_kind, source_key) DO UPDATE
    SET observed_revision = EXCLUDED.observed_revision,
        status = CASE WHEN o.status = 'processing' THEN 'processing' ELSE 'pending' END,
        available_at = CASE WHEN o.status = 'processing' THEN o.available_at ELSE pg_catalog.now() END,
        last_observed_at = pg_catalog.now(), updated_at = pg_catalog.now();
  RETURN v_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_complete_product_draft_and_stage_routine(
  p_user_id uuid, p_personal_plan_id uuid, p_product_draft_id uuid, p_expected_draft_revision bigint, p_expected_source_revision bigint,
  p_portfolio_schema_version integer, p_portfolio_snapshot jsonb, p_routine_schema_version integer,
  p_routine_compiler_version text, p_routine_authority_versions jsonb, p_routine_source_fingerprint text,
  p_routine_payload jsonb, p_proposal_delta jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_portfolio_id uuid; v_routine_id uuid; v_proposal_id uuid; v_portfolio_hash text; v_payload_hash text; v_proposal_hash text;
  v_source_revision bigint;
  v_created_at timestamptz := pg_catalog.now();
  v_stored_portfolio jsonb;
  v_stored_routine jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('status','invalid_source','reasonCode','plan_not_found'); END IF;
  SELECT * INTO v_draft FROM public.personal_plan_product_drafts WHERE id = p_product_draft_id AND personal_plan_id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_draft.id IS NULL THEN RETURN jsonb_build_object('status','invalid_source','reasonCode','draft_not_found'); END IF;
  IF v_draft.status = 'completed' THEN
    SELECT id INTO v_portfolio_id FROM public.personal_plan_portfolio_versions WHERE source_product_draft_id = v_draft.id;
    SELECT id INTO v_routine_id FROM public.personal_plan_routine_versions WHERE source_product_draft_id = v_draft.id ORDER BY created_at LIMIT 1;
    SELECT id INTO v_proposal_id FROM public.personal_plan_routine_proposals WHERE candidate_routine_version_id = v_routine_id ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object('status','already_completed','portfolioVersionId',v_portfolio_id,'routineVersionId',v_routine_id,'routineProposalId',v_proposal_id,'revision',v_plan.revision);
  END IF;
  IF v_draft.status <> 'active' OR v_draft.revision <> p_expected_draft_revision THEN
    RETURN jsonb_build_object('status','revision_conflict','currentRevision',v_draft.revision);
  END IF;
  IF v_plan.source_revision <> p_expected_source_revision THEN
    RETURN jsonb_build_object('status','source_revision_conflict','currentSourceRevision',v_plan.source_revision);
  END IF;
  IF v_plan.current_refined_need_version_id IS DISTINCT FROM v_draft.refined_need_version_id THEN
    RETURN jsonb_build_object('status','stale_source','currentRefinedNeedVersionId',v_plan.current_refined_need_version_id);
  END IF;
  IF p_portfolio_schema_version <= 0 OR p_routine_schema_version <= 0
     OR p_routine_compiler_version = '' OR p_routine_source_fingerprint = ''
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot) <> 'object'
     OR pg_catalog.jsonb_typeof(p_routine_authority_versions) <> 'object'
     OR pg_catalog.jsonb_typeof(p_routine_payload) <> 'object'
     OR pg_catalog.jsonb_typeof(p_proposal_delta) <> 'object'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'ownedProducts') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'plannedPurchases') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'pendingProducts') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'categoryResolutions') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'uncoveredRoles') <> 'array'
     OR p_portfolio_snapshot->>'schemaVersion' IS DISTINCT FROM p_portfolio_schema_version::text
     OR p_portfolio_snapshot->>'personalPlanId' IS DISTINCT FROM p_personal_plan_id::text
     OR p_portfolio_snapshot->>'refinedVersionId' IS DISTINCT FROM v_draft.refined_need_version_id::text
     OR p_portfolio_snapshot->>'sourceDraftRevision' IS DISTINCT FROM v_draft.revision::text THEN
    RETURN jsonb_build_object('status','invalid_source','reasonCode','invalid_candidate');
  END IF;
  v_portfolio_id := extensions.uuid_generate_v4();
  v_routine_id := extensions.uuid_generate_v4();
  v_stored_portfolio := p_portfolio_snapshot || pg_catalog.jsonb_build_object(
    'portfolioVersionId',v_portfolio_id,'createdAt',v_created_at
  );
  v_stored_routine := p_routine_payload || pg_catalog.jsonb_build_object(
    'versionId',v_routine_id,'planId',p_personal_plan_id,'createdAt',v_created_at,
    'source',
      CASE WHEN pg_catalog.jsonb_typeof(p_routine_payload->'source') = 'object'
        THEN p_routine_payload->'source' ELSE '{}'::jsonb END ||
      pg_catalog.jsonb_build_object('refinedVersionId',v_draft.refined_need_version_id,'productPortfolioVersionId',v_portfolio_id)
  );
  IF octet_length(v_stored_portfolio::text) > 524288
     OR octet_length(v_stored_routine::text) > 524288
     OR octet_length(p_proposal_delta::text) > 524288 THEN
    RETURN jsonb_build_object('status','snapshot_too_large');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') AS item(value)
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.user_products owned
          WHERE owned.id::text = item.value->>'userProductId'
            AND owned.user_id = p_user_id
            AND owned.category = item.value->>'category'
            AND owned.catalog_product_id::text = item.value->>'productId'
            AND owned.identity_status = 'matched'
            AND owned.ownership_status = 'owned'
      )
  ) THEN
    RETURN jsonb_build_object('status','invalid_source','reasonCode','invalid_owned_product');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') AS item(value)
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.user_products pending
          WHERE pending.id::text = item.value->>'userProductId'
            AND pending.user_id = p_user_id
            AND pending.category = item.value->>'category'
            AND pending.catalog_product_id IS NULL
            AND pending.identity_status IN ('pending_review', 'needs_more_info')
            AND pending.ownership_status = 'owned'
            AND EXISTS (
              SELECT 1
                FROM public.product_submissions submission
                WHERE submission.id::text = item.value->>'submissionId'
                  AND submission.user_id = p_user_id
                  AND submission.user_product_id = pending.id
                  AND submission.category = pending.category
                  AND submission.status IN (
                    'pending_review', 'researching', 'ready_for_review', 'needs_more_info'
                  )
            )
      )
  ) THEN
    RETURN jsonb_build_object('status','invalid_source','reasonCode','invalid_pending_product');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'plannedPurchases') AS item(value)
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.products planned
          WHERE planned.id::text = item.value->>'productId'
            AND planned.category_key = item.value->>'category'
            AND planned.is_active = true
            AND planned.lifecycle_status = 'active'
            AND planned.is_chaarlie_recommended = true
      )
  ) THEN
    RETURN jsonb_build_object('status','invalid_source','reasonCode','invalid_planned_product');
  END IF;
  v_portfolio_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_portfolio_snapshot - 'portfolioVersionId' - 'createdAt')::text,'UTF8')),'hex');
  v_payload_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_routine_payload - 'versionId' - 'createdAt')::text,'UTF8')),'hex');
  v_proposal_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_payload_hash || ':' || p_proposal_delta::text || ':' || p_routine_source_fingerprint,'UTF8')),'hex');
  INSERT INTO public.personal_plan_portfolio_versions (id,user_id,personal_plan_id,refined_need_version_id,source_product_draft_id,source_product_draft_revision,schema_version,category_authority_versions,content_hash,snapshot,created_at)
  VALUES (v_portfolio_id,p_user_id,p_personal_plan_id,v_draft.refined_need_version_id,v_draft.id,v_draft.revision,p_portfolio_schema_version,v_draft.category_authority_versions,v_portfolio_hash,v_stored_portfolio,v_created_at)
  ON CONFLICT (source_product_draft_id) DO NOTHING
  RETURNING id INTO v_portfolio_id;
  IF v_portfolio_id IS NULL THEN
    SELECT id INTO v_portfolio_id FROM public.personal_plan_portfolio_versions
     WHERE source_product_draft_id = v_draft.id;
  END IF;
  v_source_revision := public.personal_plan_enqueue_routine_source_change(
    p_user_id, p_personal_plan_id, 'portfolio_version', v_portfolio_id::text
  );
  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision=observed_revision,
         status='pending',
         available_at='infinity'::timestamptz,
         lease_token=NULL,
         lease_expires_at=NULL,
         last_error_code=NULL,
         processed_at=pg_catalog.now(),
         updated_at=pg_catalog.now()
   WHERE personal_plan_id=p_personal_plan_id
     AND source_kind='portfolio_version'
     AND source_key=v_portfolio_id::text
     AND observed_revision=v_source_revision
     AND status='pending';
  INSERT INTO public.personal_plan_routine_versions (id,user_id,personal_plan_id,source_refined_need_version_id,source_portfolio_version_id,source_product_draft_id,source_product_draft_revision,schema_version,compiler_version,authority_versions,source_fingerprint,payload_hash,payload,created_at)
  VALUES (v_routine_id,p_user_id,p_personal_plan_id,v_draft.refined_need_version_id,v_portfolio_id,v_draft.id,v_draft.revision,p_routine_schema_version,p_routine_compiler_version,p_routine_authority_versions,p_routine_source_fingerprint,v_payload_hash,v_stored_routine,v_created_at)
  ON CONFLICT (personal_plan_id,source_portfolio_version_id,payload_hash) DO NOTHING
  RETURNING id INTO v_routine_id;
  IF v_routine_id IS NULL THEN
    SELECT id INTO v_routine_id FROM public.personal_plan_routine_versions
     WHERE personal_plan_id=p_personal_plan_id AND source_portfolio_version_id=v_portfolio_id AND payload_hash=v_payload_hash;
  END IF;
  UPDATE public.personal_plan_routine_proposals
    SET status='superseded', updated_at=pg_catalog.now()
    WHERE personal_plan_id=p_personal_plan_id AND status='pending';
  INSERT INTO public.personal_plan_routine_proposals (user_id,personal_plan_id,base_routine_version_id,candidate_routine_version_id,origin,status,source_revision,source_fingerprint,proposal_fingerprint,delta)
  VALUES (p_user_id,p_personal_plan_id,v_plan.active_routine_version_id,v_routine_id,'stage3_completion','pending',v_source_revision,p_routine_source_fingerprint,v_proposal_hash,p_proposal_delta)
  ON CONFLICT (personal_plan_id,candidate_routine_version_id,proposal_fingerprint) DO NOTHING
  RETURNING id INTO v_proposal_id;
  IF v_proposal_id IS NULL THEN
    SELECT id INTO v_proposal_id FROM public.personal_plan_routine_proposals
     WHERE personal_plan_id=p_personal_plan_id AND candidate_routine_version_id=v_routine_id AND proposal_fingerprint=v_proposal_hash;
  END IF;
  UPDATE public.personal_plan_product_drafts
    SET status = 'completed', revision=revision+1, updated_at = pg_catalog.now()
    WHERE id = v_draft.id;
  UPDATE public.personal_plans SET pending_routine_proposal_id = v_proposal_id, revision = revision + 1,
    last_evaluated_source_fingerprint=p_routine_source_fingerprint, updated_at = pg_catalog.now()
   WHERE id = v_plan.id RETURNING revision INTO v_plan.revision;
  RETURN jsonb_build_object('status','completed','portfolioVersionId',v_portfolio_id,'routineVersionId',v_routine_id,'routineProposalId',v_proposal_id,'revision',v_plan.revision);
END;
$$;

CREATE TRIGGER personal_plan_user_products_enqueue_source_change
  AFTER INSERT OR UPDATE OF catalog_product_id, identity_status, ownership_status, brand_text, product_name_text
  ON public.user_products FOR EACH ROW
  EXECUTE FUNCTION public.personal_plan_enqueue_user_product_source_change();

CREATE OR REPLACE FUNCTION public.personal_plan_claim_routine_source_changes(
  p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 300
) RETURNS TABLE (outbox_id uuid, user_id uuid, personal_plan_id uuid, source_kind text, source_key text, observed_revision bigint, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token uuid := extensions.uuid_generate_v4();
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id FROM public.personal_plan_routine_source_change_outbox o
    WHERE (o.status='pending' AND o.available_at <= pg_catalog.now())
       OR (o.status='processing' AND o.lease_expires_at <= pg_catalog.now())
    ORDER BY o.available_at, o.first_observed_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.personal_plan_routine_source_change_outbox o
       SET status='processing', lease_token=v_token,
           lease_expires_at=pg_catalog.now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 3600)),
           attempt_count=o.attempt_count+1, updated_at=pg_catalog.now()
      FROM candidates c WHERE o.id=c.id
    RETURNING o.*
  ) SELECT c.id,c.user_id,c.personal_plan_id,c.source_kind,c.source_key,c.observed_revision,c.lease_token FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_finish_routine_source_change(
  p_outbox_id uuid, p_lease_token uuid, p_processed_revision bigint, p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.personal_plan_routine_source_change_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.personal_plan_routine_source_change_outbox WHERE id=p_outbox_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status <> 'processing' OR v_row.lease_token IS DISTINCT FROM p_lease_token THEN RETURN false; END IF;
  IF p_processed_revision < 0 OR p_processed_revision > v_row.observed_revision THEN RAISE EXCEPTION 'invalid processed revision' USING ERRCODE='22023'; END IF;
  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision=CASE WHEN p_error_code IS NULL THEN p_processed_revision ELSE v_row.processed_revision END,
         status='pending',
         available_at=CASE
           WHEN p_error_code IS NOT NULL THEN pg_catalog.now() + interval '30 seconds'
           WHEN p_processed_revision < v_row.observed_revision THEN pg_catalog.now()
           ELSE 'infinity'::timestamptz
         END,
         lease_token=NULL, lease_expires_at=NULL, last_error_code=p_error_code,
         processed_at=CASE WHEN p_error_code IS NULL AND p_processed_revision = v_row.observed_revision THEN pg_catalog.now() ELSE processed_at END,
         updated_at=pg_catalog.now()
   WHERE id=p_outbox_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_confirm_routine_proposal(
  p_user_id uuid, p_personal_plan_id uuid, p_proposal_id uuid, p_expected_revision bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_proposal public.personal_plan_routine_proposals%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  SELECT * INTO v_proposal FROM public.personal_plan_routine_proposals WHERE id=p_proposal_id AND personal_plan_id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN RETURN jsonb_build_object('outcome','invalid_source'); END IF;
  IF v_proposal.status = 'accepted' THEN
    IF v_plan.active_routine_version_id IS NOT DISTINCT FROM v_proposal.candidate_routine_version_id THEN
      RETURN jsonb_build_object('outcome','already_accepted','revision',v_plan.revision);
    END IF;
    RETURN jsonb_build_object('outcome','stale_proposal');
  END IF;
  IF v_plan.revision <> p_expected_revision THEN RETURN jsonb_build_object('outcome','revision_conflict','currentRevision',v_plan.revision); END IF;
  IF v_plan.pending_routine_proposal_id IS DISTINCT FROM v_proposal.id OR v_proposal.status <> 'pending' OR v_proposal.base_routine_version_id IS DISTINCT FROM v_plan.active_routine_version_id THEN RETURN jsonb_build_object('outcome','stale_proposal'); END IF;
  IF v_proposal.source_revision <> v_plan.source_revision THEN RETURN jsonb_build_object('outcome','stale_source'); END IF;
  UPDATE public.personal_plan_routine_proposals SET status='accepted', updated_at=pg_catalog.now() WHERE id=v_proposal.id;
  UPDATE public.personal_plans SET active_routine_version_id=v_proposal.candidate_routine_version_id, pending_routine_proposal_id=NULL, revision=revision+1, updated_at=pg_catalog.now()
   WHERE id=v_plan.id RETURNING revision INTO v_plan.revision;
  RETURN jsonb_build_object('outcome','accepted','revision',v_plan.revision);
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_enqueue_routine_source_change(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_complete_product_draft_and_stage_routine(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_confirm_routine_proposal(uuid,uuid,uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_enqueue_user_product_source_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_claim_routine_source_changes(integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_finish_routine_source_change(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_enqueue_routine_source_change(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_complete_product_draft_and_stage_routine(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_confirm_routine_proposal(uuid,uuid,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_claim_routine_source_changes(integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_finish_routine_source_change(uuid,uuid,bigint,text) TO service_role;
