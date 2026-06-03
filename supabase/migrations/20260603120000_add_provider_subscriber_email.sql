ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscriber_email text;

COMMENT ON COLUMN billing_subscriptions.provider_subscriber_email IS
  'Payment-provider subscriber/customer email for support reference only. Chaarlie login/contact email remains profiles.email.';
