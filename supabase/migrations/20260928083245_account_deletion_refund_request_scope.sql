-- Account deletion refunds, review round 3:
-- * N3: plan and result are bound to the request that listed the refund as due. A row taken
--   over meanwhile (e.g. an R-a record with a fresh request id) is never planned or settled
--   by an attempt of the earlier request.
-- * N4: a refund waiting on a pending provider payment is moved to the back of the due queue
--   (updated_at), so waiting rows cannot starve the rows behind them.
-- * N2: the kind of an existing refund row, so a webhook whose R-a record was a no-op can tell
--   an already recorded post-deletion refund from a deletion refund it could not take over.

DROP FUNCTION public.account_deletion_web_refund_plan(text, text, integer, text);
DROP FUNCTION public.account_deletion_web_refund_result(text, text, integer, text, text, boolean);

-- M4/m3: the refund about to be requested (amount + payment), for the listed request only.
CREATE FUNCTION public.account_deletion_web_refund_plan(p_provider text, p_subscription_id text,
  p_request_id uuid, p_planned_minor integer, p_payment_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.account_deletion_web_refunds
    SET planned_minor = p_planned_minor, planned_payment_ref = p_payment_ref, updated_at = now(),
      refund_payment_refs = CASE WHEN p_payment_ref = ANY(refund_payment_refs) THEN refund_payment_refs
        ELSE array_append(refund_payment_refs, p_payment_ref) END
    WHERE provider = p_provider AND subscription_id = p_subscription_id AND request_id = p_request_id
      AND state = 'due';
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
END
$$;

-- Settles a due refund (p_error_code NULL; 0 = nothing to refund) or counts a failed attempt;
-- a permanent error (p_manual) or the 10th failure ends in 'failed_manual' for an operator.
-- Only the request that listed the refund may settle it.
CREATE FUNCTION public.account_deletion_web_refund_result(p_provider text, p_subscription_id text,
  p_request_id uuid, p_refunded_minor integer, p_payment_ref text, p_error_code text,
  p_manual boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.account_deletion_web_refunds;
BEGIN
  IF p_error_code IS NULL THEN
    UPDATE private.account_deletion_web_refunds
      SET state = 'done', refunded_minor = p_refunded_minor, payment_ref = nullif(btrim(p_payment_ref), ''),
        last_error_code = NULL, completed_at = now(), updated_at = now(),
        purge_after = now() + private.account_deletion_retention('billing')
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND request_id = p_request_id
        AND state = 'due'
      RETURNING * INTO r;
  ELSE
    UPDATE private.account_deletion_web_refunds
      SET attempts = attempts + 1, updated_at = now(),
        last_error_code = CASE WHEN p_error_code ~ '^[a-z][a-z0-9_]{0,63}$' THEN p_error_code ELSE 'unknown' END,
        state = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10 THEN 'failed_manual' ELSE state END,
        completed_at = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10 THEN now() END,
        purge_after = CASE WHEN coalesce(p_manual, false) OR attempts + 1 >= 10
          THEN now() + private.account_deletion_retention('billing') END
      WHERE provider = p_provider AND subscription_id = p_subscription_id AND request_id = p_request_id
        AND state = 'due'
      RETURNING * INTO r;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
  RETURN jsonb_build_object('state', r.state, 'attempts', r.attempts);
END
$$;

-- N4: a payment in scope is still pending; the refund stays due (no attempt counted) and
-- moves behind the other due rows. False when the row is no longer due for this request.
CREATE FUNCTION public.account_deletion_web_refund_waiting(p_provider text, p_subscription_id text,
  p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.account_deletion_web_refunds SET updated_at = now()
    WHERE provider = p_provider AND subscription_id = p_subscription_id AND request_id = p_request_id
      AND state = 'due';
  RETURN FOUND;
END
$$;

-- N2: 'deletion', 'post_deletion' or NULL (no row) for a provider subscription.
CREATE FUNCTION public.account_deletion_web_refund_kind(p_provider text, p_subscription_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT kind FROM private.account_deletion_web_refunds
    WHERE provider = p_provider AND subscription_id = p_subscription_id
$$;

REVOKE ALL ON FUNCTION public.account_deletion_web_refund_plan(text, text, uuid, integer, text),
  public.account_deletion_web_refund_result(text, text, uuid, integer, text, text, boolean),
  public.account_deletion_web_refund_waiting(text, text, uuid),
  public.account_deletion_web_refund_kind(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_web_refund_plan(text, text, uuid, integer, text),
  public.account_deletion_web_refund_result(text, text, uuid, integer, text, text, boolean),
  public.account_deletion_web_refund_waiting(text, text, uuid),
  public.account_deletion_web_refund_kind(text, text) TO service_role;
