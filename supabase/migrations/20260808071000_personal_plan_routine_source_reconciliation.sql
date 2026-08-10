-- Stage-4 source reconciliation creates an immutable successor portfolio for
-- each material user-product event.  It deliberately extends the Stage 1-3
-- portfolio authority rather than introducing a parallel Routine source.

ALTER TABLE public.personal_plan_portfolio_versions
  ADD COLUMN parent_portfolio_version_id uuid,
  ADD COLUMN lineage_product_draft_id uuid,
  ADD COLUMN source_kind text,
  ADD COLUMN source_key text,
  ADD COLUMN source_revision bigint;

UPDATE public.personal_plan_portfolio_versions
   SET lineage_product_draft_id = source_product_draft_id
 WHERE lineage_product_draft_id IS NULL;

ALTER TABLE public.personal_plan_portfolio_versions
  ALTER COLUMN lineage_product_draft_id SET NOT NULL,
  ALTER COLUMN source_product_draft_id DROP NOT NULL,
  ADD CONSTRAINT personal_plan_portfolio_versions_parent_fkey
    FOREIGN KEY (parent_portfolio_version_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_portfolio_versions(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  ADD CONSTRAINT personal_plan_portfolio_versions_lineage_draft_fkey
    FOREIGN KEY (lineage_product_draft_id, user_id, personal_plan_id)
    REFERENCES public.personal_plan_product_drafts(id, user_id, personal_plan_id) ON DELETE RESTRICT,
  ADD CONSTRAINT personal_plan_portfolio_versions_lineage_shape_check CHECK (
    (parent_portfolio_version_id IS NULL
      AND source_product_draft_id IS NOT NULL
      AND lineage_product_draft_id = source_product_draft_id
      AND source_kind IS NULL AND source_key IS NULL AND source_revision IS NULL)
    OR
    (parent_portfolio_version_id IS NOT NULL
      AND source_product_draft_id IS NULL
      AND source_kind IS NOT NULL
      AND source_kind = 'user_product'
      AND source_key IS NOT NULL
      AND source_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND source_revision IS NOT NULL
      AND source_revision >= 0)
  );

CREATE UNIQUE INDEX personal_plan_portfolio_versions_successor_event_key
  ON public.personal_plan_portfolio_versions
    (personal_plan_id, parent_portfolio_version_id, source_kind, source_key, source_revision)
  WHERE parent_portfolio_version_id IS NOT NULL;

-- Stage-3 completion remains the initial portfolio writer.  It intentionally
-- keeps its existing insert shape, so derive lineage at the table boundary.
CREATE OR REPLACE FUNCTION public.set_personal_plan_portfolio_lineage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NEW.parent_portfolio_version_id IS NULL AND NEW.lineage_product_draft_id IS NULL THEN
    NEW.lineage_product_draft_id := NEW.source_product_draft_id;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS set_personal_plan_portfolio_lineage ON public.personal_plan_portfolio_versions;
CREATE TRIGGER set_personal_plan_portfolio_lineage
  BEFORE INSERT ON public.personal_plan_portfolio_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_personal_plan_portfolio_lineage();

-- The existing stager has one deliberately narrow compatibility adjustment:
-- source successors inherit their frozen draft through lineage rather than the
-- nullable initial-completion draft column.
DO $migration$
DECLARE v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.personal_plan_stage_routine_successor(uuid,uuid,uuid,bigint,bigint,uuid,uuid,uuid,bigint,integer,text,jsonb,text,jsonb,jsonb,text[],text)'::regprocedure
  ) INTO v_definition;
  v_definition := pg_catalog.replace(
    v_definition,
    'OR v_portfolio.source_product_draft_id IS DISTINCT FROM p_source_product_draft_id',
    'OR v_portfolio.lineage_product_draft_id IS DISTINCT FROM p_source_product_draft_id'
  );
  IF v_definition NOT LIKE '%lineage_product_draft_id IS DISTINCT FROM p_source_product_draft_id%' THEN
    RAISE EXCEPTION 'could not apply successor portfolio lineage validation';
  END IF;
  EXECUTE v_definition;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.personal_plan_claim_owner_routine_source_changes(
  p_user_id uuid, p_personal_plan_id uuid, p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 300
) RETURNS TABLE (outbox_id uuid, user_id uuid, personal_plan_id uuid, source_kind text, source_key text, observed_revision bigint, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_token uuid := extensions.uuid_generate_v4();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.personal_plans plan
     WHERE plan.id = p_personal_plan_id AND plan.user_id = p_user_id
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id FROM public.personal_plan_routine_source_change_outbox o
     WHERE o.user_id = p_user_id AND o.personal_plan_id = p_personal_plan_id
       AND ((o.status = 'pending' AND o.available_at <= pg_catalog.now())
         OR (o.status = 'processing' AND o.lease_expires_at <= pg_catalog.now()))
     ORDER BY o.available_at, o.first_observed_at
     LIMIT LEAST(GREATEST(p_limit, 1), 100)
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.personal_plan_routine_source_change_outbox o
       SET status = 'processing', lease_token = v_token,
           lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 3600)),
           attempt_count = o.attempt_count + 1, updated_at = pg_catalog.now()
      FROM candidates c WHERE o.id = c.id
    RETURNING o.*
  ) SELECT c.id, c.user_id, c.personal_plan_id, c.source_kind, c.source_key, c.observed_revision, c.lease_token FROM claimed c;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_plan_stage_routine_source_successor(
  p_user_id uuid, p_personal_plan_id uuid, p_expected_active_routine_version_id uuid,
  p_expected_revision bigint, p_expected_source_revision bigint,
  p_source_kind text, p_source_key text, p_portfolio_schema_version integer,
  p_portfolio_snapshot jsonb, p_routine_schema_version integer, p_routine_compiler_version text,
  p_routine_authority_versions jsonb, p_routine_source_fingerprint text,
  p_routine_payload jsonb, p_proposal_delta jsonb, p_direct_operation_keys text[], p_origin text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_plan public.personal_plans%ROWTYPE; v_base_routine public.personal_plan_routine_versions%ROWTYPE;
  v_base_portfolio public.personal_plan_portfolio_versions%ROWTYPE; v_product public.user_products%ROWTYPE;
  v_portfolio_id uuid := extensions.uuid_generate_v4(); v_snapshot jsonb; v_hash text; v_result jsonb;
  v_created_at timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id=p_personal_plan_id AND user_id=p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source'); END IF;
  IF v_plan.active_routine_version_id IS DISTINCT FROM p_expected_active_routine_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_active_version','currentActiveRoutineVersionId',v_plan.active_routine_version_id);
  END IF;
  IF v_plan.revision <> p_expected_revision THEN RETURN pg_catalog.jsonb_build_object('outcome','revision_conflict','currentRevision',v_plan.revision); END IF;
  IF v_plan.source_revision <> p_expected_source_revision THEN RETURN pg_catalog.jsonb_build_object('outcome','source_revision_conflict','currentSourceRevision',v_plan.source_revision); END IF;
  IF p_source_kind <> 'user_product' OR p_source_key !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR p_origin NOT IN ('source_sync','acquisition','product_review')
     OR p_portfolio_schema_version <= 0 OR pg_catalog.jsonb_typeof(p_portfolio_snapshot) <> 'object'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'ownedProducts') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'pendingProducts') <> 'array'
     OR pg_catalog.jsonb_typeof(p_portfolio_snapshot->'plannedPurchases') <> 'array'
     OR p_routine_schema_version <= 0 OR p_routine_compiler_version IS NULL OR p_routine_compiler_version = ''
     OR p_routine_source_fingerprint IS NULL OR p_routine_source_fingerprint !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_routine_authority_versions) <> 'object'
     OR pg_catalog.jsonb_typeof(p_routine_payload) <> 'object' OR pg_catalog.jsonb_typeof(p_proposal_delta) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','invalid_candidate');
  END IF;
  -- Before first confirmation the pending initial candidate is the only
  -- authoritative base.  The nested stager still receives NULL active base.
  IF v_plan.active_routine_version_id IS NOT NULL THEN
    SELECT * INTO v_base_routine FROM public.personal_plan_routine_versions WHERE id=v_plan.active_routine_version_id FOR KEY SHARE;
  ELSE
    SELECT r.* INTO v_base_routine FROM public.personal_plan_routine_proposals p
      JOIN public.personal_plan_routine_versions r ON r.id=p.candidate_routine_version_id
     WHERE p.id=v_plan.pending_routine_proposal_id AND p.personal_plan_id=v_plan.id AND p.status='pending' FOR KEY SHARE OF r;
  END IF;
  IF v_base_routine.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome','stale_source','reasonCode','missing_routine_base'); END IF;
  SELECT * INTO v_base_portfolio FROM public.personal_plan_portfolio_versions
   WHERE id=v_base_routine.source_portfolio_version_id AND user_id=p_user_id AND personal_plan_id=p_personal_plan_id FOR KEY SHARE;
  SELECT * INTO v_product FROM public.user_products WHERE id=p_source_key::uuid AND user_id=p_user_id FOR KEY SHARE;
  IF v_base_portfolio.id IS NULL OR v_product.id IS NULL OR v_base_portfolio.refined_need_version_id IS DISTINCT FROM v_plan.current_refined_need_version_id
     OR v_base_portfolio.lineage_product_draft_id IS DISTINCT FROM v_base_routine.source_product_draft_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome','stale_source');
  END IF;
  IF p_portfolio_snapshot->>'schemaVersion' IS DISTINCT FROM p_portfolio_schema_version::text
     OR p_portfolio_snapshot->>'personalPlanId' IS DISTINCT FROM p_personal_plan_id::text
     OR p_portfolio_snapshot->>'refinedVersionId' IS DISTINCT FROM v_base_portfolio.refined_need_version_id::text THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','invalid_snapshot');
  END IF;
  IF (v_product.ownership_status = 'owned' AND v_product.identity_status = 'matched' AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') i
         WHERE i.value->>'userProductId'=v_product.id::text AND i.value->>'category'=v_product.category AND i.value->>'productId'=v_product.catalog_product_id::text))
     OR (v_product.ownership_status = 'owned' AND v_product.identity_status <> 'matched' AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') i
         WHERE i.value->>'userProductId'=v_product.id::text AND i.value->>'category'=v_product.category
           AND EXISTS (SELECT 1 FROM public.product_submissions s WHERE s.id::text=i.value->>'submissionId' AND s.user_id=p_user_id AND s.user_product_id=v_product.id AND s.category=v_product.category AND s.status IN ('pending_review','researching','ready_for_review','needs_more_info'))))
     OR (v_product.ownership_status = 'archived' AND (EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') i WHERE i.value->>'userProductId'=v_product.id::text) OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') i WHERE i.value->>'userProductId'=v_product.id::text))) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','snapshot_does_not_reflect_user_product');
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') i
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_products u
        WHERE u.id::text=i.value->>'userProductId' AND u.user_id=p_user_id
          AND u.category=i.value->>'category' AND u.catalog_product_id::text=i.value->>'productId'
          AND u.identity_status='matched' AND u.ownership_status='owned'
     )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') i
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_products u
       JOIN public.product_submissions s ON s.user_product_id=u.id AND s.user_id=u.user_id AND s.category=u.category
        WHERE u.id::text=i.value->>'userProductId' AND u.user_id=p_user_id
          AND u.category=i.value->>'category' AND u.identity_status IN ('pending_review','needs_more_info')
          AND u.ownership_status='owned' AND s.id::text=i.value->>'submissionId'
          AND s.status IN ('pending_review','researching','ready_for_review','needs_more_info')
     )
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'plannedPurchases') i
     WHERE NOT EXISTS (
       SELECT 1 FROM public.products p
        WHERE p.id::text=i.value->>'productId' AND p.category_key=i.value->>'category'
          AND p.is_active=true AND p.lifecycle_status='active' AND p.is_chaarlie_recommended=true
     )
  ) THEN
    RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','invalid_portfolio_identity');
  END IF;
  v_snapshot := p_portfolio_snapshot || pg_catalog.jsonb_build_object('portfolioVersionId',v_portfolio_id,'createdAt',v_created_at);
  IF pg_catalog.octet_length(v_snapshot::text) > 524288 THEN RETURN pg_catalog.jsonb_build_object('outcome','invalid_source','reasonCode','snapshot_too_large'); END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_portfolio_snapshot-'portfolioVersionId'-'createdAt')::text,'UTF8')),'hex');
  INSERT INTO public.personal_plan_portfolio_versions (id,user_id,personal_plan_id,refined_need_version_id,parent_portfolio_version_id,lineage_product_draft_id,source_product_draft_id,source_product_draft_revision,source_kind,source_key,source_revision,schema_version,category_authority_versions,content_hash,snapshot,created_at)
  VALUES (v_portfolio_id,p_user_id,p_personal_plan_id,v_base_portfolio.refined_need_version_id,v_base_portfolio.id,v_base_portfolio.lineage_product_draft_id,NULL,v_base_portfolio.source_product_draft_revision,p_source_kind,p_source_key,p_expected_source_revision,p_portfolio_schema_version,v_base_portfolio.category_authority_versions,v_hash,v_snapshot,v_created_at)
  ON CONFLICT (personal_plan_id,parent_portfolio_version_id,source_kind,source_key,source_revision) WHERE parent_portfolio_version_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_portfolio_id;
  IF v_portfolio_id IS NULL THEN SELECT id INTO v_portfolio_id FROM public.personal_plan_portfolio_versions WHERE personal_plan_id=p_personal_plan_id AND parent_portfolio_version_id=v_base_portfolio.id AND source_kind=p_source_kind AND source_key=p_source_key AND source_revision=p_expected_source_revision; END IF;
  SELECT public.personal_plan_stage_routine_successor(p_user_id,p_personal_plan_id,p_expected_active_routine_version_id,p_expected_revision,p_expected_source_revision,v_base_portfolio.refined_need_version_id,v_portfolio_id,v_base_portfolio.lineage_product_draft_id,v_base_portfolio.source_product_draft_revision,p_routine_schema_version,p_routine_compiler_version,p_routine_authority_versions,p_routine_source_fingerprint,p_routine_payload,p_proposal_delta,p_direct_operation_keys,p_origin) INTO v_result;
  RETURN v_result || pg_catalog.jsonb_build_object('portfolioVersionId',v_portfolio_id);
