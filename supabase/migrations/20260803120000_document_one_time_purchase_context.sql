COMMENT ON TABLE public.personal_plan_one_time_checkout_consents IS
  'Service-written immutable purchase-context and fulfillment identity records. Legacy copy versions retain historical explicit-waiver evidence. Rows with copy_version purchase_context_refund_v1 store a server-created purchase-context and refund-policy snapshot; for those rows accepted_at is the server-created purchase-context timestamp, not user acceptance. consent_text and consent_text_sha256 are compatibility column names. Confirmation, generation, delivery, and first-access fields remain lifecycle evidence.';

COMMENT ON COLUMN public.personal_plan_one_time_checkout_consents.accepted_at IS
  'Compatibility column: explicit acceptance time for historical waiver versions; server-created purchase-context timestamp for purchase_context_refund_v1.';

COMMENT ON COLUMN public.personal_plan_one_time_checkout_consents.consent_text IS
  'Compatibility column name containing historical waiver text or the neutral purchase-context snapshot selected by copy_version.';

COMMENT ON COLUMN public.personal_plan_one_time_checkout_consents.consent_text_sha256 IS
  'SHA-256 of consent_text; compatibility column name retained for immutable historical and purchase-context rows.';
