CREATE TABLE IF NOT EXISTS billing_analytics_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_name text NOT NULL CHECK (
    event_name IN (
      'purchase_completed',
      'payment_completed',
      'subscription_started',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_expired',
      'payment_failed',
      'refund_completed'
    )
  ),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_customer_id text,
  provider_subscription_id text,
  source_event_id text,
  source_object_id text,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_analytics_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES billing_analytics_outbox (id) ON DELETE CASCADE,
  destination text NOT NULL CHECK (destination IN ('customerio', 'meta', 'posthog')),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'delivered', 'failed', 'failed_permanent')
  ),
  attempts integer NOT NULL DEFAULT 0,
  processing_started_at timestamptz,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  provider_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbox_id, destination)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_analytics_outbox_event_key
  ON billing_analytics_outbox (event_key);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_outbox_user_time
  ON billing_analytics_outbox (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_outbox_event_time
  ON billing_analytics_outbox (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_outbox_provider_object
  ON billing_analytics_outbox (provider, source_object_id);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_deliveries_status_due
  ON billing_analytics_deliveries (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_deliveries_destination_status_due
  ON billing_analytics_deliveries (destination, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_billing_analytics_deliveries_processing_started
  ON billing_analytics_deliveries (status, processing_started_at);

ALTER TABLE billing_analytics_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_analytics_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE billing_analytics_outbox IS
  'Provider-neutral billing analytics events created after Supabase billing truth is written.';

COMMENT ON TABLE billing_analytics_deliveries IS
  'Per-destination delivery state for billing analytics events.';
