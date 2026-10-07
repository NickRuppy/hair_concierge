-- Account deletion D14 hardening (review round 1 + controller rulings R-a/R-b):
-- * post-deletion subscriptions (checkout in flight when the account was deleted) share the
--   refunds table key: kind 'post_deletion' is refunded in full, and a subscription is only
--   ever paid out once (PK provider + subscription_id).
-- * recorded_at = when the current request recorded the row (M6); planned refund amount and
--   payment are stored before the provider call (M4); terminal 'failed_manual' after 10
--   failed attempts or a permanent provider error (I2); purge after the billing retention (R-b).
-- * a superseding request takes over recorded rows, an orphan close makes them due (I1).

ALTER TABLE private.account_deletion_web_refunds
  ADD COLUMN kind text NOT NULL DEFAULT 'deletion' CHECK (kind IN ('deletion', 'post_deletion')),
  ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN planned_minor integer CHECK (planned_minor IS NULL OR planned_minor > 0),
  ADD COLUMN planned_payment_ref text,
  ADD COLUMN purge_after timestamptz;
UPDATE private.account_deletion_web_refunds SET recorded_at = created_at;
UPDATE private.account_deletion_web_refunds
  SET purge_after = completed_at + private.account_deletion_retention('billing') WHERE state = 'done';
ALTER TABLE private.account_deletion_web_refunds
  DROP CONSTRAINT account_deletion_web_refunds_state_check,
  DROP CONSTRAINT account_deletion_web_refunds_check,
  ADD CONSTRAINT account_deletion_web_refunds_state_check
    CHECK (state IN ('recorded', 'due', 'done', 'failed_manual')),
  ADD CONSTRAINT account_deletion_web_refunds_settled_check
    CHECK ((state IN ('done', 'failed_manual')) = (completed_at IS NOT NULL AND purge_after IS NOT NULL)
      AND (state = 'done') = (refunded_minor IS NOT NULL));
CREATE INDEX account_deletion_web_refunds_purge
  ON private.account_deletion_web_refunds (purge_after) WHERE purge_after IS NOT NULL;

CREATE OR REPLACE FUNCTION public.account_deletion_record_web_subscriptions(p_request_id uuid, p_subscriptions jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.account_deletion_operations
      WHERE request_id = p_request_id AND state = 'requested') THEN
    RAISE EXCEPTION 'operation_not_requested' USING ERRCODE = '55000';
  END IF;
  INSERT INTO private.account_deletion_web_refunds(provider, subscription_id, request_id)
    SELECT DISTINCT s->>'provider', s->>'id', p_request_id
    FROM jsonb_array_elements(coalesce(p_subscriptions, '[]'::jsonb)) s
  ON CONFLICT (provider, subscription_id) DO UPDATE
    SET request_id = excluded.request_id, updated_at = now(),
      -- A replay of the same request keeps the time it first recorded (it may have cancelled).
      recorded_at = CASE WHEN account_deletion_web_refunds.request_id = excluded.request_id
        THEN account_deletion_web_refunds.recorded_at ELSE now() END
    WHERE account_deletion_web_refunds.state = 'recorded' AND account_deletion_web_refunds.kind = 'deletion';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_begin(p_user_id uuid, p_request_id uuid) RETURNS jsonb
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
  -- I1: a superseded request may already have cancelled a recorded subscription; its refund
  -- moves to this request (keeping recorded_at) so the new billing mark makes it due. Due rows
  -- keep their request id: their idempotency key may already have been used.
  UPDATE private.account_deletion_web_refunds SET request_id = p_request_id, updated_at = now()
    WHERE state = 'recorded' AND request_id IN (SELECT request_id FROM private.account_deletion_operations
      WHERE user_id = p_user_id AND state IN ('requested', 'web_billing_cancelled'));
  DELETE FROM private.account_deletion_operations
    WHERE user_id = p_user_id AND state IN ('requested', 'web_billing_cancelled');
  INSERT INTO private.account_deletion_operations(request_id, user_id, email)
    VALUES (p_request_id, p_user_id, nullif(lower(btrim(v_email)), ''));
  RETURN jsonb_build_object('state', 'requested');
