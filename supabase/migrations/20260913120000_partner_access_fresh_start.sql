-- Partner access: grant the free access at the claim, not at activation, and give an
-- existing account a "fresh start" so a claiming creator lands in the same state a
-- brand-new partner account would. The reset runs inside the claim transaction, so a
-- failure rolls the whole completion back instead of leaving a half-reset account.

ALTER TABLE public.partner_access_invitations
  ADD COLUMN fresh_start_at timestamptz;

COMMENT ON COLUMN public.partner_access_invitations.fresh_start_at IS
  'Set once when the claim archived the claiming account''s quiz/plan state. Guards the reset against replays.';

GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.partner_access_fresh_start(
  p_user_id uuid,
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  reset_time timestamptz := pg_catalog.now();
BEGIN
  UPDATE public.profiles AS row
     SET onboarding_completed = false,
         onboarding_step = 'welcome',
         has_seen_completion_popup = false
   WHERE row.id = p_user_id;

  DELETE FROM public.hair_profiles AS row WHERE row.user_id = p_user_id;

  -- Creating the plan row here also closes the in-flight creation race: a later
  -- personal_plan_create_or_reuse_initial_need call sees the invitation as the pinned
  -- enrollment source instead of inserting its own row with a stale source.
  INSERT INTO public.personal_plans (user_id, enrollment_purchase_source_id)
  VALUES (p_user_id, p_invitation_id)
  ON CONFLICT (user_id) DO UPDATE
     SET enrollment_purchase_source_id = p_invitation_id,
         current_initial_need_version_id = NULL,
         current_refined_need_version_id = NULL,
         active_routine_version_id = NULL,
         pending_routine_proposal_id = NULL,
         unrefined_direct_accept = false,
         last_evaluated_source_fingerprint = NULL,
         last_rejected_auto_fingerprint = NULL,
         legacy_prefill_v1 = NULL,
         revision = personal_plans.revision + 1,
         updated_at = reset_time;

  UPDATE public.personal_plan_refinement_drafts AS row
     SET status = 'stale', updated_at = reset_time
   WHERE row.user_id = p_user_id AND row.status = 'in_progress';

  UPDATE public.personal_plan_product_drafts AS row
     SET status = 'stale', updated_at = reset_time
   WHERE row.user_id = p_user_id AND row.status = 'active';

  UPDATE public.personal_plan_routine_proposals AS row
     SET status = 'superseded', updated_at = reset_time
   WHERE row.user_id = p_user_id AND row.status = 'pending';

  DELETE FROM public.personal_plan_ui_lifecycle_marks AS row WHERE row.user_id = p_user_id;

  UPDATE public.manual_access_grants AS grant_row
     SET revoked_at = reset_time
   WHERE grant_row.revoked_at IS NULL
     AND grant_row.id IN (
       SELECT enrollment.manual_access_grant_id
         FROM public.personal_plan_test_enrollments AS enrollment
        WHERE enrollment.user_id = p_user_id AND enrollment.status = 'active'
       UNION
       SELECT enrollment.manual_access_grant_id
         FROM public.regular_quiz_test_enrollments AS enrollment
        WHERE enrollment.user_id = p_user_id AND enrollment.status = 'active'
     );

  UPDATE public.personal_plan_test_enrollments AS row
     SET status = 'revoked', revoked_at = reset_time
   WHERE row.user_id = p_user_id AND row.status = 'active';

  UPDATE public.regular_quiz_test_enrollments AS row
     SET status = 'revoked', revoked_at = reset_time
   WHERE row.user_id = p_user_id AND row.status = 'active';

  UPDATE public.personal_plan_quiz_drafts AS row
     SET status = 'expired', updated_at = reset_time
   WHERE row.status = 'active'
     AND row.funnel_session_id IN (
       SELECT session.id FROM public.funnel_sessions AS session WHERE session.user_id = p_user_id
     );

  UPDATE public.personal_plan_result_returns AS row
     SET revoked_at = reset_time
   WHERE row.revoked_at IS NULL
     AND row.lead_id IN (
       SELECT lead.id FROM public.leads AS lead WHERE lead.user_id = p_user_id
     );

  UPDATE public.user_products AS row
     SET ownership_status = 'archived', updated_at = reset_time
   WHERE row.user_id = p_user_id AND row.ownership_status = 'owned';
END;
$$;

REVOKE ALL ON FUNCTION private.partner_access_fresh_start(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.partner_access_fresh_start(uuid, uuid) TO service_role;

DROP FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.complete_partner_access_claim(
  p_invitation_id uuid,
  p_token_version integer,
  p_claim_attempt_id uuid,
  p_user_id uuid,
  p_funnel_session_id uuid,
  p_fresh_start boolean DEFAULT true
)
RETURNS TABLE (
  invitation_id uuid,
  claimed_user_id uuid,
  funnel_session_id uuid,
  reused boolean,
  fresh_start boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  grant_row public.manual_access_grants%ROWTYPE;
  has_active_grant boolean;
  did_fresh_start boolean := false;
  completed_at timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.token_version <> p_token_version THEN
    RAISE EXCEPTION 'partner invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF invitation.claimed_user_id IS NOT NULL THEN
    IF invitation.claimed_user_id IS DISTINCT FROM p_user_id
       OR invitation.funnel_session_id IS DISTINCT FROM p_funnel_session_id THEN
      RAISE EXCEPTION 'partner invitation already claimed' USING ERRCODE = '23505';
    END IF;
    -- Self-heal: a claim completed before free access moved to the claim never got a
    -- grant. Repair it once, while the invitation is still pre-activation and unreset.
    SELECT EXISTS (
      SELECT 1 FROM public.manual_access_grants AS row
       WHERE row.partner_access_invitation_id = invitation.id
         AND row.revoked_at IS NULL
    ) INTO has_active_grant;
    IF NOT has_active_grant
       AND invitation.activated_at IS NULL
       AND invitation.fresh_start_at IS NULL THEN
      INSERT INTO public.manual_access_grants (
        user_id, email, reason, expires_at, partner_access_invitation_id
      ) VALUES (p_user_id, NULL, 'partner', NULL, invitation.id)
      RETURNING * INTO grant_row;
      IF p_fresh_start THEN
        PERFORM private.partner_access_fresh_start(p_user_id, invitation.id);
        did_fresh_start := true;
      END IF;
      UPDATE public.partner_access_invitations AS row
         SET current_manual_access_grant_id = grant_row.id,
             fresh_start_at = CASE WHEN p_fresh_start THEN completed_at ELSE row.fresh_start_at END
       WHERE row.id = invitation.id;
    END IF;
    RETURN QUERY SELECT invitation.id, invitation.claimed_user_id,
      invitation.funnel_session_id, true, did_fresh_start;
    RETURN;
  END IF;
  IF invitation.claim_attempt_id IS DISTINCT FROM p_claim_attempt_id
     OR invitation.claim_attempt_expires_at IS NULL
     OR invitation.claim_attempt_expires_at <= completed_at THEN
    RAISE EXCEPTION 'partner invitation claim is not reserved' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.funnel_sessions AS session
     SET user_id = p_user_id, partner_access_invitation_id = invitation.id,
         test_kind = 'partner'
   WHERE session.id = p_funnel_session_id
     AND session.package_key = 'default_organic'
     AND session.partner_access_invitation_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner funnel session is invalid' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.manual_access_grants (
    user_id, email, reason, expires_at, partner_access_invitation_id
  ) VALUES (p_user_id, NULL, 'partner', NULL, invitation.id)
  RETURNING * INTO grant_row;
  IF p_fresh_start THEN
    PERFORM private.partner_access_fresh_start(p_user_id, invitation.id);
    did_fresh_start := true;
  END IF;
  UPDATE public.partner_access_invitations AS row
     SET claimed_user_id = p_user_id, funnel_session_id = p_funnel_session_id,
         claimed_at = completed_at, claim_attempt_id = NULL, claim_attempt_expires_at = NULL,
         current_manual_access_grant_id = grant_row.id,
         fresh_start_at = CASE WHEN p_fresh_start THEN completed_at ELSE NULL END
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, p_user_id, p_funnel_session_id, false, did_fresh_start;
END;
$$;

-- Activation no longer mints access: the claim already did. It reuses whatever active
-- partner grant the invitation holds and only creates one when none is active.
CREATE OR REPLACE FUNCTION public.activate_partner_access(
  p_invitation_id uuid,
  p_user_id uuid,
  p_funnel_session_id uuid,
  p_lead_id uuid
)
RETURNS TABLE (invitation_id uuid, manual_access_grant_id uuid, activated_at timestamptz, reused boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  grant_row public.manual_access_grants%ROWTYPE;
  activation_time timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL
     OR invitation.claimed_user_id IS DISTINCT FROM p_user_id
     OR invitation.funnel_session_id IS DISTINCT FROM p_funnel_session_id THEN
    RAISE EXCEPTION 'partner access authorization mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF invitation.activated_at IS NOT NULL AND invitation.current_manual_access_grant_id IS NOT NULL THEN
    SELECT * INTO grant_row FROM public.manual_access_grants AS row
     WHERE row.id = invitation.current_manual_access_grant_id;
    IF grant_row.revoked_at IS NULL THEN
      RETURN QUERY SELECT invitation.id, grant_row.id, invitation.activated_at, true;
      RETURN;
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funnel_sessions AS session
     WHERE session.id = p_funnel_session_id
       AND session.user_id = p_user_id
       AND session.lead_id = p_lead_id
       AND session.partner_access_invitation_id = invitation.id
       AND session.test_kind = 'partner'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.leads AS lead
     WHERE lead.id = p_lead_id
       AND lead.user_id = p_user_id
       AND lead.partner_access_invitation_id = invitation.id
  ) THEN
    RAISE EXCEPTION 'partner offer lineage mismatch' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO grant_row FROM public.manual_access_grants AS row
   WHERE row.partner_access_invitation_id = invitation.id
     AND row.revoked_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.manual_access_grants (
      user_id, email, reason, expires_at, partner_access_invitation_id
    ) VALUES (p_user_id, NULL, 'partner', NULL, invitation.id)
    RETURNING * INTO grant_row;
  END IF;
  UPDATE public.partner_access_invitations AS row
     SET lead_id = p_lead_id,
         current_manual_access_grant_id = grant_row.id,
         activated_at = COALESCE(row.activated_at, activation_time)
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, grant_row.id, activation_time, false;
END;
$$;

-- A claimed invitation now carries access even before activation, so un-revoking one
-- has to restore the grant for every claimed invitation, not only activated ones.
CREATE OR REPLACE FUNCTION public.reactivate_partner_access(p_invitation_id uuid)
RETURNS TABLE (invitation_id uuid, manual_access_grant_id uuid, changed boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  grant_row public.manual_access_grants%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'partner invitation not found' USING ERRCODE = 'P0002'; END IF;
  IF invitation.revoked_at IS NULL THEN
    RETURN QUERY SELECT invitation.id, invitation.current_manual_access_grant_id, false;
    RETURN;
  END IF;
  IF invitation.claimed_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manual_access_grants AS row
     WHERE row.partner_access_invitation_id = invitation.id
       AND row.revoked_at IS NULL
  ) THEN
    INSERT INTO public.manual_access_grants (
      user_id, email, reason, expires_at, partner_access_invitation_id
    ) VALUES (
      invitation.claimed_user_id, NULL, 'partner', NULL, invitation.id
    ) RETURNING * INTO grant_row;
  END IF;
  UPDATE public.partner_access_invitations AS row
     SET revoked_at = NULL,
         current_manual_access_grant_id = COALESCE(grant_row.id, row.current_manual_access_grant_id)
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, COALESCE(grant_row.id, invitation.current_manual_access_grant_id), true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_partner_access(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reactivate_partner_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_partner_access(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_partner_access(uuid) TO service_role;
