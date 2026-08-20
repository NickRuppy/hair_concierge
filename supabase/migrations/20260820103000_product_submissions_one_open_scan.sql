-- Scan submissions are anchorless: submitScanProductIntake (src/lib/product-intake/
-- submissions.ts) never sets user_product_usage_id or user_product_id, because a scan
-- is a research request only (plans/scan-mvp.md WP4 ruling) -- it must not read or
-- write user_product_usage. That means neither of the two existing one-open-submission
-- partial unique indexes applies to a scan row:
--   idx_product_submissions_one_open_per_usage      (WHERE user_product_usage_id IS NOT NULL)
--   idx_product_submissions_one_open_per_user_product (WHERE user_product_id IS NOT NULL)
-- Without a scan-scoped equivalent, nothing at the DB level stops the same user from
-- accumulating multiple open submissions for the same scanned EAN. This index closes
-- that gap the same way the other two do: one open submission per (user, normalized
-- scanned identifier value), scoped to source = 'scan' only.

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_submissions_one_open_scan
  ON public.product_submissions (user_id, scanned_identifier_value)
  WHERE scanned_identifier_value IS NOT NULL
    AND source = 'scan'
    AND status IN ('pending_review', 'researching', 'ready_for_review', 'needs_more_info');
