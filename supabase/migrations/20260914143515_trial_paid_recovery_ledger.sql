-- Current paid agreements are verified immutable successors. First recovery payment is atomic with its binding.
CREATE OR REPLACE FUNCTION public.read_trial_effective_contract(p_enrollment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE; r private.trial_offer_revisions%ROWTYPE; c private.trial_paid_continuations%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO c FROM private.trial_paid_continuations WHERE enrollment_id=e.id;
 IF FOUND AND (c.provider<>e.provider OR c.original_agreement_id<>e.provider_agreement_id) THEN
 RAISE EXCEPTION 'Trial paid contract requires reconciliation'; END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id;
 IF NOT FOUND OR s.revision=0 THEN
 RETURN jsonb_build_object('accepted_offer',e.accepted_offer,'provider',e.provider,'provider_agreement_id',coalesce(c.continuation_agreement_id,e.provider_agreement_id),'revision',0);
 END IF;
 SELECT * INTO r FROM private.trial_offer_revisions WHERE enrollment_id=e.id AND revision=s.revision;
 IF NOT FOUND OR r.provider<>e.provider OR NOT private.valid_trial_management_offer(r.accepted_offer,r.accepted_offer->>'interval') THEN
 RAISE EXCEPTION 'Trial effective contract requires reconciliation'; END IF;
 RETURN jsonb_build_object('accepted_offer',r.accepted_offer,'provider',r.provider,'provider_agreement_id',coalesce(c.continuation_agreement_id,r.provider_agreement_id),'revision',r.revision);
END; $$;

-- Payment facts use the committed offer revision; accepted original terms remain immutable.
CREATE OR REPLACE FUNCTION public.record_trial_payment_event(p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  enrollment public.trial_enrollments%ROWTYPE;
  effective_contract jsonb;
  effective_offer jsonb;
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

  effective_contract := public.read_trial_effective_contract(enrollment.id);
  effective_offer := effective_contract->'accepted_offer';

  IF enrollment.user_id IS NULL OR enrollment.admission_status <> 'active' OR enrollment.provider <> v_provider
    OR enrollment.provider_agreement_id IS NULL
    OR NOT (
      (effective_contract->>'provider_agreement_id' = v_agreement_id AND effective_contract->>'provider' = v_provider AND NOT EXISTS (
        SELECT 1 FROM private.trial_paid_continuations c WHERE c.enrollment_id = enrollment.id
      )) OR EXISTS (
        SELECT 1 FROM private.trial_paid_continuations c
        WHERE c.enrollment_id = enrollment.id AND c.provider = v_provider
          AND c.original_agreement_id = enrollment.provider_agreement_id
          AND c.continuation_agreement_id = v_agreement_id
          AND (enrollment.first_payment_succeeded_at IS NOT NULL OR EXISTS (
            SELECT 1 FROM private.trial_paid_recovery_operations o
            WHERE o.id=c.operation_id AND o.enrollment_id=enrollment.id
              AND o.kind='recover_unpaid' AND o.status='pending' AND o.provider_verified_at IS NOT NULL
              AND o.provider=c.provider AND o.provider_customer_id=c.customer_id
              AND o.original_agreement_id=c.original_agreement_id
              AND o.target_agreement_id=v_agreement_id AND o.payment=p_event
              AND o.evidence->>'sourceAgreementId'=o.source_agreement_id
              AND o.evidence->>'sourceAgreementNeutralized'='true'
              AND o.evidence->>'noInFlightSourcePayment'='true'
          ))
      )
    )
    OR enrollment.access_revoked OR enrollment.cancel_at_period_end
  THEN v_result := 'reconciliation_required';
  ELSIF jsonb_typeof(effective_offer) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(effective_offer)) <> 10
    OR NOT (effective_offer ?& ARRAY['cohort', 'offerVersion', 'interval', 'currency', 'trialDays', 'firstAmountMinor', 'renewalAmountMinor', 'taxBehavior', 'stripePriceId', 'stripeCouponId'])
    OR jsonb_typeof(effective_offer->'cohort') <> 'string' OR jsonb_typeof(effective_offer->'offerVersion') <> 'string'
    OR jsonb_typeof(effective_offer->'interval') <> 'string' OR jsonb_typeof(effective_offer->'currency') <> 'string'
    OR jsonb_typeof(effective_offer->'trialDays') <> 'number' OR jsonb_typeof(effective_offer->'firstAmountMinor') <> 'number'
    OR jsonb_typeof(effective_offer->'renewalAmountMinor') <> 'number' OR jsonb_typeof(effective_offer->'taxBehavior') <> 'string'
    OR jsonb_typeof(effective_offer->'stripePriceId') <> 'string' OR jsonb_typeof(effective_offer->'stripeCouponId') NOT IN ('string', 'null')
    OR effective_offer->>'cohort' <> 'trial_v1' OR effective_offer->>'offerVersion' <> 'trial_launch_v1'
    OR effective_offer->>'currency' <> 'EUR' OR effective_offer->>'trialDays' <> '7'
    OR effective_offer->>'taxBehavior' <> 'inclusive' OR effective_offer->>'interval' NOT IN ('month', 'year')
    OR effective_offer->>'firstAmountMinor' !~ '^(999|6999|9999)$'
    OR effective_offer->>'renewalAmountMinor' !~ '^(999|9999)$'
    OR length(coalesce(effective_offer->>'stripePriceId', '')) NOT BETWEEN 1 AND 255
    OR (effective_offer->>'stripeCouponId' IS NOT NULL AND length(effective_offer->>'stripeCouponId') NOT BETWEEN 1 AND 255)
    OR (effective_offer->>'interval' = 'month' AND (effective_offer->>'firstAmountMinor' <> '999' OR effective_offer->>'renewalAmountMinor' <> '999' OR effective_offer->>'stripeCouponId' IS NOT NULL))
    OR (effective_offer->>'interval' = 'year' AND (effective_offer->>'renewalAmountMinor' <> '9999' OR (effective_offer->>'stripeCouponId' IS NULL AND effective_offer->>'firstAmountMinor' <> '9999') OR (effective_offer->>'stripeCouponId' IS NOT NULL AND effective_offer->>'firstAmountMinor' <> '6999')))
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
    v_expected_amount := CASE WHEN v_is_first THEN (effective_offer->>'firstAmountMinor')::integer ELSE (effective_offer->>'renewalAmountMinor')::integer END;
    IF v_amount_minor <> v_expected_amount THEN v_result := 'reconciliation_required';
    ELSIF v_outcome = 'succeeded' THEN
      IF v_is_first THEN
        v_expected_end := ((v_occurred_at AT TIME ZONE 'UTC') + CASE effective_offer->>'interval' WHEN 'month' THEN interval '1 month' ELSE interval '1 year' END) AT TIME ZONE 'UTC';
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
