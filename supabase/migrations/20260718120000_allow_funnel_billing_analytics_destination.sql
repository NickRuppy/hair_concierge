ALTER TABLE public.billing_analytics_deliveries
  DROP CONSTRAINT IF EXISTS billing_analytics_deliveries_destination_check;

ALTER TABLE public.billing_analytics_deliveries
  ADD CONSTRAINT billing_analytics_deliveries_destination_check
  CHECK (destination IN ('customerio', 'meta', 'posthog', 'funnel'))
  NOT VALID;

ALTER TABLE public.billing_analytics_deliveries
  VALIDATE CONSTRAINT billing_analytics_deliveries_destination_check;
