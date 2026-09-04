-- Nick approved the wave-3 scan-expansion batch (23 new products + 3 renames)
-- after the data review, the Opus QA audit round, the critical-property
-- walkthrough (repair bar X5, Mega Shine thickness, alverde serum weight) and
-- the image contact-sheet review. The immutable registry row binds the raw
-- apply payload to the exact reviewed feature head; the service-role executor
-- can read but not create or alter this approval.
INSERT INTO public.scan_expansion_approved_batches (
  batch_id,
  batch_fingerprint,
  reviewed_head,
  reviewed_by,
  item_count
) VALUES (
  'scan-expansion-wave-3',
  'b2e229707b030e03286982a27ad4d0578b6225ec61b78f7e6d7fc38849b64376',
  'cebb107924211dc2e834d72db9f7c652acfd9a25',
  'nick',
  26
);
