ALTER TABLE public.membership_reactivation_checkout_reservations
  ADD COLUMN stripe_checkout_context jsonb;

CREATE OR REPLACE FUNCTION public.prepare_membership_reactivation_stripe_checkout(
  p_reservation_id uuid,
  p_user_id uuid,
  p_context jsonb
)
RETURNS public.membership_reactivation_checkout_reservations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation public.membership_reactivation_checkout_reservations;
  params jsonb;
  expiry bigint;
BEGIN
  SELECT * INTO reservation
  FROM public.membership_reactivation_checkout_reservations
  WHERE id = p_reservation_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR reservation.status IN ('completed', 'expired') OR reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'reactivation checkout reservation closed or expired' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.provider IS NOT NULL AND reservation.provider <> 'stripe' THEN
    RAISE EXCEPTION 'reactivation checkout provider already selected' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_context) IS DISTINCT FROM 'object'
    OR p_context->'version' IS DISTINCT FROM '1'::jsonb
    OR p_context->>'user_id' IS DISTINCT FROM p_user_id::text
    OR jsonb_typeof(p_context->'livemode') IS DISTINCT FROM 'boolean'
    OR coalesce(p_context->>'stripe_account_id', '') !~ '^acct_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'reactivation checkout context identity invalid' USING ERRCODE = 'P0001';
  END IF;

  IF reservation.stripe_checkout_context IS NOT NULL THEN
    IF reservation.provider IS DISTINCT FROM 'stripe'
      OR reservation.stripe_checkout_context->'version' IS DISTINCT FROM '1'::jsonb
      OR reservation.stripe_checkout_context->>'user_id' IS DISTINCT FROM p_user_id::text
      OR reservation.stripe_checkout_context->'stripe_account_id' IS DISTINCT FROM p_context->'stripe_account_id'
      OR reservation.stripe_checkout_context->'livemode' IS DISTINCT FROM p_context->'livemode' THEN
      RAISE EXCEPTION 'reactivation checkout provider context changed' USING ERRCODE = 'P0001';
    END IF;
    -- Profile/email/price/origin changes never reconstruct a different request.
    RETURN reservation;
  END IF;
  IF reservation.status <> 'open' OR reservation.provider IS NOT NULL OR reservation.provider_reference IS NOT NULL THEN
    RAISE EXCEPTION 'reactivation checkout legacy attempt cannot adopt new keys' USING ERRCODE = 'P0001';
  END IF;

  params := p_context->'initial_params';
  expiry := floor(extract(epoch FROM reservation.expires_at));
  IF p_context ? 'recovery_params'
    OR (p_context - ARRAY['version','stripe_account_id','livemode','user_id','account_email','profile_customer_id','initial_params','expires_at']) <> '{}'::jsonb
    OR jsonb_typeof(p_context->'account_email') IS DISTINCT FROM 'string'
    OR coalesce(p_context->>'account_email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    OR NOT (p_context ? 'profile_customer_id')
    OR (p_context->'profile_customer_id' <> 'null'::jsonb AND coalesce(p_context->>'profile_customer_id', '') !~ '^cus_[A-Za-z0-9_]+$')
    OR p_context->'expires_at' IS DISTINCT FROM to_jsonb(expiry)
    OR jsonb_typeof(params) IS DISTINCT FROM 'object'
    OR params->>'mode' IS DISTINCT FROM 'subscription'
    OR params->'expires_at' IS DISTINCT FROM to_jsonb(expiry)
    OR params#>>'{metadata,checkout_context}' IS DISTINCT FROM 'membership_reactivation'
    OR params#>>'{metadata,reactivation_reservation_id}' IS DISTINCT FROM p_reservation_id::text
    OR jsonb_typeof(params->'line_items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(params->'line_items') <> 1
    OR coalesce(params#>>'{line_items,0,price}', '') = ''
    OR params#>'{line_items,0,quantity}' IS DISTINCT FROM '1'::jsonb
    OR (params - ARRAY['mode','ui_mode','line_items','customer','customer_email','return_url','success_url','cancel_url','redirect_on_completion','expires_at','automatic_tax','subscription_data','excluded_payment_method_types','consent_collection','custom_text','metadata']) <> '{}'::jsonb
    OR (CASE WHEN params ? 'customer' THEN
      jsonb_typeof(params->'customer') IS DISTINCT FROM 'string'
      OR coalesce(params->>'customer', '') !~ '^cus_[A-Za-z0-9_]+$'
      OR params->'customer' IS DISTINCT FROM p_context->'profile_customer_id'
      OR params ? 'customer_email'
    ELSE params->'customer_email' IS DISTINCT FROM p_context->'account_email' END)
    OR expiry < extract(epoch FROM now()) + 1800
    OR expiry > extract(epoch FROM now()) + 86400 THEN
    RAISE EXCEPTION 'reactivation checkout request or expiry invalid' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.membership_reactivation_checkout_reservations
  SET provider = 'stripe', status = 'reconciliation_required', stripe_checkout_context = p_context, updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO reservation;
  RETURN reservation;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_membership_reactivation_stripe_checkout(
  p_reservation_id uuid,
  p_user_id uuid,
  p_stripe_account_id text,
  p_livemode boolean,
  p_original_customer_id text
)
RETURNS public.membership_reactivation_checkout_reservations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation public.membership_reactivation_checkout_reservations;
  context jsonb;
BEGIN
  SELECT * INTO reservation
  FROM public.membership_reactivation_checkout_reservations
  WHERE id = p_reservation_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR reservation.status IN ('completed','expired') OR reservation.expires_at <= now()
    OR reservation.provider IS DISTINCT FROM 'stripe' OR reservation.provider_reference IS NOT NULL THEN
    RAISE EXCEPTION 'reactivation checkout cannot recover selected attempt' USING ERRCODE = 'P0001';
  END IF;
  context := reservation.stripe_checkout_context;
  IF jsonb_typeof(context) IS DISTINCT FROM 'object' OR context->'version' IS DISTINCT FROM '1'::jsonb
    OR context->>'user_id' IS DISTINCT FROM p_user_id::text
    OR p_stripe_account_id IS NULL OR context->>'stripe_account_id' IS DISTINCT FROM p_stripe_account_id
    OR p_livemode IS NULL OR context->'livemode' IS DISTINCT FROM to_jsonb(p_livemode)
    OR coalesce(p_original_customer_id,'') !~ '^cus_[A-Za-z0-9_]+$'
    OR context#>>'{initial_params,customer}' IS DISTINCT FROM p_original_customer_id
    OR context#>>'{initial_params,metadata,reactivation_reservation_id}' IS DISTINCT FROM p_reservation_id::text THEN
    RAISE EXCEPTION 'reactivation checkout recovery identity conflict' USING ERRCODE = 'P0001';
  END IF;
  IF context ? 'recovery_params' THEN
    RETURN reservation;
  END IF;
  -- Only the caller's verified customer-specific rejection permits this RPC.
  -- The caller cannot change price, metadata, expiry, email or original parameters.
  UPDATE public.membership_reactivation_checkout_reservations
  SET stripe_checkout_context = jsonb_set(context, '{recovery_params}',
      ((context->'initial_params') - 'customer') || jsonb_build_object('customer_email', context->>'account_email')),
      status = 'reconciliation_required', updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO reservation;
  RETURN reservation;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_membership_reactivation_stripe_checkout(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_membership_reactivation_stripe_checkout(uuid,uuid,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_membership_reactivation_stripe_checkout(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_membership_reactivation_stripe_checkout(uuid,uuid,text,boolean,text) TO service_role;

-- One client token response authorizes at most one PayPal SDK create. Lock the
-- reservation before the intent so expiry/completion and issuance cannot race.
CREATE OR REPLACE FUNCTION public.claim_membership_reactivation_paypal_client_creation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_intent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reservation public.membership_reactivation_checkout_reservations;
  intent public.paypal_checkout_intents;
BEGIN
  SELECT * INTO reservation
  FROM public.membership_reactivation_checkout_reservations
  WHERE id = p_reservation_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR reservation.provider IS DISTINCT FROM 'paypal'
    OR reservation.status NOT IN ('provider_selected','provider_created','reconciliation_required')
    OR reservation.expires_at <= clock_timestamp()
    OR reservation.stripe_checkout_context IS NOT NULL
    OR reservation.provider_reference IS DISTINCT FROM p_intent_id::text THEN
    RETURN false;
  END IF;

  SELECT * INTO intent FROM public.paypal_checkout_intents
  WHERE id = p_intent_id AND user_id = p_user_id AND reactivation_reservation_id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND OR intent.status <> 'created'
    OR intent.expires_at <= clock_timestamp()
    OR reservation.expires_at <= clock_timestamp()
    OR intent.provider_subscription_id IS NOT NULL
    OR intent.metadata ? 'reactivation_client_creation_issued_at' THEN
    RETURN false;
  END IF;

  UPDATE public.membership_reactivation_checkout_reservations
  SET status = 'reconciliation_required', updated_at = clock_timestamp()
  WHERE id = p_reservation_id;
  UPDATE public.paypal_checkout_intents
  SET metadata = metadata || jsonb_build_object('reactivation_client_creation_issued_at', clock_timestamp()),
      updated_at = clock_timestamp()
  WHERE id = p_intent_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_membership_reactivation_paypal_client_creation(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_membership_reactivation_paypal_client_creation(uuid,uuid,uuid) TO service_role;
GRANT SELECT, UPDATE ON TABLE public.paypal_checkout_intents TO service_role;

-- Preserve private ledger access; the new RPCs use caller (service-role) privileges.
REVOKE ALL ON TABLE public.membership_reactivation_checkout_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.membership_reactivation_checkout_reservations TO service_role;
COMMENT ON COLUMN public.membership_reactivation_checkout_reservations.stripe_checkout_context IS
  'Private versioned Stripe request snapshot. No client secrets or payment details. Never expose in API responses.';

-- A bound session can still have an unknown payment outcome. Elapsed time must
-- not release a versioned attempt; actual provider expiry is reconciled explicitly.
CREATE OR REPLACE FUNCTION acquire_membership_reactivation_checkout(
  p_user_id uuid,
  p_checkout_attempt_id uuid,
  p_interval text,
  p_return_destination text
)
RETURNS membership_reactivation_checkout_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation membership_reactivation_checkout_reservations;
BEGIN
  IF p_interval NOT IN ('month', 'quarter', 'year') THEN
    RAISE EXCEPTION 'invalid reactivation interval' USING ERRCODE = '22023';
  END IF;

  UPDATE membership_reactivation_checkout_reservations
  SET status = 'expired', updated_at = now()
  WHERE user_id = p_user_id
    AND status IN ('open', 'provider_selected', 'provider_created')
    AND stripe_checkout_context IS NULL
    -- Once the browser received permission to create a PayPal subscription,
    -- a lost callback is uncertain even without a bound provider reference.
    AND NOT EXISTS (
      SELECT 1 FROM public.paypal_checkout_intents AS intent
      WHERE intent.reactivation_reservation_id = membership_reactivation_checkout_reservations.id
        AND intent.metadata ? 'reactivation_client_creation_issued_at'
    )
    AND expires_at <= now();

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE user_id = p_user_id
    AND checkout_attempt_id = p_checkout_attempt_id;

  IF FOUND THEN
    IF reservation.status IN ('expired', 'completed') THEN
      RAISE EXCEPTION 'reactivation checkout attempt is closed' USING ERRCODE = 'P0001';
    END IF;
    IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
      RAISE EXCEPTION 'reactivation checkout attempt parameters changed' USING ERRCODE = 'P0001';
    END IF;
    RETURN reservation;
  END IF;

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE user_id = p_user_id
    AND status IN ('open', 'provider_selected', 'provider_created', 'reconciliation_required')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
      RAISE EXCEPTION 'membership reactivation checkout already in progress'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN reservation;
  END IF;

  BEGIN
    INSERT INTO membership_reactivation_checkout_reservations (
      user_id,
      checkout_attempt_id,
      interval,
      return_destination
    ) VALUES (
      p_user_id,
      p_checkout_attempt_id,
      p_interval,
      p_return_destination
    )
    RETURNING * INTO reservation;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO reservation
    FROM membership_reactivation_checkout_reservations
    WHERE user_id = p_user_id
      AND status IN ('open', 'provider_selected', 'provider_created', 'reconciliation_required')
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
      IF reservation.interval <> p_interval OR reservation.return_destination <> p_return_destination THEN
        RAISE EXCEPTION 'membership reactivation checkout already in progress'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN reservation;
    END IF;

    RAISE EXCEPTION 'membership reactivation checkout already in progress'
      USING ERRCODE = 'P0001';
  END;

  RETURN reservation;
END;
$$;

-- Refuse legacy creation keys during a rollback after versioned work started.
CREATE OR REPLACE FUNCTION claim_membership_reactivation_checkout_provider(
  p_reservation_id uuid,
  p_user_id uuid,
  p_provider text
)
RETURNS membership_reactivation_checkout_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation membership_reactivation_checkout_reservations;
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal') THEN
    RAISE EXCEPTION 'invalid reactivation provider' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO reservation
  FROM membership_reactivation_checkout_reservations
  WHERE id = p_reservation_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR reservation.status IN ('completed', 'expired') OR (
    reservation.status <> 'reconciliation_required'
    AND reservation.expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'reactivation checkout reservation expired' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.stripe_checkout_context IS NOT NULL THEN
    RAISE EXCEPTION 'reactivation checkout requires versioned Stripe protocol' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.paypal_checkout_intents AS intent
    WHERE intent.reactivation_reservation_id = reservation.id
      AND intent.metadata ? 'reactivation_client_creation_issued_at'
  ) THEN
    RAISE EXCEPTION 'reactivation checkout PayPal creation already issued' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.status = 'reconciliation_required' AND reservation.provider IS NULL THEN
    RAISE EXCEPTION 'reactivation checkout reconciliation provider missing' USING ERRCODE = 'P0001';
  END IF;
  IF reservation.provider IS NOT NULL AND reservation.provider <> p_provider THEN
    RAISE EXCEPTION 'reactivation checkout provider already selected' USING ERRCODE = 'P0001';
  END IF;

  UPDATE membership_reactivation_checkout_reservations
  SET provider = p_provider,
      status = CASE WHEN status = 'open' THEN 'provider_selected' ELSE status END,
      updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO reservation;

  RETURN reservation;
END;
$$;
