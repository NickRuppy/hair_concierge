-- Scan intake identifies a submission by the barcode/EAN the user scanned,
-- normalized before storage. Both columns are nullable so every non-scan
-- source (onboarding/chat/personal_plan) is unaffected.
--
-- The CHECK below explicitly tests IS NOT NULL on both sides of the "set"
-- branch rather than relying on IN/<> alone, because Postgres CHECK uses
-- three-valued logic: an expression that evaluates to NULL does not violate
-- the constraint. Walking all four (type, value) null combinations:
--   (NULL, NULL)      -> branch A true                          -> PASS (ok, unset)
--   ('ean', NULL)     -> branch A false; branch B's
--                        "value IS NOT NULL" is false            -> FAIL (ok, half-set)
--   (NULL, 'abc')     -> branch A false; branch B's
--                        "type IS NOT NULL" is false             -> FAIL (ok, half-set)
--   ('ean', 'abc')    -> branch A false; branch B all true       -> PASS (ok, fully set)
-- The earlier draft used `type IN (...) AND value <> ''` for branch B without
-- explicit IS NOT NULL guards; with type set and value NULL, `value <> ''`
-- evaluates to NULL, so `FALSE OR (TRUE AND NULL)` = NULL, which CHECK does
-- not treat as a violation -- the half-set row would have passed silently.
-- (The `<> ''` emptiness test has since been replaced by the barcode-shape
-- regex below; the IS NOT NULL guards stay for exactly the same reason.)

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS scanned_identifier_type text;

ALTER TABLE public.product_submissions
  ADD COLUMN IF NOT EXISTS scanned_identifier_value text;

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_scanned_identifier_check;

-- The value pattern mirrors the application boundary (validateEanInput in
-- src/lib/scan/identifier-lookup.ts, enforced by both /api/scan/resolve and
-- /api/scan/submit): digits only, EAN-8 or EAN-13. The DB cannot check the GS1
-- check digit cheaply, but it can refuse anything that is not barcode-shaped, so
-- a future writer that skips the route layer still cannot store free text in the
-- column the catalog lookup keys on.

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_scanned_identifier_check
  CHECK (
    (scanned_identifier_type IS NULL AND scanned_identifier_value IS NULL)
    OR (
      scanned_identifier_type IS NOT NULL
      AND scanned_identifier_type IN ('ean', 'gtin', 'barcode')
      AND scanned_identifier_value IS NOT NULL
      AND scanned_identifier_value ~ '^[0-9]{8}$|^[0-9]{13}$'
    )
  );

-- A scan submission with no scanned identifier would be invisible to
-- idx_product_submissions_one_open_scan (that index is partial on
-- scanned_identifier_value IS NOT NULL), so it could bypass the
-- one-open-submission-per-EAN rule entirely. submitScanProductIntake always
-- passes the identifier through; this pins that invariant at the DB level.

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_scan_requires_identifier_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_scan_requires_identifier_check
  CHECK (source <> 'scan' OR scanned_identifier_value IS NOT NULL);

-- Serves the scan flow's open-submission lookup: per-user, per-normalized-
-- identifier ("do I already have an open submission for this scanned
-- product?"), see src/lib/scan/pending-submission.ts.
CREATE INDEX IF NOT EXISTS idx_product_submissions_user_scanned_identifier
  ON public.product_submissions (user_id, scanned_identifier_value)
  WHERE scanned_identifier_value IS NOT NULL;
