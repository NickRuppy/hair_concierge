-- Receipt acceptance is durable before any email attempt. Customer.io queue
-- acknowledgement is deliberately distinct from delivered/sent confirmation.
ALTER TABLE private.public_contract_declaration_receipts
  DROP CONSTRAINT public_contract_declaration_receipts_delivery_status_check;
-- The prior schema's `error` state required failed_at. Replace that check
-- because retryable/support states are errors too; discover its generated
-- PostgreSQL name without assuming a migration-tool-specific suffix.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'private.public_contract_declaration_receipts'::regclass
      AND contype = 'c'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%failed_at%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE private.public_contract_declaration_receipts DROP CONSTRAINT %I', constraint_name);
  END IF;
END;
$$;
UPDATE private.public_contract_declaration_receipts
  SET delivery_status = 'queued'
  WHERE delivery_status = 'pending';
ALTER TABLE private.public_contract_declaration_receipts
  ALTER COLUMN delivery_status SET DEFAULT 'queued',
  ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  ADD COLUMN delivery_lease_expires_at timestamptz,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN provider_delivery_id text,
  ADD COLUMN provider_queued_at timestamptz,
  ADD COLUMN last_error_code text;
ALTER TABLE private.public_contract_declaration_receipts
  ADD CONSTRAINT public_contract_declaration_receipts_delivery_status_check
    CHECK (delivery_status IN ('queued', 'sending', 'retryable_error', 'support_required', 'sent')),
  ADD CONSTRAINT public_contract_declaration_receipts_queued_provider_check
    CHECK ((delivery_status = 'queued' AND provider_delivery_id IS NOT NULL AND provider_queued_at IS NOT NULL)
      OR delivery_status <> 'queued' OR provider_delivery_id IS NULL),
  ADD CONSTRAINT public_contract_declaration_receipts_sent_provider_check
    CHECK (delivery_status <> 'sent' OR (provider_delivery_id IS NOT NULL AND sent_at IS NOT NULL)),
  ADD CONSTRAINT public_contract_declaration_receipts_failure_status_check
    CHECK ((delivery_status IN ('retryable_error', 'support_required')) = (failed_at IS NOT NULL)),
  ADD CONSTRAINT public_contract_declaration_receipts_error_code_check
    CHECK (last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,80}$');

CREATE INDEX public_contract_declaration_receipts_dispatch_idx
  ON private.public_contract_declaration_receipts (next_attempt_at)
  WHERE delivery_status IN ('retryable_error') OR (delivery_status = 'queued' AND provider_delivery_id IS NULL);

CREATE FUNCTION public.claim_public_contract_declaration_receipt_deliveries(
  p_limit integer,
  p_lease_seconds integer
) RETURNS TABLE (declaration_id uuid, attempt_id uuid, receipt_payload jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10
    OR p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'Invalid receipt delivery claim' USING ERRCODE = '22023';
  END IF;
  -- A dead worker might have crossed the provider boundary. Park its row for
  -- support rather than releasing it into a potentially duplicate send.
  UPDATE private.public_contract_declaration_receipts
    SET delivery_status = 'support_required', delivery_lease_expires_at = NULL,
        failed_at = clock_timestamp(), last_error_code = 'delivery_lease_expired'
    WHERE delivery_status = 'sending' AND delivery_lease_expires_at < clock_timestamp();

  RETURN QUERY
  WITH due AS (
    SELECT r.declaration_id
      FROM private.public_contract_declaration_receipts r
      WHERE (r.delivery_status = 'queued' AND r.provider_delivery_id IS NULL)
         OR (r.delivery_status = 'retryable_error' AND r.next_attempt_at <= clock_timestamp())
      ORDER BY r.next_attempt_at, r.declaration_id
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
  ), claimed AS (
    UPDATE private.public_contract_declaration_receipts r
      SET delivery_status = 'sending', delivery_attempt_id = gen_random_uuid(),
          delivery_lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
          delivery_attempts = r.delivery_attempts + 1, failed_at = NULL, last_error_code = NULL
      FROM due
      WHERE r.declaration_id = due.declaration_id
      RETURNING r.declaration_id, r.delivery_attempt_id, r.receipt_payload
  ) SELECT claimed.declaration_id, claimed.delivery_attempt_id, claimed.receipt_payload FROM claimed;
END;
$$;

CREATE FUNCTION public.complete_public_contract_declaration_receipt_delivery(
  p_declaration_id uuid,
  p_attempt_id uuid,
  p_outcome text,
  p_error_code text,
  p_provider_delivery_id text,
  p_provider_queued_at text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE updated_count integer;
BEGIN
  IF p_outcome NOT IN ('queued', 'retryable_error', 'support_required')
    OR (p_error_code <> '' AND p_error_code !~ '^[a-z0-9_]{1,80}$') THEN
    RAISE EXCEPTION 'Invalid receipt delivery completion' USING ERRCODE = '22023';
  END IF;
  UPDATE private.public_contract_declaration_receipts
    SET delivery_status = p_outcome,
      provider_delivery_id = CASE WHEN p_outcome = 'queued' THEN NULLIF(p_provider_delivery_id, '') ELSE NULL END,
      provider_queued_at = CASE WHEN p_outcome = 'queued' THEN NULLIF(p_provider_queued_at, '')::timestamptz ELSE NULL END,
      delivery_lease_expires_at = NULL,
      delivery_attempt_id = NULL,
      failed_at = CASE WHEN p_outcome = 'queued' THEN NULL ELSE clock_timestamp() END,
      next_attempt_at = CASE WHEN p_outcome = 'retryable_error' THEN clock_timestamp() + interval '5 minutes' ELSE next_attempt_at END,
      last_error_code = NULLIF(p_error_code, '')
    WHERE declaration_id = p_declaration_id AND delivery_attempt_id = p_attempt_id
      AND delivery_status = 'sending'
      AND (p_outcome <> 'queued' OR (NULLIF(p_provider_delivery_id, '') IS NOT NULL AND NULLIF(p_provider_queued_at, '') IS NOT NULL));
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

-- Delivery confirmation can only be recorded by a future verified provider
-- webhook/reconciliation lane that has the queue identifier. No queue ACK is sent.
CREATE FUNCTION public.confirm_public_contract_declaration_receipt_delivery(
  p_declaration_id uuid,
  p_provider_delivery_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE private.public_contract_declaration_receipts
    SET delivery_status = 'sent', sent_at = clock_timestamp(), failed_at = NULL,
        last_error_code = NULL
    WHERE declaration_id = p_declaration_id AND delivery_status = 'queued'
      AND provider_delivery_id = NULLIF(p_provider_delivery_id, '');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_contract_declaration_receipt_deliveries(integer, integer),
  public.complete_public_contract_declaration_receipt_delivery(uuid, uuid, text, text, text, text),
  public.confirm_public_contract_declaration_receipt_delivery(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_public_contract_declaration_receipt_deliveries(integer, integer),
  public.complete_public_contract_declaration_receipt_delivery(uuid, uuid, text, text, text, text),
  public.confirm_public_contract_declaration_receipt_delivery(uuid, text)
  TO service_role;
GRANT UPDATE (delivery_attempts, delivery_lease_expires_at, next_attempt_at,
  provider_delivery_id, provider_queued_at, last_error_code)
  ON private.public_contract_declaration_receipts TO service_role;
