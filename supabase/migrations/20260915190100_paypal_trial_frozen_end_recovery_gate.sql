-- Paid-recovery collection-window gate twins for the frozen PayPal trial end:
-- the same window expression as trial_enrollment_has_access in the previous
-- migration (exact-seven-day ends keep their original window; frozen midnight
-- ends close two days after the end). Bodies otherwise verbatim from the
-- paid-recovery collection-window gate.
CREATE OR REPLACE FUNCTION public.load_trial_paid_recovery_public_view(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enrollmentId',e.id,'revision',s.revision,'originalTrialEndAt',e.original_trial_end_at,
 'paidThroughAt',e.paid_through_at,'cancelAtPeriodEnd',e.cancel_at_period_end,
 'kind',CASE WHEN e.access_revoked OR e.neutralization_required OR EXISTS(SELECT 1 FROM private.trial_paid_continuations WHERE enrollment_id=e.id)
 OR EXISTS(SELECT 1 FROM private.trial_management_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.trial_cancellation_declarations d JOIN private.trial_cancellation_provider_operations x ON x.declaration_id=d.id
 WHERE d.enrollment_id=e.id AND x.status<>'confirmed') THEN NULL
 WHEN e.first_payment_succeeded_at IS NULL AND e.original_trial_end_at<=clock_timestamp()
 AND (e.cancel_at_period_end
   OR ((CASE WHEN e.original_trial_end_at = e.authorization_succeeded_at + interval '604800 seconds' THEN date_trunc('day', e.original_trial_end_at AT TIME ZONE 'UTC') ELSE date_trunc('day', (e.original_trial_end_at - interval '1 microsecond') AT TIME ZONE 'UTC') END + interval '3 days')) <= (clock_timestamp() AT TIME ZONE 'UTC')) THEN 'recover_unpaid'
 WHEN e.first_payment_succeeded_at IS NOT NULL AND e.paid_through_at>clock_timestamp() AND NOT e.cancel_at_period_end AND EXISTS(
 SELECT 1 FROM private.trial_payment_continuation_reconciliations d WHERE d.enrollment_id=e.id AND d.provider=e.provider
 AND d.payment_succeeded_at=e.first_payment_succeeded_at AND d.owed_paid_through_at=e.paid_through_at AND d.status IN ('pending','error')) THEN 'repair_paid'
 ELSE NULL END,
 'offer',jsonb_build_object('interval',terms.offer->'interval','currency',terms.offer->'currency',
 'firstAmountMinor',terms.offer->'firstAmountMinor','renewalAmountMinor',terms.offer->'renewalAmountMinor'),
 'pendingOperation',(SELECT jsonb_build_object('operationId',o.id,'kind',o.kind) FROM private.trial_paid_recovery_operations o
 WHERE o.enrollment_id=e.id AND o.user_id=e.user_id AND o.status='pending'))
 FROM public.trial_enrollments e JOIN private.trial_management_state s ON s.enrollment_id=e.id
 LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision
 CROSS JOIN LATERAL (SELECT CASE WHEN s.revision=0 THEN e.accepted_offer ELSE r.accepted_offer END AS offer) terms
 WHERE e.id=p_enrollment_id AND e.user_id=p_authenticated_user_id AND e.admission_status='active'
 AND (s.revision=0 OR (r.revision IS NOT NULL AND r.provider=e.provider));
$$;

CREATE OR REPLACE FUNCTION public.guard_trial_paid_recovery_operation(p_operation_id uuid,p_authenticated_user_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.trial_paid_recovery_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 JOIN private.trial_management_state s ON s.enrollment_id=e.id
 WHERE o.id=p_operation_id AND o.user_id=p_authenticated_user_id AND e.user_id=p_authenticated_user_id AND o.status='pending'
 AND e.admission_status='active' AND NOT e.access_revoked AND NOT e.neutralization_required
 AND e.original_trial_end_at=o.original_trial_end_at AND e.provider_agreement_id=o.original_agreement_id
 AND e.provider=o.provider AND s.revision=o.expected_revision AND s.cancellation_version=o.cancellation_version
 AND e.cancel_at_period_end=o.cancel_at_period_end
 AND e.first_payment_succeeded_at IS NOT DISTINCT FROM o.first_payment_succeeded_at
 AND e.paid_through_at IS NOT DISTINCT FROM o.paid_through_at
 AND ((o.kind='recover_unpaid' AND e.first_payment_succeeded_at IS NULL AND e.original_trial_end_at<=clock_timestamp()
   AND (e.cancel_at_period_end
     OR ((CASE WHEN e.original_trial_end_at = e.authorization_succeeded_at + interval '604800 seconds' THEN date_trunc('day', e.original_trial_end_at AT TIME ZONE 'UTC') ELSE date_trunc('day', (e.original_trial_end_at - interval '1 microsecond') AT TIME ZONE 'UTC') END + interval '3 days')) <= (clock_timestamp() AT TIME ZONE 'UTC')))
   OR (o.kind='repair_paid' AND e.first_payment_succeeded_at IS NOT NULL AND e.paid_through_at>clock_timestamp() AND NOT e.cancel_at_period_end))
 AND NOT EXISTS(SELECT 1 FROM private.trial_paid_continuations c WHERE c.enrollment_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM private.trial_management_operations m WHERE m.enrollment_id=e.id AND m.status='pending')
 AND NOT EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations a WHERE a.enrollment_id=e.id AND a.status='pending')
 AND EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id AND b.user_id=e.user_id
   AND b.provider=e.provider AND b.provider_subscription_id=e.provider_agreement_id AND b.provider_customer_id=o.provider_customer_id));
