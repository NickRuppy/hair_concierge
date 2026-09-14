-- Paid consent is a new operation on the existing enrollment, never another trial.
CREATE TABLE private.trial_paid_recovery_operations (
 id uuid PRIMARY KEY,
 enrollment_id uuid NOT NULL REFERENCES public.trial_enrollments(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('recover_unpaid','repair_paid')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','committed','abandoned')),
 provider text NOT NULL CHECK(provider IN ('stripe','paypal')),
 provider_customer_id text NOT NULL,
 original_agreement_id text NOT NULL,
 source_agreement_id text NOT NULL,
 offer jsonb NOT NULL,
 original_trial_end_at timestamptz NOT NULL,
 expected_revision integer NOT NULL,
 cancellation_version bigint NOT NULL,
 cancel_at_period_end boolean NOT NULL,
 first_payment_succeeded_at timestamptz,
 paid_through_at timestamptz,
 source_object_id text,
 target_agreement_id text,
 provider_verified_at timestamptz,
 evidence jsonb,
 payment jsonb,
 reconciliation_reference text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 CHECK((status='pending')=(completed_at IS NULL))
);
CREATE UNIQUE INDEX trial_paid_recovery_one_pending ON private.trial_paid_recovery_operations(enrollment_id) WHERE status='pending';
ALTER TABLE private.trial_paid_recovery_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trial_paid_recovery_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trial_paid_recovery_operations TO service_role;
CREATE FUNCTION private.trial_paid_recovery_json(o private.trial_paid_recovery_operations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'enrollmentId',o.enrollment_id,'userId',o.user_id,'kind',o.kind,'status',o.status,
 'provider',o.provider,'providerCustomerId',o.provider_customer_id,'originalAgreementId',o.original_agreement_id,
 'sourceAgreementId',o.source_agreement_id,'offer',o.offer,'originalTrialEndAt',o.original_trial_end_at,
 'expectedRevision',o.expected_revision,'cancellationVersion',o.cancellation_version,'cancelAtPeriodEnd',o.cancel_at_period_end,
 'firstPaymentSucceededAt',o.first_payment_succeeded_at,'paidThroughAt',o.paid_through_at,'sourceObjectId',o.source_object_id,
 'targetAgreementId',o.target_agreement_id);
$$;
CREATE FUNCTION public.load_trial_paid_recovery_operation(p_operation_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.trial_paid_recovery_json(o) FROM private.trial_paid_recovery_operations o
 JOIN public.trial_enrollments e ON e.id=o.enrollment_id
 WHERE o.id=p_operation_id AND o.user_id=p_authenticated_user_id AND e.user_id=p_authenticated_user_id;
$$;
CREATE FUNCTION public.guard_trial_paid_recovery_operation(p_operation_id uuid,p_authenticated_user_id uuid) RETURNS boolean
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
 AND ((o.kind='recover_unpaid' AND e.first_payment_succeeded_at IS NULL AND e.original_trial_end_at<=clock_timestamp())
   OR (o.kind='repair_paid' AND e.first_payment_succeeded_at IS NOT NULL AND e.paid_through_at>clock_timestamp() AND NOT e.cancel_at_period_end))
 AND NOT EXISTS(SELECT 1 FROM private.trial_paid_continuations c WHERE c.enrollment_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM private.trial_management_operations m WHERE m.enrollment_id=e.id AND m.status='pending')
 AND NOT EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations a WHERE a.enrollment_id=e.id AND a.status='pending')
 AND EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id AND b.user_id=e.user_id
   AND b.provider=e.provider AND b.provider_subscription_id=e.provider_agreement_id AND b.provider_customer_id=o.provider_customer_id));