END;
$function$;

-- An acquisition is both an identity operation and a Routine source event.
-- The initial INSERT trigger already emits the event; a reused identity does
-- not. Serialising on the owner plan yields exactly one revision either way.
CREATE OR REPLACE FUNCTION public.personal_plan_acquire_catalog_product_for_routine(
  p_user_id uuid, p_personal_plan_id uuid, p_category text, p_catalog_product_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_existing public.user_products%ROWTYPE;
  v_result jsonb;
  v_user_product_id uuid;
  v_before_source_revision bigint;
  v_source_revision bigint;
  v_event_revision bigint;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans WHERE id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source'); END IF;
  v_before_source_revision := v_plan.source_revision;
  SELECT * INTO v_existing FROM public.user_products
   WHERE user_id = p_user_id AND category = p_category AND catalog_product_id = p_catalog_product_id AND ownership_status = 'owned'
   FOR KEY SHARE;
  SELECT public.personal_plan_create_or_reuse_user_product(p_user_id, p_category, p_catalog_product_id) INTO v_result;
  IF v_result->>'outcome' IS DISTINCT FROM 'ready' OR v_result#>>'{userProduct,id}' IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;
  v_user_product_id := (v_result#>>'{userProduct,id}')::uuid;
  SELECT source_revision INTO v_source_revision FROM public.personal_plans WHERE id = v_plan.id;
  SELECT observed_revision INTO v_event_revision FROM public.personal_plan_routine_source_change_outbox
   WHERE personal_plan_id = v_plan.id AND source_kind = 'user_product' AND source_key = v_user_product_id::text;
  IF v_existing.id IS NOT NULL OR v_source_revision = v_before_source_revision OR v_event_revision IS DISTINCT FROM v_source_revision THEN
    v_source_revision := public.personal_plan_enqueue_routine_source_change(p_user_id, v_plan.id, 'user_product', v_user_product_id::text);
  END IF;
  RETURN pg_catalog.jsonb_build_object('outcome', 'ready', 'userProduct', v_result->'userProduct', 'sourceRevision', v_source_revision);
END;
$function$;

-- A deterministic invalid candidate is terminal only for the exact observed
-- source revision that produced it. Preserve the error for operators and mark
-- that revision processed; a later truthful source update increments
-- observed_revision and immediately makes the row claimable again. Transient
-- errors and unresolved product-review work retain the existing retry delay.
CREATE OR REPLACE FUNCTION public.personal_plan_finish_routine_source_change(
  p_outbox_id uuid, p_lease_token uuid, p_processed_revision bigint, p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_row public.personal_plan_routine_source_change_outbox%ROWTYPE;
  v_terminal boolean := p_error_code LIKE 'terminal\_%' ESCAPE '\';
BEGIN
  SELECT * INTO v_row FROM public.personal_plan_routine_source_change_outbox WHERE id = p_outbox_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status <> 'processing' OR v_row.lease_token IS DISTINCT FROM p_lease_token THEN RETURN false; END IF;
  IF p_processed_revision < 0 OR p_processed_revision > v_row.observed_revision THEN RAISE EXCEPTION 'invalid processed revision' USING ERRCODE = '22023'; END IF;
  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision = CASE WHEN p_error_code IS NULL OR v_terminal THEN p_processed_revision ELSE v_row.processed_revision END,
         status = 'pending',
         available_at = CASE
           WHEN p_processed_revision < v_row.observed_revision THEN pg_catalog.now()
           WHEN v_terminal OR p_error_code IS NULL THEN 'infinity'::timestamptz
           ELSE pg_catalog.now() + interval '30 seconds'
         END,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = p_error_code,
         processed_at = CASE
           WHEN (p_error_code IS NULL OR v_terminal) AND p_processed_revision = v_row.observed_revision THEN pg_catalog.now()
           ELSE processed_at
         END,
         updated_at = pg_catalog.now()
   WHERE id = p_outbox_id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_claim_owner_routine_source_changes(uuid,uuid,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_stage_routine_source_successor(uuid,uuid,uuid,bigint,bigint,text,text,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb,text[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_acquire_catalog_product_for_routine(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_finish_routine_source_change(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_claim_owner_routine_source_changes(uuid,uuid,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_stage_routine_source_successor(uuid,uuid,uuid,bigint,bigint,text,text,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb,text[],text) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_acquire_catalog_product_for_routine(uuid,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_finish_routine_source_change(uuid,uuid,bigint,text) TO service_role;
