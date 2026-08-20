-- Widen product_submissions.source to accept the Produkt-Scan intake path.
-- Additive constraint widening: the scan flow creates product_submissions
-- rows the same way onboarding/chat/personal_plan do, just tagged with a
-- new source value so downstream review/reporting can distinguish it.

ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_source_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_source_check
  CHECK (source IN ('onboarding', 'chat', 'personal_plan', 'scan'));
