-- Durable, service-only ledger for privacy-safe payment support reports.
CREATE TABLE public.payment_support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code text NOT NULL CHECK (report_code ~ '^PAY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ_]{8}$'),
  lead_id uuid REFERENCES public.leads(id),
  user_id uuid REFERENCES public.profiles(id),
  checkout_attempt_id text NOT NULL CHECK (
    char_length(checkout_attempt_id) BETWEEN 8 AND 128
    AND checkout_attempt_id ~ '^[A-Za-z0-9_-]+$'
  ),
  reported_checkout_context text NOT NULL CHECK (reported_checkout_context IN ('result_membership', 'result_one_time', 'reactivation')),
  reported_feedback_kind text NOT NULL CHECK (reported_feedback_kind IN (
    'access_already_active', 'checkout_not_loaded', 'details_invalid', 'card_declined',
    'provider_temporarily_unavailable', 'payment_not_completed', 'payment_status_pending',
    'access_activation_delayed'
  )),
  reported_provider text NOT NULL CHECK (reported_provider IN ('stripe', 'paypal', 'unknown')),
  reported_method text NOT NULL CHECK (reported_method IN ('card', 'apple_pay', 'paypal', 'unknown')),
  reported_payment_family text NOT NULL CHECK (reported_payment_family IN (
    'access', 'checkout_load', 'details', 'decline', 'provider', 'payment', 'pending', 'activation'
  )),
  reported_payment_truth text NOT NULL CHECK (reported_payment_truth IN ('not_started', 'failed', 'pending', 'succeeded', 'unknown')),
  reported_retryable boolean NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolving', 'resolved')),
  sentry_delivery_status text NOT NULL DEFAULT 'pending' CHECK (sentry_delivery_status IN ('pending', 'delivered', 'failed')),
  sentry_event_id text,
  receipt_delivery_status text NOT NULL DEFAULT 'pending' CHECK (receipt_delivery_status IN ('pending', 'sending', 'sent', 'failed', 'delivery_uncertain')),
  receipt_attempt_id uuid,
  receipt_customerio_delivery_id text,
  receipt_sending_at timestamptz,
  receipt_sent_at timestamptz,
  receipt_failed_at timestamptz,
  resolution_outcome text CHECK (resolution_outcome IS NULL OR resolution_outcome ~ '^[a-z0-9_]{3,80}$'),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) BETWEEN 1 AND 600),
  resolution_delivery_status text CHECK (resolution_delivery_status IN ('pending', 'sending', 'sent', 'failed', 'delivery_uncertain')),
  resolution_attempt_id uuid,
  resolution_customerio_delivery_id text,
  resolution_sending_at timestamptz,
  resolution_sent_at timestamptz,
  resolution_failed_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((lead_id IS NULL) <> (user_id IS NULL)),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CHECK (status <> 'resolved' OR resolved_by IS NOT NULL),
  CHECK (sentry_event_id IS NULL OR sentry_event_id ~ '^[a-f0-9]{32}$'),
  CHECK (sentry_delivery_status <> 'delivered' OR sentry_event_id IS NOT NULL),
  CHECK (receipt_delivery_status = 'pending' OR receipt_attempt_id IS NOT NULL),
  CHECK (receipt_delivery_status <> 'sending' OR receipt_sending_at IS NOT NULL),
  CHECK (receipt_delivery_status <> 'sent' OR receipt_customerio_delivery_id IS NOT NULL),
  CHECK (resolution_delivery_status IS NULL OR resolution_outcome IS NOT NULL),
  CHECK (resolution_delivery_status IS NULL OR resolution_attempt_id IS NOT NULL),
  CHECK (resolution_delivery_status <> 'sending' OR resolution_sending_at IS NOT NULL),
  CHECK (resolution_delivery_status <> 'sent' OR resolved_at IS NOT NULL),
  UNIQUE (report_code),
  UNIQUE (dedupe_key)
);

