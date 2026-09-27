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

-- Newer-wins: a payload with an older signed_date never overwrites the row (Apple
-- delivers notifications out of order and apps may post stale copies); an equal
-- signed_date is an idempotent replay. Ownership is separate from payload state:
-- an unbound row binds once and is never rebound or unbound. Returns the owner
-- after the write so the caller can detect a subscription bound to another account.
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
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_signed_date IS NULL OR p_purchase_date IS NULL OR p_expires_date IS NULL THEN
    RAISE EXCEPTION 'invalid_app_store_transaction';
  END IF;
  INSERT INTO public.app_store_transactions AS t (
    transaction_id, original_transaction_id, user_id, app_account_token, product_id,
    environment, purchase_date, expires_date, offer_type, is_trial, revocation_date,
    revocation_reason, signed_date
  ) VALUES (
    p_transaction_id, p_original_transaction_id, p_user_id, p_app_account_token, p_product_id,
    p_environment, p_purchase_date, p_expires_date, p_offer_type, COALESCE(p_is_trial, false),
    p_revocation_date, p_revocation_reason, p_signed_date
  ) ON CONFLICT (transaction_id) DO UPDATE
    SET original_transaction_id = EXCLUDED.original_transaction_id,
        app_account_token = EXCLUDED.app_account_token,
        product_id = EXCLUDED.product_id,
        environment = EXCLUDED.environment,
        purchase_date = EXCLUDED.purchase_date,
        expires_date = EXCLUDED.expires_date,
        offer_type = EXCLUDED.offer_type,
        is_trial = EXCLUDED.is_trial,
        revocation_date = EXCLUDED.revocation_date,
        revocation_reason = EXCLUDED.revocation_reason,
        signed_date = EXCLUDED.signed_date,
        updated_at = clock_timestamp()
    WHERE EXCLUDED.signed_date >= t.signed_date;

  UPDATE public.app_store_transactions
    SET user_id = p_user_id, updated_at = clock_timestamp()
    WHERE transaction_id = p_transaction_id AND user_id IS NULL AND p_user_id IS NOT NULL
    RETURNING user_id INTO v_owner;
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.app_store_transactions WHERE transaction_id = p_transaction_id;
  END IF;
  RETURN v_owner;
END $$;

CREATE FUNCTION public.app_store_upsert_subscription_status(
  p_original_transaction_id text,
  p_user_id uuid,
  p_auto_renew_status boolean,
  p_auto_renew_product_id text,
  p_in_billing_retry boolean,
  p_grace_period_expires_date timestamptz,
  p_expiration_intent integer,
  p_signed_date timestamptz,
  p_last_notification_type text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_signed_date IS NULL OR p_auto_renew_status IS NULL OR p_in_billing_retry IS NULL THEN
    RAISE EXCEPTION 'invalid_app_store_subscription_status';
  END IF;
  INSERT INTO public.app_store_subscription_status AS s (
    original_transaction_id, user_id, auto_renew_status, auto_renew_product_id,
    in_billing_retry, grace_period_expires_date, expiration_intent, signed_date,
    last_notification_type
  ) VALUES (
    p_original_transaction_id, p_user_id, p_auto_renew_status, p_auto_renew_product_id,
    p_in_billing_retry, p_grace_period_expires_date, p_expiration_intent, p_signed_date,
    p_last_notification_type
  ) ON CONFLICT (original_transaction_id) DO UPDATE
    SET auto_renew_status = EXCLUDED.auto_renew_status,
        auto_renew_product_id = EXCLUDED.auto_renew_product_id,
        in_billing_retry = EXCLUDED.in_billing_retry,
        grace_period_expires_date = EXCLUDED.grace_period_expires_date,
        expiration_intent = EXCLUDED.expiration_intent,
        signed_date = EXCLUDED.signed_date,
        last_notification_type = EXCLUDED.last_notification_type,
        updated_at = clock_timestamp()
    WHERE EXCLUDED.signed_date >= s.signed_date;

  UPDATE public.app_store_subscription_status
    SET user_id = p_user_id, updated_at = clock_timestamp()
    WHERE original_transaction_id = p_original_transaction_id AND user_id IS NULL AND p_user_id IS NOT NULL
    RETURNING user_id INTO v_owner;
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.app_store_subscription_status
      WHERE original_transaction_id = p_original_transaction_id;
  END IF;
  RETURN v_owner;
END $$;

REVOKE ALL ON FUNCTION
  public.app_store_upsert_transaction(text, text, uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, timestamptz, integer, timestamptz),
  public.app_store_upsert_subscription_status(text, uuid, boolean, text, boolean, timestamptz, integer, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.app_store_upsert_transaction(text, text, uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, timestamptz, integer, timestamptz),
  public.app_store_upsert_subscription_status(text, uuid, boolean, text, boolean, timestamptz, integer, timestamptz, text)
  TO service_role;
