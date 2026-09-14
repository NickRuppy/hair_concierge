CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.trial_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  source_event_id text NOT NULL CHECK (length(source_event_id) BETWEEN 1 AND 255),
  source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_event_ids) = 'array'),
  source_object_id text NOT NULL CHECK (length(source_object_id) BETWEEN 1 AND 255),
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'failed')),
  occurred_at timestamptz NOT NULL CHECK (isfinite(occurred_at)),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency = 'EUR'),
  period_start_at timestamptz NOT NULL CHECK (isfinite(period_start_at)),
  period_end_at timestamptz NOT NULL CHECK (isfinite(period_end_at)),
  result text NOT NULL CHECK (result IN ('applied', 'duplicate', 'stale', 'reconciliation_required')),
  phase text NOT NULL CHECK (phase IN ('first_paid', 'renewal', 'none')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider, source_event_id, outcome),
  UNIQUE (provider, source_object_id, outcome)
);
ALTER TABLE private.trial_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_payment_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.trial_payment_events TO service_role;

CREATE TABLE private.trial_payment_continuation_reconciliations (
  enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  source_event_id text NOT NULL CHECK (length(source_event_id) BETWEEN 1 AND 255),
  source_object_id text NOT NULL CHECK (length(source_object_id) BETWEEN 1 AND 255),
  payment_succeeded_at timestamptz NOT NULL CHECK (isfinite(payment_succeeded_at)),
  source_period_start_at timestamptz NOT NULL CHECK (isfinite(source_period_start_at)),
  source_period_end_at timestamptz NOT NULL CHECK (isfinite(source_period_end_at)),
  owed_paid_through_at timestamptz NOT NULL CHECK (isfinite(owed_paid_through_at)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'error')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (source_period_end_at > source_period_start_at),
  CHECK (owed_paid_through_at > payment_succeeded_at)
);
ALTER TABLE private.trial_payment_continuation_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_payment_continuation_reconciliations FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.trial_payment_continuation_reconciliations TO service_role;

-- A paid continuation never overwrites the agreement that authorized the trial.
-- Only the guarded confirmation RPC binds this successor after provider proof.
CREATE TABLE private.trial_paid_continuations (
  enrollment_id uuid PRIMARY KEY REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  original_agreement_id text NOT NULL,
  continuation_agreement_id text NOT NULL,
  customer_id text NOT NULL,
  source_object_id text NOT NULL,
  paid_through_at timestamptz NOT NULL CHECK (isfinite(paid_through_at)),
  operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider, continuation_agreement_id),
  CHECK (original_agreement_id <> continuation_agreement_id)
);
ALTER TABLE private.trial_paid_continuations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_paid_continuations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.trial_paid_continuations TO service_role;

