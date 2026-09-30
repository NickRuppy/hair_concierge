-- Account deletion D14 (iOS paywall): a live web subscription (Stripe/PayPal) is cancelled
-- immediately and its unused, prepaid time refunded pro rata. One row per provider
-- subscription, recorded before the cancellation and due once the deletion marked web
-- billing cancelled; the refund itself is retried by the reconcile cron until done.
-- No user id or email: the row outlives the account as billing evidence and makes the
-- refund's provider webhooks recognisable as no-ops.

CREATE TABLE private.account_deletion_web_refunds (
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  subscription_id text NOT NULL CHECK (subscription_id ~ '^[A-Za-z0-9_-]{1,255}$'),
  -- The deletion request that cancelled it; the refund's idempotency key derives from it.
  request_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'recorded' CHECK (state IN ('recorded', 'due', 'done')),
  refunded_minor integer CHECK (refunded_minor IS NULL OR refunded_minor >= 0),
  -- The refunded provider payment (Stripe PaymentIntent, PayPal transaction).
  payment_ref text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (provider, subscription_id),
  CHECK ((state = 'done') = (completed_at IS NOT NULL AND refunded_minor IS NOT NULL))
);
CREATE INDEX account_deletion_web_refunds_request ON private.account_deletion_web_refunds (request_id);
CREATE INDEX account_deletion_web_refunds_due
  ON private.account_deletion_web_refunds (updated_at) WHERE state = 'due';
CREATE INDEX account_deletion_web_refunds_payment
  ON private.account_deletion_web_refunds (provider, payment_ref) WHERE payment_ref IS NOT NULL;
ALTER TABLE private.account_deletion_web_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_deletion_web_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.account_deletion_web_refunds TO service_role;

-- Before cancelling: the subscriptions this request is about to cancel. A newer request of
-- the same account takes over rows no refund was attempted for yet.
CREATE FUNCTION public.account_deletion_record_web_subscriptions(p_request_id uuid, p_subscriptions jsonb)
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
    SET request_id = excluded.request_id, updated_at = now()
    WHERE account_deletion_web_refunds.state = 'recorded';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

-- Unchanged transition; additionally the recorded refunds of this request become due.
CREATE OR REPLACE FUNCTION public.account_deletion_mark_billing_cancelled(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state text;
BEGIN
  UPDATE private.account_deletion_operations
    SET state = 'web_billing_cancelled', updated_at = now()
    WHERE request_id = p_request_id AND state = 'requested';
  SELECT state INTO v_state FROM private.account_deletion_operations WHERE request_id = p_request_id;
  IF v_state IS NULL THEN RAISE EXCEPTION 'operation_not_found' USING ERRCODE = 'P0002'; END IF;
  UPDATE private.account_deletion_web_refunds SET state = 'due', updated_at = now()
    WHERE request_id = p_request_id AND state = 'recorded';
  RETURN jsonb_build_object('state', v_state);
END
$$;

-- Refunds still to settle (optionally one request's).
CREATE FUNCTION public.account_deletion_due_web_refunds(p_limit integer DEFAULT 20, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'subscriptionId', subscription_id,
      'requestId', request_id, 'recordedAt', created_at, 'attempts', attempts) ORDER BY updated_at), '[]')
  FROM (SELECT * FROM private.account_deletion_web_refunds WHERE state = 'due'
      AND (p_request_id IS NULL OR request_id = p_request_id)
    ORDER BY updated_at LIMIT greatest(1, least(coalesce(p_limit, 20), 100))) due
$$;

-- Settles a due refund (p_error_code NULL; 0 = nothing to refund) or counts a failed attempt.
CREATE FUNCTION public.account_deletion_web_refund_result(p_provider text, p_subscription_id text,
  p_refunded_minor integer, p_payment_ref text, p_error_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.account_deletion_web_refunds;
BEGIN
  IF p_error_code IS NULL THEN
    UPDATE private.account_deletion_web_refunds
      SET state = 'done', refunded_minor = p_refunded_minor, payment_ref = nullif(btrim(p_payment_ref), ''),
        last_error_code = NULL, completed_at = now(), updated_at = now()
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due'
      RETURNING * INTO r;
  ELSE
    UPDATE private.account_deletion_web_refunds
      SET attempts = attempts + 1, updated_at = now(),
        last_error_code = CASE WHEN p_error_code ~ '^[a-z][a-z0-9_]{0,63}$' THEN p_error_code ELSE 'unknown' END
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due'
      RETURNING * INTO r;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
  RETURN jsonb_build_object('state', r.state, 'attempts', r.attempts);
END
$$;

-- Webhooks: is this subscription (or refunded payment) one a deletion cancelled?
CREATE FUNCTION public.account_deletion_web_refund_known(p_provider text, p_subscription_id text,
  p_payment_ref text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.account_deletion_web_refunds
    WHERE provider = p_provider AND state IN ('due', 'done')
      AND (subscription_id = p_subscription_id OR payment_ref = p_payment_ref))
$$;

REVOKE ALL ON FUNCTION public.account_deletion_record_web_subscriptions(uuid, jsonb),
  public.account_deletion_due_web_refunds(integer, uuid),
  public.account_deletion_web_refund_result(text, text, integer, text, text),
  public.account_deletion_web_refund_known(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_record_web_subscriptions(uuid, jsonb),
  public.account_deletion_due_web_refunds(integer, uuid),
  public.account_deletion_web_refund_result(text, text, integer, text, text),
  public.account_deletion_web_refund_known(text, text, text) TO service_role;
