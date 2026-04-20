-- Stripe subscription fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status     text,
  ADD COLUMN IF NOT EXISTS subscription_interval   text,
  ADD COLUMN IF NOT EXISTS current_period_end      timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id);

COMMENT ON COLUMN profiles.subscription_status IS
  'active | past_due | canceled | incomplete | NULL';
COMMENT ON COLUMN profiles.subscription_interval IS
  'month | quarter | year';
