CREATE TABLE private.stripe_trial_management_approvals (
  operation_id uuid PRIMARY KEY REFERENCES private.trial_management_operations(id) ON DELETE RESTRICT,
  session_params jsonb NOT NULL,
  session_id text UNIQUE,
  session_create_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  subscription_params jsonb,
  subscription_id text UNIQUE,
  subscription_create_started_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','canceled')),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.stripe_trial_management_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stripe_trial_management_approvals FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.stripe_trial_management_approvals TO service_role;

CREATE FUNCTION public.load_stripe_trial_management_approval(p_operation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT to_jsonb(a)||jsonb_build_object('user_id',o.user_id,'enrollment_id',o.enrollment_id)
    FROM private.stripe_trial_management_approvals a JOIN private.trial_management_operations o ON o.id=a.operation_id
    WHERE a.operation_id=p_operation_id;
$$;
CREATE FUNCTION public.freeze_stripe_trial_management_approval(p_operation_id uuid,p_user_id uuid,p_session_params jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o private.trial_management_operations%ROWTYPE;
BEGIN
  SELECT * INTO o FROM private.trial_management_operations WHERE id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR o.provider<>'stripe' OR o.user_id IS DISTINCT FROM p_user_id
    OR NOT public.guard_trial_management_operation(o.id,p_user_id) THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_session_params) IS DISTINCT FROM 'object' OR p_session_params->>'mode' IS DISTINCT FROM 'setup'
    OR p_session_params->>'customer' IS DISTINCT FROM o.provider_customer_id
    OR p_session_params->'metadata'->>'trial_management_operation_id' IS DISTINCT FROM o.id::text
    OR p_session_params->>'client_reference_id' IS DISTINCT FROM o.id::text
    OR p_session_params ? 'line_items' OR p_session_params ? 'subscription_data' OR p_session_params ? 'payment_intent_data'
  THEN RETURN NULL; END IF;
  INSERT INTO private.stripe_trial_management_approvals(operation_id,session_params) VALUES(o.id,p_session_params)
    ON CONFLICT(operation_id) DO NOTHING;
  RETURN public.load_stripe_trial_management_approval(o.id);
END;
$$;
CREATE FUNCTION public.checkpoint_stripe_trial_management_approval(p_operation_id uuid,p_action text,p_provider_id text DEFAULT NULL,p_params jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a private.stripe_trial_management_approvals%ROWTYPE; o private.trial_management_operations%ROWTYPE;
BEGIN
  SELECT * INTO a FROM private.stripe_trial_management_approvals WHERE operation_id=p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO o FROM private.trial_management_operations WHERE id=a.operation_id;
  IF p_action IN ('session','subscription') AND (p_provider_id IS NULL OR length(p_provider_id) NOT BETWEEN 1 AND 255) THEN RETURN false; END IF;
  IF p_action='session' THEN
    IF a.session_id IS NOT NULL AND a.session_id<>p_provider_id THEN RETURN false; END IF;
    UPDATE private.stripe_trial_management_approvals SET session_id=p_provider_id WHERE operation_id=a.operation_id;
  ELSIF p_action='begin_subscription' THEN
    IF NOT public.guard_trial_management_operation(o.id,o.user_id) OR a.session_id IS NULL OR p_params IS NULL
      OR p_params->>'customer' IS DISTINCT FROM o.provider_customer_id OR p_params->>'billing_cycle_anchor' IS DISTINCT FROM extract(epoch FROM o.original_trial_end_at)::bigint::text
      OR p_params->>'proration_behavior' IS DISTINCT FROM 'none' OR p_params ? 'trial_end' OR p_params ? 'trial_period_days'
      OR p_params->'items' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('price',o.target_offer->>'stripePriceId','quantity',1))
      OR p_params->'billing_mode'->>'type' IS DISTINCT FROM 'flexible'
      OR coalesce(length(p_params->>'default_payment_method'),0) NOT BETWEEN 1 AND 255
      OR (a.subscription_params IS NOT NULL AND a.subscription_params<>p_params)
      OR (a.subscription_create_started_at IS NOT NULL AND a.subscription_create_started_at<=clock_timestamp()-interval '23 hours')
    THEN RETURN false; END IF;
    UPDATE private.stripe_trial_management_approvals SET subscription_params=p_params,
      subscription_create_started_at=coalesce(subscription_create_started_at,clock_timestamp()) WHERE operation_id=a.operation_id;
  ELSIF p_action='subscription' THEN
    IF a.subscription_id IS NOT NULL AND a.subscription_id<>p_provider_id THEN RETURN false; END IF;
    UPDATE private.stripe_trial_management_approvals SET subscription_id=p_provider_id WHERE operation_id=a.operation_id;
  ELSIF p_action='resolved' THEN
    IF o.status<>'committed' OR o.target_agreement_id IS DISTINCT FROM a.subscription_id THEN RETURN false; END IF;
    UPDATE private.stripe_trial_management_approvals SET status='resolved' WHERE operation_id=a.operation_id;
  ELSIF p_action='canceled' THEN
    UPDATE private.stripe_trial_management_approvals SET status='canceled' WHERE operation_id=a.operation_id;
  ELSIF p_action='retry' THEN
    UPDATE private.stripe_trial_management_approvals SET next_attempt_at=clock_timestamp()+interval '5 minutes' WHERE operation_id=a.operation_id;
  ELSE RETURN false; END IF;
  RETURN true;
END;
$$;
CREATE FUNCTION public.list_stripe_trial_management_approvals(p_limit integer DEFAULT 2)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('operation_id',a.operation_id,'user_id',o.user_id)),'[]'::jsonb)
    FROM (SELECT operation_id FROM private.stripe_trial_management_approvals WHERE status='pending'
      AND next_attempt_at<=clock_timestamp() ORDER BY next_attempt_at LIMIT least(greatest(p_limit,1),20)) a
    JOIN private.trial_management_operations o ON o.id=a.operation_id;
$$;
REVOKE ALL ON FUNCTION public.load_stripe_trial_management_approval(uuid),public.freeze_stripe_trial_management_approval(uuid,uuid,jsonb),
  public.checkpoint_stripe_trial_management_approval(uuid,text,text,jsonb),public.list_stripe_trial_management_approvals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.load_stripe_trial_management_approval(uuid),public.freeze_stripe_trial_management_approval(uuid,uuid,jsonb),
  public.checkpoint_stripe_trial_management_approval(uuid,text,text,jsonb),public.list_stripe_trial_management_approvals(integer) TO service_role;
