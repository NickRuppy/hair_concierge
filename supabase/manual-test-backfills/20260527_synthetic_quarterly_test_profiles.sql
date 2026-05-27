-- Test-only helper for local/sandbox profiles that were manually marked paid
-- before provider-neutral billing rows existed. Do not run for real customer data.
INSERT INTO billing_subscriptions (
  user_id,
  provider,
  provider_customer_id,
  provider_subscription_id,
  provider_status,
  entitlement_status,
  interval,
  current_period_end,
  metadata
)
SELECT
  id,
  'stripe',
  stripe_customer_id,
  'test_profile_' || id::text,
  'active',
  'active',
  'quarter',
  now() + interval '3 months',
  jsonb_build_object('synthetic_test_backfill', true, 'source', 'profiles')
FROM profiles
WHERE stripe_subscription_id IS NULL
  AND subscription_status IN ('active', 'past_due')
ON CONFLICT (provider, provider_subscription_id) DO NOTHING;
