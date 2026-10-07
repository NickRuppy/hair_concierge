-- Add trial authorization as its own event; retain all historical event names.
ALTER TABLE public.billing_analytics_outbox
  DROP CONSTRAINT billing_analytics_outbox_event_name_check;
ALTER TABLE public.billing_analytics_outbox
  ADD CONSTRAINT billing_analytics_outbox_event_name_check CHECK (event_name IN (
    'trial_started', 'purchase_completed', 'payment_completed', 'subscription_started',
    'subscription_updated', 'subscription_cancelled', 'subscription_expired',
    'payment_failed', 'refund_completed'
  )) NOT VALID;
ALTER TABLE public.billing_analytics_outbox
  VALIDATE CONSTRAINT billing_analytics_outbox_event_name_check;
