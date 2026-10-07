-- Account deletion refunds, review round 2:
-- * I-2: a post-deletion (R-a) refund covers only payments made at/after the deletion
--   (`payments_from` = the anonymization time of the checkout's lead/enrollment/intent).
-- * I-1: a deletion row settled with nothing paid out (e.g. a PayPal agreement still awaiting
--   approval at deletion) is taken over by a later R-a record, so a charge after the deletion
--   is still refunded. Rows that paid something are never taken over (no second payout).
-- * m3: every provider payment a refund is requested for is kept in `refund_payment_refs`, so
--   each refund webhook of a multi-payment R-a refund is recognised as ours.

ALTER TABLE private.account_deletion_web_refunds
  ADD COLUMN payments_from timestamptz,
  ADD COLUMN refund_payment_refs text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT account_deletion_web_refunds_post_deletion_scope
    CHECK (kind <> 'post_deletion' OR payments_from IS NOT NULL) NOT VALID;
UPDATE private.account_deletion_web_refunds
  SET refund_payment_refs = array_remove(ARRAY[payment_ref, planned_payment_ref], NULL);
UPDATE private.account_deletion_web_refunds SET payments_from = recorded_at
  WHERE kind = 'post_deletion' AND payments_from IS NULL;
ALTER TABLE private.account_deletion_web_refunds
  VALIDATE CONSTRAINT account_deletion_web_refunds_post_deletion_scope;

DROP FUNCTION public.account_deletion_record_post_deletion_refund(text, text);
CREATE FUNCTION public.account_deletion_record_post_deletion_refund(p_provider text, p_subscription_id text,
  p_payments_from timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF p_payments_from IS NULL THEN
    RAISE EXCEPTION 'payments_from_required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.account_deletion_web_refunds(provider, subscription_id, request_id, kind, state,
      payments_from)
    VALUES (p_provider, p_subscription_id, gen_random_uuid(), 'post_deletion', 'due', p_payments_from)
  ON CONFLICT (provider, subscription_id) DO UPDATE
    SET kind = 'post_deletion', state = 'due', request_id = gen_random_uuid(), recorded_at = now(),
      payments_from = excluded.payments_from, attempts = 0, last_error_code = NULL,
      refunded_minor = NULL, payment_ref = NULL, planned_minor = NULL, planned_payment_ref = NULL,
      completed_at = NULL, purge_after = NULL, updated_at = now()
    WHERE account_deletion_web_refunds.kind = 'deletion' AND account_deletion_web_refunds.state = 'done'
      AND account_deletion_web_refunds.refunded_minor = 0;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_due_web_refunds(p_limit integer DEFAULT 20, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'subscriptionId', subscription_id,
      'requestId', request_id, 'kind', kind, 'recordedAt', recorded_at, 'paymentsFrom', payments_from,
      'attempts', attempts, 'plannedMinor', planned_minor, 'plannedPaymentRef', planned_payment_ref)
      ORDER BY updated_at), '[]')
  FROM (SELECT * FROM private.account_deletion_web_refunds WHERE state = 'due'
      AND (p_request_id IS NULL OR request_id = p_request_id)
    ORDER BY updated_at LIMIT greatest(1, least(coalesce(p_limit, 20), 100))) due
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_web_refund_plan(p_provider text, p_subscription_id text,
  p_planned_minor integer, p_payment_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.account_deletion_web_refunds
    SET planned_minor = p_planned_minor, planned_payment_ref = p_payment_ref, updated_at = now(),
      refund_payment_refs = CASE WHEN p_payment_ref = ANY(refund_payment_refs) THEN refund_payment_refs
        ELSE array_append(refund_payment_refs, p_payment_ref) END
    WHERE provider = p_provider AND subscription_id = p_subscription_id AND state = 'due';
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_due' USING ERRCODE = '55000'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_web_refund_known(p_provider text, p_subscription_id text,
  p_payment_ref text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.account_deletion_web_refunds
    WHERE provider = p_provider AND state <> 'recorded'
      AND (subscription_id = p_subscription_id OR payment_ref = p_payment_ref
        OR p_payment_ref = ANY(refund_payment_refs)))
$$;

REVOKE ALL ON FUNCTION public.account_deletion_record_post_deletion_refund(text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_record_post_deletion_refund(text, text, timestamptz)
  TO service_role;
