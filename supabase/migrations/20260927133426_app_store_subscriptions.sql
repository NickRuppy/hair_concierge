-- Apple App Store entitlements for the iOS scanner subscription. Service-only: the
-- mobile server writes Apple-verified JWS data; the web never grants access from it.
-- Access is derived from transaction-level rows (a refund revokes only its own
-- period) plus per-subscription renewal status (billing retry / grace period).
-- Rows stay unbound (user_id NULL) until the owning account posts or Apple echoes
-- our appAccountToken. Account deletion cascades.
CREATE TABLE public.app_store_transactions (
  transaction_id text PRIMARY KEY CHECK (length(transaction_id) BETWEEN 1 AND 64),
  original_transaction_id text NOT NULL CHECK (length(original_transaction_id) BETWEEN 1 AND 64),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_account_token uuid,
  product_id text NOT NULL CHECK (length(product_id) BETWEEN 1 AND 64),
  environment text NOT NULL CHECK (environment IN ('Production', 'Sandbox', 'Xcode')),
  purchase_date timestamptz NOT NULL,
  expires_date timestamptz NOT NULL,
  offer_type integer,
  is_trial boolean NOT NULL DEFAULT false,
  revocation_date timestamptz,
  revocation_reason integer,
  signed_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX app_store_transactions_owner
  ON public.app_store_transactions(user_id, expires_date DESC) WHERE user_id IS NOT NULL;
CREATE INDEX app_store_transactions_original
  ON public.app_store_transactions(original_transaction_id);
ALTER TABLE public.app_store_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_store_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_store_transactions TO service_role;

CREATE TABLE public.app_store_subscription_status (
  original_transaction_id text PRIMARY KEY CHECK (length(original_transaction_id) BETWEEN 1 AND 64),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('Production', 'Sandbox', 'Xcode')),
  auto_renew_status boolean NOT NULL,
  auto_renew_product_id text,
  in_billing_retry boolean NOT NULL,
  grace_period_expires_date timestamptz,
  expiration_intent integer,
  signed_date timestamptz NOT NULL,
  last_notification_type text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX app_store_subscription_status_owner
  ON public.app_store_subscription_status(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.app_store_subscription_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_store_subscription_status FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_store_subscription_status TO service_role;

-- Write rules, enforced here for every writer (app post, notification webhook):
-- * Newer-wins: a payload with an older signed_date never overwrites state (Apple
--   delivers out of order; apps may post stale copies). An equal signed_date is an
--   idempotent replay.
-- * Identity is immutable: a stored row never changes environment or
--   original_transaction_id; such a write changes nothing and is reported.
-- * One subscription (original_transaction_id) belongs to one account (plan A3).
--   Rows bind once to the subscription owner and are never rebound or unbound; a
--   write for another account is refused as owned_by_other_account (-> HTTP 409),
--   while the Apple-verified state itself is still recorded for the owner.
-- A per-subscription advisory lock serializes concurrent writers of one family.
-- Result: {"outcome": applied|stale|owned_by_other_account|environment_mismatch|
-- identity_mismatch, "owner": uuid|null}.
CREATE FUNCTION private.app_store_subscription_owner(p_original_transaction_id text)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT user_id FROM (
    SELECT user_id FROM public.app_store_transactions
      WHERE original_transaction_id = p_original_transaction_id AND user_id IS NOT NULL
    UNION ALL
    SELECT user_id FROM public.app_store_subscription_status
      WHERE original_transaction_id = p_original_transaction_id AND user_id IS NOT NULL
  ) bound LIMIT 1
$$;

CREATE FUNCTION public.app_store_upsert_transaction(
  p_transaction_id text,
  p_original_transaction_id text,
  p_user_id uuid,
  p_app_account_token uuid,
  p_product_id text,
  p_environment text,
  p_purchase_date timestamptz,
  p_expires_date timestamptz,
  p_offer_type integer,
  p_is_trial boolean,
  p_revocation_date timestamptz,
  p_revocation_reason integer,
  p_signed_date timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_existing public.app_store_transactions;
  v_owner uuid;
  v_outcome text;
BEGIN
  IF p_transaction_id IS NULL OR p_original_transaction_id IS NULL
    OR p_signed_date IS NULL OR p_purchase_date IS NULL OR p_expires_date IS NULL THEN
    RAISE EXCEPTION 'invalid_app_store_transaction';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('app-store-subscription:' || p_original_transaction_id, 0));
  SELECT * INTO v_existing FROM public.app_store_transactions
    WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF FOUND AND v_existing.original_transaction_id <> p_original_transaction_id THEN
    RETURN jsonb_build_object('outcome', 'identity_mismatch', 'owner', v_existing.user_id);
  END IF;
  IF FOUND AND v_existing.environment <> p_environment THEN
    RETURN jsonb_build_object('outcome', 'environment_mismatch', 'owner', v_existing.user_id);
  END IF;

  v_owner := private.app_store_subscription_owner(p_original_transaction_id);
  IF p_user_id IS NOT NULL AND v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    v_outcome := 'owned_by_other_account';
  END IF;
  v_owner := COALESCE(v_owner, p_user_id);

  IF v_existing.transaction_id IS NULL THEN
    INSERT INTO public.app_store_transactions (
      transaction_id, original_transaction_id, user_id, app_account_token, product_id,
      environment, purchase_date, expires_date, offer_type, is_trial, revocation_date,
      revocation_reason, signed_date
    ) VALUES (
      p_transaction_id, p_original_transaction_id, v_owner, p_app_account_token, p_product_id,
      p_environment, p_purchase_date, p_expires_date, p_offer_type, COALESCE(p_is_trial, false),
      p_revocation_date, p_revocation_reason, p_signed_date
    );
    v_outcome := COALESCE(v_outcome, 'applied');
  ELSIF p_signed_date >= v_existing.signed_date THEN
    UPDATE public.app_store_transactions
      SET user_id = COALESCE(user_id, v_owner),
          app_account_token = p_app_account_token,
          product_id = p_product_id,
          purchase_date = p_purchase_date,
          expires_date = p_expires_date,
          offer_type = p_offer_type,
          is_trial = COALESCE(p_is_trial, false),
          revocation_date = p_revocation_date,
          revocation_reason = p_revocation_reason,
          signed_date = p_signed_date,
          updated_at = clock_timestamp()
      WHERE transaction_id = p_transaction_id;
    v_outcome := COALESCE(v_outcome, 'applied');
  ELSE
    -- Stale state is ignored, but ownership may still bind.
    UPDATE public.app_store_transactions
      SET user_id = v_owner, updated_at = clock_timestamp()
      WHERE transaction_id = p_transaction_id AND user_id IS NULL AND v_owner IS NOT NULL;
    v_outcome := COALESCE(v_outcome, 'stale');
  END IF;
  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'owner', (SELECT user_id FROM public.app_store_transactions WHERE transaction_id = p_transaction_id)
  );
END $$;

CREATE FUNCTION public.app_store_upsert_subscription_status(
  p_original_transaction_id text,
  p_user_id uuid,
  p_environment text,
  p_auto_renew_status boolean,
  p_auto_renew_product_id text,
  p_in_billing_retry boolean,
  p_grace_period_expires_date timestamptz,
  p_expiration_intent integer,
  p_signed_date timestamptz,
  p_last_notification_type text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_existing public.app_store_subscription_status;
  v_owner uuid;
  v_outcome text;
BEGIN
  IF p_original_transaction_id IS NULL OR p_signed_date IS NULL
    OR p_auto_renew_status IS NULL OR p_in_billing_retry IS NULL THEN
    RAISE EXCEPTION 'invalid_app_store_subscription_status';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('app-store-subscription:' || p_original_transaction_id, 0));
  SELECT * INTO v_existing FROM public.app_store_subscription_status
    WHERE original_transaction_id = p_original_transaction_id FOR UPDATE;
  IF FOUND AND v_existing.environment <> p_environment THEN
    RETURN jsonb_build_object('outcome', 'environment_mismatch', 'owner', v_existing.user_id);
  END IF;

  v_owner := private.app_store_subscription_owner(p_original_transaction_id);
  IF p_user_id IS NOT NULL AND v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    v_outcome := 'owned_by_other_account';
  END IF;
  v_owner := COALESCE(v_owner, p_user_id);

  IF v_existing.original_transaction_id IS NULL THEN
    INSERT INTO public.app_store_subscription_status (
      original_transaction_id, user_id, environment, auto_renew_status, auto_renew_product_id,
      in_billing_retry, grace_period_expires_date, expiration_intent, signed_date,
      last_notification_type
    ) VALUES (
      p_original_transaction_id, v_owner, p_environment, p_auto_renew_status, p_auto_renew_product_id,
      p_in_billing_retry, p_grace_period_expires_date, p_expiration_intent, p_signed_date,
      p_last_notification_type
    );
    v_outcome := COALESCE(v_outcome, 'applied');
  ELSIF p_signed_date >= v_existing.signed_date THEN
    UPDATE public.app_store_subscription_status
      SET user_id = COALESCE(user_id, v_owner),
          auto_renew_status = p_auto_renew_status,
          auto_renew_product_id = p_auto_renew_product_id,
          in_billing_retry = p_in_billing_retry,
          grace_period_expires_date = p_grace_period_expires_date,
          expiration_intent = p_expiration_intent,
          signed_date = p_signed_date,
          last_notification_type = p_last_notification_type,
          updated_at = clock_timestamp()
      WHERE original_transaction_id = p_original_transaction_id;
    v_outcome := COALESCE(v_outcome, 'applied');
  ELSE
    UPDATE public.app_store_subscription_status
      SET user_id = v_owner, updated_at = clock_timestamp()
      WHERE original_transaction_id = p_original_transaction_id AND user_id IS NULL AND v_owner IS NOT NULL;
    v_outcome := COALESCE(v_outcome, 'stale');
  END IF;
  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'owner', (SELECT user_id FROM public.app_store_subscription_status
      WHERE original_transaction_id = p_original_transaction_id)
  );
END $$;

REVOKE ALL ON FUNCTION private.app_store_subscription_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.app_store_subscription_owner(text) TO service_role;
REVOKE ALL ON FUNCTION
  public.app_store_upsert_transaction(text, text, uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, timestamptz, integer, timestamptz),
  public.app_store_upsert_subscription_status(text, uuid, text, boolean, text, boolean, timestamptz, integer, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.app_store_upsert_transaction(text, text, uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, timestamptz, integer, timestamptz),
  public.app_store_upsert_subscription_status(text, uuid, text, boolean, text, boolean, timestamptz, integer, timestamptz, text)
  TO service_role;
