-- Capture this fence before retrieving provider cancellation truth. A boolean
-- cancellation flag alone permits an ABA race (canceled -> restored -> stale canceled).
CREATE FUNCTION public.read_stripe_trial_cancellation_fence(
 p_enrollment_id uuid,p_agreement_id text,p_customer_id text,p_user_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('revision',s.revision,'cancellationVersion',s.cancellation_version)
 FROM public.trial_enrollments e
 JOIN private.trial_management_state s ON s.enrollment_id=e.id
 LEFT JOIN private.trial_offer_revisions r ON r.enrollment_id=e.id AND r.revision=s.revision
 LEFT JOIN private.trial_paid_continuations c ON c.enrollment_id=e.id AND c.provider='stripe'
 WHERE e.id=p_enrollment_id AND e.user_id=p_user_id AND e.provider='stripe'
 AND e.admission_status='active' AND NOT e.access_revoked
 AND (s.revision=0 OR r.provider='stripe')
 AND p_agreement_id=coalesce(c.continuation_agreement_id,r.provider_agreement_id,e.provider_agreement_id)
 AND EXISTS(SELECT 1 FROM public.billing_subscriptions b WHERE b.trial_enrollment_id=e.id
  AND b.user_id=e.user_id AND b.provider='stripe' AND b.provider_subscription_id=e.provider_agreement_id
  AND b.provider_customer_id=p_customer_id);
$$;

CREATE FUNCTION public.confirm_stripe_trial_cancellation(
 p_enrollment_id uuid,p_agreement_id text,p_customer_id text,p_user_id uuid,
 p_expected_revision integer,p_expected_cancellation_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.trial_enrollments%ROWTYPE; s private.trial_management_state%ROWTYPE; fence jsonb;
BEGIN
 -- Match the management commit/declaration lock order.
 SELECT * INTO e FROM public.trial_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM private.trial_management_state WHERE enrollment_id=e.id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM p_expected_revision
  OR s.cancellation_version IS DISTINCT FROM p_expected_cancellation_version THEN RETURN NULL; END IF;
 fence:=public.read_stripe_trial_cancellation_fence(e.id,p_agreement_id,p_customer_id,p_user_id);
 IF fence IS NULL THEN RETURN NULL; END IF;
 -- Never clear a declaration. The existing trigger advances cancellation_version.
 UPDATE public.trial_enrollments SET cancel_at_period_end=true WHERE id=e.id
  RETURNING * INTO e;
 RETURN to_jsonb(e);
END;
$$;
REVOKE ALL ON FUNCTION public.read_stripe_trial_cancellation_fence(uuid,text,text,uuid),
 public.confirm_stripe_trial_cancellation(uuid,text,text,uuid,integer,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_stripe_trial_cancellation_fence(uuid,text,text,uuid),
 public.confirm_stripe_trial_cancellation(uuid,text,text,uuid,integer,bigint) TO service_role;
