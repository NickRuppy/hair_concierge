-- The legacy completion RPC intentionally remains pending-proposal first for
-- immediate rollback. This additive version activates only a first Routine;
-- an already-active plan delegates to the legacy successor behavior verbatim.
CREATE OR REPLACE FUNCTION public.personal_plan_complete_draft_activate_initial_v1(
  p_user_id uuid, p_personal_plan_id uuid, p_product_draft_id uuid, p_expected_draft_revision bigint, p_expected_source_revision bigint,
  p_portfolio_schema_version integer, p_portfolio_snapshot jsonb, p_routine_schema_version integer,
  p_routine_compiler_version text, p_routine_authority_versions jsonb, p_routine_source_fingerprint text,
  p_routine_payload jsonb, p_proposal_delta jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_portfolio_id uuid;
  v_routine_id uuid;
  v_proposal_id uuid;
  v_portfolio_hash text;
  v_payload_hash text;
  v_source_revision bigint;
  v_created_at timestamptz := pg_catalog.now();
  v_stored_portfolio jsonb;
  v_stored_routine jsonb;
  v_consumed_rows integer;
BEGIN
  SELECT * INTO v_plan
    FROM public.personal_plans
   WHERE id = p_personal_plan_id AND user_id = p_user_id
   FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'plan_not_found');
  END IF;

  -- Preserve every existing successor and rollback behavior without copying
  -- another lifecycle implementation.
  IF v_plan.active_routine_version_id IS NOT NULL THEN
    RETURN public.personal_plan_complete_product_draft_and_stage_routine(
      p_user_id, p_personal_plan_id, p_product_draft_id, p_expected_draft_revision,
      p_expected_source_revision, p_portfolio_schema_version, p_portfolio_snapshot,
      p_routine_schema_version, p_routine_compiler_version, p_routine_authority_versions,
      p_routine_source_fingerprint, p_routine_payload, p_proposal_delta
    );
  END IF;

  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
   WHERE id = p_product_draft_id
     AND personal_plan_id = p_personal_plan_id
     AND user_id = p_user_id
   FOR UPDATE;
  IF v_draft.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'draft_not_found');
  END IF;

  IF v_draft.status = 'completed' THEN
    SELECT id INTO v_portfolio_id
      FROM public.personal_plan_portfolio_versions
     WHERE source_product_draft_id = v_draft.id;
    SELECT id INTO v_routine_id
      FROM public.personal_plan_routine_versions
     WHERE source_product_draft_id = v_draft.id
     ORDER BY created_at
     LIMIT 1;
    SELECT id INTO v_proposal_id
      FROM public.personal_plan_routine_proposals
     WHERE candidate_routine_version_id = v_routine_id
     ORDER BY created_at
     LIMIT 1;
    -- Initial-active completion has no proposal. A legacy pre-activation
    -- completion is intentionally still observable as a pending proposal.
    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_completed',
      'portfolioVersionId', v_portfolio_id,
      'routineVersionId', v_routine_id,
      'routineProposalId', CASE
        WHEN v_plan.active_routine_version_id IS NOT DISTINCT FROM v_routine_id THEN NULL
        ELSE v_proposal_id
      END,
      'revision', v_plan.revision
    );
  END IF;

  IF v_draft.status <> 'active' OR v_draft.revision <> p_expected_draft_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'revision_conflict', 'currentRevision', v_draft.revision);
  END IF;
  IF v_plan.source_revision <> p_expected_source_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'source_revision_conflict', 'currentSourceRevision', v_plan.source_revision);
  END IF;
  IF v_plan.current_refined_need_version_id IS DISTINCT FROM v_draft.refined_need_version_id THEN
    RETURN pg_catalog.jsonb_build_object('status', 'stale_source', 'currentRefinedNeedVersionId', v_plan.current_refined_need_version_id);
  END IF;
  IF p_portfolio_schema_version <= 0 OR p_routine_schema_version <= 0
     OR p_routine_compiler_version IS NULL OR p_routine_compiler_version = ''
     OR p_routine_source_fingerprint IS NULL OR p_routine_source_fingerprint = ''
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
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_candidate');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') AS item(value)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_products owned
        WHERE owned.id::text = item.value->>'userProductId'
          AND owned.user_id = p_user_id
          AND owned.category = item.value->>'category'
          AND owned.catalog_product_id::text = item.value->>'productId'
          AND owned.identity_status = 'matched'
          AND owned.ownership_status = 'owned'
     )
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') AS item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.user_products pending
         JOIN public.product_submissions submission
           ON submission.user_product_id = pending.id
          AND submission.user_id = pending.user_id
          AND submission.category = pending.category
        WHERE pending.id::text = item.value->>'userProductId'
          AND pending.user_id = p_user_id
          AND pending.category = item.value->>'category'
          AND pending.catalog_product_id IS NULL
          AND pending.identity_status IN ('pending_review', 'needs_more_info')
          AND pending.ownership_status = 'owned'
          AND submission.id::text = item.value->>'submissionId'
          AND submission.status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info')
     )
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'plannedPurchases') AS item(value)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.products planned
        WHERE planned.id::text = item.value->>'productId'
          AND planned.category_key = item.value->>'category'
          AND planned.is_active = true
          AND planned.lifecycle_status = 'active'
          AND planned.is_chaarlie_recommended = true
     )
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_source', 'reasonCode', 'invalid_portfolio_product');
  END IF;

  v_portfolio_id := extensions.uuid_generate_v4();
  v_routine_id := extensions.uuid_generate_v4();
  v_stored_portfolio := p_portfolio_snapshot || pg_catalog.jsonb_build_object(
    'portfolioVersionId', v_portfolio_id, 'createdAt', v_created_at
  );
  v_stored_routine := p_routine_payload || pg_catalog.jsonb_build_object(
    'versionId', v_routine_id, 'planId', p_personal_plan_id, 'createdAt', v_created_at,
    'source',
      CASE WHEN pg_catalog.jsonb_typeof(p_routine_payload->'source') = 'object'
        THEN p_routine_payload->'source' ELSE '{}'::jsonb END ||
      pg_catalog.jsonb_build_object(
        'refinedVersionId', v_draft.refined_need_version_id,
        'productPortfolioVersionId', v_portfolio_id
      )
  );
  IF pg_catalog.octet_length(v_stored_portfolio::text) > 524288
     OR pg_catalog.octet_length(v_stored_routine::text) > 524288
     OR pg_catalog.octet_length(p_proposal_delta::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('status', 'snapshot_too_large');
  END IF;
  v_portfolio_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_portfolio_snapshot - 'portfolioVersionId' - 'createdAt')::text, 'UTF8')), 'hex');
  v_payload_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_routine_payload - 'versionId' - 'createdAt')::text, 'UTF8')), 'hex');

  INSERT INTO public.personal_plan_portfolio_versions (
    id, user_id, personal_plan_id, refined_need_version_id, source_product_draft_id,
    source_product_draft_revision, schema_version, category_authority_versions,
    content_hash, snapshot, created_at
  ) VALUES (
    v_portfolio_id, p_user_id, p_personal_plan_id, v_draft.refined_need_version_id,
    v_draft.id, v_draft.revision, p_portfolio_schema_version,
    v_draft.category_authority_versions, v_portfolio_hash, v_stored_portfolio, v_created_at
  ) ON CONFLICT (source_product_draft_id) DO NOTHING
  RETURNING id INTO v_portfolio_id;
  IF v_portfolio_id IS NULL THEN
    SELECT id INTO v_portfolio_id
      FROM public.personal_plan_portfolio_versions
     WHERE source_product_draft_id = v_draft.id;
  END IF;

  -- Preserve the existing portfolio-event consumption contract and fail the
  -- whole transaction if its row was not settled exactly once.
  v_source_revision := public.personal_plan_enqueue_routine_source_change(
    p_user_id, p_personal_plan_id, 'portfolio_version', v_portfolio_id::text
  );
  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision = observed_revision,
         status = 'pending', available_at = 'infinity'::timestamptz,
         lease_token = NULL, lease_expires_at = NULL, last_error_code = NULL,
         processed_at = pg_catalog.now(), updated_at = pg_catalog.now()
   WHERE personal_plan_id = p_personal_plan_id
     AND source_kind = 'portfolio_version'
     AND source_key = v_portfolio_id::text
     AND observed_revision = v_source_revision
     AND status = 'pending';
  GET DIAGNOSTICS v_consumed_rows = ROW_COUNT;
  IF v_consumed_rows <> 1 THEN
    RAISE EXCEPTION 'initial routine completion did not consume portfolio outbox row';
  END IF;

  INSERT INTO public.personal_plan_routine_versions (
    id, user_id, personal_plan_id, source_refined_need_version_id,
    source_portfolio_version_id, source_product_draft_id, source_product_draft_revision,
    schema_version, compiler_version, authority_versions, source_fingerprint,
    payload_hash, payload, created_at
  ) VALUES (
    v_routine_id, p_user_id, p_personal_plan_id, v_draft.refined_need_version_id,
    v_portfolio_id, v_draft.id, v_draft.revision, p_routine_schema_version,
    p_routine_compiler_version, p_routine_authority_versions,
    p_routine_source_fingerprint, v_payload_hash, v_stored_routine, v_created_at
  ) ON CONFLICT (personal_plan_id, source_portfolio_version_id, payload_hash) DO NOTHING
  RETURNING id INTO v_routine_id;
  IF v_routine_id IS NULL THEN
    SELECT id INTO v_routine_id
      FROM public.personal_plan_routine_versions
     WHERE personal_plan_id = p_personal_plan_id
       AND source_portfolio_version_id = v_portfolio_id
       AND payload_hash = v_payload_hash;
  END IF;

  -- The plan lock prevents an enqueue from observing a newer revision while
  -- this captures its exact Stage 3 IDs. Rows from a later source revision are
  -- deliberately untouched for successor staging.
  UPDATE public.personal_plan_routine_source_change_outbox
     SET processed_revision = observed_revision,
         status = 'pending', available_at = 'infinity'::timestamptz,
         lease_token = NULL, lease_expires_at = NULL, last_error_code = NULL,
         processed_at = pg_catalog.now(), updated_at = pg_catalog.now()
   WHERE user_id = p_user_id
     AND personal_plan_id = p_personal_plan_id
     AND source_kind = 'user_product'
     AND observed_revision <= p_expected_source_revision
     AND source_key IN (
       SELECT item.value->>'userProductId'
         FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'ownedProducts') AS item(value)
       UNION
       SELECT item.value->>'userProductId'
         FROM pg_catalog.jsonb_array_elements(p_portfolio_snapshot->'pendingProducts') AS item(value)
     );

  UPDATE public.personal_plan_product_drafts
     SET status = 'completed', revision = revision + 1, updated_at = pg_catalog.now()
   WHERE id = v_draft.id;
  UPDATE public.personal_plans
     SET active_routine_version_id = v_routine_id,
         pending_routine_proposal_id = NULL,
         revision = revision + 1,
         last_evaluated_source_fingerprint = p_routine_source_fingerprint,
         updated_at = pg_catalog.now()
   WHERE id = v_plan.id
  RETURNING revision INTO v_plan.revision;
  RETURN pg_catalog.jsonb_build_object(
    'status', 'completed', 'portfolioVersionId', v_portfolio_id,
    'routineVersionId', v_routine_id, 'routineProposalId', NULL,
    'revision', v_plan.revision
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.personal_plan_complete_draft_activate_initial_v1(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_complete_draft_activate_initial_v1(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)
  TO service_role;
