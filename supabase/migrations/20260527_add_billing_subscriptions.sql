CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_customer_id text,
  provider_subscription_id text NOT NULL,
  provider_status text NOT NULL,
  entitlement_status text NOT NULL CHECK (
    entitlement_status IN ('active', 'past_due', 'canceled', 'incomplete')
  ),
  interval text CHECK (interval IN ('month', 'quarter', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS paypal_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  interval text NOT NULL CHECK (interval IN ('month', 'quarter', 'year')),
  source text NOT NULL CHECK (source IN ('pricing_page', 'quiz_result_offer')),
  lead_id uuid,
  email text,
  user_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  provider_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN ('created', 'approved', 'duplicate', 'activated', 'expired')
  ),
  duplicate_reason text,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_billing_one_open_subscription_per_user
  ON billing_subscriptions (user_id)
  WHERE entitlement_status IN ('active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id
  ON billing_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_lookup
  ON billing_subscriptions (provider, provider_subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_entitlement_expiry
  ON billing_subscriptions (entitlement_status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_paypal_checkout_intents_token
  ON paypal_checkout_intents (token);

CREATE INDEX IF NOT EXISTS idx_paypal_checkout_intents_provider_subscription_id
  ON paypal_checkout_intents (provider_subscription_id);

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE paypal_checkout_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own billing subscriptions"
  ON billing_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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
  stripe_subscription_id,
  COALESCE(subscription_status, 'active'),
  CASE
    WHEN subscription_status IN ('active', 'past_due', 'canceled', 'incomplete')
      THEN subscription_status
    ELSE 'active'
  END,
  subscription_interval,
  current_period_end,
  jsonb_build_object('backfilled_from_profiles', true)
FROM profiles
WHERE stripe_subscription_id IS NOT NULL
  AND subscription_status IN ('active', 'past_due', 'canceled', 'incomplete')
ON CONFLICT (provider, provider_subscription_id) DO NOTHING;

COMMENT ON TABLE billing_subscriptions IS
  'Provider-neutral external subscription state for Stripe and PayPal.';
COMMENT ON TABLE billing_webhook_events IS
  'Insert-first idempotency ledger for payment-provider webhooks.';
COMMENT ON TABLE paypal_checkout_intents IS
  'Short-lived PayPal checkout tokens used before post-payment account activation.';
