-- Account deletion (iOS paywall Task 6): lifecycle over private.account_deletion_operations,
-- the one-transaction data routine private.delete_account and the retention purge.
-- Classification per table: plans/ios-paywall/deletion-inventory.md.

-- Identity keys that must not survive in retained JSON metadata.
CREATE FUNCTION private.account_deletion_scrub_json(p_value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'object' THEN p_value - ARRAY[
    'email', 'customer_email', 'payer_email', 'payer_id', 'payer_name', 'account_email',
    'subscriber', 'name', 'first_name', 'last_name', 'phone', 'address', 'shipping_address',
    'user_id', 'lead_id', 'visitor_id', 'ip', 'ip_address', 'user_agent', 'client_user_agent',
    'fbp', 'fbc'] ELSE p_value END
$$;

-- Stripe checkout parameters frozen as evidence: the customer email and identity metadata go.
CREATE FUNCTION private.account_deletion_scrub_stripe_params(p_value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) <> 'object' THEN p_value ELSE
    (p_value - 'customer_email')
    || CASE WHEN p_value ? 'metadata'
      THEN jsonb_build_object('metadata', private.account_deletion_scrub_json(p_value->'metadata')) ELSE '{}' END
    || CASE WHEN jsonb_typeof(p_value->'subscription_data') = 'object' AND p_value->'subscription_data' ? 'metadata'
      THEN jsonb_build_object('subscription_data', (p_value->'subscription_data')
        || jsonb_build_object('metadata', private.account_deletion_scrub_json(p_value->'subscription_data'->'metadata')))
      ELSE '{}' END
  END
$$;

-- Starts (or replays) one deletion request. The latest request wins while no data has
-- been deleted yet; a request id belongs to exactly one account.
CREATE FUNCTION public.account_deletion_begin(p_user_id uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE op private.account_deletion_operations; v_email text;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('account_deletion:' || p_user_id::text, 0));
  SELECT * INTO op FROM private.account_deletion_operations WHERE request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    -- A completed request no longer names its account; a live caller cannot own it.
    IF op.user_id IS DISTINCT FROM p_user_id
      AND (op.user_id IS NOT NULL OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)) THEN
      RAISE EXCEPTION 'request_id_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('state', op.state);
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_admin IS TRUE) THEN
    RAISE EXCEPTION 'admin_account' USING ERRCODE = '42501';
  END IF;
  DELETE FROM private.account_deletion_operations
    WHERE user_id = p_user_id AND state IN ('requested', 'web_billing_cancelled');
  INSERT INTO private.account_deletion_operations(request_id, user_id, email)
    VALUES (p_request_id, p_user_id, nullif(lower(btrim(v_email)), ''));
  RETURN jsonb_build_object('state', 'requested');
END
$$;

