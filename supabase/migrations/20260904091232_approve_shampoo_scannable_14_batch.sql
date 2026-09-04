-- Nick approved this exact 14-product Shampoo batch and its final images in the
-- local review flow. The immutable registry row binds the raw apply payload to
-- the exact reviewed feature head; the service-role executor can read but not
-- create or alter this approval.
INSERT INTO public.scan_expansion_approved_batches (
  batch_id,
  batch_fingerprint,
  reviewed_head,
  reviewed_by,
  item_count
) VALUES (
  'scan-db-expansion-shampoo-scannable-14-2026-09-04',
  '6636720b7d685c75041d6d2d650f7e71e26a29363e793645dafb5bacc402c85b',
  'c899b434d951f48190173044cfb1354452008e1f',
  'nick',
  14
);