$$;
CREATE FUNCTION public.begin_trial_paid_recovery_operation(p_operation_id uuid,p_enrollment_id uuid,p_authenticated_user_id uuid,
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
 OR (p_kind='recover_unpaid' AND (e.first_payment_succeeded_at IS NOT NULL OR e.original_trial_end_at>clock_timestamp()))
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
CREATE FUNCTION public.commit_trial_paid_recovery_operation(p_operation_id uuid,p_authenticated_user_id uuid,p_evidence jsonb,p_payment jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o private.trial_paid_recovery_operations%ROWTYPE; e public.trial_enrollments%ROWTYPE;
 target text; paid_at timestamptz; paid_through timestamptz; billing_at timestamptz; source_object text; ledger jsonb; lock_key bigint;
BEGIN
 SELECT * INTO o FROM private.trial_paid_recovery_operations WHERE id=p_operation_id;
 IF NOT FOUND OR p_authenticated_user_id IS NULL OR o.user_id IS DISTINCT FROM p_authenticated_user_id THEN RETURN false; END IF;
 -- Match the ledger's lock order before the enrollment lock. External webhook
 -- delivery of this same payment can safely race a lost recovery response.
 IF o.kind='recover_unpaid' AND p_payment IS NOT NULL THEN
 FOR lock_key IN SELECT k FROM (VALUES
 (hashtextextended(o.provider || E'\\x1f' || (p_payment->>'sourceEventId'),9449)),
 (hashtextextended(o.provider || E'\\x1f' || (p_payment->>'sourceObjectId') || E'\\x1f' || 'succeeded',9449))) locks(k) ORDER BY k LOOP
 IF lock_key IS NOT NULL THEN PERFORM pg_advisory_xact_lock(lock_key); END IF;
 END LOOP;
 END IF;
 SELECT * INTO e FROM public.trial_enrollments WHERE id=o.enrollment_id FOR UPDATE;
 IF e.user_id IS DISTINCT FROM p_authenticated_user_id THEN RETURN false; END IF;
 SELECT * INTO o FROM private.trial_paid_recovery_operations WHERE id=p_operation_id FOR UPDATE;
 IF o.status='committed' THEN RETURN o.evidence=p_evidence AND o.payment IS NOT DISTINCT FROM p_payment; END IF;
 IF NOT public.guard_trial_paid_recovery_operation(o.id,o.user_id) THEN RETURN false; END IF;
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object' THEN RETURN false; END IF;
 target:=p_evidence->>'targetAgreementId';
 IF p_evidence->>'provider' IS DISTINCT FROM o.provider OR p_evidence->>'providerCustomerId' IS DISTINCT FROM o.provider_customer_id
 OR p_evidence->>'sourceAgreementId' IS DISTINCT FROM o.source_agreement_id OR p_evidence->'offer' IS DISTINCT FROM o.offer
 OR p_evidence->'sourceAgreementNeutralized' IS DISTINCT FROM 'true'::jsonb
 OR p_evidence->'noInFlightSourcePayment' IS DISTINCT FROM 'true'::jsonb
 OR coalesce(length(target),0) NOT BETWEEN 1 AND 255 OR target~'[[:space:]]' OR target=o.source_agreement_id OR target=o.original_agreement_id
 OR coalesce(length(btrim(p_evidence->>'reference')),0) NOT BETWEEN 1 AND 255 OR p_evidence->>'firstBillingAt' IS NULL
 THEN RETURN false; END IF;
 billing_at:=(p_evidence->>'firstBillingAt')::timestamptz;
 IF NOT isfinite(billing_at) THEN RETURN false; END IF;
 IF o.kind='repair_paid' THEN
 IF p_payment IS NOT NULL OR p_evidence->'noAdditionalCharge' IS DISTINCT FROM 'true'::jsonb OR billing_at IS DISTINCT FROM o.paid_through_at THEN RETURN false; END IF;
 paid_through:=o.paid_through_at;source_object:=o.source_object_id;
 ELSE
 IF p_payment IS NULL OR jsonb_typeof(p_payment)<>'object' OR p_payment->>'provider' IS DISTINCT FROM o.provider
 OR p_payment->>'enrollmentId' IS DISTINCT FROM o.enrollment_id::text OR p_payment->>'agreementId' IS DISTINCT FROM target
 OR p_payment->>'outcome' IS DISTINCT FROM 'succeeded' OR p_payment->'amountMinor' IS DISTINCT FROM o.offer->'firstAmountMinor'
 OR p_payment->>'currency' IS DISTINCT FROM 'EUR' OR p_payment->>'occurredAt' IS NULL
 OR p_payment->>'periodStartAt' IS NULL OR p_payment->>'periodEndAt' IS NULL THEN RETURN false; END IF;
 paid_at:=(p_payment->>'occurredAt')::timestamptz;
 paid_through:=((paid_at AT TIME ZONE 'UTC')+CASE o.offer->>'interval' WHEN 'month' THEN interval '1 month' ELSE interval '1 year' END) AT TIME ZONE 'UTC';
 IF NOT isfinite(paid_at) OR paid_at<o.original_trial_end_at OR paid_at>clock_timestamp() OR paid_at<date_trunc('second',o.created_at) OR billing_at<>paid_at
 OR NOT isfinite((p_payment->>'periodStartAt')::timestamptz) OR NOT isfinite((p_payment->>'periodEndAt')::timestamptz)
 OR (p_payment->>'periodEndAt')::timestamptz <= (p_payment->>'periodStartAt')::timestamptz
 THEN RETURN false; END IF;
 source_object:=p_payment->>'sourceObjectId';
 END IF;
 IF coalesce(length(source_object),0) NOT BETWEEN 1 AND 255 THEN RETURN false; END IF;
 PERFORM 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id AND b.user_id=e.user_id AND b.provider=e.provider
 AND b.provider_subscription_id=e.provider_agreement_id AND b.provider_customer_id=o.provider_customer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.trial_enrollments x WHERE x.provider=o.provider AND x.provider_agreement_id=target AND x.id<>e.id)
 OR EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.provider=o.provider AND b.provider_subscription_id=target
 AND (b.trial_enrollment_id IS DISTINCT FROM e.id OR b.user_id IS DISTINCT FROM e.user_id OR b.provider_customer_id IS DISTINCT FROM o.provider_customer_id)) THEN RETURN false; END IF;
 INSERT INTO private.trial_management_agreement_bindings(provider,provider_agreement_id,enrollment_id)
 VALUES(o.provider,target,e.id) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM private.trial_management_agreement_bindings WHERE provider=o.provider AND provider_agreement_id=target AND enrollment_id=e.id) THEN RETURN false; END IF;
 UPDATE private.trial_paid_recovery_operations SET target_agreement_id=target,provider_verified_at=clock_timestamp(),evidence=p_evidence,payment=p_payment WHERE id=o.id;
 INSERT INTO private.trial_paid_continuations(enrollment_id,provider,original_agreement_id,continuation_agreement_id,customer_id,source_object_id,paid_through_at,operation_id)
 VALUES(e.id,o.provider,o.original_agreement_id,target,o.provider_customer_id,source_object,paid_through,o.id);
 IF o.kind='recover_unpaid' THEN
 UPDATE public.trial_enrollments SET cancel_at_period_end=false WHERE id=e.id;
 ledger:=public.record_trial_payment_event(p_payment);
 IF ledger->>'outcome' IS DISTINCT FROM 'applied' OR ledger->>'phase' IS DISTINCT FROM 'first_paid' THEN
 RAISE EXCEPTION 'Paid recovery payment did not commit' USING ERRCODE='40001'; END IF;
 ELSE
 UPDATE private.trial_payment_continuation_reconciliations SET status='resolved' WHERE enrollment_id=e.id
 AND source_object_id=o.source_object_id AND owed_paid_through_at=o.paid_through_at;
 IF NOT FOUND THEN RAISE EXCEPTION 'Paid recovery boundary debt changed' USING ERRCODE='40001'; END IF;
 END IF;
 UPDATE private.trial_paid_recovery_operations SET status='committed',completed_at=clock_timestamp() WHERE id=o.id;
 RETURN true;