CREATE FUNCTION public.account_deletion_mark_billing_cancelled(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state text;
BEGIN
  UPDATE private.account_deletion_operations
    SET state = 'web_billing_cancelled', updated_at = now()
    WHERE request_id = p_request_id AND state = 'requested';
  SELECT state INTO v_state FROM private.account_deletion_operations WHERE request_id = p_request_id;
  IF v_state IS NULL THEN RAISE EXCEPTION 'operation_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('state', v_state);
END
$$;

-- The data routine, one transaction: anonymous quiz archive → explicit deletes of rows
-- that would survive or block the cascade → anonymize retained rows in place under one
-- fresh subject id → delete auth.users (cascade) → operation 'data_deleted'.
CREATE FUNCTION private.delete_account(p_user_id uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  op private.account_deletion_operations;
  v_email text;
  v_subject uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_billing timestamptz := now() + private.account_deletion_retention('billing');
  v_evidence timestamptz := now() + private.account_deletion_retention('cancellation_evidence');
  v_leads uuid[]; v_sessions uuid[]; v_enrollments uuid[]; v_agreements text[];
  v_consents uuid[]; v_purchases uuid[]; v_checkout_intents uuid[]; v_attempts uuid[];
  v_mgmt_ops uuid[]; v_recovery_ops uuid[]; v_declarations uuid[]; v_public_decls uuid[];
  v_invitations uuid[]; v_paths text[];
  v_anon constant jsonb := '{"name": "anonymisiert", "email": "anonymisiert", "contract": "anonymisiert"}';
  src record;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO op FROM private.account_deletion_operations WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found' USING ERRCODE = 'P0002'; END IF;
  IF op.state IN ('data_deleted', 'external_cleanup_done') THEN
    RETURN jsonb_build_object('state', op.state, 'storagePaths', to_jsonb(op.storage_paths));
  END IF;
  IF op.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'request_id_conflict' USING ERRCODE = '22023';
  END IF;
  IF op.state <> 'web_billing_cancelled' THEN
    RAISE EXCEPTION 'web_billing_not_cancelled' USING ERRCODE = '55000';
  END IF;
  SELECT nullif(lower(btrim(email)), '') INTO v_email FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002'; END IF;

  -- The billing guards accept exactly the anonymization writes of this request.
  PERFORM set_config('chaarlie.account_deletion', p_request_id::text, true);

  v_leads := ARRAY(SELECT id FROM public.leads WHERE user_id = p_user_id
    OR (user_id IS NULL AND v_email IS NOT NULL AND lower(btrim(email)) = v_email));
  v_sessions := ARRAY(SELECT id FROM public.funnel_sessions WHERE user_id = p_user_id
    OR (lead_id = ANY(v_leads) AND user_id IS NULL));
  v_enrollments := ARRAY(SELECT id FROM public.trial_enrollments WHERE user_id = p_user_id);
  v_agreements := ARRAY(
    SELECT provider_agreement_id FROM public.trial_enrollments
      WHERE id = ANY(v_enrollments) AND provider_agreement_id IS NOT NULL
    UNION SELECT provider_agreement_id FROM private.trial_offer_revisions WHERE enrollment_id = ANY(v_enrollments)
    UNION SELECT continuation_agreement_id FROM private.trial_paid_continuations WHERE enrollment_id = ANY(v_enrollments));
  v_consents := ARRAY(SELECT id FROM public.personal_plan_one_time_checkout_consents
    WHERE user_id = p_user_id OR lead_id = ANY(v_leads));
  v_purchases := ARRAY(SELECT id FROM public.billing_one_time_purchases
    WHERE user_id = p_user_id OR consent_id = ANY(v_consents));
  v_attempts := ARRAY(SELECT id FROM private.paypal_trial_checkout_attempts WHERE enrollment_id = ANY(v_enrollments));
  v_checkout_intents := ARRAY(SELECT id FROM public.paypal_checkout_intents
    WHERE user_id = p_user_id OR lead_id = ANY(v_leads)
      OR id IN (SELECT intent_id FROM private.paypal_trial_checkout_attempts WHERE id = ANY(v_attempts))
      OR (user_id IS NULL AND v_email IS NOT NULL AND lower(btrim(email)) = v_email));
  v_mgmt_ops := ARRAY(SELECT id FROM private.trial_management_operations
    WHERE user_id = p_user_id OR enrollment_id = ANY(v_enrollments));
  v_recovery_ops := ARRAY(SELECT id FROM private.trial_paid_recovery_operations
    WHERE user_id = p_user_id OR enrollment_id = ANY(v_enrollments));
  v_declarations := ARRAY(SELECT id FROM private.trial_cancellation_declarations
    WHERE user_id = p_user_id OR enrollment_id = ANY(v_enrollments));
  v_public_decls := ARRAY(SELECT d.id FROM private.public_contract_declarations d
    WHERE EXISTS (SELECT 1 FROM private.public_contract_declaration_matches m WHERE m.declaration_id = d.id
        AND (m.user_id = p_user_id OR m.enrollment_id = ANY(v_enrollments)))
      OR (v_email IS NOT NULL AND lower(btrim(d.payload->>'email')) = v_email));
  v_invitations := ARRAY(SELECT id FROM public.partner_access_invitations
    WHERE claimed_user_id = p_user_id OR (v_email IS NOT NULL AND normalized_email = v_email));

  -- Anonymous quiz archive (D10): canonical quiz keys only (currentLegacyAnswers projection).
  INSERT INTO private.anonymous_quiz_answer_archive(anonymous_subject_id, answers, answered_month, channel)
  SELECT v_subject,
    jsonb_strip_nulls(jsonb_build_object(
      'structure', hp.hair_texture,
      'thickness', hp.thickness,
      'density', hp.density,
      'hair_length', hp.hair_length,
      'fingertest', CASE hp.cuticle_condition WHEN 'smooth' THEN 'glatt'
        WHEN 'slightly_rough' THEN 'leicht_uneben' WHEN 'rough' THEN 'rau' END,
      'pulltest', hp.protein_moisture_balance,
      'scalp_type', CASE hp.scalp_type WHEN 'oily' THEN 'fettig'
        WHEN 'balanced' THEN 'ausgeglichen' WHEN 'dry' THEN 'trocken' END,
      'has_scalp_issue', hp.scalp_condition IS NOT NULL,
      'scalp_condition', CASE hp.scalp_condition WHEN 'dandruff' THEN 'schuppen'
        WHEN 'dry_flakes' THEN 'trockene_schuppen' WHEN 'irritated' THEN 'gereizt' END,
      'treatment', CASE WHEN hp.chemical_treatment IS NOT NULL THEN (
        SELECT coalesce(jsonb_agg(CASE t.value WHEN 'natural' THEN 'natur' WHEN 'colored' THEN 'gefaerbt'
          WHEN 'bleached' THEN 'blondiert' WHEN 'permed' THEN 'dauerwelle'
          WHEN 'chemically_straightened' THEN 'chemisch_geglaettet' ELSE t.value END ORDER BY t.ord), '[]'::jsonb)
        FROM unnest(hp.chemical_treatment) WITH ORDINALITY t(value, ord)) END,
      'goals', to_jsonb(hp.goals),
      'concerns', to_jsonb(hp.concerns))),
    date_trunc('month', coalesce(hp.created_at, v_now))::date,
    CASE WHEN EXISTS (SELECT 1 FROM public.mobile_registration_enrollments WHERE user_id = p_user_id)
      THEN 'app' ELSE 'web' END
  FROM public.hair_profiles hp WHERE hp.user_id = p_user_id;

  -- Storage objects deleted by the service after this transaction.
  v_paths := ARRAY(SELECT DISTINCT path FROM (
    SELECT front_image_path AS path FROM public.product_submissions WHERE user_id = p_user_id
    UNION ALL SELECT barcode_image_path FROM public.product_submissions WHERE user_id = p_user_id
    UNION ALL SELECT front_image_path FROM public.user_product_usage WHERE user_id = p_user_id
    UNION ALL SELECT name FROM storage.objects WHERE bucket_id = 'product-intake'
      AND (name LIKE p_user_id::text || '/%' OR name LIKE 'tmp/' || p_user_id::text || '/%')
  ) paths WHERE path IS NOT NULL ORDER BY path);

  -- DELETE: rows that hold personal data but would survive the cascade (SET NULL / no FK),
  -- or that block it (RESTRICT / NO ACTION) and are not retained.
  DELETE FROM public.personal_plan_test_members WHERE user_id = p_user_id;
  DELETE FROM public.personal_plan_test_enrollments
    WHERE user_id = p_user_id OR lead_id = ANY(v_leads) OR funnel_session_id = ANY(v_sessions);
  DELETE FROM public.regular_quiz_test_enrollments
    WHERE user_id = p_user_id OR lead_id = ANY(v_leads) OR funnel_session_id = ANY(v_sessions);
  DELETE FROM public.personal_plan_prepared_artifacts WHERE user_id = p_user_id OR lead_id = ANY(v_leads);
  DELETE FROM public.personal_plan_quiz_drafts WHERE funnel_session_id = ANY(v_sessions);
  DELETE FROM public.funnel_events WHERE funnel_session_id = ANY(v_sessions) OR lead_id = ANY(v_leads);
  DELETE FROM private.openai_ads_contexts WHERE session_id = ANY(v_sessions);
  DELETE FROM public.personal_plan_result_returns WHERE lead_id = ANY(v_leads);
  DELETE FROM public.quiz_email_return_links WHERE source_lead_id = ANY(v_leads);
  DELETE FROM public.beta_feedback WHERE user_id = p_user_id;
  DELETE FROM public.discovery_enrollments
    WHERE claimed_user_id = p_user_id OR (v_email IS NOT NULL AND normalized_email = v_email);
  UPDATE public.leads SET partner_access_invitation_id = NULL WHERE partner_access_invitation_id = ANY(v_invitations);
  UPDATE public.funnel_sessions SET partner_access_invitation_id = NULL
    WHERE partner_access_invitation_id = ANY(v_invitations);
  UPDATE public.partner_access_invitations SET current_manual_access_grant_id = NULL WHERE id = ANY(v_invitations);
  DELETE FROM public.manual_access_grants WHERE user_id = p_user_id
    OR partner_access_invitation_id = ANY(v_invitations)
    OR (v_email IS NOT NULL AND lower(btrim(email)) = v_email);
  DELETE FROM public.partner_access_invitations WHERE id = ANY(v_invitations);
  DELETE FROM public.mobile_auth_attempts WHERE v_email IS NOT NULL AND lower(btrim(email)) = v_email;
  DELETE FROM public.mobile_registration_intents WHERE verified_user_id = p_user_id
    OR provider_user_id = p_user_id OR (v_email IS NOT NULL AND lower(btrim(email)) = v_email);
  DELETE FROM public.waitlist_signups WHERE v_email IS NOT NULL AND normalized_email = v_email;
  DELETE FROM public.rate_limits WHERE strpos(key, p_user_id::text) > 0
    OR (v_email IS NOT NULL AND strpos(lower(key), v_email) > 0);
  DELETE FROM auth.audit_log_entries WHERE strpos(payload::text, p_user_id::text) > 0
    OR (v_email IS NOT NULL AND strpos(lower(payload::text), v_email) > 0);
  -- Usage rows reference submissions by (id, user_id, category); remove them before the
  -- retained submissions lose their owner.
  DELETE FROM public.user_product_usage WHERE user_id = p_user_id;

  -- ANONYMIZE in place (D12). Parents first: guards of children read them.
  UPDATE public.leads SET user_id = NULL, name = '', email = '', quiz_answers = '{}', ai_insight = NULL,
      share_quote = NULL, artifact_email_error = NULL, partner_access_invitation_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_leads);
  -- The lead update re-enqueues a Customer.io profile sync; the person is deleted instead.
  DELETE FROM public.customerio_profile_sync_outbox WHERE lead_id = ANY(v_leads);
  UPDATE public.funnel_sessions SET user_id = NULL, visitor_id = v_subject, entry_url = NULL,
      entry_path = NULL, referrer = NULL, first_touch = '{}', partner_access_invitation_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_sessions);
  UPDATE public.trial_enrollments SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_enrollments);

  UPDATE public.personal_plan_one_time_checkout_consents SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_consents);
  UPDATE public.billing_one_time_purchases SET user_id = NULL, metadata = private.account_deletion_scrub_json(metadata),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_purchases);
  UPDATE public.personal_plan_one_time_fulfillment_jobs SET last_error = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE purchase_id = ANY(v_purchases) OR consent_id = ANY(v_consents);
  UPDATE public.paypal_order_intents SET user_id = NULL, email = '', metadata = private.account_deletion_scrub_json(metadata),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE consent_id = ANY(v_consents) OR lead_id = ANY(v_leads) OR user_id = p_user_id;
  UPDATE public.paypal_expired_order_reset_audit SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE consent_id = ANY(v_consents);
  UPDATE public.paypal_checkout_intents SET user_id = NULL, email = NULL, lead_id = NULL,
      metadata = private.account_deletion_scrub_json(metadata),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_checkout_intents);

  UPDATE public.trial_checkout_attempts SET stripe_params = private.account_deletion_scrub_stripe_params(stripe_params),
      scope_id = CASE WHEN scope_kind = 'user' THEN v_subject ELSE scope_id END,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.paypal_trial_checkout_attempts SET
      scope_id = CASE WHEN scope_kind = 'user' THEN v_subject ELSE scope_id END,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_attempts);
  UPDATE private.paypal_trial_activation_evidence SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE attempt_id = ANY(v_attempts);
  UPDATE private.paypal_trial_management_requests SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.paypal_trial_plan_catalogs SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.paypal_trial_paid_recovery_requests SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments) OR user_id = p_user_id;
  UPDATE private.stripe_trial_continuation_operations SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.stripe_trial_management_approvals SET session_params = private.account_deletion_scrub_stripe_params(session_params),
      subscription_params = private.account_deletion_scrub_stripe_params(subscription_params),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE operation_id = ANY(v_mgmt_ops);
  UPDATE private.stripe_trial_paid_recovery_requests SET session_params = private.account_deletion_scrub_stripe_params(session_params),
      subscription_params = private.account_deletion_scrub_stripe_params(subscription_params),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE operation_id = ANY(v_recovery_ops);
  UPDATE private.trial_analytics_contexts SET meta_context = '{}',
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_management_operations SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_mgmt_ops);
  UPDATE private.trial_paid_recovery_operations SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE id = ANY(v_recovery_ops);
  UPDATE private.trial_offer_revisions SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_management_agreement_bindings SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_management_catalogs SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_management_state SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_paid_continuations SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_paid_continuation_history SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_payment_continuation_reconciliations SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);
  UPDATE private.trial_payment_events SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_billing
    WHERE enrollment_id = ANY(v_enrollments);

  -- Cancellation evidence and delivered notices: 3 years.
  UPDATE private.trial_cancellation_declarations SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE id = ANY(v_declarations);
  UPDATE private.trial_cancellation_receipts SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_declarations) OR user_id = p_user_id;
  UPDATE private.trial_cancellation_provider_operations SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_declarations);
  UPDATE private.trial_paid_cancellation_declarations SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE enrollment_id = ANY(v_enrollments) OR user_id = p_user_id;
  UPDATE private.stripe_paid_cancellation_operations SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE enrollment_id = ANY(v_enrollments) OR user_id = p_user_id;
  UPDATE private.trial_reminders SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE enrollment_id = ANY(v_enrollments) OR user_id = p_user_id;
  UPDATE private.trial_required_notices SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE enrollment_id = ANY(v_enrollments) OR user_id = p_user_id OR declaration_id = ANY(v_declarations);
  UPDATE private.public_contract_declarations SET payload = payload || v_anon
      || CASE WHEN jsonb_typeof(payload->'reason') = 'string' THEN '{"reason": "anonymisiert"}'::jsonb ELSE '{}'::jsonb END,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE id = ANY(v_public_decls);
  UPDATE private.public_contract_declaration_receipts SET receipt_payload = jsonb_set(receipt_payload, '{declaration}',
        (receipt_payload->'declaration') || v_anon
        || CASE WHEN jsonb_typeof(receipt_payload->'declaration'->'reason') = 'string'
          THEN '{"reason": "anonymisiert"}'::jsonb ELSE '{}'::jsonb END),
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_public_decls);
  UPDATE private.public_contract_declaration_matches SET user_id = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_public_decls) OR user_id = p_user_id;
  UPDATE private.public_contract_declaration_applications SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_public_decls) OR trial_declaration_id = ANY(v_declarations);
  UPDATE private.public_contract_declaration_completions SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_public_decls);
  UPDATE private.public_contract_declaration_reviews SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE declaration_id = ANY(v_public_decls);
  UPDATE public.payment_support_cases SET user_id = NULL, lead_id = NULL, resolution_note = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE user_id = p_user_id OR lead_id = ANY(v_leads);

  -- Trial anti-abuse fingerprints (Q3 policy switch).
  IF private.account_deletion_policy() = 'erase' THEN
    FOR src IN SELECT kind, source_id FROM private.trial_identity_sources
      WHERE (kind = 'enrollment' AND source_id = ANY(v_enrollments::text[]))
        OR (kind IN ('stripe', 'paypal') AND source_id = ANY(v_agreements))
    LOOP
      PERFORM public.apply_trial_identity_rights(src.kind, src.source_id, 'erase',
        ARRAY['account', 'verified_email', 'stripe_card', 'paypal_payer'], 'account-deletion:' || p_request_id::text);
    END LOOP;
    DELETE FROM public.trial_identity_claims WHERE enrollment_id = ANY(v_enrollments);
  ELSE
    UPDATE public.trial_identity_claims SET
        anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
      WHERE enrollment_id = ANY(v_enrollments);
  END IF;
  UPDATE private.trial_identity_sources SET
      anonymous_subject_id = v_subject, anonymized_at = v_now, purge_after = v_evidence
    WHERE (kind = 'enrollment' AND source_id = ANY(v_enrollments::text[]))
      OR (kind IN ('stripe', 'paypal') AND source_id = ANY(v_agreements));

  -- Kept without identifiers and without purge (D10): scan events and product submissions.
  UPDATE public.product_submissions SET user_id = NULL, user_product_id = NULL, user_product_usage_id = NULL,
      source_conversation_id = NULL, front_image_path = NULL, barcode_image_path = NULL,
      front_image_validation_metadata = '{}', barcode_image_validation_metadata = '{}',
      review_notes = NULL, user_facing_resolution_reason = NULL, user_facing_next_step = NULL,
      intake_history = '[]', personal_plan_request_fingerprint = NULL,
      anonymous_subject_id = v_subject, anonymized_at = v_now
    WHERE user_id = p_user_id;
  UPDATE public.scan_resolve_events SET user_id = NULL, anonymous_subject_id = v_subject, anonymized_at = v_now
    WHERE user_id = p_user_id;

  -- The personal-plan aggregate has RESTRICT edges among its own rows; its established
  -- ordered erasure runs first (submissions no longer point at user products).
  PERFORM public.personal_plan_erase_owner_data(p_user_id);
  -- Everything else cascades from the auth user.
  DELETE FROM auth.users WHERE id = p_user_id;

  PERFORM set_config('chaarlie.account_deletion', '', true);
  UPDATE private.account_deletion_operations SET state = 'data_deleted', storage_paths = v_paths,
      data_deleted_at = now(), updated_at = now()
    WHERE request_id = p_request_id;
  RETURN jsonb_build_object('state', 'data_deleted', 'storagePaths', to_jsonb(v_paths));
