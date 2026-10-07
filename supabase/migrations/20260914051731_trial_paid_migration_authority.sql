CREATE OR REPLACE FUNCTION private.personal_plan_current_paid_migration_authority(
  p_user_id uuid
)
RETURNS TABLE (
  admission_kind text,
  admission_source_id uuid,
  qualified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT candidate.admission_kind, candidate.admission_source_id, candidate.qualified_at
  FROM (
    SELECT
      'billing_subscription'::text AS admission_kind,
      subscription.id AS admission_source_id,
      COALESCE(subscription.current_period_end, subscription.updated_at, subscription.created_at) AS qualified_at,
      1 AS source_rank,
      CASE subscription.entitlement_status
        WHEN 'active' THEN 1
        WHEN 'past_due' THEN 2
        WHEN 'canceled' THEN 3
        ELSE 4
      END AS status_rank,
      subscription.current_period_end AS period_sort,
      subscription.updated_at AS updated_sort
    FROM public.billing_subscriptions AS subscription
    LEFT JOIN public.trial_enrollments AS trial_enrollment
      ON trial_enrollment.id = subscription.trial_enrollment_id
    WHERE subscription.user_id = p_user_id
      AND (
        (
          subscription.trial_enrollment_id IS NULL
          AND NOT (
            subscription.metadata ? 'trial_cohort'
            AND subscription.metadata -> 'trial_cohort' <> 'null'::jsonb
          )
          AND (
            (
              subscription.entitlement_status IN ('active', 'past_due')
              AND (
                subscription.current_period_end IS NULL
                OR subscription.current_period_end >= pg_catalog.now() - interval '1 day'
              )
            )
            OR (
              subscription.entitlement_status = 'canceled'
              AND subscription.cancel_at_period_end
              AND subscription.current_period_end > pg_catalog.now()
            )
          )
        )
        OR (
          subscription.trial_enrollment_id IS NOT NULL
          AND (
            subscription.metadata -> 'trial_cohort' IS NULL
            OR subscription.metadata -> 'trial_cohort' = 'null'::jsonb
            OR subscription.metadata -> 'trial_cohort' = '"trial_v1"'::jsonb
          )
          AND trial_enrollment.user_id = p_user_id
          AND trial_enrollment.admission_status = 'active'
          AND trial_enrollment.first_payment_succeeded_at IS NOT NULL
          AND trial_enrollment.first_payment_succeeded_at <= pg_catalog.now()
          AND public.trial_enrollment_has_access(trial_enrollment, pg_catalog.now())
        )
      )

    UNION ALL

    SELECT
      'one_time_purchase'::text AS admission_kind,
      purchase.id AS admission_source_id,
      purchase.paid_at AS qualified_at,
      2 AS source_rank,
      1 AS status_rank,
      purchase.paid_at AS period_sort,
      purchase.updated_at AS updated_sort
    FROM public.billing_one_time_purchases AS purchase
    JOIN public.personal_plan_one_time_checkout_consents AS consent
      ON consent.id = purchase.consent_id
    WHERE purchase.user_id = p_user_id
      AND consent.user_id = p_user_id
      AND purchase.consent_id = consent.id
      AND purchase.product_kind = 'personal_plan_once'
      AND purchase.status = 'paid'
      AND consent.product_kind = 'personal_plan_once'
      AND consent.confirmation_status IN ('sent', 'delivered')
      AND consent.generation_started_at IS NOT NULL
      AND consent.generation_completed_at IS NOT NULL
      AND consent.generated_content_sha256 IS NOT NULL
      AND consent.delivery_provider IS NOT NULL
      AND consent.delivery_reference IS NOT NULL
      AND consent.delivered_at IS NOT NULL

    UNION ALL

    SELECT
      'legacy_profile'::text AS admission_kind,
      profile.id AS admission_source_id,
      COALESCE(profile.current_period_end, profile.updated_at, profile.created_at) AS qualified_at,
      3 AS source_rank,
      CASE profile.subscription_status
        WHEN 'active' THEN 1
        WHEN 'past_due' THEN 2
        WHEN 'canceled' THEN 3
        ELSE 4
      END AS status_rank,
      profile.current_period_end AS period_sort,
      profile.updated_at AS updated_sort
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.billing_subscriptions AS subscription
        WHERE subscription.user_id = p_user_id
          AND (
            subscription.trial_enrollment_id IS NOT NULL
            OR (
              subscription.metadata ? 'trial_cohort'
              AND subscription.metadata -> 'trial_cohort' <> 'null'::jsonb
            )
          )
      )
      AND (
        (
          profile.subscription_status IN ('active', 'past_due')
          AND (
            profile.current_period_end IS NULL
            OR profile.current_period_end >= pg_catalog.now() - interval '1 day'
          )
        )
        OR (
          profile.subscription_status = 'canceled'
          AND profile.current_period_end > pg_catalog.now()
        )
      )
  ) AS candidate
  ORDER BY
    candidate.source_rank,
    candidate.status_rank,
    candidate.period_sort DESC NULLS LAST,
    candidate.updated_sort DESC NULLS LAST,
    candidate.admission_source_id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.personal_plan_current_paid_migration_authority(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.personal_plan_current_paid_migration_authority(uuid)
  TO service_role;
