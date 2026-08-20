-- Scan's 2-step unknown-product UI never asks for a use-frequency (plan
-- §WP6), and submitScanProductIntake never reads/writes user_product_usage —
-- so a filled-in frequency_range placeholder for source='scan' would be
-- invented data (controller ruling R8). Relax frequency_range to allow NULL,
-- but ONLY for source='scan'; every other source still requires a real value.

ALTER TABLE public.product_submissions
  ALTER COLUMN frequency_range DROP NOT NULL;

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_frequency_range_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_frequency_range_check CHECK (
    frequency_range IS NULL
    OR frequency_range IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    )
  ),
  ADD CONSTRAINT product_submissions_frequency_range_required_unless_scan_check CHECK (
    frequency_range IS NOT NULL OR source = 'scan'
  );