END
$$;

CREATE FUNCTION public.delete_account_data(p_user_id uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.delete_account(p_user_id, p_request_id)
$$;

CREATE FUNCTION public.account_deletion_record_external_failure(p_request_id uuid, p_error_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE op private.account_deletion_operations;
BEGIN
  UPDATE private.account_deletion_operations
    SET external_attempts = external_attempts + 1,
      last_error_code = CASE WHEN p_error_code ~ '^[a-z][a-z0-9_]{0,63}$' THEN p_error_code ELSE 'unknown' END,
      updated_at = now()
    WHERE request_id = p_request_id AND state = 'data_deleted' RETURNING * INTO op;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_pending' USING ERRCODE = '55000'; END IF;
  RETURN jsonb_build_object('state', op.state, 'externalAttempts', op.external_attempts);
END
$$;

CREATE FUNCTION public.account_deletion_complete(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state text;
BEGIN
  UPDATE private.account_deletion_operations
    SET state = 'external_cleanup_done', user_id = NULL, email = NULL, storage_paths = '{}',
      last_error_code = NULL, completed_at = now(), updated_at = now()
    WHERE request_id = p_request_id AND state = 'data_deleted';
  SELECT state INTO v_state FROM private.account_deletion_operations WHERE request_id = p_request_id;
  IF v_state IS NULL THEN RAISE EXCEPTION 'operation_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('state', v_state);
END
$$;

-- State only; never the account.
CREATE FUNCTION public.account_deletion_status(p_request_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT state FROM private.account_deletion_operations WHERE request_id = p_request_id
$$;

-- Deleted accounts whose external cleanup is still due (optionally one request).
CREATE FUNCTION public.account_deletion_pending_cleanup(p_limit integer DEFAULT 20, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('requestId', request_id, 'userId', user_id, 'email', email,
      'storagePaths', to_jsonb(storage_paths), 'externalAttempts', external_attempts) ORDER BY updated_at), '[]')
  FROM (SELECT * FROM private.account_deletion_operations WHERE state = 'data_deleted'
      AND (p_request_id IS NULL OR request_id = p_request_id)
    ORDER BY updated_at LIMIT greatest(1, least(coalesce(p_limit, 20), 100))) due
$$;

-- Retention purge: rows past purge_after, children before parents.
CREATE FUNCTION private.purge_anonymized_records() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text; n bigint; total jsonb := '{}';
BEGIN
  PERFORM set_config('chaarlie.account_purge', 'on', true);
  FOREACH t IN ARRAY ARRAY[
    'private.public_contract_declaration_applications', 'private.public_contract_declaration_matches',
    'private.public_contract_declaration_completions', 'private.public_contract_declaration_reviews',
    'private.public_contract_declaration_receipts', 'private.public_contract_declarations',
    'private.trial_cancellation_provider_operations', 'private.trial_cancellation_receipts',
    'private.trial_required_notices', 'private.trial_reminders', 'private.trial_cancellation_declarations',
    'private.trial_paid_cancellation_declarations', 'private.stripe_paid_cancellation_operations',
    'public.trial_identity_claims', 'private.trial_identity_sources', 'public.payment_support_cases',
    'private.paypal_trial_activation_evidence', 'private.paypal_trial_checkout_attempts',
    'private.paypal_trial_management_requests', 'private.paypal_trial_paid_recovery_requests',
    'private.paypal_trial_plan_catalogs', 'private.stripe_trial_management_approvals',
    'private.trial_offer_revisions', 'private.trial_management_operations',
    'private.stripe_trial_paid_recovery_requests', 'private.trial_paid_recovery_operations',
    'private.stripe_trial_continuation_operations', 'private.trial_paid_continuation_history',
    'private.trial_paid_continuations', 'private.trial_payment_continuation_reconciliations',
    'private.trial_payment_events', 'private.trial_management_agreement_bindings',
    'private.trial_management_catalogs', 'private.trial_management_state', 'private.trial_analytics_contexts',
    'public.trial_checkout_attempts', 'public.personal_plan_one_time_fulfillment_jobs',
    'public.paypal_expired_order_reset_audit', 'public.paypal_order_intents',
    'public.billing_one_time_purchases', 'public.personal_plan_one_time_checkout_consents',
    'public.paypal_checkout_intents', 'public.trial_enrollments', 'public.funnel_sessions', 'public.leads'
  ] LOOP
    EXECUTE format('DELETE FROM %s WHERE purge_after <= now()', t);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN total := total || jsonb_build_object(t, n); END IF;
  END LOOP;
  PERFORM set_config('chaarlie.account_purge', '', true);
  RETURN total;
END
$$;

CREATE FUNCTION public.purge_anonymized_records() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.purge_anonymized_records() $$;

REVOKE ALL ON FUNCTION private.account_deletion_scrub_json(jsonb), private.account_deletion_scrub_stripe_params(jsonb), private.delete_account(uuid, uuid),
  private.purge_anonymized_records() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_deletion_begin(uuid, uuid), public.account_deletion_mark_billing_cancelled(uuid),
  public.delete_account_data(uuid, uuid), public.account_deletion_record_external_failure(uuid, text),
  public.account_deletion_complete(uuid), public.account_deletion_status(uuid),
  public.account_deletion_pending_cleanup(integer, uuid), public.purge_anonymized_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.account_deletion_scrub_json(jsonb), private.account_deletion_scrub_stripe_params(jsonb), private.delete_account(uuid, uuid),
  private.purge_anonymized_records() TO service_role;
GRANT EXECUTE ON FUNCTION public.account_deletion_begin(uuid, uuid), public.account_deletion_mark_billing_cancelled(uuid),
  public.delete_account_data(uuid, uuid), public.account_deletion_record_external_failure(uuid, text),
  public.account_deletion_complete(uuid), public.account_deletion_status(uuid),
  public.account_deletion_pending_cleanup(integer, uuid), public.purge_anonymized_records() TO service_role;
