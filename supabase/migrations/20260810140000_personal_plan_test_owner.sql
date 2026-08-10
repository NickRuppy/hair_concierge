-- One exact reusable QA owner for authenticated post-payment Personal Plan review.
-- Auth creation and one-time session issuance remain in the repository operator CLI;
-- this RPC atomically prepares only the correlated database source state.
CREATE OR REPLACE FUNCTION public.prepare_personal_plan_test_owner(
  p_user_id uuid,
  p_quiz_answers jsonb,
  p_canonical_profile jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  expected_email constant text := 'personal-plan-qa@hairconscierge.test';
  source_time constant timestamptz := '2026-08-10T12:00:00.000Z'::timestamptz;
  v_campaign_id constant uuid := 'b2a10000-0000-4000-8000-000000000001'::uuid;
  v_lead_id constant uuid := 'b2a10000-0000-4000-8000-000000000002'::uuid;
  v_funnel_session_id constant uuid := 'b2a10000-0000-4000-8000-000000000003'::uuid;
  v_consent_id constant uuid := 'b2a10000-0000-4000-8000-000000000004'::uuid;
  v_purchase_id constant uuid := 'b2a10000-0000-4000-8000-000000000005'::uuid;
  v_artifact_id constant uuid := 'b2a10000-0000-4000-8000-000000000006'::uuid;
  v_visitor_id constant uuid := 'b2a10000-0000-4000-8000-000000000007'::uuid;
  v_manual_access_grant_id constant uuid := 'b2a10000-0000-4000-8000-000000000008'::uuid;
  v_enrollment_id constant uuid := 'b2a10000-0000-4000-8000-000000000009'::uuid;
  v_provider_transaction_id constant text := 'personal-plan-qa-owner-v1';
  v_answer_hash constant text := repeat('a', 64);
  v_claim_token_hash constant text := repeat('b', 64);
  v_campaign_token_hash constant text := repeat('c', 64);
BEGIN
  IF p_user_id IS NULL
     OR pg_catalog.jsonb_typeof(p_quiz_answers) IS DISTINCT FROM 'object'
     OR p_quiz_answers->>'kind' IS DISTINCT FROM 'personal_plan'
     OR p_quiz_answers->>'version' IS DISTINCT FROM '3'
     OR pg_catalog.jsonb_typeof(p_quiz_answers->'answers') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_canonical_profile) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid personal plan test owner source' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM auth.users AS auth_user
   WHERE auth_user.id = p_user_id
     AND pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = expected_email
     AND auth_user.raw_app_meta_data @> '{"personal_plan_test_owner":true}'::jsonb
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'personal plan test owner identity mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles AS profile
     WHERE pg_catalog.lower(pg_catalog.btrim(profile.email)) = expected_email
       AND profile.id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting profile state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.leads AS lead
     WHERE (
       lead.user_id = p_user_id
       OR pg_catalog.lower(pg_catalog.btrim(lead.email)) = expected_email
       OR lead.id = v_lead_id
     )
       AND lead.id <> v_lead_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting lead state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.funnel_sessions AS session
     WHERE (session.user_id = p_user_id OR session.lead_id = v_lead_id OR session.id = v_funnel_session_id)
       AND session.id <> v_funnel_session_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting funnel state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.personal_plan_one_time_checkout_consents AS consent
     WHERE (consent.user_id = p_user_id OR consent.lead_id = v_lead_id OR consent.id = v_consent_id)
       AND consent.id <> v_consent_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting consent state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.billing_one_time_purchases AS purchase
     WHERE (
       purchase.user_id = p_user_id
       OR purchase.consent_id = v_consent_id
       OR purchase.id = v_purchase_id
       OR (purchase.provider = 'stripe' AND purchase.provider_transaction_id = v_provider_transaction_id)
     )
       AND purchase.id <> v_purchase_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting purchase state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.personal_plan_prepared_artifacts AS artifact
     WHERE (
       artifact.user_id = p_user_id
       OR artifact.lead_id = v_lead_id
       OR artifact.id = v_artifact_id
       OR artifact.claim_token_hash = v_claim_token_hash
     )
       AND artifact.id <> v_artifact_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting artifact state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.manual_access_grants AS access_grant
     WHERE (access_grant.user_id = p_user_id OR access_grant.id = v_manual_access_grant_id)
       AND access_grant.id <> v_manual_access_grant_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting manual grant state' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.personal_plan_test_enrollments AS enrollment
     WHERE (
       enrollment.user_id = p_user_id
       OR enrollment.id = v_enrollment_id
       OR (enrollment.campaign_id = v_campaign_id AND enrollment.lead_id = v_lead_id)
       OR enrollment.manual_access_grant_id = v_manual_access_grant_id
       OR enrollment.prepared_artifact_id = v_artifact_id
     )
       AND enrollment.id <> v_enrollment_id
  ) THEN
    RAISE EXCEPTION 'personal plan test owner has conflicting enrollment state' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, onboarding_completed, onboarding_step, is_admin,
    subscription_status, subscription_interval, current_period_end
  ) VALUES (
    p_user_id, expected_email, 'Personal Plan QA', true, 'celebration', false,
    'active', 'month', '2099-01-01T00:00:00.000Z'::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = excluded.full_name,
    onboarding_completed = excluded.onboarding_completed,
    onboarding_step = excluded.onboarding_step,
    is_admin = excluded.is_admin,
    subscription_status = excluded.subscription_status,
    subscription_interval = excluded.subscription_interval,
    current_period_end = excluded.current_period_end;

  INSERT INTO public.manual_access_grants (
    id, user_id, email, reason, expires_at, revoked_at, created_at, updated_at
  ) VALUES (
    v_manual_access_grant_id, p_user_id, NULL, 'tester',
    '2099-01-01T00:00:00.000Z'::timestamptz, NULL, source_time, source_time
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.personal_plan_test_campaigns (
    id, name, token_hash, status, starts_at, expires_at, max_activations,
    access_duration_hours, created_at, revoked_at
  ) VALUES (
    v_campaign_id, 'Personal Plan QA owner sentinel', v_campaign_token_hash, 'revoked',
    source_time, '2099-01-01T00:00:00.000Z'::timestamptz, 1, 1, source_time, source_time
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.leads (
    id, name, email, user_id, marketing_consent, quiz_answers, quiz_kind, status
  ) VALUES (
    v_lead_id, 'Personal Plan QA', expected_email, p_user_id, false,
    p_quiz_answers, 'personal_plan', 'linked'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.funnel_sessions (
    id, visitor_id, package_key, channel, quiz_variant, lead_id, user_id,
    is_internal_test, test_kind, field_test_campaign_id, first_seen_at, last_seen_at
  ) VALUES (
    v_funnel_session_id, v_visitor_id, 'meta_personal_plan_v1', 'test', 'personal_plan',
    v_lead_id, p_user_id, true, 'field_test', v_campaign_id, source_time, source_time
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.personal_plan_one_time_checkout_consents (
    id, lead_id, funnel_session_id, user_id, product_kind, offer_variant, copy_version,
    consent_text, consent_text_sha256, accepted_at, confirmation_provider,
    confirmation_status, confirmation_reference, confirmation_sent_at,
    confirmation_delivered_at, generation_started_at, generation_completed_at,
    generated_content_sha256, delivery_provider, delivery_reference, delivered_at
  ) VALUES (
    v_consent_id, v_lead_id, v_funnel_session_id, p_user_id, 'personal_plan_once',
    'personal-plan-qa', 'personal-plan-qa-v1', 'Synthetic Personal Plan QA consent',
    repeat('d', 64), source_time, 'test', 'delivered', 'personal-plan-qa-confirmation-v1',
    source_time, source_time, source_time, source_time, repeat('e', 64),
    'test', 'personal-plan-qa-delivery-v1', source_time
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.billing_one_time_purchases (
    id, user_id, provider, product_kind, provider_transaction_id, amount_minor,
    currency, status, paid_at, consent_id, metadata
  ) VALUES (
    v_purchase_id, p_user_id, 'stripe', 'personal_plan_once', v_provider_transaction_id,
    2999, 'eur', 'paid', source_time, v_consent_id,
    '{"is_internal_test":true,"personal_plan_test_owner":true,"test_kind":"field_test"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.personal_plan_prepared_artifacts (
    id, answer_hash, claim_token_hash, quiz_answers, canonical_profile,
    fallback_metadata, priorities, diagnostic_scores, public_offer_model, locked_plan,
    status, lead_id, user_id, expires_at, attached_at, user_attached_at
  ) VALUES (
    v_artifact_id, v_answer_hash, v_claim_token_hash, p_quiz_answers, p_canonical_profile,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'attached', v_lead_id, p_user_id, '2099-01-01T00:00:00.000Z'::timestamptz,
    source_time, source_time
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.personal_plan_test_enrollments (
    id, campaign_id, funnel_session_id, lead_id, user_id,
    manual_access_grant_id, prepared_artifact_id, status,
    activated_at, expires_at, revoked_at, created_at
  ) VALUES (
    v_enrollment_id, v_campaign_id, v_funnel_session_id, v_lead_id, p_user_id,
    v_manual_access_grant_id, v_artifact_id, 'active', source_time,
    '2099-01-01T00:00:00.000Z'::timestamptz, NULL, source_time
  )
  ON CONFLICT (id) DO NOTHING;

  -- The lead trigger necessarily creates this row. Suppress the reusable QA
  -- identity atomically so no worker can send it to a commercial system.
  -- Future migrations that add side effects to any prepared source table must
  -- extend this suppression contract before this reusable owner is prepared.
  DELETE FROM public.customerio_profile_sync_outbox AS outbox
   WHERE outbox.lead_id = v_lead_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.personal_plan_test_campaigns AS campaign
     WHERE campaign.id = v_campaign_id
       AND campaign.token_hash = v_campaign_token_hash
       AND campaign.status = 'revoked'
       AND campaign.revoked_at = source_time
  ) OR NOT EXISTS (
    SELECT 1 FROM public.manual_access_grants AS access_grant
     WHERE access_grant.id = v_manual_access_grant_id
       AND access_grant.user_id = p_user_id
       AND access_grant.reason = 'tester'
       AND access_grant.expires_at = '2099-01-01T00:00:00.000Z'::timestamptz
       AND access_grant.revoked_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.leads AS lead
     WHERE lead.id = v_lead_id AND lead.user_id = p_user_id
       AND pg_catalog.lower(pg_catalog.btrim(lead.email)) = expected_email
       AND lead.quiz_kind = 'personal_plan' AND lead.quiz_answers = p_quiz_answers
  ) OR NOT EXISTS (
    SELECT 1 FROM public.funnel_sessions AS session
     WHERE session.id = v_funnel_session_id AND session.user_id = p_user_id
       AND session.lead_id = v_lead_id AND session.package_key = 'meta_personal_plan_v1'
       AND session.channel = 'test' AND session.is_internal_test = true
       AND session.test_kind = 'field_test' AND session.field_test_campaign_id = v_campaign_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.personal_plan_one_time_checkout_consents AS consent
     WHERE consent.id = v_consent_id AND consent.user_id = p_user_id
       AND consent.lead_id = v_lead_id AND consent.funnel_session_id = v_funnel_session_id
       AND consent.product_kind = 'personal_plan_once'
       AND consent.confirmation_status = 'delivered'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.billing_one_time_purchases AS purchase
     WHERE purchase.id = v_purchase_id AND purchase.user_id = p_user_id
       AND purchase.consent_id = v_consent_id AND purchase.provider = 'stripe'
       AND purchase.provider_transaction_id = v_provider_transaction_id
       AND purchase.product_kind = 'personal_plan_once' AND purchase.status = 'paid'
       AND purchase.metadata @> '{"is_internal_test":true,"personal_plan_test_owner":true}'::jsonb
  ) OR NOT EXISTS (
    SELECT 1 FROM public.personal_plan_prepared_artifacts AS artifact
     WHERE artifact.id = v_artifact_id AND artifact.user_id = p_user_id
       AND artifact.lead_id = v_lead_id AND artifact.claim_token_hash = v_claim_token_hash
       AND artifact.answer_hash = v_answer_hash AND artifact.status = 'attached'
       AND artifact.quiz_answers = p_quiz_answers
       AND artifact.canonical_profile = p_canonical_profile
  ) OR NOT EXISTS (
    SELECT 1 FROM public.personal_plan_test_enrollments AS enrollment
     WHERE enrollment.id = v_enrollment_id
       AND enrollment.campaign_id = v_campaign_id
       AND enrollment.funnel_session_id = v_funnel_session_id
       AND enrollment.lead_id = v_lead_id
       AND enrollment.user_id = p_user_id
       AND enrollment.manual_access_grant_id = v_manual_access_grant_id
       AND enrollment.prepared_artifact_id = v_artifact_id
       AND enrollment.status = 'active'
       AND enrollment.expires_at = '2099-01-01T00:00:00.000Z'::timestamptz
       AND enrollment.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'personal plan test owner source mismatch' USING ERRCODE = '23505';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'outcome', 'prepared',
    'leadId', v_lead_id,
    'funnelSessionId', v_funnel_session_id,
    'purchaseId', v_purchase_id,
    'artifactId', v_artifact_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.prepare_personal_plan_test_owner(uuid, jsonb, jsonb) IS
  'Atomically prepares the one fixed synthetic post-payment owner used for Personal Plan QA.';