CREATE FUNCTION public.record_trial_payment_event(p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  previous_event_any private.trial_payment_events%ROWTYPE;
  previous_by_event private.trial_payment_events%ROWTYPE;
  previous_by_object private.trial_payment_events%ROWTYPE;
  previous private.trial_payment_events%ROWTYPE;
  v_enrollment_id uuid; v_provider text; v_agreement_id text; v_source_event_id text; v_source_object_id text;
  v_outcome text; v_occurred_at timestamptz; v_amount_minor integer; v_currency text;
  v_period_start_at timestamptz; v_period_end_at timestamptz;
  v_result text := 'reconciliation_required'; v_phase text := 'none';
  v_expected_end timestamptz; v_expected_amount integer; v_is_first boolean; v_lock bigint;
  v_update_previous boolean := false; v_continuation_debt boolean := false;
BEGIN
  -- Validate JSON shape and lexical forms before any UUID/integer/timestamp cast.
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_event)) <> 11
    OR NOT (p_event ?& ARRAY['provider', 'enrollmentId', 'agreementId', 'sourceEventId', 'sourceObjectId', 'outcome', 'occurredAt', 'amountMinor', 'currency', 'periodStartAt', 'periodEndAt'])
    OR jsonb_typeof(p_event->'provider') <> 'string' OR jsonb_typeof(p_event->'enrollmentId') <> 'string'
    OR jsonb_typeof(p_event->'agreementId') <> 'string' OR jsonb_typeof(p_event->'sourceEventId') <> 'string'
    OR jsonb_typeof(p_event->'sourceObjectId') <> 'string' OR jsonb_typeof(p_event->'outcome') <> 'string'
    OR jsonb_typeof(p_event->'occurredAt') <> 'string' OR jsonb_typeof(p_event->'amountMinor') <> 'number'
    OR jsonb_typeof(p_event->'currency') <> 'string' OR jsonb_typeof(p_event->'periodStartAt') <> 'string'
    OR jsonb_typeof(p_event->'periodEndAt') <> 'string' OR p_event->>'provider' NOT IN ('stripe', 'paypal')
    OR p_event->>'outcome' NOT IN ('succeeded', 'failed') OR p_event->>'currency' <> 'EUR'
    OR p_event->>'enrollmentId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR length(btrim(p_event->>'agreementId')) NOT BETWEEN 1 AND 255
    OR length(btrim(p_event->>'sourceEventId')) NOT BETWEEN 1 AND 255
    OR length(btrim(p_event->>'sourceObjectId')) NOT BETWEEN 1 AND 255
    OR p_event->>'amountMinor' !~ '^(0|[1-9][0-9]{0,8})$'
    OR p_event->>'occurredAt' !~ '^\d{4}-\d{2}-\d{2}T'
    OR p_event->>'periodStartAt' !~ '^\d{4}-\d{2}-\d{2}T'
    OR p_event->>'periodEndAt' !~ '^\d{4}-\d{2}-\d{2}T'
  THEN RAISE EXCEPTION 'Invalid trial payment event' USING ERRCODE = '22023'; END IF;

  v_enrollment_id := (p_event->>'enrollmentId')::uuid; v_provider := p_event->>'provider';
  v_agreement_id := p_event->>'agreementId'; v_source_event_id := p_event->>'sourceEventId';
  v_source_object_id := p_event->>'sourceObjectId'; v_outcome := p_event->>'outcome';
  v_occurred_at := (p_event->>'occurredAt')::timestamptz; v_amount_minor := (p_event->>'amountMinor')::integer;
  v_currency := p_event->>'currency'; v_period_start_at := (p_event->>'periodStartAt')::timestamptz;
  v_period_end_at := (p_event->>'periodEndAt')::timestamptz;
  IF NOT isfinite(v_occurred_at) OR NOT isfinite(v_period_start_at) OR NOT isfinite(v_period_end_at) THEN
    RAISE EXCEPTION 'Invalid trial payment event' USING ERRCODE = '22023';
  END IF;

  -- Serialize both ledger identity keys before reading them, so conflicting
  -- provider deliveries resolve deterministically rather than at INSERT.
  FOR v_lock IN SELECT lock_key FROM (VALUES
    (hashtextextended(v_provider || E'\\x1f' || v_source_event_id, 9449)),
    (hashtextextended(v_provider || E'\\x1f' || v_source_object_id || E'\\x1f' || v_outcome, 9449))
  ) AS locks(lock_key) ORDER BY lock_key LOOP
    PERFORM pg_advisory_xact_lock(v_lock);
  END LOOP;

  SELECT * INTO enrollment FROM public.trial_enrollments WHERE id = v_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'reconciliation_required', 'phase', 'none'); END IF;
  SELECT * INTO previous_event_any FROM private.trial_payment_events
    WHERE provider = v_provider AND (source_event_id = v_source_event_id OR source_event_ids ? v_source_event_id) FOR UPDATE;
  IF previous_event_any.id IS NOT NULL AND (previous_event_any.enrollment_id <> enrollment.id
    OR previous_event_any.source_object_id <> v_source_object_id)
  THEN RETURN jsonb_build_object('outcome', 'reconciliation_required', 'phase', 'none'); END IF;
  SELECT * INTO previous_by_event FROM private.trial_payment_events
    WHERE provider = v_provider AND (source_event_id = v_source_event_id OR source_event_ids ? v_source_event_id) AND outcome = v_outcome FOR UPDATE;
  SELECT * INTO previous_by_object FROM private.trial_payment_events
    WHERE provider = v_provider AND source_object_id = v_source_object_id AND outcome = v_outcome FOR UPDATE;
  IF FOUND AND previous_by_event.id IS NOT NULL AND previous_by_object.id IS NOT NULL
    AND previous_by_event.id <> previous_by_object.id
  THEN RETURN jsonb_build_object('outcome', 'reconciliation_required', 'phase', 'none'); END IF;
  IF previous_by_event.id IS NOT NULL THEN previous := previous_by_event;
  ELSE previous := previous_by_object;
  END IF;
  IF previous.id IS NOT NULL THEN
    -- Different provider deliveries for the same invoice/outcome are aliases,
    -- but their core payment facts may never be rewritten.
    IF previous.enrollment_id <> enrollment.id OR previous.source_object_id <> v_source_object_id
      OR previous.outcome <> v_outcome OR previous.amount_minor <> v_amount_minor OR previous.currency <> v_currency
      OR (v_outcome = 'succeeded' AND previous.occurred_at <> v_occurred_at)
    THEN RETURN jsonb_build_object('outcome', 'reconciliation_required', 'phase', 'none'); END IF;
    IF previous.result <> 'reconciliation_required' THEN
      IF NOT previous.source_event_ids ? v_source_event_id THEN
        UPDATE private.trial_payment_events SET source_event_ids = source_event_ids || jsonb_build_array(v_source_event_id)
          WHERE id = previous.id;
      END IF;
      RETURN jsonb_build_object('outcome', 'duplicate', 'phase', previous.phase);
    END IF;
    v_update_previous := true;
  END IF;

  IF enrollment.user_id IS NULL OR enrollment.admission_status <> 'active' OR enrollment.provider <> v_provider
    OR enrollment.provider_agreement_id IS NULL
    OR NOT (
      (enrollment.provider_agreement_id = v_agreement_id AND NOT EXISTS (
        SELECT 1 FROM private.trial_paid_continuations c WHERE c.enrollment_id = enrollment.id
      )) OR EXISTS (
        SELECT 1 FROM private.trial_paid_continuations c
        WHERE c.enrollment_id = enrollment.id AND c.provider = v_provider
          AND c.original_agreement_id = enrollment.provider_agreement_id
          AND c.continuation_agreement_id = v_agreement_id
          AND enrollment.first_payment_succeeded_at IS NOT NULL
      )
    )
    OR enrollment.access_revoked OR enrollment.cancel_at_period_end
  THEN v_result := 'reconciliation_required';
  ELSIF jsonb_typeof(enrollment.accepted_offer) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(enrollment.accepted_offer)) <> 10
    OR NOT (enrollment.accepted_offer ?& ARRAY['cohort', 'offerVersion', 'interval', 'currency', 'trialDays', 'firstAmountMinor', 'renewalAmountMinor', 'taxBehavior', 'stripePriceId', 'stripeCouponId'])
    OR jsonb_typeof(enrollment.accepted_offer->'cohort') <> 'string' OR jsonb_typeof(enrollment.accepted_offer->'offerVersion') <> 'string'
    OR jsonb_typeof(enrollment.accepted_offer->'interval') <> 'string' OR jsonb_typeof(enrollment.accepted_offer->'currency') <> 'string'
    OR jsonb_typeof(enrollment.accepted_offer->'trialDays') <> 'number' OR jsonb_typeof(enrollment.accepted_offer->'firstAmountMinor') <> 'number'
    OR jsonb_typeof(enrollment.accepted_offer->'renewalAmountMinor') <> 'number' OR jsonb_typeof(enrollment.accepted_offer->'taxBehavior') <> 'string'
    OR jsonb_typeof(enrollment.accepted_offer->'stripePriceId') <> 'string' OR jsonb_typeof(enrollment.accepted_offer->'stripeCouponId') NOT IN ('string', 'null')
    OR enrollment.accepted_offer->>'cohort' <> 'trial_v1' OR enrollment.accepted_offer->>'offerVersion' <> 'trial_launch_v1'
    OR enrollment.accepted_offer->>'currency' <> 'EUR' OR enrollment.accepted_offer->>'trialDays' <> '7'
    OR enrollment.accepted_offer->>'taxBehavior' <> 'inclusive' OR enrollment.accepted_offer->>'interval' NOT IN ('month', 'year')
    OR enrollment.accepted_offer->>'firstAmountMinor' !~ '^(999|6999|9999)$'
    OR enrollment.accepted_offer->>'renewalAmountMinor' !~ '^(999|9999)$'
    OR length(coalesce(enrollment.accepted_offer->>'stripePriceId', '')) NOT BETWEEN 1 AND 255
    OR (enrollment.accepted_offer->>'stripeCouponId' IS NOT NULL AND length(enrollment.accepted_offer->>'stripeCouponId') NOT BETWEEN 1 AND 255)
    OR (enrollment.accepted_offer->>'interval' = 'month' AND (enrollment.accepted_offer->>'firstAmountMinor' <> '999' OR enrollment.accepted_offer->>'renewalAmountMinor' <> '999' OR enrollment.accepted_offer->>'stripeCouponId' IS NOT NULL))
    OR (enrollment.accepted_offer->>'interval' = 'year' AND (enrollment.accepted_offer->>'renewalAmountMinor' <> '9999' OR (enrollment.accepted_offer->>'stripeCouponId' IS NULL AND enrollment.accepted_offer->>'firstAmountMinor' <> '9999') OR (enrollment.accepted_offer->>'stripeCouponId' IS NOT NULL AND enrollment.accepted_offer->>'firstAmountMinor' <> '6999')))
  THEN v_result := 'reconciliation_required';
  ELSIF v_period_end_at <= v_period_start_at THEN v_result := 'reconciliation_required';
  ELSE
    v_is_first := enrollment.first_payment_succeeded_at IS NULL;
    -- A later failure delivery for a paid invoice is stale irrespective of a
    -- later renewal price or the current lifecycle state.
    IF NOT v_is_first AND v_outcome = 'failed' AND EXISTS (
      SELECT 1 FROM private.trial_payment_events p WHERE p.enrollment_id = enrollment.id
        AND p.provider = v_provider AND p.source_object_id = v_source_object_id AND p.outcome = 'succeeded'
    ) THEN v_result := 'stale';
    ELSIF v_is_first AND v_outcome = 'succeeded' AND (
      enrollment.authorization_succeeded_at IS NULL OR enrollment.original_trial_end_at IS NULL
      OR v_occurred_at < enrollment.original_trial_end_at
    ) THEN v_result := 'reconciliation_required';
    ELSE
    v_expected_amount := CASE WHEN v_is_first THEN (enrollment.accepted_offer->>'firstAmountMinor')::integer ELSE (enrollment.accepted_offer->>'renewalAmountMinor')::integer END;
    IF v_amount_minor <> v_expected_amount THEN v_result := 'reconciliation_required';
    ELSIF v_outcome = 'succeeded' THEN
      IF v_is_first THEN
        v_expected_end := ((v_occurred_at AT TIME ZONE 'UTC') + CASE enrollment.accepted_offer->>'interval' WHEN 'month' THEN interval '1 month' ELSE interval '1 year' END) AT TIME ZONE 'UTC';
        UPDATE public.trial_enrollments SET first_payment_succeeded_at = v_occurred_at, paid_through_at = v_expected_end, renewal_payment_failed = false, renewal_grace_ends_at = NULL WHERE id = enrollment.id;
        v_result := 'applied'; v_phase := 'first_paid';
        v_continuation_debt := v_period_start_at <> v_occurred_at OR v_period_end_at <> v_expected_end;
      ELSIF v_period_start_at > enrollment.paid_through_at THEN v_result := 'reconciliation_required';
      ELSIF v_period_end_at <= enrollment.paid_through_at THEN v_result := 'stale';
      ELSIF v_period_start_at <> enrollment.paid_through_at THEN v_result := 'reconciliation_required';
      ELSIF v_occurred_at < v_period_start_at THEN v_result := 'reconciliation_required';
      ELSE
        UPDATE public.trial_enrollments SET paid_through_at = v_period_end_at, renewal_payment_failed = false, renewal_grace_ends_at = NULL WHERE id = enrollment.id;
        v_result := 'applied'; v_phase := 'renewal';
      END IF;
    ELSIF v_is_first THEN v_result := 'applied';
    ELSIF v_period_start_at > enrollment.paid_through_at THEN v_result := 'reconciliation_required';
    ELSIF v_period_end_at <= enrollment.paid_through_at THEN v_result := 'stale';
    ELSIF v_period_start_at <> enrollment.paid_through_at THEN v_result := 'reconciliation_required';
    ELSE
      UPDATE public.trial_enrollments SET renewal_payment_failed = true, renewal_grace_ends_at = enrollment.paid_through_at + interval '168 hours' WHERE id = enrollment.id;
      v_result := 'applied';
    END IF;
    END IF;
  END IF;
  IF v_update_previous THEN
    UPDATE private.trial_payment_events SET period_start_at = v_period_start_at, period_end_at = v_period_end_at,
      result = v_result, phase = v_phase,
      source_event_ids = CASE WHEN source_event_ids ? v_source_event_id THEN source_event_ids ELSE source_event_ids || jsonb_build_array(v_source_event_id) END
      WHERE id = previous.id;
  ELSE
    INSERT INTO private.trial_payment_events(enrollment_id, provider, source_event_id, source_event_ids, source_object_id, outcome, occurred_at, amount_minor, currency, period_start_at, period_end_at, result, phase)
    VALUES (enrollment.id, v_provider, v_source_event_id, jsonb_build_array(v_source_event_id), v_source_object_id, v_outcome, v_occurred_at, v_amount_minor, v_currency, v_period_start_at, v_period_end_at, v_result, v_phase);
  END IF;
  IF v_continuation_debt THEN
    INSERT INTO private.trial_payment_continuation_reconciliations(
      enrollment_id, provider, source_event_id, source_object_id, payment_succeeded_at,
      source_period_start_at, source_period_end_at, owed_paid_through_at
    ) VALUES (
      enrollment.id, v_provider, v_source_event_id, v_source_object_id, v_occurred_at,
      v_period_start_at, v_period_end_at, v_expected_end
    ) ON CONFLICT (enrollment_id) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('outcome', v_result, 'phase', v_phase);
