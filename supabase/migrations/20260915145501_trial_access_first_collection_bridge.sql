-- Day-after collection bridge, SQL twin of resolveTrialAccess: an uncancelled
-- trial without a first payment keeps access from the trial end until the
-- collection window closes (next UTC midnight after the trial end, plus two
-- days — mirroring paypalTrialCollectionWindowEnd), then locks. Cancelled
-- trials still end at the original trial end.
CREATE OR REPLACE FUNCTION public.trial_enrollment_has_access(e public.trial_enrollments, at_time timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN e.id IS NULL OR e.user_id IS NULL OR e.admission_status <> 'active'
      OR e.access_revoked OR at_time IS NULL OR NOT isfinite(at_time) THEN false
    WHEN e.first_payment_succeeded_at <= at_time AND e.paid_through_at > at_time THEN true
    WHEN e.first_payment_succeeded_at <= at_time AND e.renewal_payment_failed
      AND NOT e.cancel_at_period_end AND e.paid_through_at <= at_time
      AND e.renewal_grace_ends_at > e.paid_through_at
      THEN e.renewal_grace_ends_at > at_time
    ELSE coalesce(
      e.authorization_succeeded_at <= at_time AND (
        e.original_trial_end_at > at_time
        OR (e.first_payment_succeeded_at IS NULL AND NOT e.cancel_at_period_end
          AND ((date_trunc('day', e.original_trial_end_at AT TIME ZONE 'UTC') + interval '3 days') AT TIME ZONE 'UTC') > at_time)
      ), false)
  END;
$$;
