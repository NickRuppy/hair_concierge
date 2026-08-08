-- Stage-4 successor lifecycle.  The compiler remains outside SQL; these
-- transitions only persist already-validated immutable compiler output.

CREATE OR REPLACE FUNCTION public.personal_plan_stage_routine_successor(
  p_user_id uuid,
  p_personal_plan_id uuid,
  p_expected_active_routine_version_id uuid,
  p_expected_revision bigint,
  p_expected_source_revision bigint,
  p_source_refined_need_version_id uuid,
  p_source_portfolio_version_id uuid,
  p_source_product_draft_id uuid,
  p_source_product_draft_revision bigint,
  p_routine_schema_version integer,
  p_routine_compiler_version text,
  p_routine_authority_versions jsonb,
  p_routine_source_fingerprint text,
  p_routine_payload jsonb,
  p_proposal_delta jsonb,
  p_direct_operation_keys text[],
  p_origin text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.personal_plans%ROWTYPE;
  v_portfolio public.personal_plan_portfolio_versions%ROWTYPE;
  v_draft public.personal_plan_product_drafts%ROWTYPE;
  v_candidate_id uuid;
  v_proposal_id uuid;
  v_proposal_status text;
  v_payload_hash text;
  v_proposal_fingerprint text;
  v_auto_fingerprint text;
  v_created_at timestamptz := pg_catalog.now();
  v_payload jsonb;
BEGIN
  SELECT * INTO v_plan
    FROM public.personal_plans
   WHERE id = p_personal_plan_id AND user_id = p_user_id
   FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source');
  END IF;
  IF v_plan.active_routine_version_id IS DISTINCT FROM p_expected_active_routine_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'stale_active_version', 'currentActiveRoutineVersionId', v_plan.active_routine_version_id);
  END IF;
  IF v_plan.revision <> p_expected_revision THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'revision_conflict', 'currentRevision', v_plan.revision);
  END IF;
  IF v_plan.source_revision <> p_expected_source_revision THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'source_revision_conflict', 'currentSourceRevision', v_plan.source_revision);
  END IF;
  IF p_routine_schema_version <= 0
     OR p_routine_compiler_version IS NULL OR p_routine_compiler_version = ''
     OR p_routine_source_fingerprint IS NULL OR p_routine_source_fingerprint = ''
     OR p_origin IS NULL OR p_origin NOT IN ('editor', 'source_sync', 'acquisition', 'product_review')
     OR pg_catalog.jsonb_typeof(p_routine_authority_versions) <> 'object'
     OR pg_catalog.jsonb_typeof(p_routine_payload) <> 'object'
     OR pg_catalog.jsonb_typeof(p_proposal_delta) <> 'object'
     OR p_source_product_draft_revision IS NULL OR p_source_product_draft_revision < 0 THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source', 'reasonCode', 'invalid_candidate');
  END IF;

  SELECT * INTO v_portfolio
    FROM public.personal_plan_portfolio_versions
   WHERE id = p_source_portfolio_version_id
     AND user_id = p_user_id
     AND personal_plan_id = p_personal_plan_id
   FOR KEY SHARE;
  SELECT * INTO v_draft
    FROM public.personal_plan_product_drafts
   WHERE id = p_source_product_draft_id
     AND user_id = p_user_id
     AND personal_plan_id = p_personal_plan_id
   FOR KEY SHARE;
  IF v_portfolio.id IS NULL OR v_draft.id IS NULL
     OR v_plan.current_refined_need_version_id IS DISTINCT FROM p_source_refined_need_version_id
     OR v_portfolio.refined_need_version_id IS DISTINCT FROM p_source_refined_need_version_id
     OR v_portfolio.source_product_draft_id IS DISTINCT FROM p_source_product_draft_id
     OR v_portfolio.source_product_draft_revision <> p_source_product_draft_revision
     OR v_draft.refined_need_version_id IS DISTINCT FROM p_source_refined_need_version_id
     -- Completion advances the mutable draft revision after freezing the
     -- portfolio's source revision, so the current completed draft may be one
     -- revision ahead of that immutable source reference.
     OR v_draft.revision < p_source_product_draft_revision
     OR v_draft.status <> 'completed' THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'stale_source');
  END IF;

  v_candidate_id := extensions.uuid_generate_v4();
  v_payload := p_routine_payload || pg_catalog.jsonb_build_object(
    'versionId', v_candidate_id,
    'planId', p_personal_plan_id,
    'parentVersionId', v_plan.active_routine_version_id,
    'createdAt', v_created_at,
    'source',
      CASE WHEN pg_catalog.jsonb_typeof(p_routine_payload->'source') = 'object'
        THEN p_routine_payload->'source' ELSE '{}'::jsonb END ||
      pg_catalog.jsonb_build_object(
        'refinedVersionId', p_source_refined_need_version_id,
        'productPortfolioVersionId', p_source_portfolio_version_id,
        'sourceFingerprint', p_routine_source_fingerprint
      )
  );
  IF pg_catalog.octet_length(v_payload::text) > 524288
     OR pg_catalog.octet_length(p_proposal_delta::text) > 524288 THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source', 'reasonCode', 'snapshot_too_large');
  END IF;
  v_payload_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    (p_routine_payload - 'versionId' - 'createdAt')::text, 'UTF8'
  )), 'hex');
  -- The service filters true no-semantic-change results before staging. Here
  -- the source fingerprint participates so a later relevant source change may
  -- legitimately re-enable an otherwise identical automatic proposal.
  v_auto_fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    v_payload_hash || ':' || p_proposal_delta::text || ':' || pg_catalog.array_to_string(coalesce(p_direct_operation_keys, '{}'::text[]), ','), 'UTF8'
  )), 'hex');
  v_proposal_fingerprint := CASE WHEN p_origin = 'editor' THEN
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_auto_fingerprint || ':editor', 'UTF8')), 'hex')
  ELSE v_auto_fingerprint END;
  IF p_origin IN ('source_sync', 'acquisition', 'product_review')
     AND v_plan.last_rejected_auto_fingerprint = v_auto_fingerprint THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'suppressed_rejected', 'revision', v_plan.revision);
  END IF;

  INSERT INTO public.personal_plan_routine_versions (
    id, user_id, personal_plan_id, parent_routine_version_id,
    source_refined_need_version_id, source_portfolio_version_id,
    source_product_draft_id, source_product_draft_revision,
    schema_version, compiler_version, authority_versions, source_fingerprint,
    payload_hash, payload, created_at
  ) VALUES (
    v_candidate_id, p_user_id, p_personal_plan_id, v_plan.active_routine_version_id,
    p_source_refined_need_version_id, p_source_portfolio_version_id,
    p_source_product_draft_id, p_source_product_draft_revision,
    p_routine_schema_version, p_routine_compiler_version, p_routine_authority_versions,
    p_routine_source_fingerprint, v_payload_hash, v_payload, v_created_at
  ) ON CONFLICT (personal_plan_id, source_portfolio_version_id, payload_hash) DO NOTHING
  RETURNING id INTO v_candidate_id;
  IF v_candidate_id IS NULL THEN
    SELECT id INTO v_candidate_id
      FROM public.personal_plan_routine_versions
     WHERE personal_plan_id = p_personal_plan_id
       AND source_portfolio_version_id = p_source_portfolio_version_id
       AND payload_hash = v_payload_hash;
  END IF;

  SELECT id, status INTO v_proposal_id, v_proposal_status
    FROM public.personal_plan_routine_proposals
   WHERE personal_plan_id = p_personal_plan_id
     AND candidate_routine_version_id = v_candidate_id
     AND proposal_fingerprint = v_proposal_fingerprint;
  IF v_proposal_id IS NOT NULL THEN
    IF v_proposal_status IN ('pending', 'superseded', 'rejected')
       AND v_plan.pending_routine_proposal_id IS DISTINCT FROM v_proposal_id THEN
      UPDATE public.personal_plan_routine_proposals
         SET status = 'superseded', updated_at = pg_catalog.now()
       WHERE personal_plan_id = p_personal_plan_id
         AND status = 'pending'
         AND id IS DISTINCT FROM v_proposal_id;
      IF v_proposal_status <> 'pending' THEN
        UPDATE public.personal_plan_routine_proposals
           SET status = 'pending', source_revision = p_expected_source_revision,
               source_fingerprint = p_routine_source_fingerprint, updated_at = pg_catalog.now()
         WHERE id = v_proposal_id AND status IN ('superseded', 'rejected')
        RETURNING status INTO v_proposal_status;
        -- Do not repoint the plan unless this proposal was made pending again.
        IF NOT FOUND THEN
          RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source', 'reasonCode', 'proposal_not_restageable');
        END IF;
      END IF;
      UPDATE public.personal_plans
         SET pending_routine_proposal_id = v_proposal_id, revision = revision + 1,
             updated_at = pg_catalog.now()
       WHERE id = v_plan.id
      RETURNING revision INTO v_plan.revision;
    END IF;
    RETURN pg_catalog.jsonb_build_object('outcome', 'already_staged', 'routineVersionId', v_candidate_id, 'routineProposalId', v_proposal_id, 'revision', v_plan.revision);
  END IF;

  UPDATE public.personal_plan_routine_proposals
     SET status = 'superseded', updated_at = pg_catalog.now()
   WHERE personal_plan_id = p_personal_plan_id AND status = 'pending';
  INSERT INTO public.personal_plan_routine_proposals (
    user_id, personal_plan_id, base_routine_version_id, candidate_routine_version_id,
    origin, status, source_revision, source_fingerprint, proposal_fingerprint,
    delta, direct_operation_keys
  ) VALUES (
    p_user_id, p_personal_plan_id, v_plan.active_routine_version_id, v_candidate_id,
    p_origin, 'pending', p_expected_source_revision, p_routine_source_fingerprint,
    v_proposal_fingerprint, p_proposal_delta, coalesce(p_direct_operation_keys, '{}'::text[])
  ) RETURNING id INTO v_proposal_id;
  UPDATE public.personal_plans
     SET pending_routine_proposal_id = v_proposal_id, revision = revision + 1,
         updated_at = pg_catalog.now()
   WHERE id = v_plan.id
  RETURNING revision INTO v_plan.revision;
  RETURN pg_catalog.jsonb_build_object('outcome', 'staged', 'routineVersionId', v_candidate_id, 'routineProposalId', v_proposal_id, 'revision', v_plan.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_reject_routine_proposal(
  p_user_id uuid, p_personal_plan_id uuid, p_proposal_id uuid, p_expected_revision bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE; v_proposal public.personal_plan_routine_proposals%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans
   WHERE id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source'); END IF;
  SELECT * INTO v_proposal FROM public.personal_plan_routine_proposals
   WHERE id = p_proposal_id AND personal_plan_id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source'); END IF;
  IF v_plan.revision <> p_expected_revision THEN RETURN pg_catalog.jsonb_build_object('outcome', 'revision_conflict', 'currentRevision', v_plan.revision); END IF;
  IF v_plan.pending_routine_proposal_id IS DISTINCT FROM v_proposal.id OR v_proposal.status <> 'pending' THEN RETURN pg_catalog.jsonb_build_object('outcome', 'stale_proposal'); END IF;
  IF v_plan.active_routine_version_id IS NULL AND v_proposal.base_routine_version_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'initial_proposal_not_rejectable');
  END IF;
  UPDATE public.personal_plan_routine_proposals SET status = 'rejected', updated_at = pg_catalog.now() WHERE id = v_proposal.id;
  UPDATE public.personal_plans
     SET pending_routine_proposal_id = NULL,
         last_rejected_auto_fingerprint = CASE
           WHEN v_proposal.origin IN ('source_sync', 'acquisition', 'product_review') THEN v_proposal.proposal_fingerprint
           ELSE last_rejected_auto_fingerprint
         END,
         revision = revision + 1, updated_at = pg_catalog.now()
   WHERE id = v_plan.id
  RETURNING revision INTO v_plan.revision;
  RETURN pg_catalog.jsonb_build_object('outcome', 'rejected', 'revision', v_plan.revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.personal_plan_record_routine_no_semantic_change(
  p_user_id uuid, p_personal_plan_id uuid, p_expected_active_routine_version_id uuid,
  p_expected_revision bigint, p_expected_source_revision bigint, p_source_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.personal_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.personal_plans
   WHERE id = p_personal_plan_id AND user_id = p_user_id FOR UPDATE;
  IF v_plan.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source'); END IF;
  IF v_plan.active_routine_version_id IS DISTINCT FROM p_expected_active_routine_version_id THEN
    RETURN pg_catalog.jsonb_build_object('outcome', 'stale_active_version', 'currentActiveRoutineVersionId', v_plan.active_routine_version_id);
  END IF;
  IF v_plan.revision <> p_expected_revision THEN RETURN pg_catalog.jsonb_build_object('outcome', 'revision_conflict', 'currentRevision', v_plan.revision); END IF;
  IF v_plan.source_revision <> p_expected_source_revision THEN RETURN pg_catalog.jsonb_build_object('outcome', 'source_revision_conflict', 'currentSourceRevision', v_plan.source_revision); END IF;
  IF p_source_fingerprint IS NULL OR p_source_fingerprint = '' THEN RETURN pg_catalog.jsonb_build_object('outcome', 'invalid_source', 'reasonCode', 'invalid_fingerprint'); END IF;
  UPDATE public.personal_plans
     SET last_evaluated_source_fingerprint = p_source_fingerprint, updated_at = pg_catalog.now()
   WHERE id = v_plan.id;
  RETURN pg_catalog.jsonb_build_object('outcome', 'no_semantic_change', 'revision', v_plan.revision);
END;
$$;

REVOKE ALL ON FUNCTION public.personal_plan_stage_routine_successor(uuid,uuid,uuid,bigint,bigint,uuid,uuid,uuid,bigint,integer,text,jsonb,text,jsonb,jsonb,text[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_reject_routine_proposal(uuid,uuid,uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.personal_plan_record_routine_no_semantic_change(uuid,uuid,uuid,bigint,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_plan_stage_routine_successor(uuid,uuid,uuid,bigint,bigint,uuid,uuid,uuid,bigint,integer,text,jsonb,text,jsonb,jsonb,text[],text) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_reject_routine_proposal(uuid,uuid,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.personal_plan_record_routine_no_semantic_change(uuid,uuid,uuid,bigint,bigint,text) TO service_role;
