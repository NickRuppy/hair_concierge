-- Scan intake identifies a submission by the barcode/EAN the user scanned,
-- normalized before storage. Both columns are nullable so every non-scan
-- source (onboarding/chat/personal_plan) is unaffected.

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS scanned_identifier_type text;

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS scanned_identifier_value text;

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_scanned_identifier_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_scanned_identifier_check
  CHECK (
    (scanned_identifier_type IS NULL AND scanned_identifier_value IS NULL)
    OR (
      scanned_identifier_type IN ('ean', 'gtin', 'barcode')
      AND scanned_identifier_value <> ''
    )
  );

-- Serves the scan flow's open-submission lookup: per-user, per-normalized-
-- identifier ("do I already have an open submission for this scanned
-- product?"), see src/lib/scan/pending-submission.ts.
CREATE INDEX IF NOT EXISTS idx_product_submissions_user_scanned_identifier
  ON public.product_submissions (user_id, scanned_identifier_value)
  WHERE scanned_identifier_value IS NOT NULL;
