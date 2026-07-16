ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_scheduled_at timestamptz;

UPDATE public.billing_subscriptions
SET cancel_scheduled_at = current_period_end
WHERE cancel_at_period_end = true
  AND current_period_end IS NOT NULL
  AND cancel_scheduled_at IS NULL;

COMMENT ON COLUMN public.billing_subscriptions.cancel_scheduled_at IS
  'Provider-confirmed or safely derived timestamp when renewal/access is scheduled to stop.';
