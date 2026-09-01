CREATE TABLE public.partner_access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (display_name = btrim(display_name) AND display_name <> ''),
  normalized_email text NOT NULL CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_version integer NOT NULL DEFAULT 1 CHECK (token_version > 0),
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  claimed_user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  funnel_session_id uuid REFERENCES public.funnel_sessions (id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.leads (id) ON DELETE RESTRICT,
  claim_attempt_id uuid,
  claim_attempt_expires_at timestamptz,
  claimed_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  email_corrected_at timestamptz,
  invitation_email_message_id text,
  invitation_email_accepted_at timestamptz,
  invitation_email_last_attempt_at timestamptz,
  invitation_email_status text NOT NULL DEFAULT 'not_requested'
    CHECK (invitation_email_status IN ('not_requested', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_access_claim_attempt_pair CHECK (
    (claim_attempt_id IS NULL) = (claim_attempt_expires_at IS NULL)
  ),
  CONSTRAINT partner_access_claim_pair CHECK (
    (claimed_user_id IS NULL) = (claimed_at IS NULL)
  ),
  CONSTRAINT partner_access_activation_requires_claim CHECK (
    activated_at IS NULL OR claimed_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX partner_access_one_current_email
  ON public.partner_access_invitations (normalized_email)
  WHERE revoked_at IS NULL;

CREATE INDEX partner_access_invitations_claimed_user
  ON public.partner_access_invitations (claimed_user_id)
  WHERE claimed_user_id IS NOT NULL;

CREATE UNIQUE INDEX partner_access_one_current_claimed_user
  ON public.partner_access_invitations (claimed_user_id)
  WHERE claimed_user_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE public.partner_access_email_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.partner_access_invitations (id) ON DELETE CASCADE,
  token_version integer NOT NULL CHECK (token_version > 0),
  proposed_normalized_email text NOT NULL CHECK (
    proposed_normalized_email = lower(btrim(proposed_normalized_email))
    AND proposed_normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partner_access_one_pending_email_change
  ON public.partner_access_email_changes (invitation_id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.manual_access_grants
  DROP CONSTRAINT IF EXISTS manual_access_grants_reason_check;

ALTER TABLE public.manual_access_grants
  ADD CONSTRAINT manual_access_grants_reason_check
  CHECK (reason IN ('friend', 'tester', 'admin', 'support', 'partner'));

ALTER TABLE public.manual_access_grants
  ADD COLUMN partner_access_invitation_id uuid
  REFERENCES public.partner_access_invitations (id) ON DELETE RESTRICT;

ALTER TABLE public.manual_access_grants
  ADD CONSTRAINT manual_access_grants_partner_shape CHECK (
    (reason = 'partner') = (partner_access_invitation_id IS NOT NULL)
  );

CREATE UNIQUE INDEX partner_access_one_active_grant_per_invitation
  ON public.manual_access_grants (partner_access_invitation_id)
  WHERE revoked_at IS NULL AND partner_access_invitation_id IS NOT NULL;

ALTER TABLE public.partner_access_invitations
  ADD COLUMN current_manual_access_grant_id uuid
  REFERENCES public.manual_access_grants (id) ON DELETE RESTRICT;

ALTER TABLE public.funnel_sessions
  ADD COLUMN partner_access_invitation_id uuid
  REFERENCES public.partner_access_invitations (id) ON DELETE RESTRICT;

ALTER TABLE public.funnel_sessions
  DROP CONSTRAINT IF EXISTS funnel_sessions_field_test_context_check;

ALTER TABLE public.funnel_sessions
  ADD CONSTRAINT funnel_sessions_field_test_context_check CHECK (
    (test_kind IS NULL AND field_test_campaign_id IS NULL)
    OR (test_kind = 'field_test' AND field_test_campaign_id IS NOT NULL)
    OR (test_kind = 'partner' AND field_test_campaign_id IS NULL)
  );

ALTER TABLE public.leads
  ADD COLUMN partner_access_invitation_id uuid
  REFERENCES public.partner_access_invitations (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX partner_access_one_funnel_per_invitation
  ON public.funnel_sessions (partner_access_invitation_id)
  WHERE partner_access_invitation_id IS NOT NULL;

CREATE UNIQUE INDEX partner_access_one_lead_per_invitation
  ON public.leads (partner_access_invitation_id)
  WHERE partner_access_invitation_id IS NOT NULL;

CREATE TRIGGER set_updated_at_partner_access_invitations
  BEFORE UPDATE ON public.partner_access_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_partner_access_email_changes
  BEFORE UPDATE ON public.partner_access_email_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.partner_access_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_access_email_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_access_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.partner_access_email_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_access_invitations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_access_email_changes TO service_role;

CREATE OR REPLACE FUNCTION public.create_partner_access_invitations(
  p_invitations jsonb,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS TABLE (invitation_id uuid, display_name text, normalized_email text, token_version integer)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  saved public.partner_access_invitations%ROWTYPE;
  item_name text;
  item_email text;
BEGIN
  IF jsonb_typeof(p_invitations) <> 'array' OR jsonb_array_length(p_invitations) < 1
     OR jsonb_array_length(p_invitations) > 100 THEN
    RAISE EXCEPTION 'invalid partner invitation batch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_invitations) AS raw(value)
     GROUP BY lower(btrim(raw.value ->> 'email'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate partner invitation email' USING ERRCODE = '23505';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_invitations) LOOP
    item_name := btrim(item ->> 'name');
    item_email := lower(btrim(item ->> 'email'));
    IF item_name IS NULL OR item_name = '' OR item_email IS NULL OR item_email = '' THEN
      RAISE EXCEPTION 'invalid partner invitation entry' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.partner_access_invitations (
      display_name, normalized_email, created_by_user_id
    ) VALUES (item_name, item_email, p_created_by_user_id)
    RETURNING * INTO saved;
    RETURN QUERY SELECT saved.id, saved.display_name, saved.normalized_email, saved.token_version;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_partner_access_claim(
  p_invitation_id uuid,
  p_token_version integer,
  p_claim_attempt_id uuid,
  p_claim_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE (
  invitation_id uuid,
  display_name text,
  normalized_email text,
  claimed_user_id uuid,
  reused boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  claim_time timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO invitation
    FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id
   FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.token_version <> p_token_version THEN
    RAISE EXCEPTION 'partner invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF invitation.claimed_user_id IS NOT NULL THEN
    RETURN QUERY SELECT invitation.id, invitation.display_name, invitation.normalized_email,
      invitation.claimed_user_id, true;
    RETURN;
  END IF;
  IF invitation.claim_attempt_id IS NOT NULL
     AND invitation.claim_attempt_id <> p_claim_attempt_id
     AND invitation.claim_attempt_expires_at > claim_time THEN
    RAISE EXCEPTION 'partner invitation claim in progress' USING ERRCODE = '55P03';
  END IF;
  UPDATE public.partner_access_invitations AS row
     SET claim_attempt_id = p_claim_attempt_id,
         claim_attempt_expires_at = claim_time + pg_catalog.make_interval(
           secs => LEAST(GREATEST(p_claim_ttl_seconds, 60), 1800)
         )
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, invitation.display_name, invitation.normalized_email,
    NULL::uuid, COALESCE(invitation.claim_attempt_id = p_claim_attempt_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_partner_access_claim(
  p_invitation_id uuid,
  p_token_version integer,
  p_claim_attempt_id uuid,
  p_user_id uuid,
  p_funnel_session_id uuid
)
RETURNS TABLE (invitation_id uuid, claimed_user_id uuid, funnel_session_id uuid, reused boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
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
    RETURN QUERY SELECT invitation.id, invitation.claimed_user_id,
      invitation.funnel_session_id, true;
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
  UPDATE public.partner_access_invitations AS row
     SET claimed_user_id = p_user_id, funnel_session_id = p_funnel_session_id,
         claimed_at = completed_at, claim_attempt_id = NULL, claim_attempt_expires_at = NULL
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, p_user_id, p_funnel_session_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_partner_access_claim(
  p_invitation_id uuid,
  p_token_version integer,
  p_claim_attempt_id uuid
)
RETURNS TABLE (released boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  did_release boolean;
BEGIN
  UPDATE public.partner_access_invitations AS row
     SET claim_attempt_id = NULL,
         claim_attempt_expires_at = NULL
   WHERE row.id = p_invitation_id
     AND row.token_version = p_token_version
     AND row.claimed_user_id IS NULL
     AND row.claim_attempt_id = p_claim_attempt_id
  RETURNING true INTO did_release;

  RETURN QUERY SELECT COALESCE(did_release, false);
END;
$$;

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
  INSERT INTO public.manual_access_grants (
    user_id, email, reason, expires_at, partner_access_invitation_id
  ) VALUES (p_user_id, NULL, 'partner', NULL, invitation.id)
  RETURNING * INTO grant_row;
  UPDATE public.partner_access_invitations AS row
     SET lead_id = p_lead_id,
         current_manual_access_grant_id = grant_row.id,
         activated_at = COALESCE(row.activated_at, activation_time)
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, grant_row.id, activation_time, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_partner_access(p_invitation_id uuid)
RETURNS TABLE (invitation_id uuid, revoked_at timestamptz, changed boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  revocation_time timestamptz := pg_catalog.now();
  invitation public.partner_access_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'partner invitation not found' USING ERRCODE = 'P0002'; END IF;
  IF invitation.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT invitation.id, invitation.revoked_at, false;
    RETURN;
  END IF;
  UPDATE public.manual_access_grants AS grant_row
     SET revoked_at = revocation_time
   WHERE grant_row.id = invitation.current_manual_access_grant_id
     AND grant_row.reason = 'partner' AND grant_row.revoked_at IS NULL;
  UPDATE public.partner_access_invitations AS row SET revoked_at = revocation_time
   WHERE row.id = invitation.id;
  RETURN QUERY SELECT invitation.id, revocation_time, true;
END;
$$;

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
  IF invitation.claimed_user_id IS NOT NULL AND invitation.activated_at IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.rotate_partner_access_invitation(p_invitation_id uuid)
RETURNS TABLE (invitation_id uuid, token_version integer)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  rotated_id uuid;
  rotated_version integer;
BEGIN
  UPDATE public.partner_access_invitations AS row
     SET token_version = row.token_version + 1
   WHERE row.id = p_invitation_id
     AND row.revoked_at IS NULL
  RETURNING row.id, row.token_version INTO rotated_id, rotated_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'partner invitation unavailable' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.partner_access_email_changes AS row
     SET consumed_at = pg_catalog.now()
   WHERE row.invitation_id = rotated_id
     AND row.consumed_at IS NULL;

  RETURN QUERY SELECT rotated_id, rotated_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_partner_access_email_change(
  p_invitation_id uuid,
  p_token_version integer,
  p_proposed_normalized_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (email_change_id uuid, proposed_normalized_email text, expires_at timestamptz)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  saved public.partner_access_email_changes%ROWTYPE;
  change_time timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.token_version <> p_token_version
     OR invitation.claimed_user_id IS NOT NULL OR p_expires_at <= change_time THEN
    RAISE EXCEPTION 'partner invitation cannot change email' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.partner_access_email_changes AS row
     WHERE row.invitation_id = invitation.id
       AND row.consumed_at IS NULL
       AND row.created_at > change_time - interval '60 seconds'
  ) OR (
    SELECT count(*) FROM public.partner_access_email_changes AS row
     WHERE row.invitation_id = invitation.id
       AND row.created_at > change_time - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'too many partner email changes' USING ERRCODE = '55P03';
  END IF;
  UPDATE public.partner_access_email_changes AS row
     SET consumed_at = change_time
   WHERE row.invitation_id = invitation.id AND row.consumed_at IS NULL;
  INSERT INTO public.partner_access_email_changes (
    invitation_id, token_version, proposed_normalized_email, token_hash, expires_at
  ) VALUES (
    invitation.id, invitation.token_version, lower(btrim(p_proposed_normalized_email)),
    p_token_hash, p_expires_at
  ) RETURNING * INTO saved;
  RETURN QUERY SELECT saved.id, saved.proposed_normalized_email, saved.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_partner_access_lead(
  p_invitation_id uuid,
  p_user_id uuid,
  p_funnel_session_id uuid,
  p_confirmed_email text,
  p_name text,
  p_marketing_consent boolean,
  p_quiz_answers jsonb
)
RETURNS TABLE (lead_id uuid, reused boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invitation public.partner_access_invitations%ROWTYPE;
  saved public.leads%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL
     OR invitation.claimed_user_id IS DISTINCT FROM p_user_id
     OR invitation.funnel_session_id IS DISTINCT FROM p_funnel_session_id
     OR invitation.normalized_email IS DISTINCT FROM lower(btrim(p_confirmed_email)) THEN
    RAISE EXCEPTION 'partner quiz authorization mismatch' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO saved FROM public.leads AS lead
   WHERE lead.partner_access_invitation_id = invitation.id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.leads AS lead
       SET name = btrim(p_name), marketing_consent = p_marketing_consent,
           quiz_answers = p_quiz_answers, email = invitation.normalized_email,
           user_id = p_user_id, status = 'linked'
     WHERE lead.id = saved.id RETURNING * INTO saved;
    RETURN QUERY SELECT saved.id, true;
    RETURN;
  END IF;
  INSERT INTO public.leads (
    name, email, marketing_consent, quiz_answers, quiz_kind, status,
    user_id, partner_access_invitation_id
  ) VALUES (
    btrim(p_name), invitation.normalized_email, p_marketing_consent, p_quiz_answers,
    'legacy', 'linked', p_user_id, invitation.id
  ) RETURNING * INTO saved;
  UPDATE public.funnel_sessions AS session
     SET lead_id = saved.id
   WHERE session.id = p_funnel_session_id
     AND session.user_id = p_user_id
     AND session.partner_access_invitation_id = invitation.id
     AND session.test_kind = 'partner';
  IF NOT FOUND THEN RAISE EXCEPTION 'partner funnel is invalid' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.partner_access_invitations AS row SET lead_id = saved.id WHERE row.id = invitation.id;
  RETURN QUERY SELECT saved.id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_partner_access_email_change(p_token_hash text)
RETURNS TABLE (
  invitation_id uuid,
  display_name text,
  normalized_email text,
  token_version integer
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  email_change public.partner_access_email_changes%ROWTYPE;
  invitation public.partner_access_invitations%ROWTYPE;
  consume_time timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO email_change FROM public.partner_access_email_changes AS row
   WHERE row.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR email_change.consumed_at IS NOT NULL OR email_change.expires_at <= consume_time THEN
    RAISE EXCEPTION 'partner email change unavailable' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO invitation FROM public.partner_access_invitations AS row
   WHERE row.id = email_change.invitation_id FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.claimed_user_id IS NOT NULL
     OR invitation.token_version <> email_change.token_version THEN
    RAISE EXCEPTION 'partner email change unavailable' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.partner_access_invitations AS row
     SET normalized_email = email_change.proposed_normalized_email,
         email_corrected_at = consume_time,
         token_version = row.token_version + 1
   WHERE row.id = invitation.id
   RETURNING * INTO invitation;
  UPDATE public.partner_access_email_changes AS row
     SET consumed_at = consume_time
   WHERE row.id = email_change.id;
  RETURN QUERY SELECT invitation.id, invitation.display_name,
    invitation.normalized_email, invitation.token_version;
END;
$$;

REVOKE ALL ON FUNCTION public.create_partner_access_invitations(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_partner_access_claim(uuid, integer, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_partner_access_claim(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_partner_access(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_partner_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reactivate_partner_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_partner_access_invitation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_partner_access_email_change(uuid, integer, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_partner_access_email_change(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_partner_access_lead(uuid, uuid, uuid, text, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_partner_access_invitations(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_partner_access_claim(uuid, integer, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_partner_access_claim(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_partner_access_claim(uuid, integer, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_partner_access(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_partner_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_partner_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_partner_access_invitation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_partner_access_email_change(uuid, integer, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_partner_access_email_change(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_partner_access_lead(uuid, uuid, uuid, text, text, boolean, jsonb) TO service_role;

COMMENT ON TABLE public.partner_access_invitations IS
  'Service-operated personal creator invitations with indefinite, revocable partner access.';
COMMENT ON COLUMN public.partner_access_invitations.token_version IS
  'Version bound into the reproducible HMAC credential. Incrementing rotates the personal link.';

CREATE OR REPLACE FUNCTION private.personal_plan_get_own_partner_routing_source()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation public.partner_access_invitations%ROWTYPE;
  v_plan jsonb;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT invitation.* INTO v_invitation
    FROM public.partner_access_invitations AS invitation
    JOIN public.manual_access_grants AS grant_row
      ON grant_row.id = invitation.current_manual_access_grant_id
     AND grant_row.user_id = v_user_id
     AND grant_row.reason = 'partner'
     AND grant_row.partner_access_invitation_id = invitation.id
     AND grant_row.expires_at IS NULL
     AND grant_row.revoked_at IS NULL
   WHERE invitation.claimed_user_id = v_user_id
     AND invitation.lead_id IS NOT NULL
     AND invitation.activated_at IS NOT NULL
     AND invitation.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT pg_catalog.jsonb_build_object(
      'current_initial_need_version_id', plan.current_initial_need_version_id,
      'current_refined_need_version_id', plan.current_refined_need_version_id,
      'pending_routine_proposal_id', plan.pending_routine_proposal_id,
      'active_routine_version_id', plan.active_routine_version_id
    ) INTO v_plan
    FROM public.personal_plans AS plan
   WHERE plan.user_id = v_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'source_id', v_invitation.id,
    'qualified_at', v_invitation.activated_at,
    'lead_id', v_invitation.lead_id,
    'quiz_source_kind', 'legacy',
    'source_kind', 'partner',
    'migration_status', NULL,
    'admission_kind', NULL,
    'admission_source_id', NULL,
    'plan', v_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_get_own_partner_routing_source()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_get_own_partner_routing_source()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.personal_plan_get_own_partner_routing_source()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.personal_plan_get_own_partner_routing_source();
$$;

REVOKE ALL ON FUNCTION public.personal_plan_get_own_partner_routing_source()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.personal_plan_get_own_partner_routing_source()
  TO authenticated, service_role;