END
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_close_orphans() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_states jsonb; v_requests uuid[];
BEGIN
  WITH closed AS (
    UPDATE private.account_deletion_operations op SET state = 'data_deleted', data_deleted_at = now(),
        updated_at = now(),
        storage_paths = ARRAY(SELECT o.name FROM storage.objects o WHERE o.bucket_id = 'product-intake'
          AND (o.name LIKE op.user_id::text || '/%' OR o.name LIKE 'tmp/' || op.user_id::text || '/%') ORDER BY o.name)
      FROM private.account_deletion_operations prior
      WHERE prior.request_id = op.request_id AND op.state IN ('requested', 'web_billing_cancelled')
        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = op.user_id)
      RETURNING prior.state, op.request_id
  ) SELECT coalesce(jsonb_agg(state ORDER BY state), '[]'), coalesce(array_agg(request_id), '{}')
    INTO v_states, v_requests FROM closed;
  -- Minor 9: recorded subscriptions of a closed operation may already be cancelled; their
  -- refunds become due (a still live one fails into manual review, next to the orphan report).
  UPDATE private.account_deletion_web_refunds SET state = 'due', updated_at = now()
    WHERE request_id = ANY(v_requests) AND state = 'recorded';
  -- Prior states only: 'requested' means web billing was never cancelled by the routine.
  RETURN jsonb_build_object('closed', jsonb_array_length(v_states), 'priorStates', v_states);
END
$$;

-- R-a: a live subscription surfaced by a webhook after its account was deleted was cancelled;
-- its payments are refunded in full. No-op when the subscription already has a refund row.
CREATE FUNCTION public.account_deletion_record_post_deletion_refund(p_provider text, p_subscription_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO private.account_deletion_web_refunds(provider, subscription_id, request_id, kind, state)
    VALUES (p_provider, p_subscription_id, gen_random_uuid(), 'post_deletion', 'due')
    ON CONFLICT (provider, subscription_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END
$$;

DROP FUNCTION public.account_deletion_due_web_refunds(integer, uuid);
CREATE FUNCTION public.account_deletion_due_web_refunds(p_limit integer DEFAULT 20, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'subscriptionId', subscription_id,
      'requestId', request_id, 'kind', kind, 'recordedAt', recorded_at, 'attempts', attempts,
      'plannedMinor', planned_minor, 'plannedPaymentRef', planned_payment_ref) ORDER BY updated_at), '[]')
  FROM (SELECT * FROM private.account_deletion_web_refunds WHERE state = 'due'
      AND (p_request_id IS NULL OR request_id = p_request_id)
    ORDER BY updated_at LIMIT greatest(1, least(coalesce(p_limit, 20), 100))) due
$$;