$$;

CREATE OR REPLACE FUNCTION public.begin_trial_paid_recovery_operation(p_operation_id uuid,p_enrollment_id uuid,p_authenticated_user_id uuid,
 p_kind text,p_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE;
 o private.trial_paid_recovery_operations%ROWTYPE; c jsonb; customer text; source_object text;
BEGIN
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND OR p_authenticated_user_id IS NULL OR e.user_id IS DISTINCT FROM p_authenticated_user_id THEN RAISE EXCEPTION 'Paid recovery unavailable'; END IF;
 SELECT * INTO o FROM private.trial_paid_recovery_operations WHERE id=p_operation_id;
 IF FOUND THEN
 IF o.enrollment_id<>e.id OR o.user_id<>p_authenticated_user_id OR o.kind IS DISTINCT FROM p_kind OR o.expected_revision IS DISTINCT FROM p_expected_revision
 THEN RAISE EXCEPTION 'Paid recovery operation conflict'; END IF;
 RETURN private.trial_paid_recovery_json(o);
 END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM p_expected_revision OR p_kind IS NULL OR p_kind NOT IN ('recover_unpaid','repair_paid')
 OR e.admission_status<>'active' OR e.access_revoked OR e.neutralization_required OR e.original_trial_end_at IS NULL
 OR (p_kind='recover_unpaid' AND (e.first_payment_succeeded_at IS NOT NULL OR e.original_trial_end_at>clock_timestamp()
   OR (NOT e.cancel_at_period_end
     AND ((CASE WHEN e.original_trial_end_at = e.authorization_succeeded_at + interval '604800 seconds' THEN date_trunc('day', e.original_trial_end_at AT TIME ZONE 'UTC') ELSE date_trunc('day', (e.original_trial_end_at - interval '1 microsecond') AT TIME ZONE 'UTC') END + interval '3 days')) > (clock_timestamp() AT TIME ZONE 'UTC'))))
 OR (p_kind='repair_paid' AND (e.first_payment_succeeded_at IS NULL OR e.paid_through_at<=clock_timestamp() OR e.cancel_at_period_end))
 OR EXISTS(SELECT 1 FROM private.trial_paid_continuations WHERE enrollment_id=e.id)
 OR EXISTS(SELECT 1 FROM private.trial_management_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.trial_cancellation_declarations d JOIN private.trial_cancellation_provider_operations x ON x.declaration_id=d.id
 WHERE d.enrollment_id=e.id AND x.status<>'confirmed')
 THEN RAISE EXCEPTION 'Paid recovery unavailable'; END IF;
 c:=public.read_trial_effective_contract(e.id);
 IF NOT private.valid_trial_management_offer(c->'accepted_offer',c->'accepted_offer'->>'interval') THEN RAISE EXCEPTION 'Paid recovery offer unavailable'; END IF;
 SELECT provider_customer_id INTO customer FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id
 AND b.user_id=e.user_id AND b.provider=e.provider AND b.provider_subscription_id=e.provider_agreement_id;
 IF customer IS NULL THEN RAISE EXCEPTION 'Paid recovery owner unavailable'; END IF;
 IF p_kind='repair_paid' THEN
 SELECT d.source_object_id INTO source_object FROM private.trial_payment_continuation_reconciliations d
 WHERE d.enrollment_id=e.id AND d.provider=e.provider AND d.payment_succeeded_at=e.first_payment_succeeded_at
 AND d.owed_paid_through_at=e.paid_through_at AND d.status IN ('pending','error');
 IF NOT FOUND THEN RAISE EXCEPTION 'Paid recovery boundary debt unavailable'; END IF;
 END IF;
 INSERT INTO private.trial_paid_recovery_operations(id,enrollment_id,user_id,kind,provider,provider_customer_id,
 original_agreement_id,source_agreement_id,offer,original_trial_end_at,expected_revision,cancellation_version,cancel_at_period_end,
 first_payment_succeeded_at,paid_through_at,source_object_id)
 VALUES(p_operation_id,e.id,e.user_id,p_kind,e.provider,customer,e.provider_agreement_id,c->>'provider_agreement_id',c->'accepted_offer',
 e.original_trial_end_at,s.revision,s.cancellation_version,e.cancel_at_period_end,e.first_payment_succeeded_at,e.paid_through_at,source_object)
 RETURNING * INTO o;
 RETURN private.trial_paid_recovery_json(o);
END; $$;

