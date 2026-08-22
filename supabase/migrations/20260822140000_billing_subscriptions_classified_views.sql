-- Canonical billing truth views. billing_subscriptions accumulated QA/CI
-- seeds, local-dev test rows, and a backfill-from-profiles batch alongside
-- real provider data, so downstream code and analytics need a classified
-- view to tell test rows from real ones and current entitlements from
-- lapsed/canceled ones, instead of re-deriving that logic ad hoc per caller.
--
-- security_invoker = true so these views respect the querying role's RLS
-- (billing_subscriptions has RLS enabled, see migration 20260527_add_billing_
-- subscriptions.sql) rather than running as the view owner. Access is
-- restricted to service_role below regardless, matching how this repo grants
-- internal/analytics-only relations (see scan_resolve_events, migration
-- 20260821120000).

-- billing_subscriptions_classified: every billing_subscriptions row plus
-- is_test (seed/CI/local-dev/backfill noise, not a real customer) and
-- is_current (real, presently-entitled access) computed inline so both
-- flags stay next to the raw row for auditing.
--
-- is_current's 1-day grace on current_period_end must stay in sync with the
-- TS constant in src/lib/billing/subscriptions.ts (EXPIRED_ACCESS_GRACE_MS
-- or similar, added in Task 2 of this cleanup) — if that constant changes,
-- update the `interval '1 day'` below to match.
CREATE VIEW public.billing_subscriptions_classified
WITH (security_invoker = true) AS
SELECT
  b.*,
  (
    b.metadata ?| array['qa_seed', 'ci_seed', 'is_internal_test', 'seeded_by', 'local_test', 'seed_source']
    OR COALESCE(b.metadata ->> 'source', '') IN ('chat_eval_ci', 'local_dev_login_clean_test', 'codex_link_card_test')
    OR b.provider_subscription_id LIKE '%K0IN8ErFeg%' -- old test-only Stripe account
    OR COALESCE(b.metadata ->> 'checkout_session_id', '') LIKE 'cs_test_%'
    OR b.metadata ? 'backfilled_from_profiles'
  ) AS is_test,
  (
    (
      b.entitlement_status IN ('active', 'past_due')
      AND b.current_period_end >= now() - interval '1 day'
    )
    OR (
      b.entitlement_status = 'canceled'
      AND b.cancel_at_period_end
      AND b.current_period_end > now()
    )
  ) AS is_current
FROM public.billing_subscriptions b;

COMMENT ON VIEW public.billing_subscriptions_classified IS
  'billing_subscriptions with is_test (QA/CI/local-dev/backfill noise) and '
  'is_current (real, presently-entitled row) computed inline. The 1-day '
  'grace in is_current must stay in sync with src/lib/billing/subscriptions.ts.';

-- billing_subscriptions_current: the canonical "real, currently-paying"
-- view downstream code and analytics should read from directly instead of
-- re-filtering billing_subscriptions_classified themselves.
CREATE VIEW public.billing_subscriptions_current
WITH (security_invoker = true) AS
SELECT *
FROM public.billing_subscriptions_classified
WHERE NOT is_test AND is_current;

COMMENT ON VIEW public.billing_subscriptions_current IS
  'Canonical real, currently-paying subscriptions: billing_subscriptions_classified '
  'filtered to NOT is_test AND is_current. The 1-day grace must stay in sync with '
  'src/lib/billing/subscriptions.ts.';

-- Service-role analytics use only, mirroring how this repo grants internal
-- relations (e.g. scan_resolve_events, migration 20260821120000): no
-- surface reads billing_subscriptions directly from the browser today, and
-- these views are stricter (test-row/expiry filtering), not more open, than
-- the base table's owner-only RLS policy.
REVOKE ALL ON TABLE public.billing_subscriptions_classified FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_subscriptions_current FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_subscriptions_classified TO service_role;
GRANT SELECT ON TABLE public.billing_subscriptions_current TO service_role;