CREATE INDEX payment_support_cases_identity_created_at_idx
  ON public.payment_support_cases (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;
CREATE INDEX payment_support_cases_user_created_at_idx
  ON public.payment_support_cases (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.payment_support_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_support_cases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_support_cases TO service_role;

CREATE OR REPLACE FUNCTION public.create_payment_support_case(
  p_lead_id uuid,
  p_user_id uuid,
  p_checkout_attempt_id text,
  p_checkout_context text,
  p_feedback_kind text,
  p_provider text,
  p_method text,
  p_reported_payment_family text,
  p_reported_payment_truth text,
  p_reported_retryable boolean
)
RETURNS TABLE(case_id uuid, report_code text, created boolean, receipt_delivery_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  identity_key text;
  case_row public.payment_support_cases%ROWTYPE;
  case_count integer;
  candidate_report_code text;
  candidate_dedupe_key text;
  attempt integer;
BEGIN
  IF (p_lead_id IS NULL) = (p_user_id IS NULL) THEN
    RAISE EXCEPTION 'payment support case requires exactly one identity' USING ERRCODE = '22023';
  END IF;
  IF p_checkout_context NOT IN ('result_membership', 'result_one_time', 'reactivation')
    OR p_feedback_kind NOT IN ('access_already_active', 'checkout_not_loaded', 'details_invalid', 'card_declined', 'provider_temporarily_unavailable', 'payment_not_completed', 'payment_status_pending', 'access_activation_delayed')
    OR p_provider NOT IN ('stripe', 'paypal', 'unknown')
    OR p_method NOT IN ('card', 'apple_pay', 'paypal', 'unknown')
    OR p_reported_payment_family NOT IN ('access', 'checkout_load', 'details', 'decline', 'provider', 'payment', 'pending', 'activation')
    OR p_reported_payment_truth NOT IN ('not_started', 'failed', 'pending', 'succeeded', 'unknown')
    OR p_reported_retryable IS NULL
    OR p_checkout_attempt_id IS NULL
    OR char_length(p_checkout_attempt_id) NOT BETWEEN 8 AND 128
    OR p_checkout_attempt_id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid payment support case input' USING ERRCODE = '22023';
  END IF;

  identity_key := CASE WHEN p_lead_id IS NOT NULL THEN 'lead:' || p_lead_id::text ELSE 'user:' || p_user_id::text END;
  candidate_dedupe_key := md5(concat_ws('|', identity_key, p_checkout_attempt_id, p_feedback_kind, p_provider, p_method));
  PERFORM pg_advisory_xact_lock(hashtextextended(identity_key, 0));

  SELECT * INTO case_row
  FROM public.payment_support_cases
  WHERE dedupe_key = candidate_dedupe_key;
  IF FOUND THEN
    IF (p_lead_id IS NOT NULL AND case_row.lead_id = p_lead_id)
      OR (p_user_id IS NOT NULL AND case_row.user_id = p_user_id) THEN
      RETURN QUERY SELECT case_row.id, case_row.report_code, false, case_row.receipt_delivery_status;
      RETURN;
    END IF;
    RAISE EXCEPTION 'payment support case identity integrity error' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO case_count
  FROM public.payment_support_cases
  WHERE (lead_id = p_lead_id OR user_id = p_user_id)
    AND created_at >= now() - interval '24 hours';
  IF case_count >= 3 THEN
    RAISE EXCEPTION 'payment support case limit reached' USING ERRCODE = 'P0001';
  END IF;

  FOR attempt IN 1..3 LOOP
    SELECT 'PAY-' || string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ_', 1 + (get_byte(gen_random_bytes(1), 0) & 31), 1), '')
    INTO candidate_report_code
    FROM generate_series(1, 8);
    BEGIN
      INSERT INTO public.payment_support_cases (
        report_code, lead_id, user_id, checkout_attempt_id, reported_checkout_context,
        reported_feedback_kind, reported_provider, reported_method, reported_payment_family,
        reported_payment_truth, reported_retryable, dedupe_key
      ) VALUES (
        candidate_report_code, p_lead_id, p_user_id, p_checkout_attempt_id, p_checkout_context,
        p_feedback_kind, p_provider, p_method, p_reported_payment_family,
        p_reported_payment_truth, p_reported_retryable, candidate_dedupe_key
      ) ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING * INTO case_row;
      IF FOUND THEN
        RETURN QUERY SELECT case_row.id, case_row.report_code, true, case_row.receipt_delivery_status;
        RETURN;
      END IF;
      SELECT * INTO case_row FROM public.payment_support_cases WHERE dedupe_key = candidate_dedupe_key;
      IF FOUND AND ((p_lead_id IS NOT NULL AND case_row.lead_id = p_lead_id) OR (p_user_id IS NOT NULL AND case_row.user_id = p_user_id)) THEN
        RETURN QUERY SELECT case_row.id, case_row.report_code, false, case_row.receipt_delivery_status;
        RETURN;
      END IF;
      RAISE EXCEPTION 'payment support case identity integrity error' USING ERRCODE = 'P0001';
    EXCEPTION WHEN unique_violation THEN
      -- A report-code collision is retried; the dedupe key is still reselected safely.
      SELECT * INTO case_row FROM public.payment_support_cases WHERE dedupe_key = candidate_dedupe_key;
      IF FOUND THEN
        IF (p_lead_id IS NOT NULL AND case_row.lead_id = p_lead_id) OR (p_user_id IS NOT NULL AND case_row.user_id = p_user_id) THEN
          RETURN QUERY SELECT case_row.id, case_row.report_code, false, case_row.receipt_delivery_status;
          RETURN;
        END IF;
        RAISE EXCEPTION 'payment support case identity integrity error' USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'payment support report code collision limit reached' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_support_case(uuid, uuid, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_support_case(uuid, uuid, text, text, text, text, text, text, text, boolean) TO service_role;

COMMENT ON TABLE public.payment_support_cases IS
  'Service-only payment support ledger. Reported values are customer hints; provider truth is correlated separately.';