-- M4: the refund about to be requested (amount + payment), so a retry after a lost result
-- can recognise its own refund on the provider.
CREATE FUNCTION public.account_deletion_web_refund_plan(p_provider text, p_subscription_id text,
  p_planned_minor integer, p_payment_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.account_deletion_web_refunds
    SET planned_minor = p_planned_minor, planned_payment_ref = p_payment_ref, updated_at = now()
    WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due';
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
END
$$;

DROP FUNCTION public.account_deletion_web_refund_result(text, text, integer, text, text);
-- Settles a due refund (p_error_code NULL; 0 = nothing to refund) or counts a failed attempt;
-- a permanent error (p_manual) or the 10th failure ends in 'failed_manual' for an operator.
CREATE FUNCTION public.account_deletion_web_refund_result(p_provider text, p_subscription_id text,
  p_refunded_minor integer, p_payment_ref text, p_error_code text, p_manual boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.account_deletion_web_refunds;
BEGIN
  IF p_error_code IS NULL THEN
    UPDATE private.account_deletion_web_refunds
      SET state = 'done', refunded_minor = p_refunded_minor, payment_ref = nullif(btrim(p_payment_ref), ''),
        last_error_code = NULL, completed_at = now(), updated_at = now(),
        purge_after = now() + private.account_deletion_retention('billing')
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due'
      RETURNING * INTO r;
  ELSE
    UPDATE private.account_deletion_web_refunds
      SET attempts = attempts + 1, updated_at = now(),
        last_error_code = CASE WHEN p_error_code ~ '^[a-z][a-z0-9_]{0,63}$' THEN p_error_code ELSE 'unknown' END,
        state = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10 THEN 'failed_manual' ELSE state END,
        completed_at = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10 THEN now() END,
        purge_after = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10
          THEN now() + private.account_deletion_retention('billing') END
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due'
      RETURNING * INTO r;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
  RETURN jsonb_build_object('state', r.state, 'attempts', r.attempts);
END
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_web_refund_known(p_provider text, p_subscription_id text,
  p_payment_ref text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.account_deletion_web_refunds
    WHERE provider = p_provider AND state <> 'recorded'
      AND (subscription_id = p_subscription_id OR payment_ref = p_payment_ref
        OR planned_payment_ref = p_payment_ref))
$$;

CREATE OR REPLACE FUNCTION private.purge_anonymized_records() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text; n bigint; kept bigint; rid tid; deleted jsonb := '{}'; failed jsonb := '[]'; referenced jsonb := '{}';
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
    BEGIN
      EXECUTE format('DELETE FROM %s WHERE anonymized_at IS NOT NULL AND purge_after < now()', t);
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN deleted := deleted || jsonb_build_object(t, n); END IF;
    EXCEPTION
      WHEN foreign_key_violation THEN
        -- Some expired rows are still referenced by rows of another record (e.g. a live
        -- account's consent on an anonymized lead): delete row by row and keep those until
        -- the referrer goes. They hold no personal data any more.
        BEGIN
          n := 0; kept := 0;
          FOR rid IN EXECUTE format('SELECT ctid FROM %s WHERE anonymized_at IS NOT NULL AND purge_after < now()', t) LOOP
            BEGIN
              EXECUTE format('DELETE FROM %s WHERE ctid = $1', t) USING rid;
              n := n + 1;
            EXCEPTION WHEN foreign_key_violation THEN
              kept := kept + 1;
            END;
          END LOOP;
          IF n > 0 THEN deleted := deleted || jsonb_build_object(t, n); END IF;
          IF kept > 0 THEN referenced := referenced || jsonb_build_object(t, kept); END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'account deletion purge failed on % (SQLSTATE %)', t, SQLSTATE;
          failed := failed || to_jsonb(t);
        END;
      WHEN OTHERS THEN
        RAISE WARNING 'account deletion purge failed on % (SQLSTATE %)', t, SQLSTATE;
        failed := failed || to_jsonb(t);
    END;
  END LOOP;
  -- D14/R-b: settled deletion refunds (provider ids only) after the billing retention.
  BEGIN
    DELETE FROM private.account_deletion_web_refunds WHERE purge_after < now();
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN deleted := deleted || jsonb_build_object('private.account_deletion_web_refunds', n); END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'account deletion purge failed on private.account_deletion_web_refunds (SQLSTATE %)', SQLSTATE;
    failed := failed || to_jsonb('private.account_deletion_web_refunds'::text);
  END;
  PERFORM set_config('chaarlie.account_purge', '', true);
  RETURN jsonb_build_object('deleted', deleted, 'failed', failed, 'stillReferenced', referenced);
END
$$;

REVOKE ALL ON FUNCTION public.account_deletion_record_post_deletion_refund(text, text),
  public.account_deletion_due_web_refunds(integer, uuid),
  public.account_deletion_web_refund_plan(text, text, integer, text),
  public.account_deletion_web_refund_result(text, text, integer, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_record_post_deletion_refund(text, text),
  public.account_deletion_due_web_refunds(integer, uuid),
  public.account_deletion_web_refund_plan(text, text, integer, text),
  public.account_deletion_web_refund_result(text, text, integer, text, text, boolean) TO service_role;