END;
$$;
REVOKE ALL ON FUNCTION public.record_trial_payment_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trial_payment_event(jsonb) TO service_role;

-- The CLI uses this narrow, paged projection only. It intentionally omits owner,
-- offer, payment-method, and provider-payload data; repair remains elsewhere.
CREATE FUNCTION public.list_trial_payment_reconciliation_failures(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  reconciliation_kind text,
  enrollment_id uuid,
  provider text,
  source_event_id text,
  source_object_id text,
  outcome text,
  occurred_at timestamptz,
  amount_minor integer,
  currency text,
  source_period_start_at timestamptz,
  source_period_end_at timestamptz,
  owed_paid_through_at timestamptz,
  status text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Invalid reconciliation page' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT
      'payment_event'::text, e.enrollment_id, e.provider, e.source_event_id,
      e.source_object_id, e.outcome, e.occurred_at, e.amount_minor, e.currency,
      e.period_start_at, e.period_end_at, NULL::timestamptz,
      'reconciliation_required'::text
    FROM private.trial_payment_events e
    WHERE e.result = 'reconciliation_required'
    UNION ALL
    SELECT
      'continuation'::text, d.enrollment_id, d.provider, d.source_event_id,
      d.source_object_id, 'succeeded'::text, d.payment_succeeded_at,
      e.amount_minor, e.currency, d.source_period_start_at, d.source_period_end_at,
      d.owed_paid_through_at, d.status
    FROM private.trial_payment_continuation_reconciliations d
    JOIN private.trial_payment_events e
      ON e.enrollment_id = d.enrollment_id AND e.provider = d.provider
        AND e.source_object_id = d.source_object_id AND e.outcome = 'succeeded'
    WHERE d.status IN ('pending', 'error')
  ) failures
  ORDER BY occurred_at, enrollment_id, reconciliation_kind, source_object_id, source_event_id
  LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.list_trial_payment_reconciliation_failures(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_trial_payment_reconciliation_failures(integer, integer)
  TO service_role;
