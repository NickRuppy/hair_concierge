-- Name-based research intake (plan Rev. 6 §4/§6, Task 5): the search sheet's terminal
-- recovery lets a user submit "Marke + Produktname" for research when neither the catalog
-- nor the dm lane found a match -- no scanned identifier at all. Two changes.
--
-- 1) product_submissions_scan_requires_identifier_check (migration 20260820100100) today
--    requires EVERY source='scan' row to carry a scanned identifier, which would reject
--    every name-only submission outright. Relax it to also accept a scan row that carries
--    both brand_text and product_name_text instead -- an identifier-based row (existing
--    behavior, unchanged) OR a name-based one (new), never neither.
ALTER TABLE public.product_submissions
  DROP CONSTRAINT IF EXISTS product_submissions_scan_requires_identifier_check;

ALTER TABLE public.product_submissions
  ADD CONSTRAINT product_submissions_scan_requires_identifier_check
  CHECK (
    source <> 'scan'
    OR scanned_identifier_value IS NOT NULL
    OR (brand_text IS NOT NULL AND product_name_text IS NOT NULL)
  );

-- 2) idx_product_submissions_one_open_scan (migration 20260820103000) enforces "one open
--    submission per (user, scanned identifier)" for the EAN lane, but a name-only row has
--    no scanned_identifier_value at all -- that partial index's own WHERE clause excludes
--    it, so nothing would stop the same user from opening duplicate name-only research
--    requests for the same product. This is the mirrored invariant for that lane: one open
--    submission per (user, category, lower(brand_text), lower(product_name_text)), scoped
--    to name-only scan rows only (scanned_identifier_value IS NULL) so it can never overlap
--    the EAN lane's own index. A lost race here answers 23505, the same shape the EAN
--    lane's insert already produces; the scan submit route reloads the winning row and
--    answers with its pending receipt instead of an error (get-or-create), mirroring
--    submitScanProductIntake's existing EAN-lane coalesce.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_submissions_one_open_scan_name
  ON public.product_submissions (user_id, category, lower(brand_text), lower(product_name_text))
  WHERE scanned_identifier_value IS NULL
    AND source = 'scan'
    AND status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