END; $$;
CREATE FUNCTION public.abandon_trial_paid_recovery_operation(p_operation_id uuid,p_authenticated_user_id uuid,p_reconciliation_reference text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o private.trial_paid_recovery_operations%ROWTYPE;
BEGIN
 IF coalesce(length(btrim(p_reconciliation_reference)),0) NOT BETWEEN 1 AND 255 THEN RETURN false; END IF;
 SELECT * INTO o FROM private.trial_paid_recovery_operations WHERE id=p_operation_id FOR UPDATE;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM p_authenticated_user_id OR NOT EXISTS(
 SELECT 1 FROM public.trial_enrollments WHERE id=o.enrollment_id AND user_id=p_authenticated_user_id) THEN RETURN false; END IF;
 IF o.status='abandoned' THEN RETURN o.reconciliation_reference=p_reconciliation_reference; END IF;
 IF o.status<>'pending' THEN RETURN false; END IF;
 UPDATE private.trial_paid_recovery_operations SET status='abandoned',completed_at=clock_timestamp(),reconciliation_reference=p_reconciliation_reference WHERE id=o.id;
 RETURN true;
END; $$;
CREATE FUNCTION private.protect_trial_paid_recovery_operation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','target_agreement_id','provider_verified_at','evidence','payment','reconciliation_reference','completed_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','target_agreement_id','provider_verified_at','evidence','payment','reconciliation_reference','completed_at'])
 OR (OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Paid recovery acceptance is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_trial_paid_recovery_operation BEFORE UPDATE ON private.trial_paid_recovery_operations
 FOR EACH ROW EXECUTE FUNCTION private.protect_trial_paid_recovery_operation();
REVOKE ALL ON FUNCTION private.trial_paid_recovery_json(private.trial_paid_recovery_operations),private.protect_trial_paid_recovery_operation(),
 public.begin_trial_paid_recovery_operation(uuid,uuid,uuid,text,integer),public.load_trial_paid_recovery_operation(uuid,uuid),
 public.guard_trial_paid_recovery_operation(uuid,uuid),public.commit_trial_paid_recovery_operation(uuid,uuid,jsonb,jsonb),
 public.abandon_trial_paid_recovery_operation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.trial_paid_recovery_json(private.trial_paid_recovery_operations),private.protect_trial_paid_recovery_operation(),
 public.begin_trial_paid_recovery_operation(uuid,uuid,uuid,text,integer),public.load_trial_paid_recovery_operation(uuid,uuid),
 public.guard_trial_paid_recovery_operation(uuid,uuid),public.commit_trial_paid_recovery_operation(uuid,uuid,jsonb,jsonb),
 public.abandon_trial_paid_recovery_operation(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.load_trial_paid_recovery_public_view(p_enrollment_id uuid,p_authenticated_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enrollmentId',e.id,'revision',s.revision,'originalTrialEndAt',e.original_trial_end_at,
 'paidThroughAt',e.paid_through_at,'cancelAtPeriodEnd',e.cancel_at_period_end,
 'kind',CASE WHEN e.access_revoked OR e.neutralization_required OR EXISTS(SELECT 1 FROM private.trial_paid_continuations WHERE enrollment_id=e.id)
 OR EXISTS(SELECT 1 FROM private.trial_management_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.stripe_trial_continuation_operations WHERE enrollment_id=e.id AND status='pending')
 OR EXISTS(SELECT 1 FROM private.trial_cancellation_declarations d JOIN private.trial_cancellation_provider_operations x ON x.declaration_id=d.id
 WHERE d.enrollment_id=e.id AND x.status<>'confirmed') THEN NULL
 WHEN e.first_payment_succeeded_at IS NULL AND e.original_trial_end_at<=clock_timestamp() THEN 'recover_unpaid'
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
REVOKE ALL ON FUNCTION public.load_trial_paid_recovery_public_view(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.load_trial_paid_recovery_public_view(uuid,uuid) TO service_role;
